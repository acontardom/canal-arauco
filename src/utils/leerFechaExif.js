import exifr from 'exifr';

export async function leerFechaExif(file) {
  try {
    const exif = await exifr.parse(file, ['DateTimeOriginal', 'DateTime', 'CreateDate']);
    console.log('[EXIF] Metadatos leídos:', exif);
    const fecha = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateTime ?? null;
    console.log('[EXIF] Fecha captura detectada:', fecha);
    return fecha ? new Date(fecha).toISOString() : null;
  } catch (err) {
    console.warn('[EXIF] No se pudo leer EXIF:', err?.message ?? err);
    return null;
  }
}
