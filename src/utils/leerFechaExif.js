import exifr from 'exifr';

export async function leerFechaExif(file) {
  try {
    const exif = await exifr.parse(file, ['DateTimeOriginal', 'DateTime', 'CreateDate']);
    const fecha = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateTime ?? null;
    return fecha ? new Date(fecha).toISOString() : null;
  } catch {
    return null;
  }
}
