import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { USUARIOS } from '../constants/estructura';
import { db } from '../db/database';
import { sincronizar } from '../utils/sync';

export default function Perfil() {
  const { usuario, seleccionarUsuario } = useUser();
  const navigate = useNavigate();
  const { pendientes, sincronizando, todoSincronizado } = useSyncStatus();

  const [confirmando, setConfirmando] = useState(false);
  const [resincronizando, setResincronizando] = useState(false);

  async function forzarResync() {
    setConfirmando(false);
    setResincronizando(true);
    try {
      await db.fotos_terreno.toCollection().modify({ sincronizada: false, subidaStorage: false });
      await db.fotos.toCollection().modify({ sincronizada: false, subidaStorage: false });
      await db.protocolos.toCollection().modify({ sincronizada: false });
      await db.camiones.toCollection().modify({ sincronizado: false });
      await sincronizar();
    } finally {
      setResincronizando(false);
    }
  }

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

      <button
        style={{ ...s.btnAdmin, ...(resincronizando ? s.btnAdminActivo : {}) }}
        onClick={() => !resincronizando && setConfirmando(true)}
        disabled={resincronizando}
      >
        {resincronizando ? 'Re-sincronizando...' : '🔄 Forzar re-sincronización'}
      </button>

      {confirmando && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <p style={s.modalTexto}>
              Esto marcará todos los registros locales como pendientes de sincronizar y los volverá a subir. ¿Continuar?
            </p>
            <div style={s.modalBotones}>
              <button style={s.btnCancelarModal} onClick={() => setConfirmando(false)}>Cancelar</button>
              <button style={s.btnConfirmarModal} onClick={forzarResync}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
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

  btnAdmin: {
    background: 'transparent', border: '1px solid #1e3a5f', color: '#8892b0',
    borderRadius: '10px', padding: '10px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  },
  btnAdminActivo: { color: '#64ffda', borderColor: '#2a7abf' },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', zIndex: 300,
  },
  modal: {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '14px',
    padding: '24px', width: '100%', maxWidth: '400px',
    display: 'flex', flexDirection: 'column', gap: '20px',
  },
  modalTexto: { color: '#ccd6f6', fontSize: '15px', fontWeight: 600, margin: 0, lineHeight: 1.5 },
  modalBotones: { display: 'flex', gap: '10px' },
  btnCancelarModal: {
    flex: 1, background: 'transparent', border: '1px solid #0f3460', color: '#8892b0',
    borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },
  btnConfirmarModal: {
    flex: 1, background: '#10b981', color: '#fff', border: 'none',
    borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
  },
};
