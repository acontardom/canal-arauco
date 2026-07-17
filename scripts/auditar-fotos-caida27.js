import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Cargar .env.local ────────────────────────────────────────────────────────
function cargarEnv(filePath) {
  try {
    const lines = readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  } catch {
    console.warn('[env] No se pudo leer .env.local');
  }
}

cargarEnv(join(ROOT, '.env.local'));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET   = 'fotos-canal-arauco';
const PREFIJO  = 'caida/27/';

// ── 1. Listar archivos en Storage bajo caida/27/ ─────────────────────────────
async function listarStorage() {
  const archivos = [];

  async function listarCarpeta(prefijo) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefijo, { limit: 1000 });

    if (error) throw new Error(`Storage list error en "${prefijo}": ${error.message}`);

    for (const item of data ?? []) {
      if (item.id === null) {
        // Es una carpeta — entrar recursivamente
        await listarCarpeta(`${prefijo}${item.name}/`);
      } else {
        archivos.push(`${prefijo}${item.name}`);
      }
    }
  }

  await listarCarpeta(PREFIJO);
  return archivos;
}

// ── 2. URLs en fotos_terreno para caida/27 ───────────────────────────────────
async function urlsFotosTerreno() {
  const { data, error } = await supabase
    .from('fotos_terreno')
    .select('storage_url')
    .eq('tipo', 'caida')
    .eq('entidad_id', '27');

  if (error) throw new Error(`fotos_terreno error: ${error.message}`);
  return (data ?? []).map(r => r.storage_url).filter(Boolean);
}

// ── 3. URLs en camiones para caida/27 ────────────────────────────────────────
async function urlsCamiones() {
  const { data, error } = await supabase
    .from('camiones')
    .select('foto_guia_url, fotos_ensayo_urls')
    .eq('tipo_entidad', 'caida')
    .eq('entidad_id', '27');

  if (error) throw new Error(`camiones error: ${error.message}`);

  const urls = [];
  for (const r of data ?? []) {
    if (r.foto_guia_url)          urls.push(r.foto_guia_url);
    for (const u of r.fotos_ensayo_urls ?? []) urls.push(u);
  }
  return urls;
}

// ── Extraer ruta relativa de una URL pública ─────────────────────────────────
function rutaDesdeUrl(url) {
  if (!url) return null;
  // Las URLs públicas tienen la forma: .../storage/v1/object/public/BUCKET/ruta
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log('\n🔍 Auditando fotos de Caída 27...\n');

    const [archivosStorage, urlsTerreno, urlsCam] = await Promise.all([
      listarStorage(),
      urlsFotosTerreno(),
      urlsCamiones(),
    ]);

    // ── Storage ──────────────────────────────────────────────────────────────
    console.log(`📦 STORAGE — ${archivosStorage.length} archivos en ${PREFIJO}`);
    archivosStorage.forEach(r => console.log(`   ${r}`));

    // ── fotos_terreno ─────────────────────────────────────────────────────────
    console.log(`\n🖼  FOTOS_TERRENO — ${urlsTerreno.length} registros`);
    urlsTerreno.forEach(u => console.log(`   ${u}`));

    // ── camiones ──────────────────────────────────────────────────────────────
    console.log(`\n🚛 CAMIONES — ${urlsCam.length} URLs de fotos`);
    urlsCam.forEach(u => console.log(`   ${u}`));

    // ── Comparación ───────────────────────────────────────────────────────────
    const rutasReferenciadas = new Set([
      ...urlsTerreno.map(rutaDesdeUrl),
      ...urlsCam.map(rutaDesdeUrl),
    ].filter(Boolean));

    const noContabilizados = archivosStorage.filter(r => !rutasReferenciadas.has(r));

    console.log(`\n⚠️  NO CONTABILIZADOS — ${noContabilizados.length} archivos en Storage sin referencia en BD`);
    if (noContabilizados.length === 0) {
      console.log('   (ninguno)');
    } else {
      noContabilizados.forEach(r => console.log(`   ${r}`));
    }

    console.log('\n✅ Auditoría completada.\n');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
})();
