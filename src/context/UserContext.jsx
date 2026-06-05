import { createContext, useContext, useState } from 'react';
import { USUARIOS } from '../constants/estructura';

const UserContext = createContext(null);

const LS_KEY = 'canal_arauco_usuario';

function SeleccionUsuario({ onSeleccionar }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <h1 style={styles.titulo}>¿Quién eres?</h1>
        <p style={styles.subtitulo}>Selecciona tu nombre para continuar</p>
        <div style={styles.botones}>
          {USUARIOS.map((nombre) => (
            <button
              key={nombre}
              style={styles.boton}
              onClick={() => onSeleccionar(nombre)}
            >
              {nombre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function UserProvider({ children }) {
  const [usuario, setUsuario] = useState(() => localStorage.getItem(LS_KEY) || null);

  function seleccionarUsuario(nombre) {
    localStorage.setItem(LS_KEY, nombre);
    setUsuario(nombre);
  }

  function cerrarSesion() {
    localStorage.removeItem(LS_KEY);
    setUsuario(null);
  }

  if (!usuario) {
    return <SeleccionUsuario onSeleccionar={seleccionarUsuario} />;
  }

  return (
    <UserContext.Provider value={{ usuario, cerrarSesion }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

const styles = {
  overlay: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1a1a2e',
  },
  card: {
    background: '#16213e',
    borderRadius: '16px',
    padding: '48px 40px',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    maxWidth: '400px',
    width: '90%',
  },
  titulo: {
    color: '#ffffff',
    fontSize: '28px',
    margin: '0 0 8px',
    fontWeight: 700,
  },
  subtitulo: {
    color: '#8892b0',
    fontSize: '14px',
    margin: '0 0 32px',
  },
  botones: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  boton: {
    background: '#0f3460',
    color: '#ffffff',
    border: '2px solid transparent',
    borderRadius: '10px',
    padding: '16px 24px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
