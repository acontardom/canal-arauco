# CONTEXT.md — Canal Arauco · Sistema de Protocolos

## 1. Descripción general

### Propósito
Sistema de gestión de protocolos de calidad para la construcción del Canal Arauco (canal de riego). Permite registrar, revisar, firmar digitalmente y agrupar en Estados de Pago (EDP) los protocolos de cada etapa constructiva, tanto en oficina como en terreno sin señal.

### Stack
- **Frontend:** React 19 + Vite 8, PWA con service worker (vite-plugin-pwa / Workbox)
- **Almacenamiento local:** Dexie 4 (IndexedDB) — caché de respaldo offline (Supabase es la fuente de verdad)
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
│   ├── sync.js                   Lógica completa de sincronización Dexie ↔ Supabase
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
| **Protocolo.jsx** | Estable | COTAS, PICE, HA funcionan. Fixes recientes: fotos PICE reaparecían al editar; datos COTAS no se guardaban en marcarListoParaRevision. |
| **Firma.jsx** | Estable | Carga fotos desde tabla `fotos` + `fotosNubeSeleccionadas`. Genera PDF firmado y lo sube a Storage. |
| **PortalITO.jsx** | Estable | Celdas `enviado_ito` navegan a `/firma/:token`; celdas `firmado` abren el PDF. Auto-refresco cada 60s. |
| **GeneradorEDP.jsx** | Nuevo, sin validar en prod | Genera EDP, descarga ZIP con PDFs firmados en lotes de 5 con reintentos. Requiere tablas `edp` y `edp_protocolos` en Supabase. |
| **DashboardMatriz.jsx** | Estable | Vista general de todos los protocolos. Toggle "Ver por EDP" con gradiente de color por número de EDP. |
| **SubirFotos.jsx** | Estable | Sube fotos a `fotos_terreno`. Funciona offline con Dexie. |
| **RecibirCamion.jsx** | Estable | Recepción offline. Sincroniza al recuperar señal o cada 30s. |
| **sync.js** | Bugs conocidos | Ver sección 6 (Backlog). `descargarDesdeSupabase` puede fallar para fotos sin `device_foto_id`. `sincronizarFotos` no guarda `supabaseId` de vuelta. |
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

### Tres fuentes de fotos en un protocolo PICE/G5
1. **Fotos de cámara** (tabla `fotos`): subidas dentro del protocolo, vinculadas a `protocolo_id`. Se sincronizan a Supabase mediante `sincronizarFotos()`.
2. **Fotos de galería seleccionadas** (`fotosNubeSeleccionadas` en `datos`): fotos de `fotos_terreno` que el usuario eligió incluir. Se guardan como array de objetos `{ storageUrl, dataUrl, descripcion }` dentro del JSON `datos`.
3. **Fotos de otros dispositivos** (`fotosProtocoloNube` en estado local): al abrir un protocolo existente, se consultan registros de `fotos` en Supabase para mostrarlos en el editor. Son solo lectura (badge "terreno"), no afectan `datos`.

### `datos` es variable por tipo de protocolo
No hay schema fijo. El tipo de protocolo (`esCOTAS`, `esHA`, o PICE) determina qué campos existen. Guardar con la estructura equivocada (ej. rama PICE cuando debería ser COTAS) sobreescribe y pierde los datos específicos del tipo. El campo `esCOTAS = protocoloId === 'COTAS'` gobierna la lógica de guardado en `enviarAlITO` y `marcarListoParaRevision`.

### Rol de Dexie en la arquitectura
Supabase es la fuente de verdad. Dexie actúa como caché de respaldo offline y solo es imprescindible para dos flujos: recepción de camiones y fotos de terreno (ambos ocurren en campo sin señal). Para protocolos, Dexie es un buffer temporal que se sincroniza cuando hay conexión.

### Regla de hidratación Dexie ↔ Supabase
Al abrir un protocolo, el efecto de hidratación solo sobreescribe el campo `datos` en Dexie si los datos locales están vacíos (`Object.keys(datos).length === 0`). Esto protege cambios locales no sincronizados. Los campos de metadatos (`estado`, `firmaToken`, `pdfFirmadoUrl`, `observacionIto`) siempre se actualizan desde Supabase.

### Guard `cargadoRef`
`cargadoRef.current` se activa una sola vez, al finalizar `aplicarDatos` (carga inicial del formulario). Todo `useEffect` que persista datos a Dexie debe verificar `cargadoRef.current` para no dispararse antes de que el formulario se haya hidratado.

### Sincronización de fotos de cámara
Las fotos de cámara llegan a Supabase Storage inmediatamente via `guardarFotoNueva`. Pero solo llegan a la tabla `fotos` de Supabase cuando corre `sincronizarFotos()` (parte del ciclo `sincronizar()`). El sync automático corre cada 30 segundos en producción. Para garantizar que el ITO vea las fotos, `enviarAlITO` y `marcarListoParaRevision` llaman `sincronizarFotos()` explícitamente antes de continuar.

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

**1. Reducir Dexie al mínimo** *(en progreso)*
Mantener Dexie solo para camiones y fotos de terreno. El resto de los flujos (protocolos, estado, datos) debe operar directo contra Supabase cuando hay conexión. Actualmente Protocolo.jsx depende fuertemente de Dexie para estado local y persistencia; refactorizar gradualmente para leer desde Supabase en el montaje y escribir directo cuando hay señal.

**2. Sync de borrados Dexie ↔ Supabase**
Si un registro se elimina en Supabase no se refleja en Dexie local, y viceversa. No hay lógica de borrado en `sync.js`. Puede causar que protocolos o fotos eliminadas reaparezcan tras sincronizar.

**3. Service Worker con aviso de actualización**
Cuando se despliega una nueva versión, el SW en background no avisa al usuario. El operador puede estar usando una versión desactualizada sin saberlo. Implementar un aviso visible con botón "Actualizar" que fuerce el reload con el nuevo SW.

### Media

**4. Refactorización `actualizarProtocolo()`**
`enviarAlITO`, `marcarListoParaRevision` y `guardar` comparten lógica duplicada para construir `datosActuales` y llamar a `escribirProtocolo`. Extraer en una función central `actualizarProtocolo(nuevoEstado, extra)` que maneje el branch HA/COTAS/PICE en un solo lugar.

**5. Control calidad camiones — marcar Sí por defecto**
En el formulario de recepción de camiones, los campos de control de calidad (cono, temperatura, etc.) no tienen valor por defecto. El operador debe marcar manualmente. Cambiar a "Sí" por defecto para agilizar el flujo en terreno.

**6. Foto terreno 20489 con error persistente**
Una foto específica (id o referencia 20489) tiene un error que persiste en la interfaz o en Supabase. Investigar si es un registro corrupto en `fotos_terreno` o un problema de Storage.

**7. Zoom fotos al editar camión**
Al revisar o editar un camión en HistorialCamiones, las fotos adjuntas (guía, ensayos) no tienen zoom. Agregar tap/click para ver en grande, igual que en el modal de fotos de protocolo.

### Baja

**8. Exportar Excel de camiones**
`generarExcel.js` existe pero no está conectado al historial de camiones. Agregar botón de exportación en `HistorialCamiones.jsx` con los registros filtrados por entidad y rango de fechas.

**9. Importar PDFs de protocolos históricos**
Protocolos firmados en papel antes del sistema no tienen registro digital. Crear un flujo para subir un PDF ya firmado y marcarlo como `firmado` en Supabase, sin pasar por el flujo de firma digital.

**10. Script respaldo Storage → Google Drive**
Los PDFs firmados en Supabase Storage no tienen respaldo externo. Crear script periódico (cron o Edge Function) que copie los archivos de Storage a Google Drive como respaldo ante pérdida de datos.

**11. README del código**
Documentar para desarrolladores externos: cómo levantar el entorno, variables de entorno requeridas, estructura de Supabase, convenciones del proyecto.
