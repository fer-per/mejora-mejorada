# Pruebas del backend (SIARC-ARA)

Implementación del apartado «IV. Plan y diseño de pruebas» de la tesis.

## Requisitos

- Node.js ≥ 20
- PostgreSQL ≥ 14 en ejecución con un usuario capaz de crear bases de datos
- Base de demostración creada (`npm run db:reset`) para que exista
  `storage/repositorio` con los PDF/A, TIFF y miniaturas

Las pruebas de integración usan una base independiente cuyo nombre **debe** terminar
en `_test` (por defecto `siarc_db_test`). El helper se niega a ejecutarse contra
cualquier otro nombre para no borrar datos reales. La conexión se toma de `backend/.env`
y se puede sobreescribir con `DB_NAME_TEST`.

## Comandos

```powershell
# Desde backend/
npm.cmd install
npm.cmd test                 # todas las pruebas
npm.cmd test:unit            # solo unitarias (no requieren PostgreSQL)
npm.cmd test:api             # solo integración (requiere PostgreSQL)
npm.cmd test:coverage        # cobertura con V8
npm.cmd db:test:reset        # recrea siarc_db_test (schema + seed)
npm.cmd db:test:verificar    # verifica esquema, restricciones e índices en siarc_db
```

Las pruebas de integración recrean `siarc_db_test` antes de cada archivo mediante
`tests/helpers/db.js`. El limitador de intentos por IP se reinicia antes de cada caso.

## Estructura

```
backend/tests/
├─ unit/
│  ├─ esquemas.test.js       # Zod: login, búsqueda simple/avanzada, ids
│  ├─ middlewares.test.js    # authorizar, rate-limit, error-handler (SEG-10)
│  └─ utilidades.test.js     # rutas del repositorio, nombres de descarga, almacenamiento
├─ api/
│  ├─ auth.test.js           # AUT-01 … AUT-25
│  ├─ busqueda.test.js       # BUS y AVZ
│  ├─ detalle-archivo.test.js# DET y ARC
│  ├─ catalogos-auditoria.test.js # CAT y AUD
│  └─ seguridad.test.js      # AZ y SEG
├─ helpers/
│  ├─ api.js                 # app, login y cabecera Bearer
│  ├─ db.js                  # creación/reinicio de siarc_db_test y consultas
│  └─ preparar-bd.mjs        # CLI para db:test:reset
└─ setup/
   ├─ env.js                 # NODE_ENV=test, siarc_db_test, secreto de pruebas
   └─ global.js              # reset del rate-limit y cierre del pool
```

## Trazabilidad

| Bloque de la tesis | Archivo |
|--------------------|---------|
| AUT | `unit/esquemas.test.js`, `api/auth.test.js` |
| AZ / SEG | `unit/middlewares.test.js`, `api/seguridad.test.js` |
| BUS / AVZ | `unit/esquemas.test.js`, `api/busqueda.test.js` |
| DET / ARC | `api/detalle-archivo.test.js` |
| CAT / AUD | `api/catalogos-auditoria.test.js` |
| BD | `../pruebas/bd/verificar-bd.mjs` |
| UI | `../pruebas/ui/lista-verificacion.md` |
| REN | `../pruebas/jmeter/siarc-carga.jmx` |

## Defectos conocidos marcados como `it.fails`

- **AVZ-12**: fechas con formato válido pero inexistentes (`2024-02-31`, `2024-13-01`)
  superan Zod y PostgreSQL responde con un error no mapeado (HTTP 500). El caso está
  marcado con `it.fails`; cuando el esquema valide el calendario, la prueba fallará y
  deberá cambiarse a `it`.
