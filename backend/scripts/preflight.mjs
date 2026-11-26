import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const nombreBase = process.env.DB_NAME ?? 'siarc_db';
const esquema = process.env.DB_SCHEMA ?? 'public';

if (!/^[A-Za-z0-9_]+$/.test(nombreBase)) {
  console.error(`[preflight] Nombre de base de datos inválido: ${nombreBase}`);
  process.exit(1);
}
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(esquema)) {
  console.error(`[preflight] Nombre de esquema inválido: ${esquema}`);
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: nombreBase,
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  options: `-c search_path=${esquema},public`,
  ssl: ['true', '1', 'si', 'yes'].includes(String(process.env.DB_SSL ?? '').toLowerCase())
    ? { rejectUnauthorized: false }
    : false,
});

async function principal() {
  const { rows: entorno } = await pool.query(
    "SELECT current_setting('server_version') AS version, current_setting('TimeZone') AS zona, now() AS ahora",
  );
  const info = entorno[0];
  console.log(
    `[preflight] PostgreSQL ${info.version} | zona del servidor: ${info.zona} | ahora (UTC): ${info.ahora.toISOString()}`,
  );

  const { rows: volumen } = await pool.query(`
    SELECT
      (SELECT count(*) FROM usuario)::int              AS usuarios,
      (SELECT count(*) FROM archivo)::int              AS documentos,
      (SELECT count(*) FROM archivo WHERE anulado)::int AS anulados,
      (SELECT count(*) FROM archivo WHERE ruta_archivo IS NULL)::int AS sin_archivo,
      (SELECT count(*) FROM historial_cambio)::int     AS cambios,
      (SELECT count(*) FROM registro_auditoria)::int   AS auditoria
  `);
  console.log('[preflight] Volumen:', volumen[0]);

  const { rows: duplicadosInteresado } = await pool.query(`
    SELECT lower(nombre) AS nombre, coalesce(documento, '') AS documento, count(*)::int AS veces
      FROM interesado
     GROUP BY 1, 2
    HAVING count(*) > 1
     ORDER BY veces DESC
     LIMIT 10
  `);

  const { rows: duplicadosRuta } = await pool.query(`
    SELECT lower(ruta_archivo) AS ruta, count(*)::int AS veces
      FROM archivo
     WHERE ruta_archivo IS NOT NULL
     GROUP BY 1
    HAVING count(*) > 1
     ORDER BY veces DESC
     LIMIT 10
  `);

  console.log(
    duplicadosInteresado.length === 0
      ? '[preflight] interesados: sin duplicados por (nombre, documento).'
      : `[preflight] interesados: ${duplicadosInteresado.length} grupo(s) duplicado(s); requiere limpieza antes de crear la restricción única.`,
  );
  for (const fila of duplicadosInteresado) {
    console.log(`  - "${fila.nombre}" / ${fila.documento || '(sin documento)'} x${fila.veces}`);
  }

  console.log(
    duplicadosRuta.length === 0
      ? '[preflight] rutas de archivo: sin duplicados por lower(ruta_archivo).'
      : `[preflight] rutas de archivo: ${duplicadosRuta.length} grupo(s) duplicado(s); requiere limpieza antes de crear la restricción única.`,
  );
  for (const fila of duplicadosRuta) {
    console.log(`  - ${fila.ruta} x${fila.veces}`);
  }

  const { rows: fechas } = await pool.query(
    `SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = $1 AND data_type LIKE 'timestamp%'
      ORDER BY table_name, column_name`,
    [esquema],
  );

  const sinZona = fechas.filter((columna) => columna.data_type === 'timestamp without time zone');
  console.log(
    `[preflight] Columnas de fecha: ${fechas.length} total, ${sinZona.length} sin zona horaria.`,
  );
  for (const columna of sinZona) {
    console.log(`  - ${columna.table_name}.${columna.column_name}`);
  }
  if (sinZona.length > 0) {
    console.log(
      '[preflight] Aviso: antes de migrar a TIMESTAMPTZ confirme la zona con la que se escribieron estos datos (cruce de SHOW timezone con los valores almacenados).',
    );
  }
}

principal()
  .catch((error) => {
    console.error('[preflight] Error:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
