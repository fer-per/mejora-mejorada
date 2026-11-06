import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nombreDescarga, resolverRutaAbsoluta } from '../../src/modules/documentos/documentos.service.js';
import { normalizarClave, tipoContenidoPorExtension } from '../../src/config/almacenamiento.js';

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
