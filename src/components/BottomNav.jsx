import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Inicio', icono: '🏠', end: true },
  { to: '/gestion', label: 'Gestión', icono: '📊', end: false },
  { to: '/perfil', label: 'Yo', icono: '👤', end: false },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" style={s.nav}>
      {TABS.map(({ to, label, icono, end }) => (
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
