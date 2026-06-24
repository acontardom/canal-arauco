import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/Logo_ExMaq.jpg';

const PW = 210, PH = 297, ML = 14, MR = 14, CW = 182;

const TIPO_LABEL = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

const PARTIDA_LABEL = {
  radier:     'Radier',
  muros:      'Muros',
  piso:       'Piso',
  muros_losa: 'Muros + Losa',
};

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

export async function generarPDFCubicaciones(items, libres, params, volRadier, volMuros) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const logoB64 = await loadLogoB64();

  const hoy = new Date();
  const fechaStr = `${String(hoy.getDate()).padStart(2,'0')}/${String(hoy.getMonth()+1).padStart(2,'0')}/${hoy.getFullYear()}`;

  // ── Encabezado ─────────────────────────────────────────────────────────────

  if (logoB64) {
    try { doc.addImage(logoB64, 'JPEG', ML, 8, 28, 16); }
    catch { /* logo opcional */ }
  }

  doc.setFont(undefined, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text('PLANIFICACION DE HORMIGONES', ML + 32, 14);

  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Fecha: ${fechaStr}`, ML + 32, 20);
  doc.text('Proyecto: Construccion Canal Siberia - Seccion Los Litres', ML + 32, 25);

  let y = 32;

  // ── Tabla de items ──────────────────────────────────────────────────────────

  const bodyItems = items.map(item => [
    `${TIPO_LABEL[item.tipo] ?? item.tipo} ${item.entidadId}`,
    PARTIDA_LABEL[item.partida] ?? item.partida,
    item.tipoHormigon,
    item.formula,
    `${item.volumen.toFixed(2)} m3`,
  ]);

  libres.filter(l => l.l && l.a && l.h).forEach(l => {
    const vol = parseFloat(l.l) * parseFloat(l.a) * parseFloat(l.h);
    if (isNaN(vol)) return;
    bodyItems.push([
      l.desc || 'Libre',
      '-',
      l.tipo === 'radier' ? '90-40-08' : '90-20-08',
      `${l.l} x ${l.a} x ${l.h}`,
      `${vol.toFixed(2)} m3`,
    ]);
  });

  if (bodyItems.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      tableWidth: CW,
      head: [['Entidad', 'Partida', 'Hormigon', 'Formula', 'm3']],
      body: bodyItems,
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 26 },
        2: { cellWidth: 26 },
        3: { cellWidth: 76 },
        4: { cellWidth: 24, halign: 'right' },
      },
      styles: { fontSize: 8, cellPadding: 2, lineColor: [180, 180, 180], lineWidth: 0.2 },
      headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold' },
      theme: 'grid',
    });
    y = doc.lastAutoTable.finalY + 6;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Sin items de calculo.', ML, y + 4);
    y += 12;
  }

  // ── Resumen ─────────────────────────────────────────────────────────────────

  const camionesRadier = volRadier > 0 ? Math.ceil(volRadier / params.volumenCamion) : 0;
  const camionesMuros  = volMuros  > 0 ? Math.ceil(volMuros  / params.volumenCamion) : 0;

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    head: [['Tipo Hormigon', 'Volumen Total', 'Camiones Necesarios']],
    body: [
      ['Radier - 90-40-08', `${volRadier.toFixed(2)} m3`, `${camionesRadier} camiones (a ${params.volumenCamion} m3 c/u)`],
      ['Muros - 90-20-08',  `${volMuros.toFixed(2)} m3`,  `${camionesMuros} camiones (a ${params.volumenCamion} m3 c/u)`],
    ],
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 56, halign: 'center' },
      2: { cellWidth: 56, halign: 'center' },
    },
    styles: { fontSize: 9, cellPadding: 3, lineColor: [180, 180, 180], lineWidth: 0.2 },
    headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold' },
    didParseCell: data => {
      if (data.section !== 'body') return;
      if (data.row.index === 0) data.cell.styles.textColor = [21, 101, 192];
      if (data.row.index === 1) data.cell.styles.textColor = [160, 100, 0];
    },
    theme: 'grid',
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── Pie: parámetros usados ──────────────────────────────────────────────────

  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Parametros: espesor radier ${params.espesorRadier}m · espesor muro ${params.espesorMuro}m · alto muro ${params.altoMuroTramo}m · ancho interior ${params.anchoInterior}m · vol. camion ${params.volumenCamion}m3`,
    ML, y
  );

  // ── Guardar ─────────────────────────────────────────────────────────────────

  const fechaArchivo = `${hoy.getFullYear()}${String(hoy.getMonth()+1).padStart(2,'0')}${String(hoy.getDate()).padStart(2,'0')}`;
  doc.save(`cubicaciones_${fechaArchivo}.pdf`);
}
