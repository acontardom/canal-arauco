import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/Logo_ExMaq.jpg';
import { PROTOCOLOS, CHECKLISTS, KM_DATA } from '../constants/estructura';

const NOMBRES_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const TIPO_ARCHIVO = { tramo: 'Tramo', caida: 'Caida', atravieso: 'Atravieso' };

// Resuelve los KM reales: usa los pasados (Configuración) si existen, si no cae a KM_DATA
function resolveKm(protocolo, kmInicio, kmFin) {
  if (kmInicio || kmFin) return { inicio: kmInicio, fin: kmFin };
  const datos = KM_DATA[protocolo.tipo]?.[String(protocolo.entidadId)];
  return { inicio: datos?.inicio ?? '', fin: datos?.fin ?? '' };
}

// ─── Layout constants (A4 mm) ─────────────────────────────────────────────────
const PW = 210;   // page width
const PH = 297;   // page height
const ML = 14;    // margin left
const MR = 14;    // margin right
const CW = PW - ML - MR; // content width = 182mm
const SIG_H = 27;             // alto del bloque de firmas
const SIG_MARGIN_BOTTOM = 14; // margen inferior reservado para firmas
const PESO_HOYA = 6.9;         // kg, peso fijo de la hoya vacía (ensayo PU)

// ─── Textos fijos por protocolo ───────────────────────────────────────────────
const TEXTOS = {
  PICE1: {
    objetivo:  'Verificar la correcta ejecución de las actividades de movimientos de tierra.',
    alcance:   'Aplica a las actividades de replanteo, excavación a máquina OOCC o GPS, Rellenos.',
    normativa: 'Planos del proyecto, Especificaciones Técnicas, PCdC y Procedimiento PR-CL-01.',
  },
  PICE2_RADIER: {
    objetivo:  'Controlar la correcta colocación del hormigón.',
    alcance:   'Desde recepción hasta curado inicial.',
    normativa: 'NCh 170, NCh 1019, EETT.',
  },
  PICE2_MURO: {
    objetivo:  'Controlar la correcta colocación del hormigón.',
    alcance:   'Desde recepción hasta curado inicial.',
    normativa: 'NCh 170, NCh 1019, EETT.',
  },
  PICE3: {
    objetivo:  'Verificar condiciones previas al hormigonado.',
    alcance:   'Moldajes y superficies de contacto.',
    normativa: 'Especificaciones Técnicas, PCdC.',
  },
  PICE4_RADIER: {
    objetivo:  'Verificar correcta instalación de armaduras previo al hormigonado.',
    alcance:   'Control de acero de refuerzo en partidas estructurales.',
    normativa: 'NCh 204, Planos estructurales, EETT.',
  },
  PICE4_MURO: {
    objetivo:  'Verificar correcta instalación de armaduras previo al hormigonado.',
    alcance:   'Control de acero de refuerzo en partidas estructurales.',
    normativa: 'NCh 204, Planos estructurales, EETT.',
  },
  HA_RADIER: {
    objetivo:  'Controlar los parámetros de calidad del hormigón en cada camión mixer.',
    alcance:   'Aplica al control de cada camión: cono, temperatura, tiempo de traslado y peso unitario.',
    normativa: 'NCh 170, NCh 1019, NCh 1934, EETT.',
  },
  HA_MURO: {
    objetivo:  'Controlar los parámetros de calidad del hormigón en cada camión mixer.',
    alcance:   'Aplica al control de cada camión: cono, temperatura, tiempo de traslado y peso unitario.',
    normativa: 'NCh 170, NCh 1019, NCh 1934, EETT.',
  },
};

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

async function ensureJpeg(dataUrl) {
  if (!dataUrl) return null;
  const prefix = dataUrl.substring(0, 40).toLowerCase();
  if (prefix.includes('webp') || prefix.includes('heic') || prefix.includes('heif')) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }
  return dataUrl;
}

function detectFormat(dataUrl) {
  if (!dataUrl) return 'JPEG';
  const p = dataUrl.substring(0, 30).toLowerCase();
  if (p.includes('png')) return 'PNG';
  if (p.includes('gif')) return 'GIF';
  return 'JPEG';
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

// ─── Firma ────────────────────────────────────────────────────────────────────

function drawFirma(doc, y) {
  const colW = CW / 3;
  const roles   = ['PAC',                    'ITO',                          'ADMINISTRADOR'];
  const nombres = ['Diego Oñate Jorquera',   'Gonzalo Chavarría Sepúlveda',  'Marcelo Contardo Correa'];
  const H = 27;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  // Outer box
  doc.rect(ML, y, CW, H);
  // Vertical dividers
  doc.line(ML + colW,     y, ML + colW,     y + H);
  doc.line(ML + colW * 2, y, ML + colW * 2, y + H);

  roles.forEach((rol, i) => {
    const cx = ML + i * colW;
    const mid = cx + colW / 2;
    const lx1 = cx + 3;
    const lx2 = cx + colW - 3;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 52, 96);
    doc.text(rol, mid, y + 6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text(nombres[i], mid, y + 11, { align: 'center' });

    doc.setFontSize(7.5);
    doc.text('Firma:', lx1, y + 18);
    doc.setDrawColor(160, 160, 160);
    doc.line(lx1 + 11, y + 18, lx2, y + 18);

    doc.text('Fecha:', lx1, y + 24);
    doc.line(lx1 + 11, y + 24, lx2, y + 24);
  });
}

// ─── Encabezado página 1 ─────────────────────────────────────────────────────

function drawEncabezado(doc, logoB64, protocolo, kmInicio, kmFin) {
  const meta = PROTOCOLOS.find(p => p.id === protocolo.protocoloId);
  const entidad = `${NOMBRES_TIPO[protocolo.tipo] ?? protocolo.tipo} ${protocolo.entidadId}`;

  // ── Fila 1: logo + títulos ────────────────────────────────────────────────
  const ROW1_H = 28;
  const LOGO_W = 40;
  const TITLE_X = ML + LOGO_W;
  const TITLE_W = CW - LOGO_W;
  const TOP = 14;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(ML, TOP, LOGO_W, ROW1_H);
  doc.rect(TITLE_X, TOP, TITLE_W, ROW1_H);

  if (logoB64) {
    try { doc.addImage(logoB64, 'JPEG', ML + 1, TOP + 1, LOGO_W - 2, ROW1_H - 2); }
    catch { /* logo optional */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 52, 96);
  doc.text('PROTOCOLO DE INSPECCIÓN Y CONTROL DE EJECUCIÓN (PICE)', TITLE_X + 3, TOP + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text('Construcción Canal Siberia - Sección Los Litres', TITLE_X + 3, TOP + 13);
  doc.text('Proyecto: Canal Arauco — Arauco S.A.', TITLE_X + 3, TOP + 19);
  doc.text(`Fecha: ${fmt(protocolo.fechaModificacion)}`, TITLE_X + 3, TOP + 25);

  // ── Fila 2: barra de info ─────────────────────────────────────────────────
  const BAR_Y = TOP + ROW1_H;
  const BAR_H = 10;
  const cols = [
    { label: 'PROTOCOLO',  value: meta?.nombre ?? protocolo.protocoloId, w: 60 },
    { label: 'ENTIDAD',    value: entidad,                                w: 42 },
    { label: 'FECHA',      value: fmt(protocolo.fechaModificacion),       w: 32 },
    { label: 'COMUNA',     value: 'Yungay',                               w: 27 },
    { label: 'CÓDIGO',     value: meta?.codigo ?? '',                     w: 21 },
  ];

  doc.setFillColor(15, 52, 96);
  doc.rect(ML, BAR_Y, CW, BAR_H, 'F');

  let cx = ML;
  cols.forEach(({ label, value, w }) => {
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.2);
    if (cx > ML) doc.line(cx, BAR_Y, cx, BAR_Y + BAR_H);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(180, 210, 255);
    doc.text(label, cx + w / 2, BAR_Y + 3.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    // Truncate long values to avoid overflow
    const maxChars = Math.floor(w / 1.9);
    const val = value.length > maxChars ? value.substring(0, maxChars - 1) + '…' : value;
    doc.text(val, cx + w / 2, BAR_Y + 7.8, { align: 'center' });

    cx += w;
  });

  // Border around full header
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.rect(ML, TOP, CW, ROW1_H + BAR_H);

  return TOP + ROW1_H + BAR_H + 5; // nextY
}

// ─── Encabezado páginas de fotos ─────────────────────────────────────────────

function drawEncabezadoFotos(doc, protocolo) {
  const meta = PROTOCOLOS.find(p => p.id === protocolo.protocoloId);
  const entidad = `${NOMBRES_TIPO[protocolo.tipo] ?? protocolo.tipo} ${protocolo.entidadId}`;

  doc.setFillColor(15, 52, 96);
  doc.rect(ML, 14, CW, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `Registro fotográfico — ${entidad} — ${meta?.nombre ?? protocolo.protocoloId}`,
    ML + CW / 2, 14 + 8,
    { align: 'center' },
  );

  return 14 + 12 + 4; // nextY = 30
}

// ─── Encabezado páginas de fotos por camión (Control H.A.) ───────────────────

function drawEncabezadoFotosCamion(doc, protocolo, numero) {
  const meta = PROTOCOLOS.find(p => p.id === protocolo.protocoloId);
  const entidad = `${NOMBRES_TIPO[protocolo.tipo] ?? protocolo.tipo} ${protocolo.entidadId}`;

  doc.setFillColor(15, 52, 96);
  doc.rect(ML, 14, CW, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `Registro fotográfico — ${entidad} — Camión #${numero} — ${meta?.nombre ?? protocolo.protocoloId}`,
    ML + CW / 2, 14 + 8,
    { align: 'center' },
  );

  return 14 + 12 + 4; // nextY = 30
}

// ─── Fotos de un camión (Control H.A.) ───────────────────────────────────────
// Misma grilla 2x2 que el resto de protocolos: una página nueva por cada 4 fotos.
// Devuelve la coordenada Y inferior de la última fila de fotos dibujada.

async function drawFotosCamion(doc, protocolo, numero, fotosCamion) {
  const PHOTO_W = (CW - 8) / 2;   // ~87mm
  const PHOTO_H = 90;             // mm
  const DESC_H  = 9;              // mm
  const ROW_H   = PHOTO_H + DESC_H + 6;

  const posiciones = [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
  ];

  let lastY = 0;

  for (let batch = 0; batch < Math.ceil(fotosCamion.length / 4); batch++) {
    doc.addPage();
    const startY = drawEncabezadoFotosCamion(doc, protocolo, numero);
    const batchFotos = fotosCamion.slice(batch * 4, batch * 4 + 4);

    for (let i = 0; i < batchFotos.length; i++) {
      const foto = batchFotos[i];
      const pos  = posiciones[i];
      const px   = ML + pos.col * (PHOTO_W + 8);
      const py   = startY + pos.row * ROW_H;

      try {
        const dataUrl = await ensureJpeg(foto.dataUrl);
        if (dataUrl) {
          doc.addImage(dataUrl, detectFormat(dataUrl), px, py, PHOTO_W, PHOTO_H);
        } else {
          throw new Error('empty');
        }
      } catch {
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(200, 200, 200);
        doc.rect(px, py, PHOTO_W, PHOTO_H, 'FD');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text('[Foto no disponible]', px + PHOTO_W / 2, py + PHOTO_H / 2, { align: 'center' });
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      const desc = foto.descripcion
        ? foto.descripcion
        : `Foto ${batch * 4 + i + 1}`;
      const descLines = doc.splitTextToSize(desc, PHOTO_W);
      doc.text(descLines[0] ?? '', px, py + PHOTO_H + 5.5);

      lastY = Math.max(lastY, py + PHOTO_H + DESC_H);
    }
  }

  return lastY;
}

// ─── Bloque de datos de un camión (Control H.A.) ─────────────────────────────
// Dibuja título "Camión #N" + tabla de datos + ensayo PU + observaciones.
// Devuelve la coordenada Y siguiente disponible.

function drawCamionDatos(doc, c, y) {
  const LABEL_W = 70;
  const tableStyles = {
    fontSize: 8.5,
    cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    lineColor: [190, 200, 220],
    lineWidth: 0.3,
    textColor: [40, 40, 40],
  };
  const columnStyles = {
    0: { cellWidth: LABEL_W, fontStyle: 'bold', fillColor: [232, 240, 251], textColor: [15, 52, 96] },
    1: { cellWidth: CW - LABEL_W },
  };

  // Título "Camión #N" con separador visual
  if (y > PH - SIG_MARGIN_BOTTOM - 30) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(15, 52, 96);
  doc.setLineWidth(0.6);
  doc.line(ML, y, ML + CW, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 52, 96);
  doc.text(`Camión #${c.numero}`, ML, y + 6);
  y += 10;

  // Tabla de datos del camión
  autoTable(doc, {
    startY: y,
    margin: { top: 20, left: ML, right: MR },
    body: [
      ['Tipo hormigón',               c.tipoHormigon || '—'],
      ['Volumen (m³)',                c.volumen || '—'],
      ['N° Guía',                     c.guia || '—'],
      ['Planta',                      c.planta || '—'],
      ['Asentamiento de cono (cm)',   c.cono || '—'],
      ['Temperatura hormigón (°C)',   c.temperaturaHormigon || '—'],
      ['Temperatura ambiente (°C)',   c.temperaturaAmbiente || '—'],
      ['Hora de carga',               c.horaCarga || '—'],
      ['Hora de descarga',            c.horaDescarga || '—'],
      ['Tiempo de traslado (min)',    c.tiempoTraslado || '—'],
    ],
    columnStyles,
    styles: tableStyles,
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 4;

  // Ensayo Peso Unitario
  if (y > PH - SIG_MARGIN_BOTTOM - 8) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ENSAYO PESO UNITARIO', ML, y + 4);
  y += 6;

  const puTexto = c.puResultado
    ? `${Number(c.puResultado).toLocaleString('es-CL')} kg/m³`
    : '—';

  autoTable(doc, {
    startY: y,
    margin: { top: 20, left: ML, right: MR },
    body: [
      ['Peso de la hoya (kg)',       PESO_HOYA.toFixed(1).replace('.', ',')],
      ['Peso hoya + hormigón (kg)',  c.puPesoTotal || '—'],
      [
        { content: 'PU calculado (kg/m³)', styles: { fontStyle: 'bold', fontSize: 9.5, fillColor: [220, 237, 255], textColor: [15, 52, 96] } },
        { content: puTexto,                styles: { fontStyle: 'bold', fontSize: 9.5, fillColor: [220, 237, 255], textColor: [15, 52, 96] } },
      ],
    ],
    columnStyles,
    styles: tableStyles,
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 4;

  // Observaciones del camión
  if (c.observaciones) {
    if (y > PH - SIG_MARGIN_BOTTOM - 16) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('OBSERVACIONES DEL CAMIÓN', ML, y + 4);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(c.observaciones, CW);
    doc.text(lines, ML, y + 3.5);
    y += lines.length * 4 + 4;
  }

  return y;
}

// ─── Pie de página (número) ───────────────────────────────────────────────────

function addPageNumbers(doc) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(`Página ${i} de ${n}`, PW - MR, PH - 5, { align: 'right' });
  }
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function generarPDF(protocolo, fotos = [], kmInicio = '', kmFin = '') {
  const meta = PROTOCOLOS.find(p => p.id === protocolo.protocoloId);
  const entidad = `${NOMBRES_TIPO[protocolo.tipo] ?? protocolo.tipo} ${protocolo.entidadId}`;

  const esHA = protocolo.protocoloId === 'HA_RADIER' || protocolo.protocoloId === 'HA_MURO';
  const itemsChecklist = CHECKLISTS[protocolo.protocoloId] ?? [];
  const checklist      = protocolo.datos?.checklist ?? {};
  const observaciones  = protocolo.datos?.observaciones ?? '';
  const camiones       = protocolo.datos?.camiones ?? [];
  const textos = TEXTOS[protocolo.protocoloId] ?? { objetivo: '', alcance: '', normativa: '' };

  const km = resolveKm(protocolo, kmInicio, kmFin);
  const actividadParts = [];
  if (km.inicio || km.fin) actividadParts.push(`km ${km.inicio || '—'} hasta ${km.fin || '—'}`);
  actividadParts.push(`Elemento: ${entidad}`);
  const actividad = actividadParts.join(' — ');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const logoB64 = await loadLogoB64();

  // ── PÁGINA 1 ──────────────────────────────────────────────────────────────

  let y = drawEncabezado(doc, logoB64, protocolo, kmInicio, kmFin);

  // Cuerpo: campos descriptivos
  autoTable(doc, {
    startY: y,
    body: [
      ['Objetivo:',              textos.objetivo],
      ['Alcance:',               textos.alcance],
      ['Normativa / Referencias:', textos.normativa],
      ['Actividad / Partida:',   actividad],
      ['Responsable:',           'Encargado de Calidad / Administrador de Contrato'],
    ],
    columnStyles: {
      0: { cellWidth: 44, fontStyle: 'bold', fillColor: [232, 240, 251], textColor: [15, 52, 96] },
      1: { cellWidth: CW - 44 },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      lineColor: [190, 200, 220],
      lineWidth: 0.3,
      textColor: [40, 40, 40],
    },
    theme: 'grid',
    margin: { left: ML, right: MR },
  });
  y = doc.lastAutoTable.finalY + 5;

  if (esHA) {
    // ── Control H.A.: una sección por camión ───────────────────────────────
    if (camiones.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(140, 140, 140);
      doc.text('No hay camiones registrados para este protocolo.', ML, y + 6);
      y += 12;
    } else {
      for (const c of camiones) {
        y = drawCamionDatos(doc, c, y);
        if (c.fotos?.length > 0) {
          y = await drawFotosCamion(doc, protocolo, c.numero, c.fotos);
        }
      }
    }

    // Firma: solo en la última página
    let sigYHA = Math.max(y + 4, PH - SIG_MARGIN_BOTTOM - SIG_H - 2);
    if (sigYHA + SIG_H > PH - SIG_MARGIN_BOTTOM) {
      doc.addPage();
      sigYHA = PH - SIG_MARGIN_BOTTOM - SIG_H - 2;
    }
    drawFirma(doc, sigYHA);

    addPageNumbers(doc);
    const tipoLabelHA  = TIPO_ARCHIVO[protocolo.tipo] ?? protocolo.tipo;
    const entidadStrHA = String(protocolo.entidadId).replace(/\s+/g, '');
    const fechaStrHA   = fmtArchivo(protocolo.fechaModificacion);
    doc.save(`${protocolo.protocoloId}_${tipoLabelHA}${entidadStrHA}_${fechaStrHA}.pdf`);
    return;
  }

  // Checklist (solo si hay items)
  if (itemsChecklist.length > 0) {
    const checkBody = itemsChecklist.map(item => {
      const entry = checklist[item.id];
      const val = (entry && typeof entry === 'object') ? entry.valor : entry;
      const obs = (entry && typeof entry === 'object') ? (entry.obs ?? '') : '';
      return [
        item.label,
        val === 'si'  ? 'X' : '',
        val === 'no'  ? 'X' : '',
        val === 'na'  ? 'X' : '',
        obs,
      ];
    });

    // Fila de observaciones generales
    checkBody.push([
      {
        content: 'Observaciones generales:',
        colSpan: 1,
        styles: { fontStyle: 'bold', fillColor: [232, 240, 251], textColor: [15, 52, 96] },
      },
      {
        content: observaciones || '(sin observaciones)',
        colSpan: 4,
        styles: {
          fontStyle: observaciones ? 'normal' : 'italic',
          textColor: observaciones ? [40, 40, 40] : [160, 160, 160],
          minCellHeight: 12,
        },
      },
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Ítem de Control', 'SÍ', 'NO', 'N/A', 'Observaciones']],
      body: checkBody,
      columnStyles: {
        0: { cellWidth: 103 },
        1: { cellWidth: 13, halign: 'center' },
        2: { cellWidth: 13, halign: 'center' },
        3: { cellWidth: 13, halign: 'center' },
        4: { cellWidth: 40 },
      },
      headStyles: {
        fillColor: [15, 52, 96],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
        cellPadding: 3,
      },
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: [190, 200, 220],
        lineWidth: 0.3,
        textColor: [40, 40, 40],
      },
      theme: 'grid',
      margin: { left: ML, right: MR },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        if (typeof data.cell.raw !== 'string' || data.cell.raw !== 'X') return;
        const col = data.column.index;
        if (col === 1) { data.cell.styles.fillColor = [16, 185, 129];  data.cell.styles.textColor = [255, 255, 255]; data.cell.styles.fontStyle = 'bold'; }
        if (col === 2) { data.cell.styles.fillColor = [239, 68, 68];   data.cell.styles.textColor = [255, 255, 255]; data.cell.styles.fontStyle = 'bold'; }
        if (col === 3) { data.cell.styles.fillColor = [245, 158, 11];  data.cell.styles.textColor = [255, 255, 255]; data.cell.styles.fontStyle = 'bold'; }
      },
    });
    y = doc.lastAutoTable.finalY + 5;
  }

  // Firma en página 1: empuja hacia abajo si hay espacio, o usa posición fija
  let sigY1 = Math.max(y + 4, PH - SIG_MARGIN_BOTTOM - SIG_H - 2);
  if (sigY1 + SIG_H > PH - SIG_MARGIN_BOTTOM) {
    doc.addPage();
    sigY1 = PH - SIG_MARGIN_BOTTOM - SIG_H - 2;
  }
  drawFirma(doc, sigY1);

  // ── PÁGINAS DE FOTOS ──────────────────────────────────────────────────────

  if (fotos.length > 0) {
    const PHOTO_W    = (CW - 8) / 2;   // ~87mm
    const PHOTO_H    = 90;             // mm
    const DESC_H     = 9;              // mm
    const ROW_H      = PHOTO_H + DESC_H + 6;  // mm

    // 4 posiciones en grilla 2x2 (X,Y relativos a photosStartY)
    const posiciones = [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ];

    for (let batch = 0; batch < Math.ceil(fotos.length / 4); batch++) {
      doc.addPage();
      const startY = drawEncabezadoFotos(doc, protocolo);
      const batchFotos = fotos.slice(batch * 4, batch * 4 + 4);

      for (let i = 0; i < batchFotos.length; i++) {
        const foto = batchFotos[i];
        const pos  = posiciones[i];
        const px   = ML + pos.col * (PHOTO_W + 8);
        const py   = startY + pos.row * ROW_H;

        // Imagen
        try {
          const dataUrl = await ensureJpeg(foto.dataUrl);
          if (dataUrl) {
            doc.addImage(dataUrl, detectFormat(dataUrl), px, py, PHOTO_W, PHOTO_H);
          } else {
            throw new Error('empty');
          }
        } catch {
          doc.setFillColor(240, 240, 240);
          doc.setDrawColor(200, 200, 200);
          doc.rect(px, py, PHOTO_W, PHOTO_H, 'FD');
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(180, 180, 180);
          doc.text('[Foto no disponible]', px + PHOTO_W / 2, py + PHOTO_H / 2, { align: 'center' });
        }

        // Descripción
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        const desc = foto.descripcion
          ? foto.descripcion
          : `Foto ${batch * 4 + i + 1}`;
        const descLines = doc.splitTextToSize(desc, PHOTO_W);
        doc.text(descLines[0] ?? '', px, py + PHOTO_H + 5.5);
      }

      drawFirma(doc, PH - SIG_MARGIN_BOTTOM - SIG_H - 2);
    }
  }

  // ── Números de página ────────────────────────────────────────────────────
  addPageNumbers(doc);

  // ── Descargar ─────────────────────────────────────────────────────────────
  const tipoLabel  = TIPO_ARCHIVO[protocolo.tipo] ?? protocolo.tipo;
  const entidadStr = String(protocolo.entidadId).replace(/\s+/g, '');
  const fechaStr   = fmtArchivo(protocolo.fechaModificacion);
  doc.save(`${protocolo.protocoloId}_${tipoLabel}${entidadStr}_${fechaStr}.pdf`);
}
