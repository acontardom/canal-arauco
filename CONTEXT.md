# CONTEXT.md — Canal Arauco · Sistema de Protocolos

## 1. Descripción general

### Propósito
Sistema de gestión de protocolos de calidad para la construcción del Canal Arauco (canal de riego). Permite registrar, revisar, firmar digitalmente y agrupar en Estados de Pago (EDP) los protocolos de cada etapa constructiva, tanto en oficina como en terreno sin señal.

### Stack
- **Frontend:** React 19 + Vite 8, PWA con service worker (vite-plugin-pwa / Workbox)
- **Almacenamiento local:** Dexie 4 (IndexedDB) — solo para `camiones` y `fotos_terreno` (ambos necesitan funcionar offline en terreno sin señal). `protocolos` y `fotos` van directo a Supabase.
- **Backend:** Supabase (Postgres + Storage + Auth)
- **PDF:** jsPDF + jsPDF-AutoTable
- **ZIP:** JSZip
- **Excel:** ExcelJS
- **Fotos:** react-image-crop, exifr (EXIF), compresión propia

### Usuarios y roles

| Rol | Acceso | Personas | Descripción |
|-----|--------|----------|-------------|
| `admin` | Todo | Arturo | Genera EDPs, envía al ITO, accede a configuración y todas las vistas |
| `operador` | Protocolos + terreno | Diego, Álvaro | Crean y guardan borradores, suben fotos, reciben camiones |
| `visor` | Solo lectura | Marcelo, Francisco | Pueden ver el estado de protocolos y matrices, sin editar |
| `ito` | Portal ITO + Firma | Gonzalo | Solo ve protocolos enviados y firma con imagen |

### Entidades constructivas
- **Tramos:** A–Z, AZ–DZ (28 tramos)
- **Caídas:** 1–29
- **Atraviesos:** 1–3

---

## 2. Estructura de archivos principales

```
src/
├── App.jsx                       Routing principal, layouts separados por rol
├── pages/
│   ├── Protocolo.jsx             Editor de protocolos (página central, ~126KB)
│   ├── Firma.jsx                 Página pública de firma para el ITO
│   ├── PortalITO.jsx             Dashboard del ITO con matriz de estados
│   ├── GeneradorEDP.jsx          Generación y descarga de EDPs en ZIP
│   ├── DashboardMatriz.jsx       Matriz general de avance por protocolo y entidad
│   ├── GenerarProtocolo.jsx      Formulario de creación de nuevo protocolo
│   ├── SubirFotos.jsx            Subida de fotos a galería de terreno
│   ├── RecibirCamion.jsx         Recepción de camiones de hormigón (funciona offline)
│   ├── Galeria.jsx               Galería de fotos por entidad
│   ├── HistorialCamiones.jsx     Historial de recepciones de camiones HA
│   ├── RecepcionarAvance.jsx     Registro de avance de obra por partida
│   ├── Cubicaciones.jsx          Cálculo de cubicaciones
│   ├── Planificacion.jsx         Planificación de obra (solo admin)
│   ├── CentroControl.jsx         Panel de control general
│   └── Tramos/Caidas/Atraviesos  Listas y detalle de cada entidad
├── components/
│   ├── Sidebar.jsx               Navegación lateral (desktop)
│   ├── BottomNav.jsx             Navegación inferior (mobile/terreno)
│   ├── Navbar.jsx                Barra superior con título y estado
│   ├── SyncBadge.jsx             Indicador visual de sincronización
│   └── UsuarioSelector.jsx       Selector de usuario activo en terreno
├── utils/
│   ├── sync.js                   Sincronización de fotos_terreno y camiones a Supabase (protocolos ya no pasan por Dexie)
│   ├── generarPDF.js             Generación de PDFs por tipo de protocolo
│   ├── uploadFoto.js             Subida de fotos a Supabase Storage
│   ├── comprimirFoto.js          Compresión de imágenes antes de subir
│   ├── fecha.js                  Utilidades de fecha (fechaHoy, formatearFecha)
│   ├── leerFechaExif.js          Extracción de fecha EXIF de fotos
│   └── generarExcel.js           Exportación a Excel
├── hooks/
│   ├── useAuth.js                Contexto de autenticación (sesión + usuario)
│   ├── useKm.js                  Kilómetros de inicio/fin por entidad
│   └── useSyncStatus.js          Estado de sincronización
├── constants/
│   └── estructura.js             TRAMOS, CAIDAS, ATRAVIESOS, PROTOCOLOS, CHECKLISTS
├── db/
│   └── database.js               Schema Dexie versión 13
└── config/
    └── supabase.js               Cliente Supabase (null si no hay env vars)
```

---

## 3. Tablas de Supabase

### `protocolos`
Tabla central. Un registro por tipo de protocolo por entidad.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | PK |
| `tipo` | text | `tramo`, `caida`, `atravieso` |
| `entidad_id` | text | ID del tramo/caída/atravieso |
| `protocolo_id` | text | `PICE1`, `PICE2_RADIER`, `PICE2_MURO`, `PICE3`, `PICE4_RADIER`, `PICE4_MURO`, `G5`, `HA_RADIER`, `HA_MURO`, `COTAS` |
| `estado` | text | `borrador` → `completado` → `enviado_ito` ↔ `con_observaciones` → `firmado` → `enviado_edp` |
| `datos` | jsonb | Contenido variable según tipo (ver reglas de negocio) |
| `firma_token` | uuid | Token público para URL de firma del ITO |
| `firma_imagen_url` | text | URL de imagen de firma del ITO en Storage |
| `pdf_firmado_url` | text | URL del PDF firmado en Storage |
| `observacion_ito` | text | Observación del ITO al devolver con correcciones |
| `edp` | int | Número de EDP al que pertenece |
| `usuario_nombre` | text | Nombre del creador |
| `fecha_modificacion` | timestamptz | Última modificación |

**Estructura de `datos` según tipo de protocolo:**
- **PICE y G5:** `{ checklist, observaciones, fotosNubeSeleccionadas[], fechaProtocolo, fotoAutocad, fotoTabla }`
- **HA (radier/muro):** `{ camionId, fotosExcluidas[], fotosRecortadas[], fotosGaleriaHA{}, observaciones, fechaProtocolo }`
- **COTAS:** `{ fechaControl, nControl, instrumentoNS, nombrePR, cotaPR, observacionCotas, fotoAutocad, fotoTabla, fechaProtocolo }`

### `fotos`
Fotos subidas directamente dentro de un protocolo (cámara o archivo desde el formulario).

| Campo | Descripción |
|-------|-------------|
| `id` | uuid PK |
| `protocolo_id` | FK → protocolos.id |
| `storage_url` | URL en Supabase Storage |
| `descripcion` | Texto descriptivo |
| `device_foto_id` | UUID del dispositivo (para deduplicación en sync) |

### `fotos_terreno`
Galería de fotos por entidad, compartida entre todos los protocolos de esa entidad. Se suben desde SubirFotos.

| Campo | Descripción |
|-------|-------------|
| `id` | uuid PK |
| `tipo` | `tramo`, `caida`, `atravieso` |
| `entidad_id` | ID de la entidad |
| `storage_url` | URL en Storage |
| `etiquetas` | Array de strings (Excavación, Moldaje, Hormigón, etc.) |
| `descripcion` | Texto libre |
| `usuario_nombre` | Quién subió la foto |
| `fecha_captura` | Fecha EXIF o fecha de subida |

### `camiones`
Recepciones de camiones de hormigón (Control HA).

| Campo | Descripción |
|-------|-------------|
| `id` | uuid PK |
| `tipo_entidad` / `entidad_id` | Entidad receptora |
| `tipo_hormigon` | G20, G25, G30 |
| `volumen` | m³ |
| `numero_guia` | N° de guía de despacho |
| `planta` | Planta de hormigón de origen |
| `cono` / `temp_hormigon` / `temp_ambiente` | Controles de calidad en obra |
| `hora_carga` / `hora_descarga` | Tiempos para cálculo de traslado |
| `pu_calculado` | Peso unitario calculado |
| `foto_guia` / `fotos_ensayo` | Fotos adjuntas |

### `avance`
Registro de avance por partida constructiva.

| Campo | Descripción |
|-------|-------------|
| `tipo_entidad` / `entidad_id` / `partida_id` | Identificadores únicos |
| `porcentaje` | Avance en % |

### `usuarios`
| Campo | Descripción |
|-------|-------------|
| `id` | FK → auth.users.id |
| `nombre` | Nombre para mostrar en la app |
| `email` | Email de acceso |
| `rol` | `admin`, `operador`, `visor`, `ito` |

### `edp`
Estado de Pago — agrupa protocolos firmados para envío al mandante.

| Campo | Descripción |
|-------|-------------|
| `id` | uuid PK |
| `numero` | Número correlativo (1, 2, 3…) |
| `usuario_nombre` | Quién lo generó |
| `fecha_generacion` | timestamptz (default now()) |

### `edp_protocolos`
Tabla de unión entre EDPs y protocolos.

| Campo | Descripción |
|-------|-------------|
| `edp_id` | FK → edp.id |
| `protocolo_id` | FK → protocolos.id |

---

## 4. Estado actual de cada módulo

| Módulo | Estado | Notas |
|--------|--------|-------|
| **Protocolo.jsx** | Estable | Sin Dexie para protocolos ni fotos. Carga directo desde Supabase, autosave debounced cada 5s, fotos adjuntas van directo a tabla `fotos`. |
| **Firma.jsx** | Estable | Carga fotos desde tabla `fotos` + `fotosNubeSeleccionadas`. Genera PDF firmado y lo sube a Storage. |
| **PortalITO.jsx** | Estable | Celdas `enviado_ito` navegan a `/firma/:token`; celdas `firmado` abren el PDF. Auto-refresco cada 60s. |
| **GeneradorEDP.jsx** | Nuevo, sin validar en prod | Genera EDP, descarga ZIP con PDFs firmados en lotes de 5 con reintentos. Requiere tablas `edp` y `edp_protocolos` en Supabase. |
| **DashboardMatriz.jsx** | Estable | Vista general de todos los protocolos. Toggle "Ver por EDP" con gradiente de color por número de EDP. |
| **SubirFotos.jsx** | Estable | Sube fotos a `fotos_terreno`. Funciona offline con Dexie (única tabla activa además de `camiones`). |
| **RecibirCamion.jsx** | Estable | Recepción offline. Sincroniza al recuperar señal o cada 30s. |
| **sync.js** | Estable | Sincroniza solo `fotos_terreno` y `camiones`. Protocolos y fotos de protocolo ya no pasan por `sync.js`. |
| **generarPDF.js** | Estable | Genera PDFs para todos los tipos de protocolo. COTAS muestra espacio de observaciones aunque esté vacío. |

---

## 5. Reglas críticas de negocio

### Flujo de estados de un protocolo
`borrador` → `completado` → `enviado_ito` → `firmado` → `enviado_edp`

Con posible rechazo: `enviado_ito` ↔ `con_observaciones` (el ITO rechaza y devuelve; el admin corrige y reenvía).

- **borrador:** creado o en edición por el operador
- **completado:** operador lo marcó listo para revisión del admin
- **enviado_ito:** admin lo envió al ITO; se genera `firma_token` y se notifica por email
- **con_observaciones:** ITO rechazó con comentarios; vuelve al admin para corregir y reenviar
- **firmado:** ITO firmó; `pdf_firmado_url` y `firma_imagen_url` disponibles; celda púrpura en matriz EDP
- **enviado_edp:** incluido en un EDP; celda verde en todas las matrices

### Dos fuentes de fotos en un protocolo PICE/G5
1. **Fotos adjuntas al protocolo** (tabla `fotos`, estado `fotosProtocolo`): subidas directamente desde el formulario. Van inmediatamente a Supabase Storage + tabla `fotos`. Al abrir un protocolo existente se cargan con `select` a Supabase. Son editables (descripción) y eliminables.
2. **Fotos de galería seleccionadas** (`fotosNubeSeleccionadas` en `datos`): fotos de `fotos_terreno` que el usuario eligió incluir. Se guardan como array de objetos `{ storageUrl, dataUrl, descripcion }` dentro del JSON `datos`.

### `datos` es variable por tipo de protocolo
No hay schema fijo. El tipo de protocolo (`esCOTAS`, `esHA`, o PICE) determina qué campos existen. Guardar con la estructura equivocada (ej. rama PICE cuando debería ser COTAS) sobreescribe y pierde los datos específicos del tipo. El campo `esCOTAS = protocoloId === 'COTAS'` gobierna la lógica de guardado en `enviarAlITO` y `marcarListoParaRevision`.

### Rol de Dexie en la arquitectura
Supabase es la fuente de verdad. Dexie solo es activo para dos tablas: `camiones` y `fotos_terreno`, ambas con flujos que ocurren en campo sin señal. Las tablas `protocolos` y `fotos` siguen existiendo en el schema de Dexie (no se borran para no romper IndexedDB en dispositivos existentes) pero ya no se escriben activamente desde la app.

### Guard `cargadoRef`
`cargadoRef.current` se activa con `setTimeout(..., 0)` tras finalizar la carga inicial desde Supabase (`cargarDesdeSupabase`). Los `useEffect` de autosave verifican `cargadoRef.current` para no disparar un save a Supabase con los datos que acaban de ser hidratados.

### Autosave debounced en Protocolo.jsx
Los cambios en el formulario (checklist, observaciones, fotos seleccionadas, campos HA) se persisten automáticamente en Supabase con un debounce de 5 segundos via `programarAutosave`. Un indicador en el header muestra `⏳ guardando...` / `☁️ guardado` / `⚠️ error`. Si hay cambios pendientes al cerrar la ventana, `beforeunload` muestra advertencia nativa.

### Fotos de cámara adjuntas al protocolo
`guardarFotoNueva` sube la foto directo a Supabase Storage e inserta en la tabla `fotos`. Si el protocolo aún no existe en Supabase, llama `obtenerOCrearProtocolo` que lo crea primero con `upsert` usando `device_protocolo_id` como clave de deduplicación. No hay cola ni Dexie de por medio.

### `fotosNubeSeleccionadas` solo para protocolos PICE y G5
- **HA:** usa `fotosGaleriaHA` (objeto keyed por `camionId`)
- **COTAS:** usa `fotoAutocad` y `fotoTabla` (objetos individuales)
- **PICE y G5:** usan `fotosNubeSeleccionadas` (array)

Mezclar estos campos entre tipos resulta en datos invisibles en la vista y en el PDF.

### Deduplicación de fotos en galería
Al agregar una foto desde `fotosTerreno` al protocolo, se verifica que su `storageUrl || dataUrl` no exista ya en `fotosNubeSeleccionadas` antes de agregarla. Esto evita selecciones duplicadas si el usuario hace clic dos veces.

---

## 6. Backlog por prioridad

### Alta

**1. Sync de borrados Dexie ↔ Supabase**
Si un registro se elimina en Supabase no se refleja en Dexie local, y viceversa. No hay lógica de borrado en `sync.js`. Puede causar que fotos de terreno eliminadas reaparezcan tras sincronizar.

**2. Service Worker con aviso de actualización**
Cuando se despliega una nueva versión, el SW en background no avisa al usuario. El operador puede estar usando una versión desactualizada sin saberlo. Implementar un aviso visible con botón "Actualizar" que fuerce el reload con el nuevo SW.

### Media

**3. Refactorización `actualizarProtocolo()`**
`enviarAlITO`, `marcarListoParaRevision` y `guardar` comparten lógica duplicada para construir `datosActuales` y llamar a `escribirProtocolo`. Extraer en una función central `actualizarProtocolo(nuevoEstado, extra)` que maneje el branch HA/COTAS/PICE en un solo lugar.

**4. Control calidad camiones — marcar Sí por defecto**
En el formulario de recepción de camiones, los campos de control de calidad (cono, temperatura, etc.) no tienen valor por defecto. El operador debe marcar manualmente. Cambiar a "Sí" por defecto para agilizar el flujo en terreno.

**5. Foto terreno 20489 con error persistente**
Una foto específica (id o referencia 20489) tiene un error que persiste en la interfaz o en Supabase. Investigar si es un registro corrupto en `fotos_terreno` o un problema de Storage.

**6. Zoom fotos al editar camión**
Al revisar o editar un camión en HistorialCamiones, las fotos adjuntas (guía, ensayos) no tienen zoom. Agregar tap/click para ver en grande, igual que en el modal de fotos de protocolo.

### Baja

**7. Exportar Excel de camiones**
`generarExcel.js` existe pero no está conectado al historial de camiones. Agregar botón de exportación en `HistorialCamiones.jsx` con los registros filtrados por entidad y rango de fechas.

**8. Importar PDFs de protocolos históricos**
Protocolos firmados en papel antes del sistema no tienen registro digital. Crear un flujo para subir un PDF ya firmado y marcarlo como `firmado` en Supabase, sin pasar por el flujo de firma digital.

**9. Script respaldo Storage → Google Drive**
Los PDFs firmados en Supabase Storage no tienen respaldo externo. Crear script periódico (cron o Edge Function) que copie los archivos de Storage a Google Drive como respaldo ante pérdida de datos.

**10. README del código**
Documentar para desarrolladores externos: cómo levantar el entorno, variables de entorno requeridas, estructura de Supabase, convenciones del proyecto.

---

## 7. Cambios recientes

### Fase 1 — Eliminar `db.fotos` (completada)

Las fotos adjuntas dentro del editor de protocolo ya no pasan por Dexie.

**Qué cambió:**
- `guardarFotoNueva` sube directo a Supabase Storage e inserta en tabla `fotos`. Si el protocolo no tiene `id` en Supabase, se crea primero vía `upsert`.
- `eliminarFoto` hace `delete` en tabla `fotos` + elimina de Storage, sin tocar Dexie.
- `fotosProtocoloNube` (read-only desde Supabase) y `fotos` (desde Dexie) se unifican en un solo estado `fotosProtocolo` (fuente única: Supabase).
- Eliminados de `sync.js`: `subirFotosPendientes()` y `sincronizarFotos()`.
- Eliminado de `descargarDesdeSupabase()`: el bloque que descargaba `fotos` → Dexie.
- `useSyncStatus.js`: el contador de pendientes ya no incluye `db.fotos`.
- `Perfil.jsx`: `forzarResync` ya no resetea `db.fotos`.
- `db.fotos` permanece en el schema de Dexie (v3/v10) con comentario legacy para no romper IndexedDB existente.

**Archivos modificados:** `Protocolo.jsx`, `sync.js`, `useSyncStatus.js`, `Perfil.jsx`, `database.js`

---

### Fase 2 — Eliminar `db.protocolos` (completada)

Los protocolos ya no viven en Dexie. Supabase es la única fuente de verdad.

**Qué cambió:**
- `useLiveQuery` (dexie-react-hooks) eliminado de `Protocolo.jsx`. Reemplazado con `useState(null)` + `useEffect` que hace `select('*').maybeSingle()` a Supabase al montar.
- Nueva función `normalizarProtocolo(raw)` mapea snake_case → camelCase para mantener las referencias existentes (`protocolo.estado`, `protocolo.firmaToken`, etc.) sin cambios en el resto del componente.
- `protocolo.id` ahora ES el UUID de Supabase (antes era el ID local de Dexie; `supabaseId` se eliminó).
- Hidratación Dexie ↔ Supabase eliminada (ya no hay nada que hidratar).
- `escribirProtocolo` simplificada a solo Supabase + `setProtocolo` para actualizar estado local.
- `obtenerOCrearId` (creaba en Dexie) → `obtenerOCrearProtocolo` (crea directo en Supabase con `upsert` + `device_protocolo_id`).
- `guardar()` caso `!protocolo`: llama `obtenerOCrearProtocolo()` en vez de `db.protocolos.add`.
- Autosave a Dexie (2 `useEffect`) → `programarAutosave` con debounce 5s a Supabase.
- `beforeunload` advertencia si hay autosave pendiente.
- Indicador de guardado en header: `⏳ guardando...` / `☁️ guardado` / `⚠️ error`.
- `TramoDetalle`, `CaidaDetalle`, `AtraviesoDetalle`: `useLiveQuery + hidratación` → `useState + useEffect` con `select('protocolo_id, estado')` directo a Supabase.
- `GenerarProtocolo.jsx`: `cargarProtocolo` simplificada a Supabase-only con `maybeSingle()`, sin fallback Dexie.
- `sync.js`: eliminados `sincronizarProtocolos()`, `subirFotosNubeEnSync()`, y el bloque `// ── Protocolos ──` de `descargarDesdeSupabase()`.
- `useSyncStatus.js`: contador de pendientes ya no incluye `db.protocolos`.
- `Perfil.jsx`: `forzarResync` ya no resetea `db.protocolos`.
- `db.protocolos` permanece en el schema de Dexie (v13) con comentario legacy.

**Archivos modificados:** `Protocolo.jsx`, `TramoDetalle.jsx`, `CaidaDetalle.jsx`, `AtraviesoDetalle.jsx`, `GenerarProtocolo.jsx`, `sync.js`, `useSyncStatus.js`, `Perfil.jsx`, `database.js`

**Páginas fuera de alcance** (aún leen `db.protocolos` para conteos/actividad, no para el flujo de edición): `Atraviesos.jsx`, `Entrada.jsx`, `Inicio.jsx`, `SubirFotos.jsx`.
