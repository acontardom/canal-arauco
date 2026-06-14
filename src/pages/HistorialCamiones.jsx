import { useState, useEffect, useMemo } from 'react';
import { db } from '../db/database';
import { supabase } from '../config/supabase';
import { TRAMOS, CAIDAS, ATRAVIESOS } from '../constants/estructura';

const NOMBRE_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const LISTAS = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };
const USO_LABEL = { radier: 'Radier', muro: 'Muro', otro: 'Otro' };
const PLANTAS = ['Membrillar', 'Quilanco', 'Río San Martín'];
const TIPOS_HORMIGON = ['G5', 'G20', 'G25', 'G30'];

const FILTROS_INICIAL = {
  entidadTipo: '',
  entidadId: '',
  uso: '',
  fechaDesde: '',
  fechaHasta: '',
  planta: '',
  estado: '',
  tipoHormigon: '',
};

function mapRemoto(r) {
  return {
    id: r.id,
    tipoEntidad: r.tipo_entidad,
    entidadId: r.tipo_entidad === 'caida' ? Number(r.entidad_id) : r.entidad_id,
    tipoHormigon: r.tipo_hormigon,
    usoHormigon: r.uso_hormigon ?? null,
    volumen: r.volumen ?? '',
    numeroGuia: r.numero_guia ?? '',
    planta: r.planta ?? '',
    cono: r.cono ?? '',
    tempHormigon: r.temp_hormigon ?? '',
    tempAmbiente: r.temp_ambiente ?? '',
    horaCarga: r.hora_carga ?? '',
    horaDescarga: r.hora_descarga ?? '',
    tiempoTraslado: r.tiempo_traslado ?? '',
    puCalculado: r.pu_calculado ?? '',
    observaciones: r.observaciones ?? '',
    usuarioNombre: r.usuario_nombre ?? null,
    fechaRecepcion: r.fecha_recepcion ?? '',
    estadoCalidad: r.estado_calidad ?? null,
    fotoGuiaUrl: r.foto_guia_url ?? null,
    fotosEnsayoUrls: r.fotos_ensayo_urls ?? [],
  };
}

function fechaKey(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatFechaLarga(iso) {
  const d = new Date(iso);
  const partes = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).formatToParts(d);
  const get = tipo => partes.find(p => p.type === tipo)?.value ?? '';
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(get('weekday'))} ${get('day')} de ${cap(get('month'))} ${get('year')}`;
}

export default function HistorialCamiones() {
  const [camiones, setCamiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState('fecha');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtros, setFiltros] = useState(FILTROS_INICIAL);
  const [expandidoId, setExpandidoId] = useState(null);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    let activo = true;

    async function cargarLocal() {
      const locales = await db.camiones.orderBy('fechaRecepcion').reverse().toArray();
      if (activo) setCamiones(locales);
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
              .from('camiones')
              .select('id, local_id, tipo_entidad, entidad_id, entidad_secundaria_tipo, entidad_secundaria_id, tipo_hormigon, volumen, numero_guia, planta, cono, temp_hormigon, temp_ambiente, hora_carga, hora_descarga, tiempo_traslado, peso_hoya_hormigon, pu_calculado, observaciones, usuario_nombre, fecha_recepcion, uso_hormigon, estado_calidad, foto_guia_url, fotos_ensayo_urls, created_at')
              .order('fecha_recepcion', { ascending: false });
            try {
              const { data, error: err } = await Promise.race([consulta, timeout]);
              console.log(`[Historial] Intento ${intento} — Error completo:`, JSON.stringify(err, null, 2));
              console.log(`[Historial] Intento ${intento} — Data:`, data);
              if (err) throw err;
              if (activo) setCamiones((data ?? []).map(mapRemoto));
              ultimoError = null;
              break;
            } catch (err) {
              ultimoError = err;
              console.log(`[Historial] Intento ${intento} falló:`, err?.message ?? err);
              if (intento < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
          if (ultimoError) throw ultimoError;
        } else {
          await cargarLocal();
        }
      } catch (err) {
        try {
          await cargarLocal();
        } catch {
          if (activo) setError('No se pudo cargar el historial de camiones');
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

  const filtrados = useMemo(() => {
    return camiones.filter(c => {
      if (filtros.entidadTipo && c.tipoEntidad !== filtros.entidadTipo) return false;
      if (filtros.entidadId && String(c.entidadId) !== String(filtros.entidadId)) return false;
      if (filtros.uso && c.usoHormigon !== filtros.uso) return false;
      if (filtros.planta && c.planta !== filtros.planta) return false;
      if (filtros.estado && c.estadoCalidad !== filtros.estado) return false;
      if (filtros.tipoHormigon && c.tipoHormigon !== filtros.tipoHormigon) return false;
      const key = fechaKey(c.fechaRecepcion);
      if (filtros.fechaDesde && key < filtros.fechaDesde) return false;
      if (filtros.fechaHasta && key > filtros.fechaHasta) return false;
      return true;
    });
  }, [camiones, filtros]);

  const grupos = useMemo(() => {
    const map = new Map();

    if (vista === 'fecha') {
      for (const c of filtrados) {
        const key = fechaKey(c.fechaRecepcion);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(c);
      }
      return [...map.entries()].map(([key, items]) => ({
        key,
        titulo: key ? formatFechaLarga(items[0].fechaRecepcion) : 'Sin fecha',
        items,
      }));
    }

    for (const c of filtrados) {
      const key = `${c.tipoEntidad}-${c.entidadId}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }
    return [...map.entries()].map(([key, items]) => {
      const c = items[0];
      const nombre = `${NOMBRE_TIPO[c.tipoEntidad] ?? c.tipoEntidad} ${c.entidadId}`;
      return {
        key,
        titulo: `${nombre} — ${items.length} ${items.length === 1 ? 'camión' : 'camiones'}`,
        items,
      };
    });
  }, [filtrados, vista]);

  return (
    <div style={s.page}>
      <h1 style={s.titulo}>Historial de Camiones</h1>

      <div style={s.filtrosHeader}>
        <button style={s.btnFiltros} onClick={() => setFiltrosAbiertos(o => !o)}>
          Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ''} {filtrosAbiertos ? '▲' : '▼'}
        </button>
        {filtrosActivos > 0 && (
          <button style={s.btnLimpiar} onClick={() => setFiltros(FILTROS_INICIAL)}>Limpiar filtros</button>
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
            <label style={s.label}>Uso del hormigón</label>
            <select style={s.input} value={filtros.uso} onChange={e => setFiltro('uso', e.target.value)}>
              <option value="">Todos</option>
              <option value="radier">Radier</option>
              <option value="muro">Muro</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Tipo hormigón</label>
            <select style={s.input} value={filtros.tipoHormigon} onChange={e => setFiltro('tipoHormigon', e.target.value)}>
              <option value="">Todos</option>
              {TIPOS_HORMIGON.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Planta</label>
            <select style={s.input} value={filtros.planta} onChange={e => setFiltro('planta', e.target.value)}>
              <option value="">Todas</option>
              {PLANTAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={s.campo}>
            <label style={s.label}>Estado de calidad</label>
            <select style={s.input} value={filtros.estado} onChange={e => setFiltro('estado', e.target.value)}>
              <option value="">Todos</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
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
        <span style={s.contador}>{filtrados.length} {filtrados.length === 1 ? 'camión' : 'camiones'} encontrado{filtrados.length === 1 ? '' : 's'}</span>

        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(vista === 'fecha' ? s.tabActivo : {}) }} onClick={() => setVista('fecha')}>Por Fecha</button>
          <button style={{ ...s.tab, ...(vista === 'entidad' ? s.tabActivo : {}) }} onClick={() => setVista('entidad')}>Por Entidad</button>
        </div>
      </div>

      {cargando && <p style={s.mensaje}>Cargando historial...</p>}
      {error && (
        <div style={s.errorBox}>
          <p style={s.mensajeError}>{error}</p>
          <button style={s.btnReintentar} onClick={() => setReintento(r => r + 1)}>🔄 Reintentar</button>
        </div>
      )}

      {!cargando && !error && grupos.length === 0 && (
        <p style={s.mensaje}>No se encontraron camiones con estos filtros.</p>
      )}

      {!cargando && !error && grupos.map(grupo => (
        <div key={grupo.key} style={s.grupo}>
          <h2 style={s.grupoTitulo}>{grupo.titulo}</h2>
          <div className="camiones-grid">
            {grupo.items.map(c => (
              <CamionCard
                key={c.id}
                camion={c}
                expandido={expandidoId === c.id}
                onToggle={() => setExpandidoId(prev => prev === c.id ? null : c.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CamionCard({ camion: c, expandido, onToggle }) {
  const [fotoModal, setFotoModal] = useState(null);

  const tieneEstado = c.estadoCalidad === 'aprobado' || c.estadoCalidad === 'rechazado';
  const aprobado = c.estadoCalidad === 'aprobado';
  const esG5 = c.tipoHormigon === 'G5';

  let badge = null;
  if (esG5) {
    badge = { texto: 'Sin control', estilo: s.badgeNeutro };
  } else if (aprobado) {
    badge = { texto: 'Aprobado', estilo: s.badgeAprobado };
  } else if (c.estadoCalidad === 'rechazado') {
    badge = { texto: 'Rechazado', estilo: s.badgeRechazado };
  }

  const fotosEnsayo = c.fotosEnsayoUrls ?? [];
  const tieneFotos = Boolean(c.fotoGuiaUrl) || fotosEnsayo.length > 0;

  function abrirFoto(e, url) {
    e.stopPropagation();
    setFotoModal(url);
  }

  return (
    <div
      style={{
        ...s.card,
        borderTopColor: tieneEstado ? (aprobado ? '#10b981' : '#ef4444') : '#0f3460',
        ...(expandido ? s.cardExpandido : {}),
      }}
      onClick={onToggle}
    >
      {badge && (
        <span style={{ ...s.badge, ...badge.estilo }}>{badge.texto}</span>
      )}

      <p style={s.cardHeader}>{c.planta || 'Sin planta'} — Guía {c.numeroGuia || '—'}</p>

      <div style={s.cardBody}>
        <p style={s.cardLinea}>
          Tipo hormigón: <strong>{c.tipoHormigon}</strong>{c.volumen && ` — ${c.volumen} m³`}
        </p>
        <p style={s.cardLinea}>
          Entidad: <strong>{NOMBRE_TIPO[c.tipoEntidad] ?? c.tipoEntidad} {c.entidadId}</strong>
          {c.usoHormigon && ` — ${USO_LABEL[c.usoHormigon] ?? c.usoHormigon}`}
        </p>
        {c.cono && <p style={s.cardLinea}>Cono: {c.cono} cm</p>}
        {(c.tempHormigon || c.tempAmbiente) && (
          <p style={s.cardLinea}>Temperatura: {c.tempHormigon || '—'}°C / {c.tempAmbiente || '—'}°C</p>
        )}
        {c.puCalculado && (
          <p style={s.cardLinea}>PU: <strong>{Number(c.puCalculado).toLocaleString('es-CL')} kg/m³</strong></p>
        )}
        {(c.horaCarga || c.horaDescarga) && (
          <p style={s.cardLinea}>Hora carga → descarga: {c.horaCarga || '—'} → {c.horaDescarga || '—'}</p>
        )}
      </div>

      {expandido && (
        <div style={s.expandido}>
          {c.tiempoTraslado && <p style={s.cardLinea}>Tiempo de traslado: {c.tiempoTraslado} min</p>}
          {c.observaciones && <p style={s.observaciones}>Observaciones: {c.observaciones}</p>}

          {tieneFotos ? (
            <>
              {c.fotoGuiaUrl && (
                <div style={s.fotoSeccion}>
                  <span style={s.fotoSeccionTitulo}>Foto guía de despacho</span>
                  <img
                    src={c.fotoGuiaUrl}
                    alt="Guía de despacho"
                    style={s.fotoThumb}
                    onClick={e => abrirFoto(e, c.fotoGuiaUrl)}
                  />
                </div>
              )}
              {fotosEnsayo.length > 0 && (
                <div style={s.fotoSeccion}>
                  <span style={s.fotoSeccionTitulo}>Fotos del ensayo</span>
                  <div style={s.fotosGrid}>
                    {fotosEnsayo.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Ensayo ${i + 1}`}
                        style={s.fotoThumb}
                        onClick={e => abrirFoto(e, url)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={s.sinFotos}>Fotos no disponibles para este registro</p>
          )}
        </div>
      )}

      {fotoModal && (
        <div style={s.fotoModalOverlay} onClick={e => { e.stopPropagation(); setFotoModal(null); }}>
          <img src={fotoModal} alt="" style={s.fotoModalImg} onClick={e => e.stopPropagation()} />
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
  errorBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '24px 0',
  },
  btnReintentar: {
    background: '#16213e', color: '#ccd6f6', border: '1px solid #0f3460',
    borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },

  grupo: { display: 'flex', flexDirection: 'column', gap: '12px' },
  grupoTitulo: { color: '#64ffda', fontSize: '15px', fontWeight: 700, margin: 0 },

  card: {
    position: 'relative', background: '#16213e', border: '1px solid #0f3460',
    borderTop: '4px solid #0f3460', borderRadius: '12px', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer',
  },
  cardExpandido: { gridColumn: '1 / -1' },
  badge: {
    position: 'absolute', top: '10px', right: '12px', fontSize: '11px', fontWeight: 700,
    borderRadius: '6px', padding: '4px 8px',
  },
  badgeAprobado: { background: '#27ae6033', color: '#27ae60' },
  badgeRechazado: { background: '#e74c3c33', color: '#e74c3c' },
  badgeNeutro: { background: '#8892b033', color: '#8892b0' },

  cardHeader: { color: '#ccd6f6', fontSize: '14px', fontWeight: 700, margin: '0 36px 4px 0' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: '4px' },
  cardLinea: { color: '#8892b0', fontSize: '12px', margin: 0 },

  expandido: { marginTop: '8px', paddingTop: '10px', borderTop: '1px solid #0f3460', display: 'flex', flexDirection: 'column', gap: '8px' },
  observaciones: { color: '#ccd6f6', fontSize: '12px', fontStyle: 'italic', margin: 0 },
  sinFotos: { color: '#8892b0', fontSize: '12px', margin: 0 },

  fotoSeccion: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fotoSeccionTitulo: { color: '#8892b0', fontSize: '11px', fontWeight: 600 },
  fotosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' },
  fotoThumb: {
    width: '100%', maxWidth: '160px', aspectRatio: '1', objectFit: 'cover',
    borderRadius: '8px', display: 'block', cursor: 'pointer',
  },

  fotoModalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px', zIndex: 1000, cursor: 'pointer',
  },
  fotoModalImg: {
    maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
    borderRadius: '8px', cursor: 'default',
  },
};
