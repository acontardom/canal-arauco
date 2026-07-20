# Canal Arauco — Sistema de Protocolos de Calidad

PWA para gestión de protocolos de inspección y control de calidad en la construcción del Canal Siberia, Sección Los Litres. Proyecto ejecutado por EXMAQ SpA para Arauco.

## Stack

- **Frontend:** React 19 + Vite 8
- **PWA:** vite-plugin-pwa (Workbox, generateSW)
- **Almacenamiento local:** Dexie 4 (IndexedDB) — solo `camiones` y `fotos_terreno`
- **Backend:** Supabase (Postgres + Storage + Auth)
- **PDF:** jsPDF + jsPDF-AutoTable
- **PPT:** pptxgenjs
- **ZIP:** JSZip
- **Excel:** ExcelJS
- **Gráficos:** Recharts
- **Deploy:** Vercel (canal-arauco.vercel.app)
- **Repo:** acontardom/canal-arauco

## Levantar el entorno

```bash
npm install
npm run dev
```

### Variables de entorno (.env)

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxx
```

## Usuarios y roles

| Email | Rol | Persona |
|-------|-----|---------|
| acontardo@elespinal.cl | admin | Arturo |
| diego.onate@exmaqspa.cl | operador | Diego Oñate |
| amunoztopografo@gmail.com | operador | Álvaro Muñoz |
| operaciones@elespinal.cl | visor | Marcelo Contardo |
| francisco.contardo@exmaqspa.cl | visor | Francisco Contardo |
| gchavarria@cydingenieria.com | ito | Gonzalo Chavarría |

## Estructura de carpetas

```
src/
├── App.jsx                    Routing principal, layouts por rol
├── pages/
│   ├── Protocolo.jsx          Editor de protocolos (~126KB, componente central)
│   ├── Firma.jsx              Página pública de firma para el ITO
│   ├── PortalITO.jsx          Dashboard del ITO con matriz de estados
│   ├── GeneradorEDP.jsx       Generación de EDPs en ZIP
│   ├── DashboardMatriz.jsx    Matriz general de avance
│   ├── DashboardCamiones.jsx  Control de calidad hormigón + ensayos
│   ├── EnsayosLaboratorio.jsx Módulo CRUD de ensayos de laboratorio
│   ├── HistorialCamiones.jsx  Historial y edición de recepciones
│   ├── SubirFotos.jsx         Subida de fotos de terreno (offline)
│   ├── RecibirCamion.jsx      Recepción de camiones (offline)
│   ├── Galeria.jsx            Galería de fotos por entidad
│   ├── Cubicaciones.jsx       Planificador de jornada de hormigonado
│   └── ...
├── components/
│   ├── Sidebar.jsx            Navegación lateral con acordeón colapsable
│   ├── BottomNav.jsx          Navegación inferior (mobile)
│   ├── Navbar.jsx             Barra superior
│   ├── SyncBadge.jsx          Indicador de sincronización
│   └── UpdatePrompt.jsx       Aviso de nueva versión disponible (Service Worker)
├── utils/
│   ├── sync.js                Sync Dexie ↔ Supabase (solo camiones y fotos_terreno)
│   ├── generarPDF.js          Generación de PDFs por tipo de protocolo
│   ├── generarPPT.js          Exportación PPT de control de calidad (4 láminas)
│   ├── uploadFoto.js          Subida de fotos a Supabase Storage
│   ├── comprimirFoto.js       Compresión de imágenes antes de subir
│   └── generarExcel.js        Exportación a Excel
├── hooks/
│   ├── useAuth.js             Contexto de autenticación (sesión + usuario)
│   └── useSyncStatus.js       Estado de sincronización Dexie
├── db/
│   └── database.js            Schema Dexie v13
└── constants/
    └── estructura.js          TRAMOS, CAIDAS, ATRAVIESOS, KM_DATA, PROTOCOLOS
scripts/
├── backup-storage.js          Backup Supabase Storage → carpeta local
├── recuperar-fotos-huerfanas.js  Recuperar fotos en Storage sin registro en BD
└── regenerar-pdfs-ha.js       Regenerar PDFs firmados de protocolos HA
```

## Tablas Supabase principales

| Tabla | Descripción |
|-------|-------------|
| `protocolos` | Tabla central — un registro por tipo de protocolo por entidad |
| `fotos` | Fotos adjuntas directamente a protocolos |
| `fotos_terreno` | Galería de fotos por entidad (sincronizada con Dexie) |
| `camiones` | Recepciones de camiones de hormigón (sincronizado con Dexie) |
| `ensayos_laboratorio` | Ensayos de compresión R7/R28 vinculados a camiones |
| `avance` | Avance por partida constructiva por entidad |
| `edp` / `edp_protocolos` | Estados de pago |
| `usuarios` | Perfiles y roles |

## Reglas críticas — NUNCA olvidar

### 1. Base64 en base de datos
Después de subir cualquier foto a Supabase Storage, el campo `data_url`/`dataUrl` DEBE limpiarse a `null` inmediatamente en Dexie y Supabase. Dejar base64 causó 509 MB de bloat que requirió limpieza manual.

### 2. camionId en protocolos HA
El campo `datos.camionId` en protocolos HA debe ser siempre el UUID real de Supabase, nunca un ID local de Dexie (formato `sb-uuid`). Un fix masivo de 34 protocolos fue necesario cuando esto falló.

### 3. Dexie es solo para offline
Dexie está activo únicamente para `camiones` y `fotos_terreno`. Las tablas `protocolos` y `fotos` existen en el schema de Dexie como legacy pero NO se escriben activamente. Supabase es la fuente de verdad.

### 4. Guard cargadoRef
En `Protocolo.jsx`, `cargadoRef.current` se activa con `setTimeout(..., 0)` tras la carga inicial. Los useEffects de autosave verifican esto para no disparar saves con datos recién hidratados.

### 5. Constraint única en protocolos
Existe un índice único `protocolos_unique_tipo_entidad_protocolo` en Supabase. No se pueden crear protocolos duplicados del mismo tipo para la misma entidad.

### 6. fotosHA usa supabaseId
En `Protocolo.jsx`, `fotosHA` busca camiones con `x.supabaseId === camionSeleccionado`. Nunca usar `.key` para este lookup.

### 7. Race condition en descargarDesdeSupabase
`descargarDesdeSupabase` solo debe llamarse desde `iniciarSyncAutomatico`, nunca directamente desde `App.jsx`. Llamarla en dos lugares simultáneos causa duplicados en Dexie.

## Flujo de estados de un protocolo

```
borrador → completado → enviado_ito → firmado → enviado_edp
                              ↕
                      con_observaciones
```

- `enviado_edp` y `firmado`: vista de solo lectura con PDF embebido. No se pueden editar.
- Solo `admin` puede enviar al ITO y responder observaciones.
- Operadores pueden guardar borrador en estado `con_observaciones`.

## Tipos de protocolo

| ID | Descripción | Aplica a |
|----|-------------|----------|
| PICE1 | Excavación | Tramos, Caídas, Atraviesos |
| PICE2_RADIER | Hormigonado radier | Todos |
| PICE2_MURO | Hormigonado muro | Todos |
| PICE3 | Moldaje | Todos |
| PICE4_RADIER | Enfierradura radier | Todos |
| PICE4_MURO | Enfierradura muro | Caídas, Atraviesos |
| G5 | Emplantillado (sin cono ni PU) | Todos |
| HA_RADIER | Control HA radier | Todos |
| HA_MURO | Control HA muro | Todos |
| COTAS | Control de cotas topográficas | Todos |

## Tipos de hormigón

| Tipo | Uso | Cono | PU | Ensayo lab |
|------|-----|------|----|------------|
| G5 | Emplantillado | ❌ | ❌ | ❌ |
| G20 | Estructural | ✅ | ✅ | ✅ (R28 ≥ 20 MPa) |
| G25 | Estructural | ✅ | ✅ | ✅ (R28 ≥ 25 MPa) |
| G30 | Estructural | ✅ | ✅ | ✅ (R28 ≥ 30 MPa) |

**Especificación cono:** 8 cm ± 2 cm (rango aceptable: 6–10 cm)

## Storage bucket

Bucket: `fotos-canal-arauco` (público)

```
tramo/{id}/terreno/           fotos de galería de tramos
caida/{id}/terreno/           fotos de galería de caídas
atravieso/{id}/terreno/       fotos de galería de atraviesos
tramo/{id}/protocolos/{tipo}/ fotos adjuntas a protocolos de tramos
camiones/{tipo}/{id}/         fotos guía y ensayo de camiones
ensayos/{id}/                 PDF informes de laboratorio
firmas/                       PDFs firmados por ITO
```

## Convenciones de código

- Estilos inline en JS con objetos `s.nombreEstilo` definidos al final del archivo
- Mapeo snake_case → camelCase al cargar desde Supabase (`normalizarProtocolo`, `mapRemoto`)
- Commits siempre en dos líneas: `git add .` luego `git commit -m "tipo: descripción"`
- Prefijos: `feat:`, `fix:`, `refactor:`, `revert:`, `docs:`

## Scripts de mantenimiento

```bash
# Backup completo de Storage a carpeta local (configurar BACKUP_DIR primero)
node scripts/backup-storage.js

# Ver fotos en Storage sin registro en fotos_terreno (sin modificar nada)
node scripts/recuperar-fotos-huerfanas.js --dry-run

# Recuperar fotos huérfanas insertando registros en fotos_terreno
node scripts/recuperar-fotos-huerfanas.js
```

## Deuda técnica documentada

- **`Protocolo.jsx`:** funciones `enviarAlITO`, `marcarListoParaRevision` y `guardar` tienen lógica duplicada para construir `datosActuales`. En versión futura, extraer en `actualizarProtocolo(nuevoEstado, extra)`.
- **Estilos en `px` hardcodeados:** para un refactor futuro migrar a `rem` para mejor control de zoom en desktop.

## Pendientes externos

- **Backup Storage:** ejecutar `scripts/backup-storage.js` cuando la galería esté limpia de duplicados
- **PDFs históricos:** cargar protocolos firmados en papel usando convención `protocolos-historicos/{tipo}/{entidad_id}/{protocolo_id}.pdf`
