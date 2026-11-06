import { beforeAll, describe, expect, it } from 'vitest';
import { consultar, reiniciarBaseDeDatos } from '../helpers/db.js';
import { api, conToken, iniciarSesion, obtenerToken } from '../helpers/api.js';

let token;

function auditoria() {
  return consultar('SELECT tipo_accion, descripcion FROM registro_auditoria ORDER BY id');
}

describe('CAT · Catálogos', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
    token = await obtenerToken();
  });

  it('CAT-01 devuelve fondos, series, tipologías, conservaciones y resumen', async () => {
    const respuesta = await conToken(api().get('/api/catalogos'), token);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.fondos).toHaveLength(3);
    expect(respuesta.body.series).toHaveLength(6);
    expect(respuesta.body.tipologias).toHaveLength(9);
    expect(respuesta.body.conservaciones).toEqual(['Bueno', 'Malo', 'Regular']);
    expect(respuesta.body.totalDocumentos).toBe(11);
    expect(respuesta.body.totalDigitalizados).toBe(11);
    expect(respuesta.body.rangoAnios).toEqual({ desde: 1848, hasta: 1907 });
  });

  it('CAT-02 lista los fondos en el orden definido por la consulta', async () => {
    const respuesta = await conToken(api().get('/api/catalogos/fondos'), token);

    expect(respuesta.status).toBe(200);
    const { rows } = await consultar(
      `SELECT f.denominacion
         FROM fondo f
         JOIN repositorio rep ON rep.id = f.id_repositorio
        ORDER BY f.denominacion`,
    );
    expect(respuesta.body.fondos.map((fondo) => fondo.denominacion)).toEqual(
      rows.map((fila) => fila.denominacion),
    );
    expect(new Set(respuesta.body.fondos.map((fondo) => fondo.id)).size).toBe(3);
    for (const fondo of respuesta.body.fondos) {
      expect(fondo).toMatchObject({
        id: expect.any(Number),
        denominacion: expect.any(String),
        repositorio: expect.any(String),
        siglo: expect.any(Number),
      });
    }
  });

  it('CAT-03 lista series y tipologías distintas', async () => {
    const series = await conToken(api().get('/api/catalogos/series'), token);
    const tipologias = await conToken(api().get('/api/catalogos/tipologias'), token);

    expect(series.status).toBe(200);
    expect(tipologias.status).toBe(200);
    expect(series.body.series.length).toBe(new Set(series.body.series).size);
    expect(tipologias.body.tipologias.length).toBe(new Set(tipologias.body.tipologias).size);
    expect(series.body.series.every((serie) => typeof serie === 'string' && serie.length > 0)).toBe(true);
  });

  it('CAT-04 rechaza el acceso sin token', async () => {
    const respuesta = await api().get('/api/catalogos/fondos');
    expect(respuesta.status).toBe(401);
  });
});

describe('AUD · Registro de auditoría', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
    token = await obtenerToken();
  });

  it('AUD-01 registra el inicio de sesión exitoso', async () => {
    const { rows } = await auditoria();
    expect(rows.some((fila) => fila.tipo_accion === 'INICIO_SESION_EXITOSO')).toBe(true);
  });

  it('AUD-02 registra el inicio de sesión fallido', async () => {
    await iniciarSesion('lmamani', 'incorrecta');
    const { rows } = await auditoria();
    expect(rows.some((fila) => fila.tipo_accion === 'INICIO_SESION_FALLIDO')).toBe(true);
  });

  it('AUD-03 registra el bloqueo de la cuenta', async () => {
    for (let intento = 1; intento <= 5; intento += 1) {
      await iniciarSesion('cflores', 'incorrecta');
    }
    const { rows } = await auditoria();
    expect(rows.some((fila) => fila.tipo_accion === 'CUENTA_BLOQUEADA')).toBe(true);
  });

  it('AUD-04/05/06 registra búsqueda, detalle, visualización y cierre de sesión', async () => {
    await conToken(api().get('/api/documentos/busqueda/simple').query({ q: 'aguas' }), token);
    await conToken(api().get('/api/documentos/1'), token);
    await conToken(api().get('/api/documentos/1/archivo'), token);
    await conToken(api().post('/api/auth/logout'), token);

    const { rows } = await auditoria();
    const acciones = rows.map((fila) => fila.tipo_accion);
    expect(acciones).toContain('CONSULTA_DOCUMENTAL');
    expect(acciones).toContain('CONSULTA_DETALLE_DOCUMENTO');
    expect(acciones).toContain('VISUALIZACION_DOCUMENTO');
    expect(acciones).toContain('CIERRE_SESION');
  });

  it('AUD-07 registra los criterios y el total de la búsqueda', async () => {
    await conToken(api().get('/api/documentos/busqueda/simple').query({ q: 'aguas' }), token);
    const { rows } = await consultar(
      "SELECT descripcion FROM registro_auditoria WHERE tipo_accion = 'CONSULTA_DOCUMENTAL' ORDER BY id DESC LIMIT 1",
    );
    expect(rows[0].descripcion).toMatch(/simple/);
    expect(rows[0].descripcion).toMatch(/texto=aguas/);
    expect(rows[0].descripcion).toMatch(/resultado/);
  });

  it('AUD-10 no expone contraseñas ni tokens en las descripciones', async () => {
    const { rows } = await auditoria();
    for (const fila of rows) {
      expect(fila.descripcion).not.toMatch(/Admin123!|Archivo123!|Consulta123!/);
      expect(fila.descripcion).not.toMatch(/eyJ[A-Za-z0-9_-]+\./);
    }
  });
});
