import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const TABS_AUTH = [
  { to: '/', label: 'Inicio', icono: '🏠', end: true },
  { to: '/cubicaciones', label: 'Cubicar', icono: '🧮', end: false },
  { to: '/vista-canal', label: 'Canal', icono: '🗺️', end: false },
  { to: '/galeria', label: 'Galería', icono: '📁', end: false },
  { to: '/perfil', label: 'Yo', icono: '👤', end: false },
];

const TABS_PUBLIC = [
  { to: '/subir-fotos', label: 'Fotos', icono: '📷', end: false },
  { to: '/recibir-camion', label: 'Camión', icono: '🚛', end: false },
  { to: '/login', label: 'Login', icono: '🔒', end: false },
];

export default function BottomNav() {
  const { usuario } = useAuth();
  const tabs = usuario ? TABS_AUTH : TABS_PUBLIC;

  return (
    <nav className="bottom-nav" style={s.nav}>
      {tabs.map(({ to, label, icono, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          style={({ isActive }) => ({ ...s.tab, ...(isActive ? s.tabActivo : {}) })}
        >
          <span style={s.icono}>{icono}</span>
          <span style={s.label}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

const s = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '60px',
    background: '#16213e',
    borderTop: '1px solid #0f3460',
    zIndex: 100,
    alignItems: 'stretch',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    color: '#8892b0',
    textDecoration: 'none',
  },
  tabActivo: {
    color: '#64ffda',
  },
  icono: { fontSize: '20px', lineHeight: 1 },
  label: { fontSize: '11px', fontWeight: 600 },
};
