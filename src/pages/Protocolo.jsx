import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { useUser } from '../context/UserContext';
import { PROTOCOLOS, CHECKLISTS } from '../constants/estructura';
import { generarExcel } from '../utils/generarExcel';
import { sincronizar } from '../utils/sync';
import { supabase } from '../config/supabase';

function leerComoDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Seccion({ titulo, children }) {
  return (
    <div style={s.seccion}>
      <h2 style={s.seccionTitulo}>{titulo}</h2>
      {children}
    </div>
  );
}

function EstadoBadge({ estado }) {
  const cfg = {
    pendiente:  { color: '#8892b0', label: 'Pendiente' },
    borrador:   { color: '#f59e0b', label: 'Borrador' },
    completado: { color: '#10b981', label: 'Completado' },
  };
  const { color, label } = cfg[estado] ?? cfg.pendiente;
  return (
    <span style={{ ...s.estadoBadge, color, borderColor: color }}>
      {label}
    </span>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ ...s.toast, background: toast.tipo === 'error' ? '#ef4444' : '#10b981' }}>
      {toast.msg}
    </div>
  );
}

function ModalConfirmar({ onConfirmar, onCancelar }) {
  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <h2 style={s.modalTitulo}>¿Marcar como completado?</h2>
        <p style={s.modalTexto}>
          Se registrará como completado. Podrás editarlo si es necesario.
        </p>
        <div style={s.modalBotones}>
          <button style={s.btnModalCancelar} onClick={onCancelar}>Cancelar</button>
          <button style={s.btnModalConfirmar} onClick={onConfirmar}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Protocolo() {
  const { tipo, entidadId, protocoloId } = useParams();
  const navigate = useNavigate();
  const { usuario } = useUser();

  const entidadIdReal = tipo === 'caida' ? Number(entidadId) : entidadId;
  const protocoloInfo = PROTOCOLOS.find(p => p.id === protocoloId);
  const itemsChecklist = CHECKLISTS[protocoloId] ?? [];
  const emptyChecklist = Object.fromEntries(itemsChecklist.map(i => [i.id, false]));
  const nombreEntidad = tipo === 'tramo' ? `Tramo ${entidadId}` : `Caída ${entidadId}`;
  const titulo = `${nombreEntidad} — ${protocoloInfo?.nombre ?? protocoloId}`;
  const volverUrl = tipo === 'tramo' ? `/tramos/${entidadId}` : `/caidas/${entidadId}`;

  // Form state
  const [checklist, setChecklist] = useState(emptyChecklist);
  const [observaciones, setObservaciones] = useState('');
  const [estado, setEstado] = useState('pendiente');
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [toast, setToast] = useState(null);

  const cargadoRef = useRef(false);
  const toastTimerRef = useRef(null);
  const inputCamaraRef = useRef(null);
  const inputGaleriaRef = useRef(null);

  // ── Dexie live queries ──────────────────────────────────────────────────────

  // Usamos toArray para distinguir "cargando" (undefined) de "no encontrado" ([])
  const protocoloArr = useLiveQuery(
    () =>
      db.protocolos
        .where('entidadId').equals(entidadIdReal)
        .filter(p => p.tipo === tipo && p.protocoloId === protocoloId)
        .toArray(),
    [tipo, entidadIdReal, protocoloId]
  );

  const cargando = protocoloArr === undefined;
  const protocolo = protocoloArr?.[0];

  const fotos = useLiveQuery(
    () =>
      protocolo?.id
        ? db.fotos.where('protocoloLocalId').equals(protocolo.id).toArray()
        : Promise.resolve([]),
    [protocolo?.id]
  ) ?? [];

  // ── Carga inicial ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!cargando && !cargadoRef.current) {
      cargadoRef.current = true;
      if (protocolo) {
        setChecklist(protocolo.datos?.checklist ?? emptyChecklist);
        setObservaciones(protocolo.datos?.observaciones ?? '');
        setEstado(protocolo.estado);
      }
    }
  }, [cargando, protocolo]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function mostrarToast(msg, tipo = 'ok') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, tipo });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  function toggleCheck(itemId) {
    setChecklist(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  // Garantiza que el protocolo exista en Dexie y retorna su id
  async function obtenerOCrearId() {
    if (protocolo?.id) return protocolo.id;
    const now = new Date().toISOString();
    return db.protocolos.add({
      tipo,
      entidad: tipo,
      entidadId: entidadIdReal,
      protocoloId,
      estado: 'borrador',
      usuarioNombre: usuario,
      fechaCreacion: now,
      fechaModificacion: now,
      datos: { checklist, observaciones },
      sincronizada: false,
    });
  }

  // ── Guardar ──────────────────────────────────────────────────────────────────

  async function guardar(nuevoEstado) {
    if (guardando) return;
    setGuardando(true);
    try {
      const now = new Date().toISOString();
      const datos = { checklist, observaciones };

      if (protocolo) {
        await db.protocolos.update(protocolo.id, {
          estado: nuevoEstado,
          usuarioNombre: usuario,
          fechaModificacion: now,
          datos,
          sincronizada: false, // resetear para que sync la re-envíe
        });
      } else {
        await db.protocolos.add({
          tipo,
          entidad: tipo,
          entidadId: entidadIdReal,
          protocoloId,
          estado: nuevoEstado,
          usuarioNombre: usuario,
          fechaCreacion: now,
          fechaModificacion: now,
          datos,
          sincronizada: false,
        });
      }

      setEstado(nuevoEstado);
      mostrarToast(nuevoEstado === 'completado' ? '✓ Protocolo completado' : '✓ Borrador guardado');

      // Sincronizar inmediatamente si hay señal
      if (supabase && navigator.onLine) {
        setSincronizando(true);
        sincronizar().finally(() => setSincronizando(false));
      }
    } catch {
      mostrarToast('Error al guardar', 'error');
    } finally {
      setGuardando(false);
    }
  }

  // ── Fotos ────────────────────────────────────────────────────────────────────

  async function handleFotoSeleccionada(e) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    try {
      const protocoloLocalId = await obtenerOCrearId();
      for (const file of files) {
        const dataUrl = await leerComoDataUrl(file);
        await db.fotos.add({
          protocoloLocalId,
          nombre: file.name,
          tipo: file.type,
          dataUrl,
          sincronizada: false,
        });
      }
      mostrarToast(`${files.length > 1 ? files.length + ' fotos agregadas' : 'Foto agregada'}`);
    } catch {
      mostrarToast('Error al guardar foto', 'error');
    } finally {
      e.target.value = '';
    }
  }

  async function eliminarFoto(fotoId) {
    await db.fotos.delete(fotoId);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (cargando) {
    return <div style={s.cargando}>Cargando...</div>;
  }

  const completados = itemsChecklist.filter(item => checklist[item.id]).length;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.btnVolver} onClick={() => navigate(volverUrl)}>
          ← Volver
        </button>
        <div style={s.headerInfo}>
          <h1 style={s.titulo}>{titulo}</h1>
          <EstadoBadge estado={estado} />
        </div>
      </div>

      {/* Checklist */}
      <Seccion titulo={`Lista de verificación (${completados}/${itemsChecklist.length})`}>
        <div style={s.checklist}>
          {itemsChecklist.map(item => (
            <label key={item.id} style={s.checkItem} onClick={() => toggleCheck(item.id)}>
              <div style={{
                ...s.checkBox,
                background: checklist[item.id] ? '#10b981' : 'transparent',
                borderColor: checklist[item.id] ? '#10b981' : '#0f3460',
              }}>
                {checklist[item.id] && <span style={s.checkMark}>✓</span>}
              </div>
              <span style={{ color: checklist[item.id] ? '#10b981' : '#ccd6f6', fontSize: '14px' }}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </Seccion>

      {/* Observaciones */}
      <Seccion titulo="Observaciones">
        <textarea
          style={s.textarea}
          value={observaciones}
          onChange={e => setObservaciones(e.target.value)}
          placeholder="Notas adicionales, condiciones del terreno, anomalías observadas..."
          rows={4}
        />
      </Seccion>

      {/* Fotos */}
      <Seccion titulo={`Fotos${fotos.length > 0 ? ` (${fotos.length})` : ''}`}>
        <input
          ref={inputCamaraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFotoSeleccionada}
        />
        <input
          ref={inputGaleriaRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFotoSeleccionada}
        />

        <div style={s.fotosBotones}>
          <button style={s.btnFoto} onClick={() => inputCamaraRef.current?.click()}>
            📷 Sacar foto
          </button>
          <button style={{ ...s.btnFoto, background: '#0f3460' }} onClick={() => inputGaleriaRef.current?.click()}>
            🖼 Adjuntar foto
          </button>
        </div>

        {fotos.length > 0 ? (
          <div style={s.fotosGrid}>
            {fotos.map(foto => (
              <div key={foto.id} style={s.fotoCard}>
                <div style={s.fotoThumb}>
                  <img src={foto.dataUrl} alt={foto.nombre} style={s.fotoImg} />
                  <button
                    style={s.btnEliminarFoto}
                    onClick={() => eliminarFoto(foto.id)}
                    title="Eliminar foto"
                  >
                    ×
                  </button>
                </div>
                <input
                  type="text"
                  defaultValue={foto.descripcion ?? ''}
                  placeholder="Descripción..."
                  style={s.fotoDescInput}
                  onBlur={e => db.fotos.update(foto.id, { descripcion: e.target.value })}
                />
              </div>
            ))}
          </div>
        ) : (
          <p style={s.sinFotos}>Sin fotos adjuntas</p>
        )}
      </Seccion>

      {/* Botones de acción */}
      <div style={s.accionesCabecera}>
        {supabase && (
          <span style={s.syncLabel}>
            {sincronizando
              ? '🔄 sincronizando...'
              : protocolo?.sincronizada
              ? '☁️ sincronizado'
              : '🔄 pendiente'}
          </span>
        )}
      </div>
      <div style={s.acciones}>
        <button
          style={{ ...s.btnAccion, ...s.btnBorrador }}
          onClick={() => guardar('borrador')}
          disabled={guardando}
        >
          {guardando ? 'Guardando...' : 'Guardar borrador'}
        </button>
        <button
          style={{
            ...s.btnAccion,
            ...s.btnCompletar,
            opacity: estado === 'completado' ? 0.6 : 1,
          }}
          onClick={() => setConfirmando(true)}
          disabled={guardando || estado === 'completado'}
        >
          {estado === 'completado' ? '✓ Completado' : 'Marcar como completado'}
        </button>
      </div>

      {/* Botón Excel — solo si el protocolo ya fue guardado */}
      {protocolo && (
        <div style={s.accionesSecundarias}>
          <button
            style={{ ...s.btnAccion, ...s.btnExcel, opacity: descargando ? 0.6 : 1 }}
            onClick={async () => {
              setDescargando(true);
              try {
                await generarExcel(protocolo, fotos);
              } catch (e) {
                mostrarToast('Error al generar Excel', 'error');
              } finally {
                setDescargando(false);
              }
            }}
            disabled={descargando}
          >
            {descargando ? 'Generando...' : '⬇ Descargar Excel'}
          </button>
        </div>
      )}

      {/* Toast */}
      <Toast toast={toast} />

      {/* Modal confirmación */}
      {confirmando && (
        <ModalConfirmar
          onConfirmar={async () => { setConfirmando(false); await guardar('completado'); }}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = {
  page: { maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' },
  cargando: { color: '#8892b0', padding: '40px', textAlign: 'center' },

  header: { marginBottom: '24px' },
  btnVolver: {
    background: 'transparent', border: 'none', color: '#8892b0',
    cursor: 'pointer', fontSize: '14px', padding: '0 0 12px',
  },
  headerInfo: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  titulo: { color: '#ccd6f6', fontSize: '20px', fontWeight: 700, flex: 1 },
  estadoBadge: {
    fontSize: '12px', fontWeight: 600, border: '1.5px solid',
    borderRadius: '6px', padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
  },

  seccion: {
    background: '#16213e', borderRadius: '12px', padding: '20px',
    border: '1px solid #0f3460', marginBottom: '16px',
  },
  seccionTitulo: { color: '#8892b0', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' },

  checklist: { display: 'flex', flexDirection: 'column', gap: '4px' },
  checkItem: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
    userSelect: 'none',
  },
  checkBox: {
    width: '22px', height: '22px', borderRadius: '6px', border: '2px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 0.15s',
  },
  checkMark: { color: '#fff', fontSize: '13px', fontWeight: 700, lineHeight: 1 },

  textarea: {
    width: '100%', background: '#0f3460', border: '1px solid #1e3a5f',
    borderRadius: '8px', color: '#ccd6f6', fontSize: '14px',
    padding: '12px', resize: 'vertical', fontFamily: 'inherit',
    lineHeight: '1.5', outline: 'none',
  },

  fotosBotones: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' },
  btnFoto: {
    background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px',
    padding: '10px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
    flex: '1 1 140px',
  },
  fotosGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
  },
  fotoCard: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fotoThumb: { position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden' },
  fotoImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  btnEliminarFoto: {
    position: 'absolute', top: '4px', right: '4px',
    background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
    borderRadius: '50%', width: '22px', height: '22px', fontSize: '16px',
    lineHeight: '20px', cursor: 'pointer', padding: 0, textAlign: 'center',
  },
  fotoDescInput: {
    width: '100%', background: '#0f3460', border: '1px solid #1e3a5f',
    borderRadius: '6px', color: '#ccd6f6', fontSize: '11px',
    padding: '5px 7px', fontFamily: 'inherit', outline: 'none',
    lineHeight: '1.4',
  },
  sinFotos: { color: '#8892b0', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', margin: '8px 0 0' },

  accionesCabecera: { display: 'flex', justifyContent: 'flex-end', marginBottom: '6px', minHeight: '20px' },
  syncLabel: { color: '#8892b0', fontSize: '12px' },
  acciones: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '0' },
  accionesSecundarias: { marginTop: '10px' },
  btnAccion: {
    flex: '1 1 140px', padding: '14px 20px', borderRadius: '10px',
    fontSize: '15px', fontWeight: 700, cursor: 'pointer', border: 'none',
  },
  btnBorrador: { background: '#0f3460', color: '#ccd6f6' },
  btnCompletar: { background: '#10b981', color: '#fff' },
  btnExcel: {
    background: '#1d6a34', color: '#fff',
    width: '100%', fontSize: '14px',
  },

  toast: {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    color: '#fff', padding: '12px 24px', borderRadius: '10px',
    fontSize: '14px', fontWeight: 600, zIndex: 1000,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    whiteSpace: 'nowrap',
  },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: '16px',
  },
  modal: {
    background: '#16213e', borderRadius: '16px', padding: '32px 28px',
    maxWidth: '360px', width: '100%', border: '1px solid #0f3460',
  },
  modalTitulo: { color: '#ccd6f6', fontSize: '18px', fontWeight: 700, marginBottom: '12px' },
  modalTexto: { color: '#8892b0', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' },
  modalBotones: { display: 'flex', gap: '10px' },
  btnModalCancelar: {
    flex: 1, padding: '12px', background: '#0f3460', color: '#ccd6f6',
    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
  btnModalConfirmar: {
    flex: 1, padding: '12px', background: '#10b981', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
};
