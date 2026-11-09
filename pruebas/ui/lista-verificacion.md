# Lista de verificación de interfaz (UI)

Ejecutar con la API (`npm start` en `backend/`) y el frontend (`npm run dev` en
`frontend/`) en ejecución sobre una base recreada con `npm run db:reset`.
Navegadores: Chrome, Edge y Firefox. Resoluciones: 320, 768 y 1280 px
(Chrome DevTools → modo dispositivo). Registrar evidencia (captura o video) por fila.

| ID | Escenario | Pasos | Resultado esperado | Evidencia | Estado |
|----|-----------|-------|--------------------|-----------|--------|
| UI-01 | Login válido | Abrir `/login`, ingresar `anaquispe` / `Admin123!`, enviar | Redirige a `/busqueda`; muestra nombre y perfil «Administrador» | | |
| UI-02 | Login inválido | Ingresar `lmamani` con contraseña incorrecta | Alerta de error; permanece en `/login`; no redirige | | |
| UI-03 | Bloqueo por intentos | Fallar 5 veces con la misma cuenta | Mensaje de cuenta bloqueada con minutos restantes | | |
| UI-04 | Persistencia de sesión | Iniciar sesión y recargar la página (F5) | La sesión se mantiene; no vuelve a `/login` | | |
| UI-05 | Sesión inválida | Alterar o eliminar el token en `localStorage` y recargar | Redirige a `/login` y limpia la sesión | | |
| UI-06 | Ruta privada | Abrir `/busqueda` sin sesión | Redirige a `/login` | | |
| UI-07 | Búsqueda simple | Buscar `aguas` | Tarjetas con título, fondo, fecha, miniatura y etiquetas | | |
| UI-08 | Búsqueda sin resultados | Buscar `xyz-sin-resultados` | Estado «Sin resultados» con opción de limpiar | | |
| UI-09 | Búsqueda avanzada | Abrir pestaña avanzada y filtrar por fondo y rango de fechas | Solo aparecen documentos que cumplen los filtros | | |
| UI-10 | Validación de filtros | En avanzada, dejar todo vacío y aplicar | Mensaje «Ingrese al menos un criterio de búsqueda» | | |
| UI-11 | Limpiar filtros | Aplicar filtros y pulsar «Limpiar filtros» | Formulario y resultados se reinician | | |
| UI-12 | Ordenamiento | Cambiar el selector a «Más antiguo» | Resultados reordenados y sin duplicados | | |
| UI-13 | Paginación | Buscar un término con más de 10 resultados y navegar | Página 2 sin repetir elementos de la página 1 | | |
| UI-14 | Ficha descriptiva | Seleccionar una tarjeta | Panel con metadatos, descriptores e interesados | | |
| UI-15 | Cerrar ficha | Pulsar la X del panel | Panel vuelve al estado vacío | | |
| UI-16 | Visor PDF/A | Abrir un documento PDF | Documento visible en el iframe; botón «Descargar» funcional | | |
| UI-17 | Visor TIFF multipágina | Abrir un TIFF con más de una página | Imagen en canvas; navegación Anterior/Siguiente | | |
| UI-18 | Miniaturas | Revisar tarjetas con y sin miniatura | Imagen autenticada o marcador «Sin digitalizar» | | |
| UI-19 | Error de red | Detener la API y realizar una búsqueda | Mensaje claro («No se pudo conectar con el servidor») sin pantalla en blanco | | |
| UI-20 | Cierre de sesión | Pulsar «Salir» | Vuelve a `/login` y `localStorage` queda limpio | | |
| UI-21 | Responsividad 320 px | Repetir UI-01, UI-07 y UI-14 a 320 px | Sin desbordes horizontales; controles utilizables | | |
| UI-22 | Responsividad 768 px | Repetir UI-01 y UI-07 a 768 px | Barra y panel se adaptan sin solaparse | | |
| UI-23 | Responsividad 1280 px | Repetir UI-01, UI-07 y UI-14 a 1280 px | Distribución en dos columnas estable | | |
| UI-24 | XSS en metadatos | Insertar un título con `<script>alert(1)</script>` en la BD y buscarlo | Se muestra como texto; el script no se ejecuta | | |
| UI-25 | Accesibilidad básica | Navegar el login y el buscador solo con teclado | Foco visible, labels asociados y botones activables con Enter | | |
| UI-26 | Visibilidad de enlaces por perfil | Iniciar sesión como `anaquispe`, revisar la barra; cerrar sesión y repetir con `lmamani` y `cflores` | ADMIN ve Consulta, Ingesta, Usuarios y Auditoría; ARCHIVISTA ve Consulta, Ingesta y Auditoría; VIEWER solo ve Consulta | | |
| UI-27 | Protección de rutas por perfil | Iniciar sesión como `cflores` (VIEWER) y abrir directamente `/usuarios`, `/ingesta` y `/auditoria` | Cada intento redirige a `/busqueda`; no se muestra el contenido restringido | | |
| UI-28 | Listado y alta de usuarios | Como ADMIN abrir `/usuarios`; buscar por nombre o usuario, filtrar por perfil y estado, navegar la paginación y pulsar «Nuevo usuario» | Tabla con usuario, nombre completo, correo, perfil y estado; filtros y paginación funcionan; el modal de alta muestra todos los campos | | |
| UI-29 | Validaciones de alta y edición de usuario | En el modal enviar campos vacíos; registrar un `nombre_usuario` existente; usar una contraseña de menos de 8 caracteres; editar un usuario sin cambiar la contraseña | El navegador exige los campos obligatorios y el formato de usuario; el backend informa el duplicado; se exige contraseña en el alta y se permite dejarla vacía en la edición | | |
| UI-30 | Activación y desactivación de usuarios | En `/usuarios` intentar desactivar la cuenta con la que se inició sesión; desactivar y reactivar un usuario de prueba; intentar desactivar al único administrador activo | El botón de autodesactivación está deshabilitado; la desactivación pide confirmación y muestra mensaje de éxito; el sistema impide quedar sin administradores activos | | |
| UI-31 | Validaciones del formulario de ingesta | Abrir `/ingesta`; revisar catálogos de fondo, serie y tipología; agregar y quitar interesados; enviar sin archivo; seleccionar un `.txt` y luego un archivo mayor de 50 MB | Catálogos cargados, interesados dinámicos funcionales, mensaje «Seleccione el archivo digital que desea ingresar», rechazo por extensión y por tamaño; no se valida DPI, PDF/A ni OCR (limitación del piloto) | | |
| UI-32 | Ingesta exitosa y aparición en búsqueda | Completar fondo, protocolo, año, registro y tipología; adjuntar un PDF o TIFF válido menor de 50 MB; registrar y buscar el título en `/busqueda` | Mensaje de éxito con el identificador del documento, formulario limpio y documento localizable en la búsqueda con su ficha; si no se desea crear datos, validar la solicitud multipart en la pestaña Red y consultar un documento existente | | |
| UI-33 | Filtros, paginación y detalle de auditoría | Como ADMIN y como ARCHIVISTA abrir `/auditoria`; filtrar por tipo de acción, usuario y rango de fechas; navegar la paginación y pulsar «Ver» en un registro | Ambos perfiles ven el listado filtrado y paginado; el modal de detalle muestra fecha, acción, usuario y descripción; no existen controles de edición ni eliminación | | |
| UI-34 | Menú móvil a 390 px | Con DevTools a 390 px, iniciar sesión como ADMIN y revisar `.navbar-movil-menu`; repetir con ARCHIVISTA y VIEWER | ADMIN muestra 4 secciones (Consulta, Ingesta, Usuarios, Auditoría); ARCHIVISTA muestra 3 (Consulta, Ingesta, Auditoría); VIEWER muestra solo Consulta; sin desbordes horizontales | | |

## Prueba automatizada de humo

La prueba de humo recorre los flujos críticos de la interfaz sin sustituir la lista de verificación manual. Se ejecuta desde la raíz del proyecto con:

```text
node pruebas/ui/verificar-ui.mjs
```

### Requisitos

- PostgreSQL en ejecución con la base `siarc_db` creada y cargada (`npm.cmd run db:reset`).
- API en `http://127.0.0.1:4000`.
- Frontend en `http://127.0.0.1:5173`.
- Chrome o Edge instalados.
- Dependencias de automatización instaladas con `npm.cmd install` dentro de `pruebas/evidencias`.

### Cobertura

- Inicio de sesión con el usuario ADMIN `anaquispe`.
- Navegación y visibilidad de enlaces según perfil.
- Listado, filtros y apertura del modal de alta en `/usuarios`.
- Carga de catálogos y apertura del formulario en `/ingesta`.
- Listado, filtro y modal de detalle en `/auditoria`.
- Menú móvil a 390 px.
- Consulta del historial por parte del ARCHIVISTA, incluido el filtro por usuario.
- Redirecciones de VIEWER desde `/usuarios`, `/ingesta` y `/auditoria` hacia `/busqueda`.

### Alcance

La prueba no crea usuarios ni documentos: solo abre formularios, consulta datos existentes y verifica redirecciones y visibilidad. Por ello puede ejecutarse sobre la base semilla sin alterar su contenido.

## Registro de ejecución

| Fecha | Ejecutor | Navegador | Versión | Casos ejecutados | Aprobados | Observaciones |
|-------|----------|-----------|---------|------------------|-----------|---------------|
| | | | | | | |

> Nota: complete una fila por ejecución con la evidencia correspondiente. No registre resultados aprobados sin haber ejecutado los casos ni la prueba automatizada.
