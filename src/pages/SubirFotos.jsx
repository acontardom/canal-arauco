import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { useUser } from '../context/UserContext';
import { useAuth } from '../hooks/useAuth';
import { TRAMOS, CAIDAS, ATRAVIESOS } from '../constants/estructura';
import { comprimirFoto } from '../utils/comprimirFoto';
import { leerFechaExif } from '../utils/leerFechaExif';
import { sincronizar } from '../utils/sync';
import { supabase } from '../config/supabase';
import { fechaHoy } from '../utils/fecha';

const ETIQUETAS = ['Excavación', 'Moldaje', 'Enfierradura', 'Hormigón', 'Emplantillado', 'General'];

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

const LISTAS = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };

export default function SubirFotos() {
  const { tipo: tipoParam, entidadId: entidadIdParam } = useParams();
  const navigate = useNavigate();
  const { usuario } = useUser();
  const { usuario: usuarioAuth } = useAuth();
  const nombreUsuario = usuarioAuth?.nombre ?? usuario ?? localStorage.getItem('nombreTerreno') ?? 'Sin identificar';

  const [tipo, setTipo] = useState(tipoParam ?? 'tramo');
  const [entidadId, setEntidadId] = useState(entidadIdParam ?? String(TRAMOS[0]));
  const [pendientes, setPendientes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [toast, setToast] = useState(null);

  const inputCamaraRef = useRef(null);
  const inputGaleriaRef = useRef(null);
  const toastTimerRef = useRef(null);

  const entidadIdReal = tipo === 'caida' ? Number(entidadId) : entidadId;

  const [guardadas, setGuardadas] = useState(0);

  useEffect(() => {
    if (!supabase) { setGuardadas(0); return; }
    supabase
      .from('fotos_terreno')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', tipo)
      .eq('entidad_id', entidadIdReal)
      .then(({ count, error }) => {
        if (!error) setGuardadas(count ?? 0);
      });
  }, [tipo, entidadId]);

  // Forzar sincronización al montar para subir cualquier foto pendiente en Dexie
  useEffect(() => {
    if (supabase && navigator.onLine) {
      setSincronizando(true);
      sincronizar().finally(() => setSincronizando(false));
    }
  }, []);

  function handleTipoChange(nuevoTipo) {
    setTipo(nuevoTipo);
    setEntidadId(String(LISTAS[nuevoTipo][0]));
  }

  function mostrarToast(msg, t = 'ok') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, tipo: t });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  async function handleCapturar(e) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const ids = files.map(() => `${Date.now()}_${Math.random().toString(36).slice(2)}`);

    // Placeholders inmediatos — uno por archivo
    setPendientes(prev => [
      ...prev,
      ...ids.map(id => ({ id, dataUrl: null, etiquetas: [], descripcion: '', cargando: true })),
    ]);

    for (let i = 0; i < files.length; i++) {
      const fechaExif = await leerFechaExif(files[i]);
      const dataUrl = await comprimirFoto(files[i]);
      const id = ids[i];
      setPendientes(prev => prev.map(p => p.id === id
        ? { ...p, dataUrl, fechaCaptura: fechaExif ?? new Date().toISOString(), cargando: false }
        : p));
    }
    e.target.value = '';
  }

  function toggleEtiqueta(idx, etiqueta) {
    setPendientes(prev => prev.map((f, i) => i === idx
      ? {
          ...f,
          etiquetas: f.etiquetas.includes(etiqueta)
            ? f.etiquetas.filter(x => x !== etiqueta)
            : [...f.etiquetas, etiqueta],
        }
      : f));
  }

  function setDescripcion(idx, desc) {
    setPendientes(prev => prev.map((f, i) => i === idx ? { ...f, descripcion: desc } : f));
  }

  function eliminarPendiente(idx) {
    setPendientes(prev => prev.filter((_, i) => i !== idx));
  }

  async function guardarTodo() {
    const listos = pendientes.filter(f => !f.cargando);
    if (listos.length === 0 || guardando) return;
    setGuardando(true);
    try {
      for (const foto of listos) {
        await db.fotos_terreno.add({
          tipo, entidadId: entidadIdReal,
          etiquetas: foto.etiquetas, descripcion: foto.descripcion,
          dataUrl: foto.dataUrl, storageUrl: null, subidaStorage: false,
          usuarioNombre: nombreUsuario, fechaCaptura: foto.fechaCaptura ?? new Date().toISOString(),
          sincronizada: false,
        });
      }

      setGuardadoOk(true);
      const savedIds = new Set(listos.map(f => f.id));
      setTimeout(() => {
        setGuardadoOk(false);
        setPendientes(prev => prev.filter(p => !savedIds.has(p.id)));
      }, 1500);

      if (supabase && navigator.onLine) {
        setSincronizando(true);
        sincronizar().finally(() => setSincronizando(false));
      }
    } catch {
      mostrarToast('Error al guardar fotos', 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={s.page}>
      <button style={s.btnVolver} onClick={() => navigate('/')}>← Inicio</button>
      <h1 style={s.titulo}>Subir Fotos</h1>

      {sincronizando && <div style={s.syncIndicator}>☁️ Sincronizando...</div>}

      <div style={s.row}>
        <div style={s.campo}>
          <label style={s.label}>Tipo</label>
          <select style={s.input} value={tipo} onChange={e => handleTipoChange(e.target.value)}>
            <option value="tramo">Tramo</option>
            <option value="caida">Caída</option>
            <option value="atravieso">Atravieso</option>
          </select>
        </div>
        <div style={s.campo}>
          <label style={s.label}>Entidad</label>
          <select style={s.input} value={entidadId} onChange={e => setEntidadId(e.target.value)}>
            {LISTAS[tipo].map(id => (
              <option key={id} value={id}>{NOMBRE_TIPO[tipo]} {id}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={s.contador}>📷 {guardadas} {guardadas === 1 ? 'foto guardada' : 'fotos guardadas'}</div>

      <input ref={inputCamaraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCapturar} />
      <input ref={inputGaleriaRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleCapturar} />

      <div style={s.botonesCaptura}>
        <button style={s.btnCapturar} onClick={() => inputCamaraRef.current?.click()}>📷 Sacar Foto</button>
        <button style={s.btnAdjuntar} onClick={() => inputGaleriaRef.current?.click()}>🖼 Adjuntar</button>
      </div>

      {pendientes.length > 0 && (
        <>
          <style>{`@keyframes spin-photo { to { transform: rotate(360deg); } }`}</style>
          <div style={s.grid}>
            {pendientes.map((foto, idx) => foto.cargando ? (
              <div key={foto.id} style={s.fotoCard}>
                <div style={{ ...s.fotoThumb, ...s.fotoThumbPlaceholder }}>
                  <div style={s.spinner} />
                  <span style={s.spinnerTexto}>Cargando...</span>
                </div>
              </div>
            ) : (
              <div key={foto.id ?? idx} style={s.fotoCard}>
                <div style={s.fotoThumb}>
                  <img src={foto.dataUrl} alt="" style={s.fotoImg} />
                  <button style={s.btnEliminarFoto} onClick={() => eliminarPendiente(idx)}>×</button>
                </div>
                <div style={s.etiquetas}>
                  {ETIQUETAS.map(et => (
                    <button
                      key={et}
                      style={{ ...s.chip, ...(foto.etiquetas.includes(et) ? s.chipActivo : {}) }}
                      onClick={() => toggleEtiqueta(idx, et)}
                    >
                      {et}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Descripción (opcional)"
                  style={s.descInput}
                  value={foto.descripcion}
                  onChange={e => setDescripcion(idx, e.target.value)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {pendientes.length > 0 && (() => {
        const listos = pendientes.filter(f => !f.cargando);
        const hayCargando = pendientes.some(f => f.cargando);
        return (
          <button style={s.btnGuardar} onClick={guardarTodo} disabled={guardando || guardadoOk || listos.length === 0}>
            {guardadoOk ? '✅ Guardado'
              : guardando ? 'Guardando...'
              : `Guardar${hayCargando ? ' listos' : ' todo'} (${listos.length})`}
          </button>
        );
      })()}

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
  titulo: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },

  syncIndicator: {
    display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
    background: '#0a2040', border: '1px solid #1e3a5f', borderRadius: '20px',
    padding: '4px 12px', color: '#64ffda', fontSize: '12px', fontWeight: 600,
  },

  row: { display: 'flex', gap: '10px' },
  campo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#8892b0', fontSize: '12px', fontWeight: 600 },
  input: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '14px', padding: '10px 12px', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },

  contador: {
    background: '#0a2040', border: '1px solid #10b981', borderRadius: '8px',
    padding: '8px 14px', color: '#ccd6f6', fontSize: '13px', fontWeight: 600,
  },

  botonesCaptura: { display: 'flex', gap: '10px' },
  btnCapturar: {
    flex: 1, background: '#64ffda', color: '#0a1f3a', border: 'none', borderRadius: '12px',
    padding: '16px 14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
  },
  btnAdjuntar: {
    flex: 1, background: '#0f3460', color: '#ccd6f6', border: '1px solid #1e3a5f', borderRadius: '12px',
    padding: '16px 14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
  },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' },
  fotoCard: {
    display: 'flex', flexDirection: 'column', gap: '6px',
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '10px', padding: '8px',
  },
  fotoThumb: { position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden' },
  fotoThumbPlaceholder: {
    background: '#0a1428', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '8px',
  },
  spinner: {
    width: '28px', height: '28px', borderRadius: '50%',
    border: '3px solid #1e3a5f', borderTopColor: '#64ffda',
    animation: 'spin-photo 0.8s linear infinite',
  },
  spinnerTexto: { color: '#8892b0', fontSize: '10px', fontWeight: 600 },
  fotoImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  btnEliminarFoto: {
    position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)',
    color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px',
    fontSize: '16px', lineHeight: '20px', cursor: 'pointer', padding: 0, textAlign: 'center',
  },
  etiquetas: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  chip: {
    background: '#0f3460', color: '#8892b0', border: '1px solid #1e3a5f',
    borderRadius: '12px', padding: '3px 8px', fontSize: '10px', fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  chipActivo: { background: '#64ffda', color: '#0a1f3a', borderColor: '#64ffda' },
  descInput: {
    width: '100%', background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '6px',
    color: '#ccd6f6', fontSize: '11px', padding: '6px 8px', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  },

  btnGuardar: {
    background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px',
    padding: '16px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
  },

  toast: {
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    background: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 200,
  },
  toastError: { background: '#ef4444' },
};
