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

// ── URL pública de una ruta relativa ─────────────────────────────────────────
function urlPublica(ruta) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return data.publicUrl;
}

// ── Listar archivos recursivamente bajo un prefijo ───────────────────────────
async function listarRecursivo(prefijo) {
  const archivos = [];

  async function listar(p) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(p, { limit: 1000 });

    if (error) throw new Error(`Storage list error en "${p}": ${error.message}`);

    for (const item of data ?? []) {
      if (item.id === null) {
        // Carpeta — entrar recursivamente
        await listar(`${p}${item.name}/`);
      } else {
        archivos.push(`${p}${item.name}`);
      }
    }
  }

  await listar(prefijo);
  return archivos;
}

// ── Extraer tipo y entidad_id del path ───────────────────────────────────────
// Formato esperado: {tipo}/{entidad_id}/terreno/{archivo}
function parsearRuta(ruta) {
  const partes = ruta.split('/');
  // partes[0] = tipo, partes[1] = entidad_id, partes[2] = 'terreno', partes[3+] = archivo
  if (partes.length < 4 || partes[2] !== 'terreno') return null;
  const tipo      = partes[0];
  const entidadId = tipo === 'caida' ? Number(partes[1]) : partes[1];
  return { tipo, entidadId };
}

// ── Main ─────────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');

(async () => {
  try {
    console.log(`\n🔍 Buscando fotos huérfanas en Storage...${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

    // 1. Listar archivos en Storage bajo las tres rutas de terreno
    const prefijos = ['tramo/', 'caida/', 'atravieso/'];
    const todosLosArchivos = [];

    for (const prefijo of prefijos) {
      // Listar entidades (subcarpetas del tipo)
      const { data: entidades, error: errEnt } = await supabase.storage
        .from(BUCKET)
        .list(prefijo, { limit: 1000 });

      if (errEnt) throw new Error(`Error listando ${prefijo}: ${errEnt.message}`);

      for (const entidad of entidades ?? []) {
        if (entidad.id !== null) continue; // archivo suelto, ignorar
        const rutaTerreno = `${prefijo}${entidad.name}/terreno/`;
        try {
          const archivos = await listarRecursivo(rutaTerreno);
          todosLosArchivos.push(...archivos);
        } catch {
          // La carpeta terreno puede no existir para esta entidad — ignorar
        }
      }
    }

    console.log(`📦 Archivos en Storage (rutas terreno): ${todosLosArchivos.length}`);

    // 2. Obtener todas las storage_url existentes en fotos_terreno
    const { data: fotosExistentes, error: errFotos } = await supabase
      .from('fotos_terreno')
      .select('storage_url');

    if (errFotos) throw new Error(`fotos_terreno select error: ${errFotos.message}`);

    const urlsExistentes = new Set(
      (fotosExistentes ?? []).map(f => f.storage_url).filter(Boolean)
    );

    console.log(`🗄  Registros en fotos_terreno: ${urlsExistentes.size}`);

    // 3. Identificar archivos huérfanos
    const huerfanos = todosLosArchivos.filter(ruta => {
      const url = urlPublica(ruta);
      return !urlsExistentes.has(url);
    });

    console.log(`⚠️  Huérfanos (no registrados): ${huerfanos.length}\n`);

    if (huerfanos.length === 0) {
      console.log('✅ No hay fotos huérfanas. Nada que recuperar.\n');
      return;
    }

    // 4a. Modo dry-run — mostrar resumen agrupado sin insertar
    if (DRY_RUN) {
      const grupos = {};
      let sinParsear = 0;

      for (const ruta of huerfanos) {
        const meta = parsearRuta(ruta);
        if (!meta) { sinParsear++; continue; }
        const clave = `${meta.tipo}/${meta.entidadId}`;
        grupos[clave] = (grupos[clave] ?? 0) + 1;
      }

      const clavesOrdenadas = Object.keys(grupos).sort((a, b) => {
        const [tipoA, idA] = a.split('/');
        const [tipoB, idB] = b.split('/');
        if (tipoA !== tipoB) return tipoA.localeCompare(tipoB);
        return String(idA).localeCompare(String(idB), undefined, { numeric: true });
      });

      console.log('📋 RESUMEN DRY-RUN — fotos huérfanas por entidad:\n');
      for (const clave of clavesOrdenadas) {
        console.log(`   ${clave.padEnd(20)} ${grupos[clave]} foto(s)`);
      }
      if (sinParsear > 0) console.log(`   (sin parsear)        ${sinParsear} foto(s)`);

      console.log('\n─────────────────────────────────────────');
      console.log(`Total archivos en Storage:  ${todosLosArchivos.length}`);
      console.log(`Total ya registrados:       ${todosLosArchivos.length - huerfanos.length}`);
      console.log(`Total huérfanos detectados: ${huerfanos.length}`);
      console.log('─────────────────────────────────────────');
      console.log('ℹ️  Ejecutar sin --dry-run para insertar.\n');
      return;
    }

    // 4b. Modo normal — insertar
    let insertados = 0;
    let errores    = 0;

    for (const ruta of huerfanos) {
      const meta = parsearRuta(ruta);
      if (!meta) {
        console.warn(`   ⚠️  No se pudo parsear ruta: ${ruta}`);
        errores++;
        continue;
      }

      const url = urlPublica(ruta);
      const registro = {
        tipo:           meta.tipo,
        entidad_id:     String(meta.entidadId),
        storage_url:    url,
        subida_storage: true,
        usuario_nombre: 'Recuperado automáticamente',
        etiquetas:      [],
        descripcion:    '',
        fecha_captura:  null,
      };

      const { error: errInsert } = await supabase
        .from('fotos_terreno')
        .insert(registro);

      if (errInsert) {
        console.error(`   ❌ Error insertando ${ruta}: ${errInsert.message}`);
        errores++;
      } else {
        console.log(`   ✅ Insertado: ${ruta}`);
        insertados++;
      }
    }

    // 5. Resumen final
    console.log('\n─────────────────────────────────────────');
    console.log(`Total archivos en Storage:  ${todosLosArchivos.length}`);
    console.log(`Total ya registrados:       ${todosLosArchivos.length - huerfanos.length}`);
    console.log(`Total insertados:           ${insertados}`);
    console.log(`Total errores:              ${errores}`);
    console.log('─────────────────────────────────────────\n');

  } catch (err) {
    console.error('\n❌ Error fatal:', err.message);
    process.exit(1);
  }
})();
