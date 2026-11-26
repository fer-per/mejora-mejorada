import { describe, expect, it } from 'vitest';
import {
  normalizarFicha,
  normalizarResultado,
  normalizarResumen,
} from '../src/services/normalizadores.js';

describe('normalizadores', () => {
  it('normaliza un resumen con código, folios y descriptores', () => {
    const resumen = normalizarResumen({
      id: 7,
      registro: 'REG-001',
      titulo: 'Acta',
      tipologia: 'Acta',
      folios: 3,
      descriptores: 'agua, cabildo, , riego',
      formato: 'PDF/A',
    });

    expect(resumen.codigo).toBe('ARC-REG-001');
    expect(resumen.folios).toBe('3');
    expect(resumen.descriptores).toEqual(['agua', 'cabildo', 'riego']);
    expect(resumen.archivo_url).toBe('/api/documentos/7/archivo');
    expect(resumen.digitalizado).toBe(false);
  });

  it('usa el id con relleno cuando no hay registro', () => {
    const resumen = normalizarResumen({ id: 12, titulo: 'Sin registro' });

    expect(resumen.codigo).toBe('ARC-00000012');
  });

  it('normaliza la ficha y convierte descriptores a texto', () => {
    const ficha = normalizarFicha({
      id: 1,
      titulo: 'Documento',
      descriptores: ['agua', 'cabildo'],
      interesados: null,
    });

    expect(ficha.descriptoresTexto).toBe('agua, cabildo');
    expect(ficha.interesados).toEqual([]);
  });

  it('calcula el número de páginas del resultado', () => {
    expect(normalizarResultado({ total: 25, porPagina: 10 }).paginas).toBe(3);
    expect(normalizarResultado({}).paginas).toBe(0);
  });
});
