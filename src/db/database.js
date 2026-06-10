import Dexie from 'dexie';

export const db = new Dexie('CanalAraucoDb');

db.version(1).stores({
  protocolos:
    '++id, tipo, entidad, entidadId, protocoloId, estado, usuarioNombre, fechaCreacion, fechaModificacion, datos',
  fotos:
    '++id, protocoloLocalId, nombre, tipo, dataUrl, sincronizada',
  syncQueue:
    '++id, tabla, accion, payload, createdAt',
});

// v2: agrega supabaseId y sincronizada a protocolos
db.version(2).stores({
  protocolos:
    '++id, tipo, entidad, entidadId, protocoloId, estado, usuarioNombre, fechaCreacion, fechaModificacion, datos, supabaseId, sincronizada',
});

// v3: agrega storageUrl y subidaStorage a fotos (Supabase Storage)
db.version(3).stores({
  fotos:
    '++id, protocoloLocalId, nombre, tipo, dataUrl, sincronizada, storageUrl, subidaStorage',
});

export default db;
