import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { TRAMOS, CAIDAS, ATRAVIESOS, PROTOCOLOS } from '../constants/estructura';

const COL_LABEL = {
  PICE1:        'EXCAVACIÓN',
  PICE2_RADIER: 'H. RADIER',
  PICE2_MURO:   'H. MURO',
  PICE3:        'MOLDAJES',
  PICE4_RADIER: 'E. RADIER',
  PICE4_MURO:   'E. MURO',
  G5:           'G5',
  HA_RADIER:    'HA RADIER',
  HA_MURO:      'HA MURO',
};

const COLOR_PENDIENTE  = '#2a2a3e';
const COLOR_COMPLETADO = '#3d7ebf';
const COLOR_ENVIADO    = '#27ae60';

function colorEstado(estado) {
  if (estado === 'enviado') return COLOR_ENVIADO;
  if (estado === 'borrador' || estado === 'completado') return COLOR_COMPLETADO;
  return COLOR_PENDIENTE;
}

const isMobile = window.innerWidth < 768;

function MatrizCell({ tipo, entidadId, protocolo, mapa, navigate, nombreEntidad }) {
  const estado = mapa[`${tipo}-${entidadId}-${protocolo.id}`];
  const bg = colorEstado(estado);
  return (
    <td
      style={{ ...s.celda, background: bg }}
      title={`${nombreEntidad} — ${protocolo.nombre}: ${estado ?? 'pendiente'}`}
      onClick={() => navigate(`/protocolo/${tipo}/${entidadId}/${protocolo.id}`)}
    />
  );
}

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: `${ROW_HEADER_W}px` }} />
      {PROTOCOLOS.map(p => <col key={p.id} />)}
    </colgroup>
  );
}

function EncabezadoColumnas() {
  return (
    <tr>
      <th style={s.cornerCell} />
      {PROTOCOLOS.map(p => (
        <th key={p.id} style={s.colHeader}>{COL_LABEL[p.id]}</th>
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
          <span style={{ ...s.swatch, background: COLOR_COMPLETADO }} /> Completado
        </span>
        <span style={s.leyendaItem}>
          <span style={{ ...s.swatch, background: COLOR_ENVIADO }} /> Enviado
        </span>
      </div>

      <div style={s.contenedor}>
        {/* ── Tabla TRAMOS ──────────────────────────────────────────────── */}
        <div style={s.tablaWrap}>
          <table style={s.tabla}>
            <ColGroup />
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
            <ColGroup />
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

const CELL = 32;
const ROW_HEADER_W = 44;
const HEADER_H = 130;

const s = {
  page: { maxWidth: '1120px', margin: '0 auto' },
  titulo: { color: '#ccd6f6', fontSize: '24px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' },

  leyenda: { display: 'flex', gap: '28px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' },
  leyendaItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#ccd6f6' },
  swatch: { width: '18px', height: '18px', borderRadius: '4px', display: 'inline-block', border: '1px solid #0f3460' },

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
    overflowX: 'auto',
    border: '1px solid #0f3460',
    borderRadius: '10px',
    marginBottom: isMobile ? '8px' : 0,
  },
  tabla: { borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: '360px' },

  tituloTabla: {
    background: '#0f3460', color: '#64ffda', fontSize: '17px', fontWeight: 800,
    textAlign: 'center', padding: '12px 0', letterSpacing: '2px', textTransform: 'uppercase',
  },
  separadorFila: {
    background: '#1e3a5f', color: '#64ffda', fontSize: '13px', fontWeight: 700,
    textAlign: 'center', padding: '8px 0', letterSpacing: '1.5px',
  },
  colHeader: {
    height: `${HEADER_H}px`, background: '#0f3460', color: '#8892b0',
    fontSize: '11px', fontWeight: 700, textAlign: 'center', verticalAlign: 'bottom',
    border: '1px solid #1a1a2e', padding: '8px 4px',
    writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap',
  },
  cornerCell: {
    width: `${ROW_HEADER_W}px`, background: '#0f3460', border: '1px solid #1a1a2e',
  },
  rowHeader: {
    width: `${ROW_HEADER_W}px`, height: `${CELL}px`, background: '#0f3460', color: '#ccd6f6',
    fontSize: '12px', fontWeight: 700, textAlign: 'center', border: '1px solid #1a1a2e', padding: '6px 4px',
  },
  celda: {
    height: `${CELL}px`, minWidth: `${CELL}px`, border: '1px solid #1a1a2e',
    padding: '8px', cursor: 'pointer', boxSizing: 'border-box',
  },
};
