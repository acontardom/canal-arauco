import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { useAuth } from '../hooks/useAuth';
import { PROTOCOLOS, TRAMOS, CAIDAS, ATRAVIESOS, ETAPA_2, esEtapa2, esVisible, nombreEntidad } from '../constants/estructura';

// ─── Constantes de los recuadros ──────────────────────────────────────────────

const COLORES_ITO = {
  por_firmar:        '#8b5cf6',
  con_observaciones: '#f97316',
  firmado:           '#5b21b6',
};

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const NOMBRE_PROT = Object.fromEntries(PROTOCOLOS.map(p => [p.id, p.nombre]));

// ─── Constantes de la matriz ──────────────────────────────────────────────────

const COLUMNAS_TRAMOS = [
  { id: 'PICE1',        label: 'Excav.'    },
  { id: 'G5',           label: 'Emplant.'  },
  { id: 'PICE2_RADIER', label: 'H. Rad.'   },
  { id: 'PICE2_MURO',   label: 'H. Muro'   },
  { id: 'PICE3',        label: 'Moldaje'   },
  { id: 'PICE4_RADIER', label: 'Enfierr.'  },
  { id: 'HA_RADIER',    label: 'H.A. Rad.' },
  { id: 'HA_MURO',      label: 'H.A. Muro' },
  { id: 'COTAS',        label: 'Cotas'     },
];

const COLUMNAS_CAIDAS_ATRAVIESOS = [
  { id: 'PICE1',        label: 'Excav.'    },
  { id: 'G5',           label: 'Emplant.'  },
  { id: 'PICE2_RADIER', label: 'H. Rad.'   },
  { id: 'PICE2_MURO',   label: 'H. Muro'   },
  { id: 'PICE3',        label: 'Moldaje'   },
  { id: 'PICE4_RADIER', label: 'Enf.Rad.'  },
  { id: 'PICE4_MURO',   label: 'Enf.Muro'  },
  { id: 'HA_RADIER',    label: 'H.A. Rad.' },
  { id: 'HA_MURO',      label: 'H.A. Muro' },
  { id: 'COTAS',        label: 'Cotas'     },
];

const COLORES_MATRIZ_ITO = {
  enviado_ito:       '#8b5cf6',
  con_observaciones: '#f97316',
  firmado:           '#5b21b6',
  enviado:           '#16a34a',
  enviado_edp:       '#16a34a',
  default:           '#1e293b',
};

function getColorITO(estado) {
  return COLORES_MATRIZ_ITO[estado] ?? COLORES_MATRIZ_ITO.default;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
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
                  &nbsp;—&nbsp;{nombreEntidad(p.tipo, p.entidad_id)}
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

// ─── MatrizITO ────────────────────────────────────────────────────────────────

function CeldaMatrizITO({ proto, cellStyle, cellBg }) {
  const navigate = useNavigate();
  const estado = proto?.estado;
  const clickable = estado === 'enviado_ito' || estado === 'firmado' || (estado === 'enviado_edp' && proto?.pdf_firmado_url);

  function handleClick() {
    if (estado === 'enviado_ito' && proto?.firma_token) {
      navigate(`/firma/${proto.firma_token}`);
    } else if (estado === 'firmado' && proto?.pdf_firmado_url) {
      window.open(proto.pdf_firmado_url, '_blank');
    } else if (estado === 'enviado_edp' && proto?.pdf_firmado_url) {
      window.open(proto.pdf_firmado_url, '_blank');
    }
  }

  return (
    <td
      onClick={clickable ? handleClick : undefined}
      style={{
        ...cellStyle,
        background: cellBg,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { if (clickable) e.currentTarget.style.opacity = '0.7'; }}
      onMouseLeave={e => { if (clickable) e.currentTarget.style.opacity = '1'; }}
    />
  );
}

function MatrizITO({ protocolos, verPorEDP }) {
  // Mapa clave → { estado, edp, firma_token, pdf_firmado_url }
  const protMap = {};
  protocolos.forEach(p => {
    protMap[`${p.tipo}-${String(p.entidad_id)}-${p.protocolo_id}`] = {
      estado:          p.estado,
      edp:             p.edp ?? null,
      firma_token:     p.firma_token ?? null,
      pdf_firmado_url: p.pdf_firmado_url ?? null,
    };
  });

  // Escala de colores por EDP (verde oscuro → verde claro)
  const edpList = [...new Set(
    protocolos
      .filter(p => (p.estado === 'enviado' || p.estado === 'enviado_edp') && p.edp)
      .map(p => p.edp)
  )].sort();

  const edpColors = {};
  edpList.forEach((edp, i) => {
    const t = edpList.length === 1 ? 1 : i / (edpList.length - 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    const r = lerp(0x14, 0x86), g = lerp(0x53, 0xef), b = lerp(0x2d, 0xac);
    edpColors[edp] = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  });

  function cellBg(key) {
    const d = protMap[key];
    if (!d) return COLORES_MATRIZ_ITO.default;
    if (verPorEDP && (d.estado === 'enviado' || d.estado === 'enviado_edp') && d.edp && edpColors[d.edp]) {
      return edpColors[d.edp];
    }
    return getColorITO(d.estado);
  }

  const thLabel = {
    padding: '6px 4px',
    textAlign: 'center',
    color: '#8892b0',
    whiteSpace: 'nowrap',
    fontSize: 11,
    fontWeight: 700,
    borderBottom: '1px solid #0f3460',
  };
  const tdLabel = {
    padding: '3px 8px',
    fontWeight: 700,
    fontSize: 12,
    color: '#ccd6f6',
    whiteSpace: 'nowrap',
    background: '#0a1428',
    position: 'sticky',
    left: 0,
    zIndex: 1,
    borderRight: '1px solid #0f3460',
  };
  const sectionTh = {
    padding: '5px 8px',
    background: '#0f3460',
    color: '#8892b0',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    textAlign: 'left',
  };
  const cellStyle = { width: 34, height: 26, border: '1px solid #0a1428' };

  const tablaStyle = { borderCollapse: 'collapse', fontSize: 12, width: '100%', tableLayout: 'fixed' };
  const wrapStyle  = { overflowX: 'auto', border: '1px solid #0f3460', borderRadius: 10 };
  const thSticky   = { ...tdLabel, position: 'sticky', left: 0, zIndex: 2, borderBottom: '1px solid #0f3460', width: 52 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Tramos ── */}
      <div>
        <div style={sectionTh}>TRAMOS</div>
        <div style={wrapStyle}>
          <table style={tablaStyle}>
            <thead>
              <tr>
                <th style={thSticky} />
                {COLUMNAS_TRAMOS.map(col => <th key={col.id} style={thLabel}>{col.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {TRAMOS.filter(id => !esEtapa2('tramo', id) && esVisible('tramo', id)).map(id => (
                <tr key={id}>
                  <td style={tdLabel}>{id}</td>
                  {COLUMNAS_TRAMOS.map(col => {
                    const k = `tramo-${id}-${col.id}`;
                    return <CeldaMatrizITO key={col.id} proto={protMap[k]} cellStyle={cellStyle} cellBg={cellBg(k)} />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Caídas ── */}
      <div>
        <div style={sectionTh}>CAÍDAS</div>
        <div style={wrapStyle}>
          <table style={tablaStyle}>
            <thead>
              <tr>
                <th style={thSticky} />
                {COLUMNAS_CAIDAS_ATRAVIESOS.map(col => <th key={col.id} style={thLabel}>{col.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {CAIDAS.filter(id => !esEtapa2('caida', String(id))).map(id => (
                <tr key={id}>
                  <td style={tdLabel}>{id}</td>
                  {COLUMNAS_CAIDAS_ATRAVIESOS.map(col => {
                    const k = `caida-${String(id)}-${col.id}`;
                    return <CeldaMatrizITO key={col.id} proto={protMap[k]} cellStyle={cellStyle} cellBg={cellBg(k)} />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Atraviesos ── */}
      <div>
        <div style={sectionTh}>ATRAVIESOS</div>
        <div style={wrapStyle}>
          <table style={tablaStyle}>
            <thead>
              <tr>
                <th style={thSticky} />
                {COLUMNAS_CAIDAS_ATRAVIESOS.map(col => <th key={col.id} style={thLabel}>{col.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {ATRAVIESOS.filter(id => !esEtapa2('atravieso', id)).map(id => (
                <tr key={id}>
                  <td style={tdLabel}>AT {id}</td>
                  {COLUMNAS_CAIDAS_ATRAVIESOS.map(col => {
                    const k = `atravieso-${String(id)}-${col.id}`;
                    return <CeldaMatrizITO key={col.id} proto={protMap[k]} cellStyle={cellStyle} cellBg={cellBg(k)} />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Separador Etapa 2 ── */}
      <div style={{
        background: '#0a1f3d', border: '1px solid #1e3a5f',
        color: '#64ffda', fontSize: 13, fontWeight: 800,
        textAlign: 'center', padding: '10px 0', letterSpacing: '3px',
        textTransform: 'uppercase', borderRadius: 8,
        marginTop: 4,
      }}>
        ETAPA 2
      </div>

      {/* ── Etapa 2: dos tablas lado a lado ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Tramos E2 */}
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div style={sectionTh}>TRAMOS</div>
          <div style={wrapStyle}>
            <table style={tablaStyle}>
              <thead>
                <tr>
                  <th style={thSticky} />
                  {COLUMNAS_TRAMOS.map(col => <th key={col.id} style={thLabel}>{col.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {ETAPA_2.filter(e => e.tipo === 'tramo').map(({ tipo, id }) => (
                  <tr key={id}>
                    <td style={tdLabel}>{id}</td>
                    {COLUMNAS_TRAMOS.map(col => {
                      const k = `${tipo}-${String(id)}-${col.id}`;
                      return <CeldaMatrizITO key={col.id} proto={protMap[k]} cellStyle={cellStyle} cellBg={cellBg(k)} />;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cámaras y Atravieso */}
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div style={sectionTh}>CÁMARAS Y ATRAVIESO</div>
          <div style={wrapStyle}>
            <table style={tablaStyle}>
              <thead>
                <tr>
                  <th style={thSticky} />
                  {COLUMNAS_CAIDAS_ATRAVIESOS.map(col => <th key={col.id} style={thLabel}>{col.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {ETAPA_2.filter(e => e.tipo !== 'tramo').map(({ tipo, id }) => (
                  <tr key={`${tipo}-${id}`}>
                    <td style={tdLabel} title={nombreEntidad(tipo, id)}>
                      {tipo === 'atravieso' ? `AT${id}` : String(id)}
                    </td>
                    {COLUMNAS_CAIDAS_ATRAVIESOS.map(col => {
                      const k = `${tipo}-${String(id)}-${col.id}`;
                      return <CeldaMatrizITO key={col.id} proto={protMap[k]} cellStyle={cellStyle} cellBg={cellBg(k)} />;
                    })}
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

// ─── PortalITO ────────────────────────────────────────────────────────────────

export default function PortalITO() {
  const navigate = useNavigate();
  const { usuario, signOut } = useAuth();

  const [pendientes,       setPendientes]       = useState([]);
  const [conObservaciones, setConObservaciones] = useState([]);
  const [firmados,         setFirmados]         = useState([]);
  const [todos,            setTodos]            = useState([]);
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
      setTodos(rows);
      setUltimaAct(new Date());
    } catch (err) {
      console.error('[PortalITO]', err?.message ?? err);
    } finally {
      setCargando(false);
    }
  }

  const segsDesde = Math.floor((ahora - ultimaAct) / 1000);

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
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: '1rem',
        marginBottom: '1rem',
      }}>
        <RecuadroProtocolos
          titulo="Por firmar"
          protocolos={pendientes}
          color={COLORES_ITO.por_firmar}
          renderAccion={p => p.firma_token && (
            <button style={s.btnFirmar} onClick={() => navigate(`/firma/${p.firma_token}`)}>
              Firmar
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
          <button
            style={{ ...s.btnToggle, ...(verPorEdp ? s.btnToggleOn : {}) }}
            onClick={() => setVerPorEdp(v => !v)}
          >
            Ver por EDP
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Por firmar',    color: '#8b5cf6' },
            { label: 'Observaciones', color: '#f97316' },
            { label: 'Firmado',       color: '#5b21b6' },
            { label: 'Enviado EDP',   color: '#16a34a' },
            { label: 'Sin iniciar',   color: '#1e293b', border: '1px solid #475569' },
          ].map(({ label, color, border }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: color, border, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#8892b0' }}>{label}</span>
            </div>
          ))}
        </div>

        <MatrizITO protocolos={todos} verPorEDP={verPorEdp} />
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = {
  page: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
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
  titulo:      { color: '#ccd6f6', fontSize: 22, fontWeight: 700, margin: 0 },
  bienvenida:  { color: '#8892b0', fontSize: 13, margin: '4px 0 0' },
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
    background: '#16213e',
    border: '1px solid',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 0,
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
};
