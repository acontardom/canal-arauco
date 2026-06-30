import Dexie from 'dexie';

export const db = new Dexie('CanalAraucoDb');

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

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

// v8: agrega fotoGuiaUrl y fotosEnsayoUrls a camiones (Supabase Storage).
// fotoGuia y fotosEnsayo (base64) se mantienen solo para uso offline temporal.
db.version(8).stores({
  camiones:
    '++id, tipoEntidad, entidadId, entidadSecundariaTipo, entidadSecundariaId, tipoHormigon, usoHormigon, volumen, numeroGuia, planta, cono, tempHormigon, tempAmbiente, horaCarga, horaDescarga, tiempoTraslado, pesoHoyaHormigon, puCalculado, observaciones, usuarioNombre, fechaRecepcion, sincronizado, supabaseId, estadoCalidad, fotoGuiaUrl, fotosEnsayoUrls',
});

// v9: UUID permanente para camiones — evita colisiones de local_id al reinstalar
db.version(9).stores({
  camiones:
    '++id, tipoEntidad, entidadId, entidadSecundariaTipo, entidadSecundariaId, tipoHormigon, usoHormigon, volumen, numeroGuia, planta, cono, tempHormigon, tempAmbiente, horaCarga, horaDescarga, tiempoTraslado, pesoHoyaHormigon, puCalculado, observaciones, usuarioNombre, fechaRecepcion, sincronizado, supabaseId, estadoCalidad, fotoGuiaUrl, fotosEnsayoUrls, deviceCamionId',
});

// v10: UUID permanente para protocolos, fotos y fotos_terreno — mismo problema potencial
db.version(10).stores({
  protocolos:
    '++id, tipo, entidad, entidadId, protocoloId, estado, usuarioNombre, fechaCreacion, fechaModificacion, datos, supabaseId, sincronizada, deviceProtocoloId',
  fotos:
    '++id, protocoloLocalId, nombre, tipo, dataUrl, sincronizada, storageUrl, subidaStorage, deviceFotoId',
  fotos_terreno:
    '++id, tipo, entidadId, etiquetas, descripcion, dataUrl, storageUrl, subidaStorage, usuarioNombre, fechaCaptura, sincronizada, deviceFotoTerrenoId',
});

// v11: agrega firmaToken a protocolos (UUID generado por la app al enviar al ITO)
db.version(11).stores({
  protocolos:
    '++id, tipo, entidad, entidadId, protocoloId, estado, usuarioNombre, fechaCreacion, fechaModificacion, datos, supabaseId, sincronizada, deviceProtocoloId, firmaToken',
});

// v12: agrega pdfFirmadoUrl a protocolos (URL del PDF firmado en Storage)
db.version(12).stores({
  protocolos:
    '++id, tipo, entidad, entidadId, protocoloId, estado, usuarioNombre, fechaCreacion, fechaModificacion, datos, supabaseId, sincronizada, deviceProtocoloId, firmaToken, pdfFirmadoUrl',
});

// v13: agrega pendienteSync a protocolos (flag para identificar registros pendientes de subir offline)
db.version(13).stores({
  protocolos:
    '++id, tipo, entidad, entidadId, protocoloId, estado, usuarioNombre, fechaCreacion, fechaModificacion, datos, supabaseId, sincronizada, deviceProtocoloId, firmaToken, pdfFirmadoUrl, pendienteSync',
});

// Hooks: genera UUID permanente al crear cualquier registro nuevo
db.camiones.hook('creating', (primKey, obj) => {
  if (!obj.deviceCamionId) obj.deviceCamionId = generateUUID();
});
db.protocolos.hook('creating', (primKey, obj) => {
  if (!obj.deviceProtocoloId) obj.deviceProtocoloId = generateUUID();
});
db.fotos.hook('creating', (primKey, obj) => {
  if (!obj.deviceFotoId) obj.deviceFotoId = generateUUID();
});
db.fotos_terreno.hook('creating', (primKey, obj) => {
  if (!obj.deviceFotoTerrenoId) obj.deviceFotoTerrenoId = generateUUID();
});

export default db;
