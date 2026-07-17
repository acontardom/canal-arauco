import { useState, useEffect, useMemo } from 'react';
import { db } from '../db/database';
import { supabase } from '../config/supabase';
import { eliminarFotoStorage } from '../utils/uploadFoto';
import { useAuth } from '../hooks/useAuth';
import { formatearFecha, formatearFechaLarga } from '../utils/fecha';
import { TRAMOS, CAIDAS, ATRAVIESOS } from '../constants/estructura';

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const LISTAS = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };
const ETIQUETAS = ['Excavación', 'Moldaje', 'Enfierradura', 'Hormigón', 'Emplantillado', 'General'];

const FILTROS_INICIAL = {
  entidadTipo: '',
  entidadId: '',
  etiqueta: '',
  fechaDesde: '',
  fechaHasta: '',
  usuario: '',
};

function mapRemoto(r) {
  return {
    id: r.id,
    localId: r.local_id ?? null,
    tipo: r.tipo,
    entidadId: r.tipo === 'caida' ? Number(r.entidad_id) : r.entidad_id,
    etiquetas: r.etiquetas ?? [],
    descripcion: r.descripcion ?? '',
    storageUrl: r.storage_url ?? null,
    dataUrl: null,
    usuarioNombre: r.usuario_nombre ?? null,
    fechaCaptura: r.fecha_captura ?? '',
    origen: 'remoto',
  };
}

function mapLocal(f) {
  return {
    id: `local-${f.id}`,
    localId: f.id,
    tipo: f.tipo,
    entidadId: f.entidadId,
    etiquetas: f.etiquetas ?? [],
    descripcion: f.descripcion ?? '',
    storageUrl: f.storageUrl ?? null,
    dataUrl: f.dataUrl ?? null,
    usuarioNombre: f.usuarioNombre ?? null,
    fechaCaptura: f.fechaCaptura ?? '',
    origen: 'local',
  };
}

function imgSrc(f) {
  return f.storageUrl || f.dataUrl || '';
}

function nombreEntidad(f) {
  return `${NOMBRE_TIPO[f.tipo] ?? f.tipo} ${f.entidadId}`;
}

const fechaKey = s => s?.substring(0, 10) ?? '';
const formatFechaCorta = formatearFecha;

export default function Galeria() {
  const { usuario: usuarioAuth } = useAuth();
  const [fotos, setFotos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reintento, setReintento] = useState(0);
  const [vista, setVista] = useState('entidad');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtros, setFiltros] = useState(FILTROS_INICIAL);
  const [modal, setModal] = useState(null);
  const [editEtiquetas, setEditEtiquetas] = useState([]);
  const [editDescripcion, setEditDescripcion] = useState('');
  const [moveTipo, setMoveTipo] = useState('tramo');
  const [moveEntidadId, setMoveEntidadId] = useState('');
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    let activo = true;

    async function cargarLocal() {
      const locales = await db.fotos_terreno.toArray();
      locales.sort((a, b) => (b.fechaCaptura ?? '').localeCompare(a.fechaCaptura ?? ''));
      if (activo) setFotos(locales.map(mapLocal));
    }

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        if (supabase && navigator.onLine) {
          let ultimoError = null;
          for (let intento = 1; intento <= 3; intento++) {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000));
            const consulta = supabase
              .from('fotos_terreno')
              .select('id, local_id, tipo, entidad_id, etiquetas, descripcion, storage_url, usuario_nombre, fecha_captura')
              .order('fecha_captura', { ascending: false });
            try {
              const { data, error: err } = await Promise.race([consulta, timeout]);
              if (err) throw err;
              if (activo) setFotos((data ?? []).map(mapRemoto));
              ultimoError = null;
              break;
            } catch (err) {
              ultimoError = err;
              if (intento < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
          if (ultimoError) throw ultimoError;
        } else {
          await cargarLocal();
        }
      } catch {
        try {
          await cargarLocal();
        } catch {
          if (activo) setError('No se pudo cargar la galería de fotos');
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();
    return () => { activo = false; };
  }, [reintento]);

  function setFiltro(campo, valor) {
    setFiltros(prev => {
      const next = { ...prev, [campo]: valor };
      if (campo === 'entidadTipo') next.entidadId = '';
      return next;
    });
  }

  const filtrosActivos = Object.values(filtros).filter(Boolean).length;

  const usuariosDisponibles = useMemo(() => {
    const set = new Set();
    for (const f of fotos) if (f.usuarioNombre) set.add(f.usuarioNombre);
    return [...set].sort();
  }, [fotos]);

  const filtrados = useMemo(() => {
    return fotos.filter(f => {
      if (filtros.entidadTipo && f.tipo !== filtros.entidadTipo) return false;
      if (filtros.entidadId && String(f.entidadId) !== String(filtros.entidadId)) return false;
      if (filtros.etiqueta && !(f.etiquetas ?? []).includes(filtros.etiqueta)) return false;
      if (filtros.usuario && f.usuarioNombre !== filtros.usuario) return false;
      const key = fechaKey(f.fechaCaptura);
      if (filtros.fechaDesde && key < filtros.fechaDesde) return false;
      if (filtros.fechaHasta && key > filtros.fechaHasta) return false;
      return true;
    });
  }, [fotos, filtros]);

  const grupos = useMemo(() => {
    const map = new Map();

    if (vista === 'fecha') {
      for (const f of filtrados) {
        const key = fechaKey(f.fechaCaptura);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(f);
      }
      return [...map.entries()].map(([key, items]) => ({
        key,
        titulo: key ? formatearFechaLarga(items[0].fechaCaptura) : 'Sin fecha',
        items,
      }));
    }

    for (const f of filtrados) {
      const key = `${f.tipo}-${f.entidadId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(f);
    }
    return [...map.entries()].map(([key, items]) => {
      const f = items[0];
      return {
        key,
        titulo: `${nombreEntidad(f)} — ${items.length} ${items.length === 1 ? 'foto' : 'fotos'}`,
        items,
      };
    });
  }, [filtrados, vista]);

  function abrirModal(grupoKey, indice) {
    setModal({ grupoKey, indice, editando: false, moviendo: false });
  }

  function cerrarModal() {
    setModal(null);
  }

  const grupoActual = modal ? grupos.find(g => g.key === modal.grupoKey) : null;
  const fotoActual = grupoActual ? grupoActual.items[modal.indice] : null;

  function navegar(delta) {
    if (!grupoActual) return;
    const len = grupoActual.items.length;
    setModal(m => ({ ...m, indice: (m.indice + delta + len) % len, editando: false, moviendo: false }));
  }

  function iniciarEdicion() {
    setEditEtiquetas(fotoActual.etiquetas ?? []);
    setEditDescripcion(fotoActual.descripcion ?? '');
    setModal(m => ({ ...m, editando: true, moviendo: false }));
  }

  function toggleEtiqueta(et) {
    setEditEtiquetas(prev => prev.includes(et) ? prev.filter(e => e !== et) : [...prev, et]);
  }

  function iniciarMovimiento() {
    setMoveTipo(fotoActual.tipo);
    setMoveEntidadId(String(fotoActual.entidadId));
    setModal(m => ({ ...m, moviendo: true, editando: false }));
  }

  async function actualizarFoto(foto, cambiosRemoto, cambiosLocal) {
    if (supabase && foto.origen === 'remoto') {
      const { error: err } = await supabase.from('fotos_terreno').update(cambiosRemoto).eq('id', foto.id);
      if (err) throw err;
    }
    if (foto.localId != null) {
      await db.fotos_terreno.update(foto.localId, cambiosLocal);
    }
  }

  async function guardarEdicion() {
    try {
      await actualizarFoto(
        fotoActual,
        { etiquetas: editEtiquetas, descripcion: editDescripcion },
        { etiquetas: editEtiquetas, descripcion: editDescripcion },
      );
      setFotos(prev => prev.map(f => f.id === fotoActual.id
        ? { ...f, etiquetas: editEtiquetas, descripcion: editDescripcion }
        : f));
      setModal(m => ({ ...m, editando: false }));
    } catch (err) {
      alert('No se pudo guardar la edición: ' + (err?.message ?? err));
    }
  }

  async function guardarMovimiento() {
    try {
      const entidadIdLocal = moveTipo === 'caida' ? Number(moveEntidadId) : moveEntidadId;
      await actualizarFoto(
        fotoActual,
        { tipo: moveTipo, entidad_id: String(moveEntidadId) },
        { tipo: moveTipo, entidadId: entidadIdLocal },
      );
      setFotos(prev => prev.map(f => f.id === fotoActual.id
        ? { ...f, tipo: moveTipo, entidadId: entidadIdLocal }
        : f));
      setModal(null);
    } catch (err) {
      alert('No se pudo mover la foto: ' + (err?.message ?? err));
    }
  }

  async function eliminarSeleccionadas() {
    if (!window.confirm(`¿Eliminar ${seleccionadas.size} foto${seleccionadas.size === 1 ? '' : 's'}? Esta acción no se puede deshacer.`)) return;
    setEliminando(true);
    try {
      const fotosAEliminar = fotos.filter(f => seleccionadas.has(f.id));
      for (const foto of fotosAEliminar) {
        if (foto.storageUrl) {
          const marker = '/fotos-canal-arauco/';
          const idx = foto.storageUrl.indexOf(marker);
          if (idx !== -1) {
            const path = decodeURIComponent(foto.storageUrl.slice(idx + marker.length));
            await supabase.storage.from('fotos-canal-arauco').remove([path]);
          }
        }
        if (foto.origen === 'remoto') {
          await supabase.from('fotos_terreno').delete().eq('id', foto.id);
        }
        if (foto.localId != null) {
          await db.fotos_terreno.delete(foto.localId);
        }
      }
    } finally {
      setSeleccionadas(new Set());
      setModoSeleccion(false);
      setEliminando(false);
      setReintento(r => r + 1);
    }
  }

  async function eliminarFoto() {
    if (!window.confirm('¿Eliminar esta foto? Esta acción no se puede deshacer.')) return;
    try {
      if (supabase && fotoActual.origen === 'remoto') {
        const { error: err } = await supabase.from('fotos_terreno').delete().eq('id', fotoActual.id);
        if (err) throw err;
      }
      if (fotoActual.storageUrl) {
        await eliminarFotoStorage(fotoActual.storageUrl);
      }
      if (fotoActual.localId != null) {
        await db.fotos_terreno.delete(fotoActual.localId);
      }
      setFotos(prev => prev.filter(f => f.id !== fotoActual.id));
      setModal(null);
    } catch (err) {
      alert('No se pudo eliminar la foto: ' + (err?.message ?? err));
    }
  }

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Galería de Fotos</h1>

      <div style={s.filtrosHeader}>
        <button style={s.btnFiltros} onClick={() => setFiltrosAbiertos(o => !o)}>
          Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ''} {filtrosAbiertos ? '▲' : '▼'}
        </button>
        {filtrosActivos > 0 && (
          <button style={s.btnLimpiar} onClick={() => setFiltros(FILTROS_INICIAL)}>Limpiar filtros</button>
        )}
        {usuarioAuth?.rol === 'admin' && (
          <button
            style={modoSeleccion ? s.btnCancelarSeleccion : s.btnSeleccion}
            onClick={() => { setModoSeleccion(o => !o); setSeleccionadas(new Set()); }}
          >
            {modoSeleccion ? '✕ Cancelar selección' : '☑ Seleccionar'}
          </button>
        )}
      </div>

      {filtrosAbiertos && (
        <div style={s.filtrosPanel}>
          <div style={s.campo}>
            <label style={s.label}>Tipo de entidad</label>
            <select style={s.input} value={filtros.entidadTipo} onChange={e => setFiltro('entidadTipo', e.target.value)}>
              <option value="">Todos</option>
              <option value="tramo">Tramo</option>
              <option value="caida">Caída</option>
              <option value="atravieso">Atravieso</option>
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Entidad</label>
            <select style={s.input} value={filtros.entidadId} onChange={e => setFiltro('entidadId', e.target.value)} disabled={!filtros.entidadTipo}>
              <option value="">Todas</option>
              {(LISTAS[filtros.entidadTipo] ?? []).map(id => (
                <option key={id} value={id}>{NOMBRE_TIPO[filtros.entidadTipo]} {id}</option>
              ))}
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Etiqueta</label>
            <select style={s.input} value={filtros.etiqueta} onChange={e => setFiltro('etiqueta', e.target.value)}>
              <option value="">Todas</option>
              {ETIQUETAS.map(et => <option key={et} value={et}>{et}</option>)}
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Usuario</label>
            <select style={s.input} value={filtros.usuario} onChange={e => setFiltro('usuario', e.target.value)}>
              <option value="">Todos</option>
              {usuariosDisponibles.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Fecha desde</label>
            <input style={s.input} type="date" value={filtros.fechaDesde} onChange={e => setFiltro('fechaDesde', e.target.value)} />
          </div>
          <div style={s.campo}>
            <label style={s.label}>Fecha hasta</label>
            <input style={s.input} type="date" value={filtros.fechaHasta} onChange={e => setFiltro('fechaHasta', e.target.value)} />
          </div>
        </div>
      )}

      <div style={s.resumenRow}>
        <span style={s.contador}>{filtrados.length} foto{filtrados.length === 1 ? '' : 's'} encontrada{filtrados.length === 1 ? '' : 's'}</span>

        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(vista === 'entidad' ? s.tabActivo : {}) }} onClick={() => setVista('entidad')}>Por Entidad</button>
          <button style={{ ...s.tab, ...(vista === 'fecha' ? s.tabActivo : {}) }} onClick={() => setVista('fecha')}>Por Fecha</button>
        </div>
      </div>

      {cargando && <p style={s.mensaje}>Cargando fotos...</p>}
      {error && (
        <div style={s.errorBox}>
          <p style={s.mensajeError}>{error}</p>
          <button style={s.btnReintentar} onClick={() => setReintento(r => r + 1)}>🔄 Reintentar</button>
        </div>
      )}

      {!cargando && !error && grupos.length === 0 && (
        <p style={s.mensaje}>No se encontraron fotos con estos filtros.</p>
      )}

      {!cargando && !error && grupos.map(grupo => (
        <div key={grupo.key} style={s.grupo}>
          <h2 style={s.grupoTitulo}>{grupo.titulo}</h2>
          <div className="galeria-grid">
            {grupo.items.map((f, i) => {
              const estaSeleccionada = seleccionadas.has(f.id);
              return (
                <div
                  key={f.id}
                  className="galeria-thumb"
                  style={modoSeleccion && estaSeleccionada ? { outline: '3px solid #22c55e', outlineOffset: '-3px' } : undefined}
                  onClick={() => {
                    if (modoSeleccion) {
                      setSeleccionadas(prev => {
                        const next = new Set(prev);
                        if (next.has(f.id)) next.delete(f.id);
                        else next.add(f.id);
                        return next;
                      });
                    } else {
                      abrirModal(grupo.key, i);
                    }
                  }}
                >
                  <img
                    src={imgSrc(f)}
                    alt=""
                    loading="lazy"
                    style={{ backgroundColor: '#2a2a3e', minHeight: '80px', width: '100%', display: 'block' }}
                    onError={e => { e.target.style.opacity = '0.3'; }}
                  />
                  <div className="galeria-overlay">
                    <span>{f.usuarioNombre || 'Sin usuario'}</span>
                    <span>{formatFechaCorta(f.fechaCaptura) || 'Sin fecha'}</span>
                    {f.etiquetas.length > 0 && <span>{f.etiquetas.join(', ')}</span>}
                  </div>
                  {modoSeleccion && estaSeleccionada && (
                    <div style={s.seleccionOverlay}>✓</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {modoSeleccion && seleccionadas.size > 0 && (
        <div style={s.barraFlotante}>
          <span style={{ color: '#ccd6f6', fontSize: '14px', fontWeight: 600 }}>
            {seleccionadas.size} foto{seleccionadas.size === 1 ? '' : 's'} seleccionada{seleccionadas.size === 1 ? '' : 's'}
          </span>
          <button style={s.btnEliminarLote} onClick={eliminarSeleccionadas} disabled={eliminando}>
            {eliminando ? 'Eliminando...' : '🗑 Eliminar seleccionadas'}
          </button>
        </div>
      )}

      {modal && fotoActual && (
        <div style={s.modalOverlay} onClick={cerrarModal}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <button style={s.modalCerrar} onClick={cerrarModal}>✕</button>

            <div style={s.modalImgWrap}>
              {grupoActual.items.length > 1 && (
                <button style={{ ...s.navBtn, left: '8px' }} onClick={() => navegar(-1)}>‹</button>
              )}
              <img src={imgSrc(fotoActual)} alt="" style={s.modalImg} />
              {grupoActual.items.length > 1 && (
                <button style={{ ...s.navBtn, right: '8px' }} onClick={() => navegar(1)}>›</button>
              )}
            </div>

            {!modal.editando && !modal.moviendo && (
              <div style={s.modalInfo}>
                <p style={s.modalLinea}><strong>Entidad:</strong> {nombreEntidad(fotoActual)}</p>
                <p style={s.modalLinea}><strong>Etiquetas:</strong> {fotoActual.etiquetas.length > 0 ? fotoActual.etiquetas.join(', ') : '—'}</p>
                <p style={s.modalLinea}><strong>Descripción:</strong> {fotoActual.descripcion || '—'}</p>
                <p style={s.modalLinea}><strong>Usuario:</strong> {fotoActual.usuarioNombre || '—'}</p>
                <p style={s.modalLinea}><strong>Fecha:</strong> {formatFechaCorta(fotoActual.fechaCaptura)}</p>

                <div style={s.modalAcciones}>
                  <button style={s.btnAccion} onClick={iniciarEdicion}>✏️ Editar</button>
                  <button style={s.btnAccion} onClick={iniciarMovimiento}>📍 Mover a otra entidad</button>
                  <button style={s.btnEliminar} onClick={eliminarFoto}>🗑️ Eliminar</button>
                </div>
              </div>
            )}

            {modal.editando && (
              <div style={s.modalInfo}>
                <label style={s.label}>Etiquetas</label>
                <div style={s.chips}>
                  {ETIQUETAS.map(et => (
                    <button
                      key={et}
                      style={{ ...s.chip, ...(editEtiquetas.includes(et) ? s.chipActivo : {}) }}
                      onClick={() => toggleEtiqueta(et)}
                    >{et}</button>
                  ))}
                </div>
                <label style={s.label}>Descripción</label>
                <textarea style={s.textarea} rows={3} value={editDescripcion} onChange={e => setEditDescripcion(e.target.value)} />
                <div style={s.modalAcciones}>
                  <button style={s.btnAccion} onClick={guardarEdicion}>Guardar</button>
                  <button style={s.btnCancelar} onClick={() => setModal(m => ({ ...m, editando: false }))}>Cancelar</button>
                </div>
              </div>
            )}

            {modal.moviendo && (
              <div style={s.modalInfo}>
                <label style={s.label}>Tipo de entidad</label>
                <select style={s.input} value={moveTipo} onChange={e => { setMoveTipo(e.target.value); setMoveEntidadId(''); }}>
                  <option value="tramo">Tramo</option>
                  <option value="caida">Caída</option>
                  <option value="atravieso">Atravieso</option>
                </select>
                <label style={s.label}>Entidad</label>
                <select style={s.input} value={moveEntidadId} onChange={e => setMoveEntidadId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {(LISTAS[moveTipo] ?? []).map(id => (
                    <option key={id} value={id}>{NOMBRE_TIPO[moveTipo]} {id}</option>
                  ))}
                </select>
                <div style={s.modalAcciones}>
                  <button style={s.btnAccion} disabled={!moveEntidadId} onClick={guardarMovimiento}>Guardar</button>
                  <button style={s.btnCancelar} onClick={() => setModal(m => ({ ...m, moviendo: false }))}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' },
  titulo: { color: '#ccd6f6', fontSize: '22px', fontWeight: 700, margin: 0 },

  filtrosHeader: { display: 'flex', gap: '10px', alignItems: 'center' },
  btnFiltros: {
    background: '#16213e', color: '#ccd6f6', border: '1px solid #0f3460',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  btnLimpiar: {
    background: 'transparent', color: '#8892b0', border: '1px solid #0f3460',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },

  filtrosPanel: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px',
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '12px', padding: '16px',
  },
  campo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#8892b0', fontSize: '12px', fontWeight: 600 },
  input: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '13px', padding: '9px 10px', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },

  resumenRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
  contador: { color: '#8892b0', fontSize: '13px', fontWeight: 600 },

  tabs: { display: 'flex', gap: '8px' },
  tab: {
    background: 'transparent', border: '1px solid #0f3460', color: '#8892b0',
    padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', borderRadius: '8px',
  },
  tabActivo: { color: '#0a1f3a', background: '#64ffda', borderColor: '#64ffda' },

  mensaje: { color: '#8892b0', fontSize: '14px', textAlign: 'center', padding: '24px 0' },
  mensajeError: { color: '#ef4444', fontSize: '14px', textAlign: 'center', margin: 0 },
  errorBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '24px 0' },
  btnReintentar: {
    background: '#16213e', color: '#ccd6f6', border: '1px solid #0f3460',
    borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },

  grupo: { display: 'flex', flexDirection: 'column', gap: '10px' },
  grupoTitulo: { color: '#64ffda', fontSize: '15px', fontWeight: 700, margin: 0 },

  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '16px', zIndex: 1000,
  },
  modalContent: {
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '14px',
    maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
    position: 'relative', display: 'flex', flexDirection: 'column',
  },
  modalCerrar: {
    position: 'absolute', top: '10px', right: '10px', zIndex: 2,
    background: 'rgba(10,31,58,0.8)', color: '#ccd6f6', border: 'none',
    borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalImgWrap: {
    position: 'relative', background: '#0a1f3a', display: 'flex',
    alignItems: 'center', justifyContent: 'center', borderRadius: '14px 14px 0 0', overflow: 'hidden',
  },
  modalImg: { width: '100%', maxHeight: '50vh', objectFit: 'contain', display: 'block' },
  navBtn: {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(10,31,58,0.7)', color: '#ccd6f6', border: 'none',
    borderRadius: '50%', width: '36px', height: '36px', fontSize: '20px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalInfo: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  modalLinea: { color: '#ccd6f6', fontSize: '13px', margin: 0 },
  modalAcciones: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
  btnAccion: {
    background: '#0f3460', color: '#ccd6f6', border: '1px solid #1e3a5f',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  btnCancelar: {
    background: 'transparent', color: '#8892b0', border: '1px solid #0f3460',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  btnEliminar: {
    background: '#e74c3c33', color: '#e74c3c', border: '1px solid #e74c3c55',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  btnSeleccion: {
    background: '#16213e', color: '#64ffda', border: '1px solid #64ffda',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  btnCancelarSeleccion: {
    background: '#16213e', color: '#8892b0', border: '1px solid #0f3460',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
  seleccionOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: '28px', fontWeight: 700, pointerEvents: 'none',
  },
  barraFlotante: {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    background: '#16213e', border: '1px solid #0f3460', borderRadius: '14px',
    padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '16px',
    zIndex: 999, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
  },
  btnEliminarLote: {
    background: '#e74c3c33', color: '#e74c3c', border: '1px solid #e74c3c',
    borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  chip: {
    background: 'transparent', color: '#8892b0', border: '1px solid #0f3460',
    borderRadius: '999px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  },
  chipActivo: { color: '#0a1f3a', background: '#64ffda', borderColor: '#64ffda' },
  textarea: {
    background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '7px',
    color: '#ccd6f6', fontSize: '13px', padding: '9px 10px', fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical',
  },
};
