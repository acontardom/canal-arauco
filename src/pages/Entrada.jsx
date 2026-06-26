import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logoUrl from '../assets/Logo_ExMaq.jpg';

export default function Entrada() {
  const [nombre, setNombre] = useState('');
  const [nombreGuardado, setNombreGuardado] = useState('');
  const [editando, setEditando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const n = localStorage.getItem('nombreTerreno');
    if (n) setNombreGuardado(n);
    else setEditando(true);
  }, []);

  function guardarNombre() {
    if (!nombre.trim()) return;
    localStorage.setItem('nombreTerreno', nombre.trim());
    setNombreGuardado(nombre.trim());
    setEditando(false);
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <img src={logoUrl} style={s.logo} alt="EXMAQ" />
        <div style={s.appNombre}>Canal Arauco</div>
        <div style={s.appSub}>Construcción Canal Siberia</div>
      </div>

      <div style={s.contenido}>
        {editando ? (
          <div style={s.nombreBox}>
            <div style={s.nombreLabel}>¿Cómo te llamas?</div>
            <div style={s.nombreRow}>
              <input
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && guardarNombre()}
                style={s.input}
                autoFocus
              />
              <button
                onClick={guardarNombre}
                disabled={!nombre.trim()}
                style={s.btnListo}
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <div style={s.saludo}>
            <span style={s.saludoLabel}>Hola, </span>
            <span style={s.saludoNombre}>{nombreGuardado}</span>
            <button
              onClick={() => { setEditando(true); setNombre(''); }}
              style={s.btnCambiar}
            >
              Cambiar
            </button>
          </div>
        )}

        {!editando && (
          <div style={s.botones}>
            <button onClick={() => navigate('/subir-fotos')} style={s.btnAccion}>
              <div style={s.btnIcono}>📷</div>
              <div style={s.btnTextos}>
                <div style={s.btnTitulo}>Subir fotos</div>
                <div style={s.btnSub}>Registra el avance de obra</div>
              </div>
            </button>
            <button onClick={() => navigate('/recibir-camion')} style={s.btnAccion}>
              <div style={s.btnIcono}>🚛</div>
              <div style={s.btnTextos}>
                <div style={s.btnTitulo}>Recibir camión</div>
                <div style={s.btnSub}>Control de hormigón en terreno</div>
              </div>
            </button>
          </div>
        )}
      </div>

      <div style={s.footer}>
        <button onClick={() => navigate('/login')} style={s.btnLogin}>
          🔒 Iniciar sesión
        </button>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#1a1a2e',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '2rem 1.5rem',
  },

  header: {
    textAlign: 'center',
    marginTop: '2rem',
  },
  logo: {
    width: 72, height: 72, borderRadius: 12, marginBottom: 16, objectFit: 'contain',
  },
  appNombre: { fontSize: 22, fontWeight: 700, color: '#ccd6f6' },
  appSub:    { fontSize: 13, color: '#8892b0', marginTop: 4 },

  contenido: { width: '100%', maxWidth: 380 },

  nombreBox: { marginBottom: '1.5rem' },
  nombreLabel: { fontSize: 13, color: '#8892b0', marginBottom: 8, textAlign: 'center' },
  nombreRow: { display: 'flex', gap: 8 },
  input: {
    flex: 1,
    background: '#16213e',
    border: '1px solid #1e3a5f',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#ccd6f6',
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
  },
  btnListo: {
    background: '#64ffda',
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    color: '#0a1f3a',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
  },

  saludo: { textAlign: 'center', marginBottom: '1.5rem' },
  saludoLabel:  { fontSize: 14, color: '#8892b0' },
  saludoNombre: { fontSize: 14, color: '#ccd6f6', fontWeight: 700 },
  btnCambiar: {
    background: 'none', border: 'none', color: '#8892b0',
    fontSize: 13, marginLeft: 8, cursor: 'pointer', textDecoration: 'underline',
    fontFamily: 'inherit',
  },

  botones: { display: 'flex', flexDirection: 'column', gap: 12 },
  btnAccion: {
    width: '100%',
    background: 'linear-gradient(135deg, #0f3460, #16213e)',
    border: '1px solid #1e3a5f',
    borderRadius: 12,
    padding: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    cursor: 'pointer',
    color: '#ccd6f6',
    fontFamily: 'inherit',
    textAlign: 'left',
    boxShadow: '0 4px 14px rgba(100,255,218,0.06)',
  },
  btnIcono: {
    width: 48, height: 48,
    background: '#0f3460',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 24,
  },
  btnTextos:  { textAlign: 'left' },
  btnTitulo:  { fontSize: 16, fontWeight: 700, color: '#64ffda' },
  btnSub:     { fontSize: 13, color: '#8892b0', marginTop: 2 },

  footer: { textAlign: 'center', paddingBottom: '1rem' },
  btnLogin: {
    background: 'none',
    border: 'none',
    color: '#8892b0',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: '0 auto',
    fontFamily: 'inherit',
  },
};
