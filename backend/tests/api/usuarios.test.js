import { beforeAll, describe, expect, it } from 'vitest';
import { consultar, reiniciarBaseDeDatos } from '../helpers/db.js';
import { api, conToken, iniciarSesion, obtenerToken } from '../helpers/api.js';

let tokenAdmin;
let tokenArchivista;
let tokenExterno;

const USUARIO_NUEVO = {
  nombres: 'Rosa',
  apellidos: 'Vargas Lima',
  correo: 'rosa.vargas@ara.gob.pe',
  nombre_usuario: 'rvargas',
  contrasena: 'Segura123!',
  perfil: 'ARCHIVISTA',
};

function listar(query = {}, token = tokenAdmin) {
  return conToken(api().get('/api/usuarios').query(query), token);
}

function crear(datos, token = tokenAdmin) {
  return conToken(api().post('/api/usuarios').send(datos), token);
}

function actualizar(id, datos, token = tokenAdmin) {
  return conToken(api().put(`/api/usuarios/${id}`).send(datos), token);
}

function cambiarEstado(id, estado, token = tokenAdmin) {
  return conToken(api().patch(`/api/usuarios/${id}/estado`).send({ estado }), token);
}

describe('USR · Gestión de usuarios', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
    tokenAdmin = await obtenerToken('anaquispe', 'Admin123!');
    tokenArchivista = await obtenerToken('lmamani', 'Archivo123!');
    tokenExterno = await obtenerToken('cflores', 'Consulta123!');
  });

  it('USR-01 registra un usuario con contraseña cifrada', async () => {
    const respuesta = await crear(USUARIO_NUEVO);

    expect(respuesta.status).toBe(201);
    const usuario = respuesta.body.usuario;
    expect(usuario).toMatchObject({
      nombres: 'Rosa',
      apellidos: 'Vargas Lima',
      correo: 'rosa.vargas@ara.gob.pe',
      nombreUsuario: 'rvargas',
      perfil: 'ARCHIVISTA',
      estado: 'ACTIVO',
    });
    expect(usuario).not.toHaveProperty('contrasena');
    expect(usuario).not.toHaveProperty('password_hash');

    const { rows } = await consultar(
      'SELECT password_hash FROM usuario WHERE nombre_usuario = $1',
      ['rvargas'],
    );
    expect(rows[0].password_hash).not.toBe(USUARIO_NUEVO.contrasena);
    expect(rows[0].password_hash.startsWith('$2')).toBe(true);
  });

  it('USR-02 rechaza un usuario o correo duplicado', async () => {
    const porUsuario = await crear({ ...USUARIO_NUEVO, correo: 'otro.correo@ara.gob.pe' });
    const porCorreo = await crear({ ...USUARIO_NUEVO, nombre_usuario: 'otro.usuario' });

    expect(porUsuario.status).toBe(409);
    expect(porUsuario.body.error.codigo).toBe('REGISTRO_DUPLICADO');
    expect(porCorreo.status).toBe(409);
    expect(porCorreo.body.error.codigo).toBe('REGISTRO_DUPLICADO');
  });

  it('USR-03 rechaza el token de un usuario desactivado', async () => {
    const creado = await crear({ ...USUARIO_NUEVO, nombre_usuario: 'temporal', correo: 'temporal@ara.gob.pe' });
    const id = creado.body.usuario.id;
    const token = await obtenerToken('temporal', USUARIO_NUEVO.contrasena);

    const sesionAntes = await conToken(api().get('/api/auth/sesion'), token);
    expect(sesionAntes.status).toBe(200);

    const baja = await conToken(api().delete(`/api/usuarios/${id}`), tokenAdmin);
    expect(baja.status).toBe(200);
    expect(baja.body.usuario.estado).toBe('INACTIVO');

    const sesionDespues = await conToken(api().get('/api/auth/sesion'), token);
    expect(sesionDespues.status).toBe(401);
    expect(sesionDespues.body.error.codigo).toBe('TOKEN_INVALIDO');

    const login = await iniciarSesion('temporal', USUARIO_NUEVO.contrasena);
    expect(login.status).toBe(403);
    expect(login.body.error.codigo).toBe('CUENTA_INACTIVA');
  });

  it('USR-04 rechaza las operaciones de administración a otros perfiles', async () => {
    const archivista = await listar({}, tokenArchivista);
    const externo = await crear(USUARIO_NUEVO, tokenExterno);

    expect(archivista.status).toBe(403);
    expect(archivista.body.error.codigo).toBe('PERFIL_NO_AUTORIZADO');
    expect(externo.status).toBe(403);
  });

  it('USR-05 lista usuarios con filtros y paginación', async () => {
    const respuesta = await listar({ perfil: 'ARCHIVISTA', por_pagina: 10 });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.total).toBeGreaterThan(0);
    expect(respuesta.body.resultados.every((usuario) => usuario.perfil === 'ARCHIVISTA')).toBe(true);

    const busqueda = await listar({ q: 'rosa' });
    expect(busqueda.body.resultados.some((usuario) => usuario.nombreUsuario === 'rvargas')).toBe(true);
  });

  it('USR-06 actualiza datos, perfil y contraseña', async () => {
    const { rows } = await consultar("SELECT id FROM usuario WHERE nombre_usuario = 'rvargas'");
    const id = rows[0].id;

    const respuesta = await actualizar(id, {
      nombres: 'Rosa María',
      perfil: 'ADMINISTRADOR',
      contrasena: 'NuevaClave123!',
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.nombres).toBe('Rosa María');
    expect(respuesta.body.usuario.perfil).toBe('ADMINISTRADOR');

    const login = await iniciarSesion('rvargas', 'NuevaClave123!');
    expect(login.status).toBe(200);
  });

  it('USR-07 permite reactivar una cuenta desactivada', async () => {
    const { rows } = await consultar("SELECT id FROM usuario WHERE nombre_usuario = 'temporal'");
    const id = rows[0].id;

    const respuesta = await cambiarEstado(id, 'ACTIVO');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.estado).toBe('ACTIVO');

    const login = await iniciarSesion('temporal', USUARIO_NUEVO.contrasena);
    expect(login.status).toBe(200);
  });

  it('USR-08 impide que el administrador desactive su propia cuenta', async () => {
    const respuesta = await cambiarEstado(1, 'INACTIVO');
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('OPERACION_NO_PERMITIDA');
  });

  it('USR-09 impide dejar el sistema sin administradores activos', async () => {
    const { rows } = await consultar("SELECT id FROM usuario WHERE nombre_usuario = 'rvargas'");
    await conToken(api().delete(`/api/usuarios/${rows[0].id}`), tokenAdmin);

    const respuesta = await actualizar(1, { perfil: 'ARCHIVISTA' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('OPERACION_NO_PERMITIDA');
  });

  it('USR-10 valida los datos de entrada', async () => {
    const correoInvalido = await crear({ ...USUARIO_NUEVO, nombre_usuario: 'x1', correo: 'no-es-correo' });
    const claveCorta = await crear({ ...USUARIO_NUEVO, nombre_usuario: 'x2', correo: 'x2@ara.gob.pe', contrasena: '123' });
    const perfilInvalido = await crear({ ...USUARIO_NUEVO, nombre_usuario: 'x3', correo: 'x3@ara.gob.pe', perfil: 'SUPERADMIN' });

    expect(correoInvalido.status).toBe(400);
    expect(claveCorta.status).toBe(400);
    expect(perfilInvalido.status).toBe(400);
  });

  it('USR-11 devuelve 404 para un usuario inexistente', async () => {
    const respuesta = await conToken(api().get('/api/usuarios/999999'), tokenAdmin);
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('USR-12 registra las operaciones en auditoría', async () => {
    const { rows } = await consultar('SELECT tipo_accion FROM registro_auditoria');
    const acciones = rows.map((fila) => fila.tipo_accion);

    expect(acciones).toContain('CREACION_USUARIO');
    expect(acciones).toContain('ACTUALIZACION_USUARIO');
    expect(acciones).toContain('DESACTIVACION_USUARIO');
    expect(acciones).toContain('ACTIVACION_USUARIO');
  });
});
