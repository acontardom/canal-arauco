import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TRAMOS, CAIDAS, ATRAVIESOS, PROTOCOLOS, ETAPA_2, esEtapa2, esVisible, nombreEntidad as calcNombreEntidad } from '../constants/estructura';
import { supabase } from '../config/supabase';

// ─── Orden y etiquetas de columnas ────────────────────────────────────────────

const ORDEN_MATRIZ_TRAMO = [
  'PICE1', 'G5', 'PICE4_RADIER', 'PICE3', 'PICE2_RADIER', 'PICE2_MURO', 'HA_RADIER', 'HA_MURO', 'COTAS',
];

const ORDEN_MATRIZ_CAIDA = [
  'PICE1', 'G5', 'PICE4_RADIER', 'PICE4_MURO', 'PICE3', 'PICE2_RADIER', 'PICE2_MURO', 'HA_RADIER', 'HA_MURO', 'COTAS',
];

const PROTOCOLOS_MATRIZ_TRAMO = ORDEN_MATRIZ_TRAMO.map(id => PROTOCOLOS.find(p => p.id === id));
const PROTOCOLOS_MATRIZ_CAIDA = ORDEN_MATRIZ_CAIDA.map(id => PROTOCOLOS.find(p => p.id === id));

const COL_LABEL = {
  PICE1:        'Excavación',
  G5:           'Emplantillado',
  PICE4_RADIER: 'Enfierradura',
  PICE4_MURO:   'Enfierr. Muro',
  PICE3:        'Moldajes',
  PICE2_RADIER: 'Horm. Radier',
  PICE2_MURO:   'Horm. Muro',
  HA_RADIER:    'H.A. Radier',
  HA_MURO:      'H.A. Muro',
  COTAS:        'Cotas Topog.',
};

const COL_LABEL_CAIDA = { ...COL_LABEL, PICE4_RADIER: 'Enfierr. Radier' };

// ─── Mapeo protocolo → partida de avance ──────────────────────────────────────

const PROTOCOLO_A_PARTIDA = {
  PICE1:        'excavacion',
  G5:           'emplantillado',
  PICE4_RADIER: 'enfierradura',
  PICE4_MURO:   'enfierradura',
  PICE3:        'moldaje',
  PICE2_RADIER: 'hormigon_radier',
  PICE2_MURO:   'hormigon_muro',
  HA_RADIER:    'hormigon_radier',
  HA_MURO:      'hormigon_muro',
};

// ─── Estados base y colores ────────────────────────────────────────────────────

const ESTADOS = {
  sin_iniciar:       { label: 'Sin iniciar',       color: '#1e293b' },
  borrador:          { label: 'Borrador',           color: '#78716c' },
  por_protoc:        { label: 'Por protocolizar',   color: '#f59e0b' },
  listo:             { label: 'Protocolo listo',    color: '#3b82f6' },
  enviado:           { label: 'Enviado EDP',        color: '#16a34a' },
  enviado_ito:       { label: 'Enviado al ITO',     color: '#8b5cf6' },
  con_observaciones: { label: 'Con observaciones',  color: '#f97316' },
  firmado:           { label: 'Firmado',            color: '#5b21b6' },
};

const COLOR_ENVIADO_BASE = '#16a34a';
const COLOR_EDP_OSCURO   = '#14532d';
const COLOR_EDP_CLARO    = '#86efac';

function calcEstado(protEstado, recepcionada) {
  if (protEstado === 'enviado')           return 'enviado';
  if (protEstado === 'enviado_edp')       return 'enviado';
  if (protEstado === 'completado')        return 'listo';
  if (protEstado === 'listo')             return 'listo';
  if (protEstado === 'enviado_ito')       return 'enviado_ito';
  if (protEstado === 'con_observaciones') return 'con_observaciones';
  if (protEstado === 'firmado')           return 'firmado';
  if (protEstado === 'borrador')          return 'borrador';
  if (recepcionada)                       return 'por_protoc';
  return 'sin_iniciar';
}

// Interpola linealmente entre dos colores hex
function lerpColor(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Normaliza el campo edp a string: número 5 → '5', 'EDP-1' → '1', null → null
function normalizeEdp(edp) {
  if (edp == null) return null;
  const s = String(edp).trim();
  return s.startsWith('EDP-') ? s.slice(4) : s;
}

// Genera un mapa { edp: color } para la lista de EDPs ordenados
function generarEscalaEdp(edps) {
  const n = edps.length;
  if (n === 0) return {};
  if (n === 1) return { [edps[0]]: COLOR_ENVIADO_BASE };
  return Object.fromEntries(
    edps.map((edp, i) => [edp, lerpColor(COLOR_EDP_OSCURO, COLOR_EDP_CLARO, i / (n - 1))])
  );
}

// ─── Componentes de tabla ─────────────────────────────────────────────────────

const isMobile = window.innerWidth < 768;

function MatrizCell({ tipo, entidadId, protocolo, protMap, avanceSet, navigate, nombreEntidad, verPorEdp, edpColorMap, edpSeleccionado }) {
  const protData   = protMap[`${tipo}-${String(entidadId)}-${protocolo.id}`];
  const protEstado = protData?.estado;
  const edp        = protData?.edp;

  let estado;
  if (protocolo.id === 'COTAS') {
    if (protEstado) {
      estado = calcEstado(protEstado, false);
    } else {
      const tieneRadier = avanceSet.has(`${tipo}-${String(entidadId)}-hormigon_radier`);
      estado = tieneRadier ? 'por_protoc' : 'sin_iniciar';
    }
  } else {
    const partidaId    = PROTOCOLO_A_PARTIDA[protocolo.id];
    const recepcionada = partidaId ? avanceSet.has(`${tipo}-${String(entidadId)}-${partidaId}`) : false;
    estado             = calcEstado(protEstado, recepcionada);
  }
  const { label, color } = ESTADOS[estado];

  // En modo EDP, las celdas enviadas toman el color del EDP correspondiente
  let cellColor = color;
  if (verPorEdp && estado === 'enviado') {
    if (edpSeleccionado) {
      cellColor = String(edp) === String(edpSeleccionado)
        ? (edpColorMap[edp] ?? COLOR_ENVIADO_BASE)
        : '#1e293b';
    } else {
      cellColor = edp && edpColorMap[edp] ? edpColorMap[edp] : COLOR_ENVIADO_BASE;
    }
  }

  const tooltip = (estado === 'listo' || estado === 'enviado') && edp
    ? `${nombreEntidad} — ${protocolo.nombre}: ${label} — ${edp}`
    : `${nombreEntidad} — ${protocolo.nombre}: ${label}`;

  return (
    <td
      style={{ ...s.celda, background: cellColor }}
      title={tooltip}
      onClick={() => navigate(`/protocolo/${tipo}/${entidadId}/${protocolo.id}?from=matriz`)}
    />
  );
}

function ColGroup({ protocolos }) {
  return (
    <colgroup>
      <col style={{ width: `${ROW_HEADER_W}px` }} />
      {protocolos.map(p => <col key={p.id} />)}
    </colgroup>
  );
}

function EncabezadoColumnas({ protocolos, colLabel = COL_LABEL }) {
  return (
    <tr>
      <th style={s.cornerCell} />
      {protocolos.map(p => (
        <th key={p.id} style={s.colHeader}>{colLabel[p.id]}</th>
      ))}
    </tr>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DashboardMatriz() {
  const navigate = useNavigate();

  const [protMap, setProtMap]       = useState({});
  const [avanceSet, setAvanceSet]   = useState(new Set());
  const [verPorEdp, setVerPorEdp]         = useState(false);
  const [edpSeleccionado, setEdpSeleccionado] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from('protocolos').select('tipo,entidad_id,protocolo_id,estado,edp'),
      supabase.from('avance').select('tipo_entidad,entidad_id,partida_id'),
    ]).then(([{ data: prots }, { data: avance }]) => {
      const pMap = {};
      for (const p of prots ?? []) {
        pMap[`${p.tipo}-${String(p.entidad_id)}-${p.protocolo_id}`] = { estado: p.estado, edp: normalizeEdp(p.edp) };
      }
      setProtMap(pMap);
      setAvanceSet(new Set(
        (avance ?? []).map(r => `${r.tipo_entidad}-${String(r.entidad_id)}-${r.partida_id}`)
      ));
    });
  }, []);

  // Lista de EDPs únicos de protocolos enviados, ordenados alfabéticamente
  const edpList = useMemo(() => {
    const edps = new Set();
    for (const { estado, edp } of Object.values(protMap)) {
      if ((estado === 'enviado' || estado === 'enviado_edp') && edp) edps.add(edp);
    }
    return [...edps].sort();
  }, [protMap]);

  const edpColorMap = useMemo(() => generarEscalaEdp(edpList), [edpList]);

  const cellProps = { protMap, avanceSet, navigate, verPorEdp, edpColorMap, edpSeleccionado };

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Matriz de Protocolos</h1>

      <div style={s.controles}>
        <div style={s.leyenda}>
          <div style={s.leyendaItem}>
            <div style={{ ...s.swatch, border: '1px solid #475569' }} />
            <span>Sin iniciar</span>
          </div>

          <div style={s.leyendaGrupo}>
            <div style={s.leyendaGrupoTitulo}>Nuestra parte</div>
            <div style={s.leyendaGrupoItems}>
              <div style={s.leyendaItem}>
                <div style={{ ...s.swatch, background: ESTADOS.borrador.color }} />
                <span>Borrador</span>
              </div>
              <div style={s.leyendaItem}>
                <div style={{ ...s.swatch, background: ESTADOS.por_protoc.color }} />
                <span>Por protocolizar</span>
              </div>
              <div style={s.leyendaItem}>
                <div style={{ ...s.swatch, background: ESTADOS.listo.color }} />
                <span>Protocolo listo</span>
              </div>
            </div>
          </div>

          <div style={s.leyendaGrupo}>
            <div style={s.leyendaGrupoTitulo}>Parte del ITO</div>
            <div style={s.leyendaGrupoItems}>
              <div style={s.leyendaItem}>
                <div style={{ ...s.swatch, background: ESTADOS.enviado_ito.color }} />
                <span>Enviado al ITO</span>
              </div>
              <div style={s.leyendaItem}>
                <div style={{ ...s.swatch, background: ESTADOS.con_observaciones.color }} />
                <span>Con observaciones</span>
              </div>
              <div style={s.leyendaItem}>
                <div style={{ ...s.swatch, background: ESTADOS.firmado.color }} />
                <span>Firmado</span>
              </div>
            </div>
          </div>

          <div style={s.leyendaGrupo}>
            <div style={s.leyendaGrupoTitulo}>Sin gestión</div>
            <div style={s.leyendaGrupoItems}>
              {verPorEdp && edpList.length > 0 ? edpList.map(edp => (
                <div key={edp} style={s.leyendaItem}>
                  <div style={{ ...s.swatch, background: edpColorMap[edp] }} />
                  <span>{edp}</span>
                </div>
              )) : (
                <div style={s.leyendaItem}>
                  <div style={{ ...s.swatch, background: ESTADOS.enviado.color }} />
                  <span>Enviado EDP</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <button
            style={{ ...s.btnToggle, ...(verPorEdp ? s.btnToggleActivo : {}) }}
            onClick={() => { if (verPorEdp) setEdpSeleccionado(null); setVerPorEdp(v => !v); }}
          >
            {verPorEdp ? '🟢 Ver por EDP: ON' : '⬜ Ver por EDP: OFF'}
          </button>
          {verPorEdp && edpList.length > 0 && (
            <select
              style={s.selectEdp}
              value={edpSeleccionado ?? ''}
              onChange={e => setEdpSeleccionado(e.target.value || null)}
            >
              <option value="">Todos</option>
              {edpList.map(edp => (
                <option key={edp} value={edp}>EDP {edp}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div style={s.contenedor}>
        {/* ── Tabla TRAMOS ──────────────────────────────────────────────── */}
        <div style={s.tablaWrap}>
          <table style={s.tabla}>
            <ColGroup protocolos={PROTOCOLOS_MATRIZ_TRAMO} />
            <thead>
              <tr>
                <th colSpan={PROTOCOLOS_MATRIZ_TRAMO.length + 1} style={s.tituloTabla}>TRAMOS</th>
              </tr>
              <EncabezadoColumnas protocolos={PROTOCOLOS_MATRIZ_TRAMO} />
            </thead>
            <tbody>
              {TRAMOS.filter(id => !esEtapa2('tramo', id) && esVisible('tramo', id)).map(tramoId => (
                <tr key={tramoId}>
                  <th style={s.rowHeader}>{tramoId}</th>
                  {PROTOCOLOS_MATRIZ_TRAMO.map(p => (
                    <MatrizCell
                      key={p.id}
                      tipo="tramo"
                      entidadId={tramoId}
                      protocolo={p}
                      nombreEntidad={calcNombreEntidad('tramo', tramoId)}
                      {...cellProps}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Tabla ETAPA 2 ─────────────────────────────────────────── */}
        <div style={s.tablaWrap}>
          <table style={s.tabla}>
            <ColGroup protocolos={PROTOCOLOS_MATRIZ_CAIDA} />
            <thead>
              <tr>
                <th colSpan={PROTOCOLOS_MATRIZ_CAIDA.length + 1} style={s.tituloTabla}>ETAPA 2</th>
              </tr>
              <EncabezadoColumnas protocolos={PROTOCOLOS_MATRIZ_CAIDA} colLabel={COL_LABEL_CAIDA} />
            </thead>
            <tbody>
              {ETAPA_2.map(({ tipo, id }) => (
                <tr key={`${tipo}-${id}`}>
                  <th style={s.rowHeader}>
                    {tipo === 'atravieso' ? `AT${id}` : String(id)}
                  </th>
                  {PROTOCOLOS_MATRIZ_CAIDA.map(p => (
                    <MatrizCell
                      key={p.id}
                      tipo={tipo}
                      entidadId={id}
                      protocolo={p}
                      nombreEntidad={calcNombreEntidad(tipo, id)}
                      {...cellProps}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Tabla CAÍDAS + ATRAVIESOS ────────────────────────────────── */}
        <div style={s.tablaWrap}>
          <table style={s.tabla}>
            <ColGroup protocolos={PROTOCOLOS_MATRIZ_CAIDA} />
            <thead>
              <tr>
                <th colSpan={PROTOCOLOS_MATRIZ_CAIDA.length + 1} style={s.tituloTabla}>CAÍDAS</th>
              </tr>
              <EncabezadoColumnas protocolos={PROTOCOLOS_MATRIZ_CAIDA} colLabel={COL_LABEL_CAIDA} />
            </thead>
            <tbody>
              {CAIDAS.filter(id => !esEtapa2('caida', String(id))).map(caidaId => (
                <tr key={caidaId}>
                  <th style={s.rowHeader}>{caidaId}</th>
                  {PROTOCOLOS_MATRIZ_CAIDA.map(p => (
                    <MatrizCell
                      key={p.id}
                      tipo="caida"
                      entidadId={caidaId}
                      protocolo={p}
                      nombreEntidad={calcNombreEntidad('caida', caidaId)}
                      {...cellProps}
                    />
                  ))}
                </tr>
              ))}

              <tr>
                <th colSpan={PROTOCOLOS_MATRIZ_CAIDA.length + 1} style={s.separadorFila}>ATRAVIESOS</th>
              </tr>

              {ATRAVIESOS.filter(id => !esEtapa2('atravieso', id)).map(atId => (
                <tr key={atId}>
                  <th style={s.rowHeader}>{`AT${atId}`}</th>
                  {PROTOCOLOS_MATRIZ_CAIDA.map(p => (
                    <MatrizCell
                      key={p.id}
                      tipo="atravieso"
                      entidadId={atId}
                      protocolo={p}
                      nombreEntidad={calcNombreEntidad('atravieso', atId)}
                      {...cellProps}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const CELL = 32;
const ROW_HEADER_W = 44;
const HEADER_H = 130;

const s = {
  page: { maxWidth: '1120px', margin: '0 auto' },
  titulo: { color: '#ccd6f6', fontSize: '24px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' },

  controles: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    gap: '20px', flexWrap: 'wrap', marginBottom: '28px',
  },
  leyenda: { display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' },
  leyendaGrupo: { display: 'flex', flexDirection: 'column', gap: 4 },
  leyendaGrupoTitulo: { fontSize: 11, color: '#8892b0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' },
  leyendaGrupoItems: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  leyendaItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccd6f6' },
  swatch: { width: 14, height: 14, borderRadius: 3, background: '#1e293b', flexShrink: 0 },

  btnToggle: {
    background: '#16213e', border: '1px solid #0f3460', color: '#8892b0',
    borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
  },
  btnToggleActivo: {
    background: 'rgba(39,174,96,0.12)', border: '1px solid #27ae60', color: '#82e0aa',
  },
  selectEdp: {
    background: '#16213e', border: '1px solid #27ae60', color: '#82e0aa',
    borderRadius: '8px', padding: '7px 10px', fontSize: '12px', fontWeight: 700,
    cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
  },

  contenedor: {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: '24px',
    justifyContent: 'center',
    alignItems: isMobile ? 'stretch' : 'flex-start',
  },
  tablaWrap: {
    flex: isMobile ? '1 1 100%' : '0 1 48%',
    maxWidth: isMobile ? 'none' : '520px',
    overflow: 'auto',
    maxHeight: 'calc(100vh - 120px)',
    border: '1px solid #0f3460',
    borderRadius: '10px',
    marginBottom: isMobile ? '8px' : 0,
  },
  tabla: { borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: '360px' },

  tituloTabla: {
    background: '#0f3460', color: '#64ffda', fontSize: '17px', fontWeight: 800,
    textAlign: 'center', padding: '12px 0', letterSpacing: '2px', textTransform: 'uppercase',
    position: 'sticky', top: 0, zIndex: 2,
  },
  separadorFila: {
    background: '#1e3a5f', color: '#64ffda', fontSize: '13px', fontWeight: 700,
    textAlign: 'center', padding: '8px 0', letterSpacing: '1.5px',
  },
  colHeader: {
    height: `${HEADER_H}px`, background: '#0f3460', color: '#ccd6f6',
    fontSize: '15px', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle',
    border: '1px solid #1a1a2e', padding: '8px 4px',
    writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap',
    position: 'sticky', top: 44, zIndex: 2,
  },
  cornerCell: {
    width: `${ROW_HEADER_W}px`, background: '#0f3460', border: '1px solid #1a1a2e',
    position: 'sticky', top: 44, left: 0, zIndex: 3,
  },
  rowHeader: {
    width: `${ROW_HEADER_W}px`, height: `${CELL}px`, background: '#0f3460', color: '#ccd6f6',
    fontSize: '12px', fontWeight: 700, textAlign: 'center', border: '1px solid #1a1a2e', padding: '6px 4px',
    position: 'sticky', left: 0, zIndex: 1,
  },
  celda: {
    height: `${CELL}px`, minWidth: `${CELL}px`, border: '1px solid #1a1a2e',
    padding: '8px', cursor: 'pointer', boxSizing: 'border-box',
  },
};
