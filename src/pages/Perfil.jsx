import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { db } from '../db/database';
import { sincronizar } from '../utils/sync';

export default function Perfil() {
  const { usuario, signOut, cambiarContrasena } = useAuth();
  const navigate = useNavigate();
  const { pendientes, sincronizando, todoSincronizado } = useSyncStatus();

  const [confirmando,     setConfirmando]     = useState(false);
  const [resincronizando, setResincronizando] = useState(false);
  const [cambioPass,      setCambioPass]      = useState(false);
  const [nuevaClave,      setNuevaClave]      = useState('');
  const [passMsg,         setPassMsg]         = useState('');
  const [guardandoPass,   setGuardandoPass]   = useState(false);

  async function forzarResync() {
    setConfirmando(false);
    setResincronizando(true);
    try {
      await db.fotos_terreno.toCollection().modify({ sincronizada: false, subidaStorage: false });
      await db.protocolos.toCollection().modify({ sincronizada: false });
      await db.camiones.toCollection().modify({ sincronizado: false });
      await sincronizar();
    } finally {
      setResincronizando(false);
    }
  }

  async function handleCambiarPass() {
    if (!nuevaClave || nuevaClave.length < 6) { setPassMsg('Mínimo 6 caracteres'); return; }
    setGuardandoPass(true);
    const err = await cambiarContrasena(nuevaClave);
    setGuardandoPass(false);
    if (err) {
      setPassMsg('Error al cambiar contraseña');
    } else {
      setPassMsg('Contraseña actualizada');
      setNuevaClave('');
      setTimeout(() => { setCambioPass(false); setPassMsg(''); }, 1500);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.tarjeta}>
        <div style={s.avatar}>{(usuario?.nombre ?? usuario?.email ?? '?')[0].toUpperCase()}</div>
        <div style={s.nombre}>{usuario?.nombre ?? '—'}</div>
        <div style={s.email}>{usuario?.email}</div>
        {usuario?.rol && <div style={s.rol}>{usuario.rol}</div>}
      </div>

      <div style={s.syncBadge}>
        <span style={{ color: sincronizando ? '#8892b0' : todoSincronizado ? '#10b981' : '#f59e0b' }}>
          {sincronizando ? '⏳ Sincronizando...' : todoSincronizado ? '☁️ Todo sincronizado' : `🔄 ${pendientes} pendientes`}
        </span>
      </div>

      <div style={s.acciones}>
        <button
          style={s.btnAccion}
          onClick={() => { setCambioPass(v => !v); setPassMsg(''); setNuevaClave(''); }}
        >
          🔑 {cambioPass ? 'Cancelar' : 'Cambiar contraseña'}
        </button>

        {cambioPass && (
          <div style={s.passForm}>
            <input
              type="password"
              placeholder="Nueva contraseña"
              style={s.passInput}
              value={nuevaClave}
              onChange={e => setNuevaClave(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCambiarPass()}
            />
            {passMsg && (
              <span style={passMsg.includes('Error') ? s.passError : s.passOk}>{passMsg}</span>
            )}
            <button style={s.btnGuardarPass} onClick={handleCambiarPass} disabled={guardandoPass}>
              {guardandoPass ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </div>
        )}

        <button
          style={{ ...s.btnAccion, ...(resincronizando ? s.btnAccionActivo : {}) }}
          onClick={() => !resincronizando && setConfirmando(true)}
          disabled={resincronizando}
        >
          {resincronizando ? '⏳ Re-sincronizando...' : '🔄 Forzar re-sincronización'}
        </button>

        <button style={s.btnCerrarSesion} onClick={signOut}>
          Cerrar sesión
        </button>
      </div>

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
    maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '20px', paddingTop: '20px',
  },

  tarjeta: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '16px',
    padding: '28px 32px', width: '100%', boxSizing: 'border-box',
  },
  avatar: {
    width: 56, height: 56, borderRadius: '50%', background: '#0f3460',
    color: '#64ffda', fontSize: 24, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  nombre: { color: '#ccd6f6', fontSize: '20px', fontWeight: 700 },
  email:  { color: '#8892b0', fontSize: '13px' },
  rol: {
    marginTop: 4, background: '#0f3460', color: '#64ffda',
    fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },

  syncBadge: {
    fontSize: '13px', fontWeight: 600, background: '#0a2040',
    border: '1px solid #1e3a5f', borderRadius: '20px', padding: '8px 18px',
  },

  acciones: { display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' },

  btnAccion: {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px',
    color: '#8892b0', fontSize: '14px', fontWeight: 600,
    padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
  },
  btnAccionActivo: { color: '#64ffda', borderColor: '#2a7abf' },

  passForm: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 4px' },
  passInput: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '8px',
    color: '#ccd6f6', fontSize: '14px', padding: '10px 12px',
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  passOk:    { color: '#10b981', fontSize: '12px', fontWeight: 600 },
  passError: { color: '#f87171', fontSize: '12px', fontWeight: 600 },
  btnGuardarPass: {
    background: 'rgba(100,255,218,0.1)', border: '1px solid #64ffda',
    borderRadius: '8px', color: '#64ffda', fontSize: '13px', fontWeight: 700,
    padding: '10px', cursor: 'pointer',
  },

  btnCerrarSesion: {
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '10px', color: '#f87171', fontSize: '14px', fontWeight: 700,
    padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
  },

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
