import request from 'supertest';
import { crearApp } from '../../src/app.js';

export const app = crearApp();

export function api() {
  return request(app);
}

export function iniciarSesion(usuario, contrasena) {
  return api().post('/api/auth/login').send({ usuario, contrasena });
}

export async function obtenerToken(usuario = 'anaquispe', contrasena = 'Admin123!') {
  const respuesta = await iniciarSesion(usuario, contrasena);
  if (respuesta.status !== 200) {
    throw new Error(`No se pudo iniciar sesión como "${usuario}" (HTTP ${respuesta.status}).`);
  }
  return respuesta.body.token;
}

export function conToken(peticion, token) {
  return peticion.set('Authorization', `Bearer ${token}`);
}
