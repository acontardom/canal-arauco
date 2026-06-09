import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { TRAMOS, CAIDAS, PROTOCOLOS } from '../constants/estructura';

const NOMBRE_PROTOCOLO = Object.fromEntries(
  PROTOCOLOS.map(p => [p.id, p.nombre])
);

function formatFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

const ESTADO_COLOR = { completado: '#10b981', borrador: '#f59e0b', pendiente: '#8892b0' };

export default function Dashboard() {
  const navigate = useNavigate();

  const protocolos = useLiveQuery(() => db.protocolos.toArray(), []) ?? [];
  const recientes = useLiveQuery(
    () => db.protocolos.orderBy('fechaModificacion').reverse().limit(5).toArray(),
    []
  ) ?? [];

  function calcMetricas(tipo, entidades) {
    const conteo = {};
    protocolos.forEach(p => {
      if (p.tipo === tipo && p.estado === 'completado') {
        conteo[p.entidadId] = (conteo[p.entidadId] ?? 0) + 1;
      }
    });
    let completos = 0, enProgreso = 0;
    entidades.forEach(id => {
      const n = conteo[id] ?? 0;
      if (n === PROTOCOLOS.length) completos++;
      else if (n > 0) enProgreso++;
    });
    return { completos, enProgreso };
  }

  const tramos  = calcMetricas('tramo', TRAMOS);
  const caidas  = calcMetricas('caida', CAIDAS);

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Proyecto Canal Arauco</h1>

      <div style={s.cards}>
        <TarjetaResumen
          titulo="Tramos"
          completos={tramos.completos}
          enProgreso={tramos.enProgreso}
          total={TRAMOS.length}
          onClick={() => navigate('/tramos')}
          btnLabel="Ver Tramos"
        />
        <TarjetaResumen
          titulo="Caídas"
          completos={caidas.completos}
          enProgreso={caidas.enProgreso}
          total={CAIDAS.length}
          onClick={() => navigate('/caidas')}
          btnLabel="Ver Caídas"
        />
      </div>

      <h2 style={s.seccionTitulo}>Actividad Reciente</h2>
      <div style={s.actividad}>
        {recientes.length === 0 ? (
          <p style={s.vacio}>Sin actividad aún. Los protocolos guardados aparecerán aquí.</p>
        ) : (
          recientes.map(p => (
            <div key={p.id} style={s.actividadItem}>
              <div style={s.actividadLeft}>
                <span style={s.entidad}>
                  {p.tipo === 'tramo' ? 'Tramo' : 'Caída'} {p.entidadId}
                </span>
                <span style={s.protNombre}>
                  {NOMBRE_PROTOCOLO[p.protocoloId] ?? p.protocoloId}
                </span>
              </div>
              <div style={s.actividadRight}>
                <span style={{ ...s.estadoBadge, background: ESTADO_COLOR[p.estado] + '22', color: ESTADO_COLOR[p.estado] }}>
                  {p.estado}
                </span>
                <span style={s.usuario}>{p.usuarioNombre}</span>
                <span style={s.fecha}>{formatFecha(p.fechaModificacion)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TarjetaResumen({ titulo, completos, enProgreso, total, onClick, btnLabel }) {
  const pct = total === 0 ? 0 : completos / total;

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardTitulo}>{titulo}</span>
        <span style={{ ...s.cardBadge, color: '#10b981', borderColor: '#10b981' }}>
          {completos}/{total}
        </span>
      </div>
      <div style={s.barraFondo}>
        <div style={{ ...s.barraRelleno, width: `${pct * 100}%`, background: '#10b981' }} />
      </div>
      <div style={s.cardMetricas}>
        <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600 }}>
          {completos} completos
        </span>
        <span style={{ color: enProgreso > 0 ? '#f59e0b' : '#8892b0', fontSize: '12px', fontWeight: 600 }}>
          {enProgreso} en progreso
        </span>
        <span style={{ color: '#8892b0', fontSize: '12px' }}>
          {total - completos - enProgreso} sin iniciar
        </span>
      </div>
      <button style={s.btn} onClick={onClick}>{btnLabel} →</button>
    </div>
  );
}

const s = {
  page: { maxWidth: '800px', margin: '0 auto' },
  titulo: { color: '#ccd6f6', fontSize: '24px', fontWeight: 700, marginBottom: '24px' },
  cards: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' },
  card: {
    background: '#16213e', borderRadius: '12px', padding: '24px',
    border: '1px solid #0f3460',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  cardTitulo: { color: '#ccd6f6', fontSize: '18px', fontWeight: 700 },
  cardBadge: {
    fontSize: '22px', fontWeight: 700, border: '2px solid',
    borderRadius: '8px', padding: '2px 10px',
  },
  barraFondo: { height: '6px', background: '#0f3460', borderRadius: '3px', marginBottom: '10px' },
  barraRelleno: { height: '100%', borderRadius: '3px', transition: 'width 0.4s ease' },
  cardMetricas: { display: 'flex', gap: '14px', flexWrap: 'wrap', margin: '0 0 16px' },
  btn: {
    background: '#0f3460', color: '#64ffda', border: '1px solid #64ffda',
    borderRadius: '8px', padding: '8px 16px', fontSize: '13px',
    cursor: 'pointer', fontWeight: 600,
  },
  seccionTitulo: { color: '#ccd6f6', fontSize: '18px', fontWeight: 700, marginBottom: '16px' },
  actividad: { display: 'flex', flexDirection: 'column', gap: '8px' },
  vacio: { color: '#8892b0', fontSize: '14px', fontStyle: 'italic' },
  actividadItem: {
    background: '#16213e', borderRadius: '10px', padding: '14px 18px',
    border: '1px solid #0f3460', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
  },
  actividadLeft: { display: 'flex', flexDirection: 'column', gap: '4px' },
  entidad: { color: '#ccd6f6', fontWeight: 600, fontSize: '14px' },
  protNombre: { color: '#8892b0', fontSize: '12px' },
  actividadRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  estadoBadge: {
    fontSize: '11px', fontWeight: 600, borderRadius: '6px',
    padding: '2px 8px', textTransform: 'capitalize',
  },
  usuario: { color: '#8892b0', fontSize: '12px' },
  fecha: { color: '#8892b0', fontSize: '12px' },
};
