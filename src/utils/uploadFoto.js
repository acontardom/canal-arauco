import { supabase } from '../config/supabase';

export const BUCKET = 'fotos-canal-arauco';

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/data:(.*);base64/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function sanitizarNombre(nombre) {
  return (nombre ?? 'foto')
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_');
}

// Sube un dataUrl comprimido a Supabase Storage y retorna la URL pública.
// metadata: { tipo, entidadId, nombre, carpeta, archivo }
// `archivo`, si se especifica, fija el nombre completo del archivo (ej. "guia_169...jpg").
export async function uploadFoto(dataUrl, { tipo, entidadId, nombre, carpeta, archivo }) {
  if (!supabase) return null;

  const blob = dataUrlToBlob(dataUrl);
  const carpetaParte = carpeta ? `${carpeta}/` : '';
  const sufijoNombre = nombre ? `_${sanitizarNombre(nombre)}` : '';
  const nombreArchivo = archivo ?? `${Date.now()}${sufijoNombre}.jpg`;
  const ruta = `${tipo}/${entidadId}/${carpetaParte}${nombreArchivo}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, blob, { contentType: 'image/jpeg', upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return data.publicUrl;
}

// Elimina un archivo de Supabase Storage a partir de su URL pública.
export async function eliminarFotoStorage(storageUrl) {
  if (!supabase || !storageUrl) return;

  const marcador = `/storage/v1/object/public/${BUCKET}/`;
  const idx = storageUrl.indexOf(marcador);
  if (idx === -1) return;

  const ruta = decodeURIComponent(storageUrl.slice(idx + marcador.length));
  const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
  if (error) throw error;
}
