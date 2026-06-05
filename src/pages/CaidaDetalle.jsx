import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { PROTOCOLOS_CAIDA } from '../constants/estructura';

const ESTADO = {
  completado: { icono: '●', color: '#10b981', label: 'Completado' },
  borrador:   { icono: '◐', color: '#f59e0b', label: 'Borrador' },
  pendiente:  { icono: '○', color: '#8892b0', label: 'Pendiente' },
};

export default function CaidaDetalle() {
  const { caidaId } = useParams();
  const navigate = useNavigate();

  const protocolos = useLiveQuery(
    () => db.protocolos.where('entidadId').equals(Number(caidaId)).toArray(),
    [caidaId]
  ) ?? [];

  const estadoPor = Object.fromEntries(protocolos.map(p => [p.protocoloId, p.estado]));
  const completados = PROTOCOLOS_CAIDA.filter(p => estadoPor[p.id] === 'completado').length;
  const color = completados === 0 ? '#ef4444' : completados === PROTOCOLOS_CAIDA.length ? '#10b981' : '#f59e0b';

  return (
    <div style={s.page}>
      <button style={s.btnVolver} onClick={() => navigate('/caidas')}>← Caídas</button>

      <div style={s.header}>
        <h1 style={s.titulo}>Caída {caidaId}</h1>
        <span style={{ ...s.badge, color, borderColor: color }}>
          {completados}/{PROTOCOLOS_CAIDA.length} completados
        </span>
      </div>

      <div style={s.barraFondo}>
        <div style={{
          ...s.barraRelleno,
          width: `${(completados / PROTOCOLOS_CAIDA.length) * 100}%`,
          background: color,
        }} />
      </div>

      <div style={s.lista}>
        {PROTOCOLOS_CAIDA.map(protocolo => {
          const estado = estadoPor[protocolo.id] ?? 'pendiente';
          const { icono, color: c, label } = ESTADO[estado];

          return (
            <div
              key={protocolo.id}
              style={s.fila}
              onClick={() => navigate(`/protocolo/caida/${caidaId}/${protocolo.id}`)}
            >
              <span style={{ color: c, fontSize: '18px', lineHeight: 1 }}>{icono}</span>
              <div style={s.filaInfo}>
                <span style={s.protNombre}>{protocolo.nombre}</span>
                <span style={{ color: c, fontSize: '12px', fontWeight: 600 }}>{label}</span>
              </div>
              <span style={s.chevron}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  page: { maxWidth: '640px', margin: '0 auto' },
  btnVolver: {
    background: 'transparent', border: 'none', color: '#8892b0',
    cursor: 'pointer', fontSize: '14px', padding: '0 0 20px',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  titulo: { color: '#ccd6f6', fontSize: '24px', fontWeight: 700, margin: 0 },
  badge: {
    fontSize: '14px', fontWeight: 700, border: '1.5px solid',
    borderRadius: '8px', padding: '3px 12px',
  },
  barraFondo: { height: '6px', background: '#0f3460', borderRadius: '3px', marginBottom: '28px' },
  barraRelleno: { height: '100%', borderRadius: '3px', transition: 'width 0.4s ease' },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  fila: {
    background: '#16213e', borderRadius: '10px', padding: '16px 18px',
    border: '1px solid #0f3460', display: 'flex', alignItems: 'center',
    gap: '14px', cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  filaInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' },
  protNombre: { color: '#ccd6f6', fontWeight: 600, fontSize: '14px' },
  chevron: { color: '#8892b0', fontSize: '20px' },
};
