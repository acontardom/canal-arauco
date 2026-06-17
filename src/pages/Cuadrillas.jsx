import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';

export default function Cuadrillas() {
  const navigate = useNavigate();

  const [cuadrillas, setCuadrillas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [guardandoNueva, setGuardandoNueva] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editandoNombre, setEditandoNombre] = useState('');
  const [toast, setToast] = useState(null);
  let toastTimer = null;

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('cuadrillas').select('*').order('nombre');
    setCuadrillas(data ?? []);
    setCargando(false);
  }

  function mostrarToast(msg, t = 'ok') {
    if (toastTimer) clearTimeout(toastTimer);
    setToast({ msg, tipo: t });
    toastTimer = setTimeout(() => setToast(null), 3000);
  }

  async function crear() {
    const nombre = nuevaNombre.trim();
    if (!nombre) return;
    setGuardandoNueva(true);
    const { data, error } = await supabase
      .from('cuadrillas')
      .insert({ nombre, activa: true })
      .select()
      .single();
    if (!error && data) {
      setCuadrillas(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNuevaNombre('');
      setCreando(false);
      mostrarToast('Cuadrilla creada');
    } else {
      mostrarToast('Error al crear', 'error');
    }
    setGuardandoNueva(false);
  }

  async function toggleActiva(c) {
    const { data, error } = await supabase
      .from('cuadrillas')
      .update({ activa: !c.activa })
      .eq('id', c.id)
      .select()
      .single();
    if (!error && data) {
      setCuadrillas(prev => prev.map(x => x.id === c.id ? data : x));
    }
  }

  async function guardarEdicion(id) {
    const nombre = editandoNombre.trim();
    if (!nombre) return;
    const { data, error } = await supabase
      .from('cuadrillas')
      .update({ nombre })
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      setCuadrillas(prev => prev.map(x => x.id === id ? data : x));
      setEditandoId(null);
      mostrarToast('Nombre actualizado');
    } else {
      mostrarToast('Error al guardar', 'error');
    }
  }

  function iniciarEdicion(c) {
    setEditandoId(c.id);
    setEditandoNombre(c.nombre);
  }

  return (
    <div style={s.page}>
      <button style={s.btnVolver} onClick={() => navigate('/')}>← Inicio</button>
      <div style={s.header}>
        <h1 style={s.titulo}>Cuadrillas</h1>
        {!creando && (
          <button style={s.btnNueva} onClick={() => { setCreando(true); setNuevaNombre(''); }}>
            + Nueva
          </button>
        )}
      </div>

      {creando && (
        <div style={s.formNueva}>
          <input
            style={s.input}
            type="text"
            placeholder="Nombre de la cuadrilla..."
            value={nuevaNombre}
            onChange={e => setNuevaNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') crear(); if (e.key === 'Escape') setCreando(false); }}
            autoFocus
          />
          <div style={s.formNuevaRow}>
            <button style={s.btnGuardar} onClick={crear} disabled={!nuevaNombre.trim() || guardandoNueva}>
              {guardandoNueva ? 'Guardando...' : 'Guardar'}
            </button>
            <button style={s.btnCancelar} onClick={() => setCreando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {cargando && <p style={s.cargando}>Cargando...</p>}

      {!cargando && cuadrillas.length === 0 && (
        <p style={s.vacio}>Sin cuadrillas registradas.</p>
      )}

      <div style={s.lista}>
        {cuadrillas.map(c => (
          <div key={c.id} style={s.item}>
            <div style={s.itemIzq}>
              {editandoId === c.id ? (
                <input
                  style={{ ...s.input, ...s.inputEdit }}
                  value={editandoNombre}
                  onChange={e => setEditandoNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(c.id); if (e.key === 'Escape') setEditandoId(null); }}
                  autoFocus
                />
              ) : (
                <span style={{ ...s.nombre, ...(!c.activa ? s.nombreInactiva : {}) }}>{c.nombre}</span>
              )}
              <span style={{ ...s.badge, ...(c.activa ? s.badgeActiva : s.badgeInactiva) }}>
                {c.activa ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <div style={s.itemDer}>
              {editandoId === c.id ? (
                <>
                  <button style={s.btnAcc} onClick={() => guardarEdicion(c.id)}>✓</button>
                  <button style={s.btnAcc} onClick={() => setEditandoId(null)}>✕</button>
                </>
              ) : (
                <>
                  <button style={s.btnAcc} onClick={() => iniciarEdicion(c)} title="Editar nombre">✏️</button>
                  <button
                    style={{ ...s.btnToggle, ...(c.activa ? s.btnToggleActiva : s.btnToggleInactiva) }}
                    onClick={() => toggleActiva(c)}
                  >
                    {c.activa ? 'Desactivar' : 'Activar'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {toast && (
        <div style={{ ...s.toast, ...(toast.tipo === 'error' ? s.toastError : {}) }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const s = {
  page: { maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '40px' },

  btnVolver: {
    background: 'transparent', border: 'none', color: '#8892b0',
    cursor: 'pointer', fontSize: '14px', padding: 0, alignSelf: 'flex-start',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { color: '#ccd6f6', fontSize: '20px', fontWeight: 700, margin: 0 },
  btnNueva: {
    background: '#64ffda', color: '#0a1f3a', border: 'none', borderRadius: '8px',
    padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
  },

  formNueva: {
    background: '#16213e', border: '1px solid #1e3a5f', borderRadius: '10px',
    padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
  },
  formNuevaRow: { display: 'flex', gap: '8px' },
  input: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '14px', padding: '10px 12px', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  inputEdit: { padding: '6px 10px', fontSize: '13px' },
  btnGuardar: {
    flex: 1, background: '#10b981', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
  },
  btnCancelar: {
    flex: 1, background: 'transparent', border: '1px solid #0f3460', color: '#8892b0',
    borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  },

  cargando: { color: '#8892b0', fontSize: '13px', margin: 0 },
  vacio: { color: '#8892b0', fontSize: '13px', margin: 0 },

  lista: { display: 'flex', flexDirection: 'column', gap: '8px' },
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px', padding: '12px 14px',
  },
  itemIzq: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 },
  itemDer: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },

  nombre: { color: '#ccd6f6', fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  nombreInactiva: { color: '#8892b0' },
  badge: { borderRadius: '12px', padding: '2px 8px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' },
  badgeActiva: { background: 'rgba(16,185,129,0.15)', color: '#10b981' },
  badgeInactiva: { background: 'rgba(100,100,120,0.2)', color: '#8892b0' },

  btnAcc: {
    background: 'transparent', border: '1px solid #1e3a5f', color: '#8892b0',
    borderRadius: '6px', padding: '5px 8px', fontSize: '14px', cursor: 'pointer',
  },
  btnToggle: {
    border: 'none', borderRadius: '8px', padding: '6px 12px',
    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
  },
  btnToggleActiva: { background: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  btnToggleInactiva: { background: 'rgba(16,185,129,0.15)', color: '#10b981' },

  toast: {
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    background: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 200,
  },
  toastError: { background: '#ef4444' },
};
