import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────
const BACKUP_DIR    = './backup-canal-arauco'; // cambiar a ruta de OneDrive si se desea
const BUCKET        = 'fotos-canal-arauco';
const CARPETAS_RAIZ = ['tramo', 'caida', 'atravieso', 'camiones', 'ensayos', 'firmas'];

// ── Leer .env manualmente (sin dependencia de dotenv) ─────────────────────────
function leerEnv() {
  try {
    const raw = fs.readFileSync('.env', 'utf8');
    const vars = {};
    for (const linea of raw.split('\n')) {
      const t = linea.trim();
      if (!t || t.startsWith('#')) continue;
      const idx = t.indexOf('=');
      if (idx === -1) continue;
      const k = t.slice(0, idx).trim();
      const v = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      vars[k] = v;
    }
    return vars;
  } catch {
    return {};
  }
}

const env = leerEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL  ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Listar archivos recursivamente ────────────────────────────────────────────
async function listarRecursivo(prefijo) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefijo, { limit: 1000, offset: 0 });

  if (error) throw new Error(`Error listando "${prefijo}": ${error.message}`);

  const archivos = [];
  for (const item of data ?? []) {
    const rutaCompleta = prefijo ? `${prefijo}/${item.name}` : item.name;
    if (item.id === null) {
      // carpeta — recurrir
      const sub = await listarRecursivo(rutaCompleta);
      archivos.push(...sub);
    } else {
      archivos.push({
        path: rutaCompleta,
        size: item.metadata?.size ?? 0,
      });
    }
  }
  return archivos;
}

// ── Descargar un archivo ──────────────────────────────────────────────────────
async function descargar(storagePath, localPath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw new Error(error.message);
  const buffer = Buffer.from(await data.arrayBuffer());
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📦  Backup de Supabase Storage → ${BACKUP_DIR}\n`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  // 1. Recolectar lista de todos los archivos
  console.log('🔍  Listando archivos...');
  const archivos = [];
  for (const carpeta of CARPETAS_RAIZ) {
    try {
      const found = await listarRecursivo(carpeta);
      archivos.push(...found);
    } catch (err) {
      console.warn(`  ⚠️  ${err.message}`);
    }
  }

  const total = archivos.length;
  console.log(`   ${total} archivo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}\n`);

  if (total === 0) {
    console.log('✅  Nada que descargar.');
    return;
  }

  // 2. Descargar o saltar
  let descargados = 0;
  let saltados    = 0;
  let errores     = 0;
  const ancho     = String(total).length;

  for (let i = 0; i < archivos.length; i++) {
    const { path: storagePath, size: storageSize } = archivos[i];
    const localPath = path.join(BACKUP_DIR, storagePath);
    const prefijo   = `[${String(i + 1).padStart(ancho, ' ')}/${total}]`;

    try {
      if (fs.existsSync(localPath)) {
        const localSize = fs.statSync(localPath).size;
        if (localSize === storageSize) {
          console.log(`${prefijo} ✓ Ya existe, saltando   ${storagePath}`);
          saltados++;
          continue;
        }
      }

      console.log(`${prefijo} ⬇  Descargando   ${storagePath}`);
      await descargar(storagePath, localPath);
      descargados++;
    } catch (err) {
      console.error(`${prefijo} ✗ Error          ${storagePath} — ${err.message}`);
      errores++;
    }
  }

  // 3. Resumen
  console.log('\n─────────────────────────────────────────────');
  console.log(`  Total:       ${total}`);
  console.log(`  Descargados: ${descargados}`);
  console.log(`  Saltados:    ${saltados}`);
  console.log(`  Errores:     ${errores}`);
  console.log('─────────────────────────────────────────────\n');

  if (errores > 0) process.exit(1);
}

main().catch(err => {
  console.error('❌  Error inesperado:', err.message);
  process.exit(1);
});
