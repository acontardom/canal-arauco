import ExcelJS from 'exceljs';

// Items actuales del checklist — se actualizarán cuando lleguen los checklists reales
const ITEMS_CHECKLIST = [
  'Item de verificación 1',
  'Item de verificación 2',
  'Item de verificación 3',
  'Item de verificación 4',
  'Item de verificación 5',
];

const NOMBRES_PROTOCOLO = {
  PICE1:       'PICE1 Excavación',
  PICE2_RADIER: 'PICE2 Radier',
  PICE2_MURO:  'PICE2 Muro',
  PICE3:       'PICE3 Moldaje',
  PICE4:       'PICE4 Enfierradura',
  G5:          'G5 Emplantillado',
  CONTROL_HA:  'Control H.A.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatFechaArchivo(iso) {
  if (!iso) return 'sin_fecha';
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${mm}${dd}`;
}

function getImgExtension(dataUrl) {
  const match = dataUrl?.match(/^data:image\/(\w+);base64/);
  const raw = match?.[1]?.toLowerCase();
  if (raw === 'jpeg' || raw === 'jpg') return 'jpeg';
  if (raw === 'png') return 'png';
  if (raw === 'gif') return 'gif';
  return 'jpeg'; // webp y otros → ExcelJS no los soporta, se mandan como jpeg
}

// ─── Estilos reutilizables ────────────────────────────────────────────────────

const C = {
  darkBlue:  'FF0F3460',
  white:     'FFFFFFFF',
  lightBlue: 'FFE8F0FB',
  lightGray: 'FFF8F9FA',
  descBg:    'FFF0F4F8',
  muted:     'FF999999',
  green:     'FF10B981',
  red:       'FFEF4444',
  border:    'FFD0D8E4',
};

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function border() {
  const side = { style: 'thin', color: { argb: C.border } };
  return { top: side, left: side, bottom: side, right: side };
}

function applyHeader(cell, text, bgArgb = C.darkBlue) {
  cell.value = text;
  cell.font = { bold: true, size: 11, color: { argb: C.white } };
  cell.fill = fill(bgArgb);
  cell.border = border();
  cell.alignment = { vertical: 'middle' };
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function generarExcel(protocolo, fotos = []) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Canal Arauco';
  wb.created = new Date();

  const ws = wb.addWorksheet('Protocolo', {
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  });

  ws.getColumn(1).width = 52; // contenido principal / imágenes
  ws.getColumn(2).width = 22; // estado / valores cortos

  const entidad = protocolo.tipo === 'tramo'
    ? `Tramo ${protocolo.entidadId}`
    : `Caída ${protocolo.entidadId}`;

  const nombreProtocolo = NOMBRES_PROTOCOLO[protocolo.protocoloId] ?? protocolo.protocoloId;
  const checklist = protocolo.datos?.checklist ?? [];
  const observaciones = protocolo.datos?.observaciones ?? '';

  let r = 1; // fila actual (1-indexed)

  // ── Fila 1: Título ───────────────────────────────────────────────────────────
  ws.mergeCells(`A${r}:B${r}`);
  const titleCell = ws.getCell(`A${r}`);
  titleCell.value = nombreProtocolo;
  titleCell.font = { bold: true, size: 16, color: { argb: C.white } };
  titleCell.fill = fill(C.darkBlue);
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.border = border();
  ws.getRow(r).height = 34;
  r++;

  // ── Filas 2-6: Metadatos del protocolo ───────────────────────────────────────
  const metaRows = [
    ['Proyecto',    'Canal Arauco — Arauco S.A.'],
    ['Entidad',     entidad],
    ['Fecha',       formatFecha(protocolo.fechaModificacion)],
    ['Responsable', protocolo.usuarioNombre ?? ''],
    ['Estado',      protocolo.estado === 'completado' ? '✓ Completado' : '◐ Borrador'],
  ];

  metaRows.forEach(([label, value]) => {
    const row = ws.getRow(r);

    const cA = row.getCell(1);
    cA.value = label;
    cA.font = { bold: true, size: 11 };
    cA.fill = fill(C.lightBlue);
    cA.border = border();
    cA.alignment = { vertical: 'middle' };

    const cB = row.getCell(2);
    cB.value = value;
    cB.font = { size: 11 };
    cB.border = border();
    cB.alignment = { vertical: 'middle' };

    row.height = 20;
    r++;
  });

  // ── Separador ────────────────────────────────────────────────────────────────
  ws.getRow(r).height = 10;
  r++;

  // ── Checklist: encabezado de columnas ────────────────────────────────────────
  {
    const row = ws.getRow(r);
    applyHeader(row.getCell(1), 'ITEM DE VERIFICACIÓN');
    applyHeader(row.getCell(2), 'ESTADO');
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 22;
    r++;
  }

  // ── Checklist: items ─────────────────────────────────────────────────────────
  ITEMS_CHECKLIST.forEach((item, i) => {
    const checked = checklist[i] === true;
    const bgArgb = i % 2 === 0 ? C.lightGray : C.white;
    const row = ws.getRow(r);

    const cA = row.getCell(1);
    cA.value = item;
    cA.fill = fill(bgArgb);
    cA.border = border();
    cA.alignment = { vertical: 'middle' };
    cA.font = { size: 11 };

    const cB = row.getCell(2);
    cB.value = checked ? '✓' : '✗';
    cB.font = { bold: true, size: 13, color: { argb: checked ? C.green : C.red } };
    cB.fill = fill(bgArgb);
    cB.border = border();
    cB.alignment = { vertical: 'middle', horizontal: 'center' };

    row.height = 20;
    r++;
  });

  // ── Separador ────────────────────────────────────────────────────────────────
  ws.getRow(r).height = 10;
  r++;

  // ── Observaciones ────────────────────────────────────────────────────────────
  ws.mergeCells(`A${r}:B${r}`);
  applyHeader(ws.getCell(`A${r}`), 'OBSERVACIONES');
  ws.getRow(r).height = 22;
  r++;

  ws.mergeCells(`A${r}:B${r}`);
  const obsCell = ws.getCell(`A${r}`);
  obsCell.value = observaciones || '(sin observaciones)';
  obsCell.font = observaciones
    ? { size: 11 }
    : { size: 11, italic: true, color: { argb: C.muted } };
  obsCell.fill = fill(C.lightGray);
  obsCell.alignment = { wrapText: true, vertical: 'top' };
  obsCell.border = border();
  ws.getRow(r).height = observaciones
    ? Math.max(40, Math.ceil(observaciones.length / 90) * 18)
    : 30;
  r++;

  // ── Fotos ────────────────────────────────────────────────────────────────────
  if (fotos.length > 0) {
    // Separador
    ws.getRow(r).height = 10;
    r++;

    // Encabezado de sección fotos
    ws.mergeCells(`A${r}:B${r}`);
    applyHeader(ws.getCell(`A${r}`), `FOTOS (${fotos.length})`);
    ws.getRow(r).height = 22;
    r++;

    for (const foto of fotos) {
      // ── Fila de imagen ────────────────────────────────────────────────────────
      try {
        const ext = getImgExtension(foto.dataUrl);
        const base64 = foto.dataUrl?.split(',')[1];
        if (!base64) throw new Error('dataUrl vacío');

        const imageId = wb.addImage({ base64, extension: ext });

        // tl usa coordenadas 0-indexed (row: r-1 para fila 1-indexed r)
        ws.addImage(imageId, {
          tl: { col: 0, row: r - 1 },
          ext: { width: 400, height: 300 },
          editAs: 'oneCell',
        });
      } catch (err) {
        console.warn('No se pudo incrustar imagen:', foto.nombre, err);
        const errCell = ws.getCell(`A${r}`);
        errCell.value = `[Imagen no disponible: ${foto.nombre ?? ''}]`;
        errCell.font = { italic: true, color: { argb: C.muted } };
      }

      // Altura suficiente para 300px de imagen (300px ÷ 1.333 px/pt ≈ 225 pt)
      ws.mergeCells(`A${r}:B${r}`);
      ws.getRow(r).height = 226;
      r++;

      // ── Fila de descripción ────────────────────────────────────────────────────
      ws.mergeCells(`A${r}:B${r}`);
      const descCell = ws.getCell(`A${r}`);
      descCell.value = foto.descripcion || '(sin descripción)';
      descCell.font = foto.descripcion
        ? { size: 10 }
        : { size: 10, italic: true, color: { argb: C.muted } };
      descCell.fill = fill(C.descBg);
      descCell.alignment = { vertical: 'middle', indent: 1 };
      descCell.border = border();
      ws.getRow(r).height = 20;
      r++;

      // ── Pequeño gap entre fotos ────────────────────────────────────────────────
      ws.getRow(r).height = 6;
      r++;
    }
  }

  // ── Generar y descargar ───────────────────────────────────────────────────────
  const tipoLabel = protocolo.tipo === 'tramo' ? 'Tramo' : 'Caida';
  const entidadStr = String(protocolo.entidadId).replace(/\s+/g, '');
  const fechaStr = formatFechaArchivo(protocolo.fechaModificacion);
  const filename = `${protocolo.protocoloId}_${tipoLabel}${entidadStr}_${fechaStr}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
