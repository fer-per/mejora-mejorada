import { consultar } from '../../config/database.js';

const COLUMNAS = `
    id, nombres, apellidos, correo, nombre_usuario, perfil, estado,
    intentos_fallidos, bloqueado_hasta, fecha_creacion
`;

export async function listarUsuarios({ q, perfil, estado, pagina, porPagina }) {
  const parametros = [];
  const condiciones = [];

  if (q) {
    parametros.push(`%${q}%`);
    const p = `$${parametros.length}`;
    condiciones.push(`(
      nombres ILIKE ${p}
      OR apellidos ILIKE ${p}
      OR correo ILIKE ${p}
      OR nombre_usuario ILIKE ${p}
    )`);
  }
  if (perfil) {
    parametros.push(perfil);
    condiciones.push(`perfil = $${parametros.length}`);
  }
  if (estado) {
    parametros.push(estado);
    condiciones.push(`estado = $${parametros.length}`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows: conteo } = await consultar(
    `SELECT COUNT(*)::int AS total FROM usuario ${where}`,
    parametros,
  );

  const desplazamiento = (pagina - 1) * porPagina;
  const parametrosListado = [...parametros, porPagina, desplazamiento];
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM usuario ${where}
      ORDER BY apellidos, nombres, id
      LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    parametrosListado,
  );

  return { total: conteo[0].total, filas: rows };
}

export async function obtenerUsuario(id) {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM usuario WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function crearUsuario({ nombres, apellidos, correo, nombreUsuario, hash, perfil, estado }) {
  const { rows } = await consultar(
    `INSERT INTO usuario (nombres, apellidos, correo, nombre_usuario, password_hash, perfil, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [nombres, apellidos, correo, nombreUsuario, hash, perfil, estado],
  );
  return rows[0].id;
}

const CAMPOS = {
  nombres: 'nombres',
  apellidos: 'apellidos',
  correo: 'correo',
  nombreUsuario: 'nombre_usuario',
  perfil: 'perfil',
  estado: 'estado',
};

export async function actualizarUsuario(id, cambios, hash) {
  const asignaciones = [];
  const parametros = [];

  for (const [campo, columna] of Object.entries(CAMPOS)) {
    if (cambios[campo] !== undefined) {
      parametros.push(cambios[campo]);
      asignaciones.push(`${columna} = $${parametros.length}`);
    }
  }

  if (hash) {
    parametros.push(hash);
    asignaciones.push(`password_hash = $${parametros.length}`);
    asignaciones.push('intentos_fallidos = 0');
    asignaciones.push('bloqueado_hasta = NULL');
  }

  if (cambios.estado === 'ACTIVO') {
    asignaciones.push('intentos_fallidos = 0');
    asignaciones.push('bloqueado_hasta = NULL');
  }

  parametros.push(id);
  const { rowCount } = await consultar(
    `UPDATE usuario SET ${asignaciones.join(', ')} WHERE id = $${parametros.length}`,
    parametros,
  );
  return rowCount > 0;
}

export async function cambiarEstado(id, estado) {
  const { rowCount } = await consultar(
    `UPDATE usuario
        SET estado = $1::varchar,
            intentos_fallidos = CASE WHEN $1::varchar = 'ACTIVO' THEN 0 ELSE intentos_fallidos END,
            bloqueado_hasta = CASE WHEN $1::varchar = 'ACTIVO' THEN NULL ELSE bloqueado_hasta END
      WHERE id = $2`,
    [estado, id],
  );
  return rowCount > 0;
}

export async function contarAdministradoresActivos() {
  const { rows } = await consultar(
    "SELECT COUNT(*)::int AS total FROM usuario WHERE perfil = 'ADMINISTRADOR' AND estado = 'ACTIVO'",
  );
  return rows[0].total;
}
