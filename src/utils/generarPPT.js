import pptxgen from 'pptxgenjs';

const COLORES = {
  header:    '7B3F1E',
  acento:    'C0622A',
  blanco:    'FFFFFF',
  gris:      'F5F5F5',
  grisTexto: '666666',
  negro:     '1C1C1C',
};

const FUENTE    = 'Calibri';
const W         = 13.33;
const H         = 7.5;
const MESES_ES  = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PLANTAS   = ['Membrillar', 'Quilanco', 'Río San Martín'];
const TIPOS_BAR = ['G5', 'G20', 'G25', 'G30'];
const RESISTENCIA_MIN = { G20: 20, G25: 25, G30: 30 };
const NOMBRES_TIPO    = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function diasDesde(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24));
}

function calcStats(valores) {
  const n = valores.length;
  if (n === 0) return { n: 0, promedio: null, sigma: null };
  const avg   = valores.reduce((a, b) => a + b, 0) / n;
  const sigma = Math.sqrt(valores.reduce((a, b) => a + (b - avg) ** 2, 0) / n);
  return { n, promedio: +avg.toFixed(1), sigma: +sigma.toFixed(1) };
}

function fmt(v, sufijo = '') {
  if (v == null || v === '') return '—';
  return `${v}${sufijo}`;
}

function fmtFecha(dateStr) {
  if (!dateStr) return '—';
  return String(dateStr).slice(0, 10);
}

function entidadLabelCamel(c) {
  if (!c.tipoEntidad) return '—';
  return `${NOMBRES_TIPO[c.tipoEntidad] ?? c.tipoEntidad} ${c.entidadId ?? ''}`.trim();
}

function entidadLabelEnsayo(e) {
  const tipo = e.camiones?.tipo_entidad ?? '';
  const id   = e.camiones?.entidad_id   ?? '';
  if (!tipo) return '—';
  return `${NOMBRES_TIPO[tipo] ?? tipo} ${id}`.trim();
}

function estadoEnsayo(e) {
  const tipoH  = e.camiones?.tipo_hormigon ?? null;
  const minima = RESISTENCIA_MIN[tipoH] ?? null;
  if (e.r28 != null) {
    if (minima == null) return 'Cumple';
    return e.r28 >= minima ? 'Cumple' : 'No cumple';
  }
  const dias = diasDesde(e.fecha_muestreo) ?? 0;
  if (e.r7 != null) return dias >= 28 ? 'R28 vencido' : 'Espera R28';
  return 'Sin resultado';
}

function rangoTitulo(fechaDesde, fechaHasta) {
  const fd = fechaDesde && fechaDesde !== '—' ? fechaDesde : null;
  const fh = fechaHasta && fechaHasta !== '—' ? fechaHasta : null;
  if (!fd && !fh) return 'todo el período';
  if (fd && !fh)  return `desde ${fd}`;
  if (!fd && fh)  return `hasta ${fh}`;
  return `${fd} al ${fh}`;
}

// ── Elementos base ────────────────────────────────────────────────────────────

function addHeader(slide, texto) {
  slide.addText(texto, {
    x: 0, y: 0, w: W, h: 0.71,
    fill: { color: COLORES.header },
    fontSize: 16, bold: true, color: COLORES.blanco,
    fontFace: FUENTE, valign: 'middle', inset: 0.3,
  });
}

// KPI estándar (grande) para láminas 1 y 3
function addKpi(slide, x, y, w, h, valor, label) {
  slide.addText('', {
    x, y, w, h,
    fill: { color: COLORES.blanco },
    line: { color: 'DDDDDD', pt: 1 },
  });
  slide.addText('', {
    x, y, w: 0.06, h,
    fill: { color: COLORES.acento },
    line: { color: COLORES.acento, pt: 0 },
  });
  slide.addText(String(valor), {
    x: x + 0.12, y, w: w - 0.14, h: h * 0.62,
    fontSize: 28, bold: true, color: COLORES.acento,
    fontFace: FUENTE, valign: 'bottom',
  });
  slide.addText(label, {
    x: x + 0.12, y: y + h * 0.6, w: w - 0.14, h: h * 0.38,
    fontSize: 10, color: COLORES.grisTexto,
    fontFace: FUENTE, valign: 'top',
  });
}

// KPI compacto (fila única con 6 items) para lámina 2
function addKpiCompact(slide, x, y, w, h, valor, label) {
  slide.addText('', {
    x, y, w, h,
    fill: { color: COLORES.blanco },
    line: { color: 'DDDDDD', pt: 1 },
  });
  slide.addText('', {
    x, y, w: 0.05, h,
    fill: { color: COLORES.acento },
    line: { color: COLORES.acento, pt: 0 },
  });
  slide.addText(String(valor), {
    x: x + 0.09, y, w: w - 0.11, h: h * 0.60,
    fontSize: 22, bold: true, color: COLORES.acento,
    fontFace: FUENTE, valign: 'bottom',
  });
  slide.addText(label, {
    x: x + 0.09, y: y + h * 0.58, w: w - 0.11, h: h * 0.40,
    fontSize: 9, color: COLORES.grisTexto,
    fontFace: FUENTE, valign: 'top',
  });
}

const TH = (extra = {}) => ({
  bold: true, color: COLORES.blanco, fill: { color: COLORES.header },
  fontSize: 9, fontFace: FUENTE, align: 'center', valign: 'middle',
  ...extra,
});
const TD = (alt, extra = {}) => ({
  fontSize: 9, color: COLORES.negro,
  fill: { color: alt ? COLORES.gris : COLORES.blanco },
  fontFace: FUENTE, align: 'center', valign: 'middle',
  ...extra,
});
const TD_ERR = (alt) => ({
  fontSize: 9, color: 'CC0000',
  fill: { color: alt ? 'FFDDDD' : 'FFEEEE' },
  fontFace: FUENTE, align: 'center', valign: 'middle',
});

// ── LÁMINA 1 — Resumen de la semana ──────────────────────────────────────────
// camionesSemana: camelCase  |  ensayosSemana: snake_case

function slide1(pptx, { camionesSemana, ensayosSemana, fechaDesde, fechaHasta }) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORES.blanco };

  addHeader(slide, `Control de Calidad Hormigón — Semana ${rangoTitulo(fechaDesde, fechaHasta)}`);

  const volTotal   = camionesSemana.reduce((s, c) => s + (parseFloat(c.volumen) || 0), 0);
  const g20plus    = camionesSemana.filter(c => c.tipoHormigon && c.tipoHormigon !== 'G5');
  const g20conCono = g20plus.filter(c => c.cono != null && c.cono !== '').length;
  const cobertura  = g20plus.length > 0 ? Math.round((g20conCono / g20plus.length) * 100) : 0;

  // 4 KPIs estándar en fila
  const KPI_W  = (W - 0.6 - 0.15 * 3) / 4;
  const KPI_GAP = 0.15;
  const KPI_X0  = 0.3;
  const KPI_Y  = 0.85;
  const KPI_H  = 1.1;

  addKpi(slide, KPI_X0,                     KPI_Y, KPI_W, KPI_H, camionesSemana.length,       'Camiones recibidos');
  addKpi(slide, KPI_X0 + (KPI_W + KPI_GAP), KPI_Y, KPI_W, KPI_H, `${volTotal.toFixed(1)} m³`, 'Volumen hormigonado');
  addKpi(slide, KPI_X0 + (KPI_W + KPI_GAP) * 2, KPI_Y, KPI_W, KPI_H, `${cobertura}%`,         'Cobertura cono');
  addKpi(slide, KPI_X0 + (KPI_W + KPI_GAP) * 3, KPI_Y, KPI_W, KPI_H, ensayosSemana.length,    'Muestras laboratorio');

  // Mapa guia → laboratorio desde ensayosSemana (snake_case)
  const labPorGuia = {};
  for (const e of ensayosSemana) {
    if (e.numero_guia != null) labPorGuia[String(e.numero_guia)] = e.laboratorio ?? '';
  }

  const headers = [
    { text: 'Guía',        options: TH() },
    { text: 'Fecha',       options: TH() },
    { text: 'Planta',      options: TH() },
    { text: 'Grado',       options: TH() },
    { text: 'Elemento',    options: TH() },
    { text: 'Tramo',       options: TH() },
    { text: 'Cono (cm)',   options: TH() },
    { text: 'PU (kg/m³)',  options: TH() },
    { text: 'Observación', options: TH({ align: 'left' }) },
  ];

  const filas = camionesSemana.map((c, i) => {
    const alt = i % 2 === 1;
    const lab = labPorGuia[String(c.numeroGuia ?? '')] ?? null;
    return [
      { text: fmt(c.numeroGuia),          options: TD(alt) },
      { text: fmtFecha(c.fechaRecepcion), options: TD(alt) },
      { text: c.planta       || '—',      options: TD(alt) },
      { text: c.tipoHormigon || '—',      options: TD(alt) },
      { text: c.usoHormigon  || '—',      options: TD(alt) },
      { text: entidadLabelCamel(c),       options: TD(alt) },
      { text: fmt(c.cono),                options: TD(alt) },
      { text: fmt(c.puCalculado),         options: TD(alt) },
      { text: lab ? `Muestra: ${lab}` : '', options: TD(alt, { align: 'left' }) },
    ];
  });

  if (filas.length === 0) {
    filas.push([{
      text: 'Sin camiones en el período seleccionado',
      options: { ...TD(false, { align: 'center' }), colspan: 9 },
    }]);
  }

  slide.addTable([headers, ...filas], {
    x: 0.3, y: 2.1, w: W - 0.6, rowH: 0.26,
    border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
  });

  slide.addText('G5 = hormigón de emplantillado, sin control de cono ni PU · Cono objetivo 8 cm ± 2 cm', {
    x: 0.3, y: H - 0.32, w: W - 0.6, h: 0.28,
    fontSize: 8, italic: true, color: COLORES.grisTexto, fontFace: FUENTE, valign: 'middle',
  });
}

// ── LÁMINA 2 — Acumulado consolidado ─────────────────────────────────────────
// camiones: camelCase (array completo)

function slide2(pptx, { camiones, fechaDesde, fechaHasta }) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORES.blanco };

  addHeader(slide, `Control de Calidad Hormigón — Acumulado ${rangoTitulo(fechaDesde, fechaHasta)}`);

  const INICIO_PU = '2026-05-21';
  const volTotal  = camiones.reduce((s, c) => s + (parseFloat(c.volumen) || 0), 0);
  const g20plus   = camiones.filter(c => c.tipoHormigon && c.tipoHormigon !== 'G5');
  const g20conCono = g20plus.filter(c => c.cono != null && c.cono !== '');
  const volG20    = g20plus.reduce((s, c) => s + (parseFloat(c.volumen) || 0), 0);
  const cobertura = g20plus.length > 0 ? Math.round((g20conCono.length / g20plus.length) * 100) : 0;

  const g20mayo     = g20plus.filter(c => (c.fechaRecepcion ?? '') >= INICIO_PU);
  const g20mayoCono = g20mayo.filter(c => c.cono != null && c.cono !== '');
  const cobMayo     = g20mayo.length > 0 ? Math.round((g20mayoCono.length / g20mayo.length) * 100) : 0;

  // ── Zona 1: 6 KPIs compactos en fila única (y: 1.4, h: 1.2) ─────────────
  const KPI_W   = 1.55;
  const KPI_H   = 1.2;
  const KPI_Y   = 1.4;
  const KPI_GAP = (W - 0.6 - KPI_W * 6) / 5; // espaciado automático

  const kpiXs = Array.from({ length: 6 }, (_, i) => 0.3 + i * (KPI_W + KPI_GAP));

  addKpiCompact(slide, kpiXs[0], KPI_Y, KPI_W, KPI_H, camiones.length,             'Total camiones');
  addKpiCompact(slide, kpiXs[1], KPI_Y, KPI_W, KPI_H, `${volTotal.toFixed(1)} m³`, 'Total m³');
  addKpiCompact(slide, kpiXs[2], KPI_Y, KPI_W, KPI_H, g20plus.length,              'Camiones G20+');
  addKpiCompact(slide, kpiXs[3], KPI_Y, KPI_W, KPI_H, `${volG20.toFixed(1)} m³`,   'm³ G20+');
  addKpiCompact(slide, kpiXs[4], KPI_Y, KPI_W, KPI_H, `${cobertura}%`,             'Cobertura cono total');
  addKpiCompact(slide, kpiXs[5], KPI_Y, KPI_W, KPI_H, `${cobMayo}%`,              'Cobertura cono mayo');

  // ── Zona 2: Tablas lado a lado (y: 2.8, h: 1.6) ─────────────────────────
  const TAB_Y  = 2.8;
  const TAB_TH = 0.26;
  const ROW_H  = 0.28;

  // Tabla cono — izquierda
  slide.addText('Control de Cono — G20+', {
    x: 0.3, y: TAB_Y, w: 4.5, h: TAB_TH,
    fontSize: 10, bold: true, color: COLORES.acento, fontFace: FUENTE, valign: 'middle',
  });
  const hCono = [
    { text: 'Planta',        options: TH({ align: 'left' }) },
    { text: 'N',             options: TH() },
    { text: 'Promedio (cm)', options: TH() },
    { text: 'σ',             options: TH() },
    { text: 'CV (%)',        options: TH() },
  ];
  const rCono = PLANTAS.map((planta, i) => {
    const vals = g20conCono
      .filter(c => c.planta === planta)
      .map(c => parseFloat(c.cono))
      .filter(v => !isNaN(v));
    const st  = calcStats(vals);
    const cv  = (st.promedio && st.sigma != null)
      ? `${((st.sigma / st.promedio) * 100).toFixed(1)}%` : '—';
    const alt = i % 2 === 1;
    return [
      { text: planta,                                         options: TD(alt, { align: 'left' }) },
      { text: String(st.n),                                  options: TD(alt) },
      { text: st.promedio != null ? `${st.promedio}` : '—', options: TD(alt) },
      { text: st.sigma    != null ? `${st.sigma}`    : '—', options: TD(alt) },
      { text: cv,                                            options: TD(alt) },
    ];
  });
  slide.addTable([hCono, ...rCono], {
    x: 0.3, y: TAB_Y + TAB_TH + 0.04, w: 4.5, rowH: ROW_H,
    border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
  });

  // Tabla PU — derecha
  const g20pu = g20plus.filter(c =>
    c.puCalculado != null && c.puCalculado !== '' &&
    (c.fechaRecepcion ?? '') >= INICIO_PU
  );
  slide.addText('Control de Peso Unitario — G20+', {
    x: 5.1, y: TAB_Y, w: 4.5, h: TAB_TH,
    fontSize: 10, bold: true, color: COLORES.acento, fontFace: FUENTE, valign: 'middle',
  });
  const hPU = [
    { text: 'Planta',           options: TH({ align: 'left' }) },
    { text: 'N',                options: TH() },
    { text: 'Prom. (kg/m³)',    options: TH() },
    { text: 'σ',                options: TH() },
    { text: 'CV (%)',           options: TH() },
  ];
  const rPU = PLANTAS.map((planta, i) => {
    const vals = g20pu
      .filter(c => c.planta === planta)
      .map(c => parseFloat(c.puCalculado))
      .filter(v => !isNaN(v));
    const st  = calcStats(vals);
    const cv  = (st.promedio && st.sigma != null)
      ? `${((st.sigma / st.promedio) * 100).toFixed(1)}%` : '—';
    const alt = i % 2 === 1;
    return [
      { text: planta,                                         options: TD(alt, { align: 'left' }) },
      { text: String(st.n),                                  options: TD(alt) },
      { text: st.promedio != null ? `${st.promedio}` : '—', options: TD(alt) },
      { text: st.sigma    != null ? `${st.sigma}`    : '—', options: TD(alt) },
      { text: cv,                                            options: TD(alt) },
    ];
  });
  slide.addTable([hPU, ...rPU], {
    x: 5.1, y: TAB_Y + TAB_TH + 0.04, w: 4.5, rowH: ROW_H,
    border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
  });

  // ── Zona 3: Gráficos (y: 4.6, h: 2.8) ───────────────────────────────────

  // Datos para el gráfico de barras apiladas
  const mesSet = new Set();
  for (const c of camiones) {
    const mes = (c.fechaRecepcion ?? '').slice(0, 7);
    if (mes) mesSet.add(mes);
  }
  const mesesKey   = [...mesSet].sort();
  const mesesLabel = mesesKey.map(m => {
    const [y, mon] = m.split('-');
    return `${MESES_ES[parseInt(mon, 10) - 1]} ${y}`;
  });

  const barData = TIPOS_BAR.map(tipo => ({
    name: tipo,
    labels: mesesLabel,
    values: mesesKey.map(mes =>
      +camiones
        .filter(c => c.tipoHormigon === tipo && (c.fechaRecepcion ?? '').startsWith(mes))
        .reduce((s, c) => s + (parseFloat(c.volumen) || 0), 0)
        .toFixed(1)
    ),
  }));

  // valAxisMaxVal dinámico
  const totalesMensuales = mesesKey.map(mes =>
    TIPOS_BAR.reduce((s, tipo) =>
      s + camiones
        .filter(c => c.tipoHormigon === tipo && (c.fechaRecepcion ?? '').startsWith(mes))
        .reduce((a, c) => a + (parseFloat(c.volumen) || 0), 0),
      0
    )
  );
  const maxMensual    = Math.max(...totalesMensuales, 1);
  const valAxisMaxVal = Math.ceil(maxMensual * 1.15 / 10) * 10;

  slide.addChart('bar', barData, {
    x: 0.2, y: 4.6, w: 5.8, h: 2.8,
    barGrouping: 'stacked',
    chartColors: ['9CA3AF', 'D97706', 'B45309', '78350F'],
    showValue: true, dataLabelPosition: 'ctr', dataLabelFontSize: 7,
    showLegend: true, legendPos: 'b', legendFontSize: 9,
    valAxisLabelFontSize: 9, catAxisLabelFontSize: 9,
    valAxisMaxVal,
    valGridLine: { style: 'none' },
    catGridLine: { style: 'none' },
    showTitle: true, title: 'Volumen mensual por tipo (m³)', titleFontSize: 10,
  });

  // Datos para la dona
  const donutData = [{
    name: 'Distribución',
    labels: PLANTAS,
    values: PLANTAS.map(planta =>
      +camiones
        .filter(c => c.planta === planta)
        .reduce((s, c) => s + (parseFloat(c.volumen) || 0), 0)
        .toFixed(1)
    ),
  }];

  slide.addChart('doughnut', donutData, {
    x: 6.2, y: 4.6, w: 3.5, h: 2.8,
    chartColors: ['64FFDA', 'F59E0B', '818CF8'],
    showLabel: false, showPercent: true, dataLabelFontSize: 9,
    showLegend: true, legendPos: 'b', legendFontSize: 9,
    showTitle: true, title: 'Distribución por planta (m³)', titleFontSize: 10,
    holeSize: 50,
  });
}

// ── LÁMINA 3 — Ensayos de laboratorio ────────────────────────────────────────
// ensayos / ensayosSemana: snake_case (raw Supabase con join camiones)

function slide3(pptx, { ensayos, ensayosSemana }) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORES.blanco };

  addHeader(slide, 'Control de Calidad Hormigón — Ensayos de Laboratorio');

  slide.addText('Laboratorio Pampa Austral / Labotec | Feb–Jul 2026', {
    x: 0.3, y: 0.75, w: W - 0.6, h: 0.35,
    fontSize: 11, color: COLORES.grisTexto, fontFace: FUENTE, valign: 'middle',
  });

  const total    = ensayos.length;
  const conR28   = ensayos.filter(e => e.r28 != null).length;
  const cumple   = ensayos.filter(e => {
    if (e.r28 == null) return false;
    const min = RESISTENCIA_MIN[e.camiones?.tipo_hormigon] ?? null;
    return min == null || e.r28 >= min;
  }).length;
  const pct      = conR28 > 0 ? Math.round((cumple / conR28) * 100) : null;
  const enEspera = ensayos.filter(e => e.r28 == null).length;

  const KPI_W  = (W - 0.6 - 0.15 * 3) / 4;
  const KPI_GAP = 0.15;
  const KPI_X0  = 0.3;
  const KPI_Y  = 1.2;
  const KPI_H  = 1.0;

  addKpi(slide, KPI_X0,                      KPI_Y, KPI_W, KPI_H, total,                          'Total muestras');
  addKpi(slide, KPI_X0 + (KPI_W + KPI_GAP),  KPI_Y, KPI_W, KPI_H, conR28,                         'Con R28 disponible');
  addKpi(slide, KPI_X0 + (KPI_W + KPI_GAP)*2, KPI_Y, KPI_W, KPI_H, pct != null ? `${pct}%` : '—', '% cumplimiento R28');
  addKpi(slide, KPI_X0 + (KPI_W + KPI_GAP)*3, KPI_Y, KPI_W, KPI_H, enEspera,                      'En espera de resultados');

  // ── Nuevos ensayos semana ─────────────────────────────────────────────────
  const SEC1_Y = 2.4;
  slide.addText('Nuevos ensayos — semana', {
    x: 0.3, y: SEC1_Y, w: W - 0.6, h: 0.28,
    fontSize: 11, bold: true, color: COLORES.acento, fontFace: FUENTE, valign: 'middle',
  });

  let sec1Height = 0.35;

  if (ensayosSemana.length === 0) {
    slide.addText('Sin nuevos ensayos esta semana', {
      x: 0.3, y: SEC1_Y + 0.3, w: W - 0.6, h: 0.3,
      fontSize: 9, italic: true, color: COLORES.grisTexto, fontFace: FUENTE, valign: 'middle',
    });
  } else {
    const hSem = [
      { text: 'Guía',        options: TH() },
      { text: 'Entidad',     options: TH() },
      { text: 'Laboratorio', options: TH() },
      { text: 'R7 (MPa)',    options: TH() },
      { text: 'R28 (MPa)',   options: TH() },
      { text: 'Estado',      options: TH() },
    ];
    const rSem = ensayosSemana.map((e, i) => {
      const alt = i % 2 === 1;
      return [
        { text: fmt(e.numero_guia),    options: TD(alt) },
        { text: entidadLabelEnsayo(e), options: TD(alt) },
        { text: e.laboratorio || '—',  options: TD(alt) },
        { text: fmt(e.r7, ' MPa'),     options: TD(alt) },
        { text: fmt(e.r28, ' MPa'),    options: TD(alt) },
        { text: estadoEnsayo(e),       options: TD(alt) },
      ];
    });
    slide.addTable([hSem, ...rSem], {
      x: 0.3, y: SEC1_Y + 0.3, w: W - 0.6, rowH: 0.26,
      border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
    });
    sec1Height = 0.32 + (ensayosSemana.length + 1) * 0.27;
  }

  // ── En espera de resultados ───────────────────────────────────────────────
  const pendientes = ensayos
    .filter(e => e.r28 == null)
    .map(e => ({ ...e, _dias: diasDesde(e.fecha_muestreo) ?? 0 }))
    .sort((a, b) => b._dias - a._dias);

  const SEC2_Y = SEC1_Y + 0.3 + sec1Height + 0.2;

  slide.addText('En espera de resultados', {
    x: 0.3, y: SEC2_Y, w: W - 0.6, h: 0.28,
    fontSize: 11, bold: true, color: COLORES.acento, fontFace: FUENTE, valign: 'middle',
  });

  if (pendientes.length === 0) {
    slide.addText('Sin ensayos pendientes', {
      x: 0.3, y: SEC2_Y + 0.3, w: W - 0.6, h: 0.3,
      fontSize: 9, italic: true, color: COLORES.grisTexto, fontFace: FUENTE, valign: 'middle',
    });
  } else {
    const hPend = [
      { text: 'Guía',               options: TH() },
      { text: 'Entidad',            options: TH() },
      { text: 'Laboratorio',        options: TH() },
      { text: 'Fecha muestreo',     options: TH() },
      { text: 'Días transcurridos', options: TH() },
    ];
    const rPend = pendientes.map((e, i) => {
      const alt  = i % 2 === 1;
      const err  = e._dias >= 28;
      const opts = err ? TD_ERR(alt) : TD(alt);
      return [
        { text: fmt(e.numero_guia),         options: opts },
        { text: entidadLabelEnsayo(e),      options: opts },
        { text: e.laboratorio || '—',       options: opts },
        { text: fmtFecha(e.fecha_muestreo), options: opts },
        { text: String(e._dias),            options: opts },
      ];
    });
    slide.addTable([hPend, ...rPend], {
      x: 0.3, y: SEC2_Y + 0.3, w: W - 0.6, rowH: 0.26,
      border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
    });
  }
}

// ── LÁMINA 4 — Evolución R28 ──────────────────────────────────────────────────
// ensayos: snake_case

function slide4(pptx, { ensayos }) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORES.blanco };

  addHeader(slide, 'Control de Calidad Hormigón — Evolución R28');

  slide.addText('Laboratorio Pampa Austral / Labotec | Compresión G20', {
    x: 0.3, y: 0.75, w: W - 0.6, h: 0.35,
    fontSize: 11, color: COLORES.grisTexto, fontFace: FUENTE, valign: 'middle',
  });

  const ensayosR28 = [...ensayos]
    .filter(e => e.r28 != null)
    .sort((a, b) => (a.fecha_muestreo ?? '') < (b.fecha_muestreo ?? '') ? -1 : 1);

  if (ensayosR28.length === 0) {
    slide.addText('Sin datos R28 disponibles', {
      x: 0.3, y: 3.0, w: W - 0.6, h: 0.5,
      fontSize: 13, italic: true, color: COLORES.grisTexto,
      fontFace: FUENTE, align: 'center', valign: 'middle',
    });
    return;
  }

  const lineLabels = ensayosR28.map((_, i) => `M-${String(i + 1).padStart(2, '0')}`);
  const lineData = [
    {
      name:   'R28 (MPa)',
      labels: lineLabels,
      values: ensayosR28.map(e => e.r28),
    },
    {
      name:   'Mínimo G20 (20 MPa)',
      labels: lineLabels,
      values: Array(ensayosR28.length).fill(20),
    },
  ];

  slide.addChart('line', lineData, {
    x: 0.3, y: 1.8, w: 9.1, h: 4.5,
    chartColors: ['C0622A', 'AAAAAA'],
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 6,
    showValue: true, dataLabelFontSize: 7, dataLabelPosition: 't',
    showLegend: true, legendPos: 'b', legendFontSize: 9,
    valAxisMinVal: 15, valAxisMaxVal: 35,
    showTitle: true, title: 'Evolución R28 (MPa)', titleFontSize: 10,
    lineSize: 1.5,
    valAxisLabelFontSize: 9,
    catAxisLabelFontSize: 8,
  });

  // Estadísticas G20
  const g20r28Vals = ensayosR28
    .filter(e => e.camiones?.tipo_hormigon === 'G20')
    .map(e => e.r28);
  const statsG20 = calcStats(g20r28Vals);
  const minR28   = g20r28Vals.length > 0 ? Math.min(...g20r28Vals) : null;
  const maxR28   = g20r28Vals.length > 0 ? Math.max(...g20r28Vals) : null;

  const statsText = statsG20.promedio != null
    ? `G20:  x̅ = ${statsG20.promedio} MPa  │  σ = ${statsG20.sigma} MPa  │  Mín. ${minR28} MPa  │  Máx. ${maxR28} MPa  │  Requisito mínimo: 20 MPa  ✓`
    : 'Sin datos R28 G20 suficientes para estadísticas';

  slide.addText(statsText, {
    x: 0.3, y: 6.5, w: 9.5, h: 0.38,
    fontSize: 10, color: COLORES.negro, fontFace: FUENTE,
    valign: 'middle', align: 'left',
    bold: false,
  });
}

// ── Export principal ──────────────────────────────────────────────────────────

export async function generarPPT({ camiones, ensayos, fechaDesde, fechaHasta, camionesSemana, ensayosSemana }) {
  const pptx = new pptxgen();
  pptx.layout  = 'LAYOUT_WIDE';
  pptx.author  = 'Canal Arauco';
  pptx.subject = 'Control de Calidad Hormigón';

  slide1(pptx, { camionesSemana, ensayosSemana, fechaDesde, fechaHasta });
  slide2(pptx, { camiones, fechaDesde, fechaHasta });
  slide3(pptx, { ensayos, ensayosSemana });
  slide4(pptx, { ensayos });

  const fd = (fechaDesde && fechaDesde !== '—') ? fechaDesde : 'inicio';
  const fh = (fechaHasta && fechaHasta !== '—') ? fechaHasta : 'hoy';
  await pptx.writeFile({ fileName: `Control_Calidad_${fd}_${fh}` });
}
