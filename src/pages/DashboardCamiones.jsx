import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList, ResponsiveContainer,
} from 'recharts';
import { supabase } from '../config/supabase';
import { TRAMOS, CAIDAS, ATRAVIESOS } from '../constants/estructura';

// ─── Constantes de negocio ────────────────────────────────────────────────────

const TIPOS_ESTRUCTURALES = ['G20', 'G25', 'G30'];
const FECHA_INICIO_PU     = '2026-05-21';

const TIPOS_HORMIGON = ['G5', 'G20', 'G25', 'G30'];
const PLANTAS        = ['Membrillar', 'Quilanco', 'Río San Martín'];
const NOMBRE_TIPO    = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const LISTAS         = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };

const COLORES_TIPO = {
  G5:  '#64748b',
  G20: '#f97316',
  G25: '#c2410c',
  G30: '#7c2d12',
};

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const FILTROS_INICIAL = {
  entidadTipo:  '',
  entidadId:    '',
  uso:          '',
  fechaDesde:   '',
  fechaHasta:   '',
  planta:       '',
  estado:       '',
  tipoHormigon: '',
};

// ─── Mapeo remoto (idéntico a HistorialCamiones) ─────────────────────────────

function mapRemoto(r) {
  return {
    id:                    r.id,
    supabaseId:            r.id,
    tipoEntidad:           r.tipo_entidad,
    entidadId:             r.tipo_entidad === 'caida' ? Number(r.entidad_id) : r.entidad_id,
    entidadSecundariaTipo: r.entidad_secundaria_tipo ?? null,
    entidadSecundariaId:   r.entidad_secundaria_tipo === 'caida' && r.entidad_secundaria_id != null
      ? Number(r.entidad_secundaria_id)
      : (r.entidad_secundaria_id ?? null),
    tipoHormigon:          r.tipo_hormigon,
    usoHormigon:           r.uso_hormigon ?? null,
    volumen:               r.volumen ?? '',
    numeroGuia:            r.numero_guia ?? '',
    planta:                r.planta ?? '',
    cono:                  r.cono ?? null,
    tempHormigon:          r.temp_hormigon ?? '',
    tempAmbiente:          r.temp_ambiente ?? '',
    horaCarga:             r.hora_carga ?? '',
    horaDescarga:          r.hora_descarga ?? '',
    tiempoTraslado:        r.tiempo_traslado ?? '',
    pesoHoyaHormigon:      r.peso_hoya_hormigon ?? '',
    puCalculado:           r.pu_calculado ?? null,
    observaciones:         r.observaciones ?? '',
    usuarioNombre:         r.usuario_nombre ?? null,
    fechaRecepcion:        r.fecha_recepcion ?? '',
    estadoCalidad:         r.estado_calidad ?? null,
    fotoGuiaUrl:           r.foto_guia_url ?? null,
    fotosEnsayoUrls:       r.fotos_ensayo_urls ?? [],
    tipoEspecificacion:    r.tipo_especificacion ?? null,
    valorTotal:            r.valor_total != null ? String(r.valor_total) : '',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcStats(valores) {
  const n = valores.length;
  if (n === 0) return { promedio: null, sigma: null, min: null, max: null, n: 0 };
  const promedio = valores.reduce((a, b) => a + b, 0) / n;
  const sigma    = Math.sqrt(valores.reduce((a, b) => a + (b - promedio) ** 2, 0) / n);
  return { promedio, sigma, min: Math.min(...valores), max: Math.max(...valores), n };
}

function formatMes(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return `${MESES_ES[parseInt(m, 10) - 1]} ${y}`;
}

function fmtNum(v, dec = 1) {
  if (v == null) return '—';
  return Number(v).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function colorSemaforo(pct) {
  if (pct == null) return '#8892b0';
  if (pct >= 90)   return '#10b981';
  if (pct >= 70)   return '#f59e0b';
  return '#ef4444';
}

const fechaKey = s => s?.substring(0, 10) ?? '';

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({ label, valor, sub }) {
  return (
    <div style={s.kpiCard}>
      <div style={s.kpiValor}>{valor}</div>
      <div style={s.kpiLabel}>{label}</div>
      {sub && <div style={s.kpiSub}>{sub}</div>}
    </div>
  );
}

function CoberturaCard({ valor, label, sub, colorValor }) {
  return (
    <div style={s.coberturaCard}>
      <div style={{ ...s.coberturaValor, color: colorValor ?? '#64ffda' }}>{valor}</div>
      <div style={s.coberturaLabel}>{label}</div>
      {sub && <div style={s.coberturaSub}>{sub}</div>}
    </div>
  );
}

function BarLabel({ value, x, y, width, height }) {
  if (!value || value <= 0 || !height || height < 14) return null;
  return (
    <text
      x={x + width / 2} y={y + height / 2}
      fill="#fff" textAnchor="middle" dominantBaseline="middle"
      fontSize={9} fontWeight={600}
    >
      {Math.round(value)}
    </text>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardCamiones() {
  const [camiones, setCamiones]               = useState([]);
  const [cargando, setCargando]               = useState(true);
  const [error, setError]                     = useState(null);
  const [filtros, setFiltros]                 = useState(FILTROS_INICIAL);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    if (!supabase || !navigator.onLine) {
      setCargando(false);
      setError('Sin conexión a Supabase');
      return;
    }

    supabase
      .from('camiones')
      .select('id, local_id, tipo_entidad, entidad_id, entidad_secundaria_tipo, entidad_secundaria_id, tipo_hormigon, volumen, numero_guia, planta, cono, temp_hormigon, temp_ambiente, hora_carga, hora_descarga, tiempo_traslado, peso_hoya_hormigon, pu_calculado, observaciones, usuario_nombre, fecha_recepcion, uso_hormigon, estado_calidad, foto_guia_url, fotos_ensayo_urls, tipo_especificacion, valor_total, created_at')
      .order('fecha_recepcion', { ascending: false })
      .then(({ data, error: err }) => {
        if (!activo) return;
        if (err) { setError('Error al cargar datos'); setCargando(false); return; }
        setCamiones((data ?? []).map(mapRemoto));
        setCargando(false);
      });

    return () => { activo = false; };
  }, []);

  function setFiltro(campo, valor) {
    setFiltros(prev => {
      const next = { ...prev, [campo]: valor };
      if (campo === 'entidadTipo') next.entidadId = '';
      return next;
    });
  }

  // ─── Filtrado (idéntico a HistorialCamiones) ─────────────────────────────

  const filtrados = useMemo(() => camiones.filter(c => {
    if (filtros.entidadTipo  && c.tipoEntidad   !== filtros.entidadTipo)               return false;
    if (filtros.entidadId    && String(c.entidadId) !== String(filtros.entidadId))     return false;
    if (filtros.uso          && c.usoHormigon   !== filtros.uso)                       return false;
    if (filtros.planta       && c.planta        !== filtros.planta)                    return false;
    if (filtros.estado       && c.estadoCalidad !== filtros.estado)                    return false;
    if (filtros.tipoHormigon && c.tipoHormigon  !== filtros.tipoHormigon)              return false;
    const key = fechaKey(c.fechaRecepcion);
    if (filtros.fechaDesde   && key < filtros.fechaDesde)                              return false;
    if (filtros.fechaHasta   && key > filtros.fechaHasta)                              return false;
    return true;
  }), [camiones, filtros]);

  // ─── KPIs ────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const estructurales = filtrados.filter(c => TIPOS_ESTRUCTURALES.includes(c.tipoHormigon));
    return {
      totalCamiones:        filtrados.length,
      totalM3:              filtrados.reduce((a, c) => a + (parseFloat(c.volumen) || 0), 0),
      totalEstructurales:   estructurales.length,
      totalM3Estructurales: estructurales.reduce((a, c) => a + (parseFloat(c.volumen) || 0), 0),
    };
  }, [filtrados]);

  // ─── Datos gráfico mensual ────────────────────────────────────────────────

  const datosGrafico = useMemo(() => {
    const mapa = {};
    for (const c of filtrados) {
      const key = (c.fechaRecepcion ?? '').substring(0, 7);
      if (!key) continue;
      if (!mapa[key]) mapa[key] = { mes: formatMes(key), G5: 0, G20: 0, G25: 0, G30: 0 };
      const vol = parseFloat(c.volumen) || 0;
      if (TIPOS_HORMIGON.includes(c.tipoHormigon)) mapa[key][c.tipoHormigon] += vol;
    }
    return Object.keys(mapa).sort().map(k => ({
      mes: mapa[k].mes,
      G5:  Math.round(mapa[k].G5  * 10) / 10,
      G20: Math.round(mapa[k].G20 * 10) / 10,
      G25: Math.round(mapa[k].G25 * 10) / 10,
      G30: Math.round(mapa[k].G30 * 10) / 10,
    }));
  }, [filtrados]);

  // ─── Análisis de cono ────────────────────────────────────────────────────

  const analisisCono = useMemo(() => {
    const tieneCono     = c => c.cono !== null && c.cono !== undefined && c.cono !== '';
    const estructurales = filtrados.filter(c => TIPOS_ESTRUCTURALES.includes(c.tipoHormigon));
    const conCono       = estructurales.filter(tieneCono);

    const coberturaTotal = estructurales.length > 0
      ? (conCono.length / estructurales.length) * 100
      : null;

    const esDesdeMayo       = c => fechaKey(c.fechaRecepcion) >= '2026-05-01';
    const estructuralesMayo = estructurales.filter(esDesdeMayo);
    const conConoMayo       = estructuralesMayo.filter(tieneCono);
    const coberturaMayo     = estructuralesMayo.length > 0
      ? (conConoMayo.length / estructuralesMayo.length) * 100
      : null;

    const porPlanta = PLANTAS.map(planta => {
      const regs   = conCono.filter(c => c.planta === planta);
      const vals   = regs.map(c => parseFloat(c.cono)).filter(v => !isNaN(v));
      const enSpec = vals.filter(v => v >= 6 && v <= 10).length;
      return {
        planta,
        ...calcStats(vals),
        pctSpec: vals.length > 0 ? (enSpec / vals.length) * 100 : null,
      };
    });

    return {
      coberturaTotal,
      coberturaMayo,
      nEstructurales:    estructurales.length,
      nConCono:          conCono.length,
      nDesdeMayo:        estructuralesMayo.length,
      nConConoDesdeMayo: conConoMayo.length,
      porPlanta,
    };
  }, [filtrados]);

  // ─── Análisis de PU ──────────────────────────────────────────────────────

  const analisisPU = useMemo(() => {
    const tienePU = c => c.puCalculado !== null && c.puCalculado !== undefined && c.puCalculado !== '';
    const base    = filtrados.filter(c =>
      TIPOS_ESTRUCTURALES.includes(c.tipoHormigon) && fechaKey(c.fechaRecepcion) >= FECHA_INICIO_PU
    );
    const conPU       = base.filter(tienePU);
    const coberturaPU = base.length > 0 ? (conPU.length / base.length) * 100 : null;

    const porPlanta = PLANTAS.map(planta => {
      const regs = conPU.filter(c => c.planta === planta);
      const vals = regs.map(c => parseFloat(c.puCalculado)).filter(v => !isNaN(v));
      return { planta, ...calcStats(vals) };
    });

    return { coberturaPU, nBase: base.length, nConPU: conPU.length, porPlanta };
  }, [filtrados]);

  const filtrosActivos = Object.values(filtros).filter(Boolean).length;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Control de Calidad — Hormigón</h1>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div style={s.filtrosHeader}>
        <button style={s.btnFiltros} onClick={() => setFiltrosAbiertos(o => !o)}>
          Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ''} {filtrosAbiertos ? '▲' : '▼'}
        </button>
        {filtrosActivos > 0 && (
          <button style={s.btnLimpiar} onClick={() => setFiltros(FILTROS_INICIAL)}>Limpiar filtros</button>
        )}
      </div>

      {filtrosAbiertos && (
        <div style={s.filtrosPanel}>
          <div style={s.campo}>
            <label style={s.label}>Tipo de entidad</label>
            <select style={s.input} value={filtros.entidadTipo} onChange={e => setFiltro('entidadTipo', e.target.value)}>
              <option value="">Todos</option>
              <option value="tramo">Tramo</option>
              <option value="caida">Caída</option>
              <option value="atravieso">Atravieso</option>
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Entidad</label>
            <select style={s.input} value={filtros.entidadId} onChange={e => setFiltro('entidadId', e.target.value)} disabled={!filtros.entidadTipo}>
              <option value="">Todas</option>
              {(LISTAS[filtros.entidadTipo] ?? []).map(id => (
                <option key={id} value={id}>{NOMBRE_TIPO[filtros.entidadTipo]} {id}</option>
              ))}
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Uso del hormigón</label>
            <select style={s.input} value={filtros.uso} onChange={e => setFiltro('uso', e.target.value)}>
              <option value="">Todos</option>
              <option value="radier">Radier</option>
              <option value="muro">Muro</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Tipo hormigón</label>
            <select style={s.input} value={filtros.tipoHormigon} onChange={e => setFiltro('tipoHormigon', e.target.value)}>
              <option value="">Todos</option>
              {TIPOS_HORMIGON.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Planta</label>
            <select style={s.input} value={filtros.planta} onChange={e => setFiltro('planta', e.target.value)}>
              <option value="">Todas</option>
              {PLANTAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Estado de calidad</label>
            <select style={s.input} value={filtros.estado} onChange={e => setFiltro('estado', e.target.value)}>
              <option value="">Todos</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Fecha desde</label>
            <input style={s.input} type="date" value={filtros.fechaDesde} onChange={e => setFiltro('fechaDesde', e.target.value)} />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Fecha hasta</label>
            <input style={s.input} type="date" value={filtros.fechaHasta} onChange={e => setFiltro('fechaHasta', e.target.value)} />
          </div>
        </div>
      )}

      {cargando && <p style={s.mensaje}>Cargando datos...</p>}
      {error    && <p style={{ ...s.mensaje, color: '#ef4444' }}>{error}</p>}

      {!cargando && !error && (
        <>
          {/* ── KPIs ──────────────────────────────────────────────────────── */}
          <div style={s.kpiRow}>
            <KpiCard label="Total camiones"  valor={kpis.totalCamiones} />
            <KpiCard label="Total m³"        valor={`${fmtNum(kpis.totalM3, 1)} m³`} />
            <KpiCard label="Camiones G20+"   valor={kpis.totalEstructurales} sub="estructurales" />
            <KpiCard label="m³ G20+"         valor={`${fmtNum(kpis.totalM3Estructurales, 1)} m³`} sub="estructurales" />
          </div>

          {/* ── Gráfico mensual ───────────────────────────────────────────── */}
          <div style={s.seccion}>
            <h2 style={s.seccionTitulo}>Volumen mensual por tipo (m³)</h2>
            {datosGrafico.length === 0
              ? <p style={s.mensajeVacio}>Sin datos con los filtros actuales</p>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={datosGrafico} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} unit=" m³" width={58} />
                    <Tooltip
                      contentStyle={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#ccd6f6', fontWeight: 700 }}
                      itemStyle={{ color: '#8892b0' }}
                      formatter={(value, name) => [`${fmtNum(value, 1)} m³`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0', paddingTop: 8 }} />
                    {TIPOS_HORMIGON.map(tipo => (
                      <Bar key={tipo} dataKey={tipo} stackId="a" fill={COLORES_TIPO[tipo]} name={tipo}>
                        <LabelList dataKey={tipo} content={BarLabel} />
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </div>

          {/* ── Control de Cono ───────────────────────────────────────────── */}
          <div style={s.seccion}>
            <h2 style={s.seccionTitulo}>Control de Cono — G20+</h2>

            <div style={s.coberturasRow}>
              <CoberturaCard
                valor={analisisCono.coberturaTotal != null ? `${analisisCono.coberturaTotal.toFixed(0)}%` : '—'}
                label="Cobertura total"
                sub={`${analisisCono.nConCono} / ${analisisCono.nEstructurales} registros G20+`}
                colorValor={colorSemaforo(analisisCono.coberturaTotal)}
              />
              <CoberturaCard
                valor={analisisCono.coberturaMayo != null ? `${analisisCono.coberturaMayo.toFixed(0)}%` : '—'}
                label="Cobertura desde mayo 2026"
                sub={`${analisisCono.nConConoDesdeMayo} / ${analisisCono.nDesdeMayo} registros G20+`}
                colorValor={colorSemaforo(analisisCono.coberturaMayo)}
              />
            </div>

            <div style={s.tablaWrap}>
              <table style={s.tabla}>
                <thead>
                  <tr>
                    <th style={s.th}>Planta</th>
                    <th style={{ ...s.th, ...s.thNum }}>n</th>
                    <th style={{ ...s.th, ...s.thNum }}>Promedio (cm)</th>
                    <th style={{ ...s.th, ...s.thNum }}>σ</th>
                    <th style={{ ...s.th, ...s.thNum }}>Rango</th>
                    <th style={{ ...s.th, ...s.thNum }}>% en spec (6–10 cm)</th>
                  </tr>
                </thead>
                <tbody>
                  {analisisCono.porPlanta.map(({ planta, promedio, sigma, min, max, n, pctSpec }) => (
                    <tr key={planta}>
                      <td style={s.td}>{planta}</td>
                      <td style={{ ...s.td, ...s.tdNum }}>{n}</td>
                      <td style={{ ...s.td, ...s.tdNum }}>{fmtNum(promedio)}</td>
                      <td style={{ ...s.td, ...s.tdNum }}>{fmtNum(sigma)}</td>
                      <td style={{ ...s.td, ...s.tdNum }}>
                        {min != null ? `${fmtNum(min)} – ${fmtNum(max)}` : '—'}
                      </td>
                      <td style={{ ...s.td, ...s.tdNum }}>
                        {pctSpec != null
                          ? <span style={{ color: colorSemaforo(pctSpec), fontWeight: 700 }}>{pctSpec.toFixed(0)}%</span>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Control de Peso Unitario ───────────────────────────────────── */}
          <div style={s.seccion}>
            <h2 style={s.seccionTitulo}>Control de Peso Unitario — G20+ desde {FECHA_INICIO_PU}</h2>

            <div style={s.coberturasRow}>
              <CoberturaCard
                valor={analisisPU.coberturaPU != null ? `${analisisPU.coberturaPU.toFixed(0)}%` : '—'}
                label="Cobertura PU"
                sub={`${analisisPU.nConPU} / ${analisisPU.nBase} registros G20+ desde ${FECHA_INICIO_PU}`}
                colorValor="#64ffda"
              />
            </div>

            <div style={s.tablaWrap}>
              <table style={s.tabla}>
                <thead>
                  <tr>
                    <th style={s.th}>Planta</th>
                    <th style={{ ...s.th, ...s.thNum }}>n</th>
                    <th style={{ ...s.th, ...s.thNum }}>Promedio (kg/m³)</th>
                    <th style={{ ...s.th, ...s.thNum }}>σ</th>
                    <th style={{ ...s.th, ...s.thNum }}>Rango</th>
                  </tr>
                </thead>
                <tbody>
                  {analisisPU.porPlanta.map(({ planta, promedio, sigma, min, max, n }) => (
                    <tr key={planta}>
                      <td style={s.td}>{planta}</td>
                      <td style={{ ...s.td, ...s.tdNum }}>{n}</td>
                      <td style={{ ...s.td, ...s.tdNum }}>{fmtNum(promedio, 0)}</td>
                      <td style={{ ...s.td, ...s.tdNum }}>{fmtNum(sigma, 0)}</td>
                      <td style={{ ...s.td, ...s.tdNum }}>
                        {min != null ? `${fmtNum(min, 0)} – ${fmtNum(max, 0)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={s.nota}>Sin especificación contractual definida — solo estadística descriptiva</p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = {
  page: {
    maxWidth: '1100px', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px',
  },
  titulo: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },

  filtrosHeader: { display: 'flex', gap: '10px', alignItems: 'center' },
  btnFiltros: {
    background: '#16213e', color: '#ccd6f6', border: '1px solid #0f3460',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  btnLimpiar: {
    background: 'transparent', color: '#8892b0', border: '1px solid #0f3460',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  filtrosPanel: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px',
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '12px', padding: '16px',
  },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#8892b0', fontSize: '12px', fontWeight: 600 },
  input: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '13px', padding: '9px 10px', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },

  mensaje:      { color: '#8892b0', fontSize: '14px', textAlign: 'center', padding: '24px 0' },
  mensajeVacio: { color: '#8892b0', fontSize: '13px', fontStyle: 'italic', margin: 0 },

  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  kpiCard: {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '12px',
    padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '4px',
  },
  kpiValor: { color: '#64ffda', fontSize: '28px', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  kpiLabel: { color: '#ccd6f6', fontSize: '13px', fontWeight: 600 },
  kpiSub:   { color: '#8892b0', fontSize: '11px' },

  seccion:       { background: '#16213e', border: '1px solid #0f3460', borderRadius: '12px', padding: '20px' },
  seccionTitulo: { color: '#64ffda', fontSize: '15px', fontWeight: 700, margin: '0 0 16px' },

  coberturasRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' },
  coberturaCard: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '10px',
    padding: '14px 18px', minWidth: '180px',
  },
  coberturaValor: { fontSize: '32px', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
  coberturaLabel: { color: '#ccd6f6', fontSize: '12px', fontWeight: 600, marginTop: '4px' },
  coberturaSub:   { color: '#8892b0', fontSize: '11px', marginTop: '2px' },

  tablaWrap: { overflowX: 'auto' },
  tabla:     { width: '100%', borderCollapse: 'collapse' },
  th: {
    color: '#8892b0', fontSize: '11px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.4px',
    padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #0f3460',
    whiteSpace: 'nowrap',
  },
  thNum: { textAlign: 'right' },
  td:    { color: '#ccd6f6', fontSize: '13px', padding: '10px 12px', borderBottom: '1px solid #0f3460' },
  tdNum: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },

  nota: { color: '#8892b0', fontSize: '12px', fontStyle: 'italic', marginTop: '12px', marginBottom: 0 },
};
