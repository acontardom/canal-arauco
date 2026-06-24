import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import logoUrl from '../assets/Logo_ExMaq.jpg';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [cargando, setCargando] = useState(false);
  const { signIn, usuario, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol === 'ito') navigate('/ito', { replace: true });
    else navigate('/', { replace: true });
  }, [usuario]);

  // Si ya hay sesión pero no usuario en tabla, redirigir a /
  useEffect(() => {
    if (session && usuario === null) return; // puede estar cargando
  }, [session, usuario]);

  async function handleLogin(e) {
    e?.preventDefault();
    if (!email || !password) { setError('Ingresa email y contraseña'); return; }
    setCargando(true);
    setError('');
    const err = await signIn(email, password);
    if (err) {
      setError('Email o contraseña incorrectos');
      setCargando(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <img src={logoUrl} alt="ExMaq" style={s.logo} />
        <h1 style={s.titulo}>Canal Arauco</h1>
        <p style={s.subtitulo}>Ingresa con tu cuenta</p>

        <form style={s.form} onSubmit={handleLogin}>
          <div style={s.campo}>
            <label style={s.label}>Email</label>
            <input
              type="email"
              style={s.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              autoComplete="email"
              autoFocus
            />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Contraseña</label>
            <input
              type="password"
              style={s.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button type="submit" style={s.btnLogin} disabled={cargando}>
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#1a1a2e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: '#16213e',
    border: '1px solid #0f3460',
    borderRadius: '16px',
    padding: '40px 32px',
    width: '100%',
    maxWidth: '360px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  logo: {
    width: '80px',
    height: 'auto',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  titulo: {
    color: '#64ffda',
    fontSize: '22px',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '0.5px',
  },
  subtitulo: {
    color: '#8892b0',
    fontSize: '13px',
    margin: '0 0 16px',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  campo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    color: '#8892b0',
    fontSize: '12px',
    fontWeight: 600,
  },
  input: {
    background: '#0f3460',
    border: '1px solid #1e3a5f',
    borderRadius: '8px',
    color: '#ccd6f6',
    fontSize: '14px',
    padding: '12px 14px',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  error: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '13px',
    fontWeight: 600,
    padding: '10px 14px',
    textAlign: 'center',
  },
  btnLogin: {
    background: '#64ffda',
    color: '#0a1f3a',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '4px',
  },
};
