import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KM_DATA, PARTIDAS } from '../constants/estructura';
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

// 6 partidas en orden de display
const PARTIDAS_DISPLAY = [
  { id: 'excavacion',      label: 'EXC' },
  { id: 'emplantillado',   label: 'EMP' },
  { id: 'enfierradura',    label: 'ENF' },
  { id: 'hormigon_radier', label: 'H-R' },
  { id: 'moldaje',         label: 'MOL' },
  { id: 'hormigon_muro',   label: 'H-M' },
];

const CARD_W   = { tramo: 70, caida: 45, atravieso: 55 };
const CARD_H   = 116; // altura fija para todas las tarjetas
const CARD_BG  = { tramo: '#0c2340', caida: '#1a1a30', atravieso: '#1a0a30' };
const CARD_BDR = { tramo: '#1e4a7a', caida: '#2a2a50', atravieso: '#3a1a60' };
const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

function cardLabel(tipo, id) {
  return tipo === 'atravieso' ? `AT${id}` : id;
}

function chunks(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// Parsea KM formato "1.529,7" → 1529.7
function parseKm(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

function largoMetros(tipo, id) {
  const d = KM_DATA[tipo]?.[String(id)];
  if (!d) return null;
  return Math.round((parseKm(d.fin) - parseKm(d.inicio)) * 10) / 10;
}

const FILAS = chunks(ORDEN_CANAL, 10);

// ─────────────────────────────────────────────────────────────────────────────

export default function VistaCanal() {
  const navigate = useNavigate();
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

  function navAvance(tipo, id, partida = null) {
    const params = new URLSearchParams({ tipo, entidad: id });
    if (partida) params.set('partida', partida);
    navigate(`/recepcionar-avance?${params.toString()}`);
    setPopup(null);
  }

  const popupKm = popup ? KM_DATA[popup.tipo]?.[String(popup.id)] : null;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.titulo}>Vista Canal</h1>
        <p style={s.subtitulo}>Avance por partida a lo largo del canal</p>
      </div>

      {/* Leyenda */}
      <div style={s.leyenda}>
        <div style={s.leyendaItem}><div style={{ ...s.leyendaPunto, background: '#10b981' }} />Recepcionado</div>
        <div style={s.leyendaItem}><div style={{ ...s.leyendaPunto, background: '#f59e0b' }} />Pendiente</div>
        <div style={s.leyendaSep} />
        <span style={{ ...s.leyendaTag, background: CARD_BG.tramo,     border: `1px solid ${CARD_BDR.tramo}` }}>Tramo</span>
        <span style={{ ...s.leyendaTag, background: CARD_BG.caida,     border: `1px solid ${CARD_BDR.caida}` }}>Caída</span>
        <span style={{ ...s.leyendaTag, background: CARD_BG.atravieso, border: `1px solid ${CARD_BDR.atravieso}` }}>Atravieso</span>
      </div>

      {cargando ? (
        <p style={s.cargandoTxt}>Cargando datos de avance...</p>
      ) : (
        <div style={s.filasCont}>
          {FILAS.map((fila, fi) => (
            <div key={fi} style={s.filaWrap}>
              <div style={s.filaNumero}>Fila {fi + 1}</div>
              <div style={s.fila}>
                {/* Línea de canal de extremo a extremo */}
                <div style={s.lineaCanal} />
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
            </div>
          ))}
        </div>
      )}

      {/* Popup detalle */}
      {popup && (
        <div style={s.overlay} onClick={() => setPopup(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <button style={s.modalCerrar} onClick={() => setPopup(null)}>✕</button>

            <h2 style={s.modalTitulo}>{NOMBRE_TIPO[popup.tipo]} {popup.id}</h2>

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
  const w = CARD_W[tipo];
  return (
    <div
      style={{
        ...s.tarjeta,
        width: w,
        height: CARD_H,
        background: CARD_BG[tipo],
        borderColor: CARD_BDR[tipo],
      }}
      onClick={onClick}
      title={`${NOMBRE_TIPO[tipo]} ${id} — click para ver detalle`}
    >
      {/* Nombre arriba */}
      <span style={{ ...s.tarjetaLabel, fontSize: w <= 45 ? '10px' : '12px' }}>
        {cardLabel(tipo, id)}
      </span>

      {/* Separador */}
      <div style={s.tarjetaSep} />

      {/* 6 puntos verticales */}
      <div style={s.puntosCol}>
        {PARTIDAS_DISPLAY.map(p => {
          const rec = avanceSet.has(`${tipo}-${id}-${p.id}`);
          return (
            <div
              key={p.id}
              title={`${p.label}: ${rec ? 'Recepcionado ✓' : 'Pendiente'}`}
              style={{
                ...s.punto,
                background: rec ? '#10b981' : '#f59e0b',
                boxShadow: rec ? '0 0 5px rgba(16,185,129,0.6)' : 'none',
              }}
              onClick={e => onDotClick(e, p.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = {
  page: { padding: '0 0 48px' },
  header: { marginBottom: '14px' },
  titulo: { color: '#64ffda', fontSize: '22px', fontWeight: 800, margin: '0 0 4px' },
  subtitulo: { color: '#8892b0', fontSize: '13px', margin: 0 },

  leyenda: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
    marginBottom: '20px', padding: '10px 14px',
    background: '#0f2a4a', borderRadius: '8px', border: '1px solid #1e3a5f',
  },
  leyendaItem: { display: 'flex', alignItems: 'center', gap: '5px', color: '#ccd6f6', fontSize: '12px', fontWeight: 600 },
  leyendaPunto: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  leyendaSep: { width: '1px', height: '16px', background: '#1e3a5f', margin: '0 4px' },
  leyendaTag: { fontSize: '11px', fontWeight: 600, color: '#ccd6f6', padding: '2px 8px', borderRadius: '4px' },

  cargandoTxt: { color: '#8892b0', fontSize: '14px' },

  filasCont: { display: 'flex', flexDirection: 'column', gap: '20px' },
  filaWrap: { display: 'flex', flexDirection: 'column', gap: '5px' },
  filaNumero: { color: '#374151', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },

  fila: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between', // distribuir de extremo a extremo
    width: '100%',
  },
  lineaCanal: {
    position: 'absolute',
    height: '3px',
    background: 'linear-gradient(90deg, #1e4a7a, #2a3a6a, #1e4a7a)',
    left: 0,
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 0,
    borderRadius: '2px',
  },

  tarjeta: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 0,
    padding: '7px 3px 8px',
    borderRadius: '7px',
    border: '1px solid',
    cursor: 'pointer',
    flexShrink: 0,
    userSelect: 'none',
    boxSizing: 'border-box',
  },
  tarjetaLabel: {
    color: '#ccd6f6',
    fontWeight: 700,
    letterSpacing: '0.2px',
    lineHeight: 1,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    paddingBottom: '2px',
  },
  tarjetaSep: {
    width: '70%',
    height: '1px',
    background: 'rgba(255,255,255,0.08)',
    margin: '4px 0',
    flexShrink: 0,
  },
  puntosCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
    flex: 1,
    justifyContent: 'center',
  },
  punto: {
    width: 11,
    height: 11,
    borderRadius: '50%',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 0.1s',
  },

  // Modal popup
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
