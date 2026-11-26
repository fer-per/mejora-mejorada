import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { errores } from '../common/errors.js';
import { extraerToken } from '../modules/auth/sesion-cookie.js';
import { buscarSesionActiva } from '../modules/auth/sesiones.repository.js';

export async function autenticar(req, res, next) {
  try {
    const token = extraerToken(req);
    if (!token) {
      throw errores.tokenInvalido();
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secreto);
    } catch {
      throw errores.tokenInvalido();
    }

    if (!payload.jti) {
      throw errores.tokenInvalido();
    }

    const sesion = await buscarSesionActiva(payload.jti);
    const ahora = new Date();
    if (
      !sesion ||
      sesion.revocada_en ||
      new Date(sesion.expira_en) <= ahora ||
      sesion.estado !== 'ACTIVO'
    ) {
      throw errores.tokenInvalido();
    }

    req.sesionId = sesion.id;
    req.usuario = {
      id: sesion.id_usuario,
      nombres: sesion.nombres,
      apellidos: sesion.apellidos,
      correo: sesion.correo,
      nombreUsuario: sesion.nombre_usuario,
      perfil: sesion.perfil,
      nombreCompleto: `${sesion.nombres} ${sesion.apellidos}`.trim(),
    };
    next();
  } catch (error) {
    next(error);
  }
}
