import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import UsuarioSelector from './UsuarioSelector';
import SyncBadge from './SyncBadge';
import { useAuth } from '../hooks/useAuth';

const SECCIONES = [
  {
    titulo: 'Terreno',
    items: [
      { to: '/subir-fotos',    label: 'Subir Fotos',    icono: '📷' },
      { to: '/recibir-camion', label: 'Recibir Camión', icono: '🚛' },
    ],
  },
  {
    titulo: 'Protocolos',
    items: [
      { to: '/matriz',            label: 'Matriz',            icono: '📊' },
      { to: '/galeria',           label: 'Galería de Fotos',  icono: '📁' },
      { to: '/generar-protocolo', label: 'Generar Protocolo', icono: '📋' },
      { to: '/generar-edp',       label: 'Generar EDP',       icono: '📄' },
    ],
  },
  {
    titulo: 'Hormigón',
    items: [
      { to: '/camiones',           label: 'Historial Camiones', icono: '🚛' },
      { to: '/dashboard-camiones', label: 'Control HA',         icono: '🧪' },
      { to: '/ensayos',            label: 'Ensayos Lab.',       icono: '🔬', soloAdmin: true },
    ],
  },
  {
    titulo: 'Avance',
    items: [
      { to: '/vista-canal',        label: 'Vista Canal',        icono: '🗺️' },
      { to: '/recepcionar-avance', label: 'Recepcionar Avance', icono: '✅' },
    ],
  },
  {
    titulo: 'Herramientas',
    items: [
      { to: '/cubicaciones', label: 'Cubicaciones', icono: '🧮' },
    ],
  },
];

function seccionDeRuta(pathname) {
  for (const sec of SECCIONES) {
    if (sec.items.some(item => pathname === item.to || pathname.startsWith(item.to + '/'))) {
      return sec.titulo;
    }
  }
  return null;
}

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
  const { session, usuario, signOut, cambiarContrasena } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [seccionAbierta, setSeccionAbierta] = useState(() => new Set(SECCIONES.map(s => s.titulo)));
  const [cambioPass, setCambioPass]         = useState(false);
  const [nuevaClave, setNuevaClave]         = useState('');
  const [passMsg, setPassMsg]               = useState('');
  const [guardandoPass, setGuardandoPass]   = useState(false);

  useEffect(() => {
    const sec = seccionDeRuta(location.pathname);
    if (sec) setSeccionAbierta(prev => {
      if (prev.has(sec)) return prev;
      const next = new Set(prev);
      next.add(sec);
      return next;
    });
  }, [location.pathname]);

  function toggleSeccion(titulo) {
    setSeccionAbierta(prev => {
      const next = new Set(prev);
      if (next.has(titulo)) next.delete(titulo); else next.add(titulo);
      return next;
    });
  }

  async function handleCambiarPass() {
    if (!nuevaClave || nuevaClave.length < 6) { setPassMsg('Mínimo 6 caracteres'); return; }
    setGuardandoPass(true);
    const err = await cambiarContrasena(nuevaClave);
    setGuardandoPass(false);
    if (err) { setPassMsg('Error al cambiar contraseña'); }
    else { setPassMsg('Contraseña actualizada'); setNuevaClave(''); setTimeout(() => { setCambioPass(false); setPassMsg(''); }, 1500); }
  }

  return (
    <nav className="sidebar" style={s.nav}>
      <NavLink to="/" style={s.titulo}>Canal Arauco</NavLink>

      <div style={s.lista}>
        <Item to="/" label="Inicio" icono="🏠" end />

        {SECCIONES.map(seccion => {
          const abierta   = seccionAbierta.has(seccion.titulo);
          const itemsFilt = seccion.items.filter(item =>
            (!item.soloAdmin || usuario?.rol === 'admin') &&
            (!item.noAdmin   || usuario?.rol !== 'admin')
          );
          return (
            <div key={seccion.titulo} style={s.seccion}>
              <button style={s.seccionHeader} onClick={() => toggleSeccion(seccion.titulo)}>
                <span style={s.seccionTitulo}>{seccion.titulo}</span>
                <span style={s.seccionFlecha}>{abierta ? '▾' : '▸'}</span>
              </button>
              {abierta && itemsFilt.map(item => <Item key={item.to + item.label} {...item} />)}
            </div>
          );
        })}
      </div>

      <div style={s.footer}>
        <UsuarioSelector nombreStyle={s.usuarioNombre} />
        <SyncBadge />

        <div style={s.authSep} />

        {session ? (
          <div style={s.authSection}>
            <div style={s.authEmail}>{usuario?.nombre ?? session.user.email}</div>
            <button style={s.btnAuthSm} onClick={() => { setCambioPass(v => !v); setPassMsg(''); setNuevaClave(''); }}>
              {cambioPass ? 'Cancelar' : 'Cambiar contraseña'}
            </button>
            {cambioPass && (
              <div style={s.passForm}>
                <input
                  type="password"
                  placeholder="Nueva contraseña"
                  style={s.passInput}
                  value={nuevaClave}
                  onChange={e => setNuevaClave(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCambiarPass()}
                />
                {passMsg && <span style={passMsg.includes('Error') ? s.passError : s.passOk}>{passMsg}</span>}
                <button style={s.btnGuardarPass} onClick={handleCambiarPass} disabled={guardandoPass}>
                  {guardandoPass ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            )}
            <button style={s.btnCerrarSesion} onClick={signOut}>Cerrar sesión</button>
          </div>
        ) : (
          <button style={s.btnIniciarSesion} onClick={() => navigate('/login')}>
            Iniciar sesión
          </button>
        )}
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
    gap: '2px',
    flex: 1,
    overflowY: 'auto',
  },
  seccion: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    marginTop: '6px',
  },
  seccionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 14px',
  },
  seccionTitulo: {
    color: '#8892b0',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  seccionFlecha: {
    color: '#8892b0',
    fontSize: '10px',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '7px 14px',
    borderRadius: '8px',
    color: '#8892b0',
    textDecoration: 'none',
    fontSize: '12px',
    fontWeight: 600,
  },
  linkActivo: {
    background: '#0f3460',
    color: '#64ffda',
  },
  icono: { fontSize: '15px', lineHeight: 1 },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '12px',
    borderTop: '1px solid #0f3460',
  },
  usuarioNombre: {
    maxWidth: 'none',
    fontSize: '11px',
  },

  authSep: { height: '1px', background: '#0f3460', margin: '4px 0' },

  authSection: { display: 'flex', flexDirection: 'column', gap: '6px' },
  authEmail: { color: '#64ffda', fontSize: '11px', fontWeight: 700, padding: '0 2px', wordBreak: 'break-all' },

  btnAuthSm: {
    background: 'transparent', border: '1px solid #1e3a5f', borderRadius: '6px',
    color: '#8892b0', fontSize: '11px', fontWeight: 600, padding: '5px 10px',
    cursor: 'pointer', textAlign: 'left',
  },

  passForm: { display: 'flex', flexDirection: 'column', gap: '5px' },
  passInput: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '6px',
    color: '#ccd6f6', fontSize: '12px', padding: '7px 10px',
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  passOk:    { color: '#10b981', fontSize: '11px', fontWeight: 600 },
  passError: { color: '#f87171', fontSize: '11px', fontWeight: 600 },
  btnGuardarPass: {
    background: 'rgba(100,255,218,0.1)', border: '1px solid #64ffda',
    borderRadius: '6px', color: '#64ffda', fontSize: '11px', fontWeight: 700,
    padding: '6px', cursor: 'pointer',
  },

  btnCerrarSesion: {
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '6px', color: '#f87171', fontSize: '11px', fontWeight: 700,
    padding: '7px 10px', cursor: 'pointer',
  },

  btnIniciarSesion: {
    background: 'rgba(100,255,218,0.08)', border: '1px solid rgba(100,255,218,0.3)',
    borderRadius: '8px', color: '#64ffda', fontSize: '12px', fontWeight: 700,
    padding: '9px 14px', cursor: 'pointer', width: '100%',
  },
};
