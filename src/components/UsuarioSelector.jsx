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

      <span style={{ ...s.nombre, ...nombreStyle }}>{usuario}</span>

      <button style={s.btnCambiar} onClick={() => setAbierto(a => !a)}>
        🚪 Cambiar usuario
      </button>
    </div>
  );
}

const s = {
  wrap: { position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px' },
  nombre: {
    color: '#8892b0', fontSize: '12px', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
  },
  btnCambiar: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    width: '100%', background: '#0f3460', border: 'none', borderRadius: '8px',
    color: '#ccd6f6', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    padding: '8px 10px', boxSizing: 'border-box',
  },
  opciones: {
    position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '8px',
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px',
    padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px',
    zIndex: 200, maxHeight: '60vh', overflowY: 'auto',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  opcion: {
    background: 'transparent', border: 'none', color: '#ccd6f6',
    borderRadius: '8px', padding: '8px 10px', fontSize: '13px',
    fontWeight: 600, cursor: 'pointer', textAlign: 'left',
  },
  opcionActiva: { background: '#0f3460', color: '#64ffda' },
};
