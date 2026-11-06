import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';
import { reiniciarBaseDeDatos } from '../helpers/db.js';
import { api, conToken, iniciarSesion, obtenerToken } from '../helpers/api.js';

const RUTAS_PROTEGIDAS = [
  ['búsqueda simple', '/api/documentos/busqueda/simple?q=aguas'],
  ['búsqueda avanzada', '/api/documentos/busqueda/avanzada?texto=agua'],
  ['detalle', '/api/documentos/1'],
  ['archivo', '/api/documentos/1/archivo'],
  ['miniatura', '/api/documentos/1/miniatura'],
  ['catálogos', '/api/catalogos'],
  ['catálogo de fondos', '/api/catalogos/fondos'],
];

function base64url(valor) {
  return Buffer.from(JSON.stringify(valor)).toString('base64url');
}

describe('AZ · Autorización y control de acceso', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
  });

  it.each(RUTAS_PROTEGIDAS)('AZ-01 rechaza %s sin token', async (_nombre, ruta) => {
    const respuesta = await api().get(ruta);
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('TOKEN_INVALIDO');
  });

  it('AZ-03 permite consultar con los tres perfiles', async () => {
    const perfiles = [
      ['anaquispe', 'Admin123!'],
      ['lmamani', 'Archivo123!'],
      ['cflores', 'Consulta123!'],
    ];

    for (const [usuario, contrasena] of perfiles) {
      const token = await obtenerToken(usuario, contrasena);
      const respuesta = await conToken(api().get('/api/documentos/busqueda/simple').query({ q: 'agua' }), token);
      expect(respuesta.status).toBe(200);
    }
  });

  it('AZ-06 aplica las cabeceras de seguridad de Helmet', async () => {
    const respuesta = await api().get('/api/salud');

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['x-powered-by']).toBeUndefined();
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['content-security-policy']).toBeDefined();
    expect(respuesta.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('AZ-08 no concede CORS a un origen no permitido', async () => {
    const respuesta = await api().get('/api/salud').set('Origin', 'http://origen-malicioso.example');

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('AZ-08 concede CORS al origen configurado', async () => {
    const respuesta = await api().get('/api/salud').set('Origin', process.env.CORS_ORIGIN);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['access-control-allow-origin']).toBe(process.env.CORS_ORIGIN);
  });

  it('AZ-09 devuelve 404 para una ruta de API inexistente', async () => {
    const respuesta = await api().get('/api/ruta-inexistente');
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe('RUTA_NO_ENCONTRADA');
  });
});

describe('SEG · Seguridad de la API', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
  });

  it("SEG-01 rechaza una inyección SQL en el login", async () => {
    const respuesta = await iniciarSesion("' OR '1'='1", 'cualquiera');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
  });

  it('SEG-02 trata comillas y comodines de búsqueda como texto', async () => {
    const token = await obtenerToken();
    const respuesta = await conToken(
      api().get('/api/documentos/busqueda/simple').query({ q: "'; DROP TABLE archivo; --" }),
      token,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('total');
  });

  it('SEG-03 rechaza parámetros no numéricos en filtros', async () => {
    const token = await obtenerToken();
    const respuesta = await conToken(
      api().get('/api/documentos/busqueda/avanzada').query({ fondo: '1;DROP TABLE archivo' }),
      token,
    );
    expect(respuesta.status).toBe(400);
  });

  it('SEG-15 rechaza un JWT con el perfil alterado', async () => {
    const token = await obtenerToken('cflores', 'Consulta123!');
    const [cabecera, carga, firma] = token.split('.');
    const payload = JSON.parse(Buffer.from(carga, 'base64url').toString('utf8'));
    payload.perfil = 'ADMINISTRADOR';
    const alterado = `${cabecera}.${base64url(payload)}.${firma}`;

    const respuesta = await api().get('/api/auth/sesion').set('Authorization', `Bearer ${alterado}`);
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('TOKEN_INVALIDO');
  });

  it('SEG-16 rechaza un JWT firmado con otro secreto', async () => {
    const token = jwt.sign({ sub: 1, perfil: 'ADMINISTRADOR' }, 'secreto-atacante-2026', {
      expiresIn: '1h',
      issuer: 'siarc-ara',
    });

    const respuesta = await api().get('/api/auth/sesion').set('Authorization', `Bearer ${token}`);
    expect(respuesta.status).toBe(401);
  });

  it('SEG-17 rechaza cabeceras Authorization mal formadas', async () => {
    const token = await obtenerToken();
    for (const cabecera of ['Basic abc', token, `Bearer`, 'Bearer ']) {
      const respuesta = await api().get('/api/auth/sesion').set('Authorization', cabecera);
      expect(respuesta.status).toBe(401);
    }
  });
});
