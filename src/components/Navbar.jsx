import { NavLink } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const isDesktop = window.innerWidth >= 768;

export default function Navbar() {
  const { usuario, cerrarSesion } = useUser();

  return (
    <nav style={styles.nav}>
      <NavLink to="/" style={styles.titulo}>Canal Arauco</NavLink>

      {isDesktop && (
        <div style={styles.links}>
          <NavLink to="/dashboard" style={navStyle}>Dashboard</NavLink>
          <NavLink to="/tramos" style={navStyle}>Tramos</NavLink>
          <NavLink to="/caidas" style={navStyle}>Caídas</NavLink>
          <NavLink to="/atraviesos" style={navStyle}>Atraviesos</NavLink>
          <NavLink to="/configuracion" style={navStyle} title="Configuración KM">
            ⚙ Config
          </NavLink>
        </div>
      )}

      {usuario && (
        <div style={styles.usuario}>
          <span style={styles.nombreUsuario}>{usuario}</span>
          {isDesktop && (
            <button style={styles.btnCambiar} onClick={cerrarSesion} title="Cambiar usuario">
              ↩
            </button>
          )}
        </div>
      )}
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
  usuario: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    justifyContent: 'flex-end',
    minWidth: 0,
    overflow: 'hidden',
  },
  nombreUsuario: {
    color: '#8892b0',
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  btnCambiar: {
    background: 'transparent',
    border: '1px solid #0f3460',
    borderRadius: '6px',
    color: '#8892b0',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 8px',
    lineHeight: '1.6',
    flexShrink: 0,
  },
};
