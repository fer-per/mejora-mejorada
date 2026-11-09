import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nombreDescarga, resolverRutaAbsoluta } from '../../src/modules/documentos/documentos.service.js';
import { normalizarClave, tipoContenidoPorExtension } from '../../src/config/almacenamiento.js';
import { tituloDesdeNombre, validarArchivoDigital } from '../../src/common/archivos.js';

describe('resolverRutaAbsoluta', () => {
  it('resuelve una ruta relativa dentro del repositorio', () => {
    const resultado = resolverRutaAbsoluta(path.join('fondo-cabildo', 'P-1848', '1848', 'titulo-01.pdf'));
    expect(resultado).toContain('storage');
    expect(resultado).toContain('titulo-01.pdf');
  });

  it('rechaza rutas que escapan del repositorio con ../', () => {
    expect(() => resolverRutaAbsoluta('../../etc/passwd')).toThrowError(/ubicación del archivo/i);
    expect(() => resolverRutaAbsoluta('..')).toThrowError(/ubicación del archivo/i);
  });
});

describe('nombreDescarga', () => {
  it('elimina tildes, espacios y caracteres especiales', () => {
    const nombre = nombreDescarga('Acta de Sesión / N° 1', 'pdf');
    expect(nombre).toBe('Acta-de-Sesion-N-1.pdf');
  });

  it('usa un nombre por defecto cuando el título queda vacío', () => {
    expect(nombreDescarga('///', 'tif')).toBe('documento.tif');
  });
});

describe('validarArchivoDigital', () => {
  const pdf = Buffer.from('%PDF-1.7 contenido');
  const tiffLe = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x00]);
  const tiffBe = Buffer.from([0x4d, 0x4d, 0x00, 0x2a, 0x00]);

  it('acepta PDF y TIFF por su firma', () => {
    expect(validarArchivoDigital({ buffer: pdf, nombreOriginal: 'a.pdf', tipoMime: 'application/pdf' })).toMatchObject({
      formato: 'PDF/A',
      extension: 'pdf',
    });
    expect(validarArchivoDigital({ buffer: tiffLe, nombreOriginal: 'a.tif', tipoMime: 'image/tiff' }).formato).toBe('TIFF');
    expect(validarArchivoDigital({ buffer: tiffBe, nombreOriginal: 'a.tiff', tipoMime: 'image/tiff' }).formato).toBe('TIFF');
  });

  it('rechaza extensiones no permitidas', () => {
    expect(() =>
      validarArchivoDigital({ buffer: pdf, nombreOriginal: 'a.jpg', tipoMime: 'image/jpeg' }),
    ).toThrowError(/Solo se admiten/);
  });

  it('rechaza archivos cuya firma no coincide', () => {
    expect(() =>
      validarArchivoDigital({ buffer: Buffer.from('texto'), nombreOriginal: 'a.pdf', tipoMime: 'application/pdf' }),
    ).toThrowError(/firma PDF/);
    expect(() =>
      validarArchivoDigital({ buffer: pdf, nombreOriginal: 'a.tif', tipoMime: 'image/tiff' }),
    ).toThrowError(/firma TIFF/);
  });

  it('rechaza archivos vacíos', () => {
    expect(() =>
      validarArchivoDigital({ buffer: Buffer.alloc(0), nombreOriginal: 'a.pdf', tipoMime: 'application/pdf' }),
    ).toThrowError(/vacío/);
  });
});

describe('tituloDesdeNombre', () => {
  it('quita la extensión y usa un valor por defecto', () => {
    expect(tituloDesdeNombre('acta-de-cabildo.pdf')).toBe('acta-de-cabildo');
    expect(tituloDesdeNombre('')).toBe('Documento sin título');
  });
});

describe('utilidades de almacenamiento', () => {
  it('normaliza separadores y barras iniciales', () => {
    expect(normalizarClave('\\miniaturas\\titulo-01.png')).toBe('miniaturas/titulo-01.png');
    expect(normalizarClave('/fondo-cabildo/titulo.pdf')).toBe('fondo-cabildo/titulo.pdf');
  });

  it('asigna el tipo de contenido según la extensión', () => {
    expect(tipoContenidoPorExtension('documento.pdf')).toBe('application/pdf');
    expect(tipoContenidoPorExtension('documento.tif')).toBe('image/tiff');
    expect(tipoContenidoPorExtension('documento.tiff')).toBe('image/tiff');
    expect(tipoContenidoPorExtension('miniatura.png')).toBe('image/png');
    expect(tipoContenidoPorExtension('foto.jpg')).toBe('image/jpeg');
    expect(tipoContenidoPorExtension('archivo.bin')).toBe('application/octet-stream');
  });
});
