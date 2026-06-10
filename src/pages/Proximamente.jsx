import { useNavigate } from 'react-router-dom';

export default function Proximamente() {
  const navigate = useNavigate();

  return (
    <div style={s.page}>
      <div style={s.card}>
        <span style={s.icono}>🚧</span>
        <h1 style={s.titulo}>Próximamente</h1>
        <p style={s.texto}>Esta función está en desarrollo.</p>
        <button style={s.btn} onClick={() => navigate('/')}>← Volver al inicio</button>
      </div>
    </div>
  );
}

const s = {
  page: { maxWidth: '480px', margin: '0 auto', display: 'flex', justifyContent: 'center', paddingTop: '60px' },
  card: {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '16px',
    padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '8px', width: '100%',
  },
  icono: { fontSize: '40px' },
  titulo: { color: '#ccd6f6', fontSize: '20px', fontWeight: 700, margin: '8px 0 0' },
  texto: { color: '#8892b0', fontSize: '14px', margin: '0 0 16px' },
  btn: {
    background: '#0f3460', color: '#64ffda', border: '1px solid #64ffda',
    borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
};
