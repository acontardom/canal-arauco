/**
 * Test: Dos camiones de "sesiones distintas" (diferente Dexie / reinstalación)
 * deben producir device_camion_id distintos en el payload de upsert,
 * aunque ambos tengan local_id = 1.
 */

const { chromium } = require('playwright');

const BASE = 'http://localhost:5206';

async function registrarCamion(page, label) {
  console.log(`  [${label}] Navegando a /...`);
  await page.goto(BASE + '/');
  await page.waitForTimeout(1000);

  // Seleccionar usuario si aparece la pantalla de selección
  const btnAlvaro = page.locator('button', { hasText: 'Álvaro' });
  if (await btnAlvaro.count() > 0) {
    await btnAlvaro.first().click();
    await page.waitForTimeout(400);
  }

  console.log(`  [${label}] Navegando a /recibir-camion...`);
  await page.goto(BASE + '/recibir-camion');
  await page.waitForTimeout(1000);

  // Seleccionar G5 (sin ensayo — tiene botón "Registrar camión" directo)
  const btnG5 = page.locator('button', { hasText: 'G5' });
  if (await btnG5.count() > 0) {
    await btnG5.first().click();
    await page.waitForTimeout(300);
    console.log(`  [${label}] G5 seleccionado`);
  } else {
    console.log(`  [${label}] WARN: botón G5 no encontrado`);
  }

  // Rellenar todos los inputs vacíos con valor "5"
  const inputs = await page.$$('input[type="text"], input[type="number"]');
  for (const input of inputs) {
    const val = await input.inputValue();
    if (!val) await input.fill('5');
  }
  await page.waitForTimeout(200);

  const btnRegistrar = page.locator('button', { hasText: 'Registrar camión' });
  const count = await btnRegistrar.count();
  console.log(`  [${label}] Botón "Registrar camión" encontrado: ${count > 0}`);

  if (count === 0) {
    const btnAprobar = page.locator('button', { hasText: 'Aprobar' });
    if (await btnAprobar.count() > 0) {
      await btnAprobar.first().click();
      await page.waitForTimeout(300);
      const btnConfirmar = page.locator('button', { hasText: 'Confirmar' });
      if (await btnConfirmar.count() > 0) await btnConfirmar.first().click();
    }
  } else {
    await btnRegistrar.first().click();
  }

  console.log(`  [${label}] Botón presionado, esperando sync...`);
  await page.waitForTimeout(3000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  page.on('pageerror', e => console.error('[pageerror]', e.message.slice(0, 300)));
  page.on('console', m => {
    if (m.type() === 'error' || m.text().includes('[Sync]') || m.text().includes('Camion')) {
      console.log(`  [browser:${m.type()}]`, m.text().slice(0, 200));
    }
  });

  const upsertPayloads = [];

  // Interceptar upserts a camiones (Supabase REST — cualquier host)
  await page.route('**/rest/v1/camiones*', async route => {
    const req = route.request();
    const method = req.method();
    const prefer = req.headers()['prefer'] ?? '';
    const isUpsert = method === 'POST' && prefer.includes('resolution=merge-duplicates');

    if (isUpsert) {
      try {
        const raw = req.postData() ?? '[]';
        const body = JSON.parse(raw);
        const row = Array.isArray(body) ? body[0] : body;
        if (row) {
          console.log(`  [intercept] Capturando upsert camion: device_camion_id=${row.device_camion_id}, local_id=${row.local_id}`);
          upsertPayloads.push(row);
        }
      } catch (e) {
        console.log('  [intercept] Error parseando body:', e.message);
      }
      // Responder con ID de Supabase simulado
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: `mock-supabase-${Date.now()}` }]),
      });
    } else {
      // GET: devolver vacío para no insertar datos basura en Dexie
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
  });

  // Mock otras tablas
  for (const table of ['protocolos', 'fotos', 'fotos_terreno']) {
    await page.route(`**/${table}*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
  }

  // ── Sesión A ─────────────────────────────────────────────────────────────────
  console.log('\n=== Sesión A (primer dispositivo) ===');
  await registrarCamion(page, 'A');

  const payloadA = upsertPayloads[0];
  if (payloadA) {
    console.log(`Payload A: local_id=${payloadA.local_id}, device_camion_id=${payloadA.device_camion_id}`);
  } else {
    console.log('Payload A: NO capturado — inspeccionando Dexie...');
    const dexieState = await page.evaluate(async () => {
      return new Promise(resolve => {
        const req = indexedDB.open('CanalAraucoDb');
        req.onsuccess = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('camiones')) {
            resolve({ error: 'tabla camiones no existe' });
            return;
          }
          const tx = db.transaction('camiones', 'readonly');
          const store = tx.objectStore('camiones');
          const all = store.getAll();
          all.onsuccess = () => resolve({ count: all.result.length, rows: all.result.map(r => ({ id: r.id, deviceCamionId: r.deviceCamionId, sincronizado: r.sincronizado })) });
          all.onerror = () => resolve({ error: all.error?.message });
        };
        req.onerror = e => resolve({ error: e.target.error?.message });
      });
    });
    console.log('Estado Dexie camiones:', JSON.stringify(dexieState));
  }

  // ── Simular reinstalación ─────────────────────────────────────────────────────
  console.log('\n--- Simulando reinstalación (borrando IndexedDB) ---');
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    for (const { name } of dbs) {
      await new Promise((res, rej) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = res;
        req.onerror = () => rej(req.error);
      });
    }
    Object.keys(localStorage)
      .filter(k => k.startsWith('camion_borrador'))
      .forEach(k => localStorage.removeItem(k));
  });
  console.log('IndexedDB borrado.');

  // ── Sesión B ─────────────────────────────────────────────────────────────────
  console.log('\n=== Sesión B (dispositivo reinstalado) ===');
  await registrarCamion(page, 'B');

  const payloadB = upsertPayloads[1];
  if (payloadB) {
    console.log(`Payload B: local_id=${payloadB.local_id}, device_camion_id=${payloadB.device_camion_id}`);
  } else {
    console.log('Payload B: NO capturado — inspeccionando Dexie...');
    const dexieState = await page.evaluate(async () => {
      return new Promise(resolve => {
        const req = indexedDB.open('CanalAraucoDb');
        req.onsuccess = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('camiones')) {
            resolve({ error: 'tabla camiones no existe' });
            return;
          }
          const tx = db.transaction('camiones', 'readonly');
          const store = tx.objectStore('camiones');
          const all = store.getAll();
          all.onsuccess = () => resolve({ count: all.result.length, rows: all.result.map(r => ({ id: r.id, deviceCamionId: r.deviceCamionId, sincronizado: r.sincronizado })) });
          all.onerror = () => resolve({ error: all.error?.message });
        };
        req.onerror = e => resolve({ error: e.target.error?.message });
      });
    });
    console.log('Estado Dexie camiones:', JSON.stringify(dexieState));
  }

  // ── Verificaciones ────────────────────────────────────────────────────────────
  console.log('\n=== Verificaciones ===');

  const ambosTienenUUID =
    typeof payloadA?.device_camion_id === 'string' && payloadA.device_camion_id.length > 10 &&
    typeof payloadB?.device_camion_id === 'string' && payloadB.device_camion_id.length > 10;
  const uuidsDistintos = payloadA?.device_camion_id !== payloadB?.device_camion_id;
  const ambosLocal1 = payloadA?.local_id === 1 && payloadB?.local_id === 1;

  console.log('✔ Payloads capturados:', upsertPayloads.length >= 2 ? '✅' : '❌', `(${upsertPayloads.length} total)`);
  console.log('✔ device_camion_id A existe:', payloadA?.device_camion_id ? '✅' : '❌', payloadA?.device_camion_id ?? 'null');
  console.log('✔ device_camion_id B existe:', payloadB?.device_camion_id ? '✅' : '❌', payloadB?.device_camion_id ?? 'null');
  console.log('✔ Ambos local_id = 1 (misma colisión):', ambosLocal1 ? '✅' : `⚠ A=${payloadA?.local_id} B=${payloadB?.local_id}`);
  console.log('✔ device_camion_id A ≠ B (sin conflicto Supabase):', uuidsDistintos ? '✅' : '❌');

  const ok = ambosTienenUUID && uuidsDistintos;
  console.log('\nResultado:', ok ? '✅ PASS — UUID fix funciona correctamente' : '❌ FAIL');

  if (!ok) process.exitCode = 1;

  await browser.close();
})();
