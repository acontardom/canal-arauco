import { NavLink } from 'react-router-dom';
import UsuarioSelector from './UsuarioSelector';

export default function Navbar() {
  return (
    <nav style={styles.nav}>
      <NavLink to="/" style={styles.titulo}>Canal Arauco</NavLink>

      <UsuarioSelector />
    </nav>
  );
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
};
