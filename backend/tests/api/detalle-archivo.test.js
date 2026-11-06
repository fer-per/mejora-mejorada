import { beforeAll, describe, expect, it } from 'vitest';
import { consultar, reiniciarBaseDeDatos } from '../helpers/db.js';
import { api, conToken, obtenerToken } from '../helpers/api.js';

let token;

function detalle(id) {
  return conToken(api().get(`/api/documentos/${id}`), token);
}

function archivo(id) {
  return conToken(api().get(`/api/documentos/${id}/archivo`), token);
}

function miniatura(id) {
  return conToken(api().get(`/api/documentos/${id}/miniatura`), token);
}

async function accionesAuditadas() {
  const { rows } = await consultar('SELECT tipo_accion FROM registro_auditoria');
  return rows.map((fila) => fila.tipo_accion);
}

describe('DET · Detalle documental', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
    token = await obtenerToken();
  });

  it('DET-01/04/05 devuelve la ficha completa con interesados y roles', async () => {
    const respuesta = await detalle(1);

    expect(respuesta.status).toBe(200);
    const documento = respuesta.body.documento;
    expect(documento.id).toBe(1);
    expect(documento.titulo).toMatch(/cabildo/i);
    expect(documento).toHaveProperty('alcanceContenido');
    expect(documento).toHaveProperty('descriptores');
    expect(documento).toHaveProperty('ubicacionFisica');
    expect(documento.archivoUrl).toBe('/api/documentos/1/archivo');
    expect(documento.interesados).toHaveLength(2);
    expect(documento.interesados.map((interesado) => interesado.rol).sort()).toEqual([
      'Autoridad emitente',
      'Solicitante',
    ]);
  });

  it.each([
    ['DET-02 identificador inexistente', 9999, 404, 'NO_ENCONTRADO'],
    ['DET-03 identificador cero', 0, 400, 'VALIDACION_INVALIDA'],
    ['DET-03 identificador negativo', -1, 400, 'VALIDACION_INVALIDA'],
    ['DET-03 identificador no numérico', 'abc', 400, 'VALIDACION_INVALIDA'],
  ])('%s', async (_nombre, id, estado, codigo) => {
    const respuesta = await detalle(id);
    expect(respuesta.status).toBe(estado);
    expect(respuesta.body.error.codigo).toBe(codigo);
  });

  it('DET-06 usa la fecha de carga cuando no hay fecha de producción', async () => {
    await consultar('UPDATE archivo SET fecha_produccion = NULL WHERE id = 1');
    try {
      const respuesta = await detalle(1);
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.documento.fecha).toBe(respuesta.body.documento.fechaCarga.slice(0, 10));
      expect(respuesta.body.documento.fechaProduccion).toBeNull();
    } finally {
      await consultar("UPDATE archivo SET fecha_produccion = '1848-03-14' WHERE id = 1");
    }
  });

  it('DET-08 registra la consulta en auditoría', async () => {
    await detalle(2);
    expect(await accionesAuditadas()).toContain('CONSULTA_DETALLE_DOCUMENTO');
  });

  it('DET-09 rechaza la consulta sin token', async () => {
    const respuesta = await api().get('/api/documentos/1');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('TOKEN_INVALIDO');
  });
});

describe('ARC · Archivos y miniaturas', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
    token = await obtenerToken();
  });

  it('ARC-01 entrega un PDF/A inline', async () => {
    const respuesta = await archivo(1);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toMatch(/application\/pdf/);
    expect(respuesta.headers['content-disposition']).toMatch(/^inline;/);
    expect(respuesta.headers['content-disposition']).toMatch(/\.pdf"/);
    expect(respuesta.headers['cache-control']).toBe('private, max-age=60');
  });

  it('ARC-02 entrega un TIFF inline', async () => {
    const respuesta = await archivo(2);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toMatch(/image\/tiff/);
    expect(respuesta.headers['content-disposition']).toMatch(/\.tif"/);
  });

  it('ARC-03 entrega la miniatura como PNG', async () => {
    const respuesta = await miniatura(1);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers['content-type']).toMatch(/image\/png/);
    expect(respuesta.headers['content-disposition']).toMatch(/\.png"/);
    expect(respuesta.headers['cache-control']).toBe('private, max-age=300');
  });

  it('ARC-04 rechaza el acceso al archivo sin token', async () => {
    const respuesta = await api().get('/api/documentos/1/archivo');
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('TOKEN_INVALIDO');
  });

  it('ARC-05 rechaza el acceso a la miniatura sin token', async () => {
    const respuesta = await api().get('/api/documentos/1/miniatura');
    expect(respuesta.status).toBe(401);
  });

  it('ARC-06 devuelve 404 cuando el archivo físico no existe', async () => {
    await consultar("UPDATE archivo SET ruta_archivo = 'no-existe/documento.pdf' WHERE id = 1");
    try {
      const respuesta = await archivo(1);
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe('ARCHIVO_NO_DISPONIBLE');
    } finally {
      await consultar(
        "UPDATE archivo SET ruta_archivo = 'fondo-cabildo/P-1848/1848/titulo-01.pdf' WHERE id = 1",
      );
    }
  });

  it('ARC-06 devuelve 404 cuando no hay miniatura registrada', async () => {
    await consultar('UPDATE archivo SET ruta_miniatura = NULL WHERE id = 1');
    try {
      const respuesta = await miniatura(1);
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe('ARCHIVO_NO_DISPONIBLE');
    } finally {
      await consultar("UPDATE archivo SET ruta_miniatura = 'miniaturas/titulo-01.png' WHERE id = 1");
    }
  });

  it('ARC-07 rechaza una ruta que escapa del repositorio', async () => {
    await consultar("UPDATE archivo SET ruta_archivo = '../../../../etc/passwd' WHERE id = 1");
    try {
      const respuesta = await archivo(1);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.codigo).toBe('RUTA_INVALIDA');
    } finally {
      await consultar(
        "UPDATE archivo SET ruta_archivo = 'fondo-cabildo/P-1848/1848/titulo-01.pdf' WHERE id = 1",
      );
    }
  });

  it('ARC-08 devuelve 404 para un documento inexistente', async () => {
    const respuesta = await archivo(9999);
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('ARC-09 registra la visualización en auditoría', async () => {
    await archivo(1);
    expect(await accionesAuditadas()).toContain('VISUALIZACION_DOCUMENTO');
  });

  it('ARC-10 no registra la carga de miniaturas en auditoría', async () => {
    const antes = (await accionesAuditadas()).filter((accion) => accion === 'VISUALIZACION_DOCUMENTO').length;
    await miniatura(2);
    const despues = (await accionesAuditadas()).filter((accion) => accion === 'VISUALIZACION_DOCUMENTO').length;
    expect(despues).toBe(antes);
  });
});
