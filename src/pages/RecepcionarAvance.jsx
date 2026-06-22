import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { TRAMOS, CAIDAS, ATRAVIESOS, PARTIDAS } from '../constants/estructura';
import { supabase } from '../config/supabase';
import { fechaHoy, formatearFecha } from '../utils/fecha';

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const LISTAS = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };

export default function RecepcionarAvance() {
  const navigate = useNavigate();
  const { usuario } = useUser();
  const [searchParams] = useSearchParams();

  const initTipo    = searchParams.get('tipo')    ?? 'tramo';
  const initEntidad = searchParams.get('entidad') ?? String(TRAMOS[0]);
  const initPartida = searchParams.get('partida') ?? null;

  const [tipo, setTipo]             = useState(initTipo);
  const [entidadId, setEntidadId]   = useState(initEntidad);
  const partidaInitRef              = useRef(false);
  const [registros, setRegistros]   = useState(null);
  const [planMap, setPlanMap]       = useState({}); // { partida_id: cuadrilla_id }
  const [cuadrillas, setCuadrillas] = useState([]);
  const [cargando, setCargando]     = useState(false);
  const [formPartida, setFormPartida]         = useState(null);
  const [cuadrillaId, setCuadrillaId]         = useState('');
  const [cuadrillaDePlan, setCuadrillaDePlan] = useState(false);
  const [observaciones, setObservaciones]     = useState('');
  const [confirmando, setConfirmando]         = useState(false);
  const [guardando, setGuardando]             = useState(false);
  const [toast, setToast]                     = useState(null);
  const toastRef = useRef(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('cuadrillas').select('*').order('nombre')
      .then(({ data }) => setCuadrillas(data ?? []));
  }, []);

  const cargarRegistros = useCallback(async () => {
    if (!supabase) return;
    setCargando(true);
    setRegistros(null);
    setFormPartida(null);

    const [{ data: avanceData }, { data: planData }] = await Promise.all([
      supabase
        .from('avance')
        .select('*')
        .eq('tipo_entidad', tipo)
        .eq('entidad_id', String(entidadId)),
      supabase
        .from('planificacion')
        .select('partida_id,cuadrilla_id')
        .eq('tipo_entidad', tipo)
        .eq('entidad_id', String(entidadId)),
    ]);

    setRegistros(avanceData ?? []);

    const pMap = {};
    for (const r of planData ?? []) {
      if (r.cuadrilla_id) pMap[r.partida_id] = r.cuadrilla_id;
    }
    setPlanMap(pMap);

    setCargando(false);
  }, [tipo, entidadId]);

  useEffect(() => { cargarRegistros(); }, [cargarRegistros]);

  // Preseleccionar partida desde URL param (solo la primera vez que carguen los registros)
  useEffect(() => {
    if (!initPartida || !registros || partidaInitRef.current) return;
    partidaInitRef.current = true;
    const partida = PARTIDAS.find(p => p.id === initPartida);
    if (!partida) return;
    const rec = registros.find(r => r.partida_id === partida.id);
    const disponible = !rec && (partida.orden === 1 || registros.find(r => {
      const anterior = PARTIDAS.find(p => p.orden === partida.orden - 1);
      return r.partida_id === anterior?.id;
    }));
    if (disponible) abrirForm(partida.id);
  }, [registros]); // eslint-disable-line react-hooks/exhaustive-deps

  function estadoPartida(partida) {
    const rec = registros?.find(r => r.partida_id === partida.id);
    if (rec) return { tipo: 'recepcionada', registro: rec };
    if (partida.orden === 1) return { tipo: 'disponible' };
    const anterior = PARTIDAS.find(p => p.orden === partida.orden - 1);
    if (registros?.find(r => r.partida_id === anterior?.id)) return { tipo: 'disponible' };
    return { tipo: 'bloqueada' };
  }

  function cuadrillaMap(id) {
    return cuadrillas.find(c => c.id === id)?.nombre ?? '—';
  }

  function abrirForm(partidaId) {
    setFormPartida(partidaId);
    setObservaciones('');
    setConfirmando(false);

    const planCuadrillaId = planMap[partidaId];
    if (planCuadrillaId) {
      setCuadrillaId(planCuadrillaId);
      setCuadrillaDePlan(true);
    } else {
      setCuadrillaId(cuadrillas.filter(c => c.activa)[0]?.id ?? '');
      setCuadrillaDePlan(false);
    }
  }

  function mostrarToast(msg, t = 'ok') {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, tipo: t });
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }

  async function confirmarRecepcion() {
    if (!supabase || guardando) return;
    setGuardando(true);
    try {
      const partida = PARTIDAS.find(p => p.id === formPartida);
      const { data, error } = await supabase
        .from('avance')
        .insert({
          tipo_entidad:     tipo,
          entidad_id:       String(entidadId),
          partida_id:       formPartida,
          cuadrilla_id:     cuadrillaId || null,
          observaciones:    observaciones.trim() || null,
          recepcionado_por: usuario,
          fecha_recepcion:  fechaHoy(),
        })
        .select()
        .single();
      if (error) throw error;
      setRegistros(prev => [...(prev ?? []), data]);
      setFormPartida(null);
      setConfirmando(false);
      mostrarToast(`✅ ${partida?.nombre} recepcionada`);
    } catch (err) {
      console.error(err);
      mostrarToast('Error al guardar', 'error');
    } finally {
      setGuardando(false);
    }
  }

  const cuadrillasActivas = cuadrillas.filter(c => c.activa);
  const partidaActual     = PARTIDAS.find(p => p.id === formPartida);

  return (
    <div style={s.page}>
      <button style={s.btnVolver} onClick={() => navigate('/')}>← Inicio</button>
      <h1 style={s.titulo}>Recepcionar Avance</h1>

      <div style={s.row}>
        <div style={s.campo}>
          <label style={s.label}>Tipo</label>
          <select style={s.input} value={tipo} onChange={e => { setTipo(e.target.value); setEntidadId(String(LISTAS[e.target.value][0])); }}>
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

      {cargando && <p style={s.cargando}>Cargando...</p>}

      {registros !== null && (
        <div style={s.lista}>
          {PARTIDAS.map(partida => {
            const estado      = estadoPartida(partida);
            const esFormAbierto = formPartida === partida.id;
            const planCuadrilla = planMap[partida.id];

            return (
              <div key={partida.id}>
                <div style={{
                  ...s.partidaRow,
                  ...(estado.tipo === 'recepcionada' ? s.partidaOk
                    : estado.tipo === 'bloqueada'    ? s.partidaBloqueada
                    : s.partidaDisponible),
                }}>
                  <div style={s.partidaInfo}>
                    <span style={s.partidaOrden}>{partida.orden}</span>
                    <div>
                      <div style={s.partidaNombre}>{partida.nombre}</div>
                      {estado.tipo === 'recepcionada' && (
                        <div style={s.partidaMeta}>
                          {cuadrillaMap(estado.registro.cuadrilla_id)} · {formatearFecha(estado.registro.fecha_recepcion)} · {estado.registro.recepcionado_por}
                        </div>
                      )}
                      {estado.tipo === 'bloqueada' && (
                        <div style={s.partidaMeta}>Requiere partida anterior</div>
                      )}
                      {estado.tipo === 'disponible' && planCuadrilla && !esFormAbierto && (
                        <div style={s.partidaMetaPlan}>
                          📅 {cuadrillaMap(planCuadrilla)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={s.partidaAccion}>
                    {estado.tipo === 'recepcionada' && <span style={s.badgeOk}>✅</span>}
                    {estado.tipo === 'bloqueada'    && <span style={s.badgeLock}>🔒</span>}
                    {estado.tipo === 'disponible' && !esFormAbierto && (
                      <button style={s.btnRecepcionar} onClick={() => abrirForm(partida.id)}>
                        Recepcionar
                      </button>
                    )}
                    {estado.tipo === 'disponible' && esFormAbierto && (
                      <button style={s.btnCancelarPartida} onClick={() => setFormPartida(null)}>✕</button>
                    )}
                  </div>
                </div>

                {esFormAbierto && (
                  <div style={s.formInline}>
                    <div style={s.campo}>
                      <label style={s.label}>Cuadrilla</label>
                      {cuadrillaDePlan ? (
                        <div style={s.cuadrillaPlaneada}>
                          <span style={s.badgePlan}>📅 Planificada</span>
                          <span style={s.cuadrillaPlaneadaNombre}>
                            {cuadrillaMap(cuadrillaId)}
                          </span>
                        </div>
                      ) : (
                        <select
                          style={s.input}
                          value={cuadrillaId}
                          onChange={e => setCuadrillaId(e.target.value)}
                        >
                          <option value="">Sin cuadrilla</option>
                          {cuadrillasActivas.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div style={s.campo}>
                      <label style={s.label}>Observaciones (opcional)</label>
                      <textarea
                        style={s.textarea}
                        rows={2}
                        value={observaciones}
                        onChange={e => setObservaciones(e.target.value)}
                        placeholder="Notas..."
                      />
                    </div>
                    <button
                      style={s.btnConfirmarInline}
                      onClick={() => setConfirmando(true)}
                      disabled={guardando}
                    >
                      Confirmar recepción
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirmando && partidaActual && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <p style={s.modalTexto}>
              ¿Confirmar recepción de <strong>{partidaActual.nombre}</strong> en{' '}
              <strong>{NOMBRE_TIPO[tipo]} {entidadId}</strong>?
              {cuadrillaDePlan && (
                <span style={s.modalCuadrilla}>
                  {'\n'}Cuadrilla: {cuadrillaMap(cuadrillaId)}
                </span>
              )}
            </p>
            <div style={s.modalBotones}>
              <button style={s.btnCancelarModal} onClick={() => setConfirmando(false)} disabled={guardando}>
                Cancelar
              </button>
              <button style={s.btnConfirmarModal} onClick={confirmarRecepcion} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
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

  row: { display: 'flex', gap: '10px' },
  campo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#8892b0', fontSize: '12px', fontWeight: 600 },
  input: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '14px', padding: '10px 12px', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  textarea: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '14px', padding: '10px 12px', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical',
  },

  cargando: { color: '#8892b0', fontSize: '13px', margin: 0 },

  lista: { display: 'flex', flexDirection: 'column', gap: '8px' },

  partidaRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
    borderRadius: '10px', padding: '12px 14px', border: '1px solid',
  },
  partidaOk:         { background: 'rgba(16,185,129,0.08)', borderColor: '#10b981' },
  partidaDisponible: { background: '#16213e', borderColor: '#1e5f8a' },
  partidaBloqueada:  { background: '#0a1428', borderColor: '#1a2540', opacity: 0.6 },

  partidaInfo:   { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  partidaOrden:  {
    width: '22px', height: '22px', borderRadius: '50%', background: '#0f3460',
    color: '#8892b0', fontSize: '11px', fontWeight: 700, display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  partidaNombre: { color: '#ccd6f6', fontSize: '14px', fontWeight: 600 },
  partidaMeta:     { color: '#8892b0', fontSize: '11px', marginTop: '2px' },
  partidaMetaPlan: { color: '#64ffda', fontSize: '11px', marginTop: '2px', fontWeight: 600 },

  partidaAccion: { flexShrink: 0 },
  badgeOk:   { fontSize: '18px' },
  badgeLock: { fontSize: '16px', opacity: 0.5 },
  btnRecepcionar: {
    background: '#1e5f8a', color: '#64ffda', border: '1px solid #2a7abf',
    borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
  },
  btnCancelarPartida: {
    background: 'transparent', border: '1px solid #1e3a5f', color: '#8892b0',
    borderRadius: '8px', padding: '6px 10px', fontSize: '14px', cursor: 'pointer',
  },

  formInline: {
    background: '#0a1f3a', border: '1px solid #1e5f8a', borderRadius: '10px',
    padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
    marginTop: '-4px',
  },

  cuadrillaPlaneada: {
    background: '#0d2a48', border: '1px solid #2a5080', borderRadius: '7px',
    padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px',
  },
  badgePlan: {
    background: 'rgba(100,255,218,0.12)', color: '#64ffda', borderRadius: '6px',
    padding: '2px 8px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap',
  },
  cuadrillaPlaneadaNombre: {
    color: '#ccd6f6', fontSize: '14px', fontWeight: 600,
  },

  btnConfirmarInline: {
    background: '#1e5f8a', color: '#fff', border: 'none', borderRadius: '10px',
    padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
  },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', zIndex: 300,
  },
  modal: {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '14px',
    padding: '24px', width: '100%', maxWidth: '400px',
    display: 'flex', flexDirection: 'column', gap: '20px',
  },
  modalTexto: {
    color: '#ccd6f6', fontSize: '15px', fontWeight: 600, margin: 0, lineHeight: 1.5,
    whiteSpace: 'pre-line',
  },
  modalCuadrilla: { color: '#64ffda', fontWeight: 700 },
  modalBotones: { display: 'flex', gap: '10px' },
  btnCancelarModal: {
    flex: 1, background: 'transparent', border: '1px solid #0f3460', color: '#8892b0',
    borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
  btnConfirmarModal: {
    flex: 1, background: '#10b981', color: '#fff', border: 'none',
    borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
  },

  toast: {
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    background: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 400,
  },
  toastError: { background: '#ef4444' },
};
