import { beforeAll, describe, expect, it } from 'vitest';
import { reiniciarBaseDeDatos } from '../helpers/db.js';
import { api, conToken, obtenerToken } from '../helpers/api.js';

let token;

function simple(parametros) {
  return conToken(api().get('/api/documentos/busqueda/simple').query(parametros), token);
}

function avanzada(parametros) {
  return conToken(api().get('/api/documentos/busqueda/avanzada').query(parametros), token);
}

describe('BUS · Búsqueda simple', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
    token = await obtenerToken();
  });

  it('BUS-01 recupera documentos por palabra clave', async () => {
    const respuesta = await simple({ q: 'aguas' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.total).toBeGreaterThan(0);
    for (const documento of respuesta.body.resultados) {
      expect(documento).toMatchObject({
        id: expect.any(Number),
        titulo: expect.any(String),
        formato: expect.any(String),
      });
      expect(documento).toHaveProperty('miniaturaUrl');
      expect(documento).toHaveProperty('fecha');
    }
  });

  it('BUS-02/03 ignora tildes y mayúsculas', async () => {
    const sinTilde = await simple({ q: 'padron' });
    const conTilde = await simple({ q: 'padrón' });
    const mayusculas = await simple({ q: 'PADRON' });

    expect(sinTilde.status).toBe(200);
    expect(conTilde.status).toBe(200);
    expect(mayusculas.status).toBe(200);
    expect(sinTilde.body.total).toBeGreaterThan(0);
    expect(conTilde.body.total).toBe(sinTilde.body.total);
    expect(mayusculas.body.total).toBe(sinTilde.body.total);
  });

  it('BUS-04 recupera títulos por coincidencia parcial (trigramas)', async () => {
    const respuesta = await simple({ q: 'cabild' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.total).toBeGreaterThan(0);
    expect(
      respuesta.body.resultados.some((documento) => /cabild/i.test(documento.titulo)),
    ).toBe(true);
  });

  it('BUS-05 devuelve un arreglo vacío cuando no hay coincidencias', async () => {
    const respuesta = await simple({ q: 'termino-sin-coincidencias-xyz' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.total).toBe(0);
    expect(respuesta.body.resultados).toEqual([]);
  });

  it.each([
    ['BUS-06 q ausente', {}],
    ['BUS-07 q vacío', { q: '' }],
    ['BUS-08 q de solo espacios', { q: '   ' }],
    ['BUS-09 q mayor de 200 caracteres', { q: 'a'.repeat(201) }],
    ['BUS-10 por_pagina = 0', { q: 'aguas', por_pagina: 0 }],
    ['BUS-11 por_pagina = 51', { q: 'aguas', por_pagina: 51 }],
    ['BUS-13 orden inválido', { q: 'aguas', orden: 'aleatorio' }],
  ])('%s devuelve 400', async (_nombre, parametros) => {
    const respuesta = await simple(parametros);
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION_INVALIDA');
  });

  it('BUS-12 ordena por fecha descendente', async () => {
    const respuesta = await simple({ q: 'municipalidad', orden: 'fecha', por_pagina: 50 });

    expect(respuesta.status).toBe(200);
    const fechas = respuesta.body.resultados
      .map((documento) => documento.fecha)
      .filter(Boolean);
    const ordenadas = [...fechas].sort().reverse();
    expect(fechas).toEqual(ordenadas);
  });

  it('BUS-12 ordena alfabéticamente por título', async () => {
    const respuesta = await simple({ q: 'municipalidad', orden: 'titulo', por_pagina: 50 });

    expect(respuesta.status).toBe(200);
    const titulos = respuesta.body.resultados.map((documento) => documento.titulo);
    const ordenados = [...titulos].sort((a, b) => a.localeCompare(b, 'es'));
    expect(titulos).toEqual(ordenados);
  });

  it('BUS-14 pagina sin duplicados y conserva el total', async () => {
    const pagina1 = await simple({ q: 'cabildo', por_pagina: 2, pagina: 1 });
    const pagina2 = await simple({ q: 'cabildo', por_pagina: 2, pagina: 2 });

    expect(pagina1.status).toBe(200);
    expect(pagina2.status).toBe(200);
    expect(pagina1.body.total).toBe(pagina2.body.total);
    expect(pagina1.body.pagina).toBe(1);
    expect(pagina2.body.pagina).toBe(2);

    const ids1 = pagina1.body.resultados.map((documento) => documento.id);
    const ids2 = pagina2.body.resultados.map((documento) => documento.id);
    expect(ids1).toHaveLength(2);
    expect(ids2).toHaveLength(2);
    expect(ids1.filter((id) => ids2.includes(id))).toEqual([]);
  });

  it('BUS-15 devuelve una página vacía cuando se supera el total de páginas', async () => {
    const respuesta = await simple({ q: 'aguas', por_pagina: 1, pagina: 99 });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.resultados).toEqual([]);
  });

  it.each([
    ["BUS-17 inyección SQL", "' OR 1=1 --"],
    ['BUS-18 comodín %', '%'],
    ['BUS-19 comodín _', '_'],
  ])('%s se trata como texto sin error 500', async (_nombre, q) => {
    const respuesta = await simple({ q });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('total');
  });
});

describe('AVZ · Búsqueda avanzada', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
    token = await obtenerToken();
  });

  it.each([
    ['AVZ-01 solo texto', { texto: 'cabildo' }],
    ['AVZ-02 solo fondo', { fondo: 1 }],
    ['AVZ-03 solo serie', { serie: 'Actas de cabildo' }],
    ['AVZ-04 solo tipología', { tipologia: 'Testimonio' }],
    ['AVZ-05 solo conservación', { conservacion: 'Bueno' }],
    ['AVZ-06 solo fecha desde', { fecha_desde: '1900-01-01' }],
    ['AVZ-07 solo fecha hasta', { fecha_hasta: '1850-12-31' }],
  ])('%s devuelve resultados coherentes', async (_nombre, parametros) => {
    const respuesta = await avanzada(parametros);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.total).toBeGreaterThan(0);
  });

  it('AVZ-07 filtra por rango de fechas', async () => {
    const respuesta = await avanzada({ fecha_desde: '1848-01-01', fecha_hasta: '1854-12-31' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.total).toBe(5);
    for (const documento of respuesta.body.resultados) {
      expect(documento.fecha >= '1848-01-01').toBe(true);
      expect(documento.fecha <= '1854-12-31').toBe(true);
    }
  });

  it('AVZ-08 combina todos los filtros con semántica AND', async () => {
    const respuesta = await avanzada({
      texto: 'cabildo',
      fondo: 1,
      serie: 'Actas de cabildo',
      tipologia: 'Testimonio',
      fecha_desde: '1848-01-01',
      fecha_hasta: '1848-12-31',
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.total).toBe(2);
    for (const documento of respuesta.body.resultados) {
      expect(documento.fondo).toMatch(/Cabildo/i);
      expect(documento.serie).toBe('Actas de cabildo');
      expect(documento.tipologia).toBe('Testimonio');
    }
  });

  it('AVZ-09 exige al menos un criterio', async () => {
    const respuesta = await avanzada({});
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION_INVALIDA');
  });

  it('AVZ-10 rechaza un rango invertido', async () => {
    const respuesta = await avanzada({ fecha_desde: '1900-01-01', fecha_hasta: '1850-01-01' });
    expect(respuesta.status).toBe(400);
  });

  it('AVZ-11 rechaza un formato de fecha con barras', async () => {
    const respuesta = await avanzada({ fecha_desde: '2024/01/01' });
    expect(respuesta.status).toBe(400);
  });

  it('AVZ-13/14 rechaza fondo no numérico o cero', async () => {
    expect((await avanzada({ fondo: 'abc' })).status).toBe(400);
    expect((await avanzada({ fondo: 0 })).status).toBe(400);
    expect((await avanzada({ fondo: -1 })).status).toBe(400);
  });

  it('AVZ-19 devuelve 0 resultados cuando la combinación no coincide', async () => {
    const respuesta = await avanzada({ texto: 'cabildo', tipologia: 'Padrón' });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.total).toBe(0);
    expect(respuesta.body.resultados).toEqual([]);
  });

  it('AVZ-20 rechaza por_pagina = 51', async () => {
    const respuesta = await avanzada({ texto: 'agua', por_pagina: 51 });
    expect(respuesta.status).toBe(400);
  });

  it('AVZ-12 devuelve 400 ante fechas inexistentes', async () => {
    expect((await avanzada({ fecha_desde: '2024-02-31' })).status).toBe(400);
    expect((await avanzada({ fecha_desde: '2023-02-29' })).status).toBe(400);
    expect((await avanzada({ fecha_desde: '2024-13-01' })).status).toBe(400);
  });
});
