// scripts/regenerar-pdfs-ha.js
//
// Regenera los PDFs firmados de 34 protocolos HA_RADIER / HA_MURO.
// Replica exactamente la lógica de confirmarFirma() en Firma.jsx.
//
// Ejecución (desde la raíz del proyecto):
//   node scripts/regenerar-pdfs-ha.js
//
// Requiere: Node.js 18+

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@supabase/supabase-js';
import { PROTOCOLOS, KM_DATA } from '../src/constants/estructura.js';

// ─── Rutas ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const ASSETS    = join(ROOT, 'src', 'assets');

// ─── Variables de entorno (.env.local) ───────────────────────────────────────

function cargarEnv(filePath) {
  let content;
  try { content = readFileSync(filePath, 'utf8'); }
  catch { console.error(`❌ No se encontró ${filePath}`); process.exit(1); }
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  });
}

cargarEnv(join(ROOT, '.env.local'));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Assets locales ───────────────────────────────────────────────────────────

function loadImageB64(filename, mime = 'image/png') {
  const buf = readFileSync(join(ASSETS, filename));
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const LOGO_B64 = loadImageB64('Logo_ExMaq.jpg', 'image/jpeg');

const FIRMA_B64 = {
  'Álvaro Muñoz':            loadImageB64('firma_alvaro.png'),
  'Diego Oñate Jorquera':    loadImageB64('firma_diego.png'),
  'Marcelo Contardo Correa': loadImageB64('firma_marcelo.png'),
};

// ─── IDs a procesar ──────────────────────────────────────────────────────────

const IDS_HA = [
  '41b53a72-e5ba-45bd-8148-3f9865cd9c35',
  '35155381-ed35-48b4-a5d6-c875823e6fae',
  'e52b6c40-3810-4988-878c-20e508ec394b',
  '719ccb4d-58af-42d7-b227-0b42c8094549',
  '861cc60e-cdae-4e97-9c83-399c46aa2ae4',
  '5b3b6a75-af9d-4cd9-8c0d-9f904160b8fd',
  '69d666bf-ff92-4af5-a14b-319e3c8ec66e',
  'bad6bfff-eccd-48e7-88a1-322e15aa536c',
  '78eae558-8bd1-4b4e-8318-10766f31cfbd',
  '7d11b98d-87b5-4b5f-a6d1-f59e83473d36',
  '14f849ff-a422-42a2-9457-7db90f2b2d4d',
  'ccf9f87a-c6f4-461a-ab9e-40ab75ab3d4b',
  '8e801bea-22fe-44a0-af42-3bf294b00bae',
  '96a043b1-3b31-48b8-a522-7ab007b5d784',
  'f92bddf0-feac-44dc-9633-2c37fdf708a1',
  'bc933ecd-a6ff-435f-9fa6-5443f2e6b227',
  'ae87a7e1-9947-4fce-912c-65be23c87025',
  '279a97ad-b5ab-40d9-834c-9c63765c58a1',
  '6dbddb8b-c3ef-436e-8e3c-94a95a3b651f',
  '9205952f-e07a-4829-8e88-6bc4e932d310',
  'b5fdcbad-5e68-4d24-9495-3dd777cccbe1',
  '997c661a-f9d0-4656-b651-fc1d4f8dd729',
  '86147349-ba8f-4aac-a1ec-11f206240cd1',
  '2d232cdb-1201-40fd-ba62-50708b503402',
  '5a25f7e3-dae8-4ef9-8ef9-abb7bc45644f',
  'bef9c104-ba1d-4a67-81b4-a31b6915145d',
  '18415442-e3d3-4b59-a480-c4b03befd8fe',
  '33b0c80d-b8c3-45ad-b75b-3a3317dda53e',
  '1be04921-d7cb-481d-a24d-b7a53a619ccd',
  'e9229fd0-da55-44f6-8d0b-a9191bf00e46',
  '0a874592-ca54-4d03-b85f-91973ddd0c85',
  'bc36ceac-41b8-42c6-bf2a-20475fba56b8',
  '05b5fe43-e66f-4f86-92d3-e93dcf23df69',
  'bb9ea99e-f9a7-447b-80bf-4ba0f0e0e441',
];

// ─── Constantes PDF (idénticas a generarPDF.js) ───────────────────────────────

const PW = 210;
const PH = 297;
const ML = 14;
const MR = 14;
const CW = PW - ML - MR;
const CONTENT_MARGIN = { top: 10, bottom: 10 };
const ESCALA_NORMAL  = { fontSize: 8, headFontSize: 9, cellPadding: 2 };

const NOMBRE_PICE  = { HA_RADIER: 'Control H.A.', HA_MURO: 'Control H.A.' };
const NOMBRES_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

const TEXTOS_HA = {
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
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function formatearFechaPie(fecha) {
  if (!fecha) return '_______________';
  const d   = new Date(fecha);
  const utc = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
  return `${String(utc.getDate()).padStart(2,'0')}/${String(utc.getMonth()+1).padStart(2,'0')}/${utc.getFullYear()}`;
}

function detectFormat(dataUrl) {
  const m   = /^data:image\/(\w+);/.exec(dataUrl ?? '');
  const ext = m?.[1]?.toLowerCase();
  if (ext === 'png')  return 'PNG';
  if (ext === 'webp') return 'WEBP';
  return 'JPEG';
}

function pieFirmaY(finalY) {
  return finalY < PH - 55 ? PH - 52 : finalY + 5;
}

function resolveKm(protocolo, kmInicio, kmFin) {
  if (kmInicio || kmFin) return { inicio: kmInicio, fin: kmFin };
  const datos = KM_DATA[protocolo.protocoloId]?.[String(protocolo.entidadId)];
  return { inicio: datos?.inicio ?? '', fin: datos?.fin ?? '' };
}

async function obtenerImagenBase64(foto) {
  const urlToFetch = foto.storageUrlRecortado || foto.storageUrl;
  if (!urlToFetch) return null;
  try {
    const resp = await fetch(urlToFetch);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf  = Buffer.from(await resp.arrayBuffer());
    const mime = resp.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    return { dataUrl, formato: detectFormat(dataUrl) };
  } catch (err) {
    console.warn('    ⚠ Error descargando foto:', err?.message);
    return null;
  }
}

async function descargarFirmaBase64(firmaUrl) {
  if (!firmaUrl) return null;
  try {
    const resp = await fetch(firmaUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf  = Buffer.from(await resp.arrayBuffer());
    const mime = resp.headers.get('content-type') || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    // Fallback via SDK (evita posibles problemas con URLs caducadas)
    try {
      const pathMatch = firmaUrl.match(/fotos-canal-arauco\/(.+?)(\?.*)?$/);
      if (!pathMatch) return null;
      const { data } = await supabase.storage.from('fotos-canal-arauco').download(pathMatch[1]);
      if (!data) return null;
      const buf = Buffer.from(await data.arrayBuffer());
      return `data:image/png;base64,${buf.toString('base64')}`;
    } catch { return null; }
  }
}

// ─── Encabezado (≡ agregarEncabezado en generarPDF.js) ───────────────────────

function agregarEncabezado(doc, protocolo, paginaActual, totalPaginas, kmInicio, kmFin) {
  const meta = PROTOCOLOS.find(p => p.id === protocolo.protocoloId);
  const nombreProtocolo = NOMBRE_PICE[protocolo.protocoloId] ?? meta?.nombre ?? protocolo.protocoloId;

  const TOP     = 8;
  const LOGO_W  = 30;
  const GAP     = 2;
  const TABLE_X = ML + LOGO_W + GAP;
  const TABLE_W = CW - LOGO_W - GAP;

  autoTable(doc, {
    startY: TOP,
    margin: { left: TABLE_X, right: PW - TABLE_X - TABLE_W },
    tableWidth: TABLE_W,
    body: [
      [
        'PROTOCOLO DE INSPECCIÓN Y CONTROL DE EJECUCIÓN (PICE)',
        `FECHA: ${protocolo.datos?.fechaProtocolo ? fmt(protocolo.datos.fechaProtocolo + 'T12:00:00') : fmt(protocolo.fechaModificacion)}`,
      ],
      [
        'PROYECTO: Construcción Canal Siberia - Sección Los Litres',
        `PAGINA: ${paginaActual} de ${totalPaginas}`,
      ],
      [
        nombreProtocolo,
        `CÓDIGO DOCUMENTO: ${meta?.codigo ?? ''}`,
      ],
      [{ content: `REGISTRO N°: ${protocolo.entidadId}    COMUNA: Yungay`, colSpan: 2 }],
    ],
    columnStyles: { 0: { cellWidth: 92 }, 1: { cellWidth: 58 } },
    styles: {
      fontSize: 7, cellPadding: 1,
      lineColor: [120, 120, 120], lineWidth: 0.2,
      textColor: [30, 30, 30], valign: 'middle',
    },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.row.index === 0 && data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign    = 'center';
        data.cell.styles.fontSize  = 7.5;
      }
      if (data.row.index === 2 && data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign    = 'center';
      }
    },
  });

  const tableBottom = doc.lastAutoTable.finalY;
  const logoH = tableBottom - TOP;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(ML, TOP, LOGO_W, logoH);
  try { doc.addImage(LOGO_B64, 'JPEG', ML + 1, TOP + 1, LOGO_W - 2, logoH - 2); }
  catch { /* logo opcional */ }

  return tableBottom + 3;
}

// ─── Tabla info (≡ agregarTablaInfo en generarPDF.js) ────────────────────────

function agregarTablaInfo(doc, protocolo, y, kmInicio, kmFin, escala = ESCALA_NORMAL) {
  const selectorEfectivo = protocolo.protocoloId === 'HA_RADIER' ? 'radier' : 'muro';
  const km      = resolveKm(protocolo, kmInicio, kmFin);
  const entidad = `${NOMBRES_TIPO[protocolo.tipo] ?? protocolo.tipo} ${protocolo.entidadId}`;
  const actividad = `km: ${km.inicio || '—'} hasta ${km.fin || '—'} — Elemento: ${entidad}`;

  const AMARILLO   = [255, 215, 0];
  const GRIS_BADGE = [150, 150, 150];
  const FILA_ACTIVIDAD = 3;
  const filaTexto = (label, contenido) => [label, { content: contenido, colSpan: 4 }];

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR, ...CONTENT_MARGIN },
    tableWidth: CW,
    body: [
      filaTexto('Objetivo',            TEXTOS_HA.objetivo),
      filaTexto('Alcance',             TEXTOS_HA.alcance),
      filaTexto('Normativa Aplicable', TEXTOS_HA.normativa),
      ['Actividad / Partida', { content: '', colSpan: 4 }],
      filaTexto('Responsable', 'Encargado de Calidad / Administrador de Contrato'),
    ],
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold', fillColor: [240, 240, 240], fontSize: escala.headFontSize },
      1: { cellWidth: 12 }, 2: { cellWidth: 12 }, 3: { cellWidth: 12 },
      4: { cellWidth: CW - 45 - 36 },
    },
    styles: {
      fontSize: escala.fontSize, cellPadding: escala.cellPadding,
      lineColor: [120, 120, 120], lineWidth: 0.2, textColor: [30, 30, 30],
    },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === FILA_ACTIVIDAD && data.column.index === 1)
        data.cell.styles.minCellHeight = 9;
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.row.index !== FILA_ACTIVIDAD || data.column.index !== 1) return;
      const { x, y: cy0, width, height } = data.cell;
      const badgeW  = 18;
      const badgeH  = 7;
      const gap     = 2;
      const centerY = cy0 + height / 2;

      const opciones = [
        { label: 'Radier', activo: selectorEfectivo === 'radier' },
        { label: 'Muro',   activo: selectorEfectivo === 'muro'   },
        { label: 'Otro',   activo: false },
      ];

      let bx = x + 2;
      doc.setFontSize(8);
      opciones.forEach(({ label, activo }) => {
        if (activo) {
          doc.setFillColor(...AMARILLO);
          doc.roundedRect(bx, centerY - badgeH / 2, badgeW, badgeH, 1.2, 1.2, 'F');
          doc.setTextColor(0, 0, 0);
          doc.setFont(undefined, 'bold');
        } else {
          doc.setDrawColor(...GRIS_BADGE);
          doc.setLineWidth(0.2);
          doc.roundedRect(bx, centerY - badgeH / 2, badgeW, badgeH, 1.2, 1.2, 'S');
          doc.setTextColor(...GRIS_BADGE);
          doc.setFont(undefined, 'normal');
        }
        doc.text(label, bx + badgeW / 2, centerY, { align: 'center', baseline: 'middle' });
        bx += badgeW + gap;
      });

      doc.setFont(undefined, 'normal');
      doc.setFontSize(escala.fontSize);
      doc.setTextColor(30, 30, 30);
      doc.text(`—  ${actividad}`, bx + gap, centerY, { baseline: 'middle' });
    },
  });

  return doc.lastAutoTable.finalY + 3;
}

// ─── Ensayo Peso Unitario (≡ agregarEnsayoPesoUnitario en generarPDF.js) ─────

function agregarEnsayoPesoUnitario(doc, camion, y, escala) {
  const GRIS = [220, 220, 220];

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    head: [[{
      content: 'Ensayo de Peso Unitario', colSpan: 3,
      styles: { fillColor: GRIS, fontStyle: 'bold', halign: 'center', textColor: [30, 30, 30] },
    }]],
    body: [[
      'Probeta 10 lt\nDiametro = 26,4 cm\nAltura = 18,5 cm\nV = pi(13,2)2(18,5) = 0,0101 m3\nPeso probeta vacia = 6,9 kg',
      'Formula - Ensayo de Peso Unitario\n1.- Peso del hormigon\nW = W2 - W1\nDonde:\n- W = peso del hormigon\n- W1 = peso recipiente vacio\n- W2 = peso recipiente lleno',
      '2.- Peso unitario del hormigon\nPU = W / V\nDonde:\n- PU = peso unitario (kg/m3)\n- W = peso neto hormigon (kg)\n- V = volumen recipiente (m3)',
    ]],
    columnStyles: {
      0: { cellWidth: CW * 0.33 },
      1: { cellWidth: CW * 0.37 },
      2: { cellWidth: CW * 0.30 },
    },
    styles: { fontSize: escala.fontSize, cellPadding: escala.cellPadding, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: [30, 30, 30] },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 2;

  const pesoHoya         = 6.9;
  const pesoHoyaHormigon = parseFloat(camion.pesoHoyaHormigon) || 0;
  const W  = pesoHoyaHormigon ? (pesoHoyaHormigon - pesoHoya).toFixed(1) : '—';
  const PU = camion.puCalculado ?? '—';

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    head: [[{
      content: 'Ensayo', colSpan: 2,
      styles: { fillColor: GRIS, fontStyle: 'bold', halign: 'center', textColor: [30, 30, 30] },
    }]],
    body: [
      [{ content: `W :   ${pesoHoyaHormigon || '-'}  -  ${pesoHoya}  =`, styles: { halign: 'right' } }, { content: `${W} kg`,      styles: { fontStyle: 'bold', halign: 'left' } }],
      [{ content: `PU :   ${W}  /  0,01010  =`,                          styles: { halign: 'right' } }, { content: `${PU} kg/m3`, styles: { fontStyle: 'bold', halign: 'left' } }],
    ],
    columnStyles: { 0: { cellWidth: CW * 0.65 }, 1: { cellWidth: CW * 0.35 } },
    styles: { fontSize: escala.fontSize + 1, cellPadding: escala.cellPadding, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: [30, 30, 30] },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 2;

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    body: [[
      '- < 2200 kg/m3: Posible exceso de agua o aire incorporado; puede afectar resistencia.\n' +
      '- 2200 - 2400 kg/m3: Rango normal para hormigon convencional.\n' +
      '- > 2400 kg/m3: Posible exceso de arido grueso y menor trabajabilidad.',
    ]],
    columnStyles: { 0: { cellWidth: CW } },
    styles: {
      fontSize: escala.fontSize - 0.5, cellPadding: escala.cellPadding,
      lineColor: [180, 180, 180], lineWidth: 0.2, textColor: [30, 30, 30], fontStyle: 'italic',
    },
    theme: 'grid',
    didParseCell: (data) => { data.cell.styles.fillColor = [250, 250, 250]; },
  });

  return doc.lastAutoTable.finalY + 3;
}

// ─── Pie de firma (≡ agregarPieFirma en generarPDF.js) ───────────────────────

async function agregarPieFirma(doc, startY, pac = 'Diego Oñate Jorquera', firmaITO = null, fechaProtocolo = null, fechaFirmaITO = null) {
  const fechaPACAdmin = formatearFechaPie(fechaProtocolo);
  const fechaITO      = formatearFechaPie(fechaFirmaITO);
  const colW    = CW / 3;
  const FIRMA_H = 25;

  const firmaPacB64   = FIRMA_B64[pac] ?? FIRMA_B64['Diego Oñate Jorquera'];
  const firmaAdminB64 = FIRMA_B64['Marcelo Contardo Correa'];

  autoTable(doc, {
    startY,
    margin: { left: ML, right: MR, bottom: 0 },
    tableWidth: CW,
    body: [
      [
        { content: `PAC\n${pac}`,                           styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'center', fontSize: 8 } },
        { content: `ITO\nGonzalo Chavarría Sepúlveda`,      styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'center', fontSize: 8 } },
        { content: `ADMINISTRADOR\nMarcelo Contardo Correa`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'center', fontSize: 8 } },
      ],
      [
        { content: '', styles: { minCellHeight: FIRMA_H, halign: 'center', valign: 'middle' } },
        { content: '', styles: { minCellHeight: FIRMA_H, halign: 'center', valign: 'middle' } },
        { content: '', styles: { minCellHeight: FIRMA_H, halign: 'center', valign: 'middle' } },
      ],
      [
        { content: `fecha: ${fechaPACAdmin}`, styles: { halign: 'center', fontSize: 8 } },
        { content: `fecha: ${fechaITO}`,      styles: { halign: 'center', fontSize: 8 } },
        { content: `fecha: ${fechaPACAdmin}`, styles: { halign: 'center', fontSize: 8 } },
      ],
    ],
    columnStyles: { 0: { cellWidth: colW }, 1: { cellWidth: colW }, 2: { cellWidth: colW } },
    styles: { fontSize: 8, cellPadding: 2, lineColor: [120, 120, 120], lineWidth: 0.2, textColor: [30, 30, 30] },
    theme: 'grid',
    pageBreak: 'avoid',
    didDrawCell: (data) => {
      if (data.row.index !== 1) return;
      const { x, y, width, height } = data.cell;

      function dibujarFirma(b64) {
        if (!b64) return;
        try {
          const formato  = detectFormat(b64);
          const imgProps = doc.getImageProperties(b64);
          const imgRatio = imgProps.width / imgProps.height;
          const maxW = width - 8;
          const maxH = height - 6;
          let drawW = maxW;
          let drawH = drawW / imgRatio;
          if (drawH > maxH) { drawH = maxH; drawW = drawH * imgRatio; }
          const drawX = x + (width  - drawW) / 2;
          const drawY = y + (height - drawH) / 2;
          doc.addImage(b64, formato, drawX, drawY, drawW, drawH);
        } catch (err) {
          console.warn('    ⚠ Error incrustar firma:', err?.message ?? err);
        }
      }

      if (data.column.index === 0) dibujarFirma(firmaPacB64);
      if (data.column.index === 1) dibujarFirma(firmaITO);
      if (data.column.index === 2) dibujarFirma(firmaAdminB64);
    },
  });
}

// ─── Página de fotos (≡ agregarPaginaFotos en generarPDF.js) ─────────────────

function tituloFotos(protocolo, km) {
  const kmTxt = `KM ${km.inicio || '—'} hasta KM ${km.fin || '—'}`;
  if (protocolo.tipo === 'caida')     return `REGISTRO FOTOGRÁFICO — CAÍDA ${protocolo.entidadId} — ${kmTxt}`;
  if (protocolo.tipo === 'atravieso') return `REGISTRO FOTOGRÁFICO — ATRAVIESO ${protocolo.entidadId} — ${kmTxt}`;
  return `REGISTRO FOTOGRÁFICO — ${kmTxt}`;
}

async function agregarPaginaFotos(doc, protocolo, fotosBatch, paginaActual, totalPaginas, kmInicio, kmFin, firmaITO, fechaProtocolo, fechaFirmaITO) {
  let y = agregarEncabezado(doc, protocolo, paginaActual, totalPaginas, kmInicio, kmFin);
  const km = resolveKm(protocolo, kmInicio, kmFin);

  doc.setFont(undefined, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(tituloFotos(protocolo, km), PW / 2, y + 4, { align: 'center' });
  y += 10;

  const COLS      = 2;
  const GAP_COL   = 6;
  const GAP_ROW   = 4;
  const DESC_LINE_H = 4.5;
  const DESC_PAD  = 2;
  const cellW     = Math.round((CW - GAP_COL) / COLS);
  const espacioDisponible = PH - 52 - y;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(7.5);

  const maxLineas = Math.max(1, ...fotosBatch.map(foto =>
    foto.descripcion ? doc.splitTextToSize(foto.descripcion, cellW - DESC_PAD * 2).length : 1
  ));
  const descH    = Math.max(7, maxLineas * DESC_LINE_H + DESC_PAD * 2);
  const numRows  = Math.ceil(fotosBatch.length / COLS);
  const imgHMax  = (espacioDisponible - numRows * (GAP_ROW + descH)) / numRows;
  const imgH     = Math.min(100, imgHMax);
  const imgW     = Math.round(imgH * 3 / 4);
  const cellH    = imgH + descH + GAP_ROW;

  for (let i = 0; i < fotosBatch.length; i++) {
    const foto   = fotosBatch[i];
    const col    = i % COLS;
    const row    = Math.floor(i / COLS);
    const x      = ML + col * (cellW + GAP_COL);
    const cellY  = y + row * cellH;
    const photoX = x + Math.round((cellW - imgW) / 2);

    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.2);
    doc.rect(photoX, cellY, imgW, imgH);

    const img = await obtenerImagenBase64(foto);
    if (img) {
      try { doc.addImage(img.dataUrl, img.formato, photoX + 1, cellY + 1, imgW - 2, imgH - 2); }
      catch (err) { console.warn('    ⚠ Error incrustar foto:', err?.message); }
    }

    const lineas = foto.descripcion ? doc.splitTextToSize(foto.descripcion, cellW - DESC_PAD * 2) : [];
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.2);
    doc.rect(x, cellY + imgH, cellW, descH);
    if (lineas.length > 0) {
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 30, 30);
      lineas.forEach((linea, idx) => {
        doc.text(linea, x + DESC_PAD, cellY + imgH + DESC_PAD + DESC_LINE_H * (idx + 0.8));
      });
    }
  }

  await agregarPieFirma(doc, PH - 52, 'Diego Oñate Jorquera', firmaITO, fechaProtocolo, fechaFirmaITO);
}

// ─── construirControlHA (≡ generarPDF.js, adaptado a Node.js) ────────────────

async function construirControlHA(doc, protocolo, camiones, kmInicio, kmFin, totalPaginas, firmaITO, fechaProtocolo, fechaFirmaITO) {
  const escala             = ESCALA_NORMAL;
  const datosProtocolo     = protocolo.datos ?? {};
  const fotosExcluidas     = datosProtocolo.fotosExcluidas ?? [];
  const fotosRecortadasUrls = datosProtocolo.fotosRecortadasUrls ?? {};
  let pagina = 1;

  if (camiones.length === 0) {
    const y = agregarEncabezado(doc, protocolo, 1, totalPaginas, kmInicio, kmFin);
    doc.setFont(undefined, 'italic');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text('Sin camiones registrados', PW / 2, y + 8, { align: 'center' });
    doc.setFont(undefined, 'normal');
    await agregarPieFirma(doc, pieFirmaY(y + 16), 'Diego Oñate Jorquera', firmaITO, fechaProtocolo, fechaFirmaITO);
    return 1;
  }

  const LW2       = 38;
  const VW2       = CW / 2 - LW2;
  const labelStyle = { fontStyle: 'bold', fillColor: [240, 240, 240] };

  for (let i = 0; i < camiones.length; i++) {
    const camion = camiones[i];
    if (i > 0) { doc.addPage(); pagina++; }

    let y = agregarEncabezado(doc, protocolo, pagina, totalPaginas, kmInicio, kmFin);
    if (i === 0) y = agregarTablaInfo(doc, protocolo, y, kmInicio, kmFin, escala);

    const estadoTxt   = camion.estadoCalidad === 'aprobado' ? 'Aprobado' : camion.estadoCalidad === 'rechazado' ? 'Rechazado' : '—';
    const estadoColor = camion.estadoCalidad === 'aprobado' ? [16, 185, 129] : camion.estadoCalidad === 'rechazado' ? [239, 68, 68] : [30, 30, 30];

    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR, ...CONTENT_MARGIN },
      tableWidth: CW,
      body: [
        [{ content: `Camión #${i + 1} — Guía N°${camion.numeroGuia || '—'} — ${camion.tipoHormigon || '—'}`, colSpan: 4, styles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: escala.headFontSize } }],
        [{ content: 'Planta',          styles: labelStyle }, camion.planta        || '—', { content: 'N° Guía',       styles: labelStyle }, camion.numeroGuia  || '—'],
        [{ content: 'Tipo hormigón',   styles: labelStyle }, camion.tipoHormigon  || '—', { content: 'Volumen (m³)', styles: labelStyle }, String(camion.volumen ?? '—')],
        [{ content: 'Cono (cm)',        styles: labelStyle }, String(camion.cono ?? '—'), { content: 'Temp. hormigón', styles: labelStyle }, `${camion.tempHormigon ?? '—'} °C`],
        [{ content: 'Temp. ambiente',  styles: labelStyle }, `${camion.tempAmbiente ?? '—'} °C`, { content: 'Hora de carga', styles: labelStyle }, camion.horaCarga || '—'],
        [{ content: 'Hora de descarga', styles: labelStyle }, camion.horaDescarga || '—', { content: 'Tiempo traslado', styles: labelStyle }, `${camion.tiempoTraslado ?? '—'} min`],
        [{ content: 'Estado', styles: labelStyle }, { content: estadoTxt, colSpan: 3, styles: { fontStyle: 'bold', textColor: estadoColor } }],
      ],
      columnStyles: { 0: { cellWidth: LW2 }, 1: { cellWidth: VW2 }, 2: { cellWidth: LW2 }, 3: { cellWidth: VW2 } },
      styles: { fontSize: escala.fontSize, cellPadding: escala.cellPadding, lineColor: [120, 120, 120], lineWidth: 0.2, textColor: [30, 30, 30] },
      theme: 'grid',
    });

    y = doc.lastAutoTable.finalY + 4;
    y = agregarEnsayoPesoUnitario(doc, camion, y, escala);
    await agregarPieFirma(doc, pieFirmaY(y), 'Diego Oñate Jorquera', firmaITO, fechaProtocolo, fechaFirmaITO);

    // Fotos del camión
    const fotosParaPDF = [];
    if (camion.fotoGuiaUrl && !fotosExcluidas.includes(camion.fotoGuiaUrl)) {
      fotosParaPDF.push({ storageUrl: camion.fotoGuiaUrl, storageUrlRecortado: fotosRecortadasUrls[camion.fotoGuiaUrl] ?? null, descripcion: 'Guia de despacho' });
    }
    for (const url of (camion.fotosEnsayoUrls ?? [])) {
      if (!fotosExcluidas.includes(url))
        fotosParaPDF.push({ storageUrl: url, storageUrlRecortado: fotosRecortadasUrls[url] ?? null, descripcion: 'Foto del ensayo' });
    }
    const galeriaHA = (datosProtocolo.fotosGaleriaHA ?? {})[camion.supabaseId] ?? [];
    for (const foto of galeriaHA)
      fotosParaPDF.push({ storageUrl: foto.storageUrl, storageUrlRecortado: null, descripcion: foto.descripcion || 'Foto de galería' });

    const FOTOS_POR_PAGINA_HA = 4;
    for (let fi = 0; fi < fotosParaPDF.length; fi += FOTOS_POR_PAGINA_HA) {
      doc.addPage();
      pagina++;
      await agregarPaginaFotos(
        doc, protocolo, fotosParaPDF.slice(fi, fi + FOTOS_POR_PAGINA_HA),
        pagina, totalPaginas, kmInicio, kmFin,
        firmaITO, fechaProtocolo, fechaFirmaITO,
      );
    }
  }

  return pagina;
}

async function generarPDFControlHA(protocolo, camiones, kmInicio, kmFin, firmaITO, fechaProtocolo, fechaFirmaITO) {
  // Primera pasada: contar páginas
  let doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const totalPaginas = await construirControlHA(doc, protocolo, camiones, kmInicio, kmFin, 1, firmaITO, fechaProtocolo, fechaFirmaITO);
  // Segunda pasada: dibujar con el total correcto
  doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await construirControlHA(doc, protocolo, camiones, kmInicio, kmFin, totalPaginas, firmaITO, fechaProtocolo, fechaFirmaITO);
  return doc;
}

// ─── Mapeo de fila de DB a objeto camión (≡ Firma.jsx) ───────────────────────

function mapCamion(r) {
  return {
    key:              `sb-${r.id}`,
    supabaseId:       r.id,
    localId:          r.local_id ?? null,
    tipoEntidad:      r.tipo_entidad,
    entidadId:        r.entidad_id,
    tipoHormigon:     r.tipo_hormigon,
    volumen:          r.volumen,
    numeroGuia:       r.numero_guia,
    planta:           r.planta,
    cono:             r.cono,
    tempHormigon:     r.temp_hormigon,
    tempAmbiente:     r.temp_ambiente,
    horaCarga:        r.hora_carga,
    horaDescarga:     r.hora_descarga,
    tiempoTraslado:   r.tiempo_traslado,
    puCalculado:      r.pu_calculado,
    observaciones:    r.observaciones,
    usuarioNombre:    r.usuario_nombre,
    fechaRecepcion:   r.fecha_recepcion,
    pesoHoyaHormigon: r.peso_hoya_hormigon,
    estadoCalidad:    r.estado_calidad ?? null,
    fotoGuiaUrl:      r.foto_guia_url ?? null,
    fotosEnsayoUrls:  r.fotos_ensayo_urls ?? [],
  };
}

// ─── Procesamiento de un protocolo ───────────────────────────────────────────

async function procesarProtocolo(id, idx, total) {
  const prefix = `[${String(idx + 1).padStart(2)}/${total}]`;

  // 1. Fetch protocolo base + datos por separado (como en Firma.jsx)
  const [{ data: row, error: errRow }, { data: datosRow }] = await Promise.all([
    supabase.from('protocolos').select('*').eq('id', id).single(),
    supabase.from('protocolos').select('datos').eq('id', id).single(),
  ]);

  if (errRow || !row) {
    console.log(`${prefix} ❌ ERROR: protocolo no encontrado — ${errRow?.message ?? 'sin datos'}`);
    return false;
  }

  const datos = datosRow?.datos ?? row.datos ?? {};
  const label = `${row.protocolo_id} ${NOMBRES_TIPO[row.tipo] ?? row.tipo} ${row.entidad_id}`;

  // 2. Verificar firma disponible
  if (!row.firma_imagen_url) {
    console.log(`${prefix} ⚠ SKIP: sin firma_imagen_url — ${label}`);
    return false;
  }

  // 3. Descargar imagen de firma del ITO
  const firmaBase64 = await descargarFirmaBase64(row.firma_imagen_url);
  if (!firmaBase64) {
    console.log(`${prefix} ❌ ERROR: no se pudo descargar la firma — ${label}`);
    return false;
  }

  // 4. Fetch camiones (≡ generarBlobPDF en Firma.jsx)
  const uso = row.protocolo_id === 'HA_RADIER' ? 'radier' : 'muro';
  const { data: camionesData } = await supabase
    .from('camiones')
    .select('*')
    .eq('tipo_entidad', row.tipo)
    .eq('entidad_id', String(row.entidad_id))
    .eq('uso_hormigon', uso)
    .in('tipo_hormigon', ['G20', 'G25', 'G30']);

  let camiones = (camionesData ?? []).map(mapCamion);

  // Filtrar al camión seleccionado al enviar
  // datos.camionId es UUID puro (sin prefijo sb-)
  const camionId = datos?.camionId;
  if (camionId && camionId !== 'todos') {
    camiones = camiones.filter(c => c.supabaseId === camionId);
  }

  // 5. Construir objeto protocolo mapeado (≡ confirmarFirma en Firma.jsx)
  const protocoloCompleto = {
    id:                row.id,
    protocoloId:       row.protocolo_id,
    tipo:              row.tipo,
    entidadId:         row.entidad_id,
    estado:            row.estado,
    edp:               row.edp ?? null,
    fechaEnvio:        row.fecha_envio ?? null,
    usuarioNombre:     row.usuario_nombre ?? null,
    fechaCreacion:     row.fecha_creacion ?? null,
    fechaModificacion: row.fecha_modificacion ?? null,
    supabaseId:        row.id,
    datos,
  };

  const kmInicio       = datos?.kmInicio ?? '';
  const kmFin          = datos?.kmFin ?? '';
  const fechaProtocolo = datos?.fechaProtocolo ?? datos?.fechaControl ?? row.fecha_creacion ?? null;
  const fechaFirmaITO  = row.firma_fecha ?? null;

  // 6. Generar PDF
  let doc;
  try {
    doc = await generarPDFControlHA(protocoloCompleto, camiones, kmInicio, kmFin, firmaBase64, fechaProtocolo, fechaFirmaITO);
  } catch (err) {
    console.log(`${prefix} ❌ ERROR generando PDF: ${err?.message ?? err} — ${label}`);
    return false;
  }

  // 7. Subir a Storage (upsert reemplaza el existente)
  const pdfPath   = `protocolos/firmados/${row.id}.pdf`;
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  const { error: uploadErr } = await supabase.storage
    .from('fotos-canal-arauco')
    .upload(pdfPath, pdfBuffer, { upsert: true, contentType: 'application/pdf' });

  if (uploadErr) {
    console.log(`${prefix} ❌ ERROR subiendo PDF: ${uploadErr.message} — ${label}`);
    return false;
  }

  const { data: pdfData } = supabase.storage.from('fotos-canal-arauco').getPublicUrl(pdfPath);

  // 8. Actualizar pdf_firmado_url en la tabla
  const { error: updateErr } = await supabase
    .from('protocolos')
    .update({ pdf_firmado_url: pdfData.publicUrl, fecha_modificacion: new Date().toISOString() })
    .eq('id', row.id);

  if (updateErr) {
    console.log(`${prefix} ❌ ERROR actualizando DB: ${updateErr.message} — ${label}`);
    return false;
  }

  console.log(`${prefix} ✅ OK — ${label}`);
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const total = IDS_HA.length;
  console.log(`\n🔄 Regenerando ${total} PDFs firmados HA...\n`);

  let ok   = 0;
  let fail = 0;

  for (let i = 0; i < total; i++) {
    const exitoso = await procesarProtocolo(IDS_HA[i], i, total);
    if (exitoso) ok++;
    else         fail++;
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`✅ ${ok} exitosos  /  ❌ ${fail} fallidos  (total: ${total})`);
  console.log(`${'─'.repeat(40)}\n`);
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
