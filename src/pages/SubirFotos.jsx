import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { useUser } from '../context/UserContext';
import { TRAMOS, CAIDAS, ATRAVIESOS } from '../constants/estructura';
import { comprimirFoto } from '../utils/comprimirFoto';
import { uploadFoto } from '../utils/uploadFoto';
import { sincronizar } from '../utils/sync';
import { supabase } from '../config/supabase';

const ETIQUETAS = ['Excavación', 'Moldaje', 'Enfierradura', 'Hormigón', 'Emplantillado', 'General'];

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };

const LISTAS = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };

export default function SubirFotos() {
  const { tipo: tipoParam, entidadId: entidadIdParam } = useParams();
  const navigate = useNavigate();
  const { usuario } = useUser();

  const [tipo, setTipo] = useState(tipoParam ?? null);
  const [entidadId, setEntidadId] = useState(entidadIdParam ?? null);
  const [pendientes, setPendientes] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);

  const inputCamaraRef = useRef(null);
  const inputGaleriaRef = useRef(null);
  const toastTimerRef = useRef(null);

  const entidadIdReal = tipo === 'caida' ? Number(entidadId) : entidadId;

  const guardadas = useLiveQuery(
    () => (tipo && entidadId != null)
      ? db.fotos_terreno.where('tipo').equals(tipo).and(f => f.entidadId === entidadIdReal).count()
      : Promise.resolve(0),
    [tipo, entidadId]
  ) ?? 0;

  function mostrarToast(msg, t = 'ok') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, tipo: t });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  async function handleCapturar(e) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const dataUrl = await comprimirFoto(file);
      setPendientes(prev => [...prev, { dataUrl, etiquetas: [], descripcion: '' }]);
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
    if (pendientes.length === 0 || guardando) return;
    setGuardando(true);
    try {
      for (const foto of pendientes) {
        const id = await db.fotos_terreno.add({
          tipo, entidadId: entidadIdReal,
          etiquetas: foto.etiquetas, descripcion: foto.descripcion,
          dataUrl: foto.dataUrl, storageUrl: null, subidaStorage: false,
          usuarioNombre: usuario, fechaCaptura: new Date().toISOString(),
          sincronizada: false,
        });

        if (supabase && navigator.onLine) {
          try {
            const storageUrl = await uploadFoto(foto.dataUrl, { tipo, entidadId: entidadIdReal, carpeta: 'terreno' });
            if (storageUrl) await db.fotos_terreno.update(id, { storageUrl, subidaStorage: true });
          } catch (err) {
            console.warn('[FotosTerreno] Error al subir a Storage:', err?.message ?? err);
          }
        }
      }

      mostrarToast(pendientes.length > 1 ? `${pendientes.length} fotos guardadas` : 'Foto guardada');
      setPendientes([]);

      if (supabase && navigator.onLine) sincronizar();
    } catch {
      mostrarToast('Error al guardar fotos', 'error');
    } finally {
      setGuardando(false);
    }
  }

  // ── Paso 1: elegir tipo de entidad ────────────────────────────────────────
  if (!tipo) {
    return (
      <div style={s.page}>
        <button style={s.btnVolver} onClick={() => navigate('/')}>← Inicio</button>
        <h1 style={s.titulo}>Subir Fotos</h1>
        <p style={s.subtitulo}>Selecciona el tipo de elemento</p>
        <div style={s.tiposGrid}>
          <button style={s.btnTipoGrande} onClick={() => setTipo('tramo')}>Tramo</button>
          <button style={s.btnTipoGrande} onClick={() => setTipo('caida')}>Caída</button>
          <button style={s.btnTipoGrande} onClick={() => setTipo('atravieso')}>Atravieso</button>
        </div>
      </div>
    );
  }

  // ── Paso 1b: elegir entidad ────────────────────────────────────────────────
  if (entidadId == null) {
    const lista = LISTAS[tipo];
    return (
      <div style={s.page}>
        <button style={s.btnVolver} onClick={() => setTipo(null)}>← Volver</button>
        <h1 style={s.titulo}>{NOMBRE_TIPO[tipo]}s</h1>
        <div style={s.entidadGrid}>
          {lista.map(id => (
            <div key={id} style={s.entidadCard} onClick={() => setEntidadId(String(id))}>
              {NOMBRE_TIPO[tipo]} {id}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Paso 2: capturar fotos ─────────────────────────────────────────────────
  return (
    <div style={s.page}>
      <button style={s.btnVolver} onClick={() => setEntidadId(null)}>← Volver</button>
      <h1 style={s.titulo}>{NOMBRE_TIPO[tipo]} {entidadId}</h1>
      <div style={s.contador}>📷 {guardadas} {guardadas === 1 ? 'foto guardada' : 'fotos guardadas'}</div>

      <input ref={inputCamaraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCapturar} />
      <input ref={inputGaleriaRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleCapturar} />

      <div style={s.botonesCaptura}>
        <button style={s.btnCapturar} onClick={() => inputCamaraRef.current?.click()}>📷 Sacar Foto</button>
        <button style={s.btnAdjuntar} onClick={() => inputGaleriaRef.current?.click()}>🖼 Adjuntar</button>
      </div>

      {pendientes.length > 0 && (
        <div style={s.grid}>
          {pendientes.map((foto, idx) => (
            <div key={idx} style={s.fotoCard}>
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
      )}

      {pendientes.length > 0 && (
        <button style={s.btnGuardar} onClick={guardarTodo} disabled={guardando}>
          {guardando ? 'Guardando...' : `Guardar todo (${pendientes.length})`}
        </button>
      )}

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
  subtitulo: { color: '#8892b0', fontSize: '13px', margin: 0 },

  tiposGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
  btnTipoGrande: {
    background: '#16213e', color: '#ccd6f6', border: '1px solid #0f3460',
    borderRadius: '12px', padding: '20px 18px', fontSize: '17px', fontWeight: 700,
    cursor: 'pointer', textAlign: 'left',
  },

  entidadGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px',
  },
  entidadCard: {
    background: '#16213e', borderRadius: '10px', padding: '16px',
    border: '1px solid #0f3460', cursor: 'pointer',
    color: '#ccd6f6', fontWeight: 600, fontSize: '14px', textAlign: 'center',
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
