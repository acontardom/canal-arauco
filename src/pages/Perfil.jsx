import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { USUARIOS } from '../constants/estructura';

export default function Perfil() {
  const { usuario, seleccionarUsuario } = useUser();
  const navigate = useNavigate();
  const { pendientes, sincronizando, todoSincronizado } = useSyncStatus();

  return (
    <div style={s.page}>
      <h1 style={s.nombre}>{usuario}</h1>

      <div style={s.lista}>
        {USUARIOS.map(nombre => (
          <button
            key={nombre}
            style={{ ...s.btnUsuario, ...(nombre === usuario ? s.btnUsuarioActivo : {}) }}
            onClick={() => seleccionarUsuario(nombre)}
          >
            {nombre}
          </button>
        ))}
      </div>

      <div style={{ ...s.syncBadge, color: sincronizando ? '#8892b0' : todoSincronizado ? '#10b981' : '#f59e0b' }}>
        {sincronizando ? '⏳ Sincronizando...' : todoSincronizado ? '☁️ Todo sincronizado' : `🔄 ${pendientes} pendientes`}
      </div>

      <button style={s.linkConfig} onClick={() => navigate('/configuracion')}>⚙️ Configuración</button>
    </div>
  );
}

const s = {
  page: {
    maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '24px', paddingTop: '20px',
  },

  nombre: { color: '#ccd6f6', fontSize: '24px', fontWeight: 700, margin: 0, textAlign: 'center' },

  lista: { display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' },
  btnUsuario: {
    background: '#16213e', color: '#ccd6f6', border: '1px solid #0f3460',
    borderRadius: '10px', padding: '14px 16px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
    textAlign: 'center',
  },
  btnUsuarioActivo: { background: '#0f3460', color: '#64ffda', borderColor: '#64ffda' },

  syncBadge: {
    fontSize: '13px', fontWeight: 600, background: '#0a2040',
    border: '1px solid #1e3a5f', borderRadius: '20px', padding: '8px 18px',
  },

  linkConfig: {
    background: 'transparent', border: 'none', color: '#8892b0',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '8px',
  },
};
