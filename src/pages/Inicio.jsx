import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { USUARIOS } from '../constants/estructura';

export default function Inicio() {
  const { usuario, seleccionarUsuario, cerrarSesion } = useUser();
  const navigate = useNavigate();
  const [mostrarTipos, setMostrarTipos] = useState(false);

  return (
    <div style={s.page}>
      {usuario ? (
        <div style={s.saludo}>
          <h1 style={s.saludoTexto}>Hola, {usuario.split(' ')[0]} 👋</h1>
          <button style={s.btnCambiar} onClick={cerrarSesion}>Cambiar</button>
        </div>
      ) : (
        <div style={s.selector}>
          <h1 style={s.titulo}>¿Quién eres?</h1>
          <p style={s.subtitulo}>Selecciona tu nombre para continuar</p>
          <div style={s.usuarios}>
            {USUARIOS.map(nombre => (
              <button key={nombre} style={s.btnUsuario} onClick={() => seleccionarUsuario(nombre)}>
                {nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {usuario && (
        <>
          <section style={s.bloqueTerreno}>
            <h2 style={s.bloqueTitulo}>Terreno</h2>
            <button style={s.btnTerreno} onClick={() => navigate('/proximamente')}>
              📷 Subir Fotos
            </button>
            <button style={s.btnTerreno} onClick={() => navigate('/proximamente')}>
              🚛 Recibir Camión
            </button>
          </section>

          <div style={s.separador}>
            <span style={s.separadorLinea} />
            <span style={s.separadorTexto}>Gestión</span>
            <span style={s.separadorLinea} />
          </div>

          <section style={s.bloqueGestion}>
            <button style={s.btnGestion} onClick={() => setMostrarTipos(v => !v)}>
              📋 Generar Protocolo
            </button>
            {mostrarTipos && (
              <div style={s.tipos}>
                <button style={s.btnTipo} onClick={() => navigate('/tramos')}>Tramos</button>
                <button style={s.btnTipo} onClick={() => navigate('/caidas')}>Caídas</button>
                <button style={s.btnTipo} onClick={() => navigate('/atraviesos')}>Atraviesos</button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const s = {
  page: { maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },

  saludo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  saludoTexto: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },
  btnCambiar: {
    background: 'transparent', border: '1px solid #0f3460', color: '#8892b0',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },

  selector: { background: '#16213e', borderRadius: '14px', padding: '24px', border: '1px solid #0f3460' },
  titulo: { color: '#ccd6f6', fontSize: '20px', fontWeight: 700, margin: '0 0 4px' },
  subtitulo: { color: '#8892b0', fontSize: '13px', margin: '0 0 16px' },
  usuarios: { display: 'flex', flexDirection: 'column', gap: '10px' },
  btnUsuario: {
    background: '#0f3460', color: '#ccd6f6', border: '1px solid #1e3a5f',
    borderRadius: '10px', padding: '14px 16px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
  },

  bloqueTerreno: {
    background: 'linear-gradient(135deg, #0f3460, #16213e)',
    border: '1px solid #1e3a5f', borderRadius: '16px', padding: '18px',
    display: 'flex', flexDirection: 'column', gap: '12px',
  },
  bloqueTitulo: { color: '#64ffda', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0 },
  btnTerreno: {
    background: '#64ffda', color: '#0a1f3a', border: 'none', borderRadius: '12px',
    padding: '20px 18px', fontSize: '17px', fontWeight: 700, cursor: 'pointer',
    textAlign: 'left', boxShadow: '0 4px 14px rgba(100,255,218,0.18)',
  },

  separador: { display: 'flex', alignItems: 'center', gap: '12px' },
  separadorLinea: { flex: 1, height: '1px', background: '#0f3460' },
  separadorTexto: { color: '#8892b0', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' },

  bloqueGestion: { display: 'flex', flexDirection: 'column', gap: '10px' },
  btnGestion: {
    background: '#16213e', color: '#ccd6f6', border: '1px solid #0f3460',
    borderRadius: '12px', padding: '16px 18px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
    textAlign: 'left',
  },
  tipos: { display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' },
  btnTipo: {
    background: 'transparent', color: '#8892b0', border: '1px solid #0f3460',
    borderRadius: '10px', padding: '12px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
    textAlign: 'left',
  },
};
