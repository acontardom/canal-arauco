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
    objetivo:  'Verificar la correcta ejecución de las actividades de movimientos de tierra.',
    alcance:   'Aplica a las actividades de replanteo, excavación a máquina OOCC o GPS, Rellenos.',
    normativa: 'Planos del proyecto, Especificaciones Técnicas, PCdC y Procedimiento PR-CL-01.',
    procedimiento: [
      'Verificar PR de proyecto en terreno previo al inicio de la excavación.',
      'Verificar que el replanteo sea conforme a los planos del proyecto.',
      'Controlar cotas de excavación según niveles de proyecto.',
      'Verificar ancho de excavación según sección tipo.',
      'Controlar espesor de capas de relleno y compactación por capas.',
      'Registrar evidencia fotográfica de la actividad ejecutada.',
      'Otorgar aprobación para continuar con la etapa de hormigonado.',
    ],
  },
  PICE2_RADIER: {
    objetivo:  'Controlar la correcta colocación del hormigón.',
    alcance:   'Desde recepción hasta curado inicial.',
    normativa: 'NCh 170, NCh 1019, EETT.',
    procedimiento: [
      'Verificar tratamiento de juntas de hormigonado previo al vaciado.',
      'Verificar limpieza de la sección a hormigonar.',
      'Verificar disponibilidad de herramientas adecuadas para la colocación.',
      'Controlar cono de asentamiento del hormigón recibido.',
      'Verificar vibrado adecuado durante la colocación del hormigón.',
      'Verificar platachado y afinado de las superficies.',
      'Verificar inicio y mantención del curado del hormigón.',
    ],
  },
  PICE2_MURO: {
    objetivo:  'Controlar la correcta colocación del hormigón.',
    alcance:   'Desde recepción hasta curado inicial.',
    normativa: 'NCh 170, NCh 1019, EETT.',
    procedimiento: [
      'Verificar tratamiento de juntas de hormigonado previo al vaciado.',
      'Verificar limpieza de la sección a hormigonar.',
      'Verificar disponibilidad de herramientas adecuadas para la colocación.',
      'Controlar cono de asentamiento del hormigón recibido.',
      'Verificar vibrado adecuado durante la colocación del hormigón.',
      'Verificar platachado y afinado de las superficies.',
      'Verificar inicio y mantención del curado del hormigón.',
    ],
  },
  PICE3: {
    objetivo:  'Verificar condiciones previas al hormigonado.',
    alcance:   'Moldajes y superficies de contacto.',
    normativa: 'Especificaciones Técnicas, PCdC.',
    procedimiento: [
      'Verificar aplicación de desmoldante en superficies de moldaje.',
      'Verificar fijación correcta de los moldajes.',
      'Verificar fijación de puntales y arriostramientos.',
      'Verificar disponibilidad de herramientas adecuadas.',
      'Verificar estanquidad de los moldajes.',
      'Verificar limpieza de la sección a hormigonar.',
      'Verificar instalación de juntas de dilatación.',
      'Verificar instalación de juntas de contracción.',
      'Verificar instalación de water stop según planos.',
      'Otorgar aprobación para continuar con el hormigonado.',
    ],
  },
  PICE4_RADIER: {
    objetivo:  'Verificar correcta instalación de armaduras previo al hormigonado.',
    alcance:   'Control de acero de refuerzo en partidas estructurales.',
    normativa: 'NCh 204, Planos estructurales, EETT.',
    procedimiento: [
      'Verificar diámetros de armadura conforme a planos estructurales.',
      'Verificar separación entre barras conforme a planos.',
      'Verificar recubrimientos mínimos según especificaciones.',
      'Verificar fijación y estabilidad de la armadura.',
      'Verificar longitudes de traslape de la enfierradura.',
      'Verificar limpieza de armaduras y superficie de hormigonado.',
      'Verificar refuerzos adicionales de enfierradura según planos.',
      'Otorgar aprobación para continuar con el hormigonado.',
    ],
  },
  PICE4_MURO: {
    objetivo:  'Verificar correcta instalación de armaduras previo al hormigonado.',
    alcance:   'Control de acero de refuerzo en partidas estructurales.',
    normativa: 'NCh 204, Planos estructurales, EETT.',
    procedimiento: [
      'Verificar diámetros de armadura conforme a planos estructurales.',
      'Verificar separación entre barras conforme a planos.',
      'Verificar recubrimientos mínimos según especificaciones.',
      'Verificar fijación y estabilidad de la armadura.',
      'Verificar longitudes de traslape de la enfierradura.',
      'Verificar limpieza de armaduras y superficie de hormigonado.',
      'Verificar refuerzos adicionales de enfierradura según planos.',
      'Otorgar aprobación para continuar con el hormigonado.',
    ],
  },
  HA_RADIER: {
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
  },
  HA_MURO: {
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
  },
};

// ─── Layout constants (A4 mm) ─────────────────────────────────────────────────
const PW = 210;   // page width
const PH = 297;   // page height
const ML = 14;    // margin left
const MR = 14;    // margin right
const CW = PW - ML - MR; // content width = 182mm
const SIG_H = 27;             // alto del bloque de firmas
const SIG_MARGIN_BOTTOM = 14; // margen inferior reservado para firmas

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

// ─── Encabezado ───────────────────────────────────────────────────────────────

async function agregarEncabezado(doc, protocolo, paginaActual, totalPaginas, kmInicio, kmFin) {
  const meta = PROTOCOLOS.find(p => p.id === protocolo.protocoloId);
  const nombreProtocolo = NOMBRE_PICE[protocolo.protocoloId] ?? meta?.nombre ?? protocolo.protocoloId;

  const TOP = 14;
  const LOGO_W = 35;
  const LOGO_H = 25;
  const GAP = 2;
  const TABLE_X = ML + LOGO_W + GAP;
  const TABLE_W = CW - LOGO_W - GAP;

  // Logo
  const logoB64 = await loadLogoB64();
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(ML, TOP, LOGO_W, LOGO_H);
  if (logoB64) {
    try { doc.addImage(logoB64, 'JPEG', ML + 1, TOP + 1, LOGO_W - 2, LOGO_H - 2); }
    catch { /* logo opcional */ }
  }

  // Tabla de información a la derecha
  autoTable(doc, {
    startY: TOP,
    margin: { left: TABLE_X, right: PW - TABLE_X - TABLE_W },
    tableWidth: TABLE_W,
    body: [
      [
        'PROTOCOLO DE INSPECCIÓN Y CONTROL DE EJECUCIÓN (PICE)',
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
      fontSize: 7.5,
      cellPadding: 1.5,
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
        data.cell.styles.fontSize = 8;
      }
      if (data.row.index === 2 && data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign = 'center';
      }
    },
  });

  const tableBottom = doc.lastAutoTable.finalY;
  return Math.max(TOP + LOGO_H, tableBottom) + 5;
}

// ─── Tabla info (página 1) ────────────────────────────────────────────────────

function agregarTablaInfo(doc, protocolo, y, kmInicio, kmFin) {
  const textos = TEXTOS_PROTOCOLO[protocolo.protocoloId] ?? { objetivo: '', alcance: '', normativa: '' };
  const km = resolveKm(protocolo, kmInicio, kmFin);
  const entidad = `${NOMBRES_TIPO[protocolo.tipo] ?? protocolo.tipo} ${protocolo.entidadId}`;
  const actividad = `km: ${km.inicio || '—'} hasta ${km.fin || '—'} — Elemento: ${entidad}`;

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    body: [
      ['Objetivo', textos.objetivo || ''],
      ['Alcance', textos.alcance || ''],
      ['Normativa Aplicable', textos.normativa || ''],
      ['Actividad / Partida', actividad],
      ['Responsable', 'Encargado de Calidad / Administrador de Contrato'],
    ],
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold', fillColor: [240, 240, 240] },
      1: { cellWidth: CW - 45 },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      lineColor: [120, 120, 120],
      lineWidth: 0.2,
      textColor: [30, 30, 30],
    },
    theme: 'grid',
  });

  return doc.lastAutoTable.finalY + 4;
}

// ─── Sección PROCEDIMIENTO (página 1) ─────────────────────────────────────────

function agregarProcedimiento(doc, protocolo, y) {
  const pasos = TEXTOS_PROTOCOLO[protocolo.protocoloId]?.procedimiento ?? [];
  if (pasos.length === 0) return y;

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    head: [[
      { content: 'PROCEDIMIENTO', styles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' } },
    ]],
    body: pasos.map(paso => [paso]),
    columnStyles: {
      0: { cellWidth: CW, halign: 'center' },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: [120, 120, 120],
      lineWidth: 0.2,
      textColor: [30, 30, 30],
      fillColor: [255, 255, 255],
    },
    theme: 'grid',
  });

  return doc.lastAutoTable.finalY + 4;
}

// ─── Tabla PROTOCOLO DE CONTROL (página 1) ────────────────────────────────────

function agregarProtocoloControl(doc, protocolo, y) {
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
    margin: { left: ML, right: MR },
    tableWidth: CW,
    head: [
      [{ content: 'PROTOCOLO DE CONTROL', colSpan: 5, styles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' } }],
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
      fontSize: 8.5,
      cellPadding: 2,
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
      }
    },
  });

  return doc.lastAutoTable.finalY + 4;
}

// ─── Pie de firma ─────────────────────────────────────────────────────────────

function agregarPieFirma(doc, yPos) {
  const colW = CW / 3;

  autoTable(doc, {
    startY: yPos,
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
    didParseCell: (data) => {
      if (data.row.index === 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function generarPDF(protocolo, fotos = [], kmInicio = '', kmFin = '') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const meta = PROTOCOLOS.find(p => p.id === protocolo.protocoloId);
  const soloFotos = meta?.soloFotos === true;

  let y = await agregarEncabezado(doc, protocolo, 1, 1, kmInicio, kmFin);

  if (!soloFotos) {
    y = agregarTablaInfo(doc, protocolo, y, kmInicio, kmFin);
    y = agregarProcedimiento(doc, protocolo, y);
    y = agregarProtocoloControl(doc, protocolo, y);
  }

  let sigY = Math.max(y + 4, PH - SIG_MARGIN_BOTTOM - SIG_H - 2);
  if (sigY + SIG_H > PH - SIG_MARGIN_BOTTOM) {
    doc.addPage();
    sigY = PH - SIG_MARGIN_BOTTOM - SIG_H - 2;
  }
  agregarPieFirma(doc, sigY);

  const entidadStr = String(protocolo.entidadId).replace(/\s+/g, '');
  const fechaStr = fmtArchivo(protocolo.fechaModificacion);
  doc.save(`${protocolo.protocoloId}_${entidadStr}_${fechaStr}.pdf`);
}
