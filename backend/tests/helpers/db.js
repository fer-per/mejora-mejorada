import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_PROYECTO = path.resolve(AQUI, '../../..');

const nombreBase = process.env.DB_NAME ?? 'siarc_db_test';

if (!nombreBase.endsWith('_test')) {
  throw new Error(
    `[pruebas] DB_NAME debe terminar en "_test" para evitar borrar datos reales (valor actual: "${nombreBase}").`,
  );
}

const conexion = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  ssl: false,
};

async function leerSql(nombreArchivo) {
  return fs.readFile(path.join(RAIZ_PROYECTO, 'database', nombreArchivo), 'utf8');
}

async function crearBaseDePruebas() {
  const cliente = new Client({ ...conexion, database: 'postgres' });
  await cliente.connect();
  try {
    const { rows } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombreBase]);
    if (rows.length === 0) {
      await cliente.query(`CREATE DATABASE ${nombreBase} ENCODING 'UTF8'`);
    }
  } finally {
    await cliente.end();
  }
}

const AJUSTAR_SECUENCIAS = `
DO $do$
DECLARE
  tabla text;
  secuencia text;
  maximo bigint;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'usuario', 'registro_auditoria', 'repositorio', 'fondo', 'entidad_escribano',
    'protocolo', 'anio_protocolo', 'registro', 'titulo_escritura', 'interesado',
    'responsable_descripcion', 'archivo'
  ] LOOP
    secuencia := pg_get_serial_sequence(tabla, 'id');
    IF secuencia IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(MAX(id), 1) FROM %I', tabla) INTO maximo;
      PERFORM setval(secuencia, maximo);
    END IF;
  END LOOP;
END
$do$;
`;

export async function crearBaseDePruebasSiNoExiste() {
  await crearBaseDePruebas();
}

export async function reiniciarBaseDeDatos() {
  await crearBaseDePruebas();

  const cliente = new Client({ ...conexion, database: nombreBase });
  await cliente.connect();
  try {
    await cliente.query('DROP SCHEMA IF EXISTS public CASCADE');
    await cliente.query('CREATE SCHEMA public');
    await cliente.query(await leerSql('schema.sql'));
    await cliente.query(await leerSql('seed.sql'));
    await cliente.query(AJUSTAR_SECUENCIAS);
  } finally {
    await cliente.end();
  }
}

export async function consultar(texto, parametros = []) {
  const cliente = new Client({ ...conexion, database: nombreBase });
  await cliente.connect();
  try {
    return await cliente.query(texto, parametros);
  } finally {
    await cliente.end();
  }
}
