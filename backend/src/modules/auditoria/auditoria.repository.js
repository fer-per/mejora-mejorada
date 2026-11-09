import { consultar } from '../../config/database.js';

export async function registrarAccion({ idUsuario = null, tipoAccion, descripcion }) {
  try {
    await consultar(
      `INSERT INTO registro_auditoria (id_usuario, tipo_accion, descripcion)
       VALUES ($1, $2, $3)`,
      [idUsuario, tipoAccion, descripcion],
    );
  } catch (error) {
    console.error('[siarc-ara] No se pudo registrar la auditoría:', error.message);
  }
}

const COLUMNAS = `
    ra.id,
    ra.tipo_accion,
    ra.fecha_hora,
    ra.descripcion,
    ra.id_usuario,
    u.nombre_usuario,
    u.nombres,
    u.apellidos
`;

const RELACIONES = `
    FROM registro_auditoria ra
    LEFT JOIN usuario u ON u.id = ra.id_usuario
`;

export async function listarAcciones({ tipoAccion, idUsuario, desde, hasta, pagina, porPagina }) {
  const parametros = [];
  const condiciones = [];
  const agregar = (condicion, valor) => {
    parametros.push(valor);
    condiciones.push(condicion.replace('?', `$${parametros.length}`));
  };

  if (tipoAccion) agregar('ra.tipo_accion = ?', tipoAccion);
  if (idUsuario) agregar('ra.id_usuario = ?', idUsuario);
  if (desde) agregar('ra.fecha_hora >= ?::date', desde);
  if (hasta) agregar('ra.fecha_hora < (?::date + INTERVAL \'1 day\')', hasta);

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows: conteo } = await consultar(
    `SELECT COUNT(*)::int AS total ${RELACIONES} ${where}`,
    parametros,
  );

  const desplazamiento = (pagina - 1) * porPagina;
  const parametrosListado = [...parametros, porPagina, desplazamiento];
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} ${RELACIONES} ${where}
      ORDER BY ra.fecha_hora DESC, ra.id DESC
      LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    parametrosListado,
  );

  return { total: conteo[0].total, filas: rows };
}

export async function listarUsuariosAuditados() {
  const { rows } = await consultar(
    `SELECT DISTINCT u.id, u.nombre_usuario
       FROM registro_auditoria ra
       JOIN usuario u ON u.id = ra.id_usuario
      ORDER BY u.nombre_usuario`,
  );

  return rows.map((fila) => ({ id: fila.id, nombreUsuario: fila.nombre_usuario }));
}

export async function obtenerAccion(id) {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} ${RELACIONES} WHERE ra.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
