import { beforeAll, describe, expect, it } from 'vitest';
import { consultar, reiniciarBaseDeDatos } from '../helpers/db.js';
import { api, conToken, obtenerToken } from '../helpers/api.js';

let tokenAdmin;
let tokenArchivista;
let tokenExterno;

function actualizar(id, datos, token = tokenArchivista) {
  return conToken(api().put(`/api/documentos/${id}`).send(datos), token);
}

function listarAuditoria(query = {}, token = tokenAdmin) {
  return conToken(api().get('/api/auditoria').query(query), token);
}

describe('EDT · Edición de documentos', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
    tokenAdmin = await obtenerToken('anaquispe', 'Admin123!');
    tokenArchivista = await obtenerToken('lmamani', 'Archivo123!');
    tokenExterno = await obtenerToken('cflores', 'Consulta123!');
  });

  it('EDT-01 permite al archivista actualizar campos descriptivos', async () => {
    const respuesta = await actualizar(3, {
      titulo: 'Título actualizado de prueba',
      serie: 'Serie actualizada',
      folios: 12,
      estado_conservacion: 'Regular',
      fecha_produccion: '1900-02-28',
      observaciones: 'Observación de prueba',
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.documento.titulo).toBe('Título actualizado de prueba');
    expect(respuesta.body.documento.serie).toBe('Serie actualizada');
    expect(respuesta.body.documento.folios).toBe(12);
    expect(respuesta.body.documento.estadoConservacion).toBe('Regular');
    expect(respuesta.body.documento.fechaProduccion).toBe('1900-02-28');
    expect(respuesta.body.documento.observaciones).toBe('Observación de prueba');

    const { rows } = await consultar(
      'SELECT id_usuario_actualizacion, fecha_actualizacion FROM archivo WHERE id = 3',
    );
    expect(rows[0].id_usuario_actualizacion).toBe(2);
    expect(rows[0].fecha_actualizacion).not.toBeNull();
  });

  it('EDT-02 permite al administrador actualizar y reemplazar interesados', async () => {
    const respuesta = await actualizar(
      4,
      {
        interesados: [
          { nombre: 'Nuevo Interesado', documento: '12345678', rol: 'Solicitante' },
          { nombre: 'Otro Interesado', rol: 'Testigo' },
        ],
      },
      tokenAdmin,
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.documento.interesados).toHaveLength(2);
    expect(respuesta.body.documento.interesados.map((interesado) => interesado.rol).sort()).toEqual([
      'Solicitante',
      'Testigo',
    ]);

    const { rows } = await consultar(
      `SELECT COUNT(*)::int AS total
         FROM rol_interesado ri
         JOIN archivo a ON a.id_titulo_escritura = ri.id_titulo_escritura
        WHERE a.id = $1`,
      [respuesta.body.documento.id],
    );
    expect(rows[0].total).toBe(2);
  });

  it('EDT-03 rechaza la edición de un usuario externo', async () => {
    const respuesta = await actualizar(5, { titulo: 'No permitido' }, tokenExterno);
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('PERFIL_NO_AUTORIZADO');
  });

  it('EDT-04 rechaza una fecha inexistente en el calendario', async () => {
    const respuesta = await actualizar(5, { fecha_produccion: '2024-02-31' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION_INVALIDA');
  });

  it('EDT-05 rechaza una actualización sin campos', async () => {
    const respuesta = await actualizar(5, {});
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION_INVALIDA');
  });

  it('EDT-06 devuelve 404 para un documento inexistente', async () => {
    const respuesta = await actualizar(9999, { titulo: 'Inexistente' });
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('EDT-07 registra la edición en auditoría', async () => {
    await actualizar(6, { titulo: 'Documento auditado' });
    const { rows } = await consultar(
      "SELECT descripcion FROM registro_auditoria WHERE tipo_accion = 'EDICION_DOCUMENTO' ORDER BY id DESC LIMIT 1",
    );
    expect(rows[0].descripcion).toMatch(/#6/);
    expect(rows[0].descripcion).toMatch(/titulo/);
  });

  it('EDT-08 rechaza la edición sin token', async () => {
    const respuesta = await api().put('/api/documentos/5').send({ titulo: 'Sin token' });
    expect(respuesta.status).toBe(401);
  });
});

describe('AUD · Consulta de auditoría', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
    tokenAdmin = await obtenerToken('anaquispe', 'Admin123!');
    tokenArchivista = await obtenerToken('lmamani', 'Archivo123!');
    tokenExterno = await obtenerToken('cflores', 'Consulta123!');
  });

  it('AUD-20 permite al administrador listar con paginación y filtros', async () => {
    await conToken(api().get('/api/documentos/busqueda/simple').query({ q: 'aguas' }), tokenAdmin);

    const respuesta = await listarAuditoria({ tipo_accion: 'CONSULTA_DOCUMENTAL', por_pagina: 5 });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.total).toBeGreaterThan(0);
    expect(respuesta.body.pagina).toBe(1);
    expect(respuesta.body.porPagina).toBe(5);
    expect(respuesta.body.resultados.length).toBeLessThanOrEqual(5);
    expect(respuesta.body.resultados[0]).toMatchObject({
      id: expect.any(Number),
      tipoAccion: 'CONSULTA_DOCUMENTAL',
      descripcion: expect.any(String),
    });
    expect(respuesta.body.resultados[0].usuario.nombreUsuario).toBe('anaquispe');
  });

  it('AUD-21 filtra por usuario y rango de fechas', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const respuesta = await listarAuditoria({
      id_usuario: 1,
      desde: hoy,
      hasta: hoy,
      por_pagina: 10,
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.resultados.every((registro) => registro.usuario.id === 1)).toBe(true);
  });

  it('AUD-22 devuelve el detalle de un registro', async () => {
    const listado = await listarAuditoria({ por_pagina: 1 });
    const id = listado.body.resultados[0].id;

    const respuesta = await conToken(api().get(`/api/auditoria/${id}`), tokenAdmin);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.registro.id).toBe(id);
  });

  it('AUD-23 devuelve 404 para un registro inexistente', async () => {
    const respuesta = await conToken(api().get('/api/auditoria/999999'), tokenAdmin);
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('AUD-24 permite consultar al administrador y al archivista, y rechaza al usuario externo', async () => {
    const archivista = await listarAuditoria({}, tokenArchivista);
    const externo = await listarAuditoria({}, tokenExterno);

    expect(archivista.status).toBe(200);
    expect(archivista.body.total).toBeGreaterThan(0);
    expect(externo.status).toBe(403);
    expect(externo.body.error.codigo).toBe('PERFIL_NO_AUTORIZADO');
  });

  it('AUD-25 rechaza el rango de fechas invertido', async () => {
    const respuesta = await listarAuditoria({ desde: '2024-06-01', hasta: '2024-01-01' });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION_INVALIDA');
  });

  it('AUD-26 permite al archivista consultar el detalle de una acción', async () => {
    const listado = await listarAuditoria({ por_pagina: 1 }, tokenArchivista);
    const id = listado.body.resultados[0].id;

    const respuesta = await conToken(api().get(`/api/auditoria/${id}`), tokenArchivista);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.registro.id).toBe(id);
  });

  it('AUD-27 lista los usuarios que aparecen en la auditoría', async () => {
    const respuesta = await conToken(api().get('/api/auditoria/usuarios'), tokenArchivista);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuarios.length).toBeGreaterThan(0);
    expect(respuesta.body.usuarios[0]).toMatchObject({
      id: expect.any(Number),
      nombreUsuario: expect.any(String),
    });
    expect(respuesta.body.usuarios.map((usuario) => usuario.nombreUsuario)).toContain('anaquispe');
  });

  it('AUD-28 rechaza el listado de usuarios auditados al usuario externo', async () => {
    const respuesta = await conToken(api().get('/api/auditoria/usuarios'), tokenExterno);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('PERFIL_NO_AUTORIZADO');
  });
});
