import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA_BACKEND = path.resolve(AQUI, '../../backend');
const requireDesdeBackend = createRequire(path.join(RUTA_BACKEND, 'package.json'));
const dotenv = requireDesdeBackend('dotenv');
const pg = requireDesdeBackend('pg');

const { Client } = pg;

dotenv.config({ path: path.join(RUTA_BACKEND, '.env') });

const nombreBase = process.env.DB_NAME ?? 'siarc_db';

const conexion = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: nombreBase,
  ssl: false,
};

const resultados = [];

function registrar(id, descripcion, estado, detalle = '') {
  resultados.push({ id, descripcion, estado, detalle });
}

async function verificar(id, descripcion, funcion) {
  try {
    const detalle = await funcion();
    registrar(id, descripcion, 'PASS', detalle ?? '');
  } catch (error) {
    registrar(id, descripcion, 'FAIL', error.message);
  }
}

async function esperarError(cliente, codigo, funcion) {
  await cliente.query('SAVEPOINT verificacion');
  try {
    await funcion();
    await cliente.query('ROLLBACK TO SAVEPOINT verificacion');
    throw new Error(`se esperaba el código ${codigo} y la operación fue aceptada`);
  } catch (error) {
    await cliente.query('ROLLBACK TO SAVEPOINT verificacion');
    if (error.code !== codigo) {
      throw new Error(`se esperaba el código ${codigo} y se obtuvo ${error.code ?? error.message}`);
    }
    return `código ${codigo} verificado`;
  }
}

const cliente = new Client(conexion);

try {
  await cliente.connect();
  console.log(`[BD] Verificando la base de datos "${nombreBase}" en ${conexion.host}:${conexion.port}\n`);

  await verificar('BD-01', 'Esquema: tablas y extensiones creadas', async () => {
    const { rows: tablas } = await cliente.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const nombres = new Set(tablas.map((fila) => fila.tablename));
    const esperadas = [
      'usuario', 'registro_auditoria', 'repositorio', 'fondo', 'entidad_escribano',
      'protocolo', 'anio_protocolo', 'registro', 'titulo_escritura', 'interesado',
      'rol_interesado', 'responsable_descripcion', 'archivo',
    ];
    const faltantes = esperadas.filter((tabla) => !nombres.has(tabla));
    if (faltantes.length > 0) throw new Error(`faltan tablas: ${faltantes.join(', ')}`);

    const { rows: extensiones } = await cliente.query(
      "SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent', 'pgcrypto')",
    );
    if (extensiones.length !== 3) {
      throw new Error('faltan extensiones pg_trgm, unaccent o pgcrypto');
    }
    return `${nombres.size} tablas y 3 extensiones`;
  });

  await verificar('BD-02', 'Datos semilla cargados', async () => {
    const { rows } = await cliente.query(
      `SELECT (SELECT count(*) FROM archivo)::int AS archivos,
              (SELECT count(*) FROM usuario)::int AS usuarios,
              (SELECT count(*) FROM titulo_escritura)::int AS titulos`,
    );
    const { archivos, usuarios, titulos } = rows[0];
    if (archivos !== 11 || usuarios !== 3 || titulos !== 10) {
      throw new Error(`conteos inesperados: archivos=${archivos}, usuarios=${usuarios}, titulos=${titulos}`);
    }
    return '11 archivos, 3 usuarios, 10 títulos';
  });

  await verificar('BD-03', 'Restricción CHECK de formato (TIFF/PDF-A)', async () => {
    await cliente.query('BEGIN');
    try {
      return await esperarError(cliente, '23514', () =>
        cliente.query(
          `INSERT INTO archivo (id_titulo_escritura, tipologia_documental, formato, ruta_archivo)
           VALUES (1, 'Prueba', 'JPG', 'prueba/formato-invalido.jpg')`,
        ),
      );
    } finally {
      await cliente.query('ROLLBACK');
    }
  });

  await verificar('BD-04', 'Restricción CHECK de estado de conservación', async () => {
    await cliente.query('BEGIN');
    try {
      return await esperarError(cliente, '23514', () =>
        cliente.query(
          `INSERT INTO archivo (id_titulo_escritura, tipologia_documental, formato, estado_conservacion, ruta_archivo)
           VALUES (1, 'Prueba', 'PDF/A', 'Excelente', 'prueba/conservacion-invalida.pdf')`,
        ),
      );
    } finally {
      await cliente.query('ROLLBACK');
    }
  });

  await verificar('BD-06', 'Unicidad de usuario y correo', async () => {
    await cliente.query('BEGIN');
    try {
      return await esperarError(cliente, '23505', () =>
        cliente.query(
          `INSERT INTO usuario (nombres, apellidos, correo, nombre_usuario, password_hash, perfil)
           VALUES ('Duplicado', 'Prueba', 'ana.quispe@ara.gob.pe', 'anaquispe', 'x', 'ADMINISTRADOR')`,
        ),
      );
    } finally {
      await cliente.query('ROLLBACK');
    }
  });

  await verificar('BD-07', 'Integridad referencial fondo → protocolo', async () => {
    await cliente.query('BEGIN');
    try {
      return await esperarError(cliente, '23503', () => cliente.query('DELETE FROM fondo WHERE id = 1'));
    } finally {
      await cliente.query('ROLLBACK');
    }
  });

  await verificar('BD-08', 'Índices GIN de texto completo y trigramas', async () => {
    const { rows } = await cliente.query(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN ('idx_archivo_busqueda_texto', 'idx_archivo_descriptores_trgm', 'idx_titulo_nombre_trgm')
        ORDER BY indexname`,
    );
    if (rows.length !== 3) throw new Error('faltan índices de búsqueda');
    for (const fila of rows) {
      if (!/USING gin/i.test(fila.indexdef)) throw new Error(`${fila.indexname} no es GIN`);
    }
    return rows.map((fila) => fila.indexname).join(', ');
  });

  await verificar('BD-09', 'f_unaccent es IMMUTABLE (indexable)', async () => {
    const { rows } = await cliente.query(
      "SELECT provolatile FROM pg_proc WHERE proname = 'f_unaccent' LIMIT 1",
    );
    if (rows.length === 0) throw new Error('no existe la función f_unaccent');
    if (rows[0].provolatile !== 'i') throw new Error('f_unaccent no está marcada como IMMUTABLE');
    return 'provolatile = i';
  });

  await verificar('BD-10', 'Plan de la búsqueda de texto completo', async () => {
    const { rows } = await cliente.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT a.id
         FROM archivo a
         JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
        WHERE to_tsvector('spanish', f_unaccent(coalesce(a.alcance_contenido, '')))
              @@ plainto_tsquery('spanish', f_unaccent('aguas'))`,
    );
    return rows
      .map((fila) => fila['QUERY PLAN'])
      .filter((linea) => /Scan|Execution Time/i.test(linea))
      .join(' | ');
  });
} catch (error) {
  console.error('[BD] Error fatal:', error.message);
  process.exitCode = 1;
} finally {
  await cliente.end().catch(() => {});
}

const anchoId = 8;
console.log('ID'.padEnd(anchoId), 'ESTADO', 'DESCRIPCIÓN');
for (const resultado of resultados) {
  console.log(
    resultado.id.padEnd(anchoId),
    resultado.estado.padEnd(6),
    resultado.descripcion,
    resultado.detalle ? `\n         → ${resultado.detalle}` : '',
  );
}

const fallidos = resultados.filter((resultado) => resultado.estado === 'FAIL').length;
console.log(`\n[BD] ${resultados.length - fallidos} correctas, ${fallidos} fallidas.`);
if (fallidos > 0) process.exitCode = 1;
