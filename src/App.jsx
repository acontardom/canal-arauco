import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Tramos from './pages/Tramos';
import TramoDetalle from './pages/TramoDetalle';
import Caidas from './pages/Caidas';
import CaidaDetalle from './pages/CaidaDetalle';
import Protocolo from './pages/Protocolo';
import { descargarDesdeSupabase, iniciarSyncAutomatico } from './utils/sync';
import { supabase } from './config/supabase';

function BannerSync() {
  return (
    <div style={bs.banner}>
      <span style={bs.spinner}>🔄</span>
      Sincronizando datos desde servidor...
    </div>
  );
}

const bs = {
  banner: {
    background: '#0f3460',
    color: '#64ffda',
    fontSize: '12px',
    fontWeight: 600,
    padding: '7px 24px',
    textAlign: 'center',
    letterSpacing: '0.4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: { display: 'inline-block', animation: 'spin 1s linear infinite' },
};

function Layout({ children, cargandoSync }) {
  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e' }}>
      {cargandoSync && <BannerSync />}
      <Navbar />
      <main style={{ padding: '24px' }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  // Mostrar banner solo si Supabase está configurado y hay conexión
  const [cargandoSync, setCargandoSync] = useState(
    () => !!supabase && navigator.onLine
  );

  useEffect(() => {
    if (!supabase || !navigator.onLine) {
      // Sin Supabase o sin red: arrancar sync automático directamente
      iniciarSyncAutomatico();
      return;
    }

    descargarDesdeSupabase().finally(() => {
      setCargandoSync(false);
      iniciarSyncAutomatico();
    });
  }, []);

  return (
    <BrowserRouter>
      <UserProvider>
        <Layout cargandoSync={cargandoSync}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tramos" element={<Tramos />} />
            <Route path="/tramos/:tramoId" element={<TramoDetalle />} />
            <Route path="/caidas" element={<Caidas />} />
            <Route path="/caidas/:caidaId" element={<CaidaDetalle />} />
            <Route path="/protocolo/:tipo/:entidadId/:protocoloId" element={<Protocolo />} />
          </Routes>
        </Layout>
      </UserProvider>
    </BrowserRouter>
  );
}
