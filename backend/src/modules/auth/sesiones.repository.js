import { consultar } from '../../config/database.js';

export async function crearSesion({ id, idUsuario, expiraEn, ip, userAgent }) {
  await consultar(
    `INSERT INTO sesion (id, id_usuario, expira_en, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, idUsuario, expiraEn, ip ?? null, userAgent ?? null],
  );
}

export async function buscarSesionActiva(id) {
  const { rows } = await consultar(
    `SELECT s.id, s.id_usuario, s.expira_en, s.revocada_en,
            u.nombres, u.apellidos, u.correo, u.nombre_usuario, u.perfil, u.estado
       FROM sesion s
       JOIN usuario u ON u.id = s.id_usuario
      WHERE s.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function revocarSesion(id) {
  const { rowCount } = await consultar(
    'UPDATE sesion SET revocada_en = now() WHERE id = $1 AND revocada_en IS NULL',
    [id],
  );
  return rowCount > 0;
}

export async function revocarSesionesDeUsuario(idUsuario) {
  const { rowCount } = await consultar(
    'UPDATE sesion SET revocada_en = now() WHERE id_usuario = $1 AND revocada_en IS NULL',
    [idUsuario],
  );
  return rowCount;
}
