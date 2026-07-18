import pptxgen from 'pptxgenjs';

const COLORES = {
  header:    '7B3F1E',
  acento:    'C0622A',
  blanco:    'FFFFFF',
  gris:      'F5F5F5',
  grisTexto: '666666',
  negro:     '1C1C1C',
  verdeOk:   '2E7D32',
};

const FUENTE = 'Calibri';

// LAYOUT_WIDE = 13.33 x 7.5 pulgadas (16:9)
const W = 13.33;
const H = 7.5;

const PLANTAS = ['Membrillar', 'Quilanco', 'Río San Martín'];
const RESISTENCIA_MIN = { G20: 20, G25: 25, G30: 30 };
const NOMBRES_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function diasDesde(fecha) {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24));
}

function calcStats(valores) {
  const n = valores.length;
  if (n === 0) return { n: 0, promedio: null, sigma: null };
  const avg = valores.reduce((a, b) => a + b, 0) / n;
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

function entidadLabel(tipoEntidad, entidadId) {
  if (!tipoEntidad) return '—';
  return `${NOMBRES_TIPO[tipoEntidad] ?? tipoEntidad} ${entidadId ?? ''}`.trim();
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

// ── Elementos base ────────────────────────────────────────────────────────────

function addHeader(slide, texto) {
  slide.addShape(pptxgen.shapes.RECTANGLE, {
    x: 0, y: 0, w: W, h: 0.71,
    fill: { color: COLORES.header },
    line: { color: COLORES.header, pt: 0 },
  });
  slide.addText(texto, {
    x: 0.3, y: 0, w: W - 0.6, h: 0.71,
    fontSize: 16, bold: true, color: COLORES.blanco,
    fontFace: FUENTE, valign: 'middle',
  });
}

function addKpi(slide, x, y, w, h, valor, label) {
  slide.addShape(pptxgen.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: COLORES.blanco },
    line: { color: 'DDDDDD', pt: 1 },
  });
  slide.addShape(pptxgen.shapes.RECTANGLE, {
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

function kpiLayout(n = 4) {
  const GAP = 0.15;
  const X0  = 0.3;
  const W_  = (W - X0 * 2 - GAP * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => X0 + i * (W_ + GAP));
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

function slide1(pptx, { camionesSemana, ensayosSemana, fechaDesde, fechaHasta }) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORES.blanco };

  addHeader(slide, `Control de Calidad Hormigón — Semana ${fechaDesde} al ${fechaHasta}`);

  const volTotal     = camionesSemana.reduce((s, c) => s + (parseFloat(c.volumen) || 0), 0);
  const g20plus      = camionesSemana.filter(c => c.tipo_hormigon && c.tipo_hormigon !== 'G5');
  const g20conCono   = g20plus.filter(c => c.cono != null).length;
  const cobertura    = g20plus.length > 0 ? Math.round((g20conCono / g20plus.length) * 100) : 0;

  const KPI_Y = 0.85;
  const KPI_H = 1.1;
  const KPI_W = (W - 0.6 - 0.15 * 3) / 4;
  const xs    = kpiLayout(4);

  addKpi(slide, xs[0], KPI_Y, KPI_W, KPI_H, camionesSemana.length,       'Camiones recibidos');
  addKpi(slide, xs[1], KPI_Y, KPI_W, KPI_H, `${volTotal.toFixed(1)} m³`,  'Volumen hormigonado');
  addKpi(slide, xs[2], KPI_Y, KPI_W, KPI_H, `${cobertura}%`,              'Cobertura cono');
  addKpi(slide, xs[3], KPI_Y, KPI_W, KPI_H, ensayosSemana.length,         'Muestras laboratorio');

  // Mapa guia → laboratorio desde ensayosSemana
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
    const lab = labPorGuia[String(c.numero_guia ?? '')] ?? null;
    return [
      { text: fmt(c.numero_guia),                              options: TD(alt) },
      { text: fmtFecha(c.fecha_recepcion),                     options: TD(alt) },
      { text: c.planta        || '—',                          options: TD(alt) },
      { text: c.tipo_hormigon || '—',                          options: TD(alt) },
      { text: c.uso_hormigon  || '—',                          options: TD(alt) },
      { text: entidadLabel(c.tipo_entidad, c.entidad_id),      options: TD(alt) },
      { text: fmt(c.cono),                                     options: TD(alt) },
      { text: fmt(c.pu_calculado),                             options: TD(alt) },
      { text: lab ? `Muestra: ${lab}` : '',                   options: TD(alt, { align: 'left' }) },
    ];
  });

  if (filas.length === 0) {
    filas.push([{ text: 'Sin camiones en el período seleccionado', options: { ...TD(false, { align: 'center' }), colspan: 9 } }]);
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

function slide2(pptx, { camiones, fechaDesde, fechaHasta }) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORES.blanco };

  addHeader(slide, `Control de Calidad Hormigón — Acumulado ${fechaDesde} al ${fechaHasta}`);

  const INICIO_PU = '2026-05-21';
  const g20plus     = camiones.filter(c => c.tipo_hormigon && c.tipo_hormigon !== 'G5');
  const g20conCono  = g20plus.filter(c => c.cono != null);
  const volG20      = g20plus.reduce((s, c) => s + (parseFloat(c.volumen) || 0), 0);
  const cobertura   = g20plus.length > 0 ? Math.round((g20conCono.length / g20plus.length) * 100) : 0;

  const g20mayo     = g20plus.filter(c => (c.fecha_recepcion ?? '') >= INICIO_PU);
  const g20mayoCono = g20mayo.filter(c => c.cono != null);
  const cobMayo     = g20mayo.length > 0 ? Math.round((g20mayoCono.length / g20mayo.length) * 100) : 0;

  const KPI_Y = 0.85;
  const KPI_H = 1.1;
  const KPI_W = (W - 0.6 - 0.15 * 3) / 4;
  const xs    = kpiLayout(4);

  addKpi(slide, xs[0], KPI_Y, KPI_W, KPI_H, g20plus.length,           'Total camiones G20+');
  addKpi(slide, xs[1], KPI_Y, KPI_W, KPI_H, `${volG20.toFixed(1)} m³`, 'Total m³ G20+');
  addKpi(slide, xs[2], KPI_Y, KPI_W, KPI_H, `${cobertura}%`,           'Cobertura cono total');
  addKpi(slide, xs[3], KPI_Y, KPI_W, KPI_H, `${cobMayo}%`,             'Cobertura cono mayo 2026');

  const COL_Y  = 2.15;
  const COL_TH = 0.3;
  const L_X    = 0.3;
  const L_W    = 6.2;
  const R_X    = 6.83;
  const R_W    = 6.2;

  // ── Tabla cono por planta ─────────────────────────────────────────────────
  slide.addText('Control de Cono — G20+', {
    x: L_X, y: COL_Y, w: L_W, h: COL_TH,
    fontSize: 11, bold: true, color: COLORES.acento, fontFace: FUENTE, valign: 'middle',
  });

  const hCono = [
    { text: 'Planta',        options: TH({ align: 'left' }) },
    { text: 'N',             options: TH() },
    { text: 'Promedio (cm)', options: TH() },
    { text: 'σ',             options: TH() },
    { text: 'CV (%)',        options: TH() },
  ];
  const rCono = PLANTAS.map((planta, i) => {
    const vals = g20conCono.filter(c => c.planta === planta).map(c => parseFloat(c.cono));
    const st   = calcStats(vals);
    const cv   = (st.promedio && st.sigma != null)
      ? `${((st.sigma / st.promedio) * 100).toFixed(1)}%` : '—';
    const alt  = i % 2 === 1;
    return [
      { text: planta,                                          options: TD(alt, { align: 'left' }) },
      { text: String(st.n),                                   options: TD(alt) },
      { text: st.promedio != null ? `${st.promedio}` : '—',  options: TD(alt) },
      { text: st.sigma    != null ? `${st.sigma}`    : '—',  options: TD(alt) },
      { text: cv,                                             options: TD(alt) },
    ];
  });
  slide.addTable([hCono, ...rCono], {
    x: L_X, y: COL_Y + COL_TH + 0.05, w: L_W, rowH: 0.32,
    border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
  });

  // ── Tabla PU por planta ───────────────────────────────────────────────────
  slide.addText('Control de Peso Unitario — G20+', {
    x: R_X, y: COL_Y, w: R_W, h: COL_TH,
    fontSize: 11, bold: true, color: COLORES.acento, fontFace: FUENTE, valign: 'middle',
  });

  const g20pu = g20plus.filter(c => c.pu_calculado != null && (c.fecha_recepcion ?? '') >= INICIO_PU);
  const hPU = [
    { text: 'Planta',            options: TH({ align: 'left' }) },
    { text: 'N',                 options: TH() },
    { text: 'Promedio (kg/m³)',  options: TH() },
    { text: 'σ',                 options: TH() },
    { text: 'CV (%)',            options: TH() },
  ];
  const rPU = PLANTAS.map((planta, i) => {
    const vals = g20pu.filter(c => c.planta === planta).map(c => parseFloat(c.pu_calculado));
    const st   = calcStats(vals);
    const cv   = (st.promedio && st.sigma != null)
      ? `${((st.sigma / st.promedio) * 100).toFixed(1)}%` : '—';
    const alt  = i % 2 === 1;
    return [
      { text: planta,                                          options: TD(alt, { align: 'left' }) },
      { text: String(st.n),                                   options: TD(alt) },
      { text: st.promedio != null ? `${st.promedio}` : '—',  options: TD(alt) },
      { text: st.sigma    != null ? `${st.sigma}`    : '—',  options: TD(alt) },
      { text: cv,                                             options: TD(alt) },
    ];
  });
  slide.addTable([hPU, ...rPU], {
    x: R_X, y: COL_Y + COL_TH + 0.05, w: R_W, rowH: 0.32,
    border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
  });

  slide.addText('Sin especificación contractual definida para PU', {
    x: R_X, y: COL_Y + COL_TH + 0.05 + 0.32 * 4 + 0.1, w: R_W, h: 0.28,
    fontSize: 8, italic: true, color: COLORES.grisTexto, fontFace: FUENTE, valign: 'middle',
  });
}

// ── LÁMINA 3 — Ensayos de laboratorio ────────────────────────────────────────

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
  const vencidos = ensayos.filter(e => e.r28 == null && (diasDesde(e.fecha_muestreo) ?? 0) >= 28).length;

  const KPI_Y = 1.2;
  const KPI_H = 1.0;
  const KPI_W = (W - 0.6 - 0.15 * 3) / 4;
  const xs    = kpiLayout(4);

  addKpi(slide, xs[0], KPI_Y, KPI_W, KPI_H, total,                    'Total muestras');
  addKpi(slide, xs[1], KPI_Y, KPI_W, KPI_H, conR28,                   'Con R28 disponible');
  addKpi(slide, xs[2], KPI_Y, KPI_W, KPI_H, pct != null ? `${pct}%` : '—', '% cumplimiento R28');
  addKpi(slide, xs[3], KPI_Y, KPI_W, KPI_H, vencidos,                 'Pendientes vencidos');

  const entidad = (e) => entidadLabel(e.camiones?.tipo_entidad, e.camiones?.entidad_id);

  // ── Nuevos ensayos semana ─────────────────────────────────────────────────
  const SEC1_Y = 2.4;
  slide.addText('Nuevos ensayos — semana', {
    x: 0.3, y: SEC1_Y, w: W - 0.6, h: 0.28,
    fontSize: 11, bold: true, color: COLORES.acento, fontFace: FUENTE, valign: 'middle',
  });

  let sec1Height = 0.32;

  if (ensayosSemana.length === 0) {
    slide.addText('Sin nuevos ensayos esta semana', {
      x: 0.3, y: SEC1_Y + 0.3, w: W - 0.6, h: 0.3,
      fontSize: 9, italic: true, color: COLORES.grisTexto, fontFace: FUENTE, valign: 'middle',
    });
    sec1Height = 0.35;
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
        { text: fmt(e.numero_guia),   options: TD(alt) },
        { text: entidad(e),           options: TD(alt) },
        { text: e.laboratorio || '—', options: TD(alt) },
        { text: fmt(e.r7, ' MPa'),    options: TD(alt) },
        { text: fmt(e.r28, ' MPa'),   options: TD(alt) },
        { text: estadoEnsayo(e),      options: TD(alt) },
      ];
    });
    slide.addTable([hSem, ...rSem], {
      x: 0.3, y: SEC1_Y + 0.3, w: W - 0.6, rowH: 0.26,
      border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
    });
    sec1Height = 0.32 + (ensayosSemana.length + 1) * 0.27;
  }

  // ── Pendientes sin R28 ────────────────────────────────────────────────────
  const pendientes = ensayos
    .filter(e => e.r28 == null)
    .map(e => ({ ...e, _dias: diasDesde(e.fecha_muestreo) ?? 0 }))
    .sort((a, b) => b._dias - a._dias);

  const SEC2_Y = SEC1_Y + 0.3 + sec1Height + 0.2;

  slide.addText('Pendientes sin R28', {
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
        { text: fmt(e.numero_guia),           options: opts },
        { text: entidad(e),                   options: opts },
        { text: e.laboratorio || '—',         options: opts },
        { text: fmtFecha(e.fecha_muestreo),   options: opts },
        { text: String(e._dias),              options: opts },
      ];
    });
    slide.addTable([hPend, ...rPend], {
      x: 0.3, y: SEC2_Y + 0.3, w: W - 0.6, rowH: 0.26,
      border: { type: 'solid', color: 'DDDDDD', pt: 0.5 },
    });
  }
}

// ── Export principal ──────────────────────────────────────────────────────────

export async function generarPPT({ camiones, ensayos, fechaDesde, fechaHasta, camionesSemana, ensayosSemana }) {
  const pptx = new pptxgen();
  pptx.layout   = 'LAYOUT_WIDE';
  pptx.author   = 'Canal Arauco';
  pptx.subject  = 'Control de Calidad Hormigón';

  slide1(pptx, { camionesSemana, ensayosSemana, fechaDesde, fechaHasta });
  slide2(pptx, { camiones, fechaDesde, fechaHasta });
  slide3(pptx, { ensayos, ensayosSemana });

  const fd = fechaDesde ?? 'inicio';
  const fh = fechaHasta ?? 'hoy';
  await pptx.writeFile({ fileName: `Control_Calidad_${fd}_${fh}` });
}
