import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../src/config/env.js';
import { consultar, reiniciarBaseDeDatos } from '../helpers/db.js';
import { api, iniciarSesion } from '../helpers/api.js';

const CUENTAS = {
  anaquispe: { contrasena: 'Admin123!', perfil: 'ADMINISTRADOR' },
  lmamani: { contrasena: 'Archivo123!', perfil: 'ARCHIVISTA' },
  cflores: { contrasena: 'Consulta123!', perfil: 'USUARIO_EXTERNO' },
};

async function auditoriaDe(tipoAccion) {
  const { rows } = await consultar(
    'SELECT * FROM registro_auditoria WHERE tipo_accion = $1 ORDER BY id',
    [tipoAccion],
  );
  return rows;
}

describe('AUT · Autenticación y sesión', () => {
  beforeEach(async () => {
    await reiniciarBaseDeDatos();
  });

  it.each(Object.entries(CUENTAS))('AUT-01–03 inicia sesión con %s', async (usuario, datos) => {
    const respuesta = await iniciarSesion(usuario, datos.contrasena);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.token).toBeTypeOf('string');
    expect(respuesta.body.usuario.perfil).toBe(datos.perfil);
    expect(respuesta.body.usuario).not.toHaveProperty('password_hash');

    const payload = jwt.verify(respuesta.body.token, config.jwt.secreto);
    expect(payload.sub).toBe(respuesta.body.usuario.id);
    expect(payload.perfil).toBe(datos.perfil);
    expect(payload.iss).toBe('siarc-ara');
    expect(payload.exp).toBeGreaterThan(payload.iat);

    const eventos = await auditoriaDe('INICIO_SESION_EXITOSO');
    expect(eventos.some((evento) => evento.id_usuario === respuesta.body.usuario.id)).toBe(true);
  });

  it('AUT-04 permite iniciar sesión con el correo electrónico', async () => {
    const respuesta = await iniciarSesion('ana.quispe@ara.gob.pe', CUENTAS.anaquispe.contrasena);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.nombreUsuario).toBe('anaquispe');
  });

  it('AUT-05 responde 401 genérico ante un usuario inexistente', async () => {
    const respuesta = await iniciarSesion('usuario-fantasma', 'cualquiera');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
    expect(respuesta.body.error.mensaje).not.toMatch(/usuario-fantasma/);

    const eventos = await auditoriaDe('INICIO_SESION_FALLIDO');
    expect(eventos.some((evento) => evento.id_usuario === null)).toBe(true);
  });

  it('AUT-06 incrementa el contador ante contraseña incorrecta', async () => {
    const respuesta = await iniciarSesion('lmamani', 'incorrecta');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');

    const { rows } = await consultar(
      'SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE nombre_usuario = $1',
      ['lmamani'],
    );
    expect(rows[0].intentos_fallidos).toBe(1);
    expect(rows[0].bloqueado_hasta).toBeNull();
  });

  it('AUT-07 bloquea la cuenta en el quinto intento fallido', async () => {
    for (let intento = 1; intento <= 4; intento += 1) {
      const respuesta = await iniciarSesion('lmamani', 'incorrecta');
      expect(respuesta.status).toBe(401);
    }

    const quinto = await iniciarSesion('lmamani', 'incorrecta');
    expect(quinto.status).toBe(403);
    expect(quinto.body.error.codigo).toBe('CUENTA_BLOQUEADA');
    expect(quinto.body.error.mensaje).toMatch(/bloqueada/i);

    const { rows } = await consultar(
      'SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE nombre_usuario = $1',
      ['lmamani'],
    );
    expect(rows[0].intentos_fallidos).toBe(5);
    expect(rows[0].bloqueado_hasta).not.toBeNull();

    const minutosRestantes = (new Date(rows[0].bloqueado_hasta) - Date.now()) / 60_000;
    expect(minutosRestantes).toBeGreaterThan(13);
    expect(minutosRestantes).toBeLessThanOrEqual(15);

    expect((await auditoriaDe('CUENTA_BLOQUEADA')).length).toBe(1);
    expect((await auditoriaDe('INICIO_SESION_FALLIDO')).length).toBe(4);
  });

  it('AUT-08 rechaza la contraseña correcta mientras la cuenta está bloqueada', async () => {
    await consultar(
      `UPDATE usuario
          SET intentos_fallidos = 5,
              bloqueado_hasta = now() + interval '10 minutes'
        WHERE nombre_usuario = 'lmamani'`,
    );

    const respuesta = await iniciarSesion('lmamani', CUENTAS.lmamani.contrasena);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('CUENTA_BLOQUEADA');
    expect(respuesta.body.error.mensaje).toMatch(/minuto/i);
    expect((await auditoriaDe('INICIO_SESION_BLOQUEADO')).length).toBe(1);
  });

  it('AUT-09/10 restablece el contador tras un inicio de sesión exitoso', async () => {
    for (let intento = 1; intento <= 4; intento += 1) {
      await iniciarSesion('cflores', 'incorrecta');
    }

    const respuesta = await iniciarSesion('cflores', CUENTAS.cflores.contrasena);
    expect(respuesta.status).toBe(200);

    const { rows } = await consultar(
      'SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE nombre_usuario = $1',
      ['cflores'],
    );
    expect(rows[0].intentos_fallidos).toBe(0);
    expect(rows[0].bloqueado_hasta).toBeNull();
  });

  it('AUT-09 permite el acceso cuando el bloqueo ya venció', async () => {
    await consultar(
      `UPDATE usuario
          SET intentos_fallidos = 5,
              bloqueado_hasta = now() - interval '1 minute'
        WHERE nombre_usuario = 'lmamani'`,
    );

    const respuesta = await iniciarSesion('lmamani', CUENTAS.lmamani.contrasena);
    expect(respuesta.status).toBe(200);
  });

  it('AUT-11 rechaza una cuenta inactiva', async () => {
    await consultar("UPDATE usuario SET estado = 'INACTIVO' WHERE nombre_usuario = 'cflores'");

    const respuesta = await iniciarSesion('cflores', CUENTAS.cflores.contrasena);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('CUENTA_INACTIVA');
    expect((await auditoriaDe('INICIO_SESION_RECHAZADO')).length).toBe(1);
  });

  it.each([
    ['AUT-12 usuario vacío', { usuario: '', contrasena: 'x' }],
    ['AUT-13 usuario de 2 caracteres', { usuario: 'ab', contrasena: 'x' }],
    ['AUT-14 contraseña vacía', { usuario: 'anaquispe', contrasena: '' }],
    ['AUT-14 usuario de más de 150 caracteres', { usuario: 'a'.repeat(151), contrasena: 'x' }],
    ['AUT-14 contraseña de más de 128 caracteres', { usuario: 'anaquispe', contrasena: 'x'.repeat(129) }],
  ])('%s devuelve 400 VALIDACION_INVALIDA', async (_nombre, cuerpo) => {
    const respuesta = await api().post('/api/auth/login').send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION_INVALIDA');
    expect(Array.isArray(respuesta.body.error.detalles)).toBe(true);
  });

  it('AUT-15 bloquea la IP tras 10 intentos en la ventana de 5 minutos', async () => {
    for (let intento = 1; intento <= 10; intento += 1) {
      const respuesta = await iniciarSesion('usuario-fantasma', 'x');
      expect(respuesta.status).toBe(401);
    }

    const respuesta = await iniciarSesion('usuario-fantasma', 'x');
    expect(respuesta.status).toBe(429);
    expect(respuesta.body.error.codigo).toBe('DEMASIADOS_INTENTOS');
  });

  it('AUT-16 cierra sesión con token y registra la auditoría', async () => {
    const ingreso = await iniciarSesion('anaquispe', CUENTAS.anaquispe.contrasena);

    const respuesta = await api()
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${ingreso.body.token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.mensaje).toMatch(/cerrada/i);
    expect((await auditoriaDe('CIERRE_SESION')).length).toBe(1);
  });

  it('AUT-17 rechaza el cierre de sesión sin token', async () => {
    const respuesta = await api().post('/api/auth/logout');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('TOKEN_INVALIDO');
  });

  it('AUT-18 devuelve la sesión actual con un token válido', async () => {
    const ingreso = await iniciarSesion('anaquispe', CUENTAS.anaquispe.contrasena);

    const respuesta = await api()
      .get('/api/auth/sesion')
      .set('Authorization', `Bearer ${ingreso.body.token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.nombreUsuario).toBe('anaquispe');
    expect(respuesta.body.usuario).not.toHaveProperty('password_hash');
  });

  it('AUT-20 rechaza un token expirado', async () => {
    const token = jwt.sign(
      { sub: 1, nombreUsuario: 'anaquispe', perfil: 'ADMINISTRADOR' },
      config.jwt.secreto,
      { expiresIn: -10, issuer: 'siarc-ara' },
    );

    const respuesta = await api().get('/api/auth/sesion').set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('TOKEN_INVALIDO');
  });

  it('AUT-21 rechaza un token con firma alterada', async () => {
    const ingreso = await iniciarSesion('anaquispe', CUENTAS.anaquispe.contrasena);
    const token = ingreso.body.token;
    const alterado = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

    const respuesta = await api().get('/api/auth/sesion').set('Authorization', `Bearer ${alterado}`);
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('TOKEN_INVALIDO');
  });

  it('AUT-25 almacena únicamente el hash bcrypt de la contraseña', async () => {
    const { rows } = await consultar('SELECT password_hash FROM usuario ORDER BY id');

    for (const fila of rows) {
      expect(fila.password_hash).toMatch(/^\$2[aby]\$/);
      expect(fila.password_hash).not.toMatch(/Admin123|Archivo123|Consulta123/);
    }
  });
});
