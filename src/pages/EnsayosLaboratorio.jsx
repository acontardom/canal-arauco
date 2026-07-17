import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../config/supabase';

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const LABS_OPCIONES = ['Pampa Austral', 'Labotec', 'Otro'];
const TIPOS_HORMIGON = ['G20', 'G25', 'G30'];
const RESISTENCIA_MIN = { G20: 20, G25: 25, G30: 30 };

const FILTROS_INICIAL = {
  laboratorio: '',
  tipoHormigon: '',
  estado: '',
  fechaDesde: '',
  fechaHasta: '',
};

const FORM_NUEVO_INICIAL = {
  laboratorio: '',
  laboratorioOtro: '',
  correlativo: '',
  tipoEnsayo: 'compresion',
  r7: '',
  fechaR7: '',
  r28: '',
  fechaR28: '',
  observaciones: '',
};

function diasDesde(fecha) {
  if (!fecha) return null;
  const diff = Date.now() - new Date(fecha).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function calcularEstado(ensayo) {
  const { r7, r28, tipoHormigon, fechaMuestreo } = ensayo;
  const minima = RESISTENCIA_MIN[tipoHormigon] ?? null;
  const dias = diasDesde(fechaMuestreo);

  if (r28 != null) {
    if (minima == null) return 'cumple';
    return r28 >= minima ? 'cumple' : 'no_cumple';
  }
  if (r7 != null) {
    return (dias != null && dias >= 28) ? 'r28_pendiente' : 'r7_pendiente';
  }
  return 'sin_resultados';
}

const ESTADO_CFG = {
  cumple:         { label: 'Cumple',          color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  no_cumple:      { label: 'No cumple',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  r7_pendiente:   { label: 'Espera R28',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  r28_pendiente:  { label: 'R28 vencido',     color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  sin_resultados: { label: 'Sin resultados',  color: '#8892b0', bg: 'rgba(136,146,176,0.1)'  },
};

function mapEnsayo(r) {
  const cam = r.camiones ?? {};
  return {
    id:             r.id,
    camionId:       r.camion_id,
    numeroGuia:     r.numero_guia    ?? '',
    laboratorio:    r.laboratorio    ?? '',
    correlativo:    r.correlativo    ?? '',
    fechaMuestreo:  r.fecha_muestreo ?? '',
    tipoEnsayo:     r.tipo_ensayo    ?? 'compresion',
    r7:             r.r7             ?? null,
    fechaR7:        r.fecha_r7       ?? '',
    r28:            r.r28            ?? null,
    fechaR28:       r.fecha_r28      ?? '',
    observaciones:  r.observaciones  ?? '',
    usuarioNombre:  r.usuario_nombre ?? '',
    tipoHormigon:   cam.tipo_hormigon  ?? '',
    planta:         cam.planta         ?? '',
    tipoEntidad:    cam.tipo_entidad   ?? '',
    entidadId:      cam.entidad_id     ?? '',
    fechaRecepcion: cam.fecha_recepcion ?? '',
    usoHormigon:    cam.uso_hormigon   ?? '',
    pdfUrl:         r.pdf_url          ?? null,
  };
}

function nombreEntidad(e) {
  if (!e.tipoEntidad) return '—';
  return `${NOMBRE_TIPO[e.tipoEntidad] ?? e.tipoEntidad} ${e.entidadId}`;
}

export default function EnsayosLaboratorio() {
  const [ensayos, setEnsayos]   = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState(null);
  const [filtros, setFiltros]   = useState(FILTROS_INICIAL);

  const [modalEdit, setModalEdit] = useState(null);
  const [editForm,  setEditForm]  = useState({});
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast]         = useState(null);
  const toastRef                  = useRef(null);

  const [modalNuevo,       setModalNuevo]       = useState(false);
  const [guiaBuscar,       setGuiaBuscar]       = useState('');
  const [camionEncontrado, setCamionEncontrado] = useState(null);
  const [guiaError,        setGuiaError]        = useState('');
  const [buscandoGuia,     setBuscandoGuia]     = useState(false);
  const [nuevoForm,        setNuevoForm]        = useState(FORM_NUEVO_INICIAL);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('ensayos_laboratorio')
        .select(`
          *,
          camiones (
            tipo_entidad, entidad_id, tipo_hormigon, planta,
            fecha_recepcion, uso_hormigon
          )
        `)
        .order('fecha_muestreo', { ascending: false });
      console.log('[EnsayosLaboratorio] query result:', { data, error: err });
      if (err) throw err;
      setEnsayos((data ?? []).map(mapEnsayo));
    } catch (err) {
      setError(err.message ?? 'Error cargando ensayos');
    } finally {
      setCargando(false);
    }
  }

  function setFiltro(campo, valor) {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  }

  const labsDisponibles = useMemo(() => {
    const set = new Set(ensayos.map(e => e.laboratorio).filter(Boolean));
    return [...set].sort();
  }, [ensayos]);

  const filtrados = useMemo(() => ensayos.filter(e => {
    if (filtros.laboratorio && e.laboratorio !== filtros.laboratorio) return false;
    if (filtros.tipoHormigon && e.tipoHormigon !== filtros.tipoHormigon) return false;
    if (filtros.estado && calcularEstado(e) !== filtros.estado) return false;
    if (filtros.fechaDesde && (e.fechaMuestreo ?? '') < filtros.fechaDesde) return false;
    if (filtros.fechaHasta && (e.fechaMuestreo ?? '') > filtros.fechaHasta) return false;
    return true;
  }), [ensayos, filtros]);

  const kpis = useMemo(() => {
    const total = ensayos.length;
    const conR28 = ensayos.filter(e => e.r28 != null).length;
    const cumplen = ensayos.filter(e => calcularEstado(e) === 'cumple').length;
    const pct = conR28 > 0 ? Math.round((cumplen / conR28) * 100) : null;
    const pendientesR28 = ensayos.filter(e => e.r28 == null && (diasDesde(e.fechaMuestreo) ?? 0) >= 28).length;
    return { total, conR28, pct, pendientesR28 };
  }, [ensayos]);

  // ── Modal edición ────────────────────────────────────────────────────────────

  function abrirEdicion(ensayo) {
    setEditForm({
      correlativo:  ensayo.correlativo,
      tipoEnsayo:   ensayo.tipoEnsayo,
      r7:           ensayo.r7  ?? '',
      fechaR7:      ensayo.fechaR7,
      r28:          ensayo.r28 ?? '',
      fechaR28:     ensayo.fechaR28,
      observaciones: ensayo.observaciones,
    });
    setModalEdit(ensayo);
  }

  async function guardarEdicion() {
    if (!modalEdit) return;
    setGuardando(true);
    try {
      const payload = {
        correlativo:   editForm.correlativo || null,
        tipo_ensayo:   editForm.tipoEnsayo,
        r7:            editForm.r7  !== '' ? Number(editForm.r7)  : null,
        fecha_r7:      editForm.fechaR7  || null,
        r28:           editForm.r28 !== '' ? Number(editForm.r28) : null,
        fecha_r28:     editForm.fechaR28 || null,
        observaciones: editForm.observaciones || null,
      };
      const { error: err } = await supabase
        .from('ensayos_laboratorio')
        .update(payload)
        .eq('id', modalEdit.id);
      if (err) throw err;
      setEnsayos(prev => prev.map(e => e.id !== modalEdit.id ? e : {
        ...e,
        correlativo:  payload.correlativo   ?? '',
        tipoEnsayo:   payload.tipo_ensayo,
        r7:           payload.r7,
        fechaR7:      payload.fecha_r7   ?? '',
        r28:          payload.r28,
        fechaR28:     payload.fecha_r28  ?? '',
        observaciones: payload.observaciones ?? '',
      }));
      setModalEdit(null);
    } catch (err) {
      alert('Error al guardar: ' + (err.message ?? err));
    } finally {
      setGuardando(false);
    }
  }

  // ── Modal nuevo ──────────────────────────────────────────────────────────────

  function resetNuevo() {
    setGuiaBuscar('');
    setCamionEncontrado(null);
    setGuiaError('');
    setNuevoForm(FORM_NUEVO_INICIAL);
  }

  async function buscarGuia() {
    const guia = guiaBuscar.trim();
    if (!guia) return;
    setBuscandoGuia(true);
    setGuiaError('');
    setCamionEncontrado(null);
    try {
      const { data, error: err } = await supabase
        .from('camiones')
        .select('id, tipo_entidad, entidad_id, tipo_hormigon, planta, fecha_recepcion, uso_hormigon')
        .eq('numero_guia', guia)
        .limit(1)
        .maybeSingle();
      if (err) throw err;
      if (!data) setGuiaError('Guía no encontrada');
      else setCamionEncontrado(data);
    } catch {
      setGuiaError('Guía no encontrada');
    } finally {
      setBuscandoGuia(false);
    }
  }

  async function guardarNuevo() {
    if (!camionEncontrado) return;
    const labFinal = nuevoForm.laboratorio === 'Otro' ? nuevoForm.laboratorioOtro : nuevoForm.laboratorio;
    if (!labFinal) { alert('Selecciona un laboratorio'); return; }
    setGuardando(true);
    try {
      const payload = {
        camion_id:      camionEncontrado.id,
        numero_guia:    guiaBuscar.trim(),
        laboratorio:    labFinal,
        correlativo:    nuevoForm.correlativo  || null,
        fecha_muestreo: camionEncontrado.fecha_recepcion ?? null,
        tipo_ensayo:    nuevoForm.tipoEnsayo,
        r7:             nuevoForm.r7  !== '' ? Number(nuevoForm.r7)  : null,
        fecha_r7:       nuevoForm.fechaR7  || null,
        r28:            nuevoForm.r28 !== '' ? Number(nuevoForm.r28) : null,
        fecha_r28:      nuevoForm.fechaR28 || null,
        observaciones:  nuevoForm.observaciones || null,
      };
      const { data, error: err } = await supabase
        .from('ensayos_laboratorio')
        .insert(payload)
        .select(`
          *,
          camiones (
            tipo_entidad, entidad_id, tipo_hormigon, planta,
            fecha_recepcion, uso_hormigon
          )
        `)
        .single();
      if (err) throw err;
      setEnsayos(prev => [mapEnsayo(data), ...prev]);
      setModalNuevo(false);
      resetNuevo();
    } catch (err) {
      alert('Error al guardar: ' + (err.message ?? err));
    } finally {
      setGuardando(false);
    }
  }

  function mostrarToast(msg) {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast(msg);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }

  async function subirPdfEnsayo(ensayoId, file) {
    try {
      const path = `ensayos/${ensayoId}/informe.pdf`;
      const { error: upErr } = await supabase.storage
        .from('fotos-canal-arauco')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage
        .from('fotos-canal-arauco')
        .getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from('ensayos_laboratorio')
        .update({ pdf_url: publicUrl })
        .eq('id', ensayoId);
      if (dbErr) throw dbErr;
      setEnsayos(prev => prev.map(e => e.id !== ensayoId ? e : { ...e, pdfUrl: publicUrl }));
      mostrarToast('PDF adjuntado correctamente');
    } catch (err) {
      alert('Error al subir PDF: ' + (err.message ?? err));
    }
  }

  async function eliminarPdfEnsayo(ensayoId) {
    if (!window.confirm('¿Eliminar el PDF adjunto?')) return;
    try {
      const path = `ensayos/${ensayoId}/informe.pdf`;
      const { error: stErr } = await supabase.storage
        .from('fotos-canal-arauco')
        .remove([path]);
      if (stErr) throw stErr;
      const { error: dbErr } = await supabase
        .from('ensayos_laboratorio')
        .update({ pdf_url: null })
        .eq('id', ensayoId);
      if (dbErr) throw dbErr;
      setEnsayos(prev => prev.map(e => e.id !== ensayoId ? e : { ...e, pdfUrl: null }));
      mostrarToast('PDF eliminado');
    } catch (err) {
      alert('Error al eliminar PDF: ' + (err.message ?? err));
    }
  }

  const filtrosActivos = Object.values(filtros).filter(Boolean).length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.titulo}>Ensayos de Laboratorio</h1>
        <button style={s.btnNuevo} onClick={() => setModalNuevo(true)}>＋ Nuevo ensayo</button>
      </div>

      {/* KPIs */}
      <div style={s.kpiRow}>
        <div style={s.kpiCard}>
          <span style={s.kpiValor}>{kpis.total}</span>
          <span style={s.kpiLabel}>Total muestras</span>
        </div>
        <div style={s.kpiCard}>
          <span style={s.kpiValor}>{kpis.conR28}</span>
          <span style={s.kpiLabel}>Con R28 disponible</span>
        </div>
        <div style={{ ...s.kpiCard, borderColor: kpis.pct != null && kpis.pct >= 80 ? '#10b981' : '#f59e0b' }}>
          <span style={{ ...s.kpiValor, color: kpis.pct != null && kpis.pct >= 80 ? '#10b981' : '#f59e0b' }}>
            {kpis.pct != null ? `${kpis.pct}%` : '—'}
          </span>
          <span style={s.kpiLabel}>% Cumplimiento R28</span>
        </div>
        <div style={{ ...s.kpiCard, borderColor: kpis.pendientesR28 > 0 ? '#ef4444' : '#1e3a5f' }}>
          <span style={{ ...s.kpiValor, color: kpis.pendientesR28 > 0 ? '#ef4444' : '#ccd6f6' }}>
            {kpis.pendientesR28}
          </span>
          <span style={s.kpiLabel}>R28 vencidos sin resultado</span>
        </div>
      </div>

      {/* Filtros */}
      <div style={s.filtrosRow}>
        <select style={s.selectFiltro} value={filtros.laboratorio} onChange={e => setFiltro('laboratorio', e.target.value)}>
          <option value="">Todos los labs</option>
          {labsDisponibles.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select style={s.selectFiltro} value={filtros.tipoHormigon} onChange={e => setFiltro('tipoHormigon', e.target.value)}>
          <option value="">Tipo H°</option>
          {TIPOS_HORMIGON.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={s.selectFiltro} value={filtros.estado} onChange={e => setFiltro('estado', e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="sin_resultados">Sin resultados</option>
          <option value="r7_pendiente">Espera R28</option>
          <option value="r28_pendiente">R28 vencido</option>
          <option value="cumple">Cumple</option>
          <option value="no_cumple">No cumple</option>
        </select>
        <input style={s.selectFiltro} type="date" value={filtros.fechaDesde} onChange={e => setFiltro('fechaDesde', e.target.value)} />
        <input style={s.selectFiltro} type="date" value={filtros.fechaHasta} onChange={e => setFiltro('fechaHasta', e.target.value)} />
        {filtrosActivos > 0 && (
          <button style={s.btnLimpiar} onClick={() => setFiltros(FILTROS_INICIAL)}>Limpiar</button>
        )}
      </div>

      <p style={s.conteo}>{filtrados.length} ensayo{filtrados.length !== 1 ? 's' : ''}</p>

      {/* Tabla */}
      {cargando && <p style={s.mensaje}>Cargando ensayos...</p>}
      {error    && <p style={{ ...s.mensaje, color: '#ef4444' }}>{error}</p>}

      {!cargando && !error && (
        <div style={s.tableWrap}>
          <table style={s.tabla}>
            <thead>
              <tr>
                {['Guía', 'Entidad', 'Tipo H°', 'Planta', 'Laboratorio', 'Correlativo', 'Muestreo', 'Días', 'R7', 'R28', 'Estado', 'Informe', ''].map(col => (
                  <th key={col} style={s.th}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(e => {
                const dias   = diasDesde(e.fechaMuestreo);
                const estado = calcularEstado(e);
                const cfg    = ESTADO_CFG[estado];
                const sinR28 = e.r28 == null;
                const diasColor = sinR28 && dias != null
                  ? dias >= 28 ? '#ef4444' : dias >= 21 ? '#f59e0b' : '#ccd6f6'
                  : '#ccd6f6';
                return (
                  <tr key={e.id} style={s.tr}>
                    <td style={s.td}>{e.numeroGuia || '—'}</td>
                    <td style={s.td}>{nombreEntidad(e)}</td>
                    <td style={s.td}>{e.tipoHormigon || '—'}</td>
                    <td style={s.td}>{e.planta || '—'}</td>
                    <td style={s.td}>{e.laboratorio || '—'}</td>
                    <td style={s.td}>{e.correlativo || '—'}</td>
                    <td style={s.td}>{e.fechaMuestreo ? e.fechaMuestreo.slice(0, 10) : '—'}</td>
                    <td style={{ ...s.td, color: diasColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {dias != null ? dias : '—'}
                    </td>
                    <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums' }}>
                      {e.r7 != null ? `${e.r7} MPa` : '—'}
                    </td>
                    <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums' }}>
                      {e.r28 != null ? `${e.r28} MPa` : '—'}
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, color: cfg.color, background: cfg.bg }}>
                        {cfg.label}
                      </span>
                    </td>
                    <td style={s.td}>
                      <input
                        type="file"
                        accept="application/pdf"
                        id={`pdf-input-${e.id}`}
                        style={{ display: 'none' }}
                        onChange={ev => {
                          if (ev.target.files[0]) subirPdfEnsayo(e.id, ev.target.files[0]);
                          ev.target.value = '';
                        }}
                      />
                      {e.pdfUrl ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button style={s.btnPdf} onClick={() => window.open(e.pdfUrl, '_blank')}>📄 Ver</button>
                          <button style={s.btnPdfDel} onClick={() => eliminarPdfEnsayo(e.id)}>×</button>
                        </div>
                      ) : (
                        <button style={s.btnPdf} onClick={() => document.getElementById(`pdf-input-${e.id}`).click()}>📎 Adjuntar</button>
                      )}
                    </td>
                    <td style={s.td}>
                      <button style={s.btnEdit} onClick={() => abrirEdicion(e)} title="Editar">✏️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtrados.length === 0 && (
            <p style={s.mensaje}>No hay ensayos con estos filtros.</p>
          )}
        </div>
      )}

      {/* Modal edición */}
      {modalEdit && (
        <div style={s.overlay} onClick={() => setModalEdit(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitulo}>Editar ensayo — Guía {modalEdit.numeroGuia}</h2>

            <Section titulo="Datos del camión">
              <div style={s.grid2}>
                <RO label="Guía"           value={modalEdit.numeroGuia   || '—'} />
                <RO label="Entidad"        value={nombreEntidad(modalEdit)}       />
                <RO label="Tipo hormigón"  value={modalEdit.tipoHormigon || '—'} />
                <RO label="Planta"         value={modalEdit.planta        || '—'} />
                <RO label="Laboratorio"    value={modalEdit.laboratorio   || '—'} />
                <RO label="Fecha muestreo" value={modalEdit.fechaMuestreo ? modalEdit.fechaMuestreo.slice(0, 10) : '—'} />
              </div>
            </Section>

            <Section titulo="Resultados">
              <div style={s.grid2}>
                <Field label="Correlativo">
                  <input style={s.input} value={editForm.correlativo} onChange={e => setEditForm(p => ({ ...p, correlativo: e.target.value }))} />
                </Field>
                <Field label="Tipo ensayo">
                  <select style={s.input} value={editForm.tipoEnsayo} onChange={e => setEditForm(p => ({ ...p, tipoEnsayo: e.target.value }))}>
                    <option value="compresion">Compresión</option>
                    <option value="docilidad">Docilidad</option>
                  </select>
                </Field>
                <Field label="R7 (MPa)">
                  <input style={s.input} type="number" step="0.1" placeholder="—" value={editForm.r7} onChange={e => setEditForm(p => ({ ...p, r7: e.target.value }))} />
                </Field>
                <Field label="Fecha R7">
                  <input style={s.input} type="date" value={editForm.fechaR7} onChange={e => setEditForm(p => ({ ...p, fechaR7: e.target.value }))} />
                </Field>
                <Field label="R28 (MPa)">
                  <input style={s.input} type="number" step="0.1" placeholder="—" value={editForm.r28} onChange={e => setEditForm(p => ({ ...p, r28: e.target.value }))} />
                </Field>
                <Field label="Fecha R28">
                  <input style={s.input} type="date" value={editForm.fechaR28} onChange={e => setEditForm(p => ({ ...p, fechaR28: e.target.value }))} />
                </Field>
              </div>
              <Field label="Observaciones">
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={editForm.observaciones} onChange={e => setEditForm(p => ({ ...p, observaciones: e.target.value }))} />
              </Field>
            </Section>

            <div style={s.modalBotones}>
              <button style={s.btnCancelar} onClick={() => setModalEdit(null)}>Cancelar</button>
              <button style={s.btnGuardar} onClick={guardarEdicion} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={s.toast}>{toast}</div>
      )}

      {/* Modal nuevo ensayo */}
      {modalNuevo && (
        <div style={s.overlay} onClick={() => { setModalNuevo(false); resetNuevo(); }}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitulo}>Nuevo ensayo</h2>

            <Section titulo="Buscar camión por guía">
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  style={{ ...s.input, flex: 1 }}
                  type="number"
                  placeholder="N° de guía"
                  value={guiaBuscar}
                  onChange={e => { setGuiaBuscar(e.target.value); setGuiaError(''); setCamionEncontrado(null); }}
                  onKeyDown={e => e.key === 'Enter' && buscarGuia()}
                />
                <button style={s.btnBuscar} onClick={buscarGuia} disabled={buscandoGuia || !guiaBuscar.trim()}>
                  {buscandoGuia ? '...' : 'Buscar'}
                </button>
              </div>
              {guiaError && (
                <p style={{ color: '#ef4444', fontSize: '12px', margin: '4px 0 0', fontWeight: 600 }}>{guiaError}</p>
              )}
              {camionEncontrado && (
                <div style={s.camionFound}>
                  {[
                    `${NOMBRE_TIPO[camionEncontrado.tipo_entidad] ?? camionEncontrado.tipo_entidad} ${camionEncontrado.entidad_id}`,
                    camionEncontrado.tipo_hormigon,
                    camionEncontrado.planta,
                    camionEncontrado.fecha_recepcion?.slice(0, 10),
                  ].filter(Boolean).map((txt, i) => (
                    <span key={i} style={s.camionChip}>{txt}</span>
                  ))}
                </div>
              )}
            </Section>

            {camionEncontrado && (
              <Section titulo="Datos del ensayo">
                <div style={s.grid2}>
                  <Field label="Laboratorio">
                    <select style={s.input} value={nuevoForm.laboratorio} onChange={e => setNuevoForm(p => ({ ...p, laboratorio: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {LABS_OPCIONES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </Field>
                  {nuevoForm.laboratorio === 'Otro' && (
                    <Field label="Especificar laboratorio">
                      <input style={s.input} value={nuevoForm.laboratorioOtro} onChange={e => setNuevoForm(p => ({ ...p, laboratorioOtro: e.target.value }))} placeholder="Nombre del laboratorio" />
                    </Field>
                  )}
                  <Field label="Correlativo">
                    <input style={s.input} value={nuevoForm.correlativo} onChange={e => setNuevoForm(p => ({ ...p, correlativo: e.target.value }))} />
                  </Field>
                  <Field label="Tipo ensayo">
                    <select style={s.input} value={nuevoForm.tipoEnsayo} onChange={e => setNuevoForm(p => ({ ...p, tipoEnsayo: e.target.value }))}>
                      <option value="compresion">Compresión</option>
                      <option value="docilidad">Docilidad</option>
                    </select>
                  </Field>
                  <Field label="R7 (MPa)">
                    <input style={s.input} type="number" step="0.1" placeholder="—" value={nuevoForm.r7} onChange={e => setNuevoForm(p => ({ ...p, r7: e.target.value }))} />
                  </Field>
                  <Field label="Fecha R7">
                    <input style={s.input} type="date" value={nuevoForm.fechaR7} onChange={e => setNuevoForm(p => ({ ...p, fechaR7: e.target.value }))} />
                  </Field>
                  <Field label="R28 (MPa)">
                    <input style={s.input} type="number" step="0.1" placeholder="—" value={nuevoForm.r28} onChange={e => setNuevoForm(p => ({ ...p, r28: e.target.value }))} />
                  </Field>
                  <Field label="Fecha R28">
                    <input style={s.input} type="date" value={nuevoForm.fechaR28} onChange={e => setNuevoForm(p => ({ ...p, fechaR28: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Observaciones">
                  <textarea style={{ ...s.input, resize: 'vertical' }} rows={2} value={nuevoForm.observaciones} onChange={e => setNuevoForm(p => ({ ...p, observaciones: e.target.value }))} />
                </Field>
              </Section>
            )}

            <div style={s.modalBotones}>
              <button style={s.btnCancelar} onClick={() => { setModalNuevo(false); resetNuevo(); }}>Cancelar</button>
              <button style={s.btnGuardar} onClick={guardarNuevo} disabled={guardando || !camionEncontrado}>
                {guardando ? 'Guardando...' : 'Guardar ensayo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ titulo, children }) {
  return (
    <div style={s.seccion}>
      <p style={s.seccionTitulo}>{titulo}</p>
      {children}
    </div>
  );
}

function RO({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={s.label}>{label}</span>
      <span style={s.roValue}>{value}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  );
}

const s = {
  page:  { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
  titulo: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },
  btnNuevo: {
    background: '#64ffda', color: '#0a1f3a', border: 'none',
    borderRadius: '10px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
  },

  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' },
  kpiCard: {
    background: '#16213e', border: '1px solid #1e3a5f', borderRadius: '12px',
    padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  kpiValor: { color: '#ccd6f6', fontSize: '28px', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  kpiLabel: { color: '#8892b0', fontSize: '12px', fontWeight: 600 },

  filtrosRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' },
  selectFiltro: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '8px',
    color: '#ccd6f6', fontSize: '13px', padding: '8px 10px', fontFamily: 'inherit', outline: 'none',
  },
  btnLimpiar: {
    background: 'transparent', color: '#8892b0', border: '1px solid #0f3460',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },

  conteo: { color: '#8892b0', fontSize: '13px', fontWeight: 600, margin: 0 },
  mensaje: { color: '#8892b0', fontSize: '14px', textAlign: 'center', padding: '24px 0' },

  tableWrap: { overflowX: 'auto', borderRadius: '12px', border: '1px solid #1e3a5f' },
  tabla:     { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    color: '#8892b0', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '10px 12px', textAlign: 'left',
    background: '#16213e', borderBottom: '1px solid #1e3a5f', whiteSpace: 'nowrap',
  },
  tr:  { borderBottom: '1px solid #0f3460' },
  td:  { color: '#ccd6f6', padding: '10px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  badge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: '999px',
    fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
  },
  btnEdit: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: '15px', padding: '3px 6px', borderRadius: '6px',
  },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', zIndex: 1000,
  },
  modal: {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '16px',
    padding: '24px', width: '100%', maxWidth: '640px', maxHeight: '85vh',
    overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px',
  },
  modalTitulo: { color: '#ccd6f6', fontSize: '16px', fontWeight: 700, margin: 0 },
  seccion:     { display: 'flex', flexDirection: 'column', gap: '10px' },
  seccionTitulo: {
    color: '#64ffda', fontSize: '11px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0,
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  label:   { color: '#8892b0', fontSize: '11px', fontWeight: 600 },
  roValue: {
    color: '#ccd6f6', fontSize: '13px', background: '#0a1428',
    padding: '8px 10px', borderRadius: '6px', border: '1px solid #0f3460',
  },
  input: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '13px', padding: '9px 10px',
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  modalBotones: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  btnCancelar: {
    background: 'transparent', color: '#8892b0', border: '1px solid #0f3460',
    borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  btnGuardar: {
    background: '#10b981', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
  },
  btnPdf: {
    background: 'transparent', border: '1px solid #1e3a5f', color: '#64ffda',
    borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  btnPdfDel: {
    background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444',
    borderRadius: '6px', padding: '4px 8px', fontSize: '13px', fontWeight: 700,
    cursor: 'pointer', lineHeight: 1,
  },
  toast: {
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    background: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 400,
    whiteSpace: 'nowrap',
  },
  btnBuscar: {
    background: 'transparent', color: '#64ffda', border: '1px solid #64ffda',
    borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  camionFound: {
    background: '#0a2040', border: '1px solid #1e3a5f', borderRadius: '8px',
    padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px',
  },
  camionChip: {
    background: '#0f3460', color: '#64ffda', fontSize: '12px', fontWeight: 700,
    padding: '4px 10px', borderRadius: '999px',
  },
};
