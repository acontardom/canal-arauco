import { db } from '../db/database';
import { supabase } from '../config/supabase';
import { uploadFoto } from './uploadFoto';

// ─── Sincronización de protocolos ─────────────────────────────────────────────

async function sincronizarProtocolos() {
  const pendientes = await db.protocolos
    .filter(p => !p.supabaseId || p.sincronizada !== true)
    .toArray();

  for (const protocolo of pendientes) {
    try {
      const payload = {
        local_id:           protocolo.id,
        tipo:               protocolo.tipo,
        entidad:            protocolo.entidad,
        entidad_id:         String(protocolo.entidadId),
        protocolo_id:       protocolo.protocoloId,
        estado:             protocolo.estado,
        usuario_nombre:     protocolo.usuarioNombre ?? null,
        fecha_creacion:     protocolo.fechaCreacion ?? null,
        fecha_modificacion: protocolo.fechaModificacion ?? null,
        datos:              protocolo.datos ?? {},
      };

      // TODO: quitar este log una vez confirmado en producción
      console.log('[Sync] Enviando protocolo:', payload);

      const { data, error } = await supabase
        .from('protocolos')
        .upsert(payload, { onConflict: 'local_id' })
        .select('id')
        .single();

      if (error) throw error;

      await db.protocolos.update(protocolo.id, {
        supabaseId:  data.id,
        sincronizada: true,
      });
    } catch (err) {
      console.warn(`[Sync] Protocolo ${protocolo.id}:`, err?.message ?? err);
    }
  }
}

// ─── Subida de fotos pendientes a Supabase Storage ────────────────────────────

async function subirFotosPendientes() {
  const pendientes = await db.fotos
    .filter(f => !f.subidaStorage)
    .toArray();

  for (const foto of pendientes) {
    try {
      const protocoloLocal = await db.protocolos.get(foto.protocoloLocalId);
      if (!protocoloLocal) continue;

      const storageUrl = await uploadFoto(foto.dataUrl, {
        tipo:      protocoloLocal.tipo,
        entidadId: protocoloLocal.entidadId,
        nombre:    foto.nombre,
      });

      if (storageUrl) {
        await db.fotos.update(foto.id, { storageUrl, subidaStorage: true });
      }
    } catch (err) {
      console.warn(`[Sync] Foto Storage ${foto.id}:`, err?.message ?? err);
    }
  }
}

// ─── Subida de fotos de terreno pendientes a Supabase Storage ────────────────

async function subirFotosTerrenoPendientes() {
  const pendientes = await db.fotos_terreno
    .filter(f => !f.subidaStorage)
    .toArray();

  for (const foto of pendientes) {
    try {
      const storageUrl = await uploadFoto(foto.dataUrl, {
        tipo:      foto.tipo,
        entidadId: foto.entidadId,
        carpeta:   'terreno',
      });

      if (storageUrl) {
        await db.fotos_terreno.update(foto.id, { storageUrl, subidaStorage: true });
      }
    } catch (err) {
      console.warn(`[Sync] FotoTerreno Storage ${foto.id}:`, err?.message ?? err);
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
      const { error } = await supabase
        .from('fotos_terreno')
        .upsert(
          {
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
          { onConflict: 'local_id' }
        );

      if (error) throw error;

      await db.fotos_terreno.update(foto.id, { sincronizada: true });
    } catch (err) {
      console.warn(`[Sync] FotoTerreno ${foto.id}:`, err?.message ?? err);
    }
  }
}

// ─── Sincronización de fotos ──────────────────────────────────────────────────

async function sincronizarFotos() {
  const pendientes = await db.fotos
    .filter(f => !f.sincronizada)
    .toArray();

  for (const foto of pendientes) {
    try {
      const protocoloLocal = await db.protocolos.get(foto.protocoloLocalId);

      // No sincronizar fotos cuyo protocolo todavía no llegó a Supabase
      if (!protocoloLocal?.supabaseId) continue;

      const { error } = await supabase
        .from('fotos')
        .upsert(
          {
            local_id:          foto.id,
            protocolo_id:      protocoloLocal.supabaseId,
            protocolo_local_id: foto.protocoloLocalId,
            nombre:            foto.nombre ?? null,
            tipo_mime:         foto.tipo ?? null,
            data_url:          foto.dataUrl,
            descripcion:       foto.descripcion ?? null,
            storage_url:       foto.storageUrl ?? null,
            subida_storage:    foto.subidaStorage ?? false,
          },
          { onConflict: 'local_id' }
        );

      if (error) throw error;

      await db.fotos.update(foto.id, { sincronizada: true });
    } catch (err) {
      console.warn(`[Sync] Foto ${foto.id}:`, err?.message ?? err);
    }
  }
}

// ─── Subida de fotos de camiones pendientes a Supabase Storage ───────────────

async function subirFotosCamionesPendientes() {
  const camiones = await db.camiones.toArray();

  for (const camion of camiones) {
    let cambiado = false;
    const entidadPath = `${camion.tipoEntidad}/${camion.entidadId}`;

    if (camion.fotoGuia && !camion.fotoGuia.subidaStorage) {
      try {
        const storageUrl = await uploadFoto(camion.fotoGuia.dataUrl, {
          tipo: 'camiones', entidadId: entidadPath, nombre: 'guia',
        });
        if (storageUrl) {
          camion.fotoGuia = { ...camion.fotoGuia, storageUrl, subidaStorage: true };
          cambiado = true;
        }
      } catch (err) {
        console.warn(`[Sync] Camion ${camion.id} fotoGuia:`, err?.message ?? err);
      }
    }

    if (camion.fotosEnsayo?.length) {
      for (let i = 0; i < camion.fotosEnsayo.length; i++) {
        const foto = camion.fotosEnsayo[i];
        if (foto.subidaStorage) continue;
        try {
          const storageUrl = await uploadFoto(foto.dataUrl, {
            tipo: 'camiones', entidadId: entidadPath, nombre: `ensayo_${i}`,
          });
          if (storageUrl) {
            camion.fotosEnsayo[i] = { ...foto, storageUrl, subidaStorage: true };
            cambiado = true;
          }
        } catch (err) {
          console.warn(`[Sync] Camion ${camion.id} fotoEnsayo ${i}:`, err?.message ?? err);
        }
      }
    }

    if (cambiado) {
      await db.camiones.update(camion.id, {
        fotoGuia: camion.fotoGuia,
        fotosEnsayo: camion.fotosEnsayo,
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
      const payload = {
        local_id:                camion.id,
        tipo_entidad:            camion.tipoEntidad,
        entidad_id:              String(camion.entidadId),
        entidad_secundaria_tipo: camion.entidadSecundariaTipo ?? null,
        entidad_secundaria_id:   camion.entidadSecundariaId != null ? String(camion.entidadSecundariaId) : null,
        tipo_hormigon:           camion.tipoHormigon,
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
        foto_guia:               camion.fotoGuia ?? null,
        fotos_ensayo:            camion.fotosEnsayo ?? [],
      };

      const { data, error } = await supabase
        .from('camiones')
        .upsert(payload, { onConflict: 'local_id' })
        .select('id')
        .single();

      if (error) throw error;

      await db.camiones.update(camion.id, {
        supabaseId:   data.id,
        sincronizado: true,
      });
    } catch (err) {
      console.warn(`[Sync] Camion ${camion.id}:`, err?.message ?? err);
    }
  }
}

// ─── Descarga desde Supabase → Dexie ─────────────────────────────────────────

export async function descargarDesdeSupabase() {
  if (!supabase || !navigator.onLine) return;

  try {
    // ── Protocolos ────────────────────────────────────────────────────────────
    const { data: remotos, error: errProt } = await supabase
      .from('protocolos')
      .select('*');

    if (errProt) throw errProt;

    for (const remoto of remotos ?? []) {
      // Buscar en Dexie por local_id (clave primaria original) o por supabaseId
      let local = remoto.local_id ? await db.protocolos.get(remoto.local_id) : null;

      if (!local && remoto.id) {
        local = await db.protocolos.where('supabaseId').equals(remoto.id).first();
      }

      const dexieData = {
        tipo:              remoto.tipo,
        entidad:           remoto.entidad ?? remoto.tipo,
        // Las caídas se almacenan como Number en Dexie; los tramos como string
        entidadId:         remoto.tipo === 'caida'
                             ? Number(remoto.entidad_id)
                             : remoto.entidad_id,
        protocoloId:       remoto.protocolo_id,
        estado:            remoto.estado,
        usuarioNombre:     remoto.usuario_nombre ?? null,
        fechaCreacion:     remoto.fecha_creacion ?? null,
        fechaModificacion: remoto.fecha_modificacion ?? null,
        datos:             remoto.datos ?? {},
        supabaseId:        remoto.id,
        sincronizada:      true,
      };

      if (!local) {
        // Insertar preservando el local_id original como clave primaria de Dexie
        if (remoto.local_id) {
          await db.protocolos.put({ id: remoto.local_id, ...dexieData });
        } else {
          await db.protocolos.add(dexieData);
        }
      } else {
        // Actualizar solo si el remoto es más reciente (comparación lexicográfica de ISO)
        const fechaRemota = remoto.fecha_modificacion ?? '';
        const fechaLocal  = local.fechaModificacion ?? '';
        if (fechaRemota > fechaLocal) {
          await db.protocolos.update(local.id, dexieData);
        }
      }
    }

    // ── Fotos ─────────────────────────────────────────────────────────────────
    const { data: fotosRemoto, error: errFotos } = await supabase
      .from('fotos')
      .select('*');

    if (errFotos) throw errFotos;

    for (const remoto of fotosRemoto ?? []) {
      // Verificar existencia por local_id
      const local = remoto.local_id ? await db.fotos.get(remoto.local_id) : null;

      if (!local) {
        const fotoData = {
          protocoloLocalId: remoto.protocolo_local_id,
          nombre:           remoto.nombre ?? null,
          tipo:             remoto.tipo_mime ?? null,
          dataUrl:          remoto.data_url,
          descripcion:      remoto.descripcion ?? null,
          storageUrl:       remoto.storage_url ?? null,
          subidaStorage:    remoto.subida_storage ?? false,
          sincronizada:     true,
        };

        if (remoto.local_id) {
          await db.fotos.put({ id: remoto.local_id, ...fotoData });
        } else {
          await db.fotos.add(fotoData);
        }
      }
      // Si ya existe → no se modifica (las fotos no se editan)
    }

    // ── Fotos de terreno ─────────────────────────────────────────────────────
    const { data: fotosTerrenoRemoto, error: errFotosTerreno } = await supabase
      .from('fotos_terreno')
      .select('*');

    if (errFotosTerreno) throw errFotosTerreno;

    for (const remoto of fotosTerrenoRemoto ?? []) {
      const local = remoto.local_id ? await db.fotos_terreno.get(remoto.local_id) : null;

      if (!local) {
        const fotoData = {
          tipo:          remoto.tipo,
          entidadId:     remoto.tipo === 'caida' ? Number(remoto.entidad_id) : remoto.entidad_id,
          etiquetas:     remoto.etiquetas ?? [],
          descripcion:   remoto.descripcion ?? null,
          dataUrl:       remoto.data_url,
          storageUrl:    remoto.storage_url ?? null,
          subidaStorage: remoto.subida_storage ?? false,
          usuarioNombre: remoto.usuario_nombre ?? null,
          fechaCaptura:  remoto.fecha_captura ?? null,
          sincronizada:  true,
        };

        if (remoto.local_id) {
          await db.fotos_terreno.put({ id: remoto.local_id, ...fotoData });
        } else {
          await db.fotos_terreno.add(fotoData);
        }
      }
      // Si ya existe → no se modifica (las fotos no se editan)
    }

    // ── Camiones ──────────────────────────────────────────────────────────────
    const { data: camionesRemoto, error: errCamiones } = await supabase
      .from('camiones')
      .select('*');

    if (errCamiones) throw errCamiones;

    for (const remoto of camionesRemoto ?? []) {
      let local = remoto.local_id ? await db.camiones.get(remoto.local_id) : null;

      if (!local && remoto.id) {
        local = await db.camiones.where('supabaseId').equals(remoto.id).first();
      }

      if (!local) {
        const camionData = {
          tipoEntidad:            remoto.tipo_entidad,
          entidadId:              remoto.tipo_entidad === 'caida' ? Number(remoto.entidad_id) : remoto.entidad_id,
          entidadSecundariaTipo:  remoto.entidad_secundaria_tipo ?? null,
          entidadSecundariaId:    remoto.entidad_secundaria_tipo === 'caida' && remoto.entidad_secundaria_id != null
                                    ? Number(remoto.entidad_secundaria_id)
                                    : remoto.entidad_secundaria_id ?? null,
          tipoHormigon:           remoto.tipo_hormigon,
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
          fotoGuia:               remoto.foto_guia ?? null,
          fotosEnsayo:            remoto.fotos_ensayo ?? [],
          supabaseId:             remoto.id,
          sincronizado:           true,
        };

        if (remoto.local_id) {
          await db.camiones.put({ id: remoto.local_id, ...camionData });
        } else {
          await db.camiones.add(camionData);
        }
      }
      // Si ya existe → no se modifica (los camiones no se editan)
    }
  } catch (err) {
    console.warn('[Sync] Error al descargar desde Supabase:', err?.message ?? err);
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function sincronizar() {
  if (!supabase || !navigator.onLine) return;
  try {
    await sincronizarProtocolos();
    await subirFotosPendientes();
    await sincronizarFotos();
    await subirFotosTerrenoPendientes();
    await sincronizarFotosTerreno();
    await subirFotosCamionesPendientes();
    await sincronizarCamiones();
  } catch (err) {
    console.warn('[Sync] Error general:', err?.message ?? err);
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
