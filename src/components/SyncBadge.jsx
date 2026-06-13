import { useSyncStatus } from '../hooks/useSyncStatus';

export default function SyncBadge() {
  const { pendientes, sincronizando, todoSincronizado } = useSyncStatus();

  if (sincronizando) {
    return <span style={{ ...s.badge, color: '#8892b0' }}>⏳ Sincronizando...</span>;
  }
  if (todoSincronizado) {
    return <span style={{ ...s.badge, color: '#10b981' }}>☁️ Sincronizado</span>;
  }
  return <span style={{ ...s.badge, color: '#f59e0b' }}>🔄 {pendientes} pendientes</span>;
}

const s = {
  badge: {
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};
