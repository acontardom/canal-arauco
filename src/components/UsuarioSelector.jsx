import { useState, useRef, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { USUARIOS } from '../constants/estructura';

export default function UsuarioSelector({ nombreStyle }) {
  const { usuario, seleccionarUsuario } = useUser();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [abierto]);

  if (!usuario) return null;

  return (
    <div style={s.wrap} ref={ref}>
      <button style={s.actual} onClick={() => setAbierto(a => !a)} title="Cambiar usuario">
        <span style={{ ...s.nombre, ...nombreStyle }}>{usuario}</span>
        <span style={s.lapiz}>✏️</span>
      </button>

      {abierto && (
        <div style={s.opciones}>
          {USUARIOS.map(nombre => (
            <button
              key={nombre}
              style={{ ...s.opcion, ...(nombre === usuario ? s.opcionActiva : {}) }}
              onClick={() => { seleccionarUsuario(nombre); setAbierto(false); }}
            >
              {nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: { position: 'relative', flexShrink: 0 },
  actual: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px',
  },
  nombre: {
    color: '#8892b0', fontSize: '12px', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px',
  },
  lapiz: { fontSize: '12px', lineHeight: 1 },
  opciones: {
    position: 'absolute', top: '100%', right: 0, marginTop: '6px',
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px',
    padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px',
    zIndex: 200, minWidth: '180px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  opcion: {
    background: 'transparent', border: 'none', color: '#ccd6f6',
    borderRadius: '8px', padding: '10px 12px', fontSize: '13px',
    fontWeight: 600, cursor: 'pointer', textAlign: 'left',
  },
  opcionActiva: { background: '#0f3460', color: '#64ffda' },
};
