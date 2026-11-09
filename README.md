# SIARC-ARA — Sistema de Información del Archivo Regional de Arequipa

Sistema web para la consulta y gestión del patrimonio documental custodiado por el
Archivo Regional de Arequipa. Implementa el diseño descrito en `tesis.tex`: catálogo
descriptivo (ISAD-G), búsqueda de texto completo, visor de documentos digitalizados y
auditoría de las operaciones, con tres perfiles de acceso y control de intentos fallidos.

## Arquitectura

Monorepositorio con dos aplicaciones y una base de datos PostgreSQL:

```
tesisrevisinon/
├─ backend/          API REST (Node.js + Express, ESM)
├─ frontend/         Interfaz web (React 19 + Vite + Bootstrap 5)
├─ database/         schema.sql y seed.sql (esquema e índices)
├─ storage/          Repositorio digital (PDF/A, TIFF y miniaturas)
├─ postgres-portable/ Servidor PostgreSQL portátil (solo desarrollo local)
└─ tesis.tex         Documento de tesis (fuente de requisitos)
```

### Backend (`backend/`)

- **Stack**: Node.js ≥ 20, Express 4, PostgreSQL (`pg`), JWT (`jsonwebtoken`),
  hash de contraseñas con `bcryptjs`, validación con `zod` y cabeceras con `helmet`.
- **Módulos**: `auth` (login/logout, bloqueo por intentos), `usuarios` (registro,
  edición, perfiles y activación/desactivación), `documentos` (búsqueda simple y
  avanzada, detalle, edición e ingesta), `catalogos` (fondos, series, tipologías) y
  `auditoria` (registro y consulta del historial).
- **Búsqueda de texto completo**: usa `tsvector`, `unaccent` y `pg_trgm` para admitir
  búsquedas insensibles a mayúsculas y acentos (p. ej. "escritura" encuentra "ESCRITURA").
- **Seguridad**: JWT con expiración, tres perfiles (`ADMINISTRADOR`, `ARCHIVISTA`,
  `USUARIO_EXTERNO`) y bloqueo temporal de la cuenta tras 5 intentos fallidos (HU-17).
- **Auditoría**: registra en `registro_auditoria` los inicios de sesión, búsquedas,
  consultas de detalle, visualizaciones, cargas, ediciones y operaciones sobre usuarios.
- **Ingesta**: carga autenticada de PDF/A y TIFF (multipart, campo `archivo`) con
  validación de extensión, MIME y firma binaria; registra ruta, fecha, usuario,
  tamaño y nombre original, y resuelve automáticamente la jerarquía
  fondo → protocolo → año → registro → título.

### Frontend (`frontend/`)

- **Stack**: React 19, React Router 7, Vite 8 y Bootstrap 5.3.
- **Vistas**: login, consulta (búsqueda simple/avanzada con panel de filtros y detalle
  del documento), ingesta documental (ADMIN/ARCHIVISTA), gestión de usuarios (ADMIN) y
  auditoría con filtros y detalle de cada acción (ADMIN/ARCHIVISTA). La navegación se
  adapta al perfil autenticado y se conserva en dispositivos móviles.
- **Visor de documentos**: PDF en `iframe` y TIFF decodificado en cliente con `utif2`
  y dibujado en `canvas` (soporte multipágina); las miniaturas se solicitan
  autenticadas como blob.

## Requisitos

- Node.js ≥ 20
- PostgreSQL ≥ 14 (se incluye un servidor portátil para desarrollo local)
- PowerShell (Windows) o cualquier shell POSIX

## Puesta en marcha

### 1. Base de datos

Se puede usar el PostgreSQL portátil incluido (`postgres-portable/`) o una instalación
propia. Cree la base de datos y ajuste `backend/.env` a partir de `backend/.env.example`:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=siarc_db
DB_SCHEMA=public
DB_USER=postgres
DB_PASSWORD=tu_contraseña_local
```

#### Conexión a la base DB_ARA

El piloto puede trabajar directamente con la base existente `DB_ARA`, cuyo esquema
`siarc` contiene el acervo migrado (fondos, protocolos, registros y archivos digitales).
Configure `backend/.env` así:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=DB_ARA
DB_SCHEMA=siarc
DB_USER=postgres
DB_PASSWORD=tu_contraseña_local
RUTA_REPOSITORIO=C:/ruta/al/ACERVO DOCUMENTAL
```

Con esta configuración no ejecute `npm run db:reset`, porque recrea el esquema. Para
actualizar la estructura use `npm run db:migrar`, que aplica las migraciones pendientes
sobre el esquema `siarc` sin borrar los datos.

### 2. Backend

```powershell
cd backend
npm install
npm run db:reset    # crea el esquema (schema.sql + seed.sql) y siembra los datos
npm start           # API en http://localhost:4000
```

Scripts disponibles:

- `npm run db:reset` — recrea el esquema y carga los datos de ejemplo.
- `npm run db:schema` — solo crea el esquema.
- `npm run db:seed` — solo carga los datos de ejemplo.
- `npm run db:migrar` — aplica las migraciones pendientes de `database/migrations/` sin recrear los datos.
- `npm run storage:subir` — sube el repositorio local (`storage/repositorio`) a Cloudflare R2.
- `npm run dev` — arranque con recarga automática (`node --watch`).

### Almacenamiento en Cloudflare R2

El repositorio digital puede residir en disco (`ALMACENAMIENTO=local`) o en un bucket de
Cloudflare R2 (`ALMACENAMIENTO=r2`). Para usar R2 configure en `backend/.env`:

```
ALMACENAMIENTO=r2
R2_ACCOUNT_ID=su_account_id
R2_ACCESS_KEY_ID=su_access_key
R2_SECRET_ACCESS_KEY=su_secret_key
R2_BUCKET=siarc-repositorio
R2_PREFIX=repositorio
```

Cree el token de API desde el panel de R2 con permisos de lectura y escritura sobre el
bucket. Luego genere el repositorio y súbalo:

```powershell
npm run db:reset
npm run storage:subir
```

La API sigue entregando los archivos autenticados (no se exponen URLs públicas del bucket).

### 3. Frontend

```powershell
cd frontend
npm install
npm run dev         # http://localhost:5173
npm run build       # compila a frontend/dist
npm run preview     # sirve la compilación de producción
```

> En Windows, si la política de ejecución bloquea `npm.ps1`, use `npm.cmd`.

## Credenciales de demostración

Cargadas por `database/seed.sql`:

| Usuario    | Contraseña     | Perfil          |
|------------|----------------|-----------------|
| `anaquispe`| `Admin123!`    | ADMINISTRADOR   |
| `lmamani`  | `Archivo123!`  | ARCHIVISTA      |
| `cflores`  | `Consulta123!` | USUARIO_EXTERNO |

## Endpoints principales

| Método | Ruta                              | Descripción                            |
|--------|-----------------------------------|----------------------------------------|
| GET    | `/api/salud`                      | Estado del servicio                    |
| POST   | `/api/auth/login`                 | Inicio de sesión (devuelve JWT)        |
| POST   | `/api/auth/logout`                | Cierre de sesión (auditado)            |
| POST   | `/api/documentos`                 | Ingesta de PDF/A o TIFF (ADMIN/ARCHIVISTA) |
| GET    | `/api/documentos/busqueda/simple` | Búsqueda de texto completo             |
| GET    | `/api/documentos/busqueda/avanzada` | Búsqueda con filtros combinados      |
| GET    | `/api/documentos/:id`             | Detalle descriptivo (ISAD-G)           |
| PUT    | `/api/documentos/:id`             | Edición de la descripción (auditada)   |
| GET    | `/api/documentos/:id/miniatura`   | Miniatura (autenticada)                |
| GET    | `/api/documentos/:id/archivo`     | Documento digitalizado (PDF/A o TIFF)  |
| GET    | `/api/catalogos/fondos`           | Catálogo de fondos                     |
| GET    | `/api/catalogos/series`           | Catálogo de series                     |
| GET    | `/api/catalogos/tipologias`       | Catálogo de tipologías documentales    |
| GET    | `/api/usuarios`                   | Listado de usuarios (solo ADMIN)       |
| POST   | `/api/usuarios`                   | Registro de usuario (solo ADMIN)       |
| GET    | `/api/usuarios/:id`               | Detalle de usuario (solo ADMIN)        |
| PUT    | `/api/usuarios/:id`               | Edición de usuario (solo ADMIN)        |
| PATCH  | `/api/usuarios/:id/estado`        | Activar/desactivar usuario (solo ADMIN)|
| DELETE | `/api/usuarios/:id`               | Desactivación lógica (solo ADMIN)      |
| GET    | `/api/auditoria`                  | Registro de auditoría (ADMIN/ARCHIVISTA) |
| GET    | `/api/auditoria/usuarios`         | Usuarios de la auditoría (ADMIN/ARCHIVISTA) |
| GET    | `/api/auditoria/:id`              | Detalle de una acción auditada         |

### Ingesta documental

La carga usa `multipart/form-data` con el archivo en el campo `archivo` y los metadatos
como campos de texto (`id_fondo`, `protocolo`, `anio`, `registro`, `tipologia`, etc.).
La validación es básica: extensión permitida (`.pdf`, `.tif`, `.tiff`), tipo MIME y
firma binaria (`%PDF-` para PDF y `II*\0`/`MM\0*` para TIFF). El tamaño máximo se
configura con `INGESTA_MAX_MB` (50 MB por defecto).

Alcance del piloto: no se ejecuta OCR/HTR ni se valida la resolución DPI o la
conformidad PDF/A con veraPDF; tampoco se generan miniaturas automáticamente para los
archivos cargados. Estas comprobaciones quedan documentadas como trabajo futuro.

## Despliegue en producción

Requiere un VPS con PostgreSQL (Hostinger solo ofrece PostgreSQL en VPS). Con Node, PM2 y
Nginx instalados:

```bash
cd frontend && npm ci && npm run build
cd ../backend && npm ci
cp .env.example .env        # ajuste credenciales, JWT_SECRET y R2
npm run db:reset            # instalación nueva; use db:migrar en actualizaciones
npm run storage:subir
pm2 start ecosystem.config.cjs
pm2 startup && pm2 save
```

Luego copie `deploy/nginx-siarc.conf` a `/etc/nginx/sites-available/siarc`, reemplace
`TU_DOMINIO` por su dominio, actívelo con un enlace en `sites-enabled` y emita el
certificado con `certbot --nginx`.

## Seguridad y privacidad

- Las contraseñas se almacenan con hash `bcrypt`; nunca en texto plano.
- El token JWT se envía en la cabecera `Authorization: Bearer <token>`.
- El acceso a documentos queda sujeto al perfil: la edición está reservada a
  `ADMINISTRADOR` y `ARCHIVISTA`.
- Toda operación sensible queda registrada en `registro_auditoria` para trazabilidad.

## Licencia

Proyecto académico desarrollado como parte de la tesis del Archivo Regional de Arequipa.
