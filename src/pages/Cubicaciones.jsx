import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TRAMOS, CAIDAS, ATRAVIESOS, KM_DATA } from '../constants/estructura';
import { supabase } from '../config/supabase';
import { generarPDFCubicaciones } from '../utils/generarPDFCubicaciones';

// ─── Parámetros y constantes ─────────────────────────────────────────────────

const PARAMS_DEFAULT = {
  espesorRadier:  0.13,
  espesorMuro:    0.13,
  altoMuroTramo:  0.85,
  anchoInterior:  2.26,
  volumenCamion:  8,
  espesorLosaAtr: 0.20,
};

const VOL_CAIDA_RADIER = 4.51;
const VOL_CAIDA_MURO   = 5.431;
const VOL_ATR_PISO     = 2.712;
const VOL_ATR_MUROS    = 5.112;

const PARAMS_LABELS = {
  espesorRadier:  'Espesor Radier (m)',
  espesorMuro:    'Espesor Muro (m)',
  altoMuroTramo:  'Alto Muro Tramo (m)',
  anchoInterior:  'Ancho Interior (m)',
  volumenCamion:  'Vol. Camión (m³)',
  espesorLosaAtr: 'Espesor Losa ATR (m)',
};

// ─── Partidas de hormigón por tipo de entidad ─────────────────────────────────

const PARTIDAS_HORMIGON = {
  tramo: [
    { id: 'hormigon_radier', nombre: 'Hormigón Radier', partida: 'radier',     tipoHormigon: '90-40-08' },
    { id: 'hormigon_muro',   nombre: 'Hormigón Muro',   partida: 'muros',      tipoHormigon: '90-20-08' },
  ],
  caida: [
    { id: 'hormigon_radier', nombre: 'Hormigón Radier', partida: 'radier',     tipoHormigon: '90-40-08' },
    { id: 'hormigon_muro',   nombre: 'Hormigón Muro',   partida: 'muros',      tipoHormigon: '90-20-08' },
  ],
  atravieso: [
    { id: 'piso',       nombre: 'Piso',       partida: 'piso',       tipoHormigon: '90-40-08' },
    { id: 'muros_losa', nombre: 'Muros/Losa', partida: 'muros_losa', tipoHormigon: '90-20-08' },
  ],
};

const LISTAS     = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };
const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseMetros(str) {
  return parseFloat(String(str).replace(/\./g, '').replace(',', '.'));
}

function largoEntidad(tipo, id) {
  const km = KM_DATA[tipo]?.[String(id)];
  if (!km) return 0;
  return parseMetros(km.fin) - parseMetros(km.inicio);
}

function volTramoRadier(largo, p) { return largo * p.anchoInterior * p.espesorRadier; }
function volTramoMuros(largo, p)  { return largo * p.espesorMuro * p.altoMuroTramo * 2; }

function calcVolumen(item, p) {
  const { tipo, partida, largo } = item;
  if (tipo === 'tramo') {
    if (partida === 'radier') return volTramoRadier(largo, p);
    if (partida === 'muros')  return volTramoMuros(largo, p);
  }
  if (tipo === 'caida') {
    if (partida === 'radier') return VOL_CAIDA_RADIER;
    if (partida === 'muros')  return VOL_CAIDA_MURO;
  }
  if (tipo === 'atravieso') {
    if (partida === 'piso')       return VOL_ATR_PISO;
    if (partida === 'muros_losa') return VOL_ATR_MUROS;
  }
  return 0;
}

function calcFormula(item, p) {
  const vol = calcVolumen(item, p);
  const { tipo, partida, largo } = item;
  if (tipo === 'tramo') {
    if (partida === 'radier') return `${largo.toFixed(1)} × ${p.anchoInterior} × ${p.espesorRadier} = ${vol.toFixed(3)} m³`;
    if (partida === 'muros')  return `${largo.toFixed(1)} × ${p.espesorMuro} × ${p.altoMuroTramo} × 2 = ${vol.toFixed(3)} m³`;
  }
  return `Volumen fijo = ${vol.toFixed(3)} m³`;
}

function libreVol(l) {
  const v = parseFloat(l.l) * parseFloat(l.a) * parseFloat(l.h);
  return isNaN(v) ? 0 : v;
}

function nombreEntidad(tipo, id) {
  if (tipo === 'tramo')     return `Tramo ${id}`;
  if (tipo === 'caida')     return `Caída ${id}`;
  if (tipo === 'atravieso') return `AT${id}`;
  return String(id);
}

// ─── Sub-componente sección ───────────────────────────────────────────────────

function Sec({ titulo, children }) {
  return (
    <div style={s.sec}>
      <h2 style={s.secTit}>{titulo}</h2>
      {children}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Cubicaciones() {
  const navigate = useNavigate();
  const libreIdRef = useRef(1);

  const [params, setParams]                       = useState(PARAMS_DEFAULT);
  const [paramsEdit, setParamsEdit]               = useState(PARAMS_DEFAULT);
  const [editandoParams, setEditandoParams]       = useState(false);
  const [filtroPendientes, setFiltroPendientes]   = useState(true);
  const [tipo, setTipo]                           = useState('tramo');
  const [entidadId, setEntidadId]                 = useState(null);
  const [partidaSeleccionada, setPartidaSeleccionada] = useState(null);
  const [items, setItems]                         = useState([]);
  const [avance, setAvance]                       = useState({});
  const [libres, setLibres]                       = useState(() => [
    { id: 0, l: '', a: '', h: '', tipo: 'radier', desc: '' },
  ]);
  const [generandoPDF, setGenerandoPDF]           = useState(false);

  // Cargar avance desde Supabase
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('avance')
      .select('tipo_entidad, entidad_id, partida_id')
      .then(({ data }) => {
        const map = {};
        (data ?? []).forEach(r => {
          map[`${r.tipo_entidad}_${r.entidad_id}_${r.partida_id}`] = true;
        });
        setAvance(map);
      });
  }, []);

  // ── Cambio de tipo ──────────────────────────────────────────────────────────

  function handleTipo(t) {
    setTipo(t);
    setEntidadId(null);
    setPartidaSeleccionada(null);
  }

  // ── Datos derivados ─────────────────────────────────────────────────────────

  const entidadesFiltradas = useMemo(() => {
    const lista = LISTAS[tipo];
    if (!filtroPendientes) return lista;
    return lista.filter(id =>
      PARTIDAS_HORMIGON[tipo].some(p => !avance[`${tipo}_${String(id)}_${p.id}`])
    );
  }, [tipo, filtroPendientes, avance]);

  const countPendientes = useMemo(() =>
    LISTAS[tipo].filter(id =>
      PARTIDAS_HORMIGON[tipo].some(p => !avance[`${tipo}_${String(id)}_${p.id}`])
    ).length
  , [tipo, avance]);

  const largoActual    = entidadId !== null ? largoEntidad(tipo, entidadId) : 0;
  const partidasActuales = PARTIDAS_HORMIGON[tipo];

  const itemsConVolumen = useMemo(() =>
    items.map(item => ({
      ...item,
      volumen: calcVolumen(item, params),
      formula: calcFormula(item, params),
    }))
  , [items, params]);

  const totalRadier = useMemo(() =>
    itemsConVolumen.filter(i => i.tipoHormigon === '90-40-08').reduce((s, i) => s + i.volumen, 0)
    + libres.filter(l => l.tipo === 'radier').reduce((s, l) => s + libreVol(l), 0)
  , [itemsConVolumen, libres]);

  const totalMuros = useMemo(() =>
    itemsConVolumen.filter(i => i.tipoHormigon === '90-20-08').reduce((s, i) => s + i.volumen, 0)
    + libres.filter(l => l.tipo === 'muros').reduce((s, l) => s + libreVol(l), 0)
  , [itemsConVolumen, libres]);

  // ── Acciones ────────────────────────────────────────────────────────────────

  function agregarItem() {
    if (entidadId === null || partidaSeleccionada === null) return;
    const p = partidasActuales.find(x => x.partida === partidaSeleccionada);
    if (!p) return;
    setItems(prev => [...prev, {
      id:           Date.now(),
      tipo,
      entidadId,
      partida:      p.partida,
      tipoHormigon: p.tipoHormigon,
      partidaNombre: p.nombre,
      largo:        largoActual,
    }]);
    setPartidaSeleccionada(null);
  }

  function setLibreField(id, field, value) {
    setLibres(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  function agregarLibre() {
    const id = ++libreIdRef.current;
    setLibres(prev => [...prev, { id, l: '', a: '', h: '', tipo: 'radier', desc: '' }]);
  }

  function eliminarLibre(id) {
    setLibres(prev => prev.filter(l => l.id !== id));
  }

  function limpiarTodo() {
    setItems([]);
    const id = ++libreIdRef.current;
    setLibres([{ id, l: '', a: '', h: '', tipo: 'radier', desc: '' }]);
  }

  function guardarParams() {
    setParams({ ...paramsEdit });
    setEditandoParams(false);
  }

  async function handleExportarPDF() {
    if (generandoPDF) return;
    setGenerandoPDF(true);
    try {
      await generarPDFCubicaciones(itemsConVolumen, libres, params, totalRadier, totalMuros);
    } catch (err) {
      console.error('[PDF Cubicaciones]', err);
    } finally {
      setGenerandoPDF(false);
    }
  }

  function restaurarParams() {
    setParams({ ...PARAMS_DEFAULT });
    setParamsEdit({ ...PARAMS_DEFAULT });
    setEditandoParams(false);
  }

  // ── Label botón agregar ─────────────────────────────────────────────────────

  const pSel = partidasActuales.find(x => x.partida === partidaSeleccionada);
  const puedeAgregar = entidadId !== null && partidaSeleccionada !== null;
  const btnLabel = puedeAgregar && pSel
    ? `${pSel.nombre} — ${nombreEntidad(tipo, entidadId)}`
    : 'Selecciona entidad y partida';

  const hayContenido = items.length > 0 || libres.some(l => l.l || l.a || l.h);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <button style={s.btnVolver} onClick={() => navigate('/')}>← Inicio</button>
      <h1 style={s.titulo}>Cubicaciones</h1>

      {/* ── Sección 1: Agregar al cálculo ────────────────────────────── */}
      <Sec titulo="Agregar al cálculo">
        <button
          style={{ ...s.toggleBtn, ...(filtroPendientes ? s.toggleBtnActivo : {}) }}
          onClick={() => {
            setFiltroPendientes(v => !v);
            setEntidadId(null);
            setPartidaSeleccionada(null);
          }}
        >
          <span>{filtroPendientes ? '✅' : '⬜'} Mostrar solo partidas pendientes</span>
          {filtroPendientes && (
            <span style={s.countBadge}>{countPendientes} pendientes</span>
          )}
        </button>

        <div style={s.row}>
          <div style={s.campo}>
            <label style={s.label}>Tipo</label>
            <select style={s.input} value={tipo} onChange={e => handleTipo(e.target.value)}>
              <option value="tramo">Tramo</option>
              <option value="caida">Caída</option>
              <option value="atravieso">Atravieso</option>
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>
              Entidad
              {filtroPendientes && <span style={s.countLabel}> ({entidadesFiltradas.length} con hormigón pendiente)</span>}
            </label>
            <select
              style={s.input}
              value={entidadId ?? ''}
              onChange={e => { setEntidadId(e.target.value || null); setPartidaSeleccionada(null); }}
            >
              <option value="">— Seleccionar —</option>
              {entidadesFiltradas.map(id => {
                const largo = tipo !== 'atravieso' ? largoEntidad(tipo, id) : null;
                return (
                  <option key={id} value={id}>
                    {NOMBRE_TIPO[tipo]} {id}{largo !== null ? ` — ${largo.toFixed(1)} m` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {entidadId !== null && (
          <div style={s.preview}>
            <strong>{nombreEntidad(tipo, entidadId)}</strong>
            {tipo !== 'atravieso'
              ? ` — ${largoActual.toFixed(1)} m`
              : ' — vol. fijo'}
          </div>
        )}

        {entidadId !== null && (
          <div style={s.partidasGrid}>
            {partidasActuales.map(p => {
              const volPreview    = calcVolumen({ tipo, entidadId, partida: p.partida, largo: largoActual }, params);
              const esRecepcionada = !!avance[`${tipo}_${String(entidadId)}_${p.id}`];
              const esSeleccionada = partidaSeleccionada === p.partida;
              return (
                <div
                  key={p.partida}
                  style={{
                    ...s.partidaCard,
                    ...(esSeleccionada && !esRecepcionada ? s.partidaCardSel : {}),
                    ...(esRecepcionada ? s.partidaCardRecep : {}),
                    cursor: esRecepcionada ? 'default' : 'pointer',
                  }}
                  onClick={() => !esRecepcionada && setPartidaSeleccionada(p.partida)}
                >
                  <div style={s.partidaNombre}>{p.nombre}</div>
                  <div style={s.partidaTipoH}>{p.tipoHormigon}</div>
                  <div style={s.partidaVol}>{volPreview.toFixed(3)} m³</div>
                  {esRecepcionada && <div style={s.recepBadge}>Recepcionado</div>}
                </div>
              );
            })}
          </div>
        )}

        <button
          style={{ ...s.btnAgregar, opacity: puedeAgregar ? 1 : 0.4 }}
          onClick={agregarItem}
          disabled={!puedeAgregar}
        >
          + Agregar {btnLabel}
        </button>
      </Sec>

      {/* ── Sección 2: Cálculo ───────────────────────────────────────── */}
      <Sec titulo="Cálculo">
        {!hayContenido && (
          <p style={s.emptyMsg}>Agrega partidas arriba o escribe valores libres abajo</p>
        )}

        {itemsConVolumen.map(item => (
          <div key={item.id} style={s.itemRow}>
            <div style={s.itemInfo}>
              <div style={s.itemLabel}>
                <span style={s.itemNombre}>{nombreEntidad(item.tipo, item.entidadId)}</span>
                <span style={{ ...s.tipoBadge, ...(item.tipoHormigon === '90-40-08' ? s.badgeRadier : s.badgeMuros) }}>
                  {item.tipoHormigon}
                </span>
              </div>
              <div style={s.itemFormula}>{item.formula}</div>
            </div>
            <button style={s.btnEliminarItem} onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}>×</button>
          </div>
        ))}

        {itemsConVolumen.length > 0 && <div style={s.sep} />}

        <p style={s.libreLabel}>Cálculo libre</p>
        {libres.map(l => {
          const vol = libreVol(l);
          return (
            <div key={l.id} style={s.libreRow}>
              <input type="number" placeholder="L" step="0.01" style={s.libreInput}
                value={l.l} onChange={e => setLibreField(l.id, 'l', e.target.value)} />
              <span style={s.libreOp}>×</span>
              <input type="number" placeholder="A" step="0.01" style={s.libreInput}
                value={l.a} onChange={e => setLibreField(l.id, 'a', e.target.value)} />
              <span style={s.libreOp}>×</span>
              <input type="number" placeholder="H" step="0.01" style={s.libreInput}
                value={l.h} onChange={e => setLibreField(l.id, 'h', e.target.value)} />
              <span style={s.libreOp}>=</span>
              <span style={s.libreRes}>{vol > 0 ? vol.toFixed(3) : '—'} m³</span>
              <select style={s.libreSelect} value={l.tipo} onChange={e => setLibreField(l.id, 'tipo', e.target.value)}>
                <option value="radier">Radier</option>
                <option value="muros">Muros</option>
              </select>
              {libres.length > 1 && (
                <button style={s.btnEliminarLibre} onClick={() => eliminarLibre(l.id)}>×</button>
              )}
            </div>
          );
        })}

        <button style={s.btnAddLibre} onClick={agregarLibre}>+ Agregar fila</button>

        {hayContenido && (
          <button style={s.btnLimpiar} onClick={limpiarTodo}>Limpiar todo</button>
        )}
      </Sec>

      {/* ── Sección 3: Resumen ───────────────────────────────────────── */}
      <Sec titulo="Resumen">
        <div style={s.resumenGrid}>
          {[
            { label: 'Radier', codigo: '90-40-08', total: totalRadier, color: '#3d7ebf' },
            { label: 'Muros',  codigo: '90-20-08', total: totalMuros,  color: '#e6a817' },
          ].map(({ label, codigo, total, color }) => (
            <div key={codigo} style={{ ...s.resumenCard, borderColor: color }}>
              <div style={{ ...s.resumenHeader, color }}>
                {label} <span style={s.resumenCodigo}>{codigo}</span>
              </div>
              <div style={s.resumenVol}>
                {total.toFixed(3)} <span style={s.resumenUnit}>m³</span>
              </div>
              <div style={s.resumenCamiones}>
                {total > 0 ? Math.ceil(total / params.volumenCamion) : 0} camiones
              </div>
              <div style={s.resumenCamionesDesc}>a {params.volumenCamion} m³ c/u</div>
            </div>
          ))}
        </div>
        <button style={s.btnPDF} onClick={handleExportarPDF} disabled={generandoPDF}>
          {generandoPDF ? 'Generando PDF...' : '📄 Exportar PDF'}
        </button>
      </Sec>

      {/* ── Sección 4: Parámetros ────────────────────────────────────── */}
      <Sec titulo="Parámetros">
        <div style={s.paramsGrid}>
          {Object.entries(PARAMS_LABELS).map(([key, label]) => (
            <div key={key} style={s.paramItem}>
              <div style={s.paramLabel}>{label}</div>
              {editandoParams ? (
                <input
                  type="number"
                  step="0.001"
                  style={s.paramInput}
                  value={paramsEdit[key]}
                  onChange={e => setParamsEdit(prev => ({
                    ...prev,
                    [key]: parseFloat(e.target.value) || 0,
                  }))}
                />
              ) : (
                <div style={s.paramVal}>{params[key]}</div>
              )}
            </div>
          ))}
        </div>

        {!editandoParams ? (
          <button
            style={s.btnEditar}
            onClick={() => { setParamsEdit({ ...params }); setEditandoParams(true); }}
          >
            ✏️ Editar
          </button>
        ) : (
          <div style={s.paramBtns}>
            <button style={s.btnRestaurar} onClick={restaurarParams}>↩ Restaurar valores</button>
            <button style={s.btnGuardar} onClick={guardarParams}>✓ Guardar</button>
          </div>
        )}
      </Sec>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = {
  page: {
    maxWidth: '600px', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '60px',
  },
  btnVolver: {
    background: 'transparent', border: 'none', color: '#8892b0',
    cursor: 'pointer', fontSize: '14px', padding: 0, alignSelf: 'flex-start',
  },
  titulo: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },

  // Sección
  sec: {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '12px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  secTit: {
    color: '#64ffda', fontSize: '13px', fontWeight: 800, margin: 0,
    textTransform: 'uppercase', letterSpacing: '1px',
  },

  // Toggle filtro
  toggleBtn: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '8px',
    color: '#8892b0', fontSize: '13px', fontWeight: 600, padding: '10px 14px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left',
  },
  toggleBtnActivo: {
    background: 'rgba(16,185,129,0.12)', borderColor: '#10b981', color: '#10b981',
  },
  countBadge: {
    background: '#10b981', color: '#fff', fontSize: '11px', fontWeight: 700,
    borderRadius: '10px', padding: '2px 8px', marginLeft: 'auto', flexShrink: 0,
  },

  // Selects
  row:   { display: 'flex', gap: '10px' },
  campo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#8892b0', fontSize: '12px', fontWeight: 600 },
  countLabel: { color: '#64ffda', fontWeight: 700 },
  input: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '13px', padding: '10px 12px',
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
  },

  // Preview
  preview: {
    background: '#0a1428', borderRadius: '8px', padding: '10px 14px',
    color: '#ccd6f6', fontSize: '14px', fontWeight: 600, border: '1px solid #0f3460',
  },

  // Partidas grid
  partidasGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  partidaCard: {
    background: '#0a1428', border: '2px solid #0f3460', borderRadius: '10px',
    padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  partidaCardSel: { borderColor: '#64ffda', background: 'rgba(100,255,218,0.06)' },
  partidaCardRecep: { opacity: 0.4 },
  partidaNombre: { color: '#ccd6f6', fontSize: '13px', fontWeight: 700 },
  partidaTipoH:  { color: '#8892b0', fontSize: '12px' },
  partidaVol:    { color: '#64ffda', fontSize: '16px', fontWeight: 800 },
  recepBadge: {
    background: '#10b981', color: '#fff', fontSize: '10px', fontWeight: 700,
    borderRadius: '4px', padding: '2px 6px', alignSelf: 'flex-start',
  },

  // Botón agregar
  btnAgregar: {
    background: '#64ffda', color: '#0a1f3a', border: 'none', borderRadius: '10px',
    padding: '14px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
  },

  // Items sección 2
  emptyMsg: { color: '#8892b0', fontSize: '13px', margin: 0, fontStyle: 'italic' },
  itemRow: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '12px', background: '#0a1428', borderRadius: '8px', border: '1px solid #0f3460',
  },
  itemInfo:    { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  itemLabel:   { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  itemNombre:  { color: '#ccd6f6', fontSize: '13px', fontWeight: 700 },
  tipoBadge:   { fontSize: '10px', fontWeight: 700, borderRadius: '4px', padding: '2px 6px' },
  badgeRadier: { background: '#1e3a7f', color: '#7ba7e8' },
  badgeMuros:  { background: '#5a3d00', color: '#f0c040' },
  itemFormula: { color: '#8892b0', fontSize: '12px', fontFamily: 'monospace' },
  btnEliminarItem: {
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
    color: '#ef4444', borderRadius: '6px', width: '28px', height: '28px',
    fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, padding: 0, lineHeight: 1,
  },

  // Separador
  sep: { height: '1px', background: '#0f3460' },

  // Libre
  libreLabel: {
    color: '#8892b0', fontSize: '11px', fontWeight: 700, margin: 0,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  libreRow: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  libreInput: {
    width: '60px', background: '#0f3460', border: '1px solid #1e3a5f',
    borderRadius: '6px', color: '#ccd6f6', fontSize: '13px', padding: '8px 4px',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', textAlign: 'center',
  },
  libreOp:  { color: '#8892b0', fontSize: '14px', fontWeight: 700 },
  libreRes: { color: '#64ffda', fontSize: '13px', fontWeight: 700, minWidth: '72px' },
  libreSelect: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '6px',
    color: '#ccd6f6', fontSize: '12px', padding: '8px 6px',
    fontFamily: 'inherit', outline: 'none',
  },
  btnEliminarLibre: {
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
    color: '#ef4444', borderRadius: '6px', width: '26px', height: '26px',
    fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 0, lineHeight: 1, flexShrink: 0,
  },
  btnAddLibre: {
    background: 'transparent', border: '1px dashed #1e3a5f', borderRadius: '8px',
    color: '#8892b0', fontSize: '13px', fontWeight: 600, padding: '10px',
    cursor: 'pointer', textAlign: 'center',
  },
  btnLimpiar: {
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px', color: '#ef4444', fontSize: '13px', fontWeight: 600,
    padding: '10px 16px', cursor: 'pointer', alignSelf: 'flex-end',
  },

  // Resumen
  resumenGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  resumenCard: {
    background: '#0a1428', border: '2px solid',
    borderRadius: '10px', padding: '14px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  resumenHeader: { fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' },
  resumenCodigo: { fontSize: '11px', fontWeight: 600, opacity: 0.75 },
  resumenVol:    { color: '#ccd6f6', fontSize: '22px', fontWeight: 800, lineHeight: 1.1 },
  resumenUnit:   { fontSize: '13px', fontWeight: 600, opacity: 0.7 },
  resumenCamiones:     { color: '#64ffda', fontSize: '15px', fontWeight: 700 },
  resumenCamionesDesc: { color: '#8892b0', fontSize: '11px' },
  btnPDF: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '10px',
    color: '#ccd6f6', fontSize: '14px', fontWeight: 700, padding: '14px',
    cursor: 'pointer',
  },

  // Parámetros
  paramsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  paramItem: {
    background: '#0a1428', borderRadius: '8px', padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid #0f3460',
  },
  paramLabel: { color: '#8892b0', fontSize: '11px', fontWeight: 600 },
  paramVal:   { color: '#64ffda', fontSize: '15px', fontWeight: 700 },
  paramInput: {
    background: '#1a1a2e', border: '1px solid #1e3a5f', borderRadius: '6px',
    color: '#ccd6f6', fontSize: '15px', fontWeight: 700, padding: '6px 8px',
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  btnEditar: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '8px',
    color: '#ccd6f6', fontSize: '13px', fontWeight: 700, padding: '10px 16px',
    cursor: 'pointer', alignSelf: 'flex-start',
  },
  paramBtns:   { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  btnRestaurar: {
    background: 'rgba(230,168,23,0.1)', border: '1px solid rgba(230,168,23,0.4)',
    borderRadius: '8px', color: '#e6a817', fontSize: '13px', fontWeight: 700,
    padding: '10px 14px', cursor: 'pointer',
  },
  btnGuardar: {
    background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981',
    borderRadius: '8px', color: '#10b981', fontSize: '13px', fontWeight: 700,
    padding: '10px 14px', cursor: 'pointer',
  },
};
