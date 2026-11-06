# Continuación del capítulo IV para la tesis

Este archivo contiene el texto que debe añadirse **después del apartado 6.11** del
capítulo «IV. Plan y diseño de pruebas». Mantiene el estilo de la tesis (tablas,
figuras y referencias en el texto). Los valores entre corchetes `[...]` y las figuras
marcadas como `<CAPTURA>` deben completarse después de ejecutar las pruebas en el
equipo donde esté instalado PostgreSQL.

> Regla de presentación: en la tesis no se pega la consola completa. Se coloca la
> **captura** de la ejecución y, debajo, una **tabla resumen** con los casos aprobados,
> fallidos y observaciones. La captura demuestra que la prueba se ejecutó; la tabla
> permite leer el resultado sin ampliar la imagen.
>
> Numeración: este documento usa numeración por capítulo (`Tabla IV.1`, `Figura IV.1`)
> para no chocar con las tablas y figuras ya existentes. Si la universidad exige
> numeración correlativa global, reemplazar por el siguiente número disponible. En el
> `tesis.txt` actual la última figura es la 26, por lo que las figuras de este capítulo
> empezarían en 27; las tablas deben revisarse porque el documento ya tiene numeración
> irregular (Tabla 8 y Tabla 2).

---

## 7. Implementación de las pruebas

La implementación se organizó por niveles, de modo que cada prueba tenga un alcance
delimitado y pueda repetirse de forma automática. La Tabla IV.1 resume los artefactos
construidos y la herramienta utilizada en cada nivel.

**Tabla IV.1.** Artefactos de prueba implementados.

| Nivel | Artefacto | Herramienta | Qué verifica |
|-------|-----------|-------------|--------------|
| Unitaria | `backend/tests/unit/esquemas.test.js` | Vitest | Validación Zod de login, búsqueda simple, búsqueda avanzada e identificadores |
| Unitaria | `backend/tests/unit/middlewares.test.js` | Vitest | Autorización por perfil, límite de intentos y manejo de errores |
| Unitaria | `backend/tests/unit/utilidades.test.js` | Vitest | Resolución de rutas del repositorio, nombres de descarga y tipos de archivo |
| Integración (API) | `backend/tests/api/auth.test.js` | Vitest + Supertest | AUT-01 a AUT-25 sobre la API y PostgreSQL de prueba |
| Integración (API) | `backend/tests/api/busqueda.test.js` | Vitest + Supertest | BUS y AVZ sobre el motor de búsqueda real |
| Integración (API) | `backend/tests/api/detalle-archivo.test.js` | Vitest + Supertest | DET y ARC, incluido el acceso autenticado a PDF/A, TIFF y miniaturas |
| Integración (API) | `backend/tests/api/catalogos-auditoria.test.js` | Vitest + Supertest | CAT y AUD contra las tablas del sistema |
| Integración (API) | `backend/tests/api/seguridad.test.js` | Vitest + Supertest | AZ y SEG: tokens, CORS, cabeceras e inyección |
| Base de datos | `pruebas/bd/verificar-bd.mjs` | Node.js + `pg` | Tablas, extensiones, restricciones, claves foráneas e índices GIN |
| Interfaz | `pruebas/ui/lista-verificacion.md` | Ejecución manual | UI-01 a UI-25 en Chrome, Edge y Firefox |
| Rendimiento | `pruebas/jmeter/siarc-carga.jmx` | Apache JMeter | REN-01 a REN-05 y REN-09 |
| Seguridad del build | `pruebas/seguridad/verificar-build.mjs` | Node.js | Ausencia de secretos en `frontend/dist` |

La configuración común se concentra en `backend/vitest.config.js`. Las pruebas de API
se ejecutan contra una base independiente, `siarc_db_test`, que se crea y se recrea
automáticamente antes de cada archivo de pruebas. El helper `backend/tests/helpers/db.js`
rechaza cualquier nombre de base que no termine en `_test`, con lo que se evita borrar
la base de demostración `siarc_db`.

La Tabla IV.2 presenta la distribución de casos automatizados. En total se implementaron
**139 pruebas automatizadas**: 35 unitarias y 104 de integración.

**Tabla IV.2.** Distribución de pruebas automatizadas por bloque.

| Bloque | Archivo | N.º de pruebas |
|--------|---------|----------------|
| AUT | `auth.test.js` | 23 |
| BUS | `busqueda.test.js` | 18 |
| AVZ | `busqueda.test.js` | 16 |
| DET | `detalle-archivo.test.js` | 8 |
| ARC | `detalle-archivo.test.js` | 11 |
| CAT | `catalogos-auditoria.test.js` | 4 |
| AUD | `catalogos-auditoria.test.js` | 6 |
| AZ | `seguridad.test.js` | 12 |
| SEG | `seguridad.test.js` | 6 |
| Unitaria | `tests/unit/` | 35 |
| **Total** | | **139** |

### 7.1 Preparación del entorno de ejecución

Antes de la primera ejecución se preparan la base de demostración, el repositorio
digital y la base de pruebas. Los comandos se ejecutan desde la carpeta `backend/`:

```powershell
npm.cmd install
npm.cmd run db:reset          # crea siarc_db, carga el seed y genera PDF/A, TIFF y miniaturas
npm.cmd run db:test:reset     # crea siarc_db_test con el mismo esquema y datos
npm.cmd run test:unit         # pruebas unitarias, no requieren PostgreSQL
npm.cmd run test:api          # pruebas de integración contra siarc_db_test
npm.cmd run test:coverage     # cobertura de código
npm.cmd run db:test:verificar # verificación de esquema, restricciones e índices en siarc_db
```

**Figura IV.1.** Preparación de las bases de datos de demostración y de pruebas.
`<CAPTURA: terminal con la salida de db:reset y db:test:reset>`

En el texto de la tesis debe explicarse qué muestra la figura. Ejemplo:

> En la Figura IV.1 se observa la recreación de las dos bases de datos. La base
> `siarc_db` se utiliza para la demostración y conserva los archivos del repositorio
> digital; la base `siarc_db_test` se utiliza exclusivamente para las pruebas de
> integración y se reconstruye antes de cada archivo de pruebas para garantizar que
> los resultados no dependan de ejecuciones anteriores.

### 7.2 Trazabilidad entre el diseño y la implementación

La Tabla IV.3 permite justificar que cada bloque del diseño tiene una implementación
concreta. Esta tabla es la que sustenta el indicador «cobertura de requerimientos
validados» del objetivo específico OE1.

**Tabla IV.3.** Trazabilidad entre casos de prueba y código ejecutado.

| Bloque | Casos del apartado 6 | Archivo de prueba | Código principal ejercitado |
|--------|----------------------|-------------------|-----------------------------|
| AUT | AUT-01 a AUT-25 | `tests/api/auth.test.js` | `modules/auth/*`, `middlewares/rate-limit.js` |
| AZ | AZ-01 a AZ-09 | `tests/api/seguridad.test.js`, `tests/unit/middlewares.test.js` | `middlewares/authenticate.js`, `authorize.js` |
| BUS | BUS-01 a BUS-19 | `tests/api/busqueda.test.js` | `documentos.repository.js`, `documentos.service.js` |
| AVZ | AVZ-01 a AVZ-20 | `tests/api/busqueda.test.js` | `documentos.schema.js`, `documentos.repository.js` |
| DET | DET-01 a DET-09 | `tests/api/detalle-archivo.test.js` | `documentos.service.js` |
| ARC | ARC-01 a ARC-10 | `tests/api/detalle-archivo.test.js` | `documentos.controller.js`, `config/almacenamiento.js` |
| CAT | CAT-01 a CAT-04 | `tests/api/catalogos-auditoria.test.js` | `catalogos.repository.js` |
| AUD | AUD-01 a AUD-10 | `tests/api/catalogos-auditoria.test.js` | `auditoria.repository.js` |
| BD | BD-01 a BD-04 y BD-06 a BD-10 | `pruebas/bd/verificar-bd.mjs` | `database/schema.sql`, `database/seed.sql` |
| UI | UI-01 a UI-19 y UI-20 a UI-25 | `pruebas/ui/lista-verificacion.md` | `frontend/src/**` |
| REN | REN-01 a REN-09 | `pruebas/jmeter/siarc-carga.jmx` | API completa bajo carga |
| SEG | SEG-01 a SEG-17 | `tests/api/seguridad.test.js`, `tests/unit/middlewares.test.js` | `app.js`, `error-handler.js`, `authenticate.js` |

> La lista de interfaz amplía los casos UI-01 a UI-19 del apartado 6.8 con seis
> verificaciones adicionales (UI-20 a UI-25): cierre de sesión, tres anchos de
> pantalla, XSS en metadatos y accesibilidad básica por teclado.

---

## 8. Ejecución de las pruebas

### 8.1 Procedimiento seguido

La ejecución se realizó en el siguiente orden, con el fin de aislar los fallos de
infraestructura de los fallos funcionales:

1. Se verificó que PostgreSQL estuviera disponible y que `storage/repositorio`
   contuviera los documentos de demostración.
2. Se recrearon las bases `siarc_db` y `siarc_db_test`.
3. Se ejecutaron las pruebas unitarias (`npm.cmd run test:unit`).
4. Se ejecutaron las pruebas de integración (`npm.cmd run test:api`).
5. Se generó el reporte de cobertura (`npm.cmd run test:coverage`).
6. Se ejecutó la verificación de base de datos (`npm.cmd run db:test:verificar`).
7. Se ejecutaron las pruebas de interfaz según la lista de verificación y el plan
   JMeter para rendimiento.
8. Se registraron los defectos y se repitieron los casos afectados tras la corrección.

### 8.2 Capturas que deben incluirse

Cada captura debe mostrar la ventana de la terminal con el comando visible y el
resumen final (`Test Files`, `Tests`, `Duration`). No se deben recortar las líneas de
aprobado/fallido. En Windows puede usarse `Win + Shift + S` o la Herramienta de
recortes. Guardar las imágenes en `pruebas/evidencias/` con el nombre indicado.

| Figura | Nombre del archivo | Qué debe mostrar | Comando |
|--------|--------------------|------------------|---------|
| Figura IV.2 | `fig-iv-02-unitarias.png` | 3 archivos y 35 pruebas aprobadas | `npm.cmd run test:unit` |
| Figura IV.3 | `fig-iv-03-api.png` | Resumen de los 104 casos de integración | `npm.cmd run test:api` |
| Figura IV.4 | `fig-iv-04-cobertura.png` | Tabla de cobertura por archivo | `npm.cmd run test:coverage` |
| Figura IV.5 | `fig-iv-05-bd.png` | Salida PASS de las 9 verificaciones BD | `npm.cmd run db:test:verificar` |
| Figura IV.6 | `fig-iv-06-jmeter.png` | Aggregate Report con p95 y throughput | JMeter |
| Figura IV.7 | `fig-iv-07-ui-login.png` | Pantalla de inicio de sesión | Navegador |
| Figura IV.8 | `fig-iv-08-ui-busqueda.png` | Resultados, filtros y ficha descriptiva | Navegador |
| Figura IV.9 | `fig-iv-09-ui-visor.png` | Visor PDF/A o TIFF | Navegador |
| Figura IV.10 | `fig-iv-10-jmeter-grafico.png` | Gráfico de tiempos de respuesta | JMeter |

**Figura IV.2.** Ejecución de las pruebas unitarias con Vitest.
Imagen generada: `pruebas/evidencias/fig-iv-02-unitarias.png` (salida real de
`npm.cmd run test:unit` renderizada como consola).

Texto sugerido para acompañar la Figura IV.2:

> La Figura IV.2 muestra la ejecución de las tres suites unitarias. Vitest reporta
> 3 archivos y 35 pruebas aprobadas, sin fallos. La duración de la ejecución fue de
> [X] segundos. Estas pruebas no requieren PostgreSQL porque validan esquemas,
> middlewares y funciones puras de forma aislada.

**Figura IV.3.** Ejecución de las pruebas de integración de la API.
Imagen generada: `pruebas/evidencias/fig-iv-03-api.png` (salida real de
`npm.cmd run test:api` renderizada como consola).

Texto sugerido:

> En la Figura IV.3 se observa la ejecución de los 104 casos de integración. Cada
> archivo recrea la base `siarc_db_test` y reinicia el limitador de intentos, por lo
> que el resultado es reproducible. Se aprobaron [N] casos y se registraron [M]
> defectos, detallados en la Tabla IV.12.

**Figura IV.4.** Reporte de cobertura de código generado por Vitest.
Imagen generada: `pruebas/evidencias/fig-iv-04-cobertura.png` (reporte real de
cobertura por archivo renderizado como consola).

**Figura IV.5.** Verificación de la base de datos.
Imagen generada: `pruebas/evidencias/fig-iv-05-bd.png` (salida real con la tabla
PASS/FAIL de las verificaciones BD).

**Figura IV.6.** Resultados de la prueba de carga con Apache JMeter.
`<CAPTURA: Aggregate Report con Average, Median, 90%, 95%, 99%, Throughput y Error %>`

**Figura IV.7.** Pantalla de inicio de sesión del SIARC-ARA.
Imagen generada: `pruebas/evidencias/fig-iv-07-ui-login.png` (captura real tomada con
Playwright y Chrome). La pantalla muestra las cuentas de demostración del piloto; son
credenciales públicas de prueba, no credenciales de producción.

**Figura IV.8.** Consulta documental y ficha descriptiva.
Imagen generada: `pruebas/evidencias/fig-iv-08-ui-busqueda.png` (captura real de los
resultados de búsqueda y del panel de detalle con metadatos).

**Figura IV.9.** Visor de documentos digitalizados.
Imagen generada: `pruebas/evidencias/fig-iv-09-ui-visor.png` (captura real del PDF/A
en el iframe y del TIFF multipágina en el canvas).

**Figura IV.10.** Gráfico de tiempos de respuesta de JMeter.
`<CAPTURA: Response Time Graph de la corrida REN-03>`

### 8.3 Registro de la ejecución

La Tabla IV.4 debe completarse con los datos reales del equipo y de la fecha. Es
importante porque el lector necesita saber en qué condiciones se obtuvieron los
resultados.

**Tabla IV.4.** Registro de ejecución.

| Elemento | Valor |
|----------|-------|
| Fecha de ejecución | [dd/mm/aaaa] |
| Ejecutor | Fernando Pérez del Castillo |
| Sistema operativo | Windows 11 |
| Procesador / memoria | [procesador] / [memoria] RAM |
| Node.js | [versión] |
| PostgreSQL | [versión] |
| Navegadores | Chrome [versión], Edge [versión], Firefox [versión] |
| Base de demostración | `siarc_db` |
| Base de pruebas | `siarc_db_test` |
| Repositorio digital | `storage/repositorio` |
| Herramienta de carga | Apache JMeter [versión] |

---

## 9. Resultados de las pruebas

### 9.1 Resumen general

La Tabla IV.5 es la primera tabla de resultados que debe aparecer en la tesis. Resume
la ejecución por nivel. Los valores de las pruebas unitarias ya están obtenidos; los
demás se completan al ejecutar.

**Tabla IV.5.** Resumen general de la ejecución.

| Nivel | Casos planificados | Ejecutados | Aprobados | Fallidos | % de aprobación |
|-------|--------------------|------------|-----------|----------|-----------------|
| Unitarias | 35 | 35 | 35 | 0 | 100,0 % |
| Integración API | 104 | [104] | [ ] | [ ] | [ ] % |
| Base de datos | 9 | [9] | [ ] | [ ] | [ ] % |
| Interfaz (UI) | 25 | [25] | [ ] | [ ] | [ ] % |
| Rendimiento (REN) | 6 | [6] | [ ] | [ ] | [ ] % |
| Seguridad manual | 2 | [2] | [ ] | [ ] | [ ] % |
| **Total** | **181** | **[181]** | **[ ]** | **[ ]** | **[ ] %** |

> Nota: los 35 casos unitarios se ejecutaron y aprobaron al momento de implementar la
> suite. Si la ejecución definitiva se realiza en otro equipo, reemplazar la fila por
> el resultado de esa corrida. Las 9 verificaciones de base de datos corresponden a
> BD-01 a BD-04 y BD-06 a BD-10; BD-05 no se implementó porque el plan original no
> definió un escenario para ese identificador.

### 9.2 Resultados por bloque funcional

La Tabla IV.6 muestra el detalle que se obtiene al ejecutar `npm.cmd run test:api`.
Cada fila corresponde a un bloque del diseño del apartado 6.

**Tabla IV.6.** Resultados de las pruebas de integración por bloque.

| Bloque | Casos | Pruebas | Aprobadas | Fallidas | Estado | Observación |
|--------|-------|---------|-----------|----------|--------|-------------|
| AUT | AUT-01–25 | 23 | [ ] | [ ] | [ ] | [ ] |
| BUS | BUS-01–19 | 18 | [ ] | [ ] | [ ] | [ ] |
| AVZ | AVZ-01–20 | 16 | [ ] | [ ] | [ ] | AVZ-12 marcado como defecto conocido |
| DET | DET-01–09 | 8 | [ ] | [ ] | [ ] | [ ] |
| ARC | ARC-01–10 | 11 | [ ] | [ ] | [ ] | [ ] |
| CAT | CAT-01–04 | 4 | [ ] | [ ] | [ ] | [ ] |
| AUD | AUD-01–10 | 6 | [ ] | [ ] | [ ] | [ ] |
| AZ | AZ-01–09 | 12 | [ ] | [ ] | [ ] | [ ] |
| SEG | SEG-01–17 | 6 | [ ] | [ ] | [ ] | [ ] |
| **Total** | | **104** | **[ ]** | **[ ]** | **[ ]** | |

### 9.3 Resultados de las pruebas unitarias

La Tabla IV.7 desglosa las 35 pruebas unitarias efectivamente aprobadas.

**Tabla IV.7.** Resultados de las pruebas unitarias.

| Suite | Qué valida | Pruebas | Aprobadas | Fallidas |
|-------|------------|---------|-----------|----------|
| `esquemas.test.js` | Login, identificadores, búsqueda simple y avanzada | 20 | 20 | 0 |
| `middlewares.test.js` | `autorizar`, límite de intentos y `manejarErrores` | 9 | 9 | 0 |
| `utilidades.test.js` | Rutas del repositorio, nombres de descarga y almacenamiento | 6 | 6 | 0 |
| **Total** | | **35** | **35** | **0** |

### 9.4 Resultados de la verificación de base de datos

La Tabla IV.8 se completa con la salida de `npm.cmd run db:test:verificar`. El script
imprime PASS o FAIL por cada verificación.

**Tabla IV.8.** Resultados de las verificaciones de base de datos.

| ID | Verificación | Resultado | Detalle |
|----|--------------|-----------|---------|
| BD-01 | Tablas y extensiones creadas | [PASS] | [ ] |
| BD-02 | Datos semilla cargados | [PASS] | 11 archivos, 3 usuarios, 10 títulos |
| BD-03 | CHECK de formato TIFF/PDF-A | [PASS] | código 23514 verificado |
| BD-04 | CHECK de estado de conservación | [PASS] | código 23514 verificado |
| BD-06 | Unicidad de usuario y correo | [PASS] | código 23505 verificado |
| BD-07 | Integridad referencial fondo → protocolo | [PASS] | código 23503 verificado |
| BD-08 | Índices GIN de texto y trigramas | [PASS] | 3 índices |
| BD-09 | `f_unaccent` IMMUTABLE | [PASS] | `provolatile = i` |
| BD-10 | Plan de búsqueda de texto completo | [PASS] | [plan obtenido] |
| **Total** | | **[ ] / 9** | |

### 9.5 Resultados de rendimiento

La Tabla IV.9 resume la corrida REN-03. Los valores deben copiarse del Aggregate Report
de JMeter. La meta de la tesis es p95 ≤ 2 s y error < 1 %.

**Tabla IV.9.** Resultados de la prueba de carga REN-03.

| Métrica | Valor obtenido | Meta | Cumple |
|---------|----------------|------|--------|
| Usuarios concurrentes | 50 | 50 | Sí |
| Duración | 300 s | 300 s | Sí |
| Peticiones totales | [ ] | — | — |
| Tiempo promedio | [ ] ms | — | — |
| Mediana (p50) | [ ] ms | — | — |
| p90 | [ ] ms | — | — |
| p95 | [ ] ms | ≤ 2 000 ms | [ ] |
| p99 | [ ] ms | — | — |
| Throughput | [ ] req/s | — | — |
| Porcentaje de error | [ ] % | < 1 % | [ ] |

### 9.6 Resultados de la interfaz y usabilidad

La Tabla IV.10 resume la lista de verificación UI. El detalle con evidencias se
conserva en `pruebas/ui/lista-verificacion.md`.

**Tabla IV.10.** Resultados de las pruebas de interfaz.

| Grupo | Casos | Aprobados | Fallidos | Observaciones |
|-------|-------|-----------|----------|---------------|
| Sesión y rutas | UI-01–06, UI-20 | [ ] | [ ] | [ ] |
| Búsqueda y paginación | UI-07–13 | [ ] | [ ] | [ ] |
| Ficha y visor | UI-14–18 | [ ] | [ ] | [ ] |
| Errores y seguridad | UI-19, UI-24 | [ ] | [ ] | [ ] |
| Responsividad | UI-21–23 | [ ] | [ ] | [ ] |
| Accesibilidad | UI-25 | [ ] | [ ] | [ ] |
| **Total** | **25** | **[ ]** | **[ ]** | |

Si se aplicó la encuesta Likert, agregar la Tabla IV.11 con el promedio por dimensión y
el número de participantes (mínimo 10 según la meta de la tesis).

**Tabla IV.11.** Resultados de satisfacción de usuario.

| Dimensión | Promedio (1–5) | Participantes |
|-----------|----------------|---------------|
| Facilidad de uso | [ ] | [ ] |
| Claridad de la búsqueda | [ ] | [ ] |
| Utilidad del visor documental | [ ] | [ ] |
| Satisfacción general | [ ] | [ ] |

### 9.7 Defectos y observaciones

La Tabla IV.12 registra los defectos detectados durante la ejecución. El defecto D-01
(AVZ-12) permanece abierto y documentado como riesgo residual; el defecto D-02 se
detectó durante la captura de evidencias de interfaz y ya fue corregido.

**Tabla IV.12.** Defectos detectados.

| ID | Caso | Descripción | Severidad | Estado | Corrección |
|----|------|-------------|-----------|--------|------------|
| D-01 | AVZ-12 | Una fecha con formato válido pero inexistente, como `2024-02-31`, supera la validación Zod y PostgreSQL responde con un error no mapeado (HTTP 500 en lugar de 400) | Media | Abierto / conocido | Se recomienda validar el calendario en `documentos.schema.js` o mapear el código PostgreSQL `22008` a 400 |
| D-02 | BUS (UI) | Al mantener el puntero sobre el botón «Buscar», la regla `.btn:hover` de Bootstrap anulaba el fondo y el texto quedaba blanco sobre blanco | Baja | Corregido | Se fijó `background: var(--vino)` en `.boton-buscar:hover:not(:disabled)` de `frontend/src/styles/global.css` |

> En la tesis conviene redactar el defecto sin dramatizarlo y vincularlo con una acción
> concreta. Ejemplo: «El defecto D-01 no afecta a las operaciones con fechas reales,
> pero se documenta porque una entrada manipulada puede generar un error 500. La
> corrección prevista consiste en validar la fecha del calendario antes de enviar la
> consulta a PostgreSQL».

### 9.8 Análisis y discusión de resultados

Este apartado no debe limitarse a repetir las tablas. Debe interpretar qué significan
los resultados para los objetivos de la tesis. Usar esta estructura:

1. **Cumplimiento del OE3 (calidad de registros y consulta).** Indicar cuántos casos de
   AUT, BUS, AVZ, DET y ARC se aprobaron y qué implica para la consulta documental.
2. **Cumplimiento del OE4 (rendimiento).** Comparar el p95 y el porcentaje de error con
   las metas (≤ 2 s y < 1 %). Si la corrida se hizo en un equipo local, aclararlo.
3. **Cumplimiento de HU-17 (seguridad de acceso).** Señalar que los casos AUT-07,
   AUT-08, AUT-15 y SEG-15 evidencian el bloqueo por intentos fallidos y la
   imposibilidad de escalar privilegios alterando el JWT.
4. **Cumplimiento de CU-19 (auditoría).** Señalar que AUD-01 a AUD-10 confirman el
   registro de las operaciones y la ausencia de contraseñas o tokens en las
   descripciones.
5. **Defectos.** Explicar el alcance del defecto D-01 y su riesgo residual, y mencionar
   que D-02 se corrigió antes de generar las capturas definitivas.

Texto modelo para el párrafo de cierre:

> Los resultados muestran que el sistema cumple los criterios funcionales evaluados:
> las [N] pruebas de integración aprobadas cubren autenticación, autorización,
> búsqueda simple y avanzada, detalle, acceso a archivos, catálogos y auditoría. Las 35
> pruebas unitarias aprobadas respaldan la validación de entradas y el manejo de
> errores. En rendimiento, el percentil 95 fue de [X] ms, inferior al límite de 2 000
> ms definido en el objetivo específico OE4. El defecto D-01 queda documentado como
> riesgo residual de baja frecuencia, ya que requiere una fecha formalmente válida pero
> inexistente en el calendario.

### 9.9 Amenazas a la validez

Este apartado ya está anticipado en el plan. Debe repetirse aquí con los datos reales:

> Las mediciones de rendimiento se ejecutaron en un equipo local con [características],
> mientras que la arquitectura de producción prevista en la tesis utiliza tres niveles
> sobre Ubuntu Server. Por ello, los valores de la Tabla IV.9 se interpretan como
> indicativos y no como una garantía de producción. Para reducir esta amenaza, JMeter
> se ejecutó desde [equipo] y se registró la configuración de hardware. Asimismo, la
> base de pruebas contiene 11 documentos, por lo que las pruebas de búsqueda validan la
> corrección funcional, pero no el comportamiento con el volumen completo del archivo;
> las pruebas REN-10 con 10 000 documentos sintéticos quedan como trabajo complementario.

---

## 10. Conclusiones del capítulo de pruebas

Texto modelo para cerrar el capítulo:

> La implementación de las pruebas permitió verificar el sistema en tres niveles
> complementarios. Las pruebas unitarias confirmaron la validación de entradas y el
> manejo de errores; las pruebas de integración comprobaron el comportamiento de la API
> contra PostgreSQL y el repositorio digital; y las pruebas de interfaz validaron el
> flujo de consulta percibido por el usuario. Los casos críticos de autenticación,
> control de acceso, bloqueo por intentos fallidos, búsqueda, detalle, visor y auditoría
> fueron aprobados. El único defecto abierto, D-01, está asociado a fechas inexistentes
> y no impide el uso normal del sistema. Con ello, la suite implementada proporciona
> evidencia objetiva para los criterios de validación OE3 y OE4, y deja preparada la
> base para repetir la ejecución en el entorno del Archivo Regional de Arequipa.

---

## Anexo A. Cómo capturar las evidencias

1. Abrir PowerShell en `backend/`.
2. Ejecutar el comando y esperar a que termine.
3. Ampliar la ventana para que se vea el comando, la salida y el resumen final.
4. Capturar con `Win + Shift + S` y guardar en `pruebas/evidencias/` con el nombre de
   la tabla de figuras.
5. No editar la imagen para ocultar fallos: si hay un fallo, se documenta en la Tabla
   IV.12 y se vuelve a ejecutar tras la corrección. La captura de la segunda ejecución
   es la que se coloca en la tesis, acompañada de la mención al defecto corregido.

Para conservar la evidencia en texto además de la imagen:

```powershell
# Desde backend/
mkdir ..\pruebas\evidencias -Force
npm.cmd run test:unit  *> ..\pruebas\evidencias\unitarias.log
npm.cmd run test:api   *> ..\pruebas\evidencias\api.log
npm.cmd run test:coverage *> ..\pruebas\evidencias\cobertura.log
npm.cmd run db:test:verificar *> ..\pruebas\evidencias\bd.log
```

## Anexo B. Plantilla de tabla de casos ejecutados

Si la universidad exige el detalle caso por caso, usar esta plantilla en un anexo y
referenciarla desde el apartado 9.2. No es necesario incluirla en el cuerpo principal
si ya se presenta la Tabla IV.6.

| ID | Escenario | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|----|-----------|--------------------|--------------------|--------|-----------|
| AUT-01 | Login con `anaquispe` | 200 + JWT | [ ] | [ ] | Fig. IV.3 |
| AUT-07 | Cinco intentos fallidos | 403 `CUENTA_BLOQUEADA` | [ ] | [ ] | Fig. IV.3 |
| BUS-01 | Búsqueda `aguas` | Resultados con miniatura | [ ] | [ ] | Fig. IV.8 |
| AVZ-08 | Filtros combinados | Solo documentos que cumplen todo | [ ] | [ ] | Fig. IV.8 |
| DET-01 | Detalle del documento 1 | Ficha con interesados | [ ] | [ ] | Fig. IV.8 |
| ARC-01 | Descargar PDF/A | `application/pdf` inline | [ ] | [ ] | Fig. IV.9 |
| ARC-02 | Descargar TIFF | `image/tiff` inline | [ ] | [ ] | Fig. IV.9 |
| AUD-04 | Búsqueda auditada | Fila `CONSULTA_DOCUMENTAL` | [ ] | [ ] | Fig. IV.5 |

## Anexo C. Formato de salida esperado

Las pruebas unitarias deben mostrar un resumen equivalente a este:

```text
 ✓ tests/unit/middlewares.test.js (9 tests)
 ✓ tests/unit/esquemas.test.js (20 tests)
 ✓ tests/unit/utilidades.test.js (6 tests)

 Test Files  3 passed (3)
      Tests  35 passed (35)
   Duration  [X]s
```

Las pruebas de integración deben mostrar un resumen equivalente a este (los tiempos y
el orden pueden variar):

```text
 ✓ tests/api/auth.test.js (23 tests)
 ✓ tests/api/busqueda.test.js (34 tests)
 ✓ tests/api/catalogos-auditoria.test.js (10 tests)
 ✓ tests/api/detalle-archivo.test.js (19 tests)
 ✓ tests/api/seguridad.test.js (18 tests)

 Test Files  5 passed (5)
      Tests  104 passed (104)
   Duration  [X]s
```

La verificación de base de datos debe mostrar:

```text
BD-01    PASS    Esquema: tablas y extensiones creadas
BD-02    PASS    Datos semilla cargados
...
[BD] 9 correctas, 0 fallidas.
```

## Anexo D. Lista de verificación antes de entregar el capítulo

- [ ] Las tablas IV.1 a IV.12 están numeradas de forma continua con el resto de la tesis.
- [ ] Cada figura tiene número, título y una referencia en el texto («como se observa
      en la Figura IV.2…»).
- [ ] Las capturas muestran el comando y el resumen final, no solo una parte.
- [ ] Los valores `[ ]` fueron reemplazados por los resultados reales.
- [ ] La fecha y las versiones de la Tabla IV.4 coinciden con las capturas.
- [ ] El defecto D-01 aparece tanto en la Tabla IV.12 como en el análisis (apartado 9.8).
- [ ] No se incluyeron contraseñas, tokens ni rutas absolutas personales en las
      capturas.
- [ ] Los porcentajes de aprobación se calcularon con la fórmula
      `aprobados / ejecutados × 100`.
