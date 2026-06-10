import { supabase } from '../config/supabase';

const BUCKET = 'fotos-canal-arauco';

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
// metadata: { tipo, entidadId, nombre, carpeta }
export async function uploadFoto(dataUrl, { tipo, entidadId, nombre, carpeta }) {
  if (!supabase) return null;

  const blob = dataUrlToBlob(dataUrl);
  const carpetaParte = carpeta ? `${carpeta}/` : '';
  const sufijoNombre = nombre ? `_${sanitizarNombre(nombre)}` : '';
  const ruta = `${tipo}/${entidadId}/${carpetaParte}${Date.now()}${sufijoNombre}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, blob, { contentType: 'image/jpeg', upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return data.publicUrl;
}
