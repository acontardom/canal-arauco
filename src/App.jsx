import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Inicio from './pages/Inicio';
import Dashboard from './pages/Dashboard';
import DashboardMatriz from './pages/DashboardMatriz';
import CentroControl from './pages/CentroControl';
import Gestion from './pages/Gestion';
import Perfil from './pages/Perfil';
import Galeria from './pages/Galeria';
import HistorialCamiones from './pages/HistorialCamiones';
import Proximamente from './pages/Proximamente';
import SubirFotos from './pages/SubirFotos';
import RecibirCamion from './pages/RecibirCamion';
import RecepcionarAvance from './pages/RecepcionarAvance';
import Cuadrillas from './pages/Cuadrillas';
import Planificacion from './pages/Planificacion';
import Tramos from './pages/Tramos';
import TramoDetalle from './pages/TramoDetalle';
import Caidas from './pages/Caidas';
import CaidaDetalle from './pages/CaidaDetalle';
import Atraviesos from './pages/Atraviesos';
import AtraviesoDetalle from './pages/AtraviesoDetalle';
import Cubicaciones from './pages/Cubicaciones';
import Login from './pages/Login';
import PortalITO from './pages/PortalITO';
import Firma from './pages/Firma';
import Protocolo from './pages/Protocolo';
import GenerarProtocolo from './pages/GenerarProtocolo';
import Configuracion from './pages/Configuracion';
import VistaCanal from './pages/VistaCanal';
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

function esFlujoInterno(pathname) {
  return pathname.startsWith('/subir-fotos')
    || pathname.startsWith('/recibir-camion')
    || pathname.startsWith('/recepcionar-avance')
    || pathname.startsWith('/generar-protocolo')
    || pathname.startsWith('/protocolo');
}

function Layout({ children, cargandoSync }) {
  const location = useLocation();
  const mostrarBottomNav = !esFlujoInterno(location.pathname);

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e' }}>
      {cargandoSync && <BannerSync />}
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className={mostrarBottomNav ? 'with-bottom-nav main-content' : 'main-content'} style={{ padding: '24px', flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>
      {mostrarBottomNav && <BottomNav />}
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
            <Route path="/" element={<Inicio />} />
            <Route path="/gestion" element={<Gestion />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/galeria" element={<Galeria />} />
            <Route path="/camiones" element={<HistorialCamiones />} />
            <Route path="/control" element={<CentroControl />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/matriz" element={<DashboardMatriz />} />
            <Route path="/proximamente" element={<Proximamente />} />
            <Route path="/subir-fotos" element={<SubirFotos />} />
            <Route path="/subir-fotos/:tipo/:entidadId" element={<SubirFotos />} />
            <Route path="/recibir-camion" element={<RecibirCamion />} />
            <Route path="/planificacion" element={<Planificacion />} />
            <Route path="/recepcionar-avance" element={<RecepcionarAvance />} />
            <Route path="/cuadrillas" element={<Cuadrillas />} />
            <Route path="/tramos" element={<Tramos />} />
            <Route path="/tramos/:tramoId" element={<TramoDetalle />} />
            <Route path="/caidas" element={<Caidas />} />
            <Route path="/caidas/:caidaId" element={<CaidaDetalle />} />
            <Route path="/atraviesos" element={<Atraviesos />} />
            <Route path="/atraviesos/:atraviesoId" element={<AtraviesoDetalle />} />
            <Route path="/protocolo/:tipo/:entidadId/:protocoloId" element={<Protocolo />} />
            <Route path="/generar-protocolo" element={<GenerarProtocolo />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/vista-canal" element={<VistaCanal />} />
            <Route path="/cubicaciones" element={<Cubicaciones />} />
            <Route path="/login" element={<Login />} />
            <Route path="/ito" element={<PortalITO />} />
            <Route path="/firma/:token" element={<Firma />} />
          </Routes>
        </Layout>
      </UserProvider>
    </BrowserRouter>
  );
}
