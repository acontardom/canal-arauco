import { db } from '../db/database';
import { supabase } from '../config/supabase';

// ─── Sincronización de protocolos ─────────────────────────────────────────────

async function sincronizarProtocolos() {
  const pendientes = await db.protocolos
    .filter(p => !p.supabaseId || p.sincronizada !== true)
    .toArray();

  for (const protocolo of pendientes) {
    try {
      const { data, error } = await supabase
        .from('protocolos')
        .upsert(
          {
            local_id:          protocolo.id,
            tipo:              protocolo.tipo,
            entidad_id:        String(protocolo.entidadId),
            protocolo_id:      protocolo.protocoloId,
            estado:            protocolo.estado,
            usuario_nombre:    protocolo.usuarioNombre ?? null,
            fecha_creacion:    protocolo.fechaCreacion ?? null,
            fecha_modificacion: protocolo.fechaModificacion ?? null,
            datos:             protocolo.datos ?? {},
          },
          { onConflict: 'local_id' }
        )
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

// ─── API pública ──────────────────────────────────────────────────────────────

export async function sincronizar() {
  if (!supabase || !navigator.onLine) return;
  try {
    await sincronizarProtocolos();
    await sincronizarFotos();
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
