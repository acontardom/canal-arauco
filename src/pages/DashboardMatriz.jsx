import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { TRAMOS, CAIDAS, ATRAVIESOS, PROTOCOLOS } from '../constants/estructura';

const COL_ABREV = {
  PICE1:        'EXC',
  PICE2_RADIER: 'H-R',
  PICE2_MURO:   'H-M',
  PICE3:        'MOL',
  PICE4_RADIER: 'E-R',
  PICE4_MURO:   'E-M',
  G5:           'G5',
  HA_RADIER:    'HA-R',
  HA_MURO:      'HA-M',
};

const COLOR_PENDIENTE = '#e0e0e0';
const COLOR_AMARILLO  = '#FFD700';
const COLOR_VERDE     = '#27ae60';

function celdaEstado(estado) {
  if (estado === 'enviado') return { bg: COLOR_VERDE, color: '#fff', marca: '✓' };
  if (estado === 'borrador' || estado === 'completado') return { bg: COLOR_AMARILLO, color: '#1a1a2e', marca: '✓' };
  return { bg: COLOR_PENDIENTE, color: '#1a1a2e', marca: '' };
}

const isMobile = window.innerWidth < 768;

function MatrizCell({ tipo, entidadId, protocolo, mapa, navigate, nombreEntidad }) {
  const estado = mapa[`${tipo}-${entidadId}-${protocolo.id}`];
  const { bg, color, marca } = celdaEstado(estado);
  return (
    <td
      style={{ ...s.celda, background: bg, color }}
      title={`${nombreEntidad} — ${protocolo.nombre}: ${estado ?? 'pendiente'}`}
      onClick={() => navigate(`/protocolo/${tipo}/${entidadId}/${protocolo.id}`)}
    >
      {marca}
    </td>
  );
}

function EncabezadoColumnas() {
  return (
    <tr>
      <th style={s.cornerCell} />
      {PROTOCOLOS.map(p => (
        <th key={p.id} style={s.colHeader}>{COL_ABREV[p.id]}</th>
      ))}
    </tr>
  );
}

export default function DashboardMatriz() {
  const navigate = useNavigate();

  const protocolos = useLiveQuery(() => db.protocolos.toArray(), []) ?? [];

  const mapa = {};
  protocolos.forEach(p => {
    mapa[`${p.tipo}-${p.entidadId}-${p.protocoloId}`] = p.estado;
  });

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Matriz de Protocolos</h1>

      <div style={s.leyenda}>
        <span style={s.leyendaItem}>
          <span style={{ ...s.swatch, background: COLOR_PENDIENTE }} /> Pendiente
        </span>
        <span style={s.leyendaItem}>
          <span style={{ ...s.swatch, background: COLOR_AMARILLO }} /> Borrador / Completado
        </span>
        <span style={s.leyendaItem}>
          <span style={{ ...s.swatch, background: COLOR_VERDE }} /> Enviado
        </span>
      </div>

      <div style={{ ...s.contenedor, flexDirection: isMobile ? 'column' : 'row' }}>
        {/* ── Tabla TRAMOS ──────────────────────────────────────────────── */}
        <div style={s.tablaWrap}>
          <table style={s.tabla}>
            <thead>
              <tr>
                <th colSpan={PROTOCOLOS.length + 1} style={s.tituloTabla}>TRAMOS</th>
              </tr>
              <EncabezadoColumnas />
            </thead>
            <tbody>
              {TRAMOS.map(tramoId => (
                <tr key={tramoId}>
                  <th style={s.rowHeader}>{tramoId}</th>
                  {PROTOCOLOS.map(p => (
                    <MatrizCell
                      key={p.id}
                      tipo="tramo"
                      entidadId={tramoId}
                      protocolo={p}
                      mapa={mapa}
                      navigate={navigate}
                      nombreEntidad={`Tramo ${tramoId}`}
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
            <thead>
              <tr>
                <th colSpan={PROTOCOLOS.length + 1} style={s.tituloTabla}>CAÍDAS</th>
              </tr>
              <EncabezadoColumnas />
            </thead>
            <tbody>
              {CAIDAS.map(caidaId => (
                <tr key={caidaId}>
                  <th style={s.rowHeader}>{caidaId}</th>
                  {PROTOCOLOS.map(p => (
                    <MatrizCell
                      key={p.id}
                      tipo="caida"
                      entidadId={caidaId}
                      protocolo={p}
                      mapa={mapa}
                      navigate={navigate}
                      nombreEntidad={`Caída ${caidaId}`}
                    />
                  ))}
                </tr>
              ))}

              <tr>
                <th colSpan={PROTOCOLOS.length + 1} style={s.separadorFila}>ATRAVIESOS</th>
              </tr>

              {ATRAVIESOS.map(atId => (
                <tr key={atId}>
                  <th style={s.rowHeader}>{`AT${atId}`}</th>
                  {PROTOCOLOS.map(p => (
                    <MatrizCell
                      key={p.id}
                      tipo="atravieso"
                      entidadId={atId}
                      protocolo={p}
                      mapa={mapa}
                      navigate={navigate}
                      nombreEntidad={`Atravieso ${atId}`}
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

const CELL = 20;
const HEAD_CELL = 22;
const ROW_HEADER_W = 30;

const s = {
  page: { maxWidth: '900px', margin: '0 auto' },
  titulo: { color: '#ccd6f6', fontSize: '24px', fontWeight: 700, marginBottom: '12px' },

  leyenda: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
  leyendaItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#ccd6f6' },
  swatch: { width: '14px', height: '14px', borderRadius: '3px', display: 'inline-block', border: '1px solid #0f3460' },

  contenedor: { display: 'flex', gap: '20px', alignItems: 'flex-start' },
  tablaWrap: { overflowX: 'auto', border: '1px solid #0f3460', borderRadius: '8px' },
  tabla: { borderCollapse: 'collapse', tableLayout: 'fixed' },

  tituloTabla: {
    background: '#0f3460', color: '#64ffda', fontSize: '13px', fontWeight: 700,
    textAlign: 'center', padding: '6px 0', letterSpacing: '0.6px',
  },
  separadorFila: {
    background: '#1e3a5f', color: '#64ffda', fontSize: '11px', fontWeight: 700,
    textAlign: 'center', padding: '4px 0', letterSpacing: '0.6px',
  },
  colHeader: {
    width: `${CELL}px`, height: `${HEAD_CELL}px`, background: '#0f3460', color: '#8892b0',
    fontSize: '9px', fontWeight: 700, textAlign: 'center', border: '1px solid #1a1a2e', padding: 0,
  },
  cornerCell: {
    width: `${ROW_HEADER_W}px`, background: '#0f3460', border: '1px solid #1a1a2e',
  },
  rowHeader: {
    width: `${ROW_HEADER_W}px`, height: `${CELL}px`, background: '#0f3460', color: '#ccd6f6',
    fontSize: '10px', fontWeight: 700, textAlign: 'center', border: '1px solid #1a1a2e', padding: 0,
  },
  celda: {
    width: `${CELL}px`, height: `${CELL}px`, textAlign: 'center', fontSize: '11px', fontWeight: 700,
    border: '1px solid #1a1a2e', padding: 0, cursor: 'pointer',
  },
};
