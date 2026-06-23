import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { db } from '../db/database';
import { useUser } from '../context/UserContext';
import { PROTOCOLOS, CHECKLISTS, CHECKLIST_DEFAULTS, TRAMOS, CAIDAS, ATRAVIESOS } from '../constants/estructura';
import { generarPDF, construirDocumentoPDF } from '../utils/generarPDF';
import { useKm } from '../hooks/useKm';
import { sincronizar } from '../utils/sync';
import { supabase } from '../config/supabase';
import { fechaHoy, formatearFecha } from '../utils/fecha';
import { comprimirFoto } from '../utils/comprimirFoto';
import { uploadFoto } from '../utils/uploadFoto';

const OPCION_COLOR = { si: '#10b981', no: '#ef4444', na: '#f59e0b' };
const PROTOCOLO_A_PARTIDA = {
  PICE1: 'excavacion', G5: 'emplantillado', PICE3: 'moldaje',
  PICE2_RADIER: 'hormigon_radier', PICE2_MURO: 'hormigon_muro',
  PICE4_RADIER: 'enfierradura',   PICE4_MURO: 'enfierradura',
  HA_RADIER: 'hormigon_radier',   HA_MURO: 'hormigon_muro',
};
const NOMBRES_TIPO = { tramo: 'Tramo', caida: 'Caída', atravieso: 'Atravieso' };
const LISTAS_HA = { tramo: TRAMOS, caida: CAIDAS, atravieso: ATRAVIESOS };
const TIPOS_HORMIGON_HA = ['G20', 'G25', 'G30'];
const USO_POR_PROTOCOLO = { HA_RADIER: 'radier', HA_MURO: 'muro' };
const VOLVER_BASE = { tramo: '/tramos', caida: '/caidas', atravieso: '/atraviesos' };
const ETIQUETAS_FOTO = ['Excavación', 'Moldaje', 'Enfierradura', 'Hormigón', 'Emplantillado', 'General'];
const ETIQUETA_PROTOCOLO = {
  PICE1: 'Excavación',
  PICE2_RADIER: 'Hormigón',
  PICE2_MURO: 'Hormigón',
  PICE3: 'Moldaje',
  PICE4_RADIER: 'Enfierradura',
  PICE4_MURO: 'Enfierradura',
  G5: 'Emplantillado',
  HA_RADIER: 'Hormigón',
  HA_MURO: 'Hormigón',
};

// Convierte cualquier formato previo del checklist al formato {valor, obs}
function normalizeChecklist(raw, items) {
  return Object.fromEntries(items.map(item => {
    const v = raw?.[item.id];
    if (v === null || v === undefined) return [item.id, { valor: null, obs: '' }];
    if (typeof v === 'object' && !Array.isArray(v)) {
      return [item.id, { valor: v.valor ?? null, obs: v.obs ?? '' }];
    }
    if (typeof v === 'string') return [item.id, { valor: v, obs: '' }];
    return [item.id, { valor: null, obs: '' }];
  }));
}

// Normaliza un registro de camión desde Supabase (snake_case) al formato común
function normalizarCamionRemoto(remoto) {
  return {
    key: `sb-${remoto.id}`,
    supabaseId: remoto.id,
    localId: remoto.local_id ?? null,
    tipoEntidad: remoto.tipo_entidad,
    entidadId: remoto.entidad_id,
    tipoHormigon: remoto.tipo_hormigon,
    volumen: remoto.volumen,
    numeroGuia: remoto.numero_guia,
    planta: remoto.planta,
    cono: remoto.cono,
    tempHormigon: remoto.temp_hormigon,
    tempAmbiente: remoto.temp_ambiente,
    horaCarga: remoto.hora_carga,
    horaDescarga: remoto.hora_descarga,
    tiempoTraslado: remoto.tiempo_traslado,
    puCalculado: remoto.pu_calculado,
    observaciones: remoto.observaciones,
    usuarioNombre: remoto.usuario_nombre,
    fechaRecepcion: remoto.fecha_recepcion,
    fotoGuia: remoto.foto_guia,
    fotosEnsayo: remoto.fotos_ensayo ?? [],
    pesoHoyaHormigon: remoto.peso_hoya_hormigon,
    estadoCalidad: remoto.estado_calidad ?? null,
    fotoGuiaUrl: remoto.foto_guia_url ?? null,
    fotosEnsayoUrls: remoto.fotos_ensayo_urls ?? [],
  };
}

// Normaliza un registro de camión local (Dexie, camelCase) al formato común
function normalizarCamionLocal(local) {
  return {
    key: `local-${local.id}`,
    supabaseId: local.supabaseId ?? null,
    localId: local.id,
    tipoEntidad: local.tipoEntidad,
    entidadId: local.entidadId,
    tipoHormigon: local.tipoHormigon,
    volumen: local.volumen,
    numeroGuia: local.numeroGuia,
    planta: local.planta,
    cono: local.cono,
    tempHormigon: local.tempHormigon,
    tempAmbiente: local.tempAmbiente,
    horaCarga: local.horaCarga,
    horaDescarga: local.horaDescarga,
    tiempoTraslado: local.tiempoTraslado,
    puCalculado: local.puCalculado,
    observaciones: local.observaciones,
    usuarioNombre: local.usuarioNombre,
    fechaRecepcion: local.fechaRecepcion,
    fotoGuia: local.fotoGuia,
    fotosEnsayo: local.fotosEnsayo ?? [],
    pesoHoyaHormigon: local.pesoHoyaHormigon,
    estadoCalidad: local.estadoCalidad ?? null,
    fotoGuiaUrl: local.fotoGuiaUrl ?? null,
    fotosEnsayoUrls: local.fotosEnsayoUrls ?? [],
  };
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Seccion({ titulo, children }) {
  return (
    <div style={s.seccion}>
      <h2 style={s.seccionTitulo}>{titulo}</h2>
      {children}
    </div>
  );
}

function EstadoBadge({ estado }) {
  const cfg = {
    pendiente:  { color: '#8892b0', label: 'Pendiente' },
    borrador:   { color: '#f59e0b', label: 'Borrador' },
    completado: { color: '#10b981', label: 'Completado' },
    enviado:    { color: '#3b82f6', label: '📤 Enviado' },
  };
  const { color, label } = cfg[estado] ?? cfg.pendiente;
  return <span style={{ ...s.estadoBadge, color, borderColor: color }}>{label}</span>;
}

const formatearFechaEnvio = formatearFecha;

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ ...s.toast, background: toast.tipo === 'error' ? '#ef4444' : '#10b981' }}>
      {toast.msg}
    </div>
  );
}

function ModalConfirmar({
  titulo = '¿Marcar como completado?',
  texto = 'Se registrará como completado. Podrás editarlo si es necesario.',
  textoConfirmar = 'Confirmar',
  colorConfirmar = '#10b981',
  onConfirmar,
  onCancelar,
}) {
  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <h2 style={s.modalTitulo}>{titulo}</h2>
        <p style={s.modalTexto}>{texto}</p>
        <div style={s.modalBotones}>
          <button style={s.btnModalCancelar} onClick={onCancelar}>Cancelar</button>
          <button style={{ ...s.btnModalConfirmar, background: colorConfirmar }} onClick={onConfirmar}>{textoConfirmar}</button>
        </div>
      </div>
    </div>
  );
}

function CamionRegistradoCard({ camion: c, expandido, onToggle, editando, onEditar, onCancelarEdicion, onGuardarEdicion }) {
  const [tipoEdit, setTipoEdit] = useState(c.tipoEntidad);
  const [entidadEdit, setEntidadEdit] = useState(String(c.entidadId));

  const resumen = [
    c.numeroGuia && `N° Guía: ${c.numeroGuia}`,
    c.tipoHormigon,
    c.planta,
  ].filter(Boolean);

  const meta = [
    c.cono && `Cono: ${c.cono} cm`,
    c.tempHormigon && `Temp: ${c.tempHormigon}°C`,
    c.puCalculado && `PU: ${Number(c.puCalculado).toLocaleString('es-CL')} kg/m³`,
    c.horaCarga && `Carga: ${c.horaCarga}`,
  ].filter(Boolean);

  function handleTipoEdit(nuevoTipo) {
    setTipoEdit(nuevoTipo);
    setEntidadEdit(String(LISTAS_HA[nuevoTipo][0]));
  }

  return (
    <div style={s.camionRegCard}>
      <div style={s.camionFila} onClick={onToggle}>
        <div style={s.camionInfo}>
          <span style={s.camionTipo}>{resumen.join(' — ') || '—'}</span>
          <span style={s.camionMeta}>{meta.join(' · ')}</span>
        </div>
        <span style={s.chevronSm}>{expandido ? '⌄' : '›'}</span>
      </div>

      {expandido && (
        <div style={s.camionDetalle}>
          <div style={s.detalleGrid}>
            <div>
              <span style={s.detalleLabel}>Volumen</span>
              <span style={s.detalleValor}>{c.volumen ? `${c.volumen} m³` : '—'}</span>
            </div>
            <div>
              <span style={s.detalleLabel}>Temp. ambiente</span>
              <span style={s.detalleValor}>{c.tempAmbiente ? `${c.tempAmbiente} °C` : '—'}</span>
            </div>
            <div>
              <span style={s.detalleLabel}>Hora descarga</span>
              <span style={s.detalleValor}>{c.horaDescarga || '—'}</span>
            </div>
            <div>
              <span style={s.detalleLabel}>Tiempo traslado</span>
              <span style={s.detalleValor}>{c.tiempoTraslado ? `${c.tiempoTraslado} min` : '—'}</span>
            </div>
            <div>
              <span style={s.detalleLabel}>Registrado por</span>
              <span style={s.detalleValor}>{c.usuarioNombre || '—'}</span>
            </div>
            <div>
              <span style={s.detalleLabel}>Fecha recepción</span>
              <span style={s.detalleValor}>{formatearFechaEnvio(c.fechaRecepcion) || '—'}</span>
            </div>
          </div>

          {c.observaciones && <p style={s.camionObs}>{c.observaciones}</p>}

          {(c.fotoGuia || c.fotosEnsayo?.length > 0) && (
            <div style={s.fotosGrid}>
              {c.fotoGuia && (
                <div style={s.fotoThumb}>
                  <img src={c.fotoGuia.storageUrl || c.fotoGuia.dataUrl} alt="Guía de despacho" style={s.fotoImg} />
                </div>
              )}
              {(c.fotosEnsayo ?? []).map((foto, i) => (
                <div key={i} style={s.fotoThumb}>
                  <img src={foto.storageUrl || foto.dataUrl} alt={foto.descripcion || ''} style={s.fotoImg} />
                </div>
              ))}
            </div>
          )}

          {editando ? (
            <div style={s.editEntidadForm}>
              <select style={s.inputEdit} value={tipoEdit} onChange={e => handleTipoEdit(e.target.value)}>
                <option value="tramo">Tramo</option>
                <option value="caida">Caída</option>
                <option value="atravieso">Atravieso</option>
              </select>
              <select style={s.inputEdit} value={entidadEdit} onChange={e => setEntidadEdit(e.target.value)}>
                {LISTAS_HA[tipoEdit].map(id => (
                  <option key={id} value={id}>{NOMBRES_TIPO[tipoEdit]} {id}</option>
                ))}
              </select>
              <div style={s.editEntidadBotones}>
                <button style={s.btnModalCancelar} onClick={onCancelarEdicion}>Cancelar</button>
                <button style={s.btnModalConfirmar} onClick={() => onGuardarEdicion(tipoEdit, entidadEdit)}>Guardar</button>
              </div>
            </div>
          ) : (
            <button style={s.btnEditarEntidad} onClick={onEditar}>✏️ Cambiar entidad asignada</button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Protocolo({ tipo: tipoProp, entidadId: entidadIdProp, protocoloId: protocoloIdProp, embedded = false }) {
  const params = useParams();
  const tipo = tipoProp ?? params.tipo;
  const entidadId = entidadIdProp ?? params.entidadId;
  const protocoloId = protocoloIdProp ?? params.protocoloId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { usuario } = useUser();
  const { kmInicio, kmFin } = useKm(tipo, entidadId);

  const entidadIdReal = tipo === 'caida' ? Number(entidadId) : entidadId;
  const protocoloInfo = PROTOCOLOS.find(p => p.id === protocoloId);
  const itemsChecklist = CHECKLISTS[protocoloId] ?? [];
  const defaultsDef    = CHECKLIST_DEFAULTS[protocoloId] ?? null;
  const emptyChecklist = Object.fromEntries(itemsChecklist.map(i => {
    const hasDefault = defaultsDef?.items.some(d => d.id === i.id);
    return [i.id, { valor: hasDefault ? 'si' : null, obs: '' }];
  }));
  const nombreEntidad = `${NOMBRES_TIPO[tipo] ?? tipo} ${entidadId}`;
  const titulo = `${nombreEntidad} — ${protocoloInfo?.nombre ?? protocoloId}`;
  const volverUrl = searchParams.get('from') === 'matriz'
    ? '/matriz'
    : `${VOLVER_BASE[tipo] ?? '/'}/${entidadId}`;
  // Protocolos de Control H.A. — solo muestran la vista de camiones
  const esHA = protocoloId === 'HA_RADIER' || protocoloId === 'HA_MURO';
  // Protocolos solo-fotos (ej. G5 Emplantillado) — sin checklist ni observaciones
  const soloFotos = protocoloInfo?.soloFotos === true;
  // Evaluado una sola vez al montar — suficiente para PWA móvil
  const isMobile = window.innerWidth < 768;

  const [checklist, setChecklist] = useState(emptyChecklist);
  const [observaciones, setObservaciones] = useState('');
  const [edp, setEdp] = useState('');
  const [avanceDisponible, setAvanceDisponible] = useState(null); // null=cargando, true/false
  const [camionesRegistrados, setCamionesRegistrados] = useState([]);
  const [cargandoCamiones, setCargandoCamiones] = useState(true);
  const [expandidoCamion, setExpandidoCamion] = useState(null);
  const [editandoCamion, setEditandoCamion] = useState(null);
  const [estado, setEstado] = useState('pendiente');
  const [fechaEnvio, setFechaEnvio] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [confirmandoDesbloqueo, setConfirmandoDesbloqueo] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [generandoPreview, setGenerandoPreview] = useState(false);
  const [previewPDF, setPreviewPDF] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [toast, setToast] = useState(null);
  const [filtroEtiqueta, setFiltroEtiqueta] = useState(ETIQUETA_PROTOCOLO[protocoloId] ?? 'Todas');
  // Búsqueda de fotos en otra entidad
  const [busquedaPanel, setBusquedaPanel]         = useState(false);
  const [busquedaTipo, setBusquedaTipo]           = useState('tramo');
  const [busquedaEntidadId, setBusquedaEntidadId] = useState(String(TRAMOS[0]));
  const [fotosOtraEntidad, setFotosOtraEntidad]   = useState([]);
  const [cargandoBusqueda, setCargandoBusqueda]   = useState(false);
  const [busquedaActiva, setBusquedaActiva]       = useState(null); // { tipo, entidadId, label }
  const [fotosNubeSeleccionadas, setFotosNubeSeleccionadas] = useState([]);
  const [fotosSugeridasExpanded, setFotosSugeridasExpanded] = useState(true);
  const [fotoNubeModal, setFotoNubeModal] = useState(null);
  const [descModalTexto, setDescModalTexto] = useState('');
  // ── Modal cámara/galería (fotos nuevas) ──────────────────────────────────────
  const [cropModal, setCropModal]         = useState(null);
  const [crop, setCrop]                   = useState(null);
  const [completedCrop, setCompletedCrop] = useState(null);
  const [pendingFiles, setPendingFiles]   = useState([]);
  // ── Modal nube ────────────────────────────────────────────────────────────────
  const [modoCrop, setModoCrop]           = useState(false);  // false=preview, true=edición
  const [cropActivo, setCropActivo]       = useState(null);   // % live mientras arrastra
  const [cropGuardado, setCropGuardado]   = useState(null);   // % confirmado
  const [rotacionPasos, setRotacionPasos] = useState(0);      // 0=0°, 1=90°, 2=180°, 3=270°
  const [imgRotada, setImgRotada]         = useState(null);   // data URL con rotación aplicada

  const cargadoRef = useRef(false);
  const toastTimerRef = useRef(null);
  const inputCamaraRef = useRef(null);
  const inputGaleriaRef = useRef(null);
  const imgCropRef = useRef(null); // modal cámara/galería
  const imgRef     = useRef(null); // modal nube (preview y crop)

  const protocoloArr = useLiveQuery(
    () =>
      db.protocolos
        .where('entidadId').equals(entidadIdReal)
        .filter(p => p.tipo === tipo && p.protocoloId === protocoloId)
        .toArray(),
    [tipo, entidadIdReal, protocoloId]
  );

  const cargando = protocoloArr === undefined;
  const protocolo = protocoloArr?.[0];

  const fotos = useLiveQuery(
    () =>
      protocolo?.id
        ? db.fotos.where('protocoloLocalId').equals(protocolo.id).toArray()
        : Promise.resolve([]),
    [protocolo?.id]
  ) ?? [];

  const [fotosTerreno, setFotosTerreno] = useState([]);

  // Fotos desde la nube de fotos terreno: Supabase es la fuente principal,
  // Dexie local es solo fallback si no hay conexión.
  useEffect(() => {
    let cancelado = false;

    async function cargarFotosTerreno() {
      if (supabase && navigator.onLine) {
        try {
          console.log('Buscando fotos para:', { tipo, entidadId: entidadIdReal });
          const { data, error } = await supabase
            .from('fotos_terreno')
            .select('id, local_id, tipo, entidad_id, etiquetas, descripcion, storage_url, usuario_nombre, fecha_captura')
            .eq('tipo', tipo)
            .eq('entidad_id', String(entidadIdReal));
          console.log('Resultado Supabase fotos_terreno:', data, error);
          if (error) throw error;
          if (!cancelado) {
            setFotosTerreno((data ?? []).map(f => ({
              id: f.id,
              etiquetas: f.etiquetas ?? [],
              descripcion: f.descripcion ?? '',
              storageUrl: f.storage_url ?? null,
              dataUrl: f.data_url ?? null,
            })));
          }
          return;
        } catch (err) {
          console.warn('[FotosTerreno] Error Supabase, usando datos locales:', err?.message ?? err);
        }
      }

      const locales = await db.fotos_terreno
        .where('tipo').equals(tipo)
        .and(f => f.entidadId === entidadIdReal)
        .toArray();

      if (!cancelado) {
        setFotosTerreno(locales.map(f => ({
          id: f.id,
          etiquetas: f.etiquetas ?? [],
          descripcion: f.descripcion ?? '',
          storageUrl: f.storageUrl ?? null,
          dataUrl: f.dataUrl ?? null,
        })));
      }
    }

    cargarFotosTerreno();
    return () => { cancelado = true; };
  }, [tipo, entidadIdReal]);

  // Consulta Supabase para saber si hay registro de avance para este protocolo
  useEffect(() => {
    const partidaId = PROTOCOLO_A_PARTIDA[protocoloId];
    if (!partidaId || !supabase || !navigator.onLine) {
      setAvanceDisponible(false);
      return;
    }
    supabase
      .from('avance')
      .select('partida_id', { count: 'exact', head: true })
      .eq('tipo_entidad', tipo)
      .eq('entidad_id', String(entidadIdReal))
      .eq('partida_id', partidaId)
      .then(({ count }) => setAvanceDisponible((count ?? 0) > 0))
      .catch(() => setAvanceDisponible(false));
  }, [tipo, entidadIdReal, protocoloId]);

  // Camiones registrados desde el módulo de Recepción de Camiones (Control H.A.)
  useEffect(() => {
    if (!esHA) return;
    let cancelado = false;
    const uso = USO_POR_PROTOCOLO[protocoloId];

    async function cargarCamionesRegistrados() {
      setCargandoCamiones(true);

      if (supabase && navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('camiones')
            .select('*')
            .eq('tipo_entidad', tipo)
            .eq('entidad_id', String(entidadIdReal))
            .eq('uso_hormigon', uso)
            .in('tipo_hormigon', TIPOS_HORMIGON_HA);
          if (error) throw error;
          if (!cancelado) {
            setCamionesRegistrados((data ?? []).map(normalizarCamionRemoto));
            setCargandoCamiones(false);
          }
          return;
        } catch (err) {
          console.warn('[CamionesHA] Error Supabase, usando datos locales:', err?.message ?? err);
        }
      }

      const locales = await db.camiones
        .filter(c =>
          c.tipoEntidad === tipo &&
          String(c.entidadId) === String(entidadIdReal) &&
          c.usoHormigon === uso &&
          TIPOS_HORMIGON_HA.includes(c.tipoHormigon)
        )
        .toArray();

      if (!cancelado) {
        setCamionesRegistrados(locales.map(normalizarCamionLocal));
        setCargandoCamiones(false);
      }
    }

    cargarCamionesRegistrados();
    return () => { cancelado = true; };
  }, [esHA, tipo, entidadIdReal, protocoloId]);

  useEffect(() => {
    if (!cargando && !cargadoRef.current) {
      cargadoRef.current = true;
      if (protocolo) {
        setEstado(protocolo.estado);
        setFechaEnvio(protocolo.fechaEnvio ?? null);
        setEdp(protocolo.edp ?? '');

        const datosVacios = !protocolo.datos || Object.keys(protocolo.datos).length === 0;
        if (datosVacios && protocolo.supabaseId && supabase && navigator.onLine) {
          // datos no disponibles localmente (sync sin campo datos) — cargar bajo demanda
          supabase
            .from('protocolos')
            .select('datos')
            .eq('id', protocolo.supabaseId)
            .single()
            .then(({ data }) => {
              const d = data?.datos ?? {};
              setChecklist(normalizeChecklist(d.checklist, itemsChecklist));
              setObservaciones(d.observaciones ?? '');
              const fotosGuardadas = d.fotosNubeSeleccionadas ?? [];
              setFotosNubeSeleccionadas(fotosGuardadas);
              if (fotosGuardadas.length > 0) setFotosSugeridasExpanded(false);
              if (data?.datos) db.protocolos.update(protocolo.id, { datos: data.datos });
            })
            .catch(() => {});
        } else {
          setChecklist(normalizeChecklist(protocolo.datos?.checklist, itemsChecklist));
          setObservaciones(protocolo.datos?.observaciones ?? '');
          const fotosGuardadas = protocolo.datos?.fotosNubeSeleccionadas ?? [];
          setFotosNubeSeleccionadas(fotosGuardadas);
          if (fotosGuardadas.length > 0) setFotosSugeridasExpanded(false);
        }
      }
    }
  }, [cargando, protocolo]);

  // Si la imagen ya estaba cacheada con CORS, onLoad no re-dispara; inicializar crop manualmente
  useEffect(() => {
    if (fotoNubeModal === null || modoCrop || cropGuardado) return;
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      const c = calcCentrado(img);
      setCropActivo(c);
      setCropGuardado(c);
    }
  }, [fotoNubeModal, modoCrop]);

  function mostrarToast(msg, tipo = 'ok') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, tipo });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  function setCheckValue(itemId, opcion) {
    setChecklist(prev => {
      const curr = prev[itemId] ?? { valor: null, obs: '' };
      return { ...prev, [itemId]: { ...curr, valor: curr.valor === opcion ? null : opcion } };
    });
  }

  function setCheckObs(itemId, obs) {
    setChecklist(prev => {
      const curr = prev[itemId] ?? { valor: null, obs: '' };
      return { ...prev, [itemId]: { ...curr, obs } };
    });
  }

  async function obtenerOCrearId() {
    if (protocolo?.id) return protocolo.id;
    const hoy = fechaHoy();
    return db.protocolos.add({
      tipo, entidad: tipo, entidadId: entidadIdReal, protocoloId,
      estado: 'borrador', usuarioNombre: usuario,
      fechaCreacion: hoy, fechaModificacion: hoy,
      datos: { checklist, observaciones, fotosNubeSeleccionadas },
      sincronizada: false,
    });
  }

  async function guardarEdp(valor) {
    if (!protocolo?.id) return;
    await db.protocolos.update(protocolo.id, { edp: valor.trim() || null, sincronizada: false });
    if (supabase && navigator.onLine) {
      setSincronizando(true);
      sincronizar().finally(() => setSincronizando(false));
    }
  }

  async function guardar(nuevoEstado, extra = {}, mensaje = null) {
    if (guardando) return;
    setGuardando(true);
    try {
      const datos = { checklist, observaciones, fotosNubeSeleccionadas };

      const campos = {
        estado: nuevoEstado, usuarioNombre: usuario,
        fechaModificacion: fechaHoy(), datos, sincronizada: false,
        edp: edp.trim() || null,
        ...extra,
      };

      if (protocolo) {
        await db.protocolos.update(protocolo.id, campos);
      } else {
        await db.protocolos.add({
          tipo, entidad: tipo, entidadId: entidadIdReal, protocoloId,
          fechaCreacion: fechaHoy(), ...campos,
        });
      }

      setEstado(nuevoEstado);
      if ('fechaEnvio' in extra) setFechaEnvio(extra.fechaEnvio);
      mostrarToast(mensaje ?? (nuevoEstado === 'completado' ? '✓ Protocolo completado' : '✓ Borrador guardado'));

      if (supabase && navigator.onLine) {
        setSincronizando(true);
        sincronizar().finally(() => setSincronizando(false));
      }
    } catch (err) {
      console.error('Error completo:', err);
      mostrarToast(`Error al guardar: ${err?.message ?? String(err)}`, 'error');
    } finally {
      setGuardando(false);
    }
  }

  // ── Crop: modal cámara/galería ────────────────────────────────────────────────

  function onCropImageLoad(e) {
    const { width, height } = e.currentTarget;
    const aspecto = esHA ? 4/3 : 3/4;
    const dim     = esHA ? { unit: '%', width: 90 } : { unit: '%', height: 90 };
    const pct = centerCrop(makeAspectCrop(dim, aspecto, width, height), width, height);
    setCrop(pct);
    setCompletedCrop({ unit: 'px', x: pct.x/100*width, y: pct.y/100*height, width: pct.width/100*width, height: pct.height/100*height });
  }

  function aplicarCropACanvas() {
    const img = imgCropRef.current;
    const c   = completedCrop;
    if (!img || !c?.width || !c?.height) return null;
    const scaleX = img.naturalWidth  / img.width;
    const scaleY = img.naturalHeight / img.height;
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(c.width  * scaleX);
    canvas.height = Math.round(c.height * scaleY);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, Math.round(c.x*scaleX), Math.round(c.y*scaleY), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    try   { return canvas.toDataURL('image/jpeg', 0.88); }
    catch { return null; }
  }

  // ── Crop: modal nube ──────────────────────────────────────────────────────────

  // Rota la imagen en pasos de 90° y guarda el data URL resultante.
  // srcOverride: fuente a rotar (por defecto srcUrlModal para el modal nube).
  function rotarImagen(delta, srcOverride) {
    const src   = srcOverride ?? srcUrlModal;
    const pasos = ((rotacionPasos + delta) % 4 + 4) % 4;
    setRotacionPasos(pasos);
    if (pasos === 0) {
      setImgRotada(null);
      setCropGuardado(null);
      setCropActivo(null);
      setCrop(null);
      setCompletedCrop(null);
      return;
    }
    const tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.onload = () => {
      const grados  = pasos * 90;
      const swap    = pasos % 2 !== 0;
      const canvas  = document.createElement('canvas');
      canvas.width  = swap ? tempImg.height : tempImg.width;
      canvas.height = swap ? tempImg.width  : tempImg.height;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(grados * Math.PI / 180);
      ctx.drawImage(tempImg, -tempImg.width / 2, -tempImg.height / 2);
      try {
        setImgRotada(canvas.toDataURL('image/jpeg', 0.92));
      } catch { /* CORS */ }
      setCropGuardado(null);
      setCropActivo(null);
      setCrop(null);
      setCompletedCrop(null);
    };
    tempImg.src = src;
  }

  // Calcula crop centrado en % según el aspecto del protocolo
  function calcCentrado(imgEl) {
    const { width, height } = imgEl;
    const aspecto = esHA ? 4/3 : 3/4;
    const dim     = esHA ? { unit: '%', width: 90 } : { unit: '%', height: 90 };
    return centerCrop(makeAspectCrop(dim, aspecto, width, height), width, height);
  }

  // Aplica cropGuardado (en %) sobre imgRef y devuelve dataURL
  function aplicarCropNube(guardado) {
    const img = imgRef.current;
    if (!img || !guardado || !(guardado.width > 0) || !(guardado.height > 0)) return null;
    const scaleX = img.naturalWidth  / img.width;
    const scaleY = img.naturalHeight / img.height;
    // Convierte % a px renderizados, luego a px naturales
    const sx = guardado.x      / 100 * img.width  * scaleX;
    const sy = guardado.y      / 100 * img.height * scaleY;
    const sw = guardado.width  / 100 * img.width  * scaleX;
    const sh = guardado.height / 100 * img.height * scaleY;
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, Math.round(sx), Math.round(sy), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    try   { return canvas.toDataURL('image/jpeg', 0.92); }
    catch { return null; }
  }

  async function buscarFotosOtraEntidad() {
    if (!busquedaEntidadId) return;
    setCargandoBusqueda(true);
    try {
      let lista = [];
      if (supabase && navigator.onLine) {
        const { data, error } = await supabase
          .from('fotos_terreno')
          .select('id, local_id, tipo, entidad_id, etiquetas, descripcion, storage_url, usuario_nombre, fecha_captura')
          .eq('tipo', busquedaTipo)
          .eq('entidad_id', String(busquedaEntidadId));
        if (error) throw error;
        lista = (data ?? []).map(f => ({
          id: f.id, etiquetas: f.etiquetas ?? [], descripcion: f.descripcion ?? '',
          storageUrl: f.storage_url ?? null, dataUrl: f.data_url ?? null,
        }));
      } else {
        const locales = await db.fotos_terreno
          .where('tipo').equals(busquedaTipo)
          .and(f => String(f.entidadId) === String(busquedaEntidadId))
          .toArray();
        lista = locales.map(f => ({
          id: f.id, etiquetas: f.etiquetas ?? [], descripcion: f.descripcion ?? '',
          storageUrl: f.storageUrl ?? null, dataUrl: f.dataUrl ?? null,
        }));
      }
      setFotosOtraEntidad(lista);
      const label = `${NOMBRES_TIPO[busquedaTipo] ?? busquedaTipo} ${busquedaEntidadId}`;
      setBusquedaActiva({ tipo: busquedaTipo, entidadId: busquedaEntidadId, label });
      setBusquedaPanel(false);
    } catch (err) {
      mostrarToast('Error al buscar fotos', 'error');
    } finally {
      setCargandoBusqueda(false);
    }
  }

  function resetearBusqueda() {
    setBusquedaActiva(null);
    setFotosOtraEntidad([]);
    setBusquedaPanel(false);
  }

  function abrirCropModal(srcUrl, tipo, meta) {
    setCropModal({ srcUrl, tipo, meta });
    setCrop(null);
    setCompletedCrop(null);
    setRotacionPasos(0);
    setImgRotada(null);
  }

  function cancelarCrop() {
    setCropModal(null);
    setPendingFiles([]);
    setRotacionPasos(0);
    setImgRotada(null);
  }

  async function confirmarCrop() {
    if (!cropModal) return;
    const croppedUrl = aplicarCropACanvas() ?? imgRotada ?? cropModal.srcUrl;

    if (cropModal.tipo === 'nueva') {
      await guardarFotoNueva(croppedUrl, cropModal.meta.file.name, cropModal.meta.file.type);
    } else if (cropModal.tipo === 'editar-nube') {
      setFotosNubeSeleccionadas(prev => prev.map(f =>
        (f.storageUrl || f.dataUrl) === cropModal.meta.key
          ? { ...f, dataUrlRecortado: croppedUrl }
          : f
      ));
    } else if (cropModal.tipo === 'editar-nueva') {
      await db.fotos.update(cropModal.meta.fotoId, { dataUrl: croppedUrl });
    } else {
      const { foto } = cropModal.meta;
      setFotosNubeSeleccionadas(prev => [
        ...prev,
        { storageUrl: foto.storageUrl ?? null, dataUrl: foto.dataUrl ?? null, dataUrlRecortado: croppedUrl, descripcion: '' },
      ]);
    }

    setCropModal(null);
    setRotacionPasos(0);
    setImgRotada(null);

    // Procesar siguiente archivo pendiente (solo aplica para tipo 'nueva')
    if (cropModal.tipo === 'nueva' && pendingFiles.length > 0) {
      const [next, ...rest] = pendingFiles;
      setPendingFiles(rest);
      const dataUrl = await comprimirFoto(next);
      abrirCropModal(dataUrl, 'nueva', { file: next });
    }
  }

  function abrirEditarFoto(foto) {
    if (readOnly) return;
    if (foto.origen === 'nube') {
      const src = foto.storageUrl || foto.dataUrl;
      abrirCropModal(src, 'editar-nube', { key: foto.key, descripcion: foto.descripcion });
    } else {
      const src = foto.dataUrl || foto.storageUrl;
      abrirCropModal(src, 'editar-nueva', { fotoId: foto.fotoId, descripcion: foto.descripcion });
    }
  }

  async function guardarFotoNueva(croppedDataUrl, nombre, tipoMime) {
    try {
      const protocoloLocalId = await obtenerOCrearId();
      const fotoId = await db.fotos.add({
        protocoloLocalId, nombre, tipo: tipoMime, dataUrl: croppedDataUrl,
        sincronizada: false, storageUrl: null, subidaStorage: false,
      });
      if (supabase && navigator.onLine) {
        try {
          const storageUrl = await uploadFoto(croppedDataUrl, { tipo, entidadId: entidadIdReal, nombre });
          if (storageUrl) await db.fotos.update(fotoId, { storageUrl, subidaStorage: true });
        } catch (err) {
          console.warn('[Foto] Error al subir a Storage:', err?.message ?? err);
        }
      }
      mostrarToast('Foto agregada');
    } catch {
      mostrarToast('Error al guardar foto', 'error');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────

  async function handleFotoSeleccionada(e) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const [first, ...rest] = files;
    setPendingFiles(rest);
    const dataUrl = await comprimirFoto(first);
    abrirCropModal(dataUrl, 'nueva', { file: first });
  }

  async function eliminarFoto(fotoId) {
    await db.fotos.delete(fotoId);
  }

  function toggleFotoNube(foto, index) {
    const key = foto.storageUrl || foto.dataUrl;
    const yaSeleccionada = fotosNubeSeleccionadas.some(f => (f.storageUrl || f.dataUrl) === key);
    if (yaSeleccionada) {
      setFotosNubeSeleccionadas(prev => prev.filter(f => (f.storageUrl || f.dataUrl) !== key));
    } else {
      abrirFotoNubeModal(index);
    }
  }

  function quitarFotoNube(key) {
    setFotosNubeSeleccionadas(prev => prev.filter(f => (f.storageUrl || f.dataUrl) !== key));
  }

  function setDescFotoNube(key, descripcion) {
    setFotosNubeSeleccionadas(prev => prev.map(f => (f.storageUrl || f.dataUrl) === key ? { ...f, descripcion } : f));
  }

  function guardarDescModalPara(indice, texto) {
    const foto = fotosTerrenoFiltradas[indice];
    if (!foto || readOnly) return;
    const key = foto.storageUrl || foto.dataUrl;
    const actual = fotosNubeSeleccionadas.find(f => (f.storageUrl || f.dataUrl) === key);
    if (actual) {
      if (texto !== (actual.descripcion ?? '')) setDescFotoNube(key, texto);
    } else if (texto.trim()) {
      setFotosNubeSeleccionadas(prev => [...prev, { storageUrl: foto.storageUrl ?? null, dataUrl: foto.dataUrl ?? null, descripcion: texto }]);
    }
  }

  function abrirFotoNubeModal(indice) {
    const foto = fotosTerrenoFiltradas[indice];
    const key  = foto.storageUrl || foto.dataUrl;
    const sel  = fotosNubeSeleccionadas.find(f => (f.storageUrl || f.dataUrl) === key);
    setDescModalTexto(sel?.descripcion ?? '');
    setModoCrop(false);
    setCropActivo(null);
    setCropGuardado(null);
    setRotacionPasos(0);
    setImgRotada(null);
    setFotoNubeModal(indice);
  }

  function cerrarFotoNubeModal() {
    if (fotoNubeModal !== null) {
      const foto = fotosTerrenoFiltradas[fotoNubeModal];
      if (foto) {
        const key    = foto.storageUrl || foto.dataUrl;
        const actual = fotosNubeSeleccionadas.find(f => (f.storageUrl || f.dataUrl) === key);
        if (actual && descModalTexto !== (actual.descripcion ?? '')) setDescFotoNube(key, descModalTexto);
      }
    }
    setFotoNubeModal(null);
    setModoCrop(false);
    setRotacionPasos(0);
    setImgRotada(null);
  }

  function navegarFotoNubeModal(delta) {
    const len  = fotosTerrenoFiltradas.length;
    const nuevo = (fotoNubeModal + delta + len) % len;
    abrirFotoNubeModal(nuevo);
  }

  function agregarAlProtocolo() {
    const foto = fotosTerrenoFiltradas[fotoNubeModal];
    if (!foto) return;
    const guardado = cropGuardado ?? cropActivo;
    let imagenFinal = foto.storageUrl || foto.dataUrl;
    if (guardado && guardado.width > 0 && guardado.height > 0) {
      const cropped = aplicarCropNube(guardado);
      if (cropped) imagenFinal = cropped;
    }
    setFotosNubeSeleccionadas(prev => [
      ...prev,
      { storageUrl: foto.storageUrl ?? null, dataUrl: foto.dataUrl ?? null, dataUrlRecortado: imagenFinal, descripcion: descModalTexto },
    ]);
    cerrarFotoNubeModal();
  }

  async function actualizarEntidadCamion(camion, nuevoTipo, nuevoEntidadIdStr) {
    const nuevoEntidadId = nuevoTipo === 'caida' ? Number(nuevoEntidadIdStr) : nuevoEntidadIdStr;

    if (supabase && navigator.onLine && camion.supabaseId) {
      try {
        await supabase
          .from('camiones')
          .update({ tipo_entidad: nuevoTipo, entidad_id: String(nuevoEntidadId) })
          .eq('id', camion.supabaseId);
      } catch (err) {
        console.warn('[CamionesHA] Error actualizando entidad en Supabase:', err?.message ?? err);
      }
    }

    if (camion.localId) {
      await db.camiones.update(camion.localId, { tipoEntidad: nuevoTipo, entidadId: nuevoEntidadId, sincronizado: false });
    }

    setCamionesRegistrados(prev => prev.filter(c => c.key !== camion.key));
    setEditandoCamion(null);
    mostrarToast('Camión reasignado a otra entidad');
  }

  async function abrirVistaPrevia() {
    setGenerandoPreview(true);
    try {
      const { doc, filename } = await construirDocumentoPDF(protocolo, fotosCombinadas, kmInicio, kmFin, camionesRegistrados);
      const url = doc.output('bloburl');
      setPreviewPDF({ doc, filename, url });
    } catch (err) {
      console.error('Error generando vista previa:', err);
      mostrarToast('Error al generar vista previa', 'error');
    } finally {
      setGenerandoPreview(false);
    }
  }

  function cerrarVistaPrevia() {
    if (previewPDF?.url) URL.revokeObjectURL(previewPDF.url);
    setPreviewPDF(null);
  }

  function descargarDesdeVistaPrevia() {
    previewPDF?.doc.save(previewPDF.filename);
  }

  if (cargando) return <div style={s.cargando}>Cargando...</div>;

  const readOnly = estado === 'enviado';

  const respondidos = itemsChecklist.filter(item => checklist[item.id]?.valor !== null).length;

  const fotosActivasTerreno = busquedaActiva ? fotosOtraEntidad : fotosTerreno;
  const fotosTerrenoFiltradas = filtroEtiqueta === 'Todas'
    ? fotosActivasTerreno
    : fotosActivasTerreno.filter(f => f.etiquetas?.includes(filtroEtiqueta));

  // Variables derivadas para el modal de foto nube
  const fotoActualModal   = fotoNubeModal !== null ? (fotosTerrenoFiltradas[fotoNubeModal] ?? null) : null;
  const srcUrlModal       = fotoActualModal ? (fotoActualModal.storageUrl || fotoActualModal.dataUrl) : null;
  const fotoModalSeleccionada = srcUrlModal
    ? fotosNubeSeleccionadas.some(f => (f.storageUrl || f.dataUrl) === srcUrlModal)
    : false;

  const fotosNubeData = fotosNubeSeleccionadas.map(sel => {
    const key = sel.storageUrl || sel.dataUrl;
    // compat: datos guardados antes del renombrado usaban croppedDataUrl
    const recortado = sel.dataUrlRecortado ?? sel.croppedDataUrl ?? null;
    return {
      id: `nube-${key}`,
      key,
      dataUrlRecortado: recortado?.startsWith('data:') ? recortado : null,
      dataUrl: sel.dataUrl ?? null,
      storageUrl: sel.storageUrl ?? null,
      descripcion: sel.descripcion ?? '',
      origen: 'nube',
    };
  });

  const fotosCombinadas = [
    ...fotos.map(f => ({ id: `nueva-${f.id}`, fotoId: f.id, dataUrl: f.dataUrl, storageUrl: f.storageUrl ?? null, descripcion: f.descripcion ?? '', origen: 'nueva' })),
    ...fotosNubeData,
  ];

  const fotosSugeridas = defaultsDef?.fotos_sugeridas ?? [];

  const seccionFotos = (
    <Seccion titulo="Fotos del Protocolo">
      {/* Banner fotos sugeridas */}
      {fotosSugeridas.length > 0 && (
        <div style={s.fotosSugeridasBanner}>
          <button
            style={s.fotosSugeridasToggle}
            onClick={() => setFotosSugeridasExpanded(v => !v)}
          >
            <span>📸 Fotos sugeridas</span>
            <span style={{ fontSize: '10px' }}>{fotosSugeridasExpanded ? '▲' : '▼'}</span>
          </button>
          {fotosSugeridasExpanded && (
            <ul style={s.fotosSugeridasLista}>
              {fotosSugeridas.map((f, i) => (
                <li key={i} style={s.fotosSugeridasItem}>• {f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Subsección 1: seleccionar desde nube */}
      <p style={s.subSeccionTitulo}>Seleccionar desde nube 📷</p>
      <div style={s.chipsRow}>
        {['Todas', ...ETIQUETAS_FOTO].map(et => (
          <button
            key={et}
            style={{ ...s.chip, ...(filtroEtiqueta === et ? s.chipActivo : {}) }}
            onClick={() => setFiltroEtiqueta(et)}
          >
            {et}
          </button>
        ))}
      </div>

      {/* ── Búsqueda en otra entidad ─────────────────────────────────────────── */}
      {busquedaActiva ? (
        <div style={s.busquedaActivaBanner}>
          <span style={s.busquedaActivaLabel}>
            📍 Fotos de <strong>{busquedaActiva.label}</strong>
          </span>
          <button style={s.btnResetBusqueda} onClick={resetearBusqueda}>
            ✕ Volver a {nombreEntidad}
          </button>
        </div>
      ) : (
        <button
          style={s.btnBuscarOtraEntidad}
          onClick={() => setBusquedaPanel(v => !v)}
        >
          🔍 {busquedaPanel ? 'Cancelar búsqueda' : 'Buscar en otra entidad'}
        </button>
      )}

      {busquedaPanel && !busquedaActiva && (
        <div style={s.panelBusqueda}>
          <select
            style={s.inputEdit}
            value={busquedaTipo}
            onChange={e => {
              setBusquedaTipo(e.target.value);
              setBusquedaEntidadId(String(LISTAS_HA[e.target.value][0]));
            }}
          >
            <option value="tramo">Tramo</option>
            <option value="caida">Caída</option>
            <option value="atravieso">Atravieso</option>
          </select>
          <select
            style={s.inputEdit}
            value={busquedaEntidadId}
            onChange={e => setBusquedaEntidadId(e.target.value)}
          >
            {LISTAS_HA[busquedaTipo].map(id => (
              <option key={id} value={String(id)}>
                {NOMBRES_TIPO[busquedaTipo]} {id}
              </option>
            ))}
          </select>
          <button
            style={{ ...s.btnFoto, opacity: cargandoBusqueda ? 0.6 : 1 }}
            onClick={buscarFotosOtraEntidad}
            disabled={cargandoBusqueda}
          >
            {cargandoBusqueda ? 'Buscando...' : '🔍 Buscar fotos'}
          </button>
        </div>
      )}

      {fotosTerrenoFiltradas.length > 0 ? (
        <div style={s.fotosGrid}>
          {fotosTerrenoFiltradas.map((foto, index) => {
            const key = foto.storageUrl || foto.dataUrl;
            const seleccionada = fotosNubeSeleccionadas.some(f => (f.storageUrl || f.dataUrl) === key);
            return (
              <div
                key={foto.id}
                style={{ ...s.fotoThumb, ...(seleccionada ? s.fotoThumbSeleccionada : {}), cursor: 'pointer' }}
                onClick={() => abrirFotoNubeModal(index)}
              >
                <img src={key} alt="" loading="lazy" style={{ ...s.fotoImg, backgroundColor: '#2a2a3e' }} onError={e => { e.target.style.opacity = '0.3'; }} />
                <div
                  style={{ ...s.checkOverlay, cursor: readOnly ? 'default' : 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); if (!readOnly) toggleFotoNube(foto, index); }}
                >
                  <input type="checkbox" checked={seleccionada} readOnly style={s.checkboxNube} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={s.sinFotos}>
          Sin fotos en la nube para {busquedaActiva ? busquedaActiva.label : 'esta entidad'}
        </p>
      )}
      <div style={s.badgeSeleccion}>
        {fotosNubeSeleccionadas.length} {fotosNubeSeleccionadas.length === 1 ? 'foto seleccionada' : 'fotos seleccionadas'}
      </div>

      {/* Subsección 2: agregar nueva foto */}
      {!readOnly && (
        <>
          <p style={s.subSeccionTitulo}>Agregar nueva foto 📸</p>
          <input ref={inputCamaraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFotoSeleccionada} />
          <input ref={inputGaleriaRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFotoSeleccionada} />
          <div style={s.fotosBotones}>
            <button style={s.btnFoto} onClick={() => inputCamaraRef.current?.click()}>📷 Sacar foto</button>
            <button style={{ ...s.btnFoto, background: '#0f3460' }} onClick={() => inputGaleriaRef.current?.click()}>🖼 Adjuntar foto</button>
          </div>
        </>
      )}

      {/* Fotos seleccionadas (combinadas) */}
      <p style={s.subSeccionTitulo}>Fotos seleccionadas{fotosCombinadas.length > 0 ? ` (${fotosCombinadas.length})` : ''}</p>
      {fotosCombinadas.length > 0 ? (
        <div style={s.fotosGrid}>
          {fotosCombinadas.map(foto => (
            <div key={foto.id} style={s.fotoCard}>
              <div
                style={{ ...s.fotoThumb, cursor: readOnly ? 'default' : 'pointer' }}
                onClick={() => abrirEditarFoto(foto)}
              >
                <img src={foto.dataUrlRecortado || foto.dataUrl || foto.storageUrl} alt="" style={s.fotoImg} />
                {!readOnly && (
                  <div style={s.fotoThumbOverlay}>✏️</div>
                )}
                {!readOnly && (
                  <button
                    style={s.btnEliminarFoto}
                    onClick={e => { e.stopPropagation(); foto.origen === 'nueva' ? eliminarFoto(foto.fotoId) : quitarFotoNube(foto.key); }}
                    title="Quitar de la selección"
                  >
                    ×
                  </button>
                )}
              </div>
              <input
                type="text"
                defaultValue={foto.descripcion}
                placeholder="Descripción..."
                style={s.fotoDescInput}
                readOnly={readOnly}
                onBlur={e => foto.origen === 'nueva'
                  ? db.fotos.update(foto.fotoId, { descripcion: e.target.value })
                  : setDescFotoNube(foto.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p style={s.sinFotos}>Sin fotos seleccionadas</p>
      )}
    </Seccion>
  );

  return (
    <div style={s.page}>
      <div style={s.header}>
        {!embedded && (
          <button style={s.btnVolver} onClick={() => navigate(volverUrl)}>← Volver</button>
        )}
        <div style={s.headerInfo}>
          <h1 style={s.titulo}>{titulo}</h1>
          <EstadoBadge estado={estado} />
        </div>
      </div>

      {/* ── Tarjetas informativas ──────────────────────────────────────────────── */}
      <div style={s.tarjetasRow}>
        {/* Tarjeta EDP */}
        <div style={{ ...s.tarjetaInfo, ...(edp ? s.tarjetaInfoAzul : s.tarjetaInfoGris) }}>
          <span style={s.tarjetaInfoLabel}>EDP</span>
          <span style={s.tarjetaInfoValor}>{edp ? `📄 ${edp}` : 'Sin EDP asignado'}</span>
        </div>

        {/* Tarjeta estado de avance */}
        {(() => {
          const terminado = estado === 'completado' || estado === 'enviado';
          if (terminado) {
            return (
              <div style={{ ...s.tarjetaInfo, ...s.tarjetaInfoAzul }}>
                <span style={s.tarjetaInfoLabel}>Avance</span>
                <span style={s.tarjetaInfoValor}>📋 Protocolo listo</span>
              </div>
            );
          }
          if (avanceDisponible === null) {
            return (
              <div style={{ ...s.tarjetaInfo, ...s.tarjetaInfoGris }}>
                <span style={s.tarjetaInfoLabel}>Avance</span>
                <span style={s.tarjetaInfoValor}>Consultando...</span>
              </div>
            );
          }
          if (avanceDisponible) {
            return (
              <div style={{ ...s.tarjetaInfo, ...s.tarjetaInfoVerde }}>
                <span style={s.tarjetaInfoLabel}>Avance</span>
                <span style={s.tarjetaInfoValor}>✅ Disponible para protocolizar</span>
              </div>
            );
          }
          return (
            <div style={{ ...s.tarjetaInfo, ...s.tarjetaInfoAmarillo }}>
              <span style={s.tarjetaInfoLabel}>Avance</span>
              <span style={s.tarjetaInfoValor}>⏳ Pendiente de recepción</span>
            </div>
          );
        })()}
      </div>

      {esHA && (
        /* ── Camiones registrados desde Recepción de Camiones ────────────────── */
        <Seccion titulo="Camiones registrados">
          <div style={s.badgeCamiones}>🚛 {camionesRegistrados.length} camiones registrados</div>
          {cargandoCamiones ? (
            <p style={s.sinFotos}>Cargando camiones...</p>
          ) : camionesRegistrados.length === 0 ? (
            <p style={s.sinFotos}>No hay camiones registrados para este elemento. Usa el módulo Recibir Camión.</p>
          ) : (
            <div style={s.camionesList}>
              {camionesRegistrados.map(c => (
                <CamionRegistradoCard
                  key={c.key}
                  camion={c}
                  expandido={expandidoCamion === c.key}
                  onToggle={() => setExpandidoCamion(prev => prev === c.key ? null : c.key)}
                  editando={editandoCamion === c.key}
                  onEditar={() => setEditandoCamion(c.key)}
                  onCancelarEdicion={() => setEditandoCamion(null)}
                  onGuardarEdicion={(nuevoTipo, nuevoEntidadId) => actualizarEntidadCamion(c, nuevoTipo, nuevoEntidadId)}
                />
              ))}
            </div>
          )}
        </Seccion>
      )}

      {soloFotos ? (
        /* ── Vista solo-fotos (ej. G5 Emplantillado) ─────────────────────────── */
        seccionFotos
      ) : (
        /* ── Checklist (si aplica) + observaciones + fotos ───────────────────── */
        <>
          {itemsChecklist.length > 0 && (
            <Seccion titulo={`Lista de verificación (${respondidos}/${itemsChecklist.length})`}>
              <div style={s.checklist}>
                {itemsChecklist.map(item => {
                  const entry = checklist[item.id] ?? { valor: null, obs: '' };
                  const itemDef = defaultsDef?.items.find(d => d.id === item.id);
                  const textosTipo = itemDef?.textos ?? [];
                  const textoSelected = textosTipo.find(t => t === entry.obs) ?? '';
                  return (
                    <div key={item.id} style={isMobile ? s.checkItemMobile : s.checkItemDesktop}>
                      <span style={isMobile ? s.checkLabelMobile : s.checkLabelDesktop}>
                        {item.label}
                      </span>
                      <div style={s.checkBtns}>
                        {['si', 'no', 'na'].map(opcion => {
                          const active = entry.valor === opcion;
                          return (
                            <button
                              key={opcion}
                              style={{
                                ...s.checkBtn,
                                background: active ? OPCION_COLOR[opcion] : 'transparent',
                                borderColor: active ? OPCION_COLOR[opcion] : '#0f3460',
                                color: active ? '#fff' : '#8892b0',
                                cursor: readOnly ? 'default' : 'pointer',
                                opacity: readOnly && !active ? 0.5 : 1,
                              }}
                              onClick={() => setCheckValue(item.id, opcion)}
                              disabled={readOnly}
                            >
                              {opcion === 'si' ? 'SÍ' : opcion === 'no' ? 'NO' : 'N/A'}
                            </button>
                          );
                        })}
                      </div>
                      <div style={isMobile ? s.checkObsColMobile : s.checkObsColDesktop}>
                        {entry.valor === 'si' && textosTipo.length > 0 && !readOnly && (
                          <select
                            style={s.textoTipoSelect}
                            value={textoSelected}
                            onChange={e => { if (e.target.value) setCheckObs(item.id, e.target.value); }}
                          >
                            <option value="">Seleccionar texto tipo o escribir observación...</option>
                            {textosTipo.map((t, i) => (
                              <option key={i} value={t}>{t.length > 80 ? t.substring(0, 80) + '…' : t}</option>
                            ))}
                          </select>
                        )}
                        <textarea
                          style={isMobile ? s.checkObsMobile : s.checkObsDesktop}
                          value={entry.obs}
                          onChange={e => setCheckObs(item.id, e.target.value)}
                          placeholder="Observación..."
                          rows={2}
                          readOnly={readOnly}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Seccion>
          )}

          {/* Observaciones generales */}
          <Seccion titulo="Observaciones">
            <textarea
              style={s.textarea}
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              placeholder="Notas adicionales, condiciones del terreno, anomalías observadas..."
              rows={4}
              readOnly={readOnly}
            />
          </Seccion>

          {seccionFotos}
        </>
      )}

      {/* Acciones — siempre visibles */}
      <div style={s.accionesCabecera}>
        {supabase && (
          <span style={s.syncLabel}>
            {sincronizando ? '🔄 sincronizando...' : protocolo?.sincronizada ? '☁️ sincronizado' : '🔄 pendiente'}
          </span>
        )}
      </div>
      {readOnly ? (
        <div style={s.enviadoBox}>
          <span style={s.enviadoBadge}>📤 Enviado el {formatearFechaEnvio(fechaEnvio)}</span>
          <button style={s.btnDesbloquear} onClick={() => setConfirmandoDesbloqueo(true)}>
            🔓 Desbloquear
          </button>
        </div>
      ) : (
        <div style={s.acciones}>
          <button style={{ ...s.btnAccion, ...s.btnBorrador }} onClick={() => guardar('borrador')} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button
            style={{ ...s.btnAccion, ...s.btnCompletar, opacity: estado === 'completado' ? 0.6 : 1 }}
            onClick={() => setConfirmando(true)}
            disabled={guardando || estado === 'completado'}
          >
            {estado === 'completado' ? '✓ Completado' : 'Marcar como completado'}
          </button>
          {estado === 'completado' && (
            <button
              style={{ ...s.btnAccion, ...s.btnEnviar }}
              onClick={() => setConfirmandoEnvio(true)}
              disabled={guardando}
            >
              📤 Marcar como enviado
            </button>
          )}
        </div>
      )}

      {protocolo && (
        <div style={s.accionesSecundarias}>
          <button
            style={{ ...s.btnAccion, ...s.btnVistaPrevia, opacity: generandoPreview ? 0.6 : 1 }}
            onClick={abrirVistaPrevia}
            disabled={generandoPreview}
          >
            {generandoPreview ? 'Generando...' : '👁️ Vista Previa'}
          </button>
          <button
            style={{ ...s.btnAccion, ...s.btnExcel, opacity: descargando ? 0.6 : 1 }}
            onClick={async () => {
              setDescargando(true);
              try { await generarPDF(protocolo, fotosCombinadas, kmInicio, kmFin, camionesRegistrados); }
              catch (err) {
                console.error('Error PDF:', err);
                mostrarToast('Error al generar PDF', 'error');
              }
              finally { setDescargando(false); }
            }}
            disabled={descargando}
          >
            {descargando ? 'Generando...' : '⬇ Descargar PDF'}
          </button>
        </div>
      )}

      <Toast toast={toast} />

      {confirmando && (
        <ModalConfirmar
          onConfirmar={async () => { setConfirmando(false); await guardar('completado'); }}
          onCancelar={() => setConfirmando(false)}
        />
      )}

      {confirmandoEnvio && (
        <ModalConfirmar
          titulo="¿Confirmar envío?"
          texto="¿Confirmar que este protocolo fue enviado al ITO?"
          textoConfirmar="Confirmar"
          colorConfirmar="#3b82f6"
          onConfirmar={async () => {
            setConfirmandoEnvio(false);
            await guardar('enviado', { fechaEnvio: fechaHoy() }, '📤 Protocolo marcado como enviado');
          }}
          onCancelar={() => setConfirmandoEnvio(false)}
        />
      )}

      {confirmandoDesbloqueo && (
        <ModalConfirmar
          titulo="¿Desbloquear protocolo?"
          texto="El protocolo volverá a estado completado y podrás editarlo nuevamente."
          textoConfirmar="Desbloquear"
          colorConfirmar="#f59e0b"
          onConfirmar={async () => {
            setConfirmandoDesbloqueo(false);
            await guardar('completado', { fechaEnvio: null }, '🔓 Protocolo desbloqueado');
          }}
          onCancelar={() => setConfirmandoDesbloqueo(false)}
        />
      )}

      {fotoActualModal && (
        <div style={s.fotoModalOverlay} onClick={cerrarFotoNubeModal}>
          <div style={s.fotoModalContent} onClick={e => e.stopPropagation()}>
            <button style={s.fotoModalCerrar} onClick={cerrarFotoNubeModal}>✕</button>

            {/* ── Rotación ────────────────────────────────────────────────── */}
            {!readOnly && !fotoModalSeleccionada && (
              <div style={s.rotacionRow}>
                <button style={s.btnRotar} onClick={() => rotarImagen(-1)}>↺ Rotar izquierda</button>
                <button style={s.btnRotar} onClick={() => rotarImagen(1)}>↻ Rotar derecha</button>
              </div>
            )}

            {/* ── Imagen ──────────────────────────────────────────────────── */}
            <div style={s.fotoModalImgWrap}>
              {modoCrop ? (
                /* MODO EDICIÓN — ReactCrop interactivo */
                <ReactCrop
                  crop={cropActivo ?? cropGuardado}
                  onChange={(_, pct) => setCropActivo(pct)}
                  aspect={esHA ? 4/3 : 3/4}
                  keepSelection
                >
                  <img
                    ref={imgRef}
                    src={imgRotada ?? srcUrlModal}
                    crossOrigin="anonymous"
                    alt="recortar"
                    style={{ maxWidth: '100%', maxHeight: '52vh', display: 'block' }}
                    onLoad={e => {
                      const c = cropGuardado ?? calcCentrado(e.currentTarget);
                      setCropActivo(c);
                      if (!cropGuardado) setCropGuardado(c);
                    }}
                  />
                </ReactCrop>
              ) : (
                /* MODO PREVIEW — imagen con overlay sutil */
                <>
                  {fotosTerrenoFiltradas.length > 1 && (
                    <button style={{ ...s.fotoModalNavBtn, left: '8px' }} onClick={() => navegarFotoNubeModal(-1)}>‹</button>
                  )}
                  <div style={{ position: 'relative', lineHeight: 0 }}>
                    <img
                      ref={imgRef}
                      src={imgRotada ?? srcUrlModal}
                      crossOrigin="anonymous"
                      alt=""
                      style={s.fotoModalImg}
                      onLoad={e => {
                        if (!cropGuardado) {
                          const c = calcCentrado(e.currentTarget);
                          setCropActivo(c);
                          setCropGuardado(c);
                        }
                      }}
                    />
                    {cropGuardado && (
                      <div style={{
                        ...s.cropOverlayRect,
                        left:   `${cropGuardado.x}%`,
                        top:    `${cropGuardado.y}%`,
                        width:  `${cropGuardado.width}%`,
                        height: `${cropGuardado.height}%`,
                      }} />
                    )}
                  </div>
                  {fotosTerrenoFiltradas.length > 1 && (
                    <button style={{ ...s.fotoModalNavBtn, right: '8px' }} onClick={() => navegarFotoNubeModal(1)}>›</button>
                  )}
                </>
              )}
            </div>

            {/* ── Descripción ─────────────────────────────────────────────── */}
            <div style={s.fotoModalInfo}>
              <label style={s.fotoModalDescLabel}>Descripción</label>
              <textarea
                style={s.fotoModalDescInput}
                rows={2}
                value={descModalTexto}
                onChange={e => setDescModalTexto(e.target.value)}
                readOnly={readOnly}
                placeholder="Agregar descripción..."
              />
            </div>

            {/* ── Botones ─────────────────────────────────────────────────── */}
            {!readOnly && (
              <div style={s.fotoModalBotones}>
                {modoCrop ? (
                  <>
                    <button style={s.btnFotoModalSecundario} onClick={() => {
                      setCropActivo(cropGuardado); // descartar cambios, volver a lo guardado
                      setModoCrop(false);
                    }}>
                      ↩ Cancelar
                    </button>
                    <button style={s.btnFotoModalPrimario} onClick={() => {
                      if (cropActivo) setCropGuardado(cropActivo);
                      setModoCrop(false);
                    }}>
                      ✅ Confirmar
                    </button>
                  </>
                ) : fotoModalSeleccionada ? (
                  <button style={s.btnFotoModalSecundario} onClick={cerrarFotoNubeModal}>Cerrar</button>
                ) : (
                  <>
                    <button style={s.btnFotoModalSecundario} onClick={() => {
                      setCropActivo(cropGuardado ?? null);
                      setModoCrop(true);
                    }}>
                      ✂️ Ajustar recorte
                    </button>
                    <button style={s.btnFotoModalPrimario} onClick={agregarAlProtocolo}>
                      Agregar al protocolo
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {cropModal && (
        <div style={s.cropModalOverlay} onClick={cancelarCrop}>
          <div style={s.cropModalContent} onClick={e => e.stopPropagation()}>
            <div style={s.cropModalTitulo}>
              {cropModal.tipo?.startsWith('editar') ? '✏️ Editar foto' : '✂️ Recortar foto'}
              <span style={{ fontSize: '12px', color: '#8892b0', fontWeight: 400, marginLeft: '8px' }}>
                {esHA ? 'Proporción fija 4:3' : 'Proporción fija 3:4'}
              </span>
            </div>
            <div style={s.rotacionRow}>
              <button style={s.btnRotar} onClick={() => rotarImagen(-1, cropModal.srcUrl)}>↺ Rotar izquierda</button>
              <button style={s.btnRotar} onClick={() => rotarImagen(1, cropModal.srcUrl)}>↻ Rotar derecha</button>
            </div>
            <div style={s.cropWrapper}>
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCompletedCrop(c)}
                aspect={esHA ? 4/3 : 3/4}
                keepSelection
              >
                <img
                  ref={imgCropRef}
                  src={imgRotada ?? cropModal.srcUrl}
                  crossOrigin="anonymous"
                  alt="recortar"
                  onLoad={onCropImageLoad}
                  style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block' }}
                />
              </ReactCrop>
            </div>
            <div style={s.cropBotones}>
              <button style={s.btnCropUsar} onClick={confirmarCrop}>
                {cropModal.tipo?.startsWith('editar') ? '✔ Confirmar cambios' : '✔ Usar recorte'}
              </button>
              <button style={s.btnCropCancelar} onClick={cancelarCrop}>✕ Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {previewPDF && (
        <div style={s.previewOverlay} onClick={cerrarVistaPrevia}>
          <div style={s.previewContent} onClick={(e) => e.stopPropagation()}>
            <div style={s.previewHeader}>
              <span style={s.previewTitulo}>👁️ Vista previa — {previewPDF.filename}</span>
              <div style={s.previewBotones}>
                <button style={s.btnPreviewDescargar} onClick={descargarDesdeVistaPrevia}>⬇ Descargar</button>
                <button style={s.btnPreviewCerrar} onClick={cerrarVistaPrevia}>✕ Cerrar</button>
              </div>
            </div>
            <iframe title="Vista previa PDF" src={previewPDF.url} style={s.previewIframe} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const obsInputBase = {
  background: '#0a1f3a',
  border: '1px solid #1e3a5f',
  borderRadius: '6px',
  color: '#ccd6f6',
  fontSize: '12px',
  padding: '6px 9px',
  fontFamily: 'inherit',
  outline: 'none',
  resize: 'none',
  lineHeight: '1.4',
};

const s = {
  page: { maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' },
  cargando: { color: '#8892b0', padding: '40px', textAlign: 'center' },

  header: { marginBottom: '24px' },
  btnVolver: { background: 'transparent', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: '14px', padding: '0 0 12px' },
  headerInfo: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  titulo: { color: '#ccd6f6', fontSize: '20px', fontWeight: 700, flex: 1 },
  estadoBadge: { fontSize: '12px', fontWeight: 600, border: '1.5px solid', borderRadius: '6px', padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0 },
  tarjetasRow: { display: 'flex', gap: '10px', padding: '0 16px 8px', flexWrap: 'wrap' },
  tarjetaInfo: { display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 14px', borderRadius: '8px', border: '1px solid', minWidth: '140px', flex: '1 1 140px' },
  tarjetaInfoLabel: { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', opacity: 0.7 },
  tarjetaInfoValor: { fontSize: '13px', fontWeight: 600 },
  tarjetaInfoAzul: { background: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.35)', color: '#93c5fd' },
  tarjetaInfoVerde: { background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.35)', color: '#6ee7b7' },
  tarjetaInfoAmarillo: { background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.35)', color: '#fcd34d' },
  tarjetaInfoGris: { background: 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.35)', color: '#94a3b8' },

  seccion: { background: '#16213e', borderRadius: '12px', padding: '20px', border: '1px solid #0f3460', marginBottom: '16px' },
  seccionTitulo: { color: '#8892b0', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' },

  checklist: { display: 'flex', flexDirection: 'column' },
  checkItemDesktop: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 0', borderBottom: '1px solid #0f3460' },
  checkLabelDesktop: { color: '#ccd6f6', fontSize: '13px', flex: 1, lineHeight: 1.4, paddingTop: '6px' },
  checkObsDesktop: { ...obsInputBase, width: '100%' },
  checkItemMobile: { display: 'flex', flexDirection: 'column', gap: '7px', padding: '10px 0', borderBottom: '1px solid #0f3460' },
  checkLabelMobile: { color: '#ccd6f6', fontSize: '13px', lineHeight: 1.4 },
  checkObsMobile: { ...obsInputBase, width: '100%' },
  checkBtns: { display: 'flex', gap: '4px', flexShrink: 0 },
  checkBtn: { padding: '5px 9px', border: '1.5px solid', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s', minWidth: '36px', textAlign: 'center' },
  checkObsColDesktop: { display: 'flex', flexDirection: 'column', gap: '4px', width: '190px', flexShrink: 0 },
  checkObsColMobile:  { display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' },
  textoTipoSelect: { ...obsInputBase, width: '100%', cursor: 'pointer', paddingRight: '6px' },
  fotosSugeridasBanner: { background: 'rgba(100,116,139,0.12)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: '8px', marginBottom: '14px', overflow: 'hidden' },
  fotosSugeridasToggle: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', fontWeight: 700, padding: '8px 12px', cursor: 'pointer', textAlign: 'left' },
  fotosSugeridasLista: { listStyle: 'none', margin: 0, padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: '4px' },
  fotosSugeridasItem: { color: '#64748b', fontSize: '12px', lineHeight: 1.4 },

  badgeCamiones: { background: '#0a2040', border: '1px solid #64ffda', borderRadius: '8px', padding: '8px 14px', color: '#ccd6f6', fontSize: '13px', fontWeight: 700, marginBottom: '12px', textAlign: 'center' },
  camionesList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  camionRegCard: { background: '#0f3460', borderRadius: '8px', border: '1px solid #1e3a5f', overflow: 'hidden' },
  camionFila: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', cursor: 'pointer' },
  camionInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  camionTipo: { color: '#ccd6f6', fontSize: '13px', fontWeight: 600 },
  camionMeta: { color: '#8892b0', fontSize: '11px' },
  chevronSm: { color: '#8892b0', fontSize: '18px' },
  camionDetalle: { padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #1e3a5f' },
  detalleGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '12px' },
  detalleLabel: { display: 'block', color: '#8892b0', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
  detalleValor: { display: 'block', color: '#ccd6f6', fontSize: '13px', marginTop: '2px' },
  camionObs: { color: '#ccd6f6', fontSize: '13px', background: '#0a1f3a', borderRadius: '6px', padding: '8px 10px', margin: 0, lineHeight: 1.5 },
  editEntidadForm: { display: 'flex', flexDirection: 'column', gap: '8px' },
  editEntidadBotones: { display: 'flex', gap: '8px' },
  btnEditarEntidad: { background: 'transparent', border: '1px solid #1e3a5f', color: '#8892b0', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' },
  inputEdit: { background: '#0a1f3a', border: '1px solid #1e3a5f', borderRadius: '7px', color: '#ccd6f6', fontSize: '14px', padding: '10px 12px', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' },

  textarea: { width: '100%', background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '8px', color: '#ccd6f6', fontSize: '14px', padding: '12px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', outline: 'none' },
  fotosBotones: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' },
  btnFoto: { background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', flex: '1 1 140px' },
  fotosGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' },
  fotoCard: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fotoThumb: { position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden' },
  fotoThumbSeleccionada: { outline: '3px solid #64ffda', outlineOffset: '-3px' },
  fotoImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  btnEliminarFoto: { position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', fontSize: '16px', lineHeight: '20px', cursor: 'pointer', padding: 0, textAlign: 'center' },
  fotoDescInput: { width: '100%', background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '6px', color: '#ccd6f6', fontSize: '11px', padding: '5px 7px', fontFamily: 'inherit', outline: 'none', lineHeight: '1.4' },
  sinFotos: { color: '#8892b0', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', margin: '8px 0 0' },

  subSeccionTitulo: { color: '#64ffda', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', margin: '18px 0 10px' },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' },
  chip: { background: '#0f3460', color: '#8892b0', border: '1px solid #1e3a5f', borderRadius: '14px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  chipActivo: { background: '#64ffda', color: '#0a1f3a', borderColor: '#64ffda' },
  checkOverlay: { position: 'absolute', top: '6px', left: '6px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '2px', display: 'flex' },
  checkboxNube: { width: '18px', height: '18px', cursor: 'pointer' },
  badgeSeleccion: { background: '#0a2040', border: '1px solid #64ffda', borderRadius: '8px', padding: '8px 14px', color: '#ccd6f6', fontSize: '13px', fontWeight: 600, marginBottom: '4px', textAlign: 'center' },
  btnBuscarOtraEntidad: { width: '100%', background: '#0a1f3a', color: '#8892b0', border: '1px dashed #1e3a5f', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', marginBottom: '4px' },
  panelBusqueda: { display: 'flex', flexDirection: 'column', gap: '8px', background: '#0a1f3a', border: '1px solid #1e3a5f', borderRadius: '10px', padding: '12px', marginBottom: '4px' },
  busquedaActivaBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', background: 'rgba(100,255,218,0.07)', border: '1px solid rgba(100,255,218,0.2)', borderRadius: '8px', padding: '8px 12px', marginBottom: '4px' },
  busquedaActivaLabel: { color: '#ccd6f6', fontSize: '13px' },
  btnResetBusqueda: { background: 'none', border: '1px solid #1e3a5f', borderRadius: '6px', color: '#8892b0', fontSize: '12px', fontWeight: 600, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' },

  accionesCabecera: { display: 'flex', justifyContent: 'flex-end', marginBottom: '6px', minHeight: '20px' },
  syncLabel: { color: '#8892b0', fontSize: '12px' },
  acciones: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  accionesSecundarias: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '10px' },
  btnAccion: { flex: '1 1 140px', padding: '14px 20px', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', border: 'none' },
  btnBorrador: { background: '#0f3460', color: '#ccd6f6' },
  btnCompletar: { background: '#10b981', color: '#fff' },
  btnEnviar: { background: '#3b82f6', color: '#fff' },
  btnExcel: { background: '#1d6a34', color: '#fff', width: '100%', fontSize: '14px' },
  btnVistaPrevia: { background: '#0ea5e9', color: '#fff', width: '100%', fontSize: '14px' },

  enviadoBox: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
    background: '#0a2040', border: '1px solid #3b82f6', borderRadius: '10px', padding: '14px 18px',
  },
  enviadoBadge: { color: '#3b82f6', fontSize: '14px', fontWeight: 700 },
  btnDesbloquear: {
    background: 'transparent', border: '1.5px solid #f59e0b', color: '#f59e0b',
    borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
  },

  toast: { position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', color: '#fff', padding: '12px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' },
  modal: { background: '#16213e', borderRadius: '16px', padding: '32px 28px', maxWidth: '360px', width: '100%', border: '1px solid #0f3460' },
  modalTitulo: { color: '#ccd6f6', fontSize: '18px', fontWeight: 700, marginBottom: '12px' },
  modalTexto: { color: '#8892b0', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' },
  modalBotones: { display: 'flex', gap: '10px' },
  btnModalCancelar: { flex: 1, padding: '12px', background: '#0f3460', color: '#ccd6f6', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  btnModalConfirmar: { flex: 1, padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },

  fotoModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '16px' },
  fotoModalContent: { background: '#16213e', borderRadius: '16px', padding: '20px', maxWidth: '560px', width: '100%', border: '1px solid #0f3460', position: 'relative', maxHeight: '92vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' },
  fotoModalCerrar: { position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', lineHeight: '30px', cursor: 'pointer', padding: 0, textAlign: 'center', zIndex: 1 },
  fotoModalImgWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a1f3a', borderRadius: '10px', minHeight: '200px', overflow: 'hidden', position: 'relative' },
  fotoModalImg: { maxWidth: '100%', maxHeight: '58vh', display: 'block' },
  fotoModalNavBtn: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '20px', lineHeight: '34px', cursor: 'pointer', textAlign: 'center', padding: 0, zIndex: 2 },
  fotoModalInfo: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fotoModalDescLabel: { color: '#64ffda', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' },
  fotoModalDescInput: { width: '100%', background: '#0f3460', border: '1px solid #1e3a5f', borderRadius: '6px', color: '#ccd6f6', fontSize: '13px', padding: '8px 10px', fontFamily: 'inherit', outline: 'none', lineHeight: '1.4', resize: 'vertical' },
  fotoModalBotones: { display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' },
  rotacionRow: { display: 'flex', gap: '8px', justifyContent: 'center' },
  btnRotar: { padding: '6px 14px', background: '#0f3460', color: '#ccd6f6', border: '1px solid #1e3a5f', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  btnFotoModalPrimario: { padding: '10px 22px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  btnFotoModalSecundario: { padding: '10px 18px', background: '#0f3460', color: '#ccd6f6', border: '1px solid #1e3a5f', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  cropOverlayRect: { position: 'absolute', border: '2px dashed rgba(255,255,255,0.8)', boxShadow: '0 0 8px rgba(0,0,0,0.5)', boxSizing: 'border-box', pointerEvents: 'none' },
  fotoThumbOverlay: { position: 'absolute', bottom: '4px', left: '4px', fontSize: '14px', opacity: 0.8, pointerEvents: 'none' },

  previewOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: '16px' },
  previewContent: { background: '#16213e', borderRadius: '16px', border: '1px solid #0f3460', width: '90vw', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  previewHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #0f3460', flexWrap: 'wrap' },
  previewTitulo: { color: '#ccd6f6', fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  previewBotones: { display: 'flex', gap: '10px', flexShrink: 0 },
  btnPreviewDescargar: { padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  btnPreviewCerrar: { padding: '8px 16px', background: '#0f3460', color: '#ccd6f6', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },
  previewIframe: { flex: 1, width: '100%', border: 'none', background: '#fff' },

  // ── Crop modal ────────────────────────────────────────────────────────────────
  cropModalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  cropModalContent: { background: '#16213e', borderRadius: '14px', border: '1px solid #0f3460', width: '100%', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', boxSizing: 'border-box' },
  cropModalTitulo: { color: '#64ffda', fontSize: '16px', fontWeight: 700 },
  cropWrapper: { display: 'flex', justifyContent: 'center', background: '#0a0a1a', borderRadius: '8px', overflow: 'hidden', minHeight: '200px', alignItems: 'center' },
  cropBotones: { display: 'flex', gap: '12px', justifyContent: 'flex-end' },
  btnCropUsar: { padding: '10px 22px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  btnCropCancelar: { padding: '10px 22px', background: '#0f3460', color: '#ccd6f6', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
};
