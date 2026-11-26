import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

const nombreBase = process.env.DB_NAME ?? 'siarc_db';
const esquema = process.env.DB_SCHEMA ?? 'public';

if (!/^[A-Za-z0-9_]+$/.test(nombreBase)) {
  console.error(`[admin] Nombre de base de datos inválido: ${nombreBase}`);
  process.exit(1);
}
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(esquema)) {
  console.error(`[admin] Nombre de esquema inválido: ${esquema}`);
  process.exit(1);
}

const usuario = (process.env.ADMIN_USUARIO ?? 'admin').trim().toLowerCase();
const correo = (process.env.ADMIN_CORREO ?? `${usuario}@siarc.local`).trim().toLowerCase();
const nombres = (process.env.ADMIN_NOMBRES ?? 'Administrador').trim();
const apellidos = (process.env.ADMIN_APELLIDOS ?? 'SIARC').trim();

if (!/^[a-z0-9._-]{3,50}$/.test(usuario)) {
  console.error('[admin] ADMIN_USUARIO inválido: use de 3 a 50 caracteres [a-z0-9._-].');
  process.exit(1);
}
if (!/^[^@\s]+@[^@\s]+$/.test(correo)) {
  console.error('[admin] ADMIN_CORREO inválido.');
  process.exit(1);
}

let contrasena = process.env.ADMIN_PASSWORD ?? '';
let generada = false;
if (!contrasena) {
  contrasena = crypto.randomBytes(18).toString('base64url');
  generada = true;
}
if (contrasena.length < 12) {
  console.error('[admin] ADMIN_PASSWORD debe tener al menos 12 caracteres.');
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
  const { rows: existentes } = await pool.query(
    'SELECT id FROM usuario WHERE nombre_usuario = $1 OR correo = $2',
    [usuario, correo],
  );
  if (existentes[0]) {
    console.error(`[admin] Ya existe un usuario con ese nombre o correo (id ${existentes[0].id}).`);
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(contrasena, 12);
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(
      `INSERT INTO usuario (nombres, apellidos, correo, nombre_usuario, password_hash, perfil, estado)
       VALUES ($1, $2, $3, $4, $5, 'ADMINISTRADOR', 'ACTIVO')
       RETURNING id`,
      [nombres, apellidos, correo, usuario, hash],
    );
    await cliente.query(
      `INSERT INTO registro_auditoria (id_usuario, tipo_accion, descripcion)
       VALUES ($1, 'CREACION_USUARIO', $2)`,
      [rows[0].id, `Cuenta administradora inicial "${usuario}" creada con admin:crear.`],
    );
    await cliente.query('COMMIT');
    console.log(`[admin] Administrador "${usuario}" creado (id ${rows[0].id}).`);
    if (generada) {
      console.log(`[admin] Contrasena temporal: ${contrasena}`);
    }
    console.log('[admin] Cambie la contrasena tras el primer inicio de sesion.');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

principal()
  .catch((error) => {
    console.error('[admin] Error:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
