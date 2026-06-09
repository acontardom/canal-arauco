import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { useUser } from '../context/UserContext';
import { PROTOCOLOS, CHECKLISTS } from '../constants/estructura';
import { generarExcel } from '../utils/generarExcel';
import { sincronizar } from '../utils/sync';
import { supabase } from '../config/supabase';

const OPCION_COLOR = { si: '#10b981', no: '#ef4444', na: '#f59e0b' };
const PROBETA_VOL = 0.0101;
const PROTOCOLOS_CON_CAMIONES = new Set(['PICE2_RADIER', 'PICE2_MURO']);

function leerComoDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function calcTiempoTraslado(horaCarga, horaDescarga) {
  if (!horaCarga || !horaDescarga) return '';
  const [h1, m1] = horaCarga.split(':').map(Number);
  const [h2, m2] = horaDescarga.split(':').map(Number);
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  return diff >= 0 ? String(diff) : '';
}

function calcPU(pesoVacia, pesoLlena) {
  const v = parseFloat(pesoVacia);
  const l = parseFloat(pesoLlena);
  if (isNaN(v) || isNaN(l) || l <= v) return '';
  return String(Math.round((l - v) / PROBETA_VOL));
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
  return <span style={{ ...s.estadoBadge, color, borderColor: color }}>{label}</span>;
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
        <p style={s.modalTexto}>Se registrará como completado. Podrás editarlo si es necesario.</p>
        <div style={s.modalBotones}>
          <button style={s.btnModalCancelar} onClick={onCancelar}>Cancelar</button>
          <button style={s.btnModalConfirmar} onClick={onConfirmar}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function CamionModal({ camion: initialData, onSave, onCancelar, onEliminar }) {
  const [data, setData] = useState(initialData);
  const inputCamaraRef = useRef(null);
  const inputGaleriaRef = useRef(null);

  function set(field, value) {
    setData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'horaCarga' || field === 'horaDescarga') {
        next.tiempoTraslado = calcTiempoTraslado(next.horaCarga, next.horaDescarga);
      }
      if (field === 'puProbetaVacia' || field === 'puProbetaLlena') {
        next.puResultado = calcPU(next.puProbetaVacia, next.puProbetaLlena);
      }
      return next;
    });
  }

  async function handleFoto(e) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const dataUrl = await leerComoDataUrl(file);
      setData(prev => ({ ...prev, fotos: [...(prev.fotos ?? []), { dataUrl, descripcion: '' }] }));
    }
    e.target.value = '';
  }

  function eliminarFotoCamion(fi) {
    setData(prev => ({ ...prev, fotos: prev.fotos.filter((_, i) => i !== fi) }));
  }

  function setDescFoto(fi, desc) {
    setData(prev => ({
      ...prev,
      fotos: prev.fotos.map((f, i) => i === fi ? { ...f, descripcion: desc } : f),
    }));
  }

  return (
    <div style={s.overlay}>
      <div style={sm.container}>
        <div style={sm.header}>
          <h2 style={sm.titulo}>Camión #{data.numero}</h2>
          <button style={sm.btnCerrar} onClick={onCancelar}>×</button>
        </div>

        <div style={sm.body}>
          <label style={sm.label}>Tipo hormigón / volumen</label>
          <input style={sm.input} placeholder="G20 — 8.5 m³" value={data.tipoHormigon} onChange={e => set('tipoHormigon', e.target.value)} />

          <label style={sm.label}>N° guía / planta</label>
          <input style={sm.input} placeholder="G-1234 / Planta Los Ángeles" value={data.guia} onChange={e => set('guia', e.target.value)} />

          <div style={sm.row}>
            <div style={sm.half}>
              <label style={sm.label}>Cono (cm)</label>
              <input style={sm.input} type="number" placeholder="0" value={data.cono} onChange={e => set('cono', e.target.value)} />
            </div>
            <div style={sm.half}>
              <label style={sm.label}>Temperatura (°C)</label>
              <input style={sm.input} type="number" placeholder="0" value={data.temperatura} onChange={e => set('temperatura', e.target.value)} />
            </div>
          </div>

          <div style={sm.row}>
            <div style={sm.half}>
              <label style={sm.label}>Hora de carga</label>
              <input style={sm.input} type="time" value={data.horaCarga} onChange={e => set('horaCarga', e.target.value)} />
            </div>
            <div style={sm.half}>
              <label style={sm.label}>Hora de descarga</label>
              <input style={sm.input} type="time" value={data.horaDescarga} onChange={e => set('horaDescarga', e.target.value)} />
            </div>
          </div>

          <label style={sm.label}>Tiempo de traslado (min)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              style={{ ...sm.input, flex: 1 }}
              type="number"
              placeholder="Auto"
              value={data.tiempoTraslado}
              onChange={e => set('tiempoTraslado', e.target.value)}
            />
            {data.tiempoTraslado && <span style={sm.calcBadge}>{data.tiempoTraslado} min</span>}
          </div>

          <p style={sm.sectionTitle}>Ensayo Peso Unitario — probeta 10.1 L</p>
          <div style={sm.row}>
            <div style={sm.half}>
              <label style={sm.label}>Probeta vacía (kg)</label>
              <input style={sm.input} type="number" step="0.001" placeholder="0.000" value={data.puProbetaVacia} onChange={e => set('puProbetaVacia', e.target.value)} />
            </div>
            <div style={sm.half}>
              <label style={sm.label}>Probeta + hormigón (kg)</label>
              <input style={sm.input} type="number" step="0.001" placeholder="0.000" value={data.puProbetaLlena} onChange={e => set('puProbetaLlena', e.target.value)} />
            </div>
          </div>
          {data.puResultado && (
            <div style={sm.resultado}>PU = <strong>{Number(data.puResultado).toLocaleString('es-CL')} kg/m³</strong></div>
          )}

          <label style={sm.label}>Observaciones del camión</label>
          <textarea style={sm.textarea} rows={3} value={data.observaciones} onChange={e => set('observaciones', e.target.value)} placeholder="Notas del camión..." />

          <p style={sm.sectionTitle}>Fotos del camión</p>
          <input ref={inputCamaraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFoto} />
          <input ref={inputGaleriaRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFoto} />
          <div style={s.fotosBotones}>
            <button style={sm.btnFotoSm} onClick={() => inputCamaraRef.current?.click()}>📷 Foto</button>
            <button style={{ ...sm.btnFotoSm, background: '#0f3460' }} onClick={() => inputGaleriaRef.current?.click()}>🖼 Adjuntar</button>
          </div>
          {(data.fotos?.length > 0) && (
            <div style={s.fotosGrid}>
              {data.fotos.map((foto, fi) => (
                <div key={fi} style={s.fotoCard}>
                  <div style={s.fotoThumb}>
                    <img src={foto.dataUrl} alt="" style={s.fotoImg} />
                    <button style={s.btnEliminarFoto} onClick={() => eliminarFotoCamion(fi)}>×</button>
                  </div>
                  <input
                    type="text"
                    defaultValue={foto.descripcion}
                    placeholder="Descripción..."
                    style={s.fotoDescInput}
                    onBlur={e => setDescFoto(fi, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={sm.footer}>
          {onEliminar && (
            <button style={sm.btnEliminar} onClick={onEliminar}>Eliminar</button>
          )}
          <button style={sm.btnCancelar} onClick={onCancelar}>Cancelar</button>
          <button style={sm.btnGuardar} onClick={() => onSave(data)}>Guardar</button>
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
  const emptyChecklist = Object.fromEntries(itemsChecklist.map(i => [i.id, null]));
  const nombreEntidad = tipo === 'tramo' ? `Tramo ${entidadId}` : `Caída ${entidadId}`;
  const titulo = `${nombreEntidad} — ${protocoloInfo?.nombre ?? protocoloId}`;
  const volverUrl = tipo === 'tramo' ? `/tramos/${entidadId}` : `/caidas/${entidadId}`;
  const tieneCamiones = PROTOCOLOS_CON_CAMIONES.has(protocoloId);

  const [checklist, setChecklist] = useState(emptyChecklist);
  const [observaciones, setObservaciones] = useState('');
  const [camiones, setCamiones] = useState([]);
  const [camionModal, setCamionModal] = useState(null);
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

  useEffect(() => {
    if (!cargando && !cargadoRef.current) {
      cargadoRef.current = true;
      if (protocolo) {
        setChecklist(protocolo.datos?.checklist ?? emptyChecklist);
        setObservaciones(protocolo.datos?.observaciones ?? '');
        setCamiones(protocolo.datos?.camiones ?? []);
        setEstado(protocolo.estado);
      }
    }
  }, [cargando, protocolo]);

  function mostrarToast(msg, tipo = 'ok') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, tipo });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  function setCheckValue(itemId, opcion) {
    setChecklist(prev => ({
      ...prev,
      [itemId]: prev[itemId] === opcion ? null : opcion,
    }));
  }

  async function obtenerOCrearId() {
    if (protocolo?.id) return protocolo.id;
    const now = new Date().toISOString();
    return db.protocolos.add({
      tipo, entidad: tipo, entidadId: entidadIdReal, protocoloId,
      estado: 'borrador', usuarioNombre: usuario,
      fechaCreacion: now, fechaModificacion: now,
      datos: { checklist, observaciones, camiones },
      sincronizada: false,
    });
  }

  async function guardar(nuevoEstado) {
    if (guardando) return;
    setGuardando(true);
    try {
      const now = new Date().toISOString();
      const datos = { checklist, observaciones, camiones };

      if (protocolo) {
        await db.protocolos.update(protocolo.id, {
          estado: nuevoEstado, usuarioNombre: usuario,
          fechaModificacion: now, datos, sincronizada: false,
        });
      } else {
        await db.protocolos.add({
          tipo, entidad: tipo, entidadId: entidadIdReal, protocoloId,
          estado: nuevoEstado, usuarioNombre: usuario,
          fechaCreacion: now, fechaModificacion: now, datos, sincronizada: false,
        });
      }

      setEstado(nuevoEstado);
      mostrarToast(nuevoEstado === 'completado' ? '✓ Protocolo completado' : '✓ Borrador guardado');

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

  async function handleFotoSeleccionada(e) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      const protocoloLocalId = await obtenerOCrearId();
      for (const file of files) {
        const dataUrl = await leerComoDataUrl(file);
        await db.fotos.add({ protocoloLocalId, nombre: file.name, tipo: file.type, dataUrl, sincronizada: false });
      }
      mostrarToast(files.length > 1 ? `${files.length} fotos agregadas` : 'Foto agregada');
    } catch {
      mostrarToast('Error al guardar foto', 'error');
    } finally {
      e.target.value = '';
    }
  }

  async function eliminarFoto(fotoId) {
    await db.fotos.delete(fotoId);
  }

  function abrirNuevoCamion() {
    setCamionModal({
      idx: -1,
      data: {
        id: Date.now().toString(),
        numero: camiones.length + 1,
        tipoHormigon: '', guia: '',
        cono: '', temperatura: '',
        horaCarga: '', horaDescarga: '', tiempoTraslado: '',
        puProbetaVacia: '', puProbetaLlena: '', puResultado: '',
        observaciones: '', fotos: [],
      },
    });
  }

  function guardarCamion(dataFinal) {
    if (camionModal.idx === -1) {
      setCamiones(prev => [...prev, dataFinal]);
    } else {
      setCamiones(prev => prev.map((c, i) => i === camionModal.idx ? dataFinal : c));
    }
    setCamionModal(null);
  }

  function eliminarCamionActual() {
    if (camionModal.idx !== -1) {
      setCamiones(prev => prev.filter((_, i) => i !== camionModal.idx));
    }
    setCamionModal(null);
  }

  if (cargando) return <div style={s.cargando}>Cargando...</div>;

  const respondidos = itemsChecklist.filter(item => checklist[item.id] !== null).length;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.btnVolver} onClick={() => navigate(volverUrl)}>← Volver</button>
        <div style={s.headerInfo}>
          <h1 style={s.titulo}>{titulo}</h1>
          <EstadoBadge estado={estado} />
        </div>
      </div>

      {/* Checklist */}
      <Seccion titulo={
        itemsChecklist.length > 0
          ? `Lista de verificación (${respondidos}/${itemsChecklist.length})`
          : 'Lista de verificación'
      }>
        {itemsChecklist.length === 0 ? (
          <p style={s.checklistPendiente}>Checklist pendiente de configuración</p>
        ) : (
          <div style={s.checklist}>
            {itemsChecklist.map(item => {
              const val = checklist[item.id];
              return (
                <div key={item.id} style={s.checkItem}>
                  <span style={s.checkLabel}>{item.label}</span>
                  <div style={s.checkBtns}>
                    {(['si', 'no', 'na']).map(opcion => {
                      const active = val === opcion;
                      return (
                        <button
                          key={opcion}
                          style={{
                            ...s.checkBtn,
                            background: active ? OPCION_COLOR[opcion] : 'transparent',
                            borderColor: active ? OPCION_COLOR[opcion] : '#0f3460',
                            color: active ? '#fff' : '#8892b0',
                          }}
                          onClick={() => setCheckValue(item.id, opcion)}
                        >
                          {opcion === 'si' ? 'SÍ' : opcion === 'no' ? 'NO' : 'N/A'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Seccion>

      {/* Camiones HA — solo PICE2_RADIER / PICE2_MURO */}
      {tieneCamiones && (
        <Seccion titulo={`Control H.A. — Camiones${camiones.length > 0 ? ` (${camiones.length})` : ''}`}>
          <button style={s.btnAgregarCamion} onClick={abrirNuevoCamion}>
            + Agregar camión
          </button>
          {camiones.length > 0 && (
            <div style={s.camionesList}>
              {camiones.map((c, idx) => (
                <div key={c.id} style={s.camionFila} onClick={() => setCamionModal({ idx, data: { ...c } })}>
                  <div style={s.camionNum}>#{c.numero}</div>
                  <div style={s.camionInfo}>
                    <span style={s.camionTipo}>{c.tipoHormigon || '—'}</span>
                    <span style={s.camionMeta}>
                      {[c.guia && `G: ${c.guia}`, c.cono && `Cono: ${c.cono}cm`, c.temperatura && `${c.temperatura}°C`]
                        .filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <span style={s.chevronSm}>›</span>
                </div>
              ))}
            </div>
          )}
        </Seccion>
      )}

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
        <input ref={inputCamaraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFotoSeleccionada} />
        <input ref={inputGaleriaRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFotoSeleccionada} />

        <div style={s.fotosBotones}>
          <button style={s.btnFoto} onClick={() => inputCamaraRef.current?.click()}>📷 Sacar foto</button>
          <button style={{ ...s.btnFoto, background: '#0f3460' }} onClick={() => inputGaleriaRef.current?.click()}>🖼 Adjuntar foto</button>
        </div>

        {fotos.length > 0 ? (
          <div style={s.fotosGrid}>
            {fotos.map(foto => (
              <div key={foto.id} style={s.fotoCard}>
                <div style={s.fotoThumb}>
                  <img src={foto.dataUrl} alt={foto.nombre} style={s.fotoImg} />
                  <button style={s.btnEliminarFoto} onClick={() => eliminarFoto(foto.id)} title="Eliminar">×</button>
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

      {/* Acciones */}
      <div style={s.accionesCabecera}>
        {supabase && (
          <span style={s.syncLabel}>
            {sincronizando ? '🔄 sincronizando...' : protocolo?.sincronizada ? '☁️ sincronizado' : '🔄 pendiente'}
          </span>
        )}
      </div>
      <div style={s.acciones}>
        <button style={{ ...s.btnAccion, ...s.btnBorrador }} onClick={() => guardar('borrador')} disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar borrador'}
        </button>
        <button
          style={{ ...s.btnAccion, ...s.btnCompletar, opacity: estado === 'completado' ? 0.6 : 1 }}
          onClick={() => setConfirmando(true)}
          disabled={guardando || estado === 'completado'}
        >
          {estado === 'completado' ? '✓ Completado' : 'Marcar como completado'}
        </button>
      </div>

      {protocolo && (
        <div style={s.accionesSecundarias}>
          <button
            style={{ ...s.btnAccion, ...s.btnExcel, opacity: descargando ? 0.6 : 1 }}
            onClick={async () => {
              setDescargando(true);
              try { await generarExcel(protocolo, fotos); }
              catch { mostrarToast('Error al generar Excel', 'error'); }
              finally { setDescargando(false); }
            }}
            disabled={descargando}
          >
            {descargando ? 'Generando...' : '⬇ Descargar Excel'}
          </button>
        </div>
      )}

      <Toast toast={toast} />

      {confirmando && (
        <ModalConfirmar
          onConfirmar={async () => { setConfirmando(false); await guardar('completado'); }}
          onCancelar={() => setConfirmando(false)}
        />
      )}

      {camionModal && (
        <CamionModal
          camion={camionModal.data}
          onSave={guardarCamion}
          onCancelar={() => setCamionModal(null)}
          onEliminar={camionModal.idx !== -1 ? eliminarCamionActual : null}
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
  btnVolver: { background: 'transparent', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: '14px', padding: '0 0 12px' },
  headerInfo: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  titulo: { color: '#ccd6f6', fontSize: '20px', fontWeight: 700, flex: 1 },
  estadoBadge: { fontSize: '12px', fontWeight: 600, border: '1.5px solid', borderRadius: '6px', padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0 },

  seccion: { background: '#16213e', borderRadius: '12px', padding: '20px', border: '1px solid #0f3460', marginBottom: '16px' },
  seccionTitulo: { color: '#8892b0', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' },

  checklist: { display: 'flex', flexDirection: 'column' },
  checkItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '10px', padding: '9px 0', borderBottom: '1px solid #0f3460',
  },
  checkLabel: { color: '#ccd6f6', fontSize: '13px', flex: 1, lineHeight: 1.3 },
  checkBtns: { display: 'flex', gap: '4px', flexShrink: 0 },
  checkBtn: {
    padding: '5px 9px', border: '1.5px solid', borderRadius: '6px',
    fontSize: '11px', fontWeight: 700, cursor: 'pointer',
    transition: 'all 0.12s', minWidth: '36px', textAlign: 'center',
  },
  checklistPendiente: { color: '#8892b0', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', margin: 0 },

  btnAgregarCamion: {
    background: '#0f3460', color: '#64ffda', border: '1.5px solid #64ffda',
    borderRadius: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', width: '100%', marginBottom: '12px',
  },
  camionesList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  camionFila: {
    display: 'flex', alignItems: 'center', gap: '12px',
    background: '#0f3460', borderRadius: '8px', padding: '12px 14px',
    cursor: 'pointer', border: '1px solid #1e3a5f',
  },
  camionNum: { color: '#64ffda', fontWeight: 700, fontSize: '15px', minWidth: '28px' },
  camionInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  camionTipo: { color: '#ccd6f6', fontSize: '13px', fontWeight: 600 },
  camionMeta: { color: '#8892b0', fontSize: '11px' },
  chevronSm: { color: '#8892b0', fontSize: '18px' },

  textarea: {
    width: '100%', background: '#0f3460', border: '1px solid #1e3a5f',
    borderRadius: '8px', color: '#ccd6f6', fontSize: '14px',
    padding: '12px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', outline: 'none',
  },

  fotosBotones: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' },
  btnFoto: { background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', flex: '1 1 140px' },
  fotosGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
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
    padding: '5px 7px', fontFamily: 'inherit', outline: 'none', lineHeight: '1.4',
  },
  sinFotos: { color: '#8892b0', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', margin: '8px 0 0' },

  accionesCabecera: { display: 'flex', justifyContent: 'flex-end', marginBottom: '6px', minHeight: '20px' },
  syncLabel: { color: '#8892b0', fontSize: '12px' },
  acciones: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  accionesSecundarias: { marginTop: '10px' },
  btnAccion: { flex: '1 1 140px', padding: '14px 20px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', border: 'none' },
  btnBorrador: { background: '#0f3460', color: '#ccd6f6' },
  btnCompletar: { background: '#10b981', color: '#fff' },
  btnExcel: { background: '#1d6a34', color: '#fff', width: '100%', fontSize: '14px' },

  toast: {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    color: '#fff', padding: '12px 24px', borderRadius: '10px',
    fontSize: '14px', fontWeight: 600, zIndex: 1000,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
  },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: '16px',
  },
  modal: { background: '#16213e', borderRadius: '16px', padding: '32px 28px', maxWidth: '360px', width: '100%', border: '1px solid #0f3460' },
  modalTitulo: { color: '#ccd6f6', fontSize: '18px', fontWeight: 700, marginBottom: '12px' },
  modalTexto: { color: '#8892b0', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' },
  modalBotones: { display: 'flex', gap: '10px' },
  btnModalCancelar: { flex: 1, padding: '12px', background: '#0f3460', color: '#ccd6f6', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  btnModalConfirmar: { flex: 1, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
};

const sm = {
  container: {
    background: '#16213e', borderRadius: '16px', width: '100%',
    maxWidth: '480px', maxHeight: '90vh', display: 'flex',
    flexDirection: 'column', border: '1px solid #0f3460', overflow: 'hidden',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #0f3460', flexShrink: 0 },
  titulo: { color: '#ccd6f6', fontSize: '17px', fontWeight: 700, margin: 0 },
  btnCerrar: { background: 'transparent', border: 'none', color: '#8892b0', fontSize: '24px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' },
  body: { padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { color: '#8892b0', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
  sectionTitle: { color: '#64ffda', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '6px 0 0' },
  input: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '14px', padding: '10px 12px',
    fontFamily: 'inherit', outline: 'none', width: '100%',
  },
  textarea: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '14px', padding: '10px 12px',
    fontFamily: 'inherit', outline: 'none', width: '100%', resize: 'vertical',
  },
  row: { display: 'flex', gap: '10px' },
  half: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  calcBadge: { background: '#10b981', color: '#fff', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' },
  resultado: { background: '#0a2040', border: '1px solid #10b981', borderRadius: '8px', padding: '10px 14px', color: '#ccd6f6', fontSize: '14px' },
  btnFotoSm: { background: '#10b981', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flex: '1 1 100px' },
  footer: { display: 'flex', gap: '8px', padding: '14px 20px', borderTop: '1px solid #0f3460', flexShrink: 0 },
  btnEliminar: { background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  btnCancelar: { flex: 1, background: '#0f3460', color: '#ccd6f6', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  btnGuardar: { flex: 2, background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
};
