import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { construirDocumentoPDF } from '../utils/generarPDF';
import logoUrl from '../assets/Logo_ExMaq.jpg';

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

function fmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function Firma() {
  const { token } = useParams();
  const [protocolo, setProtocolo]   = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [firmaUrl, setFirmaUrl]     = useState(null);
  const [observacion, setObservacion] = useState('');
  const [vista, setVista]           = useState('detalle');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [subiendo, setSubiendo]     = useState(false);
  const [itoUsuario, setItoUsuario] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { cargarProtocolo(); }, [token]);

  async function cargarProtocolo() {
    try {
      const { data, error: err } = await supabase
        .from('protocolos')
        .select('*')
        .eq('firma_token', token)
        .single();

      if (err || !data) {
        setError('Protocolo no encontrado o link inválido.');
        setLoading(false);
        return;
      }
      setProtocolo(data);

      const { data: ito } = await supabase
        .from('usuarios')
        .select('id, nombre, firma_url')
        .eq('rol', 'ito')
        .single();
      setItoUsuario(ito ?? null);
      if (ito?.firma_url) setFirmaUrl(ito.firma_url);

      await generarBlobPDF(data);
    } catch {
      setError('Error al cargar el protocolo.');
    } finally {
      setLoading(false);
    }
  }

  async function generarBlobPDF(data) {
    try {
      const protMapeado = {
        tipo:          data.tipo,
        entidad:       data.entidad ?? data.tipo,
        entidadId:     data.entidad_id,
        protocoloId:   data.protocolo_id,
        estado:        data.estado,
        edp:           data.edp ?? null,
        fechaEnvio:    data.fecha_envio ?? null,
        usuarioNombre: data.usuario_nombre ?? null,
        datos:         data.datos ?? {},
      };
      const { doc } = await construirDocumentoPDF(protMapeado, [], '', '', []);
      const blob = doc.output('blob');
      setPdfBlobUrl(URL.createObjectURL(blob));
    } catch {
      // Falla silenciosa; el resto de la página sigue funcionando
    }
  }

  async function subirFirma(file) {
    if (!itoUsuario?.id) return;
    setSubiendo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `firmas/ito/${itoUsuario.id}.${ext}`;

      await supabase.storage
        .from('fotos-canal-arauco')
        .upload(path, file, { upsert: true });

      const { data } = supabase.storage
        .from('fotos-canal-arauco')
        .getPublicUrl(path);

      await supabase
        .from('usuarios')
        .update({ firma_url: data.publicUrl })
        .eq('id', itoUsuario.id);

      setFirmaUrl(data.publicUrl);
      setItoUsuario(prev => ({ ...prev, firma_url: data.publicUrl }));
    } catch {
      // silently fail
    } finally {
      setSubiendo(false);
    }
  }

  async function rechazar() {
    if (!observacion.trim()) return;
    setSubiendo(true);
    await supabase
      .from('protocolos')
      .update({ estado: 'con_observaciones', observacion_ito: observacion })
      .eq('firma_token', token);
    setSubiendo(false);
    setVista('confirmado');
  }

  async function firmar() {
    if (!firmaUrl) return;
    setSubiendo(true);
    await supabase
      .from('protocolos')
      .update({
        estado:           'firmado',
        firma_imagen_url: firmaUrl,
        firma_fecha:      new Date().toISOString(),
      })
      .eq('firma_token', token);
    setSubiendo(false);
    setVista('confirmado');
  }

  if (loading) {
    return <div style={s.centrado}>Cargando...</div>;
  }

  if (error) {
    return (
      <div style={s.centrado}>
        <span style={s.errorIcono}>⚠️</span>
        <p style={s.errorMsg}>{error}</p>
      </div>
    );
  }

  const tipoLabel    = NOMBRE_TIPO[protocolo?.tipo] ?? protocolo?.tipo ?? '';
  const entidadLabel = `${tipoLabel} ${protocolo?.entidad_id ?? ''}`;

  if (vista === 'confirmado') {
    return (
      <div style={s.page}>
        <Header protocolo={protocolo} tipoLabel={tipoLabel} entidadLabel={entidadLabel} />
        <div style={s.confirmado}>
          <span style={s.confirmadoIcono}>✅</span>
          <h2 style={s.confirmadoTitulo}>Respuesta enviada</h2>
          <p style={s.confirmadoTexto}>El equipo de El Espinal ha sido notificado.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <Header protocolo={protocolo} tipoLabel={tipoLabel} entidadLabel={entidadLabel} />

      {/* PDF */}
      <section style={s.seccion}>
        <h3 style={s.seccionTitulo}>Protocolo</h3>
        {pdfBlobUrl ? (
          <>
            <iframe
              src={pdfBlobUrl}
              style={s.iframe}
              title="PDF Protocolo"
            />
            <a
              href={pdfBlobUrl}
              download={`${protocolo.protocolo_id}_${protocolo.entidad_id}.pdf`}
              style={s.btnDescarga}
            >
              ↓ Descargar PDF
            </a>
          </>
        ) : (
          <p style={s.pdfNote}>Vista previa del PDF no disponible.</p>
        )}
      </section>

      {/* Firma ITO */}
      <section style={s.seccion}>
        <h3 style={s.seccionTitulo}>Firma ITO</h3>
        {firmaUrl ? (
          <div style={s.firmaPreviewBox}>
            <img src={firmaUrl} alt="Firma ITO" style={s.firmaImg} />
            <button
              style={s.btnCambiarFirma}
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendo}
            >
              Cambiar firma
            </button>
          </div>
        ) : (
          <button
            style={s.dropzone}
            onClick={() => fileInputRef.current?.click()}
            disabled={subiendo}
          >
            {subiendo ? 'Subiendo...' : '+ Sube tu firma (PNG/JPG)'}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) subirFirma(f);
            e.target.value = '';
          }}
        />
      </section>

      {/* Acciones */}
      {vista === 'rechazar' ? (
        <section style={s.seccion}>
          <h3 style={s.seccionTitulo}>Observación (obligatoria)</h3>
          <textarea
            value={observacion}
            onChange={e => setObservacion(e.target.value)}
            placeholder="Describe el problema o corrección necesaria..."
            rows={5}
            style={s.textarea}
          />
          <div style={s.accionesRow}>
            <button style={s.btnCancelar} onClick={() => setVista('detalle')} disabled={subiendo}>
              Cancelar
            </button>
            <button
              style={{ ...s.btnRechazar, opacity: !observacion.trim() || subiendo ? 0.5 : 1 }}
              disabled={!observacion.trim() || subiendo}
              onClick={rechazar}
            >
              {subiendo ? 'Enviando...' : 'Enviar observación'}
            </button>
          </div>
        </section>
      ) : (
        <div style={s.accionesRow}>
          <button style={s.btnRechazar} onClick={() => setVista('rechazar')} disabled={subiendo}>
            Rechazar con observación
          </button>
          <button
            style={{ ...s.btnFirmar, opacity: !firmaUrl || subiendo ? 0.5 : 1 }}
            disabled={!firmaUrl || subiendo}
            onClick={firmar}
          >
            {subiendo ? 'Procesando...' : 'Confirmar firma'}
          </button>
        </div>
      )}
    </div>
  );
}

function Header({ protocolo, tipoLabel, entidadLabel }) {
  return (
    <header style={s.header}>
      <img src={logoUrl} alt="ExMaq" style={s.logo} />
      <div style={s.headerTexto}>
        <div style={s.appNombre}>Canal Arauco — Portal ITO</div>
        <div style={s.protNombre}>
          {protocolo?.protocolo_id ?? ''} — {entidadLabel}
        </div>
        {protocolo?.fecha_modificacion && (
          <div style={s.fechaEnvio}>
            Enviado para firma el {fmtFecha(protocolo.fecha_modificacion)}
          </div>
        )}
      </div>
    </header>
  );
}

const s = {
  page: {
    maxWidth: '700px',
    margin: '0 auto',
    padding: '24px 16px 60px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    minHeight: '100vh',
    background: '#1a1a2e',
    color: '#ccd6f6',
  },
  centrado: {
    minHeight: '100vh',
    background: '#1a1a2e',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#8892b0',
    fontSize: '15px',
    gap: '12px',
  },
  errorIcono: { fontSize: '40px' },
  errorMsg:   { color: '#f87171', fontSize: '15px', textAlign: 'center', maxWidth: '320px' },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    background: '#16213e',
    borderRadius: '12px',
    border: '1px solid #0f3460',
  },
  logo: { width: '52px', height: 'auto', borderRadius: '6px', flexShrink: 0 },
  headerTexto: { display: 'flex', flexDirection: 'column', gap: '3px' },
  appNombre:  { color: '#64ffda', fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px' },
  protNombre: { color: '#ccd6f6', fontSize: '16px', fontWeight: 700 },
  fechaEnvio: { color: '#8892b0', fontSize: '12px' },

  seccion: {
    background: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  seccionTitulo: {
    color: '#8892b0',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    margin: 0,
  },

  iframe: {
    width: '100%',
    height: '500px',
    border: '1px solid #0f3460',
    borderRadius: '8px',
    background: '#0a1428',
  },
  btnDescarga: {
    display: 'inline-block',
    color: '#64ffda',
    fontSize: '13px',
    fontWeight: 700,
    textDecoration: 'none',
    padding: '8px 14px',
    border: '1px solid rgba(100,255,218,0.3)',
    borderRadius: '8px',
    alignSelf: 'flex-start',
  },
  pdfNote: { color: '#8892b0', fontSize: '13px', margin: 0 },

  firmaPreviewBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  firmaImg: {
    maxHeight: '100px',
    maxWidth: '260px',
    borderRadius: '6px',
    border: '1px solid #0f3460',
    background: '#fff',
    padding: '6px',
  },
  btnCambiarFirma: {
    background: 'transparent',
    border: '1px solid #1e3a5f',
    borderRadius: '7px',
    color: '#8892b0',
    fontSize: '12px',
    fontWeight: 600,
    padding: '8px 14px',
    cursor: 'pointer',
  },
  dropzone: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '90px',
    border: '2px dashed #1e3a5f',
    borderRadius: '10px',
    color: '#8892b0',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'transparent',
    width: '100%',
    boxSizing: 'border-box',
  },

  textarea: {
    width: '100%',
    background: '#0f3460',
    border: '1px solid #1e3a5f',
    borderRadius: '8px',
    color: '#ccd6f6',
    fontSize: '14px',
    padding: '12px 14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },

  accionesRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  btnCancelar: {
    flex: 1,
    padding: '14px',
    background: '#0f3460',
    border: 'none',
    borderRadius: '10px',
    color: '#ccd6f6',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnRechazar: {
    flex: 1,
    padding: '14px',
    background: 'rgba(239,68,68,0.12)',
    border: '1.5px solid rgba(239,68,68,0.4)',
    borderRadius: '10px',
    color: '#f87171',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnFirmar: {
    flex: 1,
    padding: '14px',
    background: '#10b981',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },

  confirmado: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '60px 24px',
    textAlign: 'center',
  },
  confirmadoIcono: { fontSize: '56px' },
  confirmadoTitulo: { color: '#64ffda', fontSize: '22px', fontWeight: 700, margin: 0 },
  confirmadoTexto:  { color: '#8892b0', fontSize: '14px', margin: 0 },
};
