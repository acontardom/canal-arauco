import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { ATRAVIESOS, PROTOCOLOS } from '../constants/estructura';

const TOTAL = PROTOCOLOS.length;

function colorProgreso(completados) {
  if (completados === 0) return '#ef4444';
  if (completados === TOTAL) return '#10b981';
  return '#f59e0b';
}

export default function Atraviesos() {
  const navigate = useNavigate();

  const protocolos = useLiveQuery(
    () => db.protocolos.where('tipo').equals('atravieso').toArray(),
    []
  ) ?? [];

  const completadosPor = protocolos.reduce((acc, p) => {
    if (p.estado === 'completado') acc[p.entidadId] = (acc[p.entidadId] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Atraviesos</h1>
      <div style={s.grid}>
        {ATRAVIESOS.map(atraviesoId => {
          const completados = completadosPor[atraviesoId] ?? 0;
          const color = colorProgreso(completados);
          const pct = (completados / TOTAL) * 100;

          return (
            <div
              key={atraviesoId}
              style={{ ...s.card, borderColor: color + '55' }}
              onClick={() => navigate(`/atraviesos/${atraviesoId}`)}
            >
              <div style={s.cardTop}>
                <span style={s.tramoLetra}>Atravieso {atraviesoId}</span>
                <span style={{ ...s.badge, color, borderColor: color }}>
                  {completados}/{TOTAL}
                </span>
              </div>
              <div style={s.barraFondo}>
                <div style={{ ...s.barraRelleno, width: `${pct}%`, background: color }} />
              </div>
              <span style={{ color, fontSize: '11px', fontWeight: 600 }}>
                {completados === 0 ? 'Sin iniciar' : completados === TOTAL ? 'Completo' : 'En progreso'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  page: { maxWidth: '900px', margin: '0 auto' },
  titulo: { color: '#ccd6f6', fontSize: '24px', fontWeight: 700, marginBottom: '24px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px',
  },
  card: {
    background: '#16213e', borderRadius: '10px', padding: '16px',
    border: '1px solid', cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  tramoLetra: { color: '#ccd6f6', fontWeight: 700, fontSize: '15px' },
  badge: {
    fontSize: '13px', fontWeight: 700, border: '1.5px solid',
    borderRadius: '6px', padding: '1px 7px',
  },
  barraFondo: { height: '5px', background: '#0f3460', borderRadius: '3px' },
  barraRelleno: { height: '100%', borderRadius: '3px', transition: 'width 0.4s ease' },
};
