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

const LISTAS      = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Cubicaciones() {
  const navigate    = useNavigate();
  const libreIdRef  = useRef(1);

  const [params, setParams]                 = useState(PARAMS_DEFAULT);
  const [paramsEdit, setParamsEdit]         = useState(PARAMS_DEFAULT);
  const [editandoParams, setEditandoParams] = useState(false);
  const [avance, setAvance]                 = useState({});
  const [libres, setLibres]                 = useState(() => [
    { id: 0, l: '', a: '', h: '', tipo: 'radier', desc: '' },
  ]);
  const [seleccionados, setSeleccionados]   = useState(new Set());
  const [generandoPDF, setGenerandoPDF]     = useState(false);

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

  // ── Dashboard: pendientes ───────────────────────────────────────────────────

  const pendientesRadier = useMemo(() => {
    const result = [];
    for (const tipo of ['tramo', 'caida', 'atravieso']) {
      const p = PARTIDAS_HORMIGON[tipo][0];
      for (const id of LISTAS[tipo]) {
        const sid = String(id);
        if (!avance[`${tipo}_${sid}_${p.id}`]) {
          const largo = largoEntidad(tipo, sid);
          result.push({ tipo, id: sid, partida: p.partida, volumen: calcVolumen({ tipo, partida: p.partida, largo }, params) });
        }
      }
    }
    return result;
  }, [avance, params]);

  const pendientesMuro = useMemo(() => {
    const result = [];
    for (const tipo of ['tramo', 'caida', 'atravieso']) {
      const p = PARTIDAS_HORMIGON[tipo][1];
      for (const id of LISTAS[tipo]) {
        const sid = String(id);
        if (!avance[`${tipo}_${sid}_${p.id}`]) {
          const largo = largoEntidad(tipo, sid);
          result.push({ tipo, id: sid, partida: p.partida, volumen: calcVolumen({ tipo, partida: p.partida, largo }, params) });
        }
      }
    }
    return result;
  }, [avance, params]);

  const countEmplantillado = useMemo(() => {
    let count = 0;
    for (const tipo of ['tramo', 'caida', 'atravieso']) {
      for (const id of LISTAS[tipo]) {
        if (!avance[`${tipo}_${String(id)}_emplantillado`]) count++;
      }
    }
    return count;
  }, [avance]);

  const totalVolRadier = useMemo(() => pendientesRadier.reduce((s, e) => s + e.volumen, 0), [pendientesRadier]);
  const totalVolMuro   = useMemo(() => pendientesMuro.reduce((s, e) => s + e.volumen, 0), [pendientesMuro]);

  // ── Tabla de planificación ──────────────────────────────────────────────────

  const pRadierMap = useMemo(() => {
    const map = {};
    for (const e of pendientesRadier) map[`${e.tipo}|||${e.id}`] = e;
    return map;
  }, [pendientesRadier]);

  const pMuroMap = useMemo(() => {
    const map = {};
    for (const e of pendientesMuro) map[`${e.tipo}|||${e.id}`] = e;
    return map;
  }, [pendientesMuro]);

  const entidadesConPendiente = useMemo(() => {
    const seen = new Map();
    for (const e of [...pendientesRadier, ...pendientesMuro]) {
      const key = `${e.tipo}|||${e.id}`;
      if (!seen.has(key)) seen.set(key, { tipo: e.tipo, id: e.id });
    }
    const order = { tramo: 0, caida: 1, atravieso: 2 };
    return Array.from(seen.values()).sort((a, b) => {
      if (order[a.tipo] !== order[b.tipo]) return order[a.tipo] - order[b.tipo];
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
  }, [pendientesRadier, pendientesMuro]);

  // ── Resumen de jornada ──────────────────────────────────────────────────────

  const jornadaRadierItems = useMemo(() =>
    pendientesRadier.filter(e => seleccionados.has(`${e.tipo}_${e.id}_${e.partida}`)),
    [pendientesRadier, seleccionados]
  );
  const jornadaMuroItems = useMemo(() =>
    pendientesMuro.filter(e => seleccionados.has(`${e.tipo}_${e.id}_${e.partida}`)),
    [pendientesMuro, seleccionados]
  );
  const m3RadierJornada = useMemo(() => jornadaRadierItems.reduce((s, e) => s + e.volumen, 0), [jornadaRadierItems]);
  const m3MuroJornada   = useMemo(() => jornadaMuroItems.reduce((s, e) => s + e.volumen, 0), [jornadaMuroItems]);

  // ── Libres ──────────────────────────────────────────────────────────────────

  const totalLibreRadier = useMemo(() =>
    libres.filter(l => l.tipo === 'radier').reduce((s, l) => s + libreVol(l), 0), [libres]);
  const totalLibreMuro = useMemo(() =>
    libres.filter(l => l.tipo === 'muros').reduce((s, l) => s + libreVol(l), 0), [libres]);

  // ── Acciones ────────────────────────────────────────────────────────────────

  function toggleSeleccion(tipo, id, partida) {
    const key = `${tipo}_${id}_${partida}`;
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
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

  function guardarParams() {
    setParams({ ...paramsEdit });
    setEditandoParams(false);
  }

  function restaurarParams() {
    setParams({ ...PARAMS_DEFAULT });
    setParamsEdit({ ...PARAMS_DEFAULT });
    setEditandoParams(false);
  }

  async function handleExportarJornadaPDF() {
    if (generandoPDF) return;
    setGenerandoPDF(true);
    try {
      const jornadaItems = [
        ...jornadaRadierItems.map(e => ({
          id:            `${e.tipo}_${e.id}_${e.partida}`,
          tipo:          e.tipo,
          entidadId:     e.id,
          partida:       e.partida,
          tipoHormigon:  '90-40-08',
          partidaNombre: e.tipo === 'atravieso' ? 'Piso' : 'Hormigón Radier',
          largo:         largoEntidad(e.tipo, e.id),
          volumen:       e.volumen,
          formula:       calcFormula({ tipo: e.tipo, partida: e.partida, largo: largoEntidad(e.tipo, e.id) }, params),
        })),
        ...jornadaMuroItems.map(e => ({
          id:            `${e.tipo}_${e.id}_${e.partida}_m`,
          tipo:          e.tipo,
          entidadId:     e.id,
          partida:       e.partida,
          tipoHormigon:  '90-20-08',
          partidaNombre: e.tipo === 'atravieso' ? 'Muros/Losa' : 'Hormigón Muro',
          largo:         largoEntidad(e.tipo, e.id),
          volumen:       e.volumen,
          formula:       calcFormula({ tipo: e.tipo, partida: e.partida, largo: largoEntidad(e.tipo, e.id) }, params),
        })),
      ];
      await generarPDFCubicaciones(jornadaItems, [], params, m3RadierJornada, m3MuroJornada);
    } catch (err) {
      console.error('[PDF Jornada]', err);
    } finally {
      setGenerandoPDF(false);
    }
  }

  const hayJornada = seleccionados.size > 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <button style={s.btnVolver} onClick={() => navigate('/')}>← Inicio</button>
      <h1 style={s.titulo}>Cubicaciones</h1>

      {/* ── Sección 1: Dashboard ─────────────────────────────────────── */}
      <div style={s.sec}>
        <h2 style={s.secTit}>Pendiente de hormigonar</h2>
        <div style={s.dashGrid}>

          <div style={{ ...s.dashCard, borderColor: '#3d7ebf' }}>
            <div style={{ ...s.dashCardLabel, color: '#7ab3e8' }}>Radier pendiente</div>
            <div style={s.dashCount}>
              {pendientesRadier.length} <span style={s.dashUnit}>entidades</span>
            </div>
            <div style={s.dashM3}>
              {totalVolRadier.toFixed(1)} <span style={s.dashUnit}>m³</span>
            </div>
            <div style={{ ...s.dashCamiones, color: '#7ab3e8' }}>
              {totalVolRadier > 0 ? Math.ceil(totalVolRadier / params.volumenCamion) : 0} camiones
            </div>
            <div style={s.dashCodigo}>90-40-08</div>
          </div>

          <div style={{ ...s.dashCard, borderColor: '#e6a817' }}>
            <div style={{ ...s.dashCardLabel, color: '#f0c040' }}>Muros pendiente</div>
            <div style={s.dashCount}>
              {pendientesMuro.length} <span style={s.dashUnit}>entidades</span>
            </div>
            <div style={s.dashM3}>
              {totalVolMuro.toFixed(1)} <span style={s.dashUnit}>m³</span>
            </div>
            <div style={{ ...s.dashCamiones, color: '#f0c040' }}>
              {totalVolMuro > 0 ? Math.ceil(totalVolMuro / params.volumenCamion) : 0} camiones
            </div>
            <div style={s.dashCodigo}>90-20-08</div>
          </div>

          <div style={{ ...s.dashCard, borderColor: '#4a5568' }}>
            <div style={{ ...s.dashCardLabel, color: '#a0aec0' }}>Emplantillado pendiente</div>
            <div style={s.dashCount}>
              {countEmplantillado} <span style={s.dashUnit}>entidades</span>
            </div>
            <div style={s.dashCodigo} />
            <div style={s.dashCodigo}>G5</div>
          </div>

        </div>
      </div>

      {/* ── Sección 2: Planificador ──────────────────────────────────── */}
      <div style={s.sec}>
        <h2 style={s.secTit}>Planificación de jornada</h2>
        {entidadesConPendiente.length === 0 ? (
          <p style={s.emptyMsg}>Sin partidas pendientes</p>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.tabla}>
              <thead>
                <tr>
                  <th style={{ ...s.th, textAlign: 'left' }}>Entidad</th>
                  <th style={s.th}>Tipo</th>
                  <th style={s.th}>Radier</th>
                  <th style={s.th}>Muro</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>m³ Radier</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>m³ Muro</th>
                </tr>
              </thead>
              <tbody>
                {entidadesConPendiente.map(({ tipo, id }) => {
                  const pR  = pRadierMap[`${tipo}|||${id}`];
                  const pM  = pMuroMap[`${tipo}|||${id}`];
                  const keyR = pR ? `${tipo}_${id}_${pR.partida}` : null;
                  const keyM = pM ? `${tipo}_${id}_${pM.partida}` : null;
                  const selR = keyR && seleccionados.has(keyR);
                  const selM = keyM && seleccionados.has(keyM);
                  return (
                    <tr key={`${tipo}_${id}`}>
                      <td style={{ ...s.td, fontWeight: 600, color: '#ccd6f6' }}>
                        {nombreEntidad(tipo, id)}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <span style={{ ...s.tipoBadge, ...BADGE_TIPO[tipo] }}>
                          {NOMBRE_TIPO[tipo]}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        {pR ? (
                          <input
                            type="checkbox"
                            style={s.check}
                            checked={!!selR}
                            onChange={() => toggleSeleccion(tipo, id, pR.partida)}
                          />
                        ) : (
                          <span style={s.done}>✓</span>
                        )}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        {pM ? (
                          <input
                            type="checkbox"
                            style={s.check}
                            checked={!!selM}
                            onChange={() => toggleSeleccion(tipo, id, pM.partida)}
                          />
                        ) : (
                          <span style={s.done}>✓</span>
                        )}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: selR ? '#7ab3e8' : '#4a5568' }}>
                        {selR && pR ? pR.volumen.toFixed(2) : '—'}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: selM ? '#f0c040' : '#4a5568' }}>
                        {selM && pM ? pM.volumen.toFixed(2) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Sección 3: Resumen de jornada ───────────────────────────── */}
      {hayJornada && (
        <div style={s.sec}>
          <h2 style={s.secTit}>Resumen de jornada</h2>
          <div style={s.resumenGrid}>
            <div style={{ ...s.resumenCard, borderColor: '#3d7ebf' }}>
              <div style={{ ...s.resumenHeader, color: '#7ab3e8' }}>
                Radier <span style={s.resumenCodigo}>90-40-08</span>
              </div>
              <div style={s.resumenVol}>
                {m3RadierJornada.toFixed(3)} <span style={s.resumenUnit}>m³</span>
              </div>
              <div style={{ ...s.resumenCamiones, color: '#7ab3e8' }}>
                {m3RadierJornada > 0 ? Math.ceil(m3RadierJornada / params.volumenCamion) : 0} camiones
              </div>
              <div style={s.resumenCamionesDesc}>a {params.volumenCamion} m³ c/u</div>
            </div>
            <div style={{ ...s.resumenCard, borderColor: '#e6a817' }}>
              <div style={{ ...s.resumenHeader, color: '#f0c040' }}>
                Muros <span style={s.resumenCodigo}>90-20-08</span>
              </div>
              <div style={s.resumenVol}>
                {m3MuroJornada.toFixed(3)} <span style={s.resumenUnit}>m³</span>
              </div>
              <div style={{ ...s.resumenCamiones, color: '#f0c040' }}>
                {m3MuroJornada > 0 ? Math.ceil(m3MuroJornada / params.volumenCamion) : 0} camiones
              </div>
              <div style={s.resumenCamionesDesc}>a {params.volumenCamion} m³ c/u</div>
            </div>
          </div>
          <button style={s.btnPDF} onClick={handleExportarJornadaPDF} disabled={generandoPDF}>
            {generandoPDF ? 'Generando PDF...' : '📄 Exportar PDF'}
          </button>
        </div>
      )}

      {/* ── Sección 4: Cálculo manual (colapsable) ──────────────────── */}
      <div style={s.sec}>
        <details>
          <summary style={s.detailsSummary}>Cálculo manual</summary>
          <div style={s.detailsBody}>
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
                  <select style={s.libreSelect} value={l.tipo}
                    onChange={e => setLibreField(l.id, 'tipo', e.target.value)}>
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
            {(totalLibreRadier > 0 || totalLibreMuro > 0) && (
              <div style={s.libreResumen}>
                {totalLibreRadier > 0 && (
                  <span style={{ color: '#7ab3e8' }}>Radier: {totalLibreRadier.toFixed(3)} m³</span>
                )}
                {totalLibreMuro > 0 && (
                  <span style={{ color: '#f0c040' }}>Muros: {totalLibreMuro.toFixed(3)} m³</span>
                )}
              </div>
            )}
          </div>
        </details>
      </div>

      {/* ── Sección 5: Parámetros ────────────────────────────────────── */}
      <div style={s.sec}>
        <h2 style={s.secTit}>Parámetros</h2>
        <div style={s.paramsGrid}>
          {Object.entries(PARAMS_LABELS).map(([key, label]) => (
            <div key={key} style={s.paramItem}>
              <div style={s.paramLabel}>{label}</div>
              {editandoParams ? (
                <input
                  type="number" step="0.001" style={s.paramInput}
                  value={paramsEdit[key]}
                  onChange={e => setParamsEdit(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                />
              ) : (
                <div style={s.paramVal}>{params[key]}</div>
              )}
            </div>
          ))}
        </div>
        {!editandoParams ? (
          <button style={s.btnEditar}
            onClick={() => { setParamsEdit({ ...params }); setEditandoParams(true); }}>
            ✏️ Editar
          </button>
        ) : (
          <div style={s.paramBtns}>
            <button style={s.btnRestaurar} onClick={restaurarParams}>↩ Restaurar valores</button>
            <button style={s.btnGuardar} onClick={guardarParams}>✓ Guardar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Badge por tipo (fuera del objeto s para evitar confusión) ────────────────

const BADGE_TIPO = {
  tramo:     { background: '#1a2e5a', color: '#7ab3e8' },
  caida:     { background: '#3d2800', color: '#f0a030' },
  atravieso: { background: '#1a3a1a', color: '#68d391' },
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = {
  page: {
    maxWidth: '900px', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '60px',
  },
  btnVolver: {
    background: 'transparent', border: 'none', color: '#8892b0',
    cursor: 'pointer', fontSize: '14px', padding: 0, alignSelf: 'flex-start',
  },
  titulo: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },

  sec: {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '12px',
    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
  },
  secTit: {
    color: '#64ffda', fontSize: '13px', fontWeight: 800, margin: 0,
    textTransform: 'uppercase', letterSpacing: '1px',
  },
  emptyMsg: { color: '#8892b0', fontSize: '13px', margin: 0, fontStyle: 'italic' },

  // Dashboard
  dashGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  dashCard: {
    background: '#0a1428', border: '2px solid', borderRadius: '10px', padding: '14px',
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  dashCardLabel: { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' },
  dashCount:     { color: '#ccd6f6', fontSize: '24px', fontWeight: 800, lineHeight: 1.1, marginTop: '4px' },
  dashM3:        { color: '#ccd6f6', fontSize: '16px', fontWeight: 700 },
  dashUnit:      { fontSize: '11px', fontWeight: 500, opacity: 0.7 },
  dashCamiones:  { fontSize: '13px', fontWeight: 700 },
  dashCodigo:    { color: '#4a5568', fontSize: '11px', marginTop: '4px' },

  // Tabla
  tableWrap: { overflowX: 'auto' },
  tabla: { width: '100%', borderCollapse: 'collapse', minWidth: '520px' },
  th: {
    background: '#0a1428', color: '#8892b0', fontSize: '11px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 12px',
    borderBottom: '1px solid #1e3a5f', textAlign: 'center',
  },
  td: {
    color: '#a0aec0', fontSize: '13px', padding: '10px 12px',
    borderBottom: '1px solid #0f3460',
  },
  tipoBadge: {
    fontSize: '10px', fontWeight: 700, borderRadius: '4px', padding: '2px 6px',
    display: 'inline-block',
  },
  check: { width: '16px', height: '16px', cursor: 'pointer', accentColor: '#64ffda' },
  done:  { color: '#10b981', fontSize: '16px', fontWeight: 700 },

  // Resumen jornada
  resumenGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  resumenCard: {
    background: '#0a1428', border: '2px solid', borderRadius: '10px', padding: '14px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  resumenHeader:      { fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' },
  resumenCodigo:      { fontSize: '11px', fontWeight: 600, opacity: 0.75 },
  resumenVol:         { color: '#ccd6f6', fontSize: '22px', fontWeight: 800, lineHeight: 1.1 },
  resumenUnit:        { fontSize: '13px', fontWeight: 600, opacity: 0.7 },
  resumenCamiones:    { fontSize: '15px', fontWeight: 700 },
  resumenCamionesDesc:{ color: '#8892b0', fontSize: '11px' },
  btnPDF: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '10px',
    color: '#ccd6f6', fontSize: '14px', fontWeight: 700, padding: '14px',
    cursor: 'pointer',
  },

  // Cálculo manual colapsable
  detailsSummary: {
    color: '#64ffda', fontSize: '13px', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '1px',
    cursor: 'pointer', userSelect: 'none',
  },
  detailsBody: { display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '14px' },

  // Libre
  libreLabel: {
    color: '#8892b0', fontSize: '11px', fontWeight: 700, margin: 0,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  libreRow:   { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
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
  libreResumen: {
    display: 'flex', gap: '16px', flexWrap: 'wrap',
    background: '#0a1428', borderRadius: '8px', padding: '10px 12px',
    fontSize: '13px', fontWeight: 700,
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
  paramBtns:    { display: 'flex', gap: '10px', flexWrap: 'wrap' },
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
