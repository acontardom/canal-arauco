import { NavLink } from 'react-router-dom';
import UsuarioSelector from './UsuarioSelector';
import { useSyncStatus } from '../hooks/useSyncStatus';

function SyncBadge() {
  const { pendientes, sincronizando, todoSincronizado } = useSyncStatus();

  if (sincronizando) {
    return <span style={{ ...styles.syncBadge, color: '#8892b0' }}>⏳ Sincronizando...</span>;
  }
  if (todoSincronizado) {
    return <span style={{ ...styles.syncBadge, color: '#10b981' }}>☁️ Sincronizado</span>;
  }
  return <span style={{ ...styles.syncBadge, color: '#f59e0b' }}>🔄 {pendientes} pendientes</span>;
}

export default function Navbar() {
  return (
    <nav className="navbar" style={styles.nav}>
      <NavLink to="/" style={styles.titulo}>Canal Arauco</NavLink>

      <div className="navbar-derecha" style={styles.derecha}>
        <SyncBadge />
        <UsuarioSelector />
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    background: '#16213e',
    padding: '0 12px',
    height: '56px',
    borderBottom: '1px solid #0f3460',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    width: '100%',
    gap: '8px',
  },
  titulo: {
    color: '#64ffda',
    fontWeight: 700,
    fontSize: '15px',
    letterSpacing: '0.5px',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
  },
  derecha: {
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  syncBadge: {
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};
