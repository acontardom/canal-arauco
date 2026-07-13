import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Entrada from './pages/Entrada';
import Inicio from './pages/Inicio';
import Dashboard from './pages/Dashboard';
import DashboardMatriz from './pages/DashboardMatriz';
import CentroControl from './pages/CentroControl';
import Gestion from './pages/Gestion';
import Perfil from './pages/Perfil';
import Galeria from './pages/Galeria';
import HistorialCamiones from './pages/HistorialCamiones';
import DashboardCamiones from './pages/DashboardCamiones';
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
import GeneradorEDP from './pages/GeneradorEDP';
import Configuracion from './pages/Configuracion';
import VistaCanal from './pages/VistaCanal';
import { descargarDesdeSupabase, iniciarSyncAutomatico } from './utils/sync';
import { supabase } from './config/supabase';
import { useAuth } from './hooks/useAuth';

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b', fontSize: 14 }}>Cargando...</div>
    </div>
  );
}

function esFlujoInterno(pathname) {
  return pathname.startsWith('/subir-fotos')
    || pathname.startsWith('/recibir-camion')
    || pathname.startsWith('/recepcionar-avance')
    || pathname.startsWith('/generar-protocolo')
    || pathname.startsWith('/protocolo');
}

function Layout({ children }) {
  const location = useLocation();
  const mostrarBottomNav = !esFlujoInterno(location.pathname);

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e' }}>
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

function PublicSubpageLayout({ children }) {
  const nombreTerreno = localStorage.getItem('nombreTerreno');
  return (
    <>
      <div style={{ paddingBottom: nombreTerreno ? 60 : 0 }}>{children}</div>
      {nombreTerreno && <BottomNav />}
    </>
  );
}

function AppRoutes() {
  const { usuario, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (usuario?.rol === 'ito') {
    return (
      <Routes>
        <Route path="/ito" element={<PortalITO />} />
        <Route path="/firma/:token" element={<Firma />} />
        <Route path="*" element={<Navigate to="/ito" replace />} />
      </Routes>
    );
  }

  if (!usuario) {
    const esMobile = window.innerWidth < 768;
    if (!esMobile) {
      return (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/subir-fotos" element={<SubirFotos />} />
          <Route path="/subir-fotos/:tipo/:entidadId" element={<SubirFotos />} />
          <Route path="/recibir-camion" element={<RecibirCamion />} />
          <Route path="/firma/:token" element={<Firma />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      );
    }
    return (
      <Routes>
        <Route path="/" element={<Entrada />} />
        <Route path="/subir-fotos" element={
          localStorage.getItem('nombreTerreno')
            ? <PublicSubpageLayout><SubirFotos /></PublicSubpageLayout>
            : <Navigate to="/" replace />
        } />
        <Route path="/subir-fotos/:tipo/:entidadId" element={
          localStorage.getItem('nombreTerreno')
            ? <PublicSubpageLayout><SubirFotos /></PublicSubpageLayout>
            : <Navigate to="/" replace />
        } />
        <Route path="/recibir-camion" element={
          localStorage.getItem('nombreTerreno')
            ? <PublicSubpageLayout><RecibirCamion /></PublicSubpageLayout>
            : <Navigate to="/" replace />
        } />
        <Route path="/login" element={<Login />} />
        <Route path="/firma/:token" element={<Firma />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/gestion" element={<Gestion />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/galeria" element={<Galeria />} />
        <Route path="/camiones" element={<HistorialCamiones />} />
        <Route path="/dashboard-camiones" element={<DashboardCamiones />} />
        <Route path="/control" element={<CentroControl />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/matriz" element={<DashboardMatriz />} />
        <Route path="/proximamente" element={<Proximamente />} />
        <Route path="/subir-fotos" element={<SubirFotos />} />
        <Route path="/subir-fotos/:tipo/:entidadId" element={<SubirFotos />} />
        <Route path="/recibir-camion" element={<RecibirCamion />} />
        <Route path="/galeria" element={<Galeria />} />
        <Route path="/recepcionar-avance" element={<RecepcionarAvance />} />
        <Route path="/generar-protocolo" element={<GenerarProtocolo />} />
        <Route path="/generar-edp" element={<GeneradorEDP />} />
        <Route path="/protocolo/:tipo/:entidadId/:protocoloId" element={<Protocolo />} />
        <Route path="/tramos" element={<Tramos />} />
        <Route path="/tramos/:tramoId" element={<TramoDetalle />} />
        <Route path="/caidas" element={<Caidas />} />
        <Route path="/caidas/:caidaId" element={<CaidaDetalle />} />
        <Route path="/atraviesos" element={<Atraviesos />} />
        <Route path="/atraviesos/:atraviesoId" element={<AtraviesoDetalle />} />
        <Route path="/vista-canal" element={<VistaCanal />} />
        <Route path="/cubicaciones" element={<Cubicaciones />} />
        <Route path="/firma/:token" element={<Firma />} />
        {usuario.rol === 'admin' && (
          <>
            <Route path="/planificacion" element={<Planificacion />} />
            <Route path="/cuadrillas" element={<Cuadrillas />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </>
        )}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/ito" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  useEffect(() => {
    iniciarSyncAutomatico();
  }, []);

  useEffect(() => {
    if (!supabase || !navigator.onLine) return;
    descargarDesdeSupabase();
  }, []);

  return (
    <BrowserRouter>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </BrowserRouter>
  );
}
