import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { consultar } from '../../config/database.js';
import { config } from '../../config/env.js';
import { errores } from '../../common/errors.js';
import { registrarAccion } from '../auditoria/auditoria.repository.js';
import { crearSesion, revocarSesion } from './sesiones.repository.js';

const HASH_FANTASMA = bcrypt.hashSync('fantasma-siarc-ara', 10);

function construirUsuario(cuenta) {
  return {
    id: cuenta.id,
    nombres: cuenta.nombres,
    apellidos: cuenta.apellidos,
    correo: cuenta.correo,
    nombreUsuario: cuenta.nombre_usuario,
    perfil: cuenta.perfil,
    nombreCompleto: `${cuenta.nombres} ${cuenta.apellidos}`.trim(),
  };
}

export async function iniciarSesion({ usuario, contrasena, ip, userAgent }) {
  const { rows } = await consultar(
    `SELECT id, nombres, apellidos, correo, nombre_usuario, password_hash, perfil,
            estado, intentos_fallidos, bloqueado_hasta
       FROM usuario
      WHERE nombre_usuario = $1 OR correo = $1
      LIMIT 1`,
    [usuario],
  );
  const cuenta = rows[0];

  if (!cuenta) {
    await bcrypt.compare(contrasena, HASH_FANTASMA);
    await registrarAccion({
      tipoAccion: 'INICIO_SESION_FALLIDO',
      descripcion: `Inicio de sesión fallido: usuario inexistente "${usuario}" desde ${ip}.`,
    });
    throw errores.credencialesInvalidas();
  }

  const ahora = new Date();
  if (cuenta.bloqueado_hasta && new Date(cuenta.bloqueado_hasta) > ahora) {
    const minutos = Math.max(1, Math.ceil((new Date(cuenta.bloqueado_hasta) - ahora) / 60000));
    await registrarAccion({
      idUsuario: cuenta.id,
      tipoAccion: 'INICIO_SESION_BLOQUEADO',
      descripcion: `Intento sobre cuenta bloqueada de "${cuenta.nombre_usuario}" desde ${ip}.`,
    });
    throw errores.cuentaBloqueada(minutos);
  }

  if (cuenta.estado !== 'ACTIVO') {
    await registrarAccion({
      idUsuario: cuenta.id,
      tipoAccion: 'INICIO_SESION_RECHAZADO',
      descripcion: `Cuenta inactiva "${cuenta.nombre_usuario}" intentó iniciar sesión desde ${ip}.`,
    });
    throw errores.cuentaInactiva();
  }

  const contrasenaCorrecta = await bcrypt.compare(contrasena, cuenta.password_hash);

  if (!contrasenaCorrecta) {
    const intentos = cuenta.intentos_fallidos + 1;
    const superado = intentos >= config.bloqueo.intentosMaximos;
    const bloqueoHasta = superado ? new Date(Date.now() + config.bloqueo.minutosBloqueo * 60_000) : null;

    await consultar(
      `UPDATE usuario
          SET intentos_fallidos = $1,
              bloqueado_hasta = CASE WHEN $2 THEN $3 ELSE bloqueado_hasta END
        WHERE id = $4`,
      [intentos, superado, bloqueoHasta, cuenta.id],
    );

    await registrarAccion({
      idUsuario: cuenta.id,
      tipoAccion: superado ? 'CUENTA_BLOQUEADA' : 'INICIO_SESION_FALLIDO',
      descripcion: superado
        ? `Cuenta "${cuenta.nombre_usuario}" bloqueada por ${config.bloqueo.intentosMaximos} intentos fallidos.`
        : `Contraseña incorrecta para "${cuenta.nombre_usuario}" (intento ${intentos} de ${config.bloqueo.intentosMaximos}).`,
    });

    if (superado) {
      throw errores.cuentaBloqueada(config.bloqueo.minutosBloqueo);
    }
    throw errores.credencialesInvalidas();
  }

  await consultar(
    `UPDATE usuario
        SET intentos_fallidos = 0,
            bloqueado_hasta = NULL
      WHERE id = $1`,
    [cuenta.id],
  );

  const usuarioDto = construirUsuario(cuenta);
  const idSesion = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: cuenta.id,
      nombreUsuario: cuenta.nombre_usuario,
      perfil: cuenta.perfil,
      nombreCompleto: usuarioDto.nombreCompleto,
    },
    config.jwt.secreto,
    { expiresIn: config.jwt.expiraEn, issuer: 'siarc-ara', jwtid: idSesion },
  );
  const expiracion = new Date(jwt.decode(token).exp * 1000);

  await crearSesion({
    id: idSesion,
    idUsuario: cuenta.id,
    expiraEn: expiracion,
    ip,
    userAgent,
  });

  await registrarAccion({
    idUsuario: cuenta.id,
    tipoAccion: 'INICIO_SESION_EXITOSO',
    descripcion: `"${cuenta.nombre_usuario}" (${cuenta.perfil}) inició sesión desde ${ip}.`,
  });

  return { token, expiracion, usuario: usuarioDto };
}

export async function cerrarSesion({ usuario, sesionId, ip }) {
  if (sesionId) {
    await revocarSesion(sesionId);
  }
  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'CIERRE_SESION',
    descripcion: `"${usuario.nombreUsuario}" cerró sesión desde ${ip}.`,
  });
  return { mensaje: 'Sesión cerrada correctamente.' };
}
