import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { useAuth } from '../hooks/useAuth';
import { PROTOCOLOS, TRAMOS, CAIDAS, ATRAVIESOS } from '../constants/estructura';

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLORES_ITO = {
  sin_iniciar:       '#1e293b',
  por_firmar:        '#8b5cf6',
  con_observaciones: '#f97316',
  firmado:           '#5b21b6',
  enviado:           '#16a34a',
};

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const NOMBRE_PROT = Object.fromEntries(PROTOCOLOS.map(p => [p.id, p.nombre]));

const ITO_IDS_TRAMO = ['PICE1', 'PICE4_RADIER', 'PICE3', 'PICE2_RADIER', 'PICE2_MURO', 'HA_RADIER', 'HA_MURO', 'COTAS'];
const ITO_IDS_CAIDA = ['PICE1', 'PICE4_RADIER', 'PICE4_MURO', 'PICE3', 'PICE2_RADIER', 'PICE2_MURO', 'HA_RADIER', 'HA_MURO', 'COTAS'];

const PROTS_TRAMO = ITO_IDS_TRAMO.map(id => PROTOCOLOS.find(p => p.id === id)).filter(Boolean);
const PROTS_CAIDA = ITO_IDS_CAIDA.map(id => PROTOCOLOS.find(p => p.id === id)).filter(Boolean);

const COL_ABR = {
  PICE1:        'Excav.',
  PICE4_RADIER: 'Enf.R.',
  PICE4_MURO:   'Enf.M.',
  PICE3:        'Mold.',
  PICE2_RADIER: 'H.Rad.',
  PICE2_MURO:   'H.Mur.',
  HA_RADIER:    'HA.R.',
  HA_MURO:      'HA.M.',
  COTAS:        'Cotas',
};

const LEYENDA_NOMBRE = {
  por_firmar:        'Por firmar',
  con_observaciones: 'Observaciones',
  firmado:           'Firmado',
  enviado:           'Enviado EDP',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcEstadoITO(protEstado) {
  if (protEstado === 'enviado_ito')       return 'por_firmar';
  if (protEstado === 'con_observaciones') return 'con_observaciones';
  if (protEstado === 'firmado')           return 'firmado';
  if (protEstado === 'enviado' || protEstado === 'enviado_edp') return 'enviado';
  return 'sin_iniciar';
}

function fmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function buildEdpColorMap(edps) {
  if (edps.length === 0) return {};
  if (edps.length === 1) return { [edps[0]]: '#16a34a' };
  return Object.fromEntries(edps.map((edp, i) => {
    const t = i / (edps.length - 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    const r = lerp(0x14, 0x86), g = lerp(0x53, 0xef), b = lerp(0x2d, 0xac);
    return [edp, `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`];
  }));
}

// ─── RecuadroProtocolos ───────────────────────────────────────────────────────

function RecuadroProtocolos({ titulo, protocolos, color, renderAccion }) {
  return (
    <div style={{ ...s.recuadro, borderColor: color }}>
      <div style={s.recuadroHeader}>
        <span style={{ ...s.recuadroTitulo, color }}>{titulo}</span>
        <span style={{ ...s.recuadroBadge, background: color }}>{protocolos.length}</span>
      </div>
      <div style={s.recuadroScroll}>
        {protocolos.length === 0
          ? <p style={s.recuadroVacio}>Sin protocolos</p>
          : protocolos.map(p => (
            <div key={p.id} style={s.card}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.cardNombre}>
                  {NOMBRE_PROT[p.protocolo_id] ?? p.protocolo_id}
                  &nbsp;—&nbsp;{NOMBRE_TIPO[p.tipo] ?? p.tipo}&nbsp;{p.entidad_id}
                </div>
                <div style={s.cardFecha}>{fmtFecha(p.fecha_modificacion)}</div>
                {p.observacion_ito && (
                  <div style={s.cardObs}>Obs: {p.observacion_ito}</div>
                )}
              </div>
              {renderAccion && renderAccion(p)}
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── MatrizCeldaITO ──────────────────────────────────────────────────────────

function MatrizCeldaITO({ tipo, entidadId, protocolo, protMap, verPorEdp, edpColors, navigate }) {
  const protData  = protMap[`${tipo}-${String(entidadId)}-${protocolo.id}`];
  const estadoITO = calcEstadoITO(protData?.estado);
  const edp       = protData?.edp;

  const bg = (verPorEdp && estadoITO === 'enviado' && edp && edpColors[edp])
    ? edpColors[edp]
    : COLORES_ITO[estadoITO];

  const clickable = estadoITO !== 'sin_iniciar' && estadoITO !== 'enviado';

  function handleClick() {
    if (clickable && protData?.firmaToken) {
      navigate(`/firma/${protData.firmaToken}`);
    }
  }

  return (
    <td
      title={`${NOMBRE_TIPO[tipo]} ${entidadId} — ${protocolo.nombre}: ${estadoITO}`}
      style={{ ...s.celda, background: bg, cursor: clickable ? 'pointer' : 'default' }}
      onClick={handleClick}
    />
  );
}

// ─── PortalITO ────────────────────────────────────────────────────────────────

export default function PortalITO() {
  const navigate = useNavigate();
  const { usuario, signOut } = useAuth();

  const [pendientes,       setPendientes]       = useState([]);
  const [conObservaciones, setConObservaciones] = useState([]);
  const [firmados,         setFirmados]         = useState([]);
  const [protMap,          setProtMap]          = useState({});
  const [cargando,         setCargando]         = useState(true);
  const [verPorEdp,        setVerPorEdp]        = useState(false);
  const [isMobile,         setIsMobile]         = useState(window.innerWidth < 768);
  const [ultimaAct,        setUltimaAct]        = useState(new Date());
  const [ahora,            setAhora]            = useState(new Date());

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    cargarProtocolos();
    const interval = setInterval(cargarProtocolos, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function cargarProtocolos() {
    try {
      const { data, error } = await supabase
        .from('protocolos')
        .select('id, tipo, entidad_id, protocolo_id, estado, fecha_modificacion, firma_token, pdf_firmado_url, observacion_ito, edp')
        .order('fecha_modificacion', { ascending: false });
      if (error) throw error;

      const rows = data ?? [];
      setPendientes(       rows.filter(p => p.estado === 'enviado_ito')       );
      setConObservaciones( rows.filter(p => p.estado === 'con_observaciones') );
      setFirmados(         rows.filter(p => p.estado === 'firmado')           );

      const map = {};
      for (const p of rows) {
        map[`${p.tipo}-${String(p.entidad_id)}-${p.protocolo_id}`] = {
          estado:     p.estado,
          edp:        p.edp ?? null,
          firmaToken: p.firma_token ?? null,
        };
      }
      setProtMap(map);
      setUltimaAct(new Date());
    } catch (err) {
      console.error('[PortalITO]', err?.message ?? err);
    } finally {
      setCargando(false);
    }
  }

  const edpList = useMemo(() => {
    const set = new Set();
    for (const { estado, edp } of Object.values(protMap)) {
      if ((estado === 'enviado' || estado === 'enviado_edp') && edp) set.add(edp);
    }
    return [...set].sort();
  }, [protMap]);

  const edpColors = useMemo(() => buildEdpColorMap(edpList), [edpList]);

  const segsDesde = Math.floor((ahora - ultimaAct) / 1000);
  const cellProps = { protMap, verPorEdp, edpColors, navigate };

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.header}>
        <div>
          <h1 style={s.titulo}>Portal ITO</h1>
          {usuario && <p style={s.bienvenida}>Bienvenido, {usuario.nombre ?? usuario.email}</p>}
        </div>
        <div style={s.headerRight}>
          <div style={s.indicador}>
            <span style={s.indTexto}>
              {cargando ? 'Actualizando…' : `Actualizado hace ${segsDesde}s`}
            </span>
            <button style={s.btnRefresh} onClick={cargarProtocolos} disabled={cargando}>↺</button>
          </div>
          <button style={s.btnSalir} onClick={signOut}>Cerrar sesión</button>
        </div>
      </div>

      {/* ── Recuadros ── */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16 }}>
        <RecuadroProtocolos
          titulo="Por firmar"
          protocolos={pendientes}
          color={COLORES_ITO.por_firmar}
          renderAccion={p => p.firma_token && (
            <button style={s.btnFirmar} onClick={() => navigate(`/firma/${p.firma_token}`)}>
              Ver y Firmar →
            </button>
          )}
        />
        <RecuadroProtocolos
          titulo="Con observaciones"
          protocolos={conObservaciones}
          color={COLORES_ITO.con_observaciones}
          renderAccion={() => (
            <span style={s.labelCorreccion}>En corrección</span>
          )}
        />
        <RecuadroProtocolos
          titulo="Firmados"
          protocolos={firmados}
          color={COLORES_ITO.firmado}
          renderAccion={p => p.pdf_firmado_url && (
            <a href={p.pdf_firmado_url} target="_blank" rel="noopener noreferrer" style={s.btnPDF}>
              ↓ PDF
            </a>
          )}
        />
      </div>

      {/* ── Matriz ITO ── */}
      <div>
        <div style={s.matrizHeader}>
          <h2 style={s.matrizTitulo}>Matriz de protocolos</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {Object.entries(COLORES_ITO)
                .filter(([k]) => k !== 'sin_iniciar')
                .map(([key, color]) => (
                  <div key={key} style={s.leyendaItem}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <span style={s.leyendaLabel}>{LEYENDA_NOMBRE[key]}</span>
                  </div>
                ))}
            </div>
            <button
              style={{ ...s.btnToggle, ...(verPorEdp ? s.btnToggleOn : {}) }}
              onClick={() => setVerPorEdp(v => !v)}
            >
              Ver por EDP
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: 'flex-start' }}>

          {/* Tramos */}
          <div style={s.tablaWrap}>
            <table style={s.tabla}>
              <thead>
                <tr>
                  <th colSpan={PROTS_TRAMO.length + 1} style={s.tituloTabla}>TRAMOS</th>
                </tr>
                <tr>
                  <th style={s.cornerCell} />
                  {PROTS_TRAMO.map(p => (
                    <th key={p.id} style={s.colHeader}>{COL_ABR[p.id]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TRAMOS.map(id => (
                  <tr key={id}>
                    <th style={s.rowHeader}>{id}</th>
                    {PROTS_TRAMO.map(p => (
                      <MatrizCeldaITO key={p.id} tipo="tramo" entidadId={id} protocolo={p} {...cellProps} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Caídas + Atraviesos */}
          <div style={s.tablaWrap}>
            <table style={s.tabla}>
              <thead>
                <tr>
                  <th colSpan={PROTS_CAIDA.length + 1} style={s.tituloTabla}>CAÍDAS</th>
                </tr>
                <tr>
                  <th style={s.cornerCell} />
                  {PROTS_CAIDA.map(p => (
                    <th key={p.id} style={s.colHeader}>{COL_ABR[p.id]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAIDAS.map(id => (
                  <tr key={id}>
                    <th style={s.rowHeader}>{id}</th>
                    {PROTS_CAIDA.map(p => (
                      <MatrizCeldaITO key={p.id} tipo="caida" entidadId={id} protocolo={p} {...cellProps} />
                    ))}
                  </tr>
                ))}
                <tr>
                  <th colSpan={PROTS_CAIDA.length + 1} style={s.separadorFila}>ATRAVIESOS</th>
                </tr>
                {ATRAVIESOS.map(id => (
                  <tr key={id}>
                    <th style={s.rowHeader}>AT {id}</th>
                    {PROTS_CAIDA.map(p => (
                      <MatrizCeldaITO key={p.id} tipo="atravieso" entidadId={id} protocolo={p} {...cellProps} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const CELL = 28;

const s = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    boxSizing: 'border-box',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  titulo:     { color: '#ccd6f6', fontSize: 22, fontWeight: 700, margin: 0 },
  bienvenida: { color: '#8892b0', fontSize: 13, margin: '4px 0 0' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  indicador:   { display: 'flex', alignItems: 'center', gap: 6 },
  indTexto:    { color: '#8892b0', fontSize: 12 },
  btnRefresh: {
    background: 'transparent',
    border: '1px solid #1e3a5f',
    borderRadius: 6,
    color: '#8892b0',
    fontSize: 16,
    cursor: 'pointer',
    padding: '2px 8px',
    lineHeight: 1.4,
  },
  btnSalir: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8,
    color: '#f87171',
    fontSize: 13,
    fontWeight: 600,
    padding: '8px 14px',
    cursor: 'pointer',
    flexShrink: 0,
  },

  recuadro: {
    flex: 1,
    minWidth: 0,
    background: '#16213e',
    border: '1px solid',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  recuadroHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  recuadroTitulo: { fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.4px' },
  recuadroBadge:  { color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 },
  recuadroScroll: { height: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 },
  recuadroVacio:  { color: '#8892b0', fontSize: 13, textAlign: 'center', margin: '2rem 0' },

  card: {
    background: '#0a1428',
    borderRadius: 8,
    padding: '10px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  cardNombre: { color: '#ccd6f6', fontSize: 13, fontWeight: 600, lineHeight: 1.4 },
  cardFecha:  { color: '#8892b0', fontSize: 11, marginTop: 2 },
  cardObs:    { color: '#f97316', fontSize: 11, marginTop: 4 },

  btnFirmar: {
    background: '#4c1d95',
    border: 'none',
    borderRadius: 7,
    color: '#e9d5ff',
    fontSize: 12,
    fontWeight: 700,
    padding: '7px 12px',
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  btnPDF: {
    background: '#14532d',
    borderRadius: 7,
    color: '#bbf7d0',
    fontSize: 12,
    fontWeight: 700,
    padding: '7px 12px',
    textDecoration: 'none',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  labelCorreccion: { color: '#8892b0', fontSize: 12, flexShrink: 0, whiteSpace: 'nowrap' },

  matrizHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  matrizTitulo: { color: '#ccd6f6', fontSize: 18, fontWeight: 700, margin: 0 },
  leyendaItem:  { display: 'flex', alignItems: 'center', gap: 5 },
  leyendaLabel: { color: '#8892b0', fontSize: 11 },

  btnToggle: {
    background: '#16213e',
    border: '1px solid #0f3460',
    color: '#8892b0',
    borderRadius: 7,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnToggleOn: {
    background: 'rgba(22,163,74,0.12)',
    border: '1px solid #16a34a',
    color: '#86efac',
  },

  tablaWrap: {
    flex: '0 1 auto',
    overflow: 'auto',
    maxHeight: 'calc(100vh - 80px)',
    border: '1px solid #0f3460',
    borderRadius: 10,
  },
  tabla: { borderCollapse: 'collapse', tableLayout: 'fixed' },
  tituloTabla: {
    background: '#0f3460',
    color: '#8892b0',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    padding: '6px 8px',
    textAlign: 'left',
  },
  cornerCell: {
    background: '#0a1428',
    width: 40,
    minWidth: 40,
    position: 'sticky',
    left: 0,
    zIndex: 2,
    borderBottom: '1px solid #0f3460',
  },
  colHeader: {
    background: '#0a1428',
    color: '#8892b0',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    padding: '4px 2px',
    textAlign: 'center',
    verticalAlign: 'bottom',
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    height: 80,
    width: CELL,
    minWidth: CELL,
    letterSpacing: '0.3px',
    borderBottom: '1px solid #0f3460',
  },
  rowHeader: {
    background: '#0a1428',
    color: '#ccd6f6',
    fontSize: 12,
    fontWeight: 700,
    padding: '3px 6px',
    textAlign: 'left',
    position: 'sticky',
    left: 0,
    zIndex: 1,
    whiteSpace: 'nowrap',
    borderRight: '1px solid #0f3460',
  },
  separadorFila: {
    background: '#0f3460',
    color: '#8892b0',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    padding: '4px 6px',
    textAlign: 'left',
  },
  celda: {
    width: CELL,
    height: CELL,
    minWidth: CELL,
    border: '1px solid #0a1428',
  },
};
