import { useState, useEffect, useCallback } from 'react';
import { TRAMOS, CAIDAS, ATRAVIESOS, PARTIDAS } from '../constants/estructura';
import { supabase } from '../config/supabase';

const LISTAS    = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };
const ETIQUETAS = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const TABS      = [
  { key: 'tramo',     label: 'Tramos' },
  { key: 'caida',     label: 'Caídas' },
  { key: 'atravieso', label: 'Atraviesos' },
];

function cellKey(entidadId, partidaId) {
  return `${entidadId}__${partidaId}`;
}

export default function Planificacion() {
  const [tipo, setTipo]         = useState('tramo');
  const [cuadrillas, setCuadrillas] = useState([]);
  const [planMap, setPlanMap]   = useState({});   // key → cuadrilla_id planificada
  const [avanceMap, setAvanceMap] = useState({}); // key → cuadrilla_id recepcionada
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(null); // key de la celda guardándose

  // Cargar cuadrillas una sola vez
  useEffect(() => {
    if (!supabase) return;
    supabase.from('cuadrillas').select('*').order('nombre')
      .then(({ data }) => setCuadrillas(data ?? []));
  }, []);

  const cargar = useCallback(async () => {
    if (!supabase) return;
    setCargando(true);

    const [{ data: planRows }, { data: avanceRows }] = await Promise.all([
      supabase.from('planificacion').select('entidad_id,partida_id,cuadrilla_id').eq('tipo_entidad', tipo),
      supabase.from('avance').select('entidad_id,partida_id,cuadrilla_id').eq('tipo_entidad', tipo),
    ]);

    const pMap = {};
    for (const r of planRows ?? []) pMap[cellKey(r.entidad_id, r.partida_id)] = r.cuadrilla_id;

    const aMap = {};
    for (const r of avanceRows ?? []) aMap[cellKey(r.entidad_id, r.partida_id)] = r.cuadrilla_id;

    setPlanMap(pMap);
    setAvanceMap(aMap);
    setCargando(false);
  }, [tipo]);

  useEffect(() => { cargar(); }, [cargar]);

  async function asignar(entidadId, partidaId, cuadrillaId) {
    if (!supabase) return;
    const key = cellKey(entidadId, partidaId);
    setGuardando(key);

    const { error } = await supabase
      .from('planificacion')
      .upsert(
        {
          tipo_entidad: tipo,
          entidad_id:   String(entidadId),
          partida_id:   partidaId,
          cuadrilla_id: cuadrillaId || null,
        },
        { onConflict: 'tipo_entidad,entidad_id,partida_id' }
      );

    if (!error) {
      setPlanMap(prev => ({ ...prev, [key]: cuadrillaId || null }));
    }
    setGuardando(null);
  }

  const cuadrillasActivas = cuadrillas.filter(c => c.activa);

  function nombreCuadrilla(id) {
    return cuadrillas.find(c => c.id === id)?.nombre ?? '—';
  }

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Planificación de Avance</h1>

      {/* Tabs de tipo */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            style={{ ...s.tab, ...(tipo === t.key ? s.tabActivo : {}) }}
            onClick={() => setTipo(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {cargando && <p style={s.cargando}>Cargando...</p>}

      {!cargando && (
        <div style={s.tableWrapper}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.thFija }}>Entidad</th>
                {PARTIDAS.map(p => (
                  <th key={p.id} style={s.th}>{p.nombre}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LISTAS[tipo].map((entidadId, rowIdx) => (
                <tr key={entidadId} style={rowIdx % 2 === 0 ? s.trPar : s.trImpar}>
                  <td style={{ ...s.td, ...s.tdFija }}>
                    {ETIQUETAS[tipo]} {entidadId}
                  </td>
                  {PARTIDAS.map(partida => {
                    const key         = cellKey(entidadId, partida.id);
                    const recepcionada = avanceMap[key];
                    const planificada  = planMap[key] ?? '';
                    const esSaving     = guardando === key;

                    return (
                      <td key={partida.id} style={s.td}>
                        {recepcionada ? (
                          <span style={s.cellRecepcionada} title="Ya recepcionada">
                            ✅ {nombreCuadrilla(recepcionada)}
                          </span>
                        ) : (
                          <select
                            style={{
                              ...s.select,
                              ...(planificada ? s.selectAsignado : {}),
                              ...(esSaving ? s.selectGuardando : {}),
                            }}
                            value={planificada}
                            onChange={e => asignar(entidadId, partida.id, e.target.value)}
                            disabled={esSaving}
                          >
                            <option value="">—</option>
                            {cuadrillasActivas.map(c => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={s.leyenda}>
        ✅ = partida ya recepcionada (solo lectura) &nbsp;·&nbsp;
        Dropdown = cuadrilla planificada (guarda al cambiar)
      </p>
    </div>
  );
}

const s = {
  page: {
    maxWidth: '1100px', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '40px',
  },

  titulo: { color: '#ccd6f6', fontSize: '20px', fontWeight: 700, margin: 0 },

  tabs: { display: 'flex', gap: '8px' },
  tab: {
    background: '#16213e', color: '#8892b0', border: '1px solid #0f3460',
    borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer',
  },
  tabActivo: { background: '#0f3460', color: '#64ffda', borderColor: '#64ffda' },

  cargando: { color: '#8892b0', fontSize: '13px', margin: 0 },

  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid #0f3460',
  },

  table: {
    borderCollapse: 'collapse',
    width: '100%',
    minWidth: '820px',
    fontSize: '12px',
  },

  th: {
    background: '#0f3460',
    color: '#64ffda',
    fontWeight: 700,
    padding: '10px 12px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #1e3a5f',
    letterSpacing: '0.3px',
  },
  thFija: {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    minWidth: '90px',
    borderRight: '1px solid #1e3a5f',
  },

  trPar:   { background: '#16213e' },
  trImpar: { background: '#111827' },

  td: {
    padding: '6px 8px',
    borderBottom: '1px solid #0f3460',
    verticalAlign: 'middle',
  },
  tdFija: {
    position: 'sticky',
    left: 0,
    background: '#1a2744',
    color: '#ccd6f6',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    borderRight: '1px solid #1e3a5f',
    zIndex: 1,
  },

  select: {
    background: '#0a1f3a',
    border: '1px solid #1e3a5f',
    borderRadius: '6px',
    color: '#8892b0',
    fontSize: '11px',
    padding: '5px 7px',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    minWidth: '110px',
    cursor: 'pointer',
  },
  selectAsignado: {
    color: '#ccd6f6',
    borderColor: '#2a5080',
    background: '#0d2a48',
  },
  selectGuardando: {
    opacity: 0.5,
    cursor: 'wait',
  },

  cellRecepcionada: {
    color: '#10b981',
    fontWeight: 600,
    fontSize: '11px',
    whiteSpace: 'nowrap',
    display: 'block',
    padding: '5px 2px',
  },

  leyenda: {
    color: '#8892b0', fontSize: '11px', margin: 0, textAlign: 'center',
  },
};
