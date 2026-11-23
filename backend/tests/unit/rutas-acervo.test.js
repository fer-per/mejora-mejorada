import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatoDesdeExtension,
  resolverRutaAcervo,
  validarRutaAcervo,
} from '../../src/modules/documentos/rutas-acervo.js';

const RAIZ = 'ACERVO DOCUMENTAL NUMERO 7';

function ruta(segmentos) {
  return [RAIZ, ...segmentos].join('/');
}

const VALIDA = [
  'SIGLO 16',
  'FONDO DOCUMENTAL',
  'DIEGO DE AGUILAR',
  '1567',
  'PROTOCOLO 1',
  'REGISTRO 1',
  'PODER',
  '5. MAYO',
  'DIEGO DE ARAMBURU',
  'PEDRO LOPE DE CAZALLA.pdf',
];

describe('validarRutaAcervo', () => {
  it('acepta los 11 niveles incluyendo la raíz y devuelve los 10 relativos', () => {
    const resultado = validarRutaAcervo(ruta(VALIDA), { raiz: RAIZ });

    expect(resultado.valido).toBe(true);
    expect(resultado.rutaRelativa).toBe(VALIDA.join('/'));
    expect(resultado).toMatchObject({
      anio: 1567,
      protocolo: '1',
      registro: '1',
      tipologia: 'PODER',
      mes: 5,
      interesado: 'DIEGO DE ARAMBURU',
      formato: 'PDF/A',
    });
  });

  it('acepta 10 niveles relativos cuando se valida un escaneo del servidor', () => {
    const resultado = validarRutaAcervo(VALIDA.join('/'), { incluirRaiz: false });

    expect(resultado.valido).toBe(true);
    expect(resultado.rutaRelativa).toBe(VALIDA.join('/'));
  });

  it('acepta separadores Windows y valores especiales del acervo', () => {
    const especial = [
      'SIGLO 16',
      'FONDO DOCUMENTAL',
      'DIEGO DE AGUILAR',
      'SIN AÑO',
      'PROTOCOLO 10',
      'SIN REGISTRO',
      'SIN TITULO DE ESCRITURA',
      'SIN MES',
      'DATOS DE LOS INTERESADOS ILEGIBLES',
      'SIN TITULO DE ESCRITURA_2.pdf',
    ];
    const resultado = validarRutaAcervo(ruta(especial).replace(/\//g, '\\'), { raiz: RAIZ });

    expect(resultado.valido).toBe(true);
    expect(resultado.anio).toBeNull();
    expect(resultado.mes).toBeNull();
    expect(resultado.registro).toBeNull();
  });

  it('rechaza una ruta sin la carpeta raíz cuando incluye raíz', () => {
    const resultado = validarRutaAcervo(VALIDA.join('/'), { raiz: RAIZ });

    expect(resultado.valido).toBe(false);
    expect(resultado.errores[0]).toMatch(/11 niveles/);
  });

  it('rechaza una raíz distinta y niveles de más o de menos', () => {
    const otraRaiz = validarRutaAcervo(['OTRA RAIZ', ...VALIDA].join('/'), { raiz: RAIZ });
    const deMas = validarRutaAcervo(ruta([...VALIDA, 'extra.pdf']), { raiz: RAIZ });
    const deMenos = validarRutaAcervo(ruta(VALIDA.slice(0, -1)), { raiz: RAIZ });

    expect(otraRaiz.valido).toBe(false);
    expect(deMas.valido).toBe(false);
    expect(deMenos.valido).toBe(false);
  });

  it('rechaza traversal, rutas absolutas y rutas UNC', () => {
    expect(validarRutaAcervo(ruta(['..', ...VALIDA.slice(1)]), { raiz: RAIZ }).valido).toBe(false);
    expect(validarRutaAcervo(`C:/${ruta(VALIDA)}`, { raiz: RAIZ }).valido).toBe(false);
    expect(validarRutaAcervo(`\\\\servidor\\${ruta(VALIDA)}`, { raiz: RAIZ }).valido).toBe(false);
  });

  it('rechaza años, meses, protocolos y extensiones inválidas', () => {
    const anio = [...VALIDA];
    const mes = [...VALIDA];
    const protocolo = [...VALIDA];
    const extension = [...VALIDA];

    anio[3] = '15';
    mes[7] = '13. MAYO';
    protocolo[4] = 'PROTOCOLO';
    extension[9] = 'PEDRO LOPE DE CAZALLA.jpg';

    for (const segmentos of [anio, mes, protocolo, extension]) {
      expect(validarRutaAcervo(ruta(segmentos), { raiz: RAIZ }).valido).toBe(false);
    }
  });

  it('rechaza nombres de archivo con ruta interna o caracteres inválidos', () => {
    const interno = [...VALIDA];
    const invalido = [...VALIDA];
    interno[9] = 'carpeta/archivo.pdf';
    invalido[8] = 'INTERESADO<1>';

    expect(validarRutaAcervo(ruta(interno), { raiz: RAIZ }).valido).toBe(false);
    expect(validarRutaAcervo(ruta(invalido), { raiz: RAIZ }).valido).toBe(false);
  });
});

describe('resolverRutaAcervo', () => {
  const base = path.resolve('storage', 'repositorio-prueba');

  it('resuelve una ruta relativa dentro de la base', () => {
    const resultado = resolverRutaAcervo(VALIDA.join('/'), base);
    expect(resultado.startsWith(base)).toBe(true);
  });

  it('rechaza rutas que escapan de la base', () => {
    expect(() => resolverRutaAcervo('../../fuera.pdf', base)).toThrowError(/ubicación/i);
    expect(() => resolverRutaAcervo('..', base)).toThrowError(/ubicación/i);
  });
});

describe('formatoDesdeExtension', () => {
  it('reconoce PDF y TIFF y rechaza otras extensiones', () => {
    expect(formatoDesdeExtension('a.pdf')).toBe('PDF/A');
    expect(formatoDesdeExtension('a.TIF')).toBe('TIFF');
    expect(formatoDesdeExtension('a.jpeg')).toBeNull();
  });
});
