import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList, ResponsiveContainer,
  ErrorBar, ReferenceArea, ReferenceLine, Label,
} from 'recharts';
import { supabase } from '../config/supabase';
import { TRAMOS, CAIDAS, ATRAVIESOS } from '../constants/estructura';
import { generarPPT } from '../utils/generarPPT';

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

const COLORES_PLANTA = {
  'Membrillar':     '#64ffda',
  'Quilanco':       '#f59e0b',
  'Río San Martín': '#818cf8',
};

const COLORES_LAB = {
  'Pampa Austral': '#64ffda',
  'Labotec':       '#f59e0b',
};

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const RESISTENCIA_MIN = { G20: 20, G25: 25, G30: 30 };

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

function formatDDMMM(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')} ${MESES_ES[d.getMonth()]}`;
}

function getWeekKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().substring(0, 10);
}

function diasDesde(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24));
}

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

function TooltipCono({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: '#ccd6f6', margin: '0 0 2px' }}>Guía: {d.guia || '—'}</p>
      <p style={{ color: '#ccd6f6', margin: '0 0 2px' }}>Fecha: {d.fecha}</p>
      <p style={{ color: '#ccd6f6', margin: '0 0 2px' }}>Cono: {d.y} cm</p>
      <p style={{ color: '#8892b0', margin: 0 }}>Planta: {d.planta || '—'}</p>
    </div>
  );
}

function TooltipLab({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: '#ccd6f6', fontWeight: 700, margin: '0 0 4px' }}>{label}</p>
      <p style={{ color: '#64ffda', margin: '0 0 2px' }}>Promedio R28: {d.promedio} MPa</p>
      <p style={{ color: '#8892b0', margin: '0 0 2px' }}>σ: {d.sigma} MPa</p>
      <p style={{ color: '#8892b0', margin: 0 }}>Cumplimiento: {d.pctCumple}% ({d.n} ensayos)</p>
    </div>
  );
}

function TooltipR28({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: '#ccd6f6', margin: '0 0 2px' }}>Guía: {d.guia}</p>
      <p style={{ color: '#ccd6f6', margin: '0 0 2px' }}>Fecha: {d.fecha}</p>
      <p style={{ color: '#ccd6f6', margin: '0 0 2px' }}>R28: {d.y} MPa</p>
      <p style={{ color: '#8892b0', margin: 0 }}>Lab.: {d.laboratorio}</p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardCamiones() {
  const [camiones, setCamiones]               = useState([]);
  const [cargando, setCargando]               = useState(true);
  const [error, setError]                     = useState(null);
  const [filtros, setFiltros]                 = useState(FILTROS_INICIAL);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [ensayosLab, setEnsayosLab]           = useState([]);
  const [ensayos, setEnsayos]                 = useState([]);

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

  useEffect(() => {
    if (!supabase || !navigator.onLine) return;
    supabase
      .from('ensayos_laboratorio')
      .select('id, r7, r28, fecha_muestreo, tipo_ensayo, camiones(tipo_hormigon)')
      .then(({ data, error: err }) => {
        if (!err) setEnsayosLab(data ?? []);
      });
  }, []);

  useEffect(() => {
    if (!supabase || !navigator.onLine) return;
    supabase
      .from('ensayos_laboratorio')
      .select('*, camiones(tipo_hormigon, planta)')
      .eq('tipo_ensayo', 'compresion')
      .order('fecha_muestreo', { ascending: true })
      .then(({ data, error: err }) => {
        if (!err) setEnsayos(data ?? []);
      });
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

  const kpisEnsayo = useMemo(() => {
    const compresion = ensayosLab.filter(e => e.tipo_ensayo === 'compresion');
    const total    = compresion.length;
    const conR28   = compresion.filter(e => e.r28 != null).length;
    const cumpleR28 = compresion.filter(e => {
      if (e.r28 == null) return false;
      const min = RESISTENCIA_MIN[e.camiones?.tipo_hormigon];
      return min != null && e.r28 >= min;
    }).length;
    const vencidos = compresion.filter(e =>
      e.r28 == null && (diasDesde(e.fecha_muestreo) ?? 0) >= 28
    ).length;
    return { total, conR28, cumpleR28, vencidos };
  }, [ensayosLab]);

  const datosAcumulado = useMemo(() => {
    let acum = 0;
    return [...filtrados]
      .filter(c => c.fechaRecepcion && parseFloat(c.volumen) > 0)
      .sort((a, b) => a.fechaRecepcion.localeCompare(b.fechaRecepcion))
      .map(c => {
        acum += parseFloat(c.volumen) || 0;
        return { label: formatDDMMM(c.fechaRecepcion), acumulado: Math.round(acum * 10) / 10 };
      });
  }, [filtrados]);

  const donaPlanta = useMemo(() => {
    const mapa = {};
    for (const c of filtrados) {
      if (!c.planta) continue;
      mapa[c.planta] = (mapa[c.planta] || 0) + (parseFloat(c.volumen) || 0);
    }
    return PLANTAS
      .map(p => ({ name: p, value: Math.round((mapa[p] || 0) * 10) / 10 }))
      .filter(p => p.value > 0);
  }, [filtrados]);

  const scatterCono = useMemo(() => {
    const tieneCono = c => c.cono !== null && c.cono !== undefined && c.cono !== '';
    return filtrados
      .filter(c => TIPOS_ESTRUCTURALES.includes(c.tipoHormigon) && tieneCono(c) && c.fechaRecepcion)
      .map(c => ({
        x:      new Date(c.fechaRecepcion + 'T12:00:00').getTime(),
        y:      parseFloat(c.cono),
        planta: c.planta,
        guia:   c.numeroGuia,
        fecha:  c.fechaRecepcion.substring(0, 10),
      }));
  }, [filtrados]);

  const semanalCono = useMemo(() => {
    const tieneCono = c => c.cono !== null && c.cono !== undefined && c.cono !== '';
    const mapa = {};
    for (const c of filtrados.filter(c => TIPOS_ESTRUCTURALES.includes(c.tipoHormigon) && tieneCono(c))) {
      const wk = getWeekKey(c.fechaRecepcion);
      if (!wk) continue;
      if (!mapa[wk]) mapa[wk] = [];
      mapa[wk].push(parseFloat(c.cono));
    }
    return Object.keys(mapa).sort().map(wk => ({
      semana:   formatDDMMM(wk),
      promedio: Math.round(mapa[wk].reduce((a, b) => a + b, 0) / mapa[wk].length * 10) / 10,
      n:        mapa[wk].length,
    }));
  }, [filtrados]);

  const promedioGlobalPU = useMemo(() => {
    const vals = filtrados
      .filter(c => TIPOS_ESTRUCTURALES.includes(c.tipoHormigon) && fechaKey(c.fechaRecepcion) >= FECHA_INICIO_PU)
      .map(c => parseFloat(c.puCalculado))
      .filter(v => !isNaN(v) && v > 0);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [filtrados]);

  const semanalPU = useMemo(() => {
    const base = filtrados.filter(c =>
      TIPOS_ESTRUCTURALES.includes(c.tipoHormigon) &&
      fechaKey(c.fechaRecepcion) >= FECHA_INICIO_PU &&
      c.puCalculado !== null && c.puCalculado !== undefined && c.puCalculado !== ''
    );
    const mapa = {};
    for (const c of base) {
      const wk = getWeekKey(c.fechaRecepcion);
      if (!wk || !c.planta) continue;
      if (!mapa[wk]) mapa[wk] = { label: formatDDMMM(wk) };
      if (!mapa[wk][c.planta]) mapa[wk][c.planta] = [];
      mapa[wk][c.planta].push(parseFloat(c.puCalculado));
    }
    return Object.keys(mapa).sort()
      .map(wk => {
        const row = { semana: mapa[wk].label };
        for (const p of PLANTAS) {
          const vals = mapa[wk][p];
          if (vals && vals.length > 0) row[p] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        }
        return row;
      })
      .filter(row => PLANTAS.some(p => row[p] != null));
  }, [filtrados]);

  const kpisLab = useMemo(() => {
    const total = ensayos.length;
    const conR28 = ensayos.filter(e => e.r28 != null).length;
    const cumpleR28 = ensayos.filter(e => {
      if (e.r28 == null) return false;
      const min = RESISTENCIA_MIN[e.camiones?.tipo_hormigon];
      return min != null && e.r28 >= min;
    }).length;
    const vencidosSinR28 = ensayos.filter(e =>
      e.r28 === null && (diasDesde(e.fecha_muestreo) ?? 0) >= 28
    ).length;
    return { total, conR28, cumpleR28, vencidosSinR28 };
  }, [ensayos]);

  const barrasLaboratorio = useMemo(() => {
    const conR28 = ensayos.filter(e => e.r28 != null && e.laboratorio);
    const porLab = {};
    for (const e of conR28) {
      if (!porLab[e.laboratorio]) porLab[e.laboratorio] = [];
      porLab[e.laboratorio].push(e);
    }
    return Object.entries(porLab).map(([lab, regs]) => {
      const vals = regs.map(e => e.r28);
      const n    = vals.length;
      const prom = vals.reduce((a, b) => a + b, 0) / n;
      const sigma = Math.sqrt(vals.reduce((a, b) => a + (b - prom) ** 2, 0) / n);
      const cumple = regs.filter(e => {
        const min = RESISTENCIA_MIN[e.camiones?.tipo_hormigon];
        return min != null && e.r28 >= min;
      }).length;
      return {
        laboratorio: lab,
        promedio:    Math.round(prom * 10) / 10,
        sigma:       Math.round(sigma * 10) / 10,
        pctCumple:   Math.round((cumple / n) * 100),
        n,
      };
    });
  }, [ensayos]);

  const scatterR28 = useMemo(() => {
    return ensayos
      .filter(e => e.r28 != null && e.fecha_muestreo)
      .map(e => ({
        x:           new Date((e.fecha_muestreo ?? '') + 'T12:00:00').getTime(),
        y:           e.r28,
        laboratorio: e.laboratorio ?? '—',
        guia:        e.numero_guia ?? '—',
        fecha:       (e.fecha_muestreo ?? '').substring(0, 10),
      }));
  }, [ensayos]);

  const barrasR7vsR28 = useMemo(() => {
    return ensayos
      .filter(e => e.r7 != null)
      .map(e => ({
        guia: e.numero_guia ?? '—',
        r7:   e.r7,
        r28:  e.r28 ?? null,
      }));
  }, [ensayos]);

  const barrasPlantaEnsayo = useMemo(() => {
    const conR28 = ensayos.filter(e => e.r28 != null && e.camiones?.planta);
    const porPlanta = {};
    for (const e of conR28) {
      const pl = e.camiones.planta;
      if (!porPlanta[pl]) porPlanta[pl] = [];
      porPlanta[pl].push(e);
    }
    return PLANTAS
      .filter(p => porPlanta[p])
      .map(p => {
        const regs = porPlanta[p];
        const vals = regs.map(e => e.r28);
        const n    = vals.length;
        const prom = vals.reduce((a, b) => a + b, 0) / n;
        const sigma = Math.sqrt(vals.reduce((a, b) => a + (b - prom) ** 2, 0) / n);
        const cumple = regs.filter(e => {
          const min = RESISTENCIA_MIN[e.camiones?.tipo_hormigon];
          return min != null && e.r28 >= min;
        }).length;
        return {
          planta:    p,
          promedio:  Math.round(prom * 10) / 10,
          sigma:     Math.round(sigma * 10) / 10,
          pctCumple: Math.round((cumple / n) * 100),
          n,
        };
      });
  }, [ensayos]);

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
        <button
          style={s.btnPPT}
          onClick={() => {
            const ensayosSemana = ensayos.filter(e => {
              const f = e.fecha_muestreo ?? '';
              if (filtros.fechaDesde && f < filtros.fechaDesde) return false;
              if (filtros.fechaHasta && f > filtros.fechaHasta) return false;
              return true;
            });
            generarPPT({
              camiones,
              ensayos,
              fechaDesde: filtros.fechaDesde || '—',
              fechaHasta: filtros.fechaHasta || '—',
              camionesSemana: filtrados,
              ensayosSemana,
            });
          }}
        >
          📊 Exportar PPT
        </button>
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

            {datosAcumulado.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <p style={s.graficoTitulo}>
                  Producción acumulada
                  <span style={{ fontWeight: 400, color: '#64ffda', marginLeft: '8px', fontSize: '13px' }}>
                    → {fmtNum(datosAcumulado[datosAcumulado.length - 1].acumulado, 1)} m³ total
                  </span>
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={datosAcumulado} margin={{ top: 8, right: 32, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} unit=" m³" width={62} />
                    <Tooltip
                      contentStyle={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#ccd6f6', fontWeight: 700 }}
                      itemStyle={{ color: '#64ffda' }}
                      formatter={v => [`${fmtNum(v, 1)} m³`, 'Acumulado']}
                    />
                    <Line type="monotone" dataKey="acumulado" stroke="#64ffda" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {donaPlanta.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <p style={s.graficoTitulo}>Distribución por planta (m³)</p>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={donaPlanta}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={110}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#8892b0' }}
                      fontSize={11}
                    >
                      {donaPlanta.map(entry => (
                        <Cell key={entry.name} fill={COLORES_PLANTA[entry.name] ?? '#8892b0'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, fontSize: 12 }}
                      formatter={(v, name) => [`${fmtNum(v, 1)} m³`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0', paddingTop: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
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
                    <th style={{ ...s.th, ...s.thNum }}>CV (%)</th>
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
                        {sigma != null && promedio != null && promedio !== 0
                          ? `${(sigma / promedio * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(() => {
              const data = analisisCono.porPlanta
                .filter(p => p.n > 0 && p.promedio != null)
                .map(p => ({ planta: p.planta, promedio: Math.round(p.promedio * 10) / 10 }));
              return data.length > 0 ? (
                <div style={{ marginTop: '24px' }}>
                  <p style={s.graficoTitulo}>Promedio de cono por planta (cm)</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data} margin={{ top: 16, right: 32, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                      <XAxis dataKey="planta" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 14]} tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} unit=" cm" width={48} />
                      <Tooltip
                        contentStyle={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#ccd6f6', fontWeight: 700 }}
                        formatter={v => [`${fmtNum(v)} cm`, 'Promedio cono']}
                      />
                      <ReferenceArea y1={6} y2={10} fill="#10b981" fillOpacity={0.08} />
                      <ReferenceLine y={8} stroke="#10b981" strokeDasharray="4 4">
                        <Label value="Óptimo 8 cm" position="insideTopRight" fill="#10b981" fontSize={11} />
                      </ReferenceLine>
                      <Bar dataKey="promedio" radius={[6, 6, 0, 0]}>
                        {data.map(d => (
                          <Cell key={d.planta} fill={COLORES_PLANTA[d.planta] ?? '#8892b0'} />
                        ))}
                        <LabelList dataKey="promedio" position="top" style={{ fill: '#ccd6f6', fontSize: 11, fontWeight: 600 }} formatter={v => `${fmtNum(v)} cm`} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null;
            })()}

            {scatterCono.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <p style={s.graficoTitulo}>Cono vs. fecha — G20+ (rojo: fuera del rango 6–10 cm)</p>
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart margin={{ top: 8, right: 32, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                    <XAxis
                      type="number" dataKey="x" name="fecha"
                      domain={['auto', 'auto']}
                      tickFormatter={v => formatDDMMM(new Date(v).toISOString().substring(0, 10))}
                      tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false}
                    />
                    <YAxis type="number" dataKey="y" name="cono" domain={[0, 14]} unit=" cm" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                    <ZAxis range={[35, 35]} />
                    <ReferenceArea y1={6} y2={10} fill="#10b981" fillOpacity={0.07} />
                    <Tooltip content={TooltipCono} />
                    <Scatter
                      data={scatterCono}
                      shape={({ cx, cy, payload }) => {
                        const inRange = payload.y >= 6 && payload.y <= 10;
                        const fill = inRange ? (COLORES_PLANTA[payload.planta] ?? '#8892b0') : '#ef4444';
                        return <circle cx={cx} cy={cy} r={4} fill={fill} fillOpacity={0.85} stroke="none" />;
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}

            {semanalCono.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <p style={s.graficoTitulo}>Promedio semanal de cono — G20+</p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={semanalCono} margin={{ top: 8, right: 32, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                    <XAxis dataKey="semana" tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis domain={[0, 14]} tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} unit=" cm" width={48} />
                    <Tooltip
                      contentStyle={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#ccd6f6', fontWeight: 700 }}
                      formatter={(v, _n, props) => [`${fmtNum(v)} cm  (n=${props.payload.n})`, 'Promedio cono']}
                    />
                    <ReferenceArea y1={6} y2={10} fill="#10b981" fillOpacity={0.07} />
                    <ReferenceLine y={8} stroke="#10b981" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="promedio" stroke="#64ffda" strokeWidth={2} dot={{ fill: '#64ffda', r: 4 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
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
            {(() => {
              const dataBarras = analisisPU.porPlanta
                .filter(p => p.n > 0 && p.promedio != null)
                .map(p => ({ planta: p.planta, promedio: Math.round(p.promedio), sigma: Math.round(p.sigma ?? 0) }));
              return dataBarras.length > 0 ? (
                <div style={{ marginTop: '24px' }}>
                  <p style={s.graficoTitulo}>Promedio ± σ de PU por planta (kg/m³)</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={dataBarras} margin={{ top: 16, right: 32, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                      <XAxis dataKey="planta" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[2200, 2500]} tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} unit=" kg" width={62} />
                      <Tooltip
                        contentStyle={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: '#ccd6f6', fontWeight: 700 }}
                        formatter={(v, name) => [`${fmtNum(v, 0)} kg/m³`, name === 'promedio' ? 'Promedio PU' : 'σ']}
                      />
                      {promedioGlobalPU && (
                        <ReferenceLine y={promedioGlobalPU} stroke="#64ffda" strokeDasharray="4 4">
                          <Label value={`Prom global: ${promedioGlobalPU}`} position="insideTopRight" fill="#64ffda" fontSize={11} />
                        </ReferenceLine>
                      )}
                      <Bar dataKey="promedio" radius={[6, 6, 0, 0]}>
                        {dataBarras.map(d => (
                          <Cell key={d.planta} fill={COLORES_PLANTA[d.planta] ?? '#8892b0'} />
                        ))}
                        <LabelList dataKey="promedio" position="top" style={{ fill: '#ccd6f6', fontSize: 11, fontWeight: 600 }} formatter={v => fmtNum(v, 0)} />
                        <ErrorBar dataKey="sigma" width={4} strokeWidth={2} stroke="#8892b0" direction="y" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null;
            })()}

            {semanalPU.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <p style={s.graficoTitulo}>Evolución semanal de PU por planta (kg/m³)</p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={semanalPU} margin={{ top: 8, right: 32, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                    <XAxis dataKey="semana" tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[2200, 2500]} tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} unit=" kg" width={62} />
                    <Tooltip
                      contentStyle={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#ccd6f6', fontWeight: 700 }}
                      formatter={(v, name) => [`${fmtNum(v, 0)} kg/m³`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#8892b0', paddingTop: 8 }} />
                    {PLANTAS.map(p => (
                      <Line
                        key={p} type="monotone" dataKey={p}
                        stroke={COLORES_PLANTA[p]} strokeWidth={2}
                        dot={{ fill: COLORES_PLANTA[p], r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <p style={s.nota}>Sin especificación contractual definida — solo estadística descriptiva</p>
          </div>

          {/* ── Ensayos de Laboratorio ─────────────────────────────────────── */}
          {(() => {
            const pct = kpisLab.conR28 > 0
              ? Math.round((kpisLab.cumpleR28 / kpisLab.conR28) * 100)
              : null;
            const pctColor = pct == null ? '#8892b0'
              : pct === 100 ? '#10b981'
              : pct >= 90   ? '#f59e0b'
              : '#ef4444';
            return (
              <div style={{ ...s.seccion, background: '#0a1428' }}>
                <h2 style={{ ...s.seccionTitulo, color: '#ccd6f6' }}>Ensayos de Laboratorio</h2>

                {/* KPIs */}
                <div style={s.kpiRow}>
                  <div style={s.kpiCard}>
                    <div style={s.kpiValor}>{kpisLab.total}</div>
                    <div style={s.kpiLabel}>Total muestras</div>
                    <div style={s.kpiSub}>ensayos compresión</div>
                  </div>
                  <div style={s.kpiCard}>
                    <div style={s.kpiValor}>{kpisLab.conR28}</div>
                    <div style={s.kpiLabel}>Con R28 disponible</div>
                    <div style={s.kpiSub}>{kpisLab.conR28} / {kpisLab.total}</div>
                  </div>
                  <div style={s.kpiCard}>
                    <div style={{ ...s.kpiValor, color: pctColor }}>
                      {pct != null ? `${pct}%` : '—'}
                    </div>
                    <div style={s.kpiLabel}>% Cumplimiento R28</div>
                    {kpisLab.conR28 > 0 && (
                      <div style={s.kpiSub}>{kpisLab.cumpleR28} / {kpisLab.conR28} cumplen</div>
                    )}
                  </div>
                  <div style={s.kpiCard}>
                    <div style={{ ...s.kpiValor, color: kpisLab.vencidosSinR28 > 0 ? '#ef4444' : '#64ffda' }}>
                      {kpisLab.vencidosSinR28}
                    </div>
                    <div style={s.kpiLabel}>Pendientes vencidos</div>
                    <div style={{ ...s.kpiSub, ...(kpisLab.vencidosSinR28 > 0 ? { color: '#ef4444' } : {}) }}>
                      sin R28 con 28+ días
                    </div>
                  </div>
                </div>

                {/* Barras promedio R28 por laboratorio */}
                {barrasLaboratorio.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <p style={s.graficoTitulo}>Promedio R28 por laboratorio (MPa)</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={barrasLaboratorio} margin={{ top: 16, right: 32, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                        <XAxis dataKey="laboratorio" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} unit=" MPa" width={58} />
                        <Tooltip content={TooltipLab} />
                        <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4">
                          <Label value="Mínimo G20: 20 MPa" position="insideTopRight" fill="#ef4444" fontSize={11} />
                        </ReferenceLine>
                        <Bar dataKey="promedio" fill="#64ffda" radius={[6, 6, 0, 0]}>
                          <LabelList dataKey="promedio" position="top" style={{ fill: '#ccd6f6', fontSize: 11, fontWeight: 600 }} formatter={v => `${fmtNum(v)} MPa`} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* R28 promedio por planta */}
                {barrasPlantaEnsayo.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <p style={s.graficoTitulo}>R28 promedio por planta (MPa)</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={barrasPlantaEnsayo} margin={{ top: 16, right: 32, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                        <XAxis dataKey="planta" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} unit=" MPa" width={58} />
                        <Tooltip content={TooltipLab} />
                        <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4">
                          <Label value="Mínimo G20: 20 MPa" position="insideTopRight" fill="#ef4444" fontSize={11} />
                        </ReferenceLine>
                        <Bar dataKey="promedio" radius={[6, 6, 0, 0]}>
                          {barrasPlantaEnsayo.map(d => (
                            <Cell key={d.planta} fill={COLORES_PLANTA[d.planta] ?? '#8892b0'} />
                          ))}
                          <LabelList dataKey="promedio" position="top" style={{ fill: '#ccd6f6', fontSize: 11, fontWeight: 600 }} formatter={v => `${fmtNum(v)} MPa`} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Scatter R28 vs fecha */}
                {scatterR28.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <p style={s.graficoTitulo}>Dispersión R28 vs fecha de muestreo (MPa)</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <ScatterChart margin={{ top: 8, right: 32, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                        <XAxis
                          type="number" dataKey="x" name="fecha"
                          domain={['auto', 'auto']}
                          tickFormatter={v => formatDDMMM(new Date(v).toISOString().substring(0, 10))}
                          tick={{ fill: '#8892b0', fontSize: 10 }} axisLine={false} tickLine={false}
                        />
                        <YAxis type="number" dataKey="y" name="R28" unit=" MPa" tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} width={58} />
                        <ZAxis range={[40, 40]} />
                        <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4">
                          <Label value="Mínimo G20" position="insideTopRight" fill="#ef4444" fontSize={11} />
                        </ReferenceLine>
                        <Tooltip content={TooltipR28} />
                        <Scatter
                          data={scatterR28}
                          shape={({ cx, cy, payload }) => {
                            const fill = COLORES_LAB[payload.laboratorio] ?? '#8892b0';
                            return <circle cx={cx} cy={cy} r={5} fill={fill} fillOpacity={0.85} stroke="none" />;
                          }}
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                    <p style={{ ...s.nota, marginTop: '8px' }}>
                      {Object.entries(COLORES_LAB).map(([lab, color]) => (
                        <span key={lab} style={{ marginRight: '16px' }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 5 }} />
                          {lab}
                        </span>
                      ))}
                    </p>
                  </div>
                )}

                {/* Barras R7 vs R28 por guía */}
                {barrasR7vsR28.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <p style={s.graficoTitulo}>R7 vs R28 por guía (MPa)</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={barrasR7vsR28} margin={{ top: 8, right: 16, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                        <XAxis
                          dataKey="guia"
                          tick={{ fill: '#8892b0', fontSize: 10, angle: -45, textAnchor: 'end', dy: 5 }}
                          axisLine={false} tickLine={false} interval={0}
                        />
                        <YAxis tick={{ fill: '#8892b0', fontSize: 11 }} axisLine={false} tickLine={false} unit=" MPa" width={52} />
                        <Tooltip
                          contentStyle={{ background: '#16213e', border: '1px solid #0f3460', borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ color: '#ccd6f6', fontWeight: 700 }}
                          formatter={(v, name) => [v != null ? `${fmtNum(v)} MPa` : '—', name === 'r7' ? 'R7' : 'R28']}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 12, color: '#8892b0', paddingTop: 8 }}
                          formatter={name => name === 'r7' ? 'R7' : 'R28'}
                        />
                        <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4">
                          <Label value="Mínimo G20" position="insideTopRight" fill="#ef4444" fontSize={11} />
                        </ReferenceLine>
                        <Bar dataKey="r7"  fill="#8892b0" name="r7"  radius={[4, 4, 0, 0]} />
                        <Bar dataKey="r28" fill="#64ffda" name="r28" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })()}
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
  btnPPT: {
    background: 'rgba(100,255,218,0.08)', border: '1px solid rgba(100,255,218,0.3)',
    borderRadius: '8px', color: '#64ffda', fontSize: '13px', fontWeight: 700,
    padding: '8px 14px', cursor: 'pointer',
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

  nota:          { color: '#8892b0', fontSize: '12px', fontStyle: 'italic', marginTop: '12px', marginBottom: 0 },
  graficoTitulo: { color: '#64ffda', fontSize: '14px', fontWeight: 600, margin: '0 0 8px' },
};
