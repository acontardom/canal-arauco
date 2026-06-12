import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Inicio', icono: '🏠', end: true },
  { to: '/gestion', label: 'Gestión', icono: '📊', end: false },
  { to: '/perfil', label: 'Perfil', icono: '👤', end: false },
];

export default function Sidebar() {
  return (
    <nav className="sidebar" style={s.nav}>
      {LINKS.map(({ to, label, icono, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          style={({ isActive }) => ({ ...s.link, ...(isActive ? s.linkActivo : {}) })}
        >
          <span style={s.icono}>{icono}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

const s = {
  nav: {
    flexDirection: 'column',
    gap: '4px',
    position: 'fixed',
    top: '56px',
    left: 0,
    width: '200px',
    height: 'calc(100vh - 56px)',
    background: '#16213e',
    borderRight: '1px solid #0f3460',
    padding: '16px 12px',
    boxSizing: 'border-box',
    zIndex: 90,
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '10px',
    color: '#8892b0',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600,
  },
  linkActivo: {
    background: '#0f3460',
    color: '#64ffda',
  },
  icono: { fontSize: '18px', lineHeight: 1 },
};
