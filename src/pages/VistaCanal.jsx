import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KM_DATA, PARTIDAS, nombreEntidad } from '../constants/estructura';
import { supabase } from '../config/supabase';

// ── Estructura lineal del canal ───────────────────────────────────────────────

const ORDEN_CANAL = [
  {tipo:'tramo',id:'A'},{tipo:'caida',id:'1'},
  {tipo:'tramo',id:'B'},{tipo:'caida',id:'2'},
  {tipo:'tramo',id:'C'},{tipo:'caida',id:'3'},
  {tipo:'tramo',id:'D'},{tipo:'caida',id:'4'},
  {tipo:'tramo',id:'E'},{tipo:'caida',id:'5'},
  {tipo:'tramo',id:'F'},{tipo:'caida',id:'6'},
  {tipo:'tramo',id:'G'},{tipo:'caida',id:'7'},
  {tipo:'tramo',id:'H'},{tipo:'caida',id:'8'},
  {tipo:'tramo',id:'I'},{tipo:'caida',id:'9'},
  {tipo:'tramo',id:'J'},{tipo:'caida',id:'10'},
  {tipo:'tramo',id:'K'},{tipo:'caida',id:'11'},
  {tipo:'tramo',id:'L'},{tipo:'caida',id:'12'},
  {tipo:'tramo',id:'M'},{tipo:'caida',id:'13'},
  {tipo:'tramo',id:'N1'},{tipo:'atravieso',id:'1'},{tipo:'tramo',id:'N2'},
  {tipo:'caida',id:'14'},{tipo:'tramo',id:'O'},{tipo:'caida',id:'15'},
  {tipo:'tramo',id:'P'},{tipo:'caida',id:'16'},
  {tipo:'tramo',id:'Q'},{tipo:'caida',id:'17'},
  {tipo:'tramo',id:'R'},{tipo:'caida',id:'18'},
  {tipo:'tramo',id:'S'},{tipo:'caida',id:'19'},
  {tipo:'tramo',id:'T'},{tipo:'caida',id:'20'},
  {tipo:'tramo',id:'U'},{tipo:'caida',id:'21'},
  {tipo:'tramo',id:'V'},{tipo:'caida',id:'22'},
  {tipo:'tramo',id:'W'},{tipo:'caida',id:'23'},
  {tipo:'tramo',id:'X'},{tipo:'caida',id:'24'},
  {tipo:'tramo',id:'Y1'},{tipo:'atravieso',id:'2'},{tipo:'tramo',id:'Y2'},
  {tipo:'caida',id:'25'},{tipo:'tramo',id:'Z'},{tipo:'caida',id:'26'},
  {tipo:'tramo',id:'AZ'},{tipo:'caida',id:'27'},
  {tipo:'tramo',id:'BZ'},{tipo:'caida',id:'28'},
  {tipo:'tramo',id:'CZ'},{tipo:'caida',id:'29'},
  {tipo:'tramo',id:'DZ'},
];

const PARTIDAS_DISPLAY = [
  { id: 'excavacion',      label: 'EXC', nombre: 'Excavación' },
  { id: 'emplantillado',   label: 'EMP', nombre: 'Emplantillado' },
  { id: 'enfierradura',    label: 'ENF', nombre: 'Enfierradura' },
  { id: 'hormigon_radier', label: 'H-R', nombre: 'Horm. Radier' },
  { id: 'moldaje',         label: 'MOL', nombre: 'Moldaje' },
  { id: 'hormigon_muro',   label: 'H-M', nombre: 'Horm. Muro' },
];

const BORDE_TOP   = { tramo: '#06b6d4', caida: '#6b7280', atravieso: '#a855f7' };
const BORDE_COLOR = { tramo: 'rgba(6,182,212,0.4)', caida: 'rgba(107,114,128,0.4)', atravieso: 'rgba(168,85,247,0.4)' };
const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

function cardLabel(tipo, id) {
  if (tipo === 'atravieso') return `AT${id}`;
  if (tipo === 'caida') return `C${id}`;
  return id;
}

function parseKm(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

function largoMetros(tipo, id) {
  const d = KM_DATA[tipo]?.[String(id)];
  if (!d) return null;
  return Math.round((parseKm(d.fin) - parseKm(d.inicio)) * 10) / 10;
}

function chunks(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

const FILAS_CANAL = chunks(ORDEN_CANAL, 6);

// ─────────────────────────────────────────────────────────────────────────────

const GRID_CSS = `
  .canal-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    column-gap: 4px;
    row-gap: 8px;
  }
  @media (max-width: 1024px) {
    .canal-grid { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 768px) {
    .canal-grid { grid-template-columns: repeat(2, 1fr); }
    .canal-subtitle { display: none; }
  }
`;

export default function VistaCanal() {
  const navigate  = useNavigate();
  const [avanceSet, setAvanceSet] = useState(new Set());
  const [cargando, setCargando]   = useState(true);
  const [popup, setPopup]         = useState(null);

  useEffect(() => {
    if (!supabase) { setCargando(false); return; }
    supabase
      .from('avance')
      .select('tipo_entidad,entidad_id,partida_id')
      .then(({ data }) => {
        setAvanceSet(new Set(
          (data ?? []).map(r => `${r.tipo_entidad}-${r.entidad_id}-${r.partida_id}`)
        ));
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  function recepcionadasCount(tipo, id) {
    return PARTIDAS_DISPLAY.filter(p => avanceSet.has(`${tipo}-${id}-${p.id}`)).length;
  }

  function exportarExcel() {
    const TIPO_LABEL = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
    const header = ['Entidad', 'Tipo', 'Largo (m)', ...PARTIDAS_DISPLAY.map(p => p.nombre)];
    const filas = ORDEN_CANAL.map(({ tipo, id }) => {
      const label = cardLabel(tipo, id);
      const largo = largoMetros(tipo, id) ?? '';
      const celdas = PARTIDAS_DISPLAY.map(p =>
        avanceSet.has(`${tipo}-${id}-${p.id}`) ? 'Listo' : 'Pendiente'
      );
      return [label, TIPO_LABEL[tipo], largo, ...celdas];
    });
    const csvContent = [header, ...filas]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const bom = '﻿';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avance_canal_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function navAvance(tipo, id, partida = null) {
    const params = new URLSearchParams({ tipo, entidad: id });
    if (partida) params.set('partida', partida);
    navigate(`/recepcionar-avance?${params.toString()}`);
    setPopup(null);
  }

  const popupKm = popup ? KM_DATA[popup.tipo]?.[String(popup.id)] : null;

  return (
    <div style={s.page}>
      <style>{GRID_CSS}</style>

      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Vista Canal</h1>
          <p className="canal-subtitle" style={s.subtitulo}>Avance por partida a lo largo del canal</p>
        </div>
        {!cargando && (
          <button style={s.btnExportar} onClick={exportarExcel} title="Exportar matriz a Excel (CSV)">
            ↓ Excel
          </button>
        )}
      </div>

      {cargando ? (
        <p style={s.cargandoTxt}>Cargando datos de avance...</p>
      ) : (
        <div>
          {FILAS_CANAL.map((fila, fi) => (
            <div key={fi}>
              <div className="canal-grid">
                {fila.map(({ tipo, id }) => (
                  <Tarjeta
                    key={`${tipo}-${id}`}
                    tipo={tipo}
                    id={id}
                    avanceSet={avanceSet}
                    onClick={() => setPopup({ tipo, id })}
                    onDotClick={(e, partidaId) => { e.stopPropagation(); navAvance(tipo, id, partidaId); }}
                  />
                ))}
              </div>
              {fi < FILAS_CANAL.length - 1 && (
                <div style={s.lineaCanal}>
                  <span style={s.lineaCanalArrow}>→</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Popup detalle */}
      {popup && (
        <div style={s.overlay} onClick={() => setPopup(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <button style={s.modalCerrar} onClick={() => setPopup(null)}>✕</button>

            <h2 style={s.modalTitulo}>{nombreEntidad(popup.tipo, popup.id)}</h2>

            {popupKm && (
              <div style={s.modalKmRow}>
                <span style={s.modalKmBadge}>KM {popupKm.inicio} — {popupKm.fin}</span>
                {largoMetros(popup.tipo, popup.id) !== null && (
                  <span style={s.modalLargo}>{largoMetros(popup.tipo, popup.id).toLocaleString('es-CL')} m</span>
                )}
              </div>
            )}

            <p style={s.modalAvanceResumen}>
              {recepcionadasCount(popup.tipo, popup.id)}/6 partidas recepcionadas
            </p>

            <div style={s.modalPartidas}>
              {PARTIDAS_DISPLAY.map(p => {
                const rec = avanceSet.has(`${popup.tipo}-${popup.id}-${p.id}`);
                const nombre = PARTIDAS.find(pa => pa.id === p.id)?.nombre ?? p.id;
                return (
                  <div
                    key={p.id}
                    style={{ ...s.modalFila, ...(rec ? s.modalFilaVerde : s.modalFilaAmarillo) }}
                    onClick={() => navAvance(popup.tipo, popup.id, p.id)}
                  >
                    <span style={s.modalPunto}>{rec ? '🟢' : '🟡'}</span>
                    <span style={s.modalPartidaLabel}>{nombre}</span>
                    <span style={s.modalAbrev}>({p.label})</span>
                    <span style={s.modalFlecha}>›</span>
                  </div>
                );
              })}
            </div>

            <button style={s.btnVerAvance} onClick={() => navAvance(popup.tipo, popup.id)}>
              Ver avance completo →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta individual ────────────────────────────────────────────────────────

function Tarjeta({ tipo, id, avanceSet, onClick, onDotClick }) {
  const metros = largoMetros(tipo, id);
  const mostrarMetros = metros !== null && metros > 0;
  const count = PARTIDAS_DISPLAY.filter(p => avanceSet.has(`${tipo}-${id}-${p.id}`)).length;
  const metricColor = count === 6 ? '#10b981' : count > 0 ? '#f59e0b' : '#6b7280';

  return (
    <div
      style={{
        ...s.tarjeta,
        border: `1px solid ${BORDE_COLOR[tipo]}`,
        borderTop: `3px solid ${BORDE_TOP[tipo]}`,
      }}
      onClick={onClick}
      title={`${nombreEntidad(tipo, id)} — click para ver detalle`}
    >
      <span style={s.tarjetaNombre}>{cardLabel(tipo, id)}</span>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: metricColor }}>{count}/6</span>
        {mostrarMetros && (
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>{metros} m</span>
        )}
      </div>

      <div style={s.tarjetaSep} />

      <div style={s.puntosCol}>
        {PARTIDAS_DISPLAY.map(p => {
          const rec = avanceSet.has(`${tipo}-${id}-${p.id}`);
          return (
            <div
              key={p.id}
              style={s.puntoRow}
              onClick={e => onDotClick(e, p.id)}
              title={`${p.nombre}: ${rec ? 'Recepcionado ✓' : 'Pendiente'}`}
            >
              <div style={{ ...s.punto, background: rec ? '#10b981' : '#f59e0b' }} />
              <span style={{ ...s.puntoLabel, color: rec ? '#a7f3d0' : '#6b7280' }}>
                {p.nombre}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = {
  page: { padding: '0 0 48px' },
  header: { marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  btnExportar: {
    padding: '7px 14px', background: '#166534', color: '#bbf7d0',
    border: '1px solid #16a34a', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    flexShrink: 0, marginTop: '2px',
  },
  titulo: { color: '#64ffda', fontWeight: 800, margin: '0 0 4px', fontSize: '22px' },
  subtitulo: { color: '#8892b0', fontSize: '13px', margin: 0 },
  cargandoTxt: { color: '#8892b0', fontSize: '14px' },

  lineaCanal: {
    position: 'relative', width: '100%', height: '2px',
    backgroundColor: 'rgba(6,182,212,0.3)',
    margin: '8px 0', borderRadius: '1px',
  },
  lineaCanalArrow: {
    position: 'absolute', right: '8px', top: '-9px',
    fontSize: '11px', color: 'rgba(6,182,212,0.6)',
    letterSpacing: '1px',
  },

  tarjeta: {
    background: '#0f172a',
    borderRadius: '8px',
    padding: '10px 10px 10px',
    cursor: 'pointer',
    userSelect: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  tarjetaNombre: {
    fontSize: '18px', fontWeight: 700,
    color: '#e2e8f0', textAlign: 'center',
    whiteSpace: 'nowrap', lineHeight: 1,
    marginBottom: '6px',
  },
  tarjetaSep: {
    width: '80%', height: '1px',
    background: 'rgba(255,255,255,0.08)',
    marginBottom: '6px', flexShrink: 0,
  },
  puntosCol: {
    display: 'flex', flexDirection: 'column',
    gap: '3px', width: '100%',
  },
  puntoRow: {
    display: 'flex', alignItems: 'center',
    gap: '4px', cursor: 'pointer',
  },
  punto: {
    width: 7, height: 7, borderRadius: '50%',
    flexShrink: 0,
  },
  puntoLabel: {
    fontSize: '11px', lineHeight: 1.2,
    userSelect: 'none',
  },

  // Modal popup (sin cambios)
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  modal: { background: '#16213e', border: '1px solid #0f3460', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '360px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' },
  modalCerrar: { position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#8892b0', fontSize: '18px', cursor: 'pointer', lineHeight: 1 },
  modalTitulo: { color: '#64ffda', fontSize: '18px', fontWeight: 800, margin: 0 },
  modalKmRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  modalKmBadge: { background: '#0f3460', color: '#ccd6f6', fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: '1px solid #1e3a5f' },
  modalLargo: { color: '#8892b0', fontSize: '12px' },
  modalAvanceResumen: { color: '#ccd6f6', fontSize: '13px', fontWeight: 600, margin: 0 },
  modalPartidas: { display: 'flex', flexDirection: 'column', gap: '4px' },
  modalFila: { display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid transparent' },
  modalFilaVerde:    { background: 'rgba(16,185,129,0.1)',  borderColor: 'rgba(16,185,129,0.2)' },
  modalFilaAmarillo: { background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)' },
  modalPunto: { fontSize: '14px', lineHeight: 1, flexShrink: 0 },
  modalPartidaLabel: { color: '#ccd6f6', fontSize: '13px', fontWeight: 600, flex: 1 },
  modalAbrev: { color: '#8892b0', fontSize: '11px' },
  modalFlecha: { color: '#8892b0', fontSize: '16px' },
  btnVerAvance: { padding: '10px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', width: '100%' },
};
