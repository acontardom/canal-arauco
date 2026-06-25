import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { construirDocumentoPDF } from '../utils/generarPDF';
import logoUrl from '../assets/Logo_ExMaq.jpg';

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

function fmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function PageShell({ children, centered = false }) {
  return (
    <div style={s.outer}>
      <div style={centered ? s.innerCentered : s.inner}>
        {children}
      </div>
    </div>
  );
}

export default function Firma() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [confirmando, setConfirmando] = useState(null); // null | 'firmar' | 'rechazar'
  const [protocolo, setProtocolo]     = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl]   = useState(null);
  const [firmaUrl, setFirmaUrl]       = useState(null);
  const [observacion, setObservacion] = useState('');
  const [vista, setVista]             = useState('detalle');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [subiendo, setSubiendo]       = useState(false);
  const [itoUsuario, setItoUsuario]   = useState(null);
  const [pdfFirmadoUrl, setPdfFirmadoUrl] = useState(null);
  const [datosProtocolo, setDatosProtocolo] = useState({});
  const [fotosAdjuntas, setFotosAdjuntas]   = useState([]);
  const fileInputRef = useRef(null);

  function combinarFotos(datosProto, fotosAdj) {
    const fotosNube    = datosProto?.fotosNubeSeleccionadas ?? [];
    const fotosDirectas = (fotosAdj ?? []).map(f => ({
      storageUrl:  f.storage_url,
      descripcion: f.descripcion ?? f.nombre ?? '',
    }));
    const urlsNube = new Set(fotosNube.map(f => f.storageUrl).filter(Boolean));
    return [...fotosNube, ...fotosDirectas.filter(f => !urlsNube.has(f.storageUrl))];
  }

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

      if (data.estado === 'con_observaciones') {
        setError('Este protocolo está siendo corregido. Se enviará un nuevo link cuando esté listo.');
        setLoading(false);
        return;
      }

      // Cargar datos y fotos adjuntas en paralelo
      const [{ data: datosRow }, { data: fotosAdj }] = await Promise.all([
        supabase.from('protocolos').select('datos').eq('id', data.id).single(),
        supabase.from('fotos').select('storage_url, descripcion, nombre').eq('protocolo_id', data.id),
      ]);

      const datosCargados   = datosRow?.datos ?? data.datos ?? {};
      const fotosAdjCargadas = fotosAdj ?? [];

      if (data.estado === 'firmado') {
        setProtocolo(data);
        setDatosProtocolo(datosCargados);
        setFotosAdjuntas(fotosAdjCargadas);
        await generarBlobPDF(data, datosCargados, fotosAdjCargadas);
        setVista('ya_firmado');
        setLoading(false);
        return;
      }

      if (data.estado !== 'enviado_ito') {
        setError('Este link ya no es válido.');
        setLoading(false);
        return;
      }

      const { data: ito } = await supabase
        .from('usuarios')
        .select('id, nombre, firma_url')
        .eq('rol', 'ito')
        .single();

      setProtocolo(data);
      setDatosProtocolo(datosCargados);
      setFotosAdjuntas(fotosAdjCargadas);
      setItoUsuario(ito ?? null);
      if (ito?.firma_url) setFirmaUrl(ito.firma_url);

      await generarBlobPDF(data, datosCargados, fotosAdjCargadas);
    } catch {
      setError('Error al cargar el protocolo.');
    } finally {
      setLoading(false);
    }
  }

  async function generarBlobPDF(data, datosProto, fotosAdj) {
    try {
      const protMapeado = {
        id:                data.id,
        protocoloId:       data.protocolo_id,
        tipo:              data.tipo,
        entidadId:         data.entidad_id,
        entidad:           data.entidad ?? data.tipo,
        estado:            data.estado,
        edp:               data.edp ?? null,
        fechaEnvio:        data.fecha_envio ?? null,
        usuarioNombre:     data.usuario_nombre ?? null,
        fechaCreacion:     data.fecha_creacion ?? null,
        fechaModificacion: data.fecha_modificacion ?? null,
        supabaseId:        data.id,
        datos:             datosProto ?? data.datos ?? {},
      };
      const fotosParaPDF = combinarFotos(datosProto, fotosAdj);
      const kmInicio = (datosProto ?? {}).kmInicio ?? '';
      const kmFin    = (datosProto ?? {}).kmFin    ?? '';
      const { doc } = await construirDocumentoPDF(protMapeado, fotosParaPDF, kmInicio, kmFin, []);
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

  async function confirmarFirma() {
    if (!firmaUrl) return;
    setSubiendo(true);

    try {
      // 1. Descargar firma con manejo de errores CORS
      let firmaBase64 = null;
      try {
        const firmaResp = await fetch(firmaUrl, { mode: 'cors' });
        if (!firmaResp.ok) throw new Error(`HTTP ${firmaResp.status}`);
        const firmaBlob = await firmaResp.blob();
        firmaBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(firmaBlob);
        });
      } catch (corsErr) {
        console.warn('[Firma] Error CORS al descargar firma, intentando via Supabase Storage SDK:', corsErr);
        // Fallback: descargar via SDK (evita restricciones CORS en URLs de Storage)
        const ext  = firmaUrl.split('.').pop().split('?')[0] || 'png';
        const path = `firmas/ito/${itoUsuario.id}.${ext}`;
        const { data: firmaData } = await supabase.storage
          .from('fotos-canal-arauco')
          .download(path);
        if (firmaData) {
          firmaBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(firmaData);
          });
        }
      }

      if (!firmaBase64) throw new Error('No se pudo cargar la imagen de firma');
      console.log('[Firma] firmaBase64 cargado, longitud:', firmaBase64.length);

      // 2. Construir protocolo completo con datos ya en estado
      const protocoloCompleto = {
        id:                protocolo.id,
        protocoloId:       protocolo.protocolo_id,
        tipo:              protocolo.tipo,
        entidadId:         protocolo.entidad_id,
        entidad:           protocolo.entidad ?? protocolo.tipo,
        estado:            protocolo.estado,
        edp:               protocolo.edp ?? null,
        fechaEnvio:        protocolo.fecha_envio ?? null,
        usuarioNombre:     protocolo.usuario_nombre ?? null,
        fechaCreacion:     protocolo.fecha_creacion ?? null,
        fechaModificacion: protocolo.fecha_modificacion ?? null,
        supabaseId:        protocolo.id,
        datos:             datosProtocolo,
      };

      // 3. Combinar fotos y generar PDF con firma incrustada
      const fotosParaPDF = combinarFotos(datosProtocolo, fotosAdjuntas);
      const kmInicio = datosProtocolo?.kmInicio ?? '';
      const kmFin    = datosProtocolo?.kmFin    ?? '';
      console.log('[Firma] fotosParaPDF:', fotosParaPDF);
      console.log('[Firma] datosProtocolo.fotosNubeSeleccionadas:', datosProtocolo?.fotosNubeSeleccionadas);
      console.log('[Firma] Generando PDF, firmaBase64 presente:', !!firmaBase64);
      const { doc } = await construirDocumentoPDF(
        protocoloCompleto,
        fotosParaPDF,
        kmInicio,
        kmFin,
        [],
        firmaBase64,
      );

      // 4. Subir PDF a Storage
      const pdfBytes = doc.output('arraybuffer');
      const pdfBlob  = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfPath  = `protocolos/firmados/${protocolo.id}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('fotos-canal-arauco')
        .upload(pdfPath, pdfBlob, { upsert: true, contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      const { data: pdfData } = supabase.storage
        .from('fotos-canal-arauco')
        .getPublicUrl(pdfPath);

      // 5. Actualizar estado en Supabase
      await supabase
        .from('protocolos')
        .update({
          estado:           'firmado',
          firma_imagen_url: firmaUrl,
          firma_fecha:      new Date().toISOString(),
          pdf_firmado_url:  pdfData.publicUrl,
        })
        .eq('firma_token', token);

      setPdfFirmadoUrl(pdfData.publicUrl);
      setVista('confirmado');
    } catch (err) {
      console.error('[Firma] Error al confirmar:', err);
      alert('Hubo un error al procesar la firma. Intenta nuevamente.');
    } finally {
      setSubiendo(false);
    }
  }

  // ── Estados de pantalla ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageShell centered>
        <p style={s.cargandoMsg}>Cargando...</p>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell centered>
        <span style={s.errorIcono}>⚠️</span>
        <p style={s.errorMsg}>{error}</p>
      </PageShell>
    );
  }

  const tipoLabel    = NOMBRE_TIPO[protocolo?.tipo] ?? protocolo?.tipo ?? '';
  const entidadLabel = `${tipoLabel} ${protocolo?.entidad_id ?? ''}`;

  if (vista === 'ya_firmado') {
    return (
      <PageShell>
        <Header protocolo={protocolo} entidadLabel={entidadLabel} />
        <div style={s.confirmado}>
          <span style={s.confirmadoIcono}>✅</span>
          <h2 style={s.confirmadoTitulo}>Protocolo firmado</h2>
          {protocolo?.firma_fecha && (
            <p style={s.confirmadoTexto}>Firmado el {fmtFecha(protocolo.firma_fecha)}</p>
          )}
          {protocolo?.firma_imagen_url && (
            <img src={protocolo.firma_imagen_url} alt="Firma ITO" style={s.firmaImgFirmado} />
          )}
          {pdfBlobUrl && (
            <a
              href={pdfBlobUrl}
              download={`${protocolo.protocolo_id}_${protocolo.entidad_id}.pdf`}
              style={s.btnDescarga}
            >
              ↓ Descargar PDF
            </a>
          )}
        </div>
      </PageShell>
    );
  }

  if (vista === 'confirmado') {
    return (
      <PageShell>
        <Header protocolo={protocolo} entidadLabel={entidadLabel} />
        <div style={s.confirmado}>
          <span style={s.confirmadoIcono}>✅</span>
          <h2 style={s.confirmadoTitulo}>Respuesta enviada</h2>
          <p style={s.confirmadoTexto}>El equipo ha sido notificado.</p>
          <div style={s.confirmadoBotones}>
            {pdfFirmadoUrl && (
              <a href={pdfFirmadoUrl} target="_blank" rel="noopener noreferrer" style={s.btnDescarga}>
                ↓ Descargar PDF firmado
              </a>
            )}
            <button onClick={() => navigate('/ito')} style={s.btnVolverPortal}>
              ← Volver al portal
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Header protocolo={protocolo} entidadLabel={entidadLabel} />

      {/* PDF */}
      <section style={s.seccion}>
        <h3 style={s.seccionTitulo}>Protocolo</h3>
        {pdfBlobUrl ? (
          <>
            <iframe src={pdfBlobUrl} style={s.iframe} title="PDF Protocolo" />
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
              onClick={() => setConfirmando('rechazar')}
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
            onClick={() => setConfirmando('firmar')}
          >
            {subiendo ? 'Procesando...' : 'Confirmar firma'}
          </button>
        </div>
      )}

      {/* Modal de confirmación */}
      {confirmando && (
        <div style={s.modalOverlay}>
          <div style={s.modalBox}>
            <h3 style={s.modalTitulo}>
              {confirmando === 'firmar' ? '¿Confirmar firma?' : '¿Enviar observación?'}
            </h3>
            <p style={s.modalTexto}>
              {confirmando === 'firmar'
                ? 'Esta acción es irreversible. El protocolo quedará firmado permanentemente.'
                : 'El protocolo volverá al equipo para corrección.'}
            </p>
            <div style={s.modalBotones}>
              <button style={s.btnModalCancelar} onClick={() => setConfirmando(null)}>
                Cancelar
              </button>
              <button
                style={{ ...s.btnModalConfirmar, background: confirmando === 'firmar' ? '#15803d' : '#f97316' }}
                onClick={() => {
                  const accion = confirmando;
                  setConfirmando(null);
                  if (accion === 'firmar') confirmarFirma();
                  else rechazar();
                }}
              >
                {confirmando === 'firmar' ? 'Sí, firmar' : 'Sí, enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function Header({ protocolo, entidadLabel }) {
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
  outer: {
    minHeight: '100vh',
    background: '#0f172a',
    color: 'white',
  },
  inner: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    paddingBottom: '60px',
    boxSizing: 'border-box',
  },
  innerCentered: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },

  cargandoMsg: { color: '#8892b0', fontSize: '15px', margin: 0 },
  errorIcono:  { fontSize: '40px' },
  errorMsg:    { color: '#f87171', fontSize: '15px', textAlign: 'center', maxWidth: '360px', margin: 0 },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    background: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
  },
  logo:        { width: '52px', height: 'auto', borderRadius: '6px', flexShrink: 0 },
  headerTexto: { display: 'flex', flexDirection: 'column', gap: '3px' },
  appNombre:   { color: '#64ffda', fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px' },
  protNombre:  { color: '#f1f5f9', fontSize: '16px', fontWeight: 700 },
  fechaEnvio:  { color: '#94a3b8', fontSize: '12px' },

  seccion: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  seccionTitulo: {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    margin: 0,
  },

  iframe: {
    width: '100%',
    height: '560px',
    border: '1px solid #334155',
    borderRadius: '8px',
    background: '#0f172a',
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
  pdfNote: { color: '#94a3b8', fontSize: '13px', margin: 0 },

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
    border: '1px solid #334155',
    background: '#fff',
    padding: '6px',
  },
  firmaImgFirmado: {
    maxHeight: '120px',
    maxWidth: '300px',
    borderRadius: '8px',
    border: '1px solid #334155',
    background: '#fff',
    padding: '8px',
    marginTop: '8px',
  },
  btnCambiarFirma: {
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: '7px',
    color: '#94a3b8',
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
    border: '2px dashed #334155',
    borderRadius: '10px',
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    background: 'transparent',
    width: '100%',
    boxSizing: 'border-box',
  },

  textarea: {
    width: '100%',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#f1f5f9',
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
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '10px',
    color: '#f1f5f9',
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
    gap: '14px',
    padding: '60px 24px',
    textAlign: 'center',
  },
  confirmadoIcono:  { fontSize: '56px' },
  confirmadoTitulo: { color: '#64ffda', fontSize: '22px', fontWeight: 700, margin: 0 },
  confirmadoTexto:  { color: '#94a3b8', fontSize: '14px', margin: 0 },
  confirmadoBotones: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' },

  btnVolverPortal: {
    background: '#1d4ed8',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modalBox: {
    background: '#1e293b',
    borderRadius: '12px',
    padding: '2rem',
    maxWidth: '400px',
    width: '100%',
    border: '1px solid #334155',
  },
  modalTitulo: { color: '#f1f5f9', fontSize: '18px', fontWeight: 700, margin: '0 0 12px' },
  modalTexto:  { color: '#94a3b8', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.5' },
  modalBotones: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  btnModalCancelar: {
    background: '#374151',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 18px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnModalConfirmar: {
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 18px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
