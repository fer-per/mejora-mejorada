import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import pg from 'pg';
import { generarArchivos } from './generar-archivos.mjs';

const { Client, Pool } = pg;

const argumentos = process.argv.slice(2);
const soloEsquema = argumentos.includes('--solo-esquema');
const soloSeed = argumentos.includes('--solo-seed');
const esProduccion = process.env.NODE_ENV === 'production';
const confirmacion = argumentos
  .find((argumento) => argumento.startsWith('--confirmar='))
  ?.slice('--confirmar='.length);

const rutaBackend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rutaProyecto = path.resolve(rutaBackend, '..');
// Igual que el API (src/config/env.js): RUTA_REPOSITORIO es relativa a `backend/`.
const rutaRepositorio = path.resolve(
  rutaBackend,
  process.env.RUTA_REPOSITORIO ?? '../storage/repositorio',
);

const conexion = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
};

const nombreBase = process.env.DB_NAME ?? 'siarc_db';
if (!/^[A-Za-z0-9_]+$/.test(nombreBase)) {
  console.error(`[init-db] Nombre de base de datos inválido: ${nombreBase}`);
  process.exit(1);
}

const esquema = process.env.DB_SCHEMA ?? 'public';
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(esquema)) {
  console.error(`[init-db] Nombre de esquema inválido: ${esquema}`);
  process.exit(1);
}

function leerSql(nombreArchivo) {
  return fs.readFile(path.join(rutaProyecto, 'database', nombreArchivo), 'utf8');
}

async function asegurarBaseDeDatos() {
  const cliente = new Client({ ...conexion, database: 'postgres' });
  await cliente.connect();
  try {
    const { rows } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombreBase]);
    if (rows.length === 0) {
      await cliente.query(`CREATE DATABASE ${nombreBase} ENCODING 'UTF8'`);
      console.log(`[init-db] Base de datos "${nombreBase}" creada.`);
    } else {
      console.log(`[init-db] Base de datos "${nombreBase}" existente.`);
    }
  } finally {
    await cliente.end();
  }
}

async function principal() {
  const enEspacio = Date.now();
  if (esProduccion) {
    throw new Error(
      'init-db no se ejecuta con NODE_ENV=production. Use "npm run db:migrar" y "npm run admin:crear".',
    );
  }
  await asegurarBaseDeDatos();

  const pool = new Pool({
    ...conexion,
    database: nombreBase,
    options: `-c search_path=${esquema},public`,
  });
  try {
    if (!soloSeed) {
      const { rows: existente } = await pool.query(
        'SELECT to_regclass($1) IS NOT NULL AS existe',
        [`${esquema}.archivo`],
      );
      if (existente[0]?.existe) {
        const { rows: conteo } = await pool.query('SELECT COUNT(*)::int AS total FROM archivo');
        if (conteo[0].total > 0 && confirmacion !== nombreBase) {
          throw new Error(
            `La base "${nombreBase}" ya contiene ${conteo[0].total} documento(s). Repita con --confirmar=${nombreBase} para recrear el esquema.`,
          );
        }
      }

      console.log(`[init-db] Recreando esquema "${esquema}"...`);
      await pool.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`);
      await pool.query(`CREATE SCHEMA ${esquema}`);
      await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public');
      await pool.query('CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public');
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public');
      console.log(`[init-db] Aplicando esquema (database/schema.sql) en "${esquema}"...`);
      await pool.query(await leerSql('schema.sql'));
      console.log('[init-db] Esquema aplicado.');
    }

    if (!soloEsquema) {
      console.log('[init-db] Cargando cuentas demo y datos semilla...');
      if (soloSeed) {
        await pool.query(
          `TRUNCATE historial_cambio, rol_interesado, archivo, titulo_escritura,
                    registro, anio_protocolo, protocolo, entidad_escribano, fondo,
                    repositorio, responsable_descripcion, interesado,
                    sesion, registro_auditoria, usuario
           RESTART IDENTITY CASCADE`,
        );
      }
      await pool.query(await leerSql('seed-demo.sql'));
      await pool.query(await leerSql('seed.sql'));
      console.log('[init-db] Datos semilla cargados.');
      const resultado = await generarArchivos(pool, rutaRepositorio);
      console.log(
        `[init-db] Repositorio generado en ${rutaRepositorio} (${resultado.pdfGenerados} PDF/A, ${resultado.tiffGenerados} TIFF, ${resultado.documentos} miniaturas).`,
      );
    }

    console.log(`[init-db] Proceso finalizado en ${((Date.now() - enEspacio) / 1000).toFixed(1)} s.`);
  } finally {
    await pool.end();
  }
}

principal().catch((error) => {
  console.error('[init-db] Error:', error.message);
  process.exit(1);
});
