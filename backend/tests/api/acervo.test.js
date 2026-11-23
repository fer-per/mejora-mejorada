import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { consultar, reiniciarBaseDeDatos } from '../helpers/db.js';
import { api, conToken, obtenerToken } from '../helpers/api.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const RUTA_REPOSITORIO = path.resolve(process.cwd(), process.env.RUTA_REPOSITORIO ?? '../storage/repositorio');
const RAIZ = path.basename(RUTA_REPOSITORIO);
const SIGLO = 'SIGLO 99';
const ANIO = 2099;

let token;

function segmentos({ protocolo, registro, tipologia, mes, interesado, archivo }) {
  return [
    SIGLO,
    'FONDO DOCUMENTAL',
    'DIEGO DE AGUILAR',
    String(ANIO),
    `PROTOCOLO ${protocolo}`,
    `REGISTRO ${registro}`,
    tipologia,
    mes,
    interesado,
    archivo,
  ];
}

function rutaCompleta(partes) {
  return [RAIZ, ...partes].join('/');
}

function absoluta(partes) {
  return path.join(RUTA_REPOSITORIO, ...partes);
}

async function crearArchivo(partes, contenido = PDF) {
  const destino = absoluta(partes);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, contenido);
  return destino;
}

async function crearMetadatos(fila) {
  const respuesta = await conToken(
    api().post('/api/documentos/ingesta-masiva'),
    token,
  ).send({ filas: [fila] });

  expect(respuesta.status).toBe(201);
  const resultado = respuesta.body.resultados[0];
  expect(resultado.estado).toBe('creado');
  return resultado.id;
}

describe('ACV — Vinculación de archivos del acervo', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
    token = await obtenerToken('lmamani', 'Archivo123!');
  });

  afterAll(async () => {
    await fs.rm(path.join(RUTA_REPOSITORIO, SIGLO), { recursive: true, force: true });
  });

  it('valida una ruta de 11 niveles y detecta un vínculo único', async () => {
    const partes = segmentos({
      protocolo: 'PROTO-ACV-A',
      registro: 'REG-A',
      tipologia: 'PODER',
      mes: '5. MAYO',
      interesado: 'DIEGO DE ARAMBURU',
      archivo: 'escritura-a.pdf',
    });
    await crearArchivo(partes);
    const id = await crearMetadatos({
      fila: 1,
      id_fondo: 1,
      protocolo: 'PROTO-ACV-A',
      anio: ANIO,
      registro: 'REG-A',
      titulo: 'PODER',
      tipologia: 'PODER',
      mes: 5,
      interesados: [{ nombre: 'DIEGO DE ARAMBURU', rol: 'Interesado' }],
    });

    const respuesta = await conToken(
      api().post('/api/documentos/acervo/validar'),
      token,
    ).send({ archivos: [{ ruta: rutaCompleta(partes), tamanoBytes: PDF.length }] });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.vinculables).toBe(1);
    expect(respuesta.body.resultados[0]).toMatchObject({
      valido: true,
      estado: 'vinculable',
      existe: true,
      tamanoCoincide: true,
      candidato: { id, titulo: 'PODER' },
    });
  });

  it('escanea el repositorio y propone el mismo vínculo sin escribirlo', async () => {
    const respuesta = await conToken(
      api().post('/api/documentos/acervo/escanear'),
      token,
    ).send({});

    expect(respuesta.status).toBe(200);
    const propuesta = respuesta.body.actionables.find((item) =>
      item.ruta.endsWith('/escritura-a.pdf'),
    );
    expect(propuesta?.estado).toBe('vinculable');
    expect(propuesta?.ruta.startsWith(`${RAIZ}/`)).toBe(true);
  });

  it('vincula el archivo por ruta, guarda tamaño/formato y evita duplicados', async () => {
    const partes = segmentos({
      protocolo: 'PROTO-ACV-A',
      registro: 'REG-A',
      tipologia: 'PODER',
      mes: '5. MAYO',
      interesado: 'DIEGO DE ARAMBURU',
      archivo: 'escritura-a.pdf',
    });
    const ruta = rutaCompleta(partes);
    const rutaRelativa = partes.join('/');
    const { rows } = await consultar(
      `SELECT a.id FROM archivo a
         JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
        WHERE te.nombre = 'PODER' AND a.ruta_archivo IS NULL`,
    );
    const id = rows[0].id;

    const respuesta = await conToken(
      api().post('/api/documentos/acervo/vincular'),
      token,
    ).send({ asignaciones: [{ ruta, id_documento: id }] });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.vinculados).toBe(1);
    expect(respuesta.body.resultados[0]).toMatchObject({ estado: 'vinculado', id });

    const { rows: archivo } = await consultar(
      'SELECT ruta_archivo, nombre_original, tamano_bytes, formato FROM archivo WHERE id = $1',
      [id],
    );
    expect(archivo[0].ruta_archivo).toBe(rutaRelativa);
    expect(archivo[0].nombre_original).toBe('escritura-a.pdf');
    expect(Number(archivo[0].tamano_bytes)).toBe(PDF.length);
    expect(archivo[0].formato).toBe('PDF/A');

    const repetido = await conToken(
      api().post('/api/documentos/acervo/vincular'),
      token,
    ).send({ asignaciones: [{ ruta, id_documento: id }] });
    expect(repetido.body.resultados[0].estado).toBe('ya_registrado');
  });

  it('detecta archivos faltantes y permite subirlos a la ruta exacta', async () => {
    const partes = segmentos({
      protocolo: 'PROTO-ACV-B',
      registro: 'REG-B',
      tipologia: 'TESTAMENTO',
      mes: '6. JUNIO',
      interesado: 'ANA PEREZ',
      archivo: 'escritura-b.pdf',
    });
    const ruta = rutaCompleta(partes);
    const rutaRelativa = partes.join('/');
    const id = await crearMetadatos({
      fila: 1,
      id_fondo: 1,
      protocolo: 'PROTO-ACV-B',
      anio: ANIO,
      registro: 'REG-B',
      titulo: 'TESTAMENTO',
      tipologia: 'TESTAMENTO',
      mes: 6,
      interesados: [{ nombre: 'ANA PEREZ', rol: 'Interesado' }],
    });

    const validacion = await conToken(
      api().post('/api/documentos/acervo/validar'),
      token,
    ).send({ archivos: [{ ruta, tamanoBytes: PDF.length }] });
    expect(validacion.body.resultados[0]).toMatchObject({
      estado: 'no_existe',
      disponibleParaSubir: true,
      coincidencia: 'vinculable',
    });

    const subida = await conToken(api().post('/api/documentos/acervo/subir'), token)
      .field('ruta', ruta)
      .field('id_documento', String(id))
      .attach('archivo', PDF, { filename: 'escritura-b.pdf', contentType: 'application/pdf' });

    expect(subida.status).toBe(201);
    expect(subida.body.documento).toMatchObject({ id, ruta: rutaRelativa, formato: 'PDF/A' });
    await expect(fs.stat(absoluta(partes))).resolves.toBeTruthy();

    const { rows } = await consultar('SELECT ruta_archivo FROM archivo WHERE id = $1', [id]);
    expect(rows[0].ruta_archivo).toBe(rutaRelativa);
  });

  it('crea un documento con ruta existente sin volver a escribir el archivo', async () => {
    const partes = segmentos({
      protocolo: 'PROTO-ACV-C',
      registro: 'REG-C',
      tipologia: 'CARTA',
      mes: '7. JULIO',
      interesado: 'JUAN DE LA CRUZ',
      archivo: 'escritura-c.pdf',
    });
    const destino = await crearArchivo(partes);
    const antes = await fs.stat(destino);

    const respuesta = await conToken(api().post('/api/documentos'), token)
      .field('id_fondo', '1')
      .field('protocolo', 'PROTO-ACV-C')
      .field('anio', String(ANIO))
      .field('registro', 'REG-C')
      .field('titulo', 'CARTA')
      .field('tipologia', 'CARTA')
      .field('ruta_relativa', rutaCompleta(partes));

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.documento).toMatchObject({
      titulo: 'CARTA',
      formato: 'PDF/A',
      tamanoBytes: antes.size,
    });

    const despues = await fs.stat(destino);
    expect(despues.size).toBe(antes.size);
  });

  it('crea un documento nuevo con su PDF en la ruta exacta de 11 niveles', async () => {
    const partes = segmentos({
      protocolo: 'PROTO-ACV-F',
      registro: 'REG-F',
      tipologia: 'COMPRA',
      mes: '9. SEPTIEMBRE',
      interesado: 'PEDRO DE VALENCIA',
      archivo: 'escritura-f.pdf',
    });

    const respuesta = await conToken(api().post('/api/documentos'), token)
      .field('id_fondo', '1')
      .field('protocolo', 'PROTO-ACV-F')
      .field('anio', String(ANIO))
      .field('registro', 'REG-F')
      .field('titulo', 'COMPRA')
      .field('tipologia', 'COMPRA')
      .field('mes', '9')
      .field('ruta_relativa', rutaCompleta(partes))
      .attach('archivo', PDF, { filename: 'escritura-f.pdf', contentType: 'application/pdf' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.documento).toMatchObject({
      titulo: 'COMPRA',
      formato: 'PDF/A',
      tamanoBytes: PDF.length,
      digitalizado: true,
    });

    const destino = absoluta(partes);
    await expect(fs.stat(destino)).resolves.toBeTruthy();
    const { rows } = await consultar(
      `SELECT a.ruta_archivo, a.nombre_original, a.tamano_bytes, a.formato
         FROM archivo a
         JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
        WHERE te.nombre = 'COMPRA'`,
    );
    expect(rows[0]).toMatchObject({
      ruta_archivo: partes.join('/'),
      nombre_original: 'escritura-f.pdf',
      formato: 'PDF/A',
    });
    expect(Number(rows[0].tamano_bytes)).toBe(PDF.length);
  });

  it('rechaza rutas inválidas y archivos inexistentes al crear', async () => {
    const invalida = await conToken(api().post('/api/documentos'), token)
      .field('id_fondo', '1')
      .field('protocolo', 'PROTO-ACV-D')
      .field('anio', String(ANIO))
      .field('registro', 'REG-D')
      .field('titulo', 'MAL')
      .field('tipologia', 'MAL')
      .field('ruta_relativa', `${RAIZ}/SIGLO 99/../../fuera.pdf`);
    expect(invalida.status).toBe(400);

    const inexistente = await conToken(api().post('/api/documentos'), token)
      .field('id_fondo', '1')
      .field('protocolo', 'PROTO-ACV-E')
      .field('anio', String(ANIO))
      .field('registro', 'REG-E')
      .field('titulo', 'FALTA')
      .field('tipologia', 'FALTA')
      .field(
        'ruta_relativa',
        rutaCompleta(
          segmentos({
            protocolo: 'PROTO-ACV-E',
            registro: 'REG-E',
            tipologia: 'FALTA',
            mes: '8. AGOSTO',
            interesado: 'PEDRO',
            archivo: 'no-existe.pdf',
          }),
        ),
      );
    expect(inexistente.status).toBe(400);
  });
});
