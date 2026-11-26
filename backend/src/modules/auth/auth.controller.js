import { manejar } from '../../common/async-handler.js';
import { config } from '../../config/env.js';
import { NOMBRE_COOKIE_SESION, opcionesCookie } from './sesion-cookie.js';
import * as servicio from './auth.service.js';

export const iniciarSesion = manejar(async (req, res) => {
  const resultado = await servicio.iniciarSesion({
    ...req.datos,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.cookie(NOMBRE_COOKIE_SESION, resultado.token, {
    ...opcionesCookie(config.esProduccion),
    maxAge: Math.max(0, resultado.expiracion.getTime() - Date.now()),
  });

  if (config.esProduccion) {
    res.json({ expiracion: resultado.expiracion, usuario: resultado.usuario });
    return;
  }
  res.json(resultado);
});

export const cerrarSesion = manejar(async (req, res) => {
  const resultado = await servicio.cerrarSesion({
    usuario: req.usuario,
    sesionId: req.sesionId,
    ip: req.ip,
  });
  res.clearCookie(NOMBRE_COOKIE_SESION, opcionesCookie(config.esProduccion));
  res.json(resultado);
});

export const obtenerSesion = manejar(async (req, res) => {
  res.json({ usuario: req.usuario });
});
