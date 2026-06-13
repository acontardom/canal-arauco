import { NavLink } from 'react-router-dom';
import UsuarioSelector from './UsuarioSelector';
import SyncBadge from './SyncBadge';

const SECCIONES = [
  {
    titulo: 'Terreno',
    items: [
      { to: '/subir-fotos', label: 'Subir Fotos', icono: '📷' },
      { to: '/recibir-camion', label: 'Recibir Camión', icono: '🚛' },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { to: '/matriz', label: 'Matriz', icono: '📊' },
      { to: '/dashboard', label: 'Dashboard', icono: '📈' },
      { to: '/galeria', label: 'Galería de Fotos', icono: '📁' },
      { to: '/camiones', label: 'Historial Camiones', icono: '🚛' },
    ],
  },
  {
    titulo: 'Acciones',
    items: [
      { to: '/generar-protocolo', label: 'Generar Protocolo', icono: '📋' },
    ],
  },
];

function Item({ to, label, icono, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({ ...s.link, ...(isActive ? s.linkActivo : {}) })}
    >
      <span style={s.icono}>{icono}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <nav className="sidebar" style={s.nav}>
      <NavLink to="/" style={s.titulo}>Canal Arauco</NavLink>

      <div style={s.lista}>
        <Item to="/" label="Inicio" icono="🏠" end />

        {SECCIONES.map(seccion => (
          <div key={seccion.titulo} style={s.seccion}>
            <p style={s.seccionTitulo}>{seccion.titulo}</p>
            {seccion.items.map(item => <Item key={item.to} {...item} />)}
          </div>
        ))}
      </div>

      <div style={s.footer}>
        <UsuarioSelector nombreStyle={s.usuarioNombre} />
        <SyncBadge />
      </div>
    </nav>
  );
}

const s = {
  nav: {
    flexDirection: 'column',
    gap: '4px',
    position: 'fixed',
    top: 0,
    left: 0,
    width: '220px',
    height: '100vh',
    background: '#16213e',
    borderRight: '1px solid #0f3460',
    padding: '16px 12px',
    boxSizing: 'border-box',
    zIndex: 90,
  },
  titulo: {
    color: '#64ffda',
    fontWeight: 700,
    fontSize: '16px',
    letterSpacing: '0.5px',
    textDecoration: 'none',
    padding: '8px 14px 16px',
  },
  lista: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    overflowY: 'auto',
  },
  seccion: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '12px',
  },
  seccionTitulo: {
    color: '#8892b0',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    margin: '0 0 4px',
    padding: '0 14px',
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
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '12px',
    borderTop: '1px solid #0f3460',
  },
  usuarioNombre: {
    maxWidth: 'none',
  },
};
