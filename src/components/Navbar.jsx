import { NavLink } from 'react-router-dom';
import UsuarioSelector from './UsuarioSelector';

const isDesktop = window.innerWidth >= 768;

export default function Navbar() {
  return (
    <nav style={styles.nav}>
      <NavLink to="/" style={styles.titulo}>Canal Arauco</NavLink>

      {isDesktop && (
        <div style={styles.links}>
          <NavLink to="/matriz" style={navStyle}>Matriz</NavLink>
          <NavLink to="/dashboard" style={navStyle}>Dashboard</NavLink>
          <NavLink to="/generar-protocolo" style={navStyle}>Generar Protocolo</NavLink>
        </div>
      )}

      <UsuarioSelector />
    </nav>
  );
}

function navStyle({ isActive }) {
  return {
    color: isActive ? '#64ffda' : '#ccd6f6',
    textDecoration: 'none',
    fontWeight: isActive ? 700 : 400,
    fontSize: '14px',
    padding: '4px 8px',
    borderBottom: isActive ? '2px solid #64ffda' : '2px solid transparent',
    transition: 'all 0.2s',
  };
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  links: {
    display: 'flex',
    gap: '4px',
    flexShrink: 0,
  },
};
