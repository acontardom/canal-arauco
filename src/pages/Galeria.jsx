export default function Galeria() {
  return (
    <div style={s.page}>
      <div style={s.card}>
        <span style={s.icono}>📁</span>
        <h1 style={s.titulo}>Galería de Fotos</h1>
        <p style={s.texto}>Próximamente — visualiza todas las fotos del proyecto por entidad.</p>
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
  texto: { color: '#8892b0', fontSize: '14px', margin: 0 },
};
