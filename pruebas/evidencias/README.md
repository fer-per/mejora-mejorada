# Evidencias de ejecución

Esta carpeta contiene las capturas que se incorporan al capítulo IV de la tesis.

## Archivos generados

| Archivo | Origen | Estado |
|---------|--------|--------|
| `fig-iv-02-unitarias.png` | Salida real de `npm.cmd run test:unit` renderizada como consola | Generado |
| `fig-iv-07-ui-login.png` | Captura real de la pantalla de login con Playwright y Chrome | Generado |
| `fig-iv-03-api.png` | Salida de `npm.cmd run test:api` | Generado |
| `fig-iv-04-cobertura.png` | Reporte de cobertura completo | Generado |
| `fig-iv-05-bd.png` | Salida de `npm.cmd run db:test:verificar` | Generado |
| `fig-iv-06-jmeter.png` | Reporte HTML de JMeter | Pendiente de instalar/ejecutar JMeter |
| `fig-iv-08-ui-busqueda.png` | Captura real de resultados y ficha | Generado |
| `fig-iv-09-ui-visor.png` | Captura real del visor PDF/A o TIFF | Generado |
| `fig-iv-10-jmeter-grafico.png` | Gráfico de tiempos de respuesta de JMeter | Pendiente de instalar/ejecutar JMeter |
| `fig-iv-11-ui-movil.png` | Captura real opcional en vista móvil (390 px) | Generado |
| `fig-iv-12-ui-usuarios.png` | Captura real del panel de gestión de usuarios (ADMIN) | Generado |
| `fig-iv-13-ui-ingesta.png` | Captura real del formulario de ingesta documental | Generado |
| `fig-iv-14-ui-auditoria.png` | Captura real del historial de auditoría (ADMIN) | Generado |

## 1. Evidencia de pruebas unitarias

Desde la raíz del proyecto:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File pruebas/evidencias/generar-evidencia-unitarias.ps1
```

El script ejecuta las pruebas, guarda `unitarias.log` en UTF-8 y genera la imagen
`fig-iv-02-unitarias.png` con la salida real.

Para regenerar una imagen desde cualquier log:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File pruebas/evidencias/renderizar-consola.ps1 `
  -LogPath pruebas/evidencias/unitarias.log `
  -OutputPath pruebas/evidencias/fig-iv-02-unitarias.png `
  -Title "Windows PowerShell - Pruebas unitarias SIARC-ARA" `
  -Command "npm.cmd run test:unit"
```

La imagen de consola es una **representación visual de la salida real**, no una captura
de pantalla del escritorio. Si la universidad exige una captura literal, ejecutar el
comando en una terminal visible y usar `Win + Shift + S`.

## 2. Capturas de interfaz

Requisitos:

- PostgreSQL en ejecución y base `siarc_db` creada con `npm.cmd run db:reset`.
- Backend en `http://localhost:4000` (`npm.cmd start` en `backend/`).
- Frontend en `http://localhost:5173` (`npm.cmd run dev` en `frontend/`).
- Chrome o Edge instalado. Playwright Core usa el navegador del sistema.

Instalación de la herramienta de captura (solo la primera vez):

```powershell
cd pruebas/evidencias
npm.cmd install
```

Capturas completas:

```powershell
cd pruebas/evidencias
npm.cmd run ui
```

Capturas esperadas:

- `fig-iv-07-ui-login.png`
- `fig-iv-08-ui-busqueda.png`
- `fig-iv-09-ui-visor.png`
- `fig-iv-12-ui-usuarios.png`
- `fig-iv-13-ui-ingesta.png`
- `fig-iv-14-ui-auditoria.png`

Variables opcionales:

```powershell
$env:BASE_URL = "http://localhost:5173"
$env:UI_USUARIO = "anaquispe"
$env:UI_CONTRASENA = "Admin123!"
$env:UI_CONSULTA = "aguas"
$env:CAPTURAR_MOVIL = "1"     # genera fig-iv-11-ui-movil.png a 390 px
$env:CAPTURAR_MODULOS = "0"   # omite las capturas de usuarios, ingesta y auditoría
$env:HEADED = "1"             # muestra el navegador durante la captura
```

Si solo se desea la pantalla de login (no requiere backend ni PostgreSQL):

```powershell
$env:SOLO_LOGIN = "1"
npm.cmd run ui
```

## 3. Capturas de JMeter

Generar primero el reporte HTML:

```powershell
jmeter -n -t pruebas/jmeter/siarc-carga.jmx `
  -l pruebas/jmeter/resultados/ren-03.jtl `
  -e -o pruebas/jmeter/resultados/ren-03
```

Luego capturar el dashboard y el gráfico:

```powershell
cd pruebas/evidencias
npm.cmd run jmeter
```

Si el reporte está en otra ruta:

```powershell
$env:JMETER_REPORT = "C:\ruta\al\reporte\index.html"
npm.cmd run jmeter
```

## 4. Recomendaciones para la tesis

1. Usar las imágenes generadas solo si la ejecución fue exitosa.
2. No editar las capturas para ocultar fallos; documentarlos en la Tabla IV.12.
3. Verificar que la fecha y hora de la captura coincidan con la Tabla IV.4.
4. En el texto, referenciar cada figura: «como se observa en la Figura IV.2...».
5. Conservar los logs junto a las imágenes como respaldo de la ejecución.
