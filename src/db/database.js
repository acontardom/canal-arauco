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

// v4: nueva tabla fotos_terreno (Nube de Fotos)
db.version(4).stores({
  fotos_terreno:
    '++id, tipo, entidadId, etiquetas, descripcion, dataUrl, storageUrl, subidaStorage, usuarioNombre, fechaCaptura, sincronizada',
});

// v5: nueva tabla camiones (Recepción de Camiones)
db.version(5).stores({
  camiones:
    '++id, tipoEntidad, entidadId, entidadSecundariaTipo, entidadSecundariaId, tipoHormigon, volumen, numeroGuia, planta, cono, tempHormigon, tempAmbiente, horaCarga, horaDescarga, tiempoTraslado, pesoHoyaHormigon, puCalculado, observaciones, usuarioNombre, fechaRecepcion, sincronizado, supabaseId',
});

// v6: agrega usoHormigon a camiones (Radier/Muro/Otro)
db.version(6).stores({
  camiones:
    '++id, tipoEntidad, entidadId, entidadSecundariaTipo, entidadSecundariaId, tipoHormigon, usoHormigon, volumen, numeroGuia, planta, cono, tempHormigon, tempAmbiente, horaCarga, horaDescarga, tiempoTraslado, pesoHoyaHormigon, puCalculado, observaciones, usuarioNombre, fechaRecepcion, sincronizado, supabaseId',
});

// v7: agrega estadoCalidad a camiones (aprobado/rechazado)
db.version(7).stores({
  camiones:
    '++id, tipoEntidad, entidadId, entidadSecundariaTipo, entidadSecundariaId, tipoHormigon, usoHormigon, volumen, numeroGuia, planta, cono, tempHormigon, tempAmbiente, horaCarga, horaDescarga, tiempoTraslado, pesoHoyaHormigon, puCalculado, observaciones, usuarioNombre, fechaRecepcion, sincronizado, supabaseId, estadoCalidad',
});

export default db;
