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

## Registro de ejecución

| Fecha | Ejecutor | Navegador | Versión | Casos ejecutados | Aprobados | Observaciones |
|-------|----------|-----------|---------|------------------|-----------|---------------|
| | | | | | | |
