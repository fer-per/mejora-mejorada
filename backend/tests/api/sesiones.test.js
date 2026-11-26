import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { consultar, reiniciarBaseDeDatos } from '../helpers/db.js';
import { api, app, iniciarSesion } from '../helpers/api.js';

function cookieDeSesion(respuesta) {
  const cookies = respuesta.headers['set-cookie'] ?? [];
  return cookies.find((cookie) => cookie.startsWith('siarc_sesion='));
}

function idSesionDe(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).jti;
}

describe('SES · Sesiones revocables', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
  });

  it('SES-01 entrega la sesión en una cookie HttpOnly', async () => {
    const respuesta = await iniciarSesion('anaquispe', 'Admin123!');

    expect(respuesta.status).toBe(200);
    const cookie = cookieDeSesion(respuesta);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(respuesta.body.token).toBeTypeOf('string');
  });

  it('SES-02 autentica usando solo la cookie', async () => {
    const agente = request.agent(app);
    const ingreso = await agente
      .post('/api/auth/login')
      .send({ usuario: 'lmamani', contrasena: 'Archivo123!' });
    expect(ingreso.status).toBe(200);

    const sesion = await agente.get('/api/auth/sesion');
    expect(sesion.status).toBe(200);
    expect(sesion.body.usuario.nombreUsuario).toBe('lmamani');
  });

  it('SES-03 revoca la sesión al cerrar sesión', async () => {
    const ingreso = await iniciarSesion('anaquispe', 'Admin123!');
    const token = ingreso.body.token;

    const cierre = await api().post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(cierre.status).toBe(200);

    const reuso = await api().get('/api/auth/sesion').set('Authorization', `Bearer ${token}`);
    expect(reuso.status).toBe(401);
    expect(reuso.body.error.codigo).toBe('TOKEN_INVALIDO');
  });

  it('SES-04 rechaza una sesión revocada directamente en la base', async () => {
    const ingreso = await iniciarSesion('lmamani', 'Archivo123!');
    const token = ingreso.body.token;

    await consultar('UPDATE sesion SET revocada_en = now() WHERE id = $1', [idSesionDe(token)]);

    const respuesta = await api().get('/api/auth/sesion').set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(401);
  });
});
