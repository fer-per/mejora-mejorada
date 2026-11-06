# Pruebas de seguridad (SEG)

## Ejecución automatizada

Desde `backend/`:

```powershell
npm.cmd test -- tests/api/seguridad.test.js
npm.cmd audit --omit=dev
node ..\pruebas\seguridad\verificar-build.mjs
```

Desde `frontend/`:

```powershell
npm.cmd run build
npm.cmd audit --omit=dev
```

## Cobertura de los casos SEG

| ID | Verificación | Dónde se ejecuta |
|----|--------------|------------------|
| SEG-01 | Inyección SQL en login | `backend/tests/api/seguridad.test.js` |
| SEG-02/03 | Comillas, comodines y parámetros manipulados | `backend/tests/api/seguridad.test.js` |
| SEG-07 | Secretos ausentes del build del frontend | `verificar-build.mjs` |
| SEG-10 | Sin pila de error en producción | `backend/tests/unit/middlewares.test.js` |
| SEG-14 | Dependencias sin vulnerabilidades críticas | `npm audit --omit=dev` |
| SEG-15/16/17 | JWT alterado, firma inválida y cabeceras mal formadas | `backend/tests/api/seguridad.test.js` |

## ZAP baseline (opcional)

Con ZAP instalado y la API en ejecución:

```powershell
zap-cli quick-scan -s xss,sqli -r http://localhost:4000/api/salud
```

Registrar el informe en `pruebas/seguridad/resultados/` y anotar los hallazgos en la
tabla de defectos del capítulo de pruebas.
