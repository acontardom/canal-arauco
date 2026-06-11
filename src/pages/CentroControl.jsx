import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardMatriz from './DashboardMatriz';
import Dashboard from './Dashboard';

export default function CentroControl() {
  const [tab, setTab] = useState('matriz');
  const navigate = useNavigate();

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Centro de Control</h1>

      <div style={s.tabs}>
        <button
          style={{ ...s.tab, ...(tab === 'matriz' ? s.tabActivo : {}) }}
          onClick={() => setTab('matriz')}
        >
          Matriz
        </button>
        <button
          style={{ ...s.tab, ...(tab === 'dashboard' ? s.tabActivo : {}) }}
          onClick={() => setTab('dashboard')}
        >
          Dashboard
        </button>
      </div>

      <div style={s.contenido}>
        {tab === 'matriz' ? <DashboardMatriz /> : <Dashboard />}
      </div>

      <button style={s.config} onClick={() => navigate('/configuracion')}>
        ⚙️ Configuración
      </button>
    </div>
  );
}

const s = {
  page: { maxWidth: '1200px', margin: '0 auto' },
  titulo: { color: '#ccd6f6', fontSize: '24px', fontWeight: 700, marginBottom: '20px', textAlign: 'center' },

  tabs: {
    display: 'flex', gap: '8px', justifyContent: 'center',
    marginBottom: '24px', borderBottom: '1px solid #0f3460', paddingBottom: '0',
  },
  tab: {
    background: 'transparent', border: 'none', color: '#8892b0',
    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
    padding: '10px 24px', borderBottom: '2px solid transparent',
  },
  tabActivo: { color: '#64ffda', borderBottom: '2px solid #64ffda' },

  contenido: { marginBottom: '32px' },

  config: {
    display: 'block', margin: '0 auto', background: 'transparent',
    border: 'none', color: '#8892b0', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer', padding: '8px 14px',
  },
};
