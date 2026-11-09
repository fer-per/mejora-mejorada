import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const rutaBackend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rutaProyecto = path.resolve(rutaBackend, '..');
const rutaMigraciones = path.join(rutaProyecto, 'database', 'migrations');

const conexion = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
};

const nombreBase = process.env.DB_NAME ?? 'siarc_db';
if (!/^[A-Za-z0-9_]+$/.test(nombreBase)) {
  console.error(`[migrar] Nombre de base de datos inválido: ${nombreBase}`);
  process.exit(1);
}

const esquema = process.env.DB_SCHEMA ?? 'public';
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(esquema)) {
  console.error(`[migrar] Nombre de esquema inválido: ${esquema}`);
  process.exit(1);
}

async function principal() {
  const cliente = new Client({
    ...conexion,
    database: nombreBase,
    options: `-c search_path=${esquema},public`,
  });
  await cliente.connect();

  try {
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS migracion (
        nombre     VARCHAR(200) PRIMARY KEY,
        aplicada_en TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await cliente.query('SELECT nombre FROM migracion');
    const aplicadas = new Set(rows.map((fila) => fila.nombre));

    let archivos = [];
    try {
      archivos = (await fs.readdir(rutaMigraciones)).filter((archivo) => archivo.endsWith('.sql')).sort();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    let pendientes = 0;
    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) continue;
      const sql = await fs.readFile(path.join(rutaMigraciones, archivo), 'utf8');
      await cliente.query('BEGIN');
      try {
        await cliente.query(sql);
        await cliente.query('INSERT INTO migracion (nombre) VALUES ($1)', [archivo]);
        await cliente.query('COMMIT');
        pendientes += 1;
        console.log(`[migrar] Aplicada ${archivo}`);
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw new Error(`Falló la migración ${archivo}: ${error.message}`);
      }
    }

    console.log(
      pendientes > 0
        ? `[migrar] ${pendientes} migración(es) aplicada(s).`
        : '[migrar] La base de datos ya está al día.',
    );
  } finally {
    await cliente.end();
  }
}

principal().catch((error) => {
  console.error('[migrar] Error:', error.message);
  process.exit(1);
});
