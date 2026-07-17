import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div style={s.banner}>
      <span style={s.texto}>Nueva versión disponible</span>
      <div style={s.botones}>
        <button
          style={s.btnActualizar}
          onClick={() => { updateServiceWorker(true); window.location.reload(); }}
        >
          Actualizar
        </button>
        <button style={s.btnCerrar} onClick={() => setNeedRefresh(false)}>×</button>
      </div>
    </div>
  );
}

const s = {
  banner: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    width: '100%',
    zIndex: 9999,
    background: '#0f3460',
    borderTop: '2px solid #64ffda',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    boxSizing: 'border-box',
    gap: '12px',
  },
  texto: {
    color: '#ccd6f6',
    fontSize: '14px',
    fontWeight: 600,
  },
  botones: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  btnActualizar: {
    background: '#64ffda',
    color: '#0a1f3a',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnCerrar: {
    background: 'transparent',
    border: '1px solid #1e3a5f',
    color: '#8892b0',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '16px',
    lineHeight: 1,
    cursor: 'pointer',
  },
};
