import { useState } from 'react';
import GenerarProtocolo from './GenerarProtocolo';
import DashboardMatriz from './DashboardMatriz';
import Dashboard from './Dashboard';

const TABS = [
  { id: 'protocolos', label: 'Protocolos' },
  { id: 'matriz', label: 'Matriz' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'camiones', label: 'Camiones' },
];

function CamionesPlaceholder() {
  return (
    <div style={s.placeholder}>
      <span style={s.placeholderIcono}>🚛</span>
      <p style={s.placeholderTexto}>Historial de camiones — próximamente</p>
    </div>
  );
}

export default function Gestion() {
  const [tab, setTab] = useState('protocolos');

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Gestión</h1>

      <div style={s.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...s.tab, ...(tab === t.id ? s.tabActivo : {}) }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={s.contenido}>
        {tab === 'protocolos' && <GenerarProtocolo />}
        {tab === 'matriz' && <DashboardMatriz />}
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'camiones' && <CamionesPlaceholder />}
      </div>
    </div>
  );
}

const s = {
  page: { maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' },

  titulo: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },

  tabs: {
    display: 'flex', gap: '8px', overflowX: 'auto',
    borderBottom: '1px solid #0f3460', paddingBottom: '2px',
  },
  tab: {
    background: 'transparent', border: 'none', color: '#8892b0',
    padding: '10px 14px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', borderBottom: '2px solid transparent',
  },
  tabActivo: { color: '#64ffda', borderBottom: '2px solid #64ffda' },

  contenido: { display: 'flex', flexDirection: 'column', gap: '14px' },

  placeholder: {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '16px',
    padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '8px',
  },
  placeholderIcono: { fontSize: '40px' },
  placeholderTexto: { color: '#8892b0', fontSize: '14px', margin: 0 },
};
