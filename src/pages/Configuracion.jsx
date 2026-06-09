import { useState, useRef } from 'react';
import { TRAMOS, CAIDAS } from '../constants/estructura';
import { LS_KEY, kmKey } from '../hooks/useKm';

function leerConfig() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function filaVacia() {
  return { kmInicio: '', kmFin: '' };
}

function initState() {
  const saved = leerConfig();
  const state = {};
  TRAMOS.forEach(id => {
    const k = kmKey('tramo', id);
    state[k] = saved[k] ?? filaVacia();
  });
  CAIDAS.forEach(id => {
    const k = kmKey('caida', id);
    state[k] = saved[k] ?? filaVacia();
  });
  return state;
}

export default function Configuracion() {
  const [config, setConfig] = useState(initState);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  function set(key, campo, valor) {
    setConfig(prev => ({ ...prev, [key]: { ...prev[key], [campo]: valor } }));
  }

  function guardar() {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast('✓ Configuración guardada');
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  return (
    <div style={s.page}>
      <div style={s.encabezado}>
        <h1 style={s.titulo}>Configuración — KM de tramos y caídas</h1>
        <p style={s.subtitulo}>
          Define los kilómetros de inicio y fin para cada tramo y caída del canal.
          Estos datos se incluirán en los encabezados de los protocolos y reportes Excel.
        </p>
      </div>

      <Seccion titulo="Tramos">
        <Tabla
          filas={TRAMOS.map(id => ({
            key: kmKey('tramo', id),
            label: `Tramo ${id}`,
            ...config[kmKey('tramo', id)],
          }))}
          onChange={set}
        />
      </Seccion>

      <Seccion titulo="Caídas">
        <Tabla
          filas={CAIDAS.map(id => ({
            key: kmKey('caida', id),
            label: `Caída ${id}`,
            ...config[kmKey('caida', id)],
          }))}
          onChange={set}
        />
      </Seccion>

      <div style={s.pie}>
        <button style={s.btnGuardar} onClick={guardar}>
          Guardar todo
        </button>
      </div>

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div style={s.seccion}>
      <h2 style={s.seccionTitulo}>{titulo}</h2>
      {children}
    </div>
  );
}

function Tabla({ filas, onChange }) {
  return (
    <div style={s.tabla}>
      <div style={s.tablaHead}>
        <span style={{ ...s.celda, flex: '0 0 140px' }}>Identificador</span>
        <span style={{ ...s.celda, flex: 1 }}>KM inicio</span>
        <span style={{ ...s.celda, flex: 1 }}>KM fin</span>
      </div>
      {filas.map((fila, i) => (
        <div key={fila.key} style={{ ...s.tablaFila, background: i % 2 === 0 ? '#16213e' : '#121a30' }}>
          <span style={{ ...s.celdaLabel, flex: '0 0 140px' }}>{fila.label}</span>
          <div style={{ flex: 1 }}>
            <input
              style={s.input}
              type="text"
              value={fila.kmInicio}
              onChange={e => onChange(fila.key, 'kmInicio', e.target.value)}
              placeholder="0+000.00"
            />
          </div>
          <div style={{ flex: 1 }}>
            <input
              style={s.input}
              type="text"
              value={fila.kmFin}
              onChange={e => onChange(fila.key, 'kmFin', e.target.value)}
              placeholder="0+000.00"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const s = {
  page: {
    maxWidth: '720px',
    margin: '0 auto',
    paddingBottom: '60px',
  },
  encabezado: {
    marginBottom: '28px',
  },
  titulo: {
    color: '#ccd6f6',
    fontSize: '22px',
    fontWeight: 700,
    marginBottom: '8px',
  },
  subtitulo: {
    color: '#8892b0',
    fontSize: '13px',
    lineHeight: '1.6',
    margin: 0,
  },
  seccion: {
    marginBottom: '28px',
  },
  seccionTitulo: {
    color: '#64ffda',
    fontSize: '13px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    marginBottom: '8px',
    paddingLeft: '4px',
  },
  tabla: {
    border: '1px solid #0f3460',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  tablaHead: {
    display: 'flex',
    alignItems: 'center',
    background: '#0f3460',
    padding: '8px 14px',
    gap: '12px',
  },
  tablaFila: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 14px',
    gap: '12px',
    borderTop: '1px solid #0f3460',
  },
  celda: {
    color: '#8892b0',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  celdaLabel: {
    color: '#ccd6f6',
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0,
  },
  input: {
    width: '100%',
    background: '#0a1628',
    border: '1px solid #1e3a5f',
    borderRadius: '6px',
    color: '#ccd6f6',
    fontSize: '13px',
    padding: '6px 10px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  pie: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
  btnGuardar: {
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '14px 36px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  toast: {
    position: 'fixed',
    bottom: '28px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#10b981',
    color: '#fff',
    padding: '12px 28px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    zIndex: 1000,
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    whiteSpace: 'nowrap',
  },
};
