# Pruebas del SIARC-ARA

Artefactos de los niveles que no viven dentro de `backend/` (véase
`backend/tests/README.md` para las pruebas unitarias y de API).

| Carpeta | Contenido | Comando |
|---------|-----------|---------|
| `bd/` | Verificación de esquema, restricciones, integridad e índices | `npm.cmd run db:test:verificar` (desde `backend/`) |
| `jmeter/` | Plan de carga REN-03 (50 usuarios, 5 min) | `jmeter -n -t pruebas/jmeter/siarc-carga.jmx -l pruebas/jmeter/resultados/ren-03.jtl` |
| `ui/` | Lista de verificación manual (UI-01 … UI-34) y prueba de humo automatizada | Ejecución manual con evidencia; `node pruebas/ui/verificar-ui.mjs` |
| `seguridad/` | Comprobación de secretos en el build y guía `npm audit` / ZAP | `node pruebas/seguridad/verificar-build.mjs` |

## Preparación

```powershell
cd backend
npm.cmd run db:reset
npm.cmd test
npm.cmd run db:test:verificar
```

Para el plan JMeter, cree `pruebas/jmeter/resultados/` antes de ejecutarlo. El plan
obtiene el token una sola vez en un `setUp Thread Group`, de modo que los 50 hilos no
agotan el límite de 10 inicios de sesión por IP cada 5 minutos.

La prueba de humo de interfaz requiere la API en `http://127.0.0.1:4000`, el frontend
en `http://127.0.0.1:5173` y Playwright Core instalado en `pruebas/evidencias/`
(`npm.cmd install`). No crea usuarios ni documentos: solo recorre formularios y
consultas existentes.

```powershell
node pruebas/ui/verificar-ui.mjs
```
