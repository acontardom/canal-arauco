import { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

const LS_KEY = 'canal_arauco_usuario';

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

  return (
    <UserContext.Provider value={{ usuario, seleccionarUsuario, cerrarSesion }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
