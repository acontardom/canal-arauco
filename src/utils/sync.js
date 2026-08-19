import { db } from '../db/database';
import { supabase } from '../config/supabase';
import { uploadFoto } from './uploadFoto';
import { normalizarEntidadId } from '../constants/estructura';

async function conReintentos(fn, intentos = 3, espera = 1000) {
  for (let i = 0; i < intentos; i++) {
    try {
      const resultado = await fn();
      if (resultado) return resultado;
    } catch (err) {
      console.warn(`[Sync] Intento ${i + 1} fallido:`, err?.message ?? err);
    }
    if (i < intentos - 1) await new Promise(r => setTimeout(r, espera * (i + 1)));
  }
  return null;
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── Subida de fotos de terreno pendientes a Supabase Storage ────────────────

async function subirFotosTerrenoPendientes() {
  const pendientes = await db.fotos_terreno
    .filter(f => !f.subidaStorage && Boolean(f.dataUrl))
    .toArray();

  for (const foto of pendientes) {
    const storageUrl = await conReintentos(() => uploadFoto(foto.dataUrl, {
      tipo:      foto.tipo,
      entidadId: foto.entidadId,
      carpeta:   'terreno',
    }));

    if (storageUrl) {
      await db.fotos_terreno.update(foto.id, { storageUrl, subidaStorage: true, dataUrl: null });
      if (foto.deviceFotoTerrenoId) {
        try {
          await supabase.from('fotos_terreno')
            .update({ storage_url: storageUrl, subida_storage: true, data_url: null })
            .eq('device_foto_terreno_id', foto.deviceFotoTerrenoId);
        } catch (err) {
          console.warn(`[Sync] FotoTerreno ${foto.id} — no se pudo limpiar data_url en Supabase:`, err?.message ?? err);
        }
      }
    } else {
      console.warn(`[Sync] FotoTerreno ${foto.id} no se pudo subir tras 3 intentos — se reintentará en el próximo ciclo`);
    }
  }
}

// ─── Sincronización de fotos de terreno ──────────────────────────────────────

async function sincronizarFotosTerreno() {
  const pendientes = await db.fotos_terreno
    .filter(f => !f.sincronizada)
    .toArray();

  for (const foto of pendientes) {
    try {
      // Garantizar UUID permanente para registros anteriores a v10
      if (!foto.deviceFotoTerrenoId) {
        const deviceFotoTerrenoId = generateUUID();
        await db.fotos_terreno.update(foto.id, { deviceFotoTerrenoId });
        foto.deviceFotoTerrenoId = deviceFotoTerrenoId;
      }

      const { data, error } = await supabase
        .from('fotos_terreno')
        .upsert(
          {
            device_foto_terreno_id: foto.deviceFotoTerrenoId,
            local_id:       foto.id,
            tipo:           foto.tipo,
            entidad_id:     String(foto.entidadId),
            etiquetas:      foto.etiquetas ?? [],
            descripcion:    foto.descripcion ?? null,
            data_url:       foto.dataUrl,
            storage_url:    foto.storageUrl ?? null,
            subida_storage: foto.subidaStorage ?? false,
            usuario_nombre: foto.usuarioNombre ?? null,
            fecha_captura:  foto.fechaCaptura ?? null,
          },
          { onConflict: 'device_foto_terreno_id' }
        )
        .select();

      console.log(`FotoTerreno ${foto.id} — resultado Supabase:`, data, error);
      if (error) throw error;
      if (!data?.length) throw new Error('Upsert no retornó datos');

      await db.fotos_terreno.update(foto.id, { sincronizada: true });
    } catch (err) {
      console.warn(`[Sync] FotoTerreno ${foto.id}:`, err);
    }
  }
}

// ─── Subida de fotos de camiones pendientes a Supabase Storage ───────────────

async function subirFotosCamionesPendientes() {
  const camiones = await db.camiones.toArray();

  for (const camion of camiones) {
    let cambiado = false;
    const entidadPath = `${camion.tipoEntidad}/${camion.entidadId}`;
    let fotoGuia = camion.fotoGuia ?? null;
    let fotoGuiaUrl = camion.fotoGuiaUrl ?? null;
    let fotosEnsayo = camion.fotosEnsayo ?? [];
    let fotosEnsayoUrls = camion.fotosEnsayoUrls ?? [];

    if (fotoGuia?.dataUrl && !fotoGuiaUrl) {
      const storageUrl = await conReintentos(() => uploadFoto(fotoGuia.dataUrl, {
        tipo: 'camiones', entidadId: entidadPath, archivo: `guia_${Date.now()}.jpg`,
      }));
      if (storageUrl) {
        fotoGuiaUrl = storageUrl;
        fotoGuia = null;
        cambiado = true;
      } else {
        console.warn(`[Sync] Camion ${camion.id} fotoGuia no se pudo subir tras 3 intentos — se reintentará en el próximo ciclo`);
      }
    }

    if (fotosEnsayo.length) {
      const restantes = [];
      for (let i = 0; i < fotosEnsayo.length; i++) {
        const foto = fotosEnsayo[i];
        const storageUrl = await conReintentos(() => uploadFoto(foto.dataUrl, {
          tipo: 'camiones', entidadId: entidadPath, archivo: `ensayo_${Date.now()}_${i}.jpg`,
        }));
        if (storageUrl) {
          fotosEnsayoUrls = [...fotosEnsayoUrls, storageUrl];
          cambiado = true;
        } else {
          console.warn(`[Sync] Camion ${camion.id} fotoEnsayo ${i} no se pudo subir tras 3 intentos — se reintentará en el próximo ciclo`);
          restantes.push(foto);
        }
      }
      fotosEnsayo = restantes;
    }

    if (cambiado) {
      await db.camiones.update(camion.id, {
        fotoGuia, fotoGuiaUrl, fotosEnsayo, fotosEnsayoUrls,
        sincronizado: false,
      });
    }
  }
}

// ─── Sincronización de camiones ──────────────────────────────────────────────

async function sincronizarCamiones() {
  const pendientes = await db.camiones
    .filter(c => !c.sincronizado)
    .toArray();

  for (const camion of pendientes) {
    try {
      // Garantizar UUID permanente para registros anteriores a v9
      if (!camion.deviceCamionId) {
        const deviceCamionId = generateUUID();
        await db.camiones.update(camion.id, { deviceCamionId });
        camion.deviceCamionId = deviceCamionId;
      }

      const payload = {
        device_camion_id:        camion.deviceCamionId,
        local_id:                camion.id,
        tipo_entidad:            camion.tipoEntidad,
        entidad_id:              String(camion.entidadId),
        entidad_secundaria_tipo: camion.entidadSecundariaTipo ?? null,
        entidad_secundaria_id:   camion.entidadSecundariaId != null ? String(camion.entidadSecundariaId) : null,
        tipo_hormigon:           camion.tipoHormigon,
        uso_hormigon:            camion.usoHormigon ?? null,
        volumen:                 camion.volumen || null,
        numero_guia:             camion.numeroGuia || null,
        planta:                  camion.planta || null,
        cono:                    camion.cono || null,
        temp_hormigon:           camion.tempHormigon || null,
        temp_ambiente:           camion.tempAmbiente || null,
        hora_carga:              camion.horaCarga || null,
        hora_descarga:           camion.horaDescarga || null,
        tiempo_traslado:         camion.tiempoTraslado || null,
        peso_hoya_hormigon:      camion.pesoHoyaHormigon || null,
        pu_calculado:            camion.puCalculado || null,
        observaciones:           camion.observaciones ?? null,
        usuario_nombre:          camion.usuarioNombre ?? null,
        fecha_recepcion:         camion.fechaRecepcion ?? null,
        foto_guia_url:           camion.fotoGuiaUrl ?? null,
        fotos_ensayo_urls:       camion.fotosEnsayoUrls ?? [],
        estado_calidad:          camion.estadoCalidad ?? null,
        lleva_ensayo:            camion.llevaEnsayo ?? false,
        tipo_especificacion:     camion.tipoEspecificacion ?? null,
        valor_total:             camion.valorTotal ? Number(camion.valorTotal) : null,
      };

      const { data, error } = await supabase
        .from('camiones')
        .upsert(payload, { onConflict: 'device_camion_id' })
        .select('id')
        .single();

      console.log(`Camion ${camion.id} — resultado Supabase:`, data, error);
      if (error) throw error;
      if (!data) throw new Error('Upsert no retornó datos');

      await db.camiones.update(camion.id, {
        supabaseId:   data.id,
        sincronizado: true,
      });
    } catch (err) {
      console.warn(`[Sync] Camion ${camion.id}:`, err);
    }
  }
}

// ─── Descarga desde Supabase → Dexie ─────────────────────────────────────────

export async function descargarDesdeSupabase() {
  if (!supabase || !navigator.onLine) return;

  try {
    // ── Fotos de terreno ─────────────────────────────────────────────────────
    const { data: fotosTerrenoRemoto, error: errFotosTerreno } = await supabase
      .from('fotos_terreno')
      .select('id, device_foto_terreno_id, local_id, tipo, entidad_id, etiquetas, descripcion, storage_url, subida_storage, usuario_nombre, fecha_captura');

    if (errFotosTerreno) throw errFotosTerreno;

    for (const remoto of fotosTerrenoRemoto ?? []) {
      // Buscar por UUID permanente (v10+) → fallback a supabaseId
      const local = remoto.device_foto_terreno_id
        ? await db.fotos_terreno.where('deviceFotoTerrenoId').equals(remoto.device_foto_terreno_id).first()
        : null;

      if (!local) {
        await db.fotos_terreno.add({
          deviceFotoTerrenoId: remoto.device_foto_terreno_id ?? null,
          tipo:          remoto.tipo,
          entidadId:     normalizarEntidadId(remoto.tipo, remoto.entidad_id),
          etiquetas:     remoto.etiquetas ?? [],
          descripcion:   remoto.descripcion ?? null,
          dataUrl:       null,  // no se descarga — usar storageUrl
          storageUrl:    remoto.storage_url ?? null,
          subidaStorage: remoto.subida_storage ?? false,
          usuarioNombre: remoto.usuario_nombre ?? null,
          fechaCaptura:  remoto.fecha_captura ?? null,
          sincronizada:  true,
        });
      }
      // Si ya existe → no se modifica (las fotos no se editan)
    }

    // ── Camiones ──────────────────────────────────────────────────────────────
    const { data: camionesRemoto, error: errCamiones } = await supabase
      .from('camiones')
      .select('*');

    if (errCamiones) throw errCamiones;

    for (const remoto of camionesRemoto ?? []) {
      // Buscar por UUID permanente (v9+) → fallback a supabaseId
      let local = remoto.device_camion_id
        ? await db.camiones.where('deviceCamionId').equals(remoto.device_camion_id).first()
        : null;

      if (!local && remoto.id) {
        local = await db.camiones.where('supabaseId').equals(remoto.id).first();
      }

      if (!local) {
        await db.camiones.add({
          deviceCamionId:         remoto.device_camion_id ?? null,
          tipoEntidad:            remoto.tipo_entidad,
          entidadId:              normalizarEntidadId(remoto.tipo_entidad, remoto.entidad_id),
          entidadSecundariaTipo:  remoto.entidad_secundaria_tipo ?? null,
          entidadSecundariaId:    normalizarEntidadId(remoto.entidad_secundaria_tipo, remoto.entidad_secundaria_id) ?? null,
          tipoHormigon:           remoto.tipo_hormigon,
          usoHormigon:            remoto.uso_hormigon ?? null,
          volumen:                remoto.volumen ?? '',
          numeroGuia:             remoto.numero_guia ?? '',
          planta:                 remoto.planta ?? '',
          cono:                   remoto.cono ?? '',
          tempHormigon:           remoto.temp_hormigon ?? '',
          tempAmbiente:           remoto.temp_ambiente ?? '',
          horaCarga:              remoto.hora_carga ?? '',
          horaDescarga:           remoto.hora_descarga ?? '',
          tiempoTraslado:         remoto.tiempo_traslado ?? '',
          pesoHoyaHormigon:       remoto.peso_hoya_hormigon ?? '',
          puCalculado:            remoto.pu_calculado ?? '',
          observaciones:          remoto.observaciones ?? '',
          usuarioNombre:          remoto.usuario_nombre ?? null,
          fechaRecepcion:         remoto.fecha_recepcion ?? null,
          fotoGuiaUrl:            remoto.foto_guia_url ?? null,
          fotosEnsayoUrls:        remoto.fotos_ensayo_urls ?? [],
          estadoCalidad:          remoto.estado_calidad ?? null,
          tipoEspecificacion:     remoto.tipo_especificacion ?? null,
          valorTotal:             remoto.valor_total != null ? String(remoto.valor_total) : '',
          supabaseId:             remoto.id,
          sincronizado:           true,
        });
      }
      // Si ya existe → no se modifica (los camiones no se editan aquí)
    }
  } catch (err) {
    console.warn('[Sync] Error al descargar desde Supabase:', err?.message ?? err);
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

let _sincronizando = false;

export function estaSincronizando() {
  return _sincronizando;
}

export async function sincronizar() {
  if (!supabase || !navigator.onLine) return;
  _sincronizando = true;
  window.dispatchEvent(new CustomEvent('syncStarted'));
  try {
    await subirFotosTerrenoPendientes();
    await sincronizarFotosTerreno();
    await subirFotosCamionesPendientes();
    await sincronizarCamiones();
    await descargarDesdeSupabase();
  } catch (err) {
    console.warn('[Sync] Error general:', err?.message ?? err);
  } finally {
    _sincronizando = false;
    window.dispatchEvent(new CustomEvent('syncCompleted'));
  }
}

// Guard para evitar doble-inicio en React StrictMode (doble-mount en desarrollo)
let _autoSyncStarted = false;

export function iniciarSyncAutomatico() {
  if (_autoSyncStarted) return;
  _autoSyncStarted = true;

  // Sync automático solo en producción — en dev evita ruido de red
  if (import.meta.env.PROD) {
    // Sync inmediato al arrancar si hay conexión
    if (navigator.onLine) sincronizar();

    // Sync al recuperar señal
    window.addEventListener('online', () => {
      console.log('[Sync] Conexión recuperada — sincronizando...');
      sincronizar();
    });

    // Sync periódico cada 30 s
    setInterval(() => {
      if (navigator.onLine) sincronizar();
    }, 30_000);
  }
}
