import { beforeAll, describe, expect, it } from 'vitest';
import { consultar, reiniciarBaseDeDatos } from '../helpers/db.js';
import { api, conToken, obtenerToken } from '../helpers/api.js';

let tokenAdmin;
let tokenArchivista;
let tokenExterno;

beforeAll(async () => {
  await reiniciarBaseDeDatos();
  tokenAdmin = await obtenerToken('anaquispe', 'Admin123!');
  tokenArchivista = await obtenerToken('lmamani', 'Archivo123!');
  tokenExterno = await obtenerToken('cflores', 'Consulta123!');
});

function actualizar(id, datos, token = tokenArchivista) {
  return conToken(api().put(`/api/documentos/${id}`).send(datos), token);
}

function historial(id, token = tokenAdmin) {
  return conToken(api().get(`/api/documentos/${id}/historial`), token);
}

describe('GES — Historial, concurrencia y reversión', () => {
  it('GES-01 registra el estado anterior y posterior de una edición', async () => {
    const respuesta = await actualizar(3, { titulo: 'Título editado por gestión', folios: 15 });
    expect(respuesta.status).toBe(200);

    const { rows } = await consultar(
      `SELECT tipo_operacion, antes, despues
         FROM historial_cambio
        WHERE id_archivo = 3
        ORDER BY id DESC LIMIT 1`,
    );
    expect(rows[0].tipo_operacion).toBe('EDICION');
    expect(rows[0].antes.titulo).not.toBe('Título editado por gestión');
    expect(rows[0].despues.titulo).toBe('Título editado por gestión');
    expect(rows[0].despues.folios).toBe(15);
  });

  it('GES-02 rechaza una edición con una versión desactualizada', async () => {
    const ficha = await conToken(api().get('/api/documentos/3'), tokenAdmin);
    const version = ficha.body.documento.fechaActualizacion;

    const primera = await actualizar(3, { observaciones: 'Primera edición', fecha_actualizacion: version });
    expect(primera.status).toBe(200);

    const segunda = await actualizar(3, { observaciones: 'Segunda edición', fecha_actualizacion: version });
    expect(segunda.status).toBe(409);
    expect(segunda.body.error.codigo).toBe('CONFLICTO_CONCURRENCIA');
  });

  it('GES-03 revierte una edición y deja rastro de la reversión', async () => {
    const listado = await historial(3);
    const cambio = listado.body.resultados[0];

    const respuesta = await conToken(
      api().post(`/api/documentos/3/historial/${cambio.id}/revertir`).send({}),
      tokenArchivista,
    );
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.documento.id).toBe(3);

    const { rows } = await consultar(
      `SELECT tipo_operacion, id_cambio_origen
         FROM historial_cambio
        WHERE id_archivo = 3
        ORDER BY id DESC LIMIT 1`,
    );
    expect(rows[0].tipo_operacion).toBe('REVERSION');
    expect(rows[0].id_cambio_origen).toBe(cambio.id);
  });

  it('GES-04 impide que un usuario externo edite', async () => {
    const respuesta = await actualizar(5, { titulo: 'No permitido' }, tokenExterno);
    expect(respuesta.status).toBe(403);
  });
});

describe('GES — Anulación lógica', () => {
  it('GES-05 anula, oculta de la consulta pública y restaura', async () => {
    const anulacion = await conToken(
      api().post('/api/documentos/4/anular').send({ motivo: 'Error de digitalización' }),
      tokenAdmin,
    );
    expect(anulacion.status).toBe(200);
    expect(anulacion.body.documento.anulado).toBe(true);

    const busqueda = await conToken(
      api().get('/api/documentos/busqueda/simple').query({ q: 'decreto' }),
      tokenExterno,
    );
    expect(busqueda.body.resultados.some((documento) => documento.id === 4)).toBe(false);

    const externo = await conToken(api().get('/api/documentos/4'), tokenExterno);
    expect(externo.status).toBe(404);

    const admin = await conToken(api().get('/api/documentos/4'), tokenAdmin);
    expect(admin.status).toBe(200);
    expect(admin.body.documento.anulado).toBe(true);

    const soloAnulados = await conToken(
      api().get('/api/gestion/documentos').query({ solo_anulados: 'true' }),
      tokenAdmin,
    );
    expect(soloAnulados.status).toBe(200);
    expect(soloAnulados.body.resultados.some((documento) => documento.id === 4)).toBe(true);

    const restauracion = await conToken(
      api().post('/api/documentos/4/restaurar'),
      tokenAdmin,
    );
    expect(restauracion.status).toBe(200);
    expect(restauracion.body.documento.anulado).toBe(false);

    const { rows } = await consultar(
      `SELECT tipo_operacion FROM historial_cambio
        WHERE id_archivo = 4 ORDER BY id`,
    );
    expect(rows.map((fila) => fila.tipo_operacion)).toEqual(['ANULACION', 'RESTAURACION']);
  });

  it('GES-06 impide al archivista anular documentos', async () => {
    const respuesta = await conToken(
      api().post('/api/documentos/5/anular').send({ motivo: 'Intento' }),
      tokenArchivista,
    );
    expect(respuesta.status).toBe(403);
  });
});

describe('GES — Edición masiva', () => {
  it('GES-07 edita varios documentos y revierte la operación completa', async () => {
    const edicion = await conToken(
      api().post('/api/gestion/edicion-masiva').send({
        ids: [5, 6],
        cambios: { estado_conservacion: 'Regular', serie: 'Serie masiva' },
      }),
      tokenArchivista,
    );
    expect(edicion.status).toBe(200);
    expect(edicion.body.afectados).toBe(2);

    const { rows } = await consultar(
      `SELECT COUNT(*)::int AS total FROM historial_cambio
        WHERE id_operacion = $1 AND tipo_operacion = 'EDICION_MASIVA'`,
      [edicion.body.idOperacion],
    );
    expect(rows[0].total).toBe(2);

    const reversion = await conToken(
      api().post(`/api/gestion/operaciones/${edicion.body.idOperacion}/revertir`).send({}),
      tokenArchivista,
    );
    expect(reversion.status).toBe(200);
    expect(reversion.body.afectados).toBe(2);

    const documento = await conToken(api().get('/api/documentos/5'), tokenAdmin);
    expect(documento.body.documento.estadoConservacion).toBe('Malo');
    expect(documento.body.documento.serie).toBe('Correspondencia oficial');
  });

  it('GES-08 rechaza más de 500 documentos por operación', async () => {
    const ids = Array.from({ length: 501 }, (_, indice) => indice + 1);
    const respuesta = await conToken(
      api().post('/api/gestion/edicion-masiva').send({
        ids,
        cambios: { estado_conservacion: 'Bueno' },
      }),
      tokenAdmin,
    );
    expect(respuesta.status).toBe(400);
  });
});

describe('GES — Estructura y fusiones', () => {
  it('GES-09 solo el administrador edita la estructura', async () => {
    const denegado = await conToken(
      api().patch('/api/gestion/estructura/titulos/1').send({ nombre: 'Nuevo nombre' }),
      tokenArchivista,
    );
    expect(denegado.status).toBe(403);

    const permitido = await conToken(
      api().patch('/api/gestion/estructura/titulos/1').send({ nombre: 'Título de estructura' }),
      tokenAdmin,
    );
    expect(permitido.status).toBe(200);
    expect(permitido.body.id).toBe(1);

    const { rows } = await consultar(
      `SELECT nombre FROM titulo_escritura WHERE id = 1`,
    );
    expect(rows[0].nombre).toBe('Título de estructura');
  });

  it('GES-10 previsualiza y fusiona protocolos duplicados', async () => {
    await consultar(
      `INSERT INTO protocolo (id, id_fondo, id_escribano, numero)
       VALUES (50, 1, 1, 'P-1848')`,
    );
    await consultar(
      `INSERT INTO anio_protocolo (id, id_protocolo, anio) VALUES (50, 50, 1848)`,
    );
    await consultar(
      `INSERT INTO registro (id, id_anio_protocolo, numero) VALUES (50, 50, 'REG-001')`,
    );
    await consultar(
      `INSERT INTO titulo_escritura (id, id_registro, nombre) VALUES (50, 50, 'Título duplicado')`,
    );

    const previo = await conToken(
      api().post('/api/gestion/fusiones/previsualizar/protocolos').send({ origen: 50, destino: 1 }),
      tokenAdmin,
    );
    expect(previo.status).toBe(200);
    expect(previo.body.conflictos.length).toBeGreaterThan(0);

    const fusion = await conToken(
      api().post('/api/gestion/fusiones/protocolos').send({ origen: 50, destino: 1 }),
      tokenAdmin,
    );
    expect(fusion.status).toBe(200);

    const { rows } = await consultar('SELECT id FROM protocolo WHERE id = 50');
    expect(rows).toHaveLength(0);

    const { rows: titulos } = await consultar(
      `SELECT id_registro FROM titulo_escritura WHERE id = 50`,
    );
    expect(titulos[0].id_registro).toBe(1);
  });

  it('GES-11 detecta duplicados de protocolos e interesados', async () => {
    await consultar(
      `INSERT INTO protocolo (id, id_fondo, id_escribano, numero)
       VALUES (51, 1, 1, 'P-1848')`,
    );
    const respuesta = await conToken(api().get('/api/gestion/duplicados'), tokenAdmin);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.totales.interesados).toBe(0);
    expect(respuesta.body.protocolos.length).toBeGreaterThan(0);
  });
});

describe('GES — Reemplazo de archivo', () => {
  it('GES-12 solo el administrador reemplaza el archivo digital', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

    const denegado = await conToken(
      api().put('/api/documentos/3/archivo').attach('archivo', pdf, 'nuevo.pdf'),
      tokenArchivista,
    );
    expect(denegado.status).toBe(403);

    const permitido = await conToken(
      api().put('/api/documentos/3/archivo').attach('archivo', pdf, 'nuevo.pdf'),
      tokenAdmin,
    );
    expect(permitido.status).toBe(200);
    expect(permitido.body.documento.formato).toBe('PDF/A');
    expect(permitido.body.documento.nombreOriginal).toBe('nuevo.pdf');

    const { rows } = await consultar(
      `SELECT tipo_operacion, antes, despues FROM historial_cambio
        WHERE id_archivo = 3 AND tipo_operacion = 'REEMPLAZO_ARCHIVO'
        ORDER BY id DESC LIMIT 1`,
    );
    expect(rows[0].antes.archivo.ruta_archivo).toBe('fondo-cabildo/P-1848/1848/titulo-02.pdf');
    expect(rows[0].despues.archivo.nombre_original).toBe('nuevo.pdf');
  });
});
