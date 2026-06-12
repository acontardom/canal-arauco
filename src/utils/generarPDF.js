import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/Logo_ExMaq.jpg';
import { PROTOCOLOS, CHECKLISTS, KM_DATA } from '../constants/estructura';

// ─── Nombres de protocolo para el encabezado PICE ─────────────────────────────
const NOMBRE_PICE = {
  PICE1: 'Movimiento de Tierras',
  PICE2_RADIER: 'Hormigones',
  PICE2_MURO: 'Hormigones',
  PICE3: 'Moldajes',
  PICE4_RADIER: 'Enfierradura',
  PICE4_MURO: 'Enfierradura',
  G5: 'Hormigones G-5',
  HA_RADIER: 'Control H.A.',
  HA_MURO: 'Control H.A.',
};

const NOMBRES_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

// ─── Textos fijos por protocolo ───────────────────────────────────────────────
const TEXTOS_PROTOCOLO = {
  PICE1: {
    nombreProtocolo: 'Movimiento de Tierras',
    objetivo:  'Verificar la correcta ejecución de las actividades de movimientos de tierra.',
    alcance:   'Aplica a las actividades de replanteo, excavación a máquina OOCC o GPS, Rellenos.',
    normativa: 'Planos del proyecto, Especificaciones Técnicas, PCdC y Procedimiento PR-CL-01.',
    procedimiento: [
      '1. Verificar PR de proyecto en terreno previo al inicio de la excavación.',
      '2. Verificar que el replanteo sea conforme a los planos del proyecto.',
      '3. Controlar cotas de excavación según niveles de proyecto.',
      '4. Verificar ancho de excavación según sección tipo.',
      '5. Controlar espesor de capas de relleno y compactación por capas.',
      '6. Registrar evidencia fotográfica de la actividad ejecutada.',
      '7. Otorgar aprobación para continuar con la etapa de hormigonado.',
    ],
    selector: null,
  },
  PICE2_RADIER: {
    nombreProtocolo: 'Hormigones',
    objetivo:  'Controlar la correcta colocación del hormigón.',
    alcance:   'Desde recepción hasta curado inicial.',
    normativa: 'NCh 170, NCh 1019, EETT',
    procedimiento: [
      '1. Verificación de elemento a hormigonar.',
      '2. Control de docilidad (cada 50m3).',
      '3. Registro de hora y volumen.',
      '4. Supervisión de vibrado.',
      '5. Inicio de curado.',
    ],
    selector: 'radier',
  },
  PICE2_MURO: {
    nombreProtocolo: 'Hormigones',
    objetivo:  'Controlar la correcta colocación del hormigón.',
    alcance:   'Desde recepción hasta curado inicial.',
    normativa: 'NCh 170, NCh 1019, EETT',
    procedimiento: [
      '1. Verificación de elemento a hormigonar.',
      '2. Control de docilidad (cada 50m3).',
      '3. Registro de hora y volumen.',
      '4. Supervisión de vibrado.',
      '5. Inicio de curado.',
    ],
    selector: 'muro',
  },
  PICE3: {
    nombreProtocolo: 'Moldajes',
    objetivo:  'Verificar condiciones previas al hormigonado.',
    alcance:   'Moldajes y superficies de contacto.',
    normativa: 'Especificaciones Técnicas, PCdC',
    procedimiento: [
      '1. Revisión de alineación y nivelación.',
      '2. Control de estanqueidad.',
      '3. Limpieza de moldajes.',
      '4. Revisión de condiciones de seguridad.',
      '5. Aprobación para hormigonado.',
    ],
    selector: 'ambos',
  },
  PICE4_RADIER: {
    nombreProtocolo: 'Enfierradura',
    objetivo:  'Verificar correcta instalación de armaduras previo al hormigonado.',
    alcance:   'Control de acero de refuerzo en partidas estructurales.',
    normativa: 'NCh 204, Planos estructurales, EETT',
    procedimiento: [
      '1. Revisión de planos estructurales.',
      '2. Verificación de diámetros y separación.',
      '3. Control de recubrimientos.',
      '4. Revisión de amarras y rigidez.',
      '5. Aprobación para hormigonado.',
    ],
    selector: 'radier',
  },
  PICE4_MURO: {
    nombreProtocolo: 'Enfierradura',
    objetivo:  'Verificar correcta instalación de armaduras previo al hormigonado.',
    alcance:   'Control de acero de refuerzo en partidas estructurales.',
    normativa: 'NCh 204, Planos estructurales, EETT',
    procedimiento: [
      '1. Revisión de planos estructurales.',
      '2. Verificación de diámetros y separación.',
      '3. Control de recubrimientos.',
      '4. Revisión de amarras y rigidez.',
      '5. Aprobación para hormigonado.',
    ],
    selector: 'muro',
  },
  G5: {
    nombreProtocolo: 'Hormigones G-5',
    objetivo: '',
    alcance: '',
    normativa: '',
    procedimiento: [],
    selector: null,
  },
  HA_RADIER: {
    nombreProtocolo: 'Control H.A.',
    objetivo:  'Controlar los parámetros de calidad del hormigón en cada camión mixer.',
    alcance:   'Aplica al control de cada camión: cono, temperatura, tiempo de traslado y peso unitario.',
    normativa: 'NCh 170, NCh 1019, NCh 1934, EETT.',
    procedimiento: [
      'Recepcionar camión mixer y verificar guía de despacho.',
      'Controlar cono de asentamiento del hormigón.',
      'Controlar temperatura del hormigón y temperatura ambiente.',
      'Controlar tiempo de traslado desde planta a obra.',
      'Realizar ensayo de peso unitario del hormigón.',
      'Registrar descarga y evidencia fotográfica del camión.',
    ],
    selector: 'radier',
  },
  HA_MURO: {
    nombreProtocolo: 'Control H.A.',
    objetivo:  'Controlar los parámetros de calidad del hormigón en cada camión mixer.',
    alcance:   'Aplica al control de cada camión: cono, temperatura, tiempo de traslado y peso unitario.',
    normativa: 'NCh 170, NCh 1019, NCh 1934, EETT.',
    procedimiento: [
      'Recepcionar camión mixer y verificar guía de despacho.',
      'Controlar cono de asentamiento del hormigón.',
      'Controlar temperatura del hormigón y temperatura ambiente.',
      'Controlar tiempo de traslado desde planta a obra.',
      'Realizar ensayo de peso unitario del hormigón.',
      'Registrar descarga y evidencia fotográfica del camión.',
    ],
    selector: 'muro',
  },
};

// ─── Layout constants (A4 mm) ─────────────────────────────────────────────────
const PW = 210;   // page width
const PH = 297;   // page height
const ML = 14;    // margin left
const MR = 14;    // margin right
const CW = PW - ML - MR; // content width = 182mm

// El pie de firma se dibuja pegado debajo del último contenido (startY:
// finalY + PIE_FIRMA_GAP), no a una posición fija al fondo de página.
const PIE_FIRMA_GAP = 8;  // mm de separación entre el contenido y el pie de firma
const PIE_FIRMA_H = 29;   // alto aprox. del pie de firma (4 filas)
const CONTENT_MARGIN = { top: 10, bottom: 10 }; // margen de autotable (sin reserva fija de pie)

// Tipografía/espaciado normal y reducido (si el contenido no cabe en una página)
const ESCALA_NORMAL = { fontSize: 8, headFontSize: 9, cellPadding: 2 };
const ESCALA_REDUCIDA = { fontSize: 7.5, headFontSize: 8.5, cellPadding: 1.5 };

// Resuelve los KM reales: usa los pasados (Configuración) si existen, si no cae a KM_DATA
function resolveKm(protocolo, kmInicio, kmFin) {
  if (kmInicio || kmFin) return { inicio: kmInicio, fin: kmFin };
  const datos = KM_DATA[protocolo.tipo]?.[String(protocolo.entidadId)];
  return { inicio: datos?.inicio ?? '', fin: datos?.fin ?? '' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadLogoB64() {
  try {
    const resp = await fetch(logoUrl);
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fmt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function fmtArchivo(iso) {
  if (!iso) return 'sin_fecha';
  const d = new Date(iso);
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function detectFormat(dataUrl) {
  const m = /^data:image\/(\w+);/.exec(dataUrl ?? '');
  const ext = m?.[1]?.toLowerCase();
  if (ext === 'png') return 'PNG';
  if (ext === 'webp') return 'WEBP';
  return 'JPEG';
}

function blobToDataUrl(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Resuelve la imagen de una foto a embeber: si tiene storage_url se descarga
// desde la URL pública, si no se usa el dataUrl directamente.
async function obtenerImagenBase64(foto) {
  if (foto.storageUrl) {
    try {
      const resp = await fetch(foto.storageUrl);
      const blob = await resp.blob();
      const dataUrl = await blobToDataUrl(blob);
      return { dataUrl, formato: detectFormat(dataUrl) };
    } catch (err) {
      console.warn('[PDF] Error al descargar foto desde storage:', err?.message ?? err);
    }
  }
  if (foto.dataUrl) return { dataUrl: foto.dataUrl, formato: detectFormat(foto.dataUrl) };
  return null;
}

// ─── Encabezado ───────────────────────────────────────────────────────────────

function agregarEncabezado(doc, protocolo, paginaActual, totalPaginas, kmInicio, kmFin, logoB64) {
  const meta = PROTOCOLOS.find(p => p.id === protocolo.protocoloId);
  const nombreProtocolo = NOMBRE_PICE[protocolo.protocoloId] ?? meta?.nombre ?? protocolo.protocoloId;

  const TOP = 8;
  const LOGO_W = 30;
  const LOGO_H = 18;
  const GAP = 2;
  const TABLE_X = ML + LOGO_W + GAP;
  const TABLE_W = CW - LOGO_W - GAP;

  // Logo
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(ML, TOP, LOGO_W, LOGO_H);
  if (logoB64) {
    try { doc.addImage(logoB64, 'JPEG', ML + 1, TOP + 1, LOGO_W - 2, LOGO_H - 2); }
    catch { /* logo opcional */ }
  }

  const tituloDocumento = protocolo.protocoloId === 'G5'
    ? 'REGISTRO FOTOGRÁFICO G-5'
    : 'PROTOCOLO DE INSPECCIÓN Y CONTROL DE EJECUCIÓN (PICE)';

  // Tabla de información a la derecha
  autoTable(doc, {
    startY: TOP,
    margin: { left: TABLE_X, right: PW - TABLE_X - TABLE_W },
    tableWidth: TABLE_W,
    body: [
      [
        tituloDocumento,
        `FECHA: ${fmt(protocolo.fechaModificacion)}`,
      ],
      [
        'PROYECTO: Construcción Canal Siberia - Sección Los Litres',
        `PAGINA: ${paginaActual} de ${totalPaginas}`,
      ],
      [
        nombreProtocolo,
        `CÓDIGO DOCUMENTO: ${meta?.codigo ?? ''}`,
      ],
      [
        { content: `REGISTRO N°: ${protocolo.entidadId}    COMUNA: Yungay`, colSpan: 2 },
      ],
    ],
    columnStyles: {
      0: { cellWidth: 87 },
      1: { cellWidth: 58 },
    },
    styles: {
      fontSize: 7,
      cellPadding: 1,
      lineColor: [120, 120, 120],
      lineWidth: 0.2,
      textColor: [30, 30, 30],
      valign: 'middle',
    },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.row.index === 0 && data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign = 'center';
        data.cell.styles.fontSize = 7.5;
      }
      if (data.row.index === 2 && data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign = 'center';
      }
    },
  });

  const tableBottom = doc.lastAutoTable.finalY;
  return Math.max(TOP + LOGO_H, tableBottom) + 3;
}

// ─── Tabla info (página 1) ────────────────────────────────────────────────────

function agregarTablaInfo(doc, protocolo, y, kmInicio, kmFin, escala = ESCALA_NORMAL) {
  const textos = TEXTOS_PROTOCOLO[protocolo.protocoloId] ?? { objetivo: '', alcance: '', normativa: '', selector: null };
  const km = resolveKm(protocolo, kmInicio, kmFin);
  const entidad = `${NOMBRES_TIPO[protocolo.tipo] ?? protocolo.tipo} ${protocolo.entidadId}`;
  const actividad = `km: ${km.inicio || '—'} hasta ${km.fin || '—'} — Elemento: ${entidad}`;

  const AMARILLO = [255, 215, 0];
  const celdaSelector = (label, marcado) => marcado
    ? { content: label, styles: { fillColor: AMARILLO, fontStyle: 'bold', halign: 'center' } }
    : { content: label, styles: { halign: 'center' } };

  // Filas simples: la columna de valor abarca las 4 columnas restantes
  const filaTexto = (label, contenido) => [label, { content: contenido, colSpan: 4 }];

  const filaActividad = textos.selector
    ? [
        'Actividad / Partida',
        celdaSelector('Radier', textos.selector === 'radier' || textos.selector === 'ambos'),
        celdaSelector('Muro', textos.selector === 'muro' || textos.selector === 'ambos'),
        celdaSelector('Otro', false),
        actividad,
      ]
    : filaTexto('Actividad / Partida', actividad);

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR, ...CONTENT_MARGIN },
    tableWidth: CW,
    body: [
      filaTexto('Objetivo', textos.objetivo || ''),
      filaTexto('Alcance', textos.alcance || ''),
      filaTexto('Normativa Aplicable', textos.normativa || ''),
      filaActividad,
      filaTexto('Responsable', 'Encargado de Calidad / Administrador de Contrato'),
    ],
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold', fillColor: [240, 240, 240], fontSize: escala.headFontSize },
      1: { cellWidth: 12 },
      2: { cellWidth: 12 },
      3: { cellWidth: 12 },
      4: { cellWidth: CW - 45 - 36 },
    },
    styles: {
      fontSize: escala.fontSize,
      cellPadding: escala.cellPadding,
      lineColor: [120, 120, 120],
      lineWidth: 0.2,
      textColor: [30, 30, 30],
    },
    theme: 'grid',
  });

  return doc.lastAutoTable.finalY + 3;
}

// ─── Sección PROCEDIMIENTO (página 1) ─────────────────────────────────────────

function agregarProcedimiento(doc, protocolo, y, escala = ESCALA_NORMAL) {
  const pasos = TEXTOS_PROTOCOLO[protocolo.protocoloId]?.procedimiento ?? [];
  if (pasos.length === 0) return y;

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR, ...CONTENT_MARGIN },
    tableWidth: CW,
    head: [[
      { content: 'PROCEDIMIENTO', styles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: escala.headFontSize } },
    ]],
    body: pasos.map(paso => [paso]),
    columnStyles: {
      0: { cellWidth: CW, halign: 'center' },
    },
    styles: {
      fontSize: escala.fontSize,
      cellPadding: escala.cellPadding,
      lineColor: [120, 120, 120],
      lineWidth: 0.2,
      textColor: [30, 30, 30],
      fillColor: [255, 255, 255],
    },
    theme: 'grid',
  });

  return doc.lastAutoTable.finalY + 3;
}

// ─── Tabla PROTOCOLO DE CONTROL (página 1) ────────────────────────────────────

function agregarProtocoloControl(doc, protocolo, y, escala = ESCALA_NORMAL) {
  const items = CHECKLISTS[protocolo.protocoloId] ?? [];
  if (items.length === 0) return y;

  const checklist = protocolo.datos?.checklist ?? {};
  const observaciones = protocolo.datos?.observaciones ?? '';
  const AMARILLO = [255, 215, 0];

  const celda = (marcado, texto) => marcado
    ? { content: texto, styles: { fillColor: AMARILLO, fontStyle: 'bold', halign: 'center' } }
    : { content: '', styles: { halign: 'center' } };

  const body = items.map(item => {
    const entry = checklist[item.id];
    const valor = (entry && typeof entry === 'object') ? entry.valor : entry;
    const obs = (entry && typeof entry === 'object') ? (entry.obs ?? '') : '';

    return [
      item.label,
      celda(valor === 'si', 'SI'),
      celda(valor === 'no', 'NO'),
      celda(valor === 'na', 'N/A'),
      obs,
    ];
  });

  body.push([
    { content: 'Comentarios u observaciones:', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
    { content: observaciones || '', colSpan: 4 },
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR, ...CONTENT_MARGIN },
    tableWidth: CW,
    head: [
      [{ content: 'PROTOCOLO DE CONTROL', colSpan: 5, styles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: escala.headFontSize } }],
      ['Ítem de Control', 'SI', 'NO', 'N/A', 'Observaciones'],
    ],
    body,
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: CW - 55 - 12 - 12 - 12 },
    },
    styles: {
      fontSize: escala.fontSize,
      cellPadding: escala.cellPadding,
      lineColor: [120, 120, 120],
      lineWidth: 0.2,
      textColor: [30, 30, 30],
    },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.section === 'head' && data.row.index === 1) {
        data.cell.styles.fillColor = [189, 195, 199];
        data.cell.styles.textColor = [30, 30, 30];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign = 'center';
        data.cell.styles.fontSize = escala.headFontSize;
      }
    },
  });

  return doc.lastAutoTable.finalY + 3;
}

// ─── Pie de firma ─────────────────────────────────────────────────────────────

// Tabla de pie de firma — unificada (4 filas), pageBreak:'avoid' evita que se
// divida entre páginas. Se dibuja pegada debajo del contenido (`startY`),
// nunca en una posición fija al fondo de página.
function agregarPieFirma(doc, startY) {
  const colW = CW / 3;

  autoTable(doc, {
    startY,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    body: [
      ['PAC', 'ITO', 'ADMINISTRADOR'],
      ['Diego Oñate Jorquera', 'Gonzalo Chavarría Sepúlveda', 'Marcelo Contardo Correa'],
      ['firma: _______________', 'firma: _______________', 'firma: _______________'],
      ['fecha: _______________', 'fecha: _______________', 'fecha: _______________'],
    ],
    columnStyles: {
      0: { cellWidth: colW },
      1: { cellWidth: colW },
      2: { cellWidth: colW },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [120, 120, 120],
      lineWidth: 0.2,
      textColor: [30, 30, 30],
      halign: 'center',
    },
    theme: 'grid',
    pageBreak: 'avoid',
    didParseCell: (data) => {
      if (data.row.index === 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });
}

// ─── Páginas de registro fotográfico ──────────────────────────────────────────

const FOTOS_POR_PAGINA = 4;
const FOTOS_POR_PAGINA_G5 = 2;

function fotosPorPagina(protocolo) {
  return protocolo.protocoloId === 'G5' ? FOTOS_POR_PAGINA_G5 : FOTOS_POR_PAGINA;
}

// Título de la página de fotos: incluye el identificador de la entidad para
// caídas y atraviesos, ya que un mismo informe puede agrupar varios elementos.
function tituloFotos(protocolo, km) {
  const kmTxt = `KM ${km.inicio || '—'} hasta KM ${km.fin || '—'}`;
  if (protocolo.tipo === 'caida') return `REGISTRO FOTOGRÁFICO — CAÍDA ${protocolo.entidadId} — ${kmTxt}`;
  if (protocolo.tipo === 'atravieso') return `REGISTRO FOTOGRÁFICO — ATRAVIESO ${protocolo.entidadId} — ${kmTxt}`;
  return `REGISTRO FOTOGRÁFICO — ${kmTxt}`;
}

async function agregarPaginaFotos(doc, protocolo, fotosBatch, paginaActual, totalPaginas, kmInicio, kmFin, logoB64) {
  let y = agregarEncabezado(doc, protocolo, paginaActual, totalPaginas, kmInicio, kmFin, logoB64);
  const km = resolveKm(protocolo, kmInicio, kmFin);

  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(tituloFotos(protocolo, km), PW / 2, y + 4, { align: 'center' });
  y += 10;

  const esG5 = protocolo.protocoloId === 'G5';
  const COLS = 2;
  const GAP = 4;
  const imgW = (CW - GAP) / COLS;
  const imgH = esG5 ? 110 : 65;
  const descH = 10;
  const cellH = imgH + descH + GAP;

  for (let i = 0; i < fotosBatch.length; i++) {
    const foto = fotosBatch[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = ML + col * (imgW + GAP);
    const cellY = y + row * cellH;

    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.2);
    doc.rect(x, cellY, imgW, imgH);

    const img = await obtenerImagenBase64(foto);
    if (img) {
      try { doc.addImage(img.dataUrl, img.formato, x + 1, cellY + 1, imgW - 2, imgH - 2); }
      catch (err) { console.warn('[PDF] Error al incrustar imagen:', err?.message ?? err); }
    }

    doc.rect(x, cellY + imgH, imgW, descH);
    if (foto.descripcion) {
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text(foto.descripcion, x + 2, cellY + imgH + 6, { maxWidth: imgW - 4 });
    }
  }

  const numRows = Math.ceil(fotosBatch.length / COLS);
  agregarPieFirma(doc, y + numRows * cellH + PIE_FIRMA_GAP);
}

// ─── Página 1 (info + procedimiento + protocolo de control) ──────────────────

// Orden estricto: encabezado → tabla info → procedimiento → protocolo de
// control. Devuelve la posición Y final del contenido (doc.lastAutoTable.finalY)
// para que el pie de firma se dibuje pegado debajo, sin saltos de página.
function construirPagina1(doc, protocolo, kmInicio, kmFin, totalPaginas, logoB64, escala = ESCALA_NORMAL) {
  let y = agregarEncabezado(doc, protocolo, 1, totalPaginas, kmInicio, kmFin, logoB64);
  y = agregarTablaInfo(doc, protocolo, y, kmInicio, kmFin, escala);
  y = agregarProcedimiento(doc, protocolo, y, escala);
  y = agregarProtocoloControl(doc, protocolo, y, escala);
  return doc.lastAutoTable.finalY;
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function generarPDF(protocolo, fotos = [], kmInicio = '', kmFin = '') {
  const meta = PROTOCOLOS.find(p => p.id === protocolo.protocoloId);
  const soloFotos = meta?.soloFotos === true;
  const logoB64 = await loadLogoB64();
  const fpp = fotosPorPagina(protocolo);

  const paginasFotos = Math.ceil(fotos.length / fpp);
  const totalPaginas = soloFotos ? Math.max(1, paginasFotos) : 1 + paginasFotos;

  let doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  if (soloFotos) {
    if (fotos.length === 0) {
      const y = agregarEncabezado(doc, protocolo, 1, totalPaginas, kmInicio, kmFin, logoB64);
      agregarPieFirma(doc, y + PIE_FIRMA_GAP);
    } else {
      for (let i = 0; i < fotos.length; i += fpp) {
        const paginaActual = i / fpp + 1;
        if (paginaActual > 1) doc.addPage();
        await agregarPaginaFotos(doc, protocolo, fotos.slice(i, i + fpp), paginaActual, totalPaginas, kmInicio, kmFin, logoB64);
      }
    }
  } else {
    // Construir página 1 con tipografía normal; si el contenido + pie de
    // firma no caben en una sola hoja A4, reconstruir con la escala reducida.
    let finalY = construirPagina1(doc, protocolo, kmInicio, kmFin, totalPaginas, logoB64, ESCALA_NORMAL);
    if (finalY + PIE_FIRMA_GAP + PIE_FIRMA_H > PH) {
      doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      finalY = construirPagina1(doc, protocolo, kmInicio, kmFin, totalPaginas, logoB64, ESCALA_REDUCIDA);
    }
    agregarPieFirma(doc, finalY + PIE_FIRMA_GAP);

    for (let i = 0; i < fotos.length; i += fpp) {
      doc.addPage();
      const paginaActual = 1 + i / fpp + 1;
      await agregarPaginaFotos(doc, protocolo, fotos.slice(i, i + fpp), paginaActual, totalPaginas, kmInicio, kmFin, logoB64);
    }
  }

  const entidadStr = String(protocolo.entidadId).replace(/\s+/g, '');
  const fechaStr = fmtArchivo(protocolo.fechaModificacion);
  doc.save(`${protocolo.protocoloId}_${entidadStr}_${fechaStr}.pdf`);
}
