# CLAUDE.md — Contexto para Claude Code

Este archivo contiene el contexto necesario para trabajar en el proyecto Canal Arauco. Léelo completo antes de hacer cualquier cambio.

## Qué es este proyecto

PWA de gestión de protocolos de calidad para la construcción del Canal Siberia, Sección Los Litres. Ejecutado por EXMAQ SpA para Arauco. Opera en producción con 6 usuarios reales. Cualquier cambio puede afectar trabajo activo en terreno.

URL producción: https://canal-arauco.vercel.app
Repo: acontardom/canal-arauco

## Reglas absolutas — nunca violar

1. **Nunca dejar base64 en la base de datos.** Después de subir a Storage, limpiar `data_url` a `null` inmediatamente en Dexie y Supabase. Incumplir esto causó 509 MB de bloat.

2. **Nunca usar IDs de Dexie donde se espera UUID de Supabase.** El formato `sb-uuid` es un ID local de Dexie. Usarlo como `camionId` en protocolos HA causó un fix masivo de 34 protocolos con PDFs regenerados.

3. **Dexie solo para `camiones` y `fotos_terreno`.** No agregar otras tablas sin decisión explícita. `protocolos` y `fotos` existen en el schema Dexie como legacy pero no se escriben.

4. **Supabase es la fuente de verdad.** Siempre.

5. **Protocolos `firmado` y `enviado_edp` son de solo lectura.** No mostrar botones de edición en esos estados. Mostrar PDF embebido con iframe.

6. **Solo admin puede enviar al ITO** y responder observaciones. Operadores solo pueden guardar borrador en `con_observaciones`.

7. **`fotosHA` usa `supabaseId`**, nunca `.key`. La línea correcta es `camionesRegistrados.find(x => x.supabaseId === camionSeleccionado)`.

8. **`descargarDesdeSupabase` se llama solo desde `iniciarSyncAutomatico`**, nunca directamente desde `App.jsx`. Llamarla dos veces simultáneas causa duplicados en Dexie.

9. **No crear protocolos duplicados.** Existe constraint única `protocolos_unique_tipo_entidad_protocolo` en Supabase. Usar `maybeSingle()` en queries, nunca `single()`.

## Arquitectura de sync

```
Terreno (sin señal)
  ↓ Dexie (IndexedDB) — camiones y fotos_terreno
  ↓ sync.js cada 30s cuando hay señal
Supabase (fuente de verdad)
```

Orden de ejecución en `sincronizar()`:
1. `subirFotosTerrenoPendientes()` — sube imágenes a Storage, actualiza Dexie
2. `sincronizarFotosTerreno()` — upsert en Supabase por `device_foto_terreno_id`
3. `subirFotosCamionesPendientes()` — sube fotos de camiones
4. `sincronizarCamiones()` — upsert en Supabase por `device_camion_id`
5. `descargarDesdeSupabase()` — baja registros nuevos a Dexie

## Mapeo de campos

Supabase usa snake_case. La app usa camelCase. Siempre mapear al cargar:

```js
// Patrón estándar en HistorialCamiones y DashboardCamiones
const mapRemoto = r => ({
  id: r.id,
  numeroGuia: r.numero_guia,
  fechaRecepcion: r.fecha_recepcion,
  tipoHormigon: r.tipo_hormigon,
  usoHormigon: r.uso_hormigon,
  entidadId: r.entidad_id,
  tipoEntidad: r.tipo_entidad,
  puCalculado: r.pu_calculado,
  tieneMuestra: r.tiene_muestra,
  laboratorioMuestra: r.laboratorio_muestra,
  // ...
});
```

## Entidades constructivas

- **Tramos:** A–Z, AZ–DZ (28 tramos). IDs como strings.
- **Caídas:** 1–29. IDs numéricos en Supabase, `String(id)` en algunos contextos.
- **Atraviesos:** 1–3.
- **TEST:** entidad especial para pruebas. Excluir siempre de métricas, planificación y dashboards.
- **N2:** subtramo de N, no es error.

## Reglas de negocio hormigón

- **G5:** emplantillado. Sin cono, sin PU, sin ensayo de laboratorio.
- **G20/G25/G30:** estructural. Aplica cono (especificación 8 cm ± 2 cm, rango 6–10 cm), PU y ensayo.
- **Cobertura cono:** denominador solo G20+ (excluir G5).
- **Cobertura PU:** denominador G20+ **desde 2026-05-21** (fecha del primer registro de PU).
- **Ensayos R28:** G20 ≥ 20 MPa, G25 ≥ 25 MPa, G30 ≥ 30 MPa.
- **Guía 18209:** aparece dos veces (caída 25 y atravieso 2) — son despachos reales a dos frentes, no duplicado.

## Plantas hormigoneras

| Nombre en Supabase | Notas |
|--------------------|-------|
| `Membrillar` | Principal, ~66% del volumen |
| `Quilanco` | Segunda en volumen, áridos ~50 kg/m³ más densos |
| `Río San Martín` | Menor volumen |

## Protocolo.jsx — puntos críticos

El archivo más grande del proyecto (~126KB). Manejar con cuidado.

- `cargadoRef.current` previene autosave durante hidratación inicial (se activa con `setTimeout(..., 0)`).
- Autosave debounced cada 5s vía `programarAutosave`. Solo actualiza `datos` y `fecha_modificacion`, nunca `estado`.
- `modoSimplificado = estado === 'firmado' || estado === 'enviado_edp'` → early return con PDF embebido.
- `obtenerOCrearProtocolo` crea protocolo en Supabase con upsert usando `device_protocolo_id` como clave.
- `escribirProtocolo` solo escribe en Supabase + actualiza estado local, sin Dexie.

## Estructura de `datos` por tipo de protocolo

```js
// PICE y G5
{ checklist, observaciones, fotosNubeSeleccionadas[], fechaProtocolo, fotoAutocad, fotoTabla }

// HA (radier/muro)
{ camionId, fotosExcluidas[], fotosRecortadas[], fotosGaleriaHA{}, observaciones, fechaProtocolo }

// COTAS
{ fechaControl, nControl, instrumentoNS, nombrePR, cotaPR, observacionCotas, fotoAutocad, fotoTabla, fechaProtocolo }
```

No mezclar estructuras entre tipos — sobreescribe y pierde datos.

## Default de fecha en protocolos

La fecha por defecto se asigna automáticamente según el tipo de protocolo buscando el camión de la entidad:

| Protocolo | Busca camión |
|-----------|--------------|
| PICE1, PICE2_RADIER, PICE4_RADIER, PICE4 | `uso_hormigon = 'radier'` |
| PICE2_MURO, PICE3, PICE4_MURO | `uso_hormigon = 'muro'` |
| G5 | `tipo_hormigon = 'G5'` |
| COTAS, HA | Fecha de hoy / fecha del camión seleccionado |

## Flujo de estados

```
borrador → completado → enviado_ito → firmado → enviado_edp
                              ↕
                      con_observaciones
```

Permisos:
- `admin`: puede hacer todo
- `operador`: puede crear/editar borradores, guardar en `con_observaciones`, NO puede enviar al ITO
- `visor`: solo lectura
- `ito`: solo ve portal ITO, puede firmar

## Storage bucket: `fotos-canal-arauco` (público)

```
tramo/{id}/terreno/           galería de tramos
caida/{id}/terreno/           galería de caídas
atravieso/{id}/terreno/       galería de atraviesos
{tipo}/{id}/protocolos/{tipo}/ fotos de protocolos
camiones/{tipo}/{id}/         fotos guía y ensayo de camiones
ensayos/{id}/                 PDF informes de laboratorio
firmas/                       PDFs firmados por ITO
```

Convención para PDFs históricos (pendiente de implementar):
```
protocolos-historicos/{tipo}/{entidad_id}/{protocolo_id}.pdf
```

## Sidebar y navegación

Estructura actual del sidebar (Sidebar.jsx):

**TERRENO:** Subir Fotos, Recibir Camión
**PROTOCOLOS:** Matriz, Galería de Fotos, Generar Protocolo, Generar EDP
**HORMIGÓN:** Historial Camiones, Control HA, Ensayos Lab.
**AVANCE:** Vista Canal, Recepcionar Avance
**HERRAMIENTAS:** Cubicaciones

Comportamiento: acordeón con múltiples secciones abiertas simultáneamente, scroll habilitado.

## Módulos principales

| Módulo | Ruta | Estado |
|--------|------|--------|
| DashboardMatriz | /matriz | Estable |
| DashboardCamiones | /dashboard-camiones | Estable — KPIs, gráficos, exporta PPT |
| EnsayosLaboratorio | /ensayos | Estable — CRUD, PDF adjunto, pendientes |
| HistorialCamiones | /camiones | Estable — edición fotos incluida |
| Cubicaciones | /cubicaciones | Estable — planificador de jornada |
| PortalITO | /ito | Estable — 3 tablas separadas, celdas clickeables |

## Convención de commits

```bash
git add .
git commit -m "tipo: descripción corta en español"
```

Tipos: `feat`, `fix`, `refactor`, `revert`, `docs`

## Scripts de mantenimiento

```bash
# Backup Storage → carpeta local (configurar BACKUP_DIR en el script)
node scripts/backup-storage.js

# Ver fotos huérfanas sin modificar
node scripts/recuperar-fotos-huerfanas.js --dry-run

# Recuperar fotos huérfanas
node scripts/recuperar-fotos-huerfanas.js
```

## Deuda técnica

- `Protocolo.jsx`: `enviarAlITO`, `marcarListoParaRevision` y `guardar` tienen lógica duplicada para construir `datosActuales`. Extraer en `actualizarProtocolo(nuevoEstado, extra)` en versión futura.
- Estilos en `px` hardcodeados en toda la app — para refactor futuro migrar a `rem`.

## Estado del proyecto (julio 2026)

Proyecto en producción activa. Quedan aproximadamente 5 meses de obra.

Completado:
- EDP-5 generado y entregado a Arauco ✅
- Flujo completo firma ITO ✅
- Refactorización Dexie (Fases 1 y 2) ✅
- Dashboard Control HA con gráficos Recharts ✅
- Módulo Ensayos de Laboratorio CRUD completo ✅
- Exportación PPT control de calidad (4 láminas) ✅
- Cubicaciones rediseñada como planificador de jornada ✅
- Service Worker con aviso de actualización ✅
- Vista simplificada (PDF embebido) para protocolos firmados ✅

Pendiente externo:
- Backup Storage → ejecutar cuando galería esté limpia
- Carga PDFs históricos → esperar PDFs físicos
