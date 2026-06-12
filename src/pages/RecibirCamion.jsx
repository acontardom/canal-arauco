import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { useUser } from '../context/UserContext';
import { TRAMOS, CAIDAS, ATRAVIESOS } from '../constants/estructura';
import { comprimirFoto } from '../utils/comprimirFoto';
import { sincronizar } from '../utils/sync';
import { supabase } from '../config/supabase';

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const LISTAS = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };
const TIPOS_HORMIGON = ['G5', 'G20', 'G25', 'G30'];
const TIPOS_CON_ENSAYO = ['G20', 'G25', 'G30'];
const USOS_HORMIGON = [
  { valor: 'radier', label: 'Radier' },
  { valor: 'muro', label: 'Muro' },
  { valor: 'otro', label: 'Otro' },
];
const PLANTAS = ['Membrillar', 'Quilanco', 'Río San Martín'];
const PESO_HOYA = 6.9;
const PROBETA_VOL = 0.0101;

function sumarMinutos(hora, minutos) {
  const [h, m] = hora.split(':').map(Number);
  const total = ((h * 60 + m + minutos) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function randomTraslado() {
  return Math.floor(Math.random() * (50 - 35 + 1)) + 35;
}

function calcPU(pesoTotal) {
  const t = parseFloat(pesoTotal);
  if (isNaN(t) || t <= PESO_HOYA) return '';
  return String(Math.round((t - PESO_HOYA) / PROBETA_VOL));
}

const initialForm = {
  tipoHormigon: '',
  volumen: '',
  numeroGuia: '',
  planta: '',
  cono: '',
  tempHormigon: '',
  tempAmbiente: '',
  horaCarga: '',
  horaDescarga: '',
  tiempoTraslado: '',
  pesoHoyaHormigon: '',
  observaciones: '',
  involucraOtra: false,
  entidadSecundariaTipo: '',
  entidadSecundariaId: '',
  fotoGuia: null,
  fotosEnsayo: [],
  usoHormigon: '',
};

export default function RecibirCamion() {
  const navigate = useNavigate();
  const { usuario } = useUser();

  const [tipo, setTipo] = useState('tramo');
  const [entidadId, setEntidadId] = useState(String(TRAMOS[0]));
  const [form, setForm] = useState(initialForm);
  const [ultimoCamion, setUltimoCamion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [toast, setToast] = useState(null);

  const inputGuiaRef = useRef(null);
  const inputCamaraRef = useRef(null);
  const inputGaleriaRef = useRef(null);
  const toastTimerRef = useRef(null);

  const entidadIdReal = tipo === 'caida' ? Number(entidadId) : entidadId;

  function handleTipoChange(nuevoTipo) {
    setTipo(nuevoTipo);
    setEntidadId(String(LISTAS[nuevoTipo][0]));
  }

  function mostrarToast(msg, t = 'ok') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, tipo: t });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'horaCarga') {
        if (value) {
          const minutos = randomTraslado();
          next.tiempoTraslado = String(minutos);
          next.horaDescarga = sumarMinutos(value, minutos);
        } else {
          next.tiempoTraslado = '';
          next.horaDescarga = '';
        }
      }
      if (field === 'entidadSecundariaTipo') {
        next.entidadSecundariaId = '';
      }
      return next;
    });
  }

  async function handleFotoGuia(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await comprimirFoto(file);
    setForm(prev => ({ ...prev, fotoGuia: { dataUrl, storageUrl: null, subidaStorage: false } }));
    e.target.value = '';
  }

  async function handleFotosEnsayo(e) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const dataUrl = await comprimirFoto(file);
      setForm(prev => ({
        ...prev,
        fotosEnsayo: [...prev.fotosEnsayo, { dataUrl, descripcion: '', storageUrl: null, subidaStorage: false }],
      }));
    }
    e.target.value = '';
  }

  function setDescEnsayo(idx, desc) {
    setForm(prev => ({
      ...prev,
      fotosEnsayo: prev.fotosEnsayo.map((f, i) => i === idx ? { ...f, descripcion: desc } : f),
    }));
  }

  function eliminarFotoEnsayo(idx) {
    setForm(prev => ({ ...prev, fotosEnsayo: prev.fotosEnsayo.filter((_, i) => i !== idx) }));
  }

  const puCalculado = calcPU(form.pesoHoyaHormigon);

  async function registrarCamion() {
    if (!form.tipoHormigon) {
      mostrarToast('Selecciona el tipo de hormigón', 'error');
      return;
    }
    if (TIPOS_CON_ENSAYO.includes(form.tipoHormigon) && !form.usoHormigon) {
      mostrarToast('Selecciona para qué elemento es el hormigón', 'error');
      return;
    }
    setGuardando(true);
    try {
      const camion = {
        tipoEntidad: tipo,
        entidadId: entidadIdReal,
        entidadSecundariaTipo: form.involucraOtra ? (form.entidadSecundariaTipo || null) : null,
        entidadSecundariaId: form.involucraOtra && form.entidadSecundariaId
          ? (form.entidadSecundariaTipo === 'caida' ? Number(form.entidadSecundariaId) : form.entidadSecundariaId)
          : null,
        tipoHormigon: form.tipoHormigon,
        usoHormigon: TIPOS_CON_ENSAYO.includes(form.tipoHormigon) ? form.usoHormigon : null,
        volumen: form.volumen,
        numeroGuia: form.numeroGuia,
        planta: form.planta,
        cono: form.cono,
        tempHormigon: form.tempHormigon,
        tempAmbiente: form.tempAmbiente,
        horaCarga: form.horaCarga,
        horaDescarga: form.horaDescarga,
        tiempoTraslado: form.tiempoTraslado,
        pesoHoyaHormigon: form.pesoHoyaHormigon,
        puCalculado: calcPU(form.pesoHoyaHormigon),
        observaciones: form.observaciones,
        usuarioNombre: usuario,
        fechaRecepcion: new Date().toISOString(),
        sincronizado: false,
        supabaseId: null,
        fotoGuia: form.fotoGuia,
        fotosEnsayo: form.fotosEnsayo,
      };

      const id = await db.camiones.add(camion);

      setUltimoCamion({ ...camion, id });
      setForm(initialForm);

      if (supabase && navigator.onLine) {
        setSincronizando(true);
        sincronizar().finally(() => setSincronizando(false));
      }
    } catch {
      mostrarToast('Error al registrar camión', 'error');
    } finally {
      setGuardando(false);
    }
  }

  function registrarOtro() {
    setUltimoCamion(null);
    setForm(initialForm);
  }

  // ── Resumen tras guardar ───────────────────────────────────────────────────
  if (ultimoCamion) {
    const c = ultimoCamion;
    return (
      <div style={s.page}>
        <h1 style={s.titulo}>✅ Camión registrado</h1>
        {sincronizando && <div style={s.syncIndicator}>☁️ Sincronizando...</div>}
        <div style={s.resumenCard}>
          <p style={s.resumenLinea}><strong>{NOMBRE_TIPO[tipo]} {entidadId}</strong></p>
          <p style={s.resumenLinea}>Tipo hormigón: <strong>{c.tipoHormigon}</strong></p>
          {c.planta && <p style={s.resumenLinea}>Planta: {c.planta}</p>}
          {c.numeroGuia && <p style={s.resumenLinea}>N° Guía: {c.numeroGuia}</p>}
          {c.volumen && <p style={s.resumenLinea}>Volumen: {c.volumen} m³</p>}
          {c.cono && <p style={s.resumenLinea}>Cono: {c.cono} cm</p>}
          {c.horaCarga && <p style={s.resumenLinea}>Hora carga: {c.horaCarga} → Descarga: {c.horaDescarga} ({c.tiempoTraslado} min)</p>}
          {c.puCalculado && <p style={s.resumenLinea}>PU = <strong>{Number(c.puCalculado).toLocaleString('es-CL')} kg/m³</strong></p>}
        </div>
        <button style={s.btnGuardar} onClick={registrarOtro}>Registrar otro camión</button>
        <button style={s.btnSecundario} onClick={() => navigate('/')}>Ir al inicio</button>
      </div>
    );
  }

  // ── Formulario de recepción ────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <button style={s.btnVolver} onClick={() => navigate('/')}>← Inicio</button>
      <h1 style={s.titulo}>Recibir Camión</h1>

      {sincronizando && <div style={s.syncIndicator}>☁️ Sincronizando...</div>}

      <p style={s.sectionTitle}>Entidad Principal</p>
      <div style={s.row}>
        <div style={s.campo}>
          <label style={s.label}>Tipo</label>
          <select style={s.input} value={tipo} onChange={e => handleTipoChange(e.target.value)}>
            <option value="tramo">Tramo</option>
            <option value="caida">Caída</option>
            <option value="atravieso">Atravieso</option>
          </select>
        </div>
        <div style={s.campo}>
          <label style={s.label}>Entidad</label>
          <select style={s.input} value={entidadId} onChange={e => setEntidadId(e.target.value)}>
            {LISTAS[tipo].map(id => (
              <option key={id} value={id}>{NOMBRE_TIPO[tipo]} {id}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={s.tiposGridHorizontal}>
        {TIPOS_HORMIGON.map(t => (
          <button
            key={t}
            style={{ ...s.btnHormigon, ...(form.tipoHormigon === t ? s.btnHormigonActivo : {}) }}
            onClick={() => set('tipoHormigon', t)}
          >
            {t}
          </button>
        ))}
      </div>

      {TIPOS_CON_ENSAYO.includes(form.tipoHormigon) && (
        <div style={s.campo}>
          <label style={s.label}>¿Para qué elemento?</label>
          <div style={s.tiposGridHorizontal}>
            {USOS_HORMIGON.map(({ valor, label }) => (
              <button
                key={valor}
                style={{ ...s.btnHormigon, ...(form.usoHormigon === valor ? s.btnHormigonActivo : {}) }}
                onClick={() => set('usoHormigon', valor)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.tipoHormigon && (
        <>
          <div style={s.row}>
            <div style={s.campo}>
              <label style={s.label}>Planta</label>
              <select style={s.input} value={form.planta} onChange={e => set('planta', e.target.value)}>
                <option value="">Seleccionar...</option>
                {PLANTAS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={s.campo}>
              <label style={s.label}>N° Guía</label>
              <input style={s.input} type="number" placeholder="0" value={form.numeroGuia} onChange={e => set('numeroGuia', e.target.value)} />
            </div>
          </div>

          <div style={s.campo}>
            <label style={s.label}>Volumen (m³)</label>
            <input style={s.input} type="number" step="0.1" placeholder="8.5" value={form.volumen} onChange={e => set('volumen', e.target.value)} />
          </div>

          {TIPOS_CON_ENSAYO.includes(form.tipoHormigon) && (
            <>
              <div style={s.row}>
                <div style={s.campo}>
                  <label style={s.label}>Cono (cm)</label>
                  <input style={s.input} type="number" step="0.1" placeholder="0" value={form.cono} onChange={e => set('cono', e.target.value)} />
                </div>
                <div style={s.campo}>
                  <label style={s.label}>Temp. hormigón (°C)</label>
                  <input style={s.input} type="number" step="0.1" placeholder="0" value={form.tempHormigon} onChange={e => set('tempHormigon', e.target.value)} />
                </div>
                <div style={s.campo}>
                  <label style={s.label}>Temp. ambiente (°C)</label>
                  <input style={s.input} type="number" step="0.1" placeholder="0" value={form.tempAmbiente} onChange={e => set('tempAmbiente', e.target.value)} />
                </div>
              </div>

              <div style={s.row}>
                <div style={s.campo}>
                  <label style={s.label}>Hora de carga</label>
                  <input style={s.input} type="time" value={form.horaCarga} onChange={e => set('horaCarga', e.target.value)} />
                </div>
                <div style={s.campo}>
                  <label style={s.label}>Hora de descarga</label>
                  <input style={{ ...s.input, ...s.inputReadOnly }} type="time" value={form.horaDescarga} readOnly tabIndex={-1} />
                </div>
              </div>
              {form.tiempoTraslado && (
                <div style={s.calcBadge}>Tiempo de traslado: {form.tiempoTraslado} min</div>
              )}

              <p style={s.sectionTitle}>Ensayo Peso Unitario</p>
              <div style={s.row}>
                <div style={s.campo}>
                  <label style={s.label}>Peso de la hoya (kg)</label>
                  <div style={s.fixedValue}>{PESO_HOYA.toFixed(1).replace('.', ',')} kg</div>
                </div>
                <div style={s.campo}>
                  <label style={s.label}>Peso hoya + hormigón (kg)</label>
                  <input style={s.input} type="number" step="0.001" placeholder="0.000" value={form.pesoHoyaHormigon} onChange={e => set('pesoHoyaHormigon', e.target.value)} />
                </div>
              </div>
              {puCalculado && (
                <div style={s.resultado}>PU = <strong>{Number(puCalculado).toLocaleString('es-CL')} kg/m³</strong></div>
              )}
            </>
          )}

          <p style={s.sectionTitle}>Foto Guía de Despacho</p>
          <input ref={inputGuiaRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoGuia} />
          {form.fotoGuia ? (
            <div style={s.fotoGuiaWrap}>
              <div style={s.fotoThumb}>
                <img src={form.fotoGuia.dataUrl} alt="" style={s.fotoImg} />
                <button style={s.btnEliminarFoto} onClick={() => set('fotoGuia', null)}>×</button>
              </div>
              <button style={s.btnFotoSm} onClick={() => inputGuiaRef.current?.click()}>Cambiar foto</button>
            </div>
          ) : (
            <button style={s.btnFotoSm} onClick={() => inputGuiaRef.current?.click()}>📷 Agregar foto</button>
          )}

          {TIPOS_CON_ENSAYO.includes(form.tipoHormigon) && (
            <>
              <p style={s.sectionTitle}>Fotos del Ensayo</p>
              <input ref={inputCamaraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFotosEnsayo} />
              <input ref={inputGaleriaRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFotosEnsayo} />
              <div style={s.botonesCaptura}>
                <button style={s.btnFotoSm} onClick={() => inputCamaraRef.current?.click()}>📷 Foto</button>
                <button style={{ ...s.btnFotoSm, background: '#0f3460' }} onClick={() => inputGaleriaRef.current?.click()}>🖼 Adjuntar</button>
              </div>
              {form.fotosEnsayo.length > 0 && (
                <div style={s.grid}>
                  {form.fotosEnsayo.map((foto, idx) => (
                    <div key={idx} style={s.fotoCard}>
                      <div style={s.fotoThumb}>
                        <img src={foto.dataUrl} alt="" style={s.fotoImg} />
                        <button style={s.btnEliminarFoto} onClick={() => eliminarFotoEnsayo(idx)}>×</button>
                      </div>
                      <input
                        type="text"
                        placeholder="Descripción..."
                        style={s.descInput}
                        value={foto.descripcion}
                        onChange={e => setDescEnsayo(idx, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div style={s.campo}>
            <label style={s.label}>Observaciones</label>
            <textarea style={s.textarea} rows={3} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} placeholder="Notas..." />
          </div>

          <div style={s.toggleRow}>
            <span style={s.label}>¿Involucra otra entidad?</span>
            <button
              style={{ ...s.toggle, ...(form.involucraOtra ? s.toggleActivo : {}) }}
              onClick={() => set('involucraOtra', !form.involucraOtra)}
            >
              {form.involucraOtra ? 'Sí' : 'No'}
            </button>
          </div>

          {form.involucraOtra && (
            <div style={s.row}>
              <div style={s.campo}>
                <label style={s.label}>Tipo</label>
                <select style={s.input} value={form.entidadSecundariaTipo} onChange={e => set('entidadSecundariaTipo', e.target.value)}>
                  <option value="">Seleccionar...</option>
                  <option value="tramo">Tramo</option>
                  <option value="caida">Caída</option>
                  <option value="atravieso">Atravieso</option>
                </select>
              </div>
              <div style={s.campo}>
                <label style={s.label}>{NOMBRE_TIPO[form.entidadSecundariaTipo] ?? 'Entidad'}</label>
                <select
                  style={s.input}
                  value={form.entidadSecundariaId}
                  onChange={e => set('entidadSecundariaId', e.target.value)}
                  disabled={!form.entidadSecundariaTipo}
                >
                  <option value="">Seleccionar...</option>
                  {(LISTAS[form.entidadSecundariaTipo] ?? []).map(id => (
                    <option key={id} value={id}>{NOMBRE_TIPO[form.entidadSecundariaTipo]} {id}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button style={s.btnGuardar} onClick={registrarCamion} disabled={guardando}>
            {guardando ? 'Registrando...' : 'Registrar camión'}
          </button>
        </>
      )}

      {toast && (
        <div style={{ ...s.toast, ...(toast.tipo === 'error' ? s.toastError : {}) }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const s = {
  page: { maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '40px' },

  btnVolver: {
    background: 'transparent', border: 'none', color: '#8892b0',
    cursor: 'pointer', fontSize: '14px', padding: 0, alignSelf: 'flex-start',
  },
  titulo: { color: '#ccd6f6', fontSize: '20px', fontWeight: 700, margin: 0 },

  syncIndicator: {
    display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
    background: '#0a2040', border: '1px solid #1e3a5f', borderRadius: '20px',
    padding: '4px 12px', color: '#64ffda', fontSize: '12px', fontWeight: 600,
  },

  tiposGridHorizontal: { display: 'flex', gap: '10px' },
  btnHormigon: {
    flex: 1, background: '#16213e', color: '#ccd6f6', border: '1px solid #0f3460',
    borderRadius: '12px', padding: '18px 10px', fontSize: '17px', fontWeight: 700, cursor: 'pointer',
  },
  btnHormigonActivo: { background: '#64ffda', color: '#0a1f3a', borderColor: '#64ffda' },

  row: { display: 'flex', gap: '10px' },
  campo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#8892b0', fontSize: '12px', fontWeight: 600 },
  input: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '14px', padding: '10px 12px', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  inputReadOnly: { opacity: 0.6, cursor: 'not-allowed' },
  textarea: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '14px', padding: '10px 12px', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical',
  },

  sectionTitle: { color: '#64ffda', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '4px 0 0' },

  calcBadge: {
    background: '#0a2040', border: '1px solid #1e3a5f', borderRadius: '8px',
    padding: '8px 12px', color: '#8892b0', fontSize: '12px', fontWeight: 600,
  },
  fixedValue: {
    background: '#0a1f3a', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#8892b0', fontSize: '14px', padding: '10px 12px',
  },
  resultado: {
    background: '#0a2040', border: '1px solid #64ffda', borderRadius: '8px',
    padding: '10px 12px', color: '#ccd6f6', fontSize: '14px', textAlign: 'center',
  },

  fotoGuiaWrap: { display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '160px' },
  fotoThumb: { position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden' },
  fotoImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  btnEliminarFoto: {
    position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)',
    color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px',
    fontSize: '16px', lineHeight: '20px', cursor: 'pointer', padding: 0, textAlign: 'center',
  },
  btnFotoSm: {
    background: '#64ffda', color: '#0a1f3a', border: 'none', borderRadius: '8px',
    padding: '10px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
    alignSelf: 'flex-start',
  },

  botonesCaptura: { display: 'flex', gap: '10px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' },
  fotoCard: {
    display: 'flex', flexDirection: 'column', gap: '6px',
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px', padding: '8px',
  },
  descInput: {
    width: '100%', background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '6px',
    color: '#ccd6f6', fontSize: '11px', padding: '6px 8px', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  },

  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  toggle: {
    background: '#0f3460', color: '#8892b0', border: '1px solid #1e3a5f',
    borderRadius: '20px', padding: '6px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
    minWidth: '60px',
  },
  toggleActivo: { background: '#64ffda', color: '#0a1f3a', borderColor: '#64ffda' },

  btnGuardar: {
    background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px',
    padding: '16px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
  },
  btnSecundario: {
    background: 'transparent', color: '#8892b0', border: '1px solid #0f3460', borderRadius: '12px',
    padding: '16px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
  },

  resumenCard: {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '12px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  resumenLinea: { color: '#ccd6f6', fontSize: '14px', margin: 0 },

  toast: {
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    background: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 200,
  },
  toastError: { background: '#ef4444' },
};
