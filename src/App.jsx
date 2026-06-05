import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Tramos from './pages/Tramos';
import TramoDetalle from './pages/TramoDetalle';
import Caidas from './pages/Caidas';
import CaidaDetalle from './pages/CaidaDetalle';
import Protocolo from './pages/Protocolo';
import { iniciarSyncAutomatico } from './utils/sync';

function Layout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e' }}>
      <Navbar />
      <main style={{ padding: '24px' }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    iniciarSyncAutomatico();
  }, []);

  return (
    <BrowserRouter>
      <UserProvider>
        <Layout>
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
