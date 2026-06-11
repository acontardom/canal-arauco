import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { USUARIOS } from '../constants/estructura';

export default function Inicio() {
  const { usuario, seleccionarUsuario } = useUser();
  const navigate = useNavigate();

  return (
    <div style={s.page}>
      {usuario ? (
        <div style={s.saludo}>
          <h1 style={s.saludoTexto}>Hola, {usuario.split(' ')[0]} 👋</h1>
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
            <button style={s.btnTerreno} onClick={() => navigate('/subir-fotos')}>
              📷 Subir Fotos
            </button>
            <button style={s.btnTerreno} onClick={() => navigate('/recibir-camion')}>
              🚛 Recibir Camión
            </button>
          </section>

          <div style={s.separador}>
            <span style={s.separadorLinea} />
            <span style={s.separadorTexto}>Gestión</span>
            <span style={s.separadorLinea} />
          </div>

          <section style={s.bloqueGestion}>
            <button style={s.btnGestion} onClick={() => navigate('/generar-protocolo')}>
              📋 Generar Protocolo
            </button>
            <button style={s.btnGestion} onClick={() => navigate('/control')}>
              📊 Centro de Control
            </button>
          </section>
        </>
      )}
    </div>
  );
}

const s = {
  page: { maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },

  saludo: { display: 'flex', alignItems: 'center' },
  saludoTexto: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },

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
};
