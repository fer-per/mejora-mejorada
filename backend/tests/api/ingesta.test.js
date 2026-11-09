import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { consultar, reiniciarBaseDeDatos } from '../helpers/db.js';
import { api, conToken, obtenerToken } from '../helpers/api.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const TIFF = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
const RUTA_REPOSITORIO = path.resolve(process.cwd(), process.env.RUTA_REPOSITORIO ?? '../storage/repositorio');
const ANIO_PRUEBA = 2099;

let tokenArchivista;
let tokenExterno;

const METADATOS = {
  id_fondo: '1',
  protocolo: 'P-TEST',
  anio: String(ANIO_PRUEBA),
  registro: 'R-001',
  tipologia: 'Testimonio',
  serie: 'Protocolos notariales',
  estado_conservacion: 'Bueno',
  fecha_produccion: '1900-01-15',
};

function ingesta(archivo, metadatos = METADATOS, token = tokenArchivista) {
  let peticion = conToken(api().post('/api/documentos'), token);
  for (const [campo, valor] of Object.entries(metadatos)) {
    peticion = peticion.field(campo, valor);
  }
  if (archivo) {
    peticion = peticion.attach('archivo', archivo.buffer, {
      filename: archivo.nombre,
      contentType: archivo.tipo,
    });
  }
  return peticion;
}

function pdf(nombre = 'escritura.pdf') {
  return { buffer: PDF, nombre, tipo: 'application/pdf' };
}

function tiff(nombre = 'escritura.tif') {
  return { buffer: TIFF, nombre, tipo: 'image/tiff' };
}

describe('ING · Ingesta documental', () => {
  beforeAll(async () => {
    await reiniciarBaseDeDatos();
    tokenArchivista = await obtenerToken('lmamani', 'Archivo123!');
    tokenExterno = await obtenerToken('cflores', 'Consulta123!');
  });

  afterAll(async () => {
    await fs.promises.rm(path.join(RUTA_REPOSITORIO, 'ingesta', String(ANIO_PRUEBA)), {
      recursive: true,
      force: true,
    });
  });

  it('ING-01 carga un PDF/A y registra ruta, fecha y usuario', async () => {
    const respuesta = await ingesta(pdf(), { ...METADATOS, titulo: 'Escritura de prueba PDF' });

    expect(respuesta.status).toBe(201);
    const documento = respuesta.body.documento;
    expect(documento.titulo).toBe('Escritura de prueba PDF');
    expect(documento.formato).toBe('PDF/A');
    expect(documento.tamanoBytes).toBe(PDF.length);
    expect(documento.usuarioCarga).toBe('lmamani');
    expect(documento.fechaCarga).toBeTruthy();

    const { rows } = await consultar(
      `SELECT a.ruta_archivo, a.nombre_original, a.tamano_bytes, a.id_usuario_carga,
              a.fecha_carga, te.nombre
         FROM archivo a
         JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
        WHERE a.id = $1`,
      [documento.id],
    );
    const fila = rows[0];
    expect(fila.ruta_archivo).toMatch(/^ingesta\/2099\/.+\.pdf$/);
    expect(fila.nombre_original).toBe('escritura.pdf');
    expect(Number(fila.tamano_bytes)).toBe(PDF.length);
    expect(fila.id_usuario_carga).toBe(2);
    expect(fila.fecha_carga).toBeInstanceOf(Date);
    expect(fs.existsSync(path.join(RUTA_REPOSITORIO, fila.ruta_archivo))).toBe(true);
  });

  it('ING-02 carga un TIFF válido', async () => {
    const respuesta = await ingesta(tiff(), {
      ...METADATOS,
      titulo: 'Escritura de prueba TIFF',
      registro: 'R-002',
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.documento.formato).toBe('TIFF');
    expect(respuesta.body.documento.tamanoBytes).toBe(TIFF.length);
  });

  it('ING-03 rechaza un formato no permitido', async () => {
    const respuesta = await ingesta({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      nombre: 'fotografia.jpg',
      tipo: 'image/jpeg',
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('ARCHIVO_INVALIDO');
  });

  it('ING-04 rechaza un archivo dañado con extensión válida', async () => {
    const respuesta = await ingesta({
      buffer: Buffer.from('esto no es un pdf'),
      nombre: 'danado.pdf',
      tipo: 'application/pdf',
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('ARCHIVO_INVALIDO');
  });

  it('ING-06 genera el título y los metadatos automáticos', async () => {
    const respuesta = await ingesta(pdf('acta-de-cabildo.pdf'), {
      ...METADATOS,
      registro: 'R-003',
      titulo: '',
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.documento.titulo).toBe('acta-de-cabildo');
    expect(respuesta.body.documento.formato).toBe('PDF/A');
    expect(respuesta.body.documento.nombreOriginal).toBe('acta-de-cabildo.pdf');
    expect(respuesta.body.documento.tamanoBytes).toBe(PDF.length);
  });

  it('ING-08 rechaza la carga con campos obligatorios incompletos', async () => {
    const respuesta = await ingesta(pdf(), { ...METADATOS, tipologia: '', registro: 'R-004' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION_INVALIDA');
  });

  it('ING-09 rechaza el acceso directo al archivo sin autenticación', async () => {
    const respuesta = await api().get('/api/documentos/1/archivo');
    expect(respuesta.status).toBe(401);
  });

  it('ING-10 permite la carga al administrador', async () => {
    const tokenAdmin = await obtenerToken();
    const respuesta = await ingesta(pdf(), { ...METADATOS, registro: 'R-005' }, tokenAdmin);
    expect(respuesta.status).toBe(201);
  });

  it('ING-11 rechaza la ingesta a un usuario externo', async () => {
    const respuesta = await ingesta(pdf(), { ...METADATOS, registro: 'R-006' }, tokenExterno);
    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.codigo).toBe('PERFIL_NO_AUTORIZADO');
  });

  it('ING-12 registra la carga en auditoría', async () => {
    const { rows } = await consultar(
      "SELECT descripcion FROM registro_auditoria WHERE tipo_accion = 'CARGA_DOCUMENTO' ORDER BY id DESC LIMIT 1",
    );
    expect(rows[0].descripcion).toMatch(/CARGA|Carga/);
    expect(rows[0].descripcion).toMatch(/bytes/);
  });
});
