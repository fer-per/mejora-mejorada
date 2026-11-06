import { describe, expect, it } from 'vitest';
import { esquemaLogin } from '../../src/modules/auth/auth.schema.js';
import {
  esquemaBusquedaAvanzada,
  esquemaBusquedaSimple,
  esquemaId,
} from '../../src/modules/documentos/documentos.schema.js';

describe('esquemaLogin', () => {
  it('acepta credenciales válidas', () => {
    const resultado = esquemaLogin.safeParse({ usuario: 'anaquispe', contrasena: 'Admin123!' });
    expect(resultado.success).toBe(true);
  });

  it('recorta espacios del usuario', () => {
    const resultado = esquemaLogin.safeParse({ usuario: '  anaquispe  ', contrasena: 'x' });
    expect(resultado.success).toBe(true);
    expect(resultado.data.usuario).toBe('anaquispe');
  });

  it('rechaza usuario vacío o menor de 3 caracteres', () => {
    expect(esquemaLogin.safeParse({ usuario: '', contrasena: 'x' }).success).toBe(false);
    expect(esquemaLogin.safeParse({ usuario: 'ab', contrasena: 'x' }).success).toBe(false);
  });

  it('acepta el límite de 3 y 150 caracteres del usuario', () => {
    expect(esquemaLogin.safeParse({ usuario: 'abc', contrasena: 'x' }).success).toBe(true);
    expect(esquemaLogin.safeParse({ usuario: 'a'.repeat(150), contrasena: 'x' }).success).toBe(true);
    expect(esquemaLogin.safeParse({ usuario: 'a'.repeat(151), contrasena: 'x' }).success).toBe(false);
  });

  it('rechaza contraseña vacía y mayor de 128 caracteres', () => {
    expect(esquemaLogin.safeParse({ usuario: 'usuario', contrasena: '' }).success).toBe(false);
    expect(esquemaLogin.safeParse({ usuario: 'usuario', contrasena: 'x'.repeat(128) }).success).toBe(true);
    expect(esquemaLogin.safeParse({ usuario: 'usuario', contrasena: 'x'.repeat(129) }).success).toBe(false);
  });
});

describe('esquemaId', () => {
  it('acepta enteros positivos', () => {
    expect(esquemaId.safeParse({ id: '1' }).success).toBe(true);
    expect(esquemaId.safeParse({ id: 25 }).success).toBe(true);
  });

  it('rechaza cero, negativos y no numéricos', () => {
    expect(esquemaId.safeParse({ id: '0' }).success).toBe(false);
    expect(esquemaId.safeParse({ id: '-1' }).success).toBe(false);
    expect(esquemaId.safeParse({ id: 'abc' }).success).toBe(false);
  });
});

describe('esquemaBusquedaSimple', () => {
  const base = { q: 'aguas' };

  it('acepta una consulta mínima y aplica valores por defecto', () => {
    const resultado = esquemaBusquedaSimple.safeParse(base);
    expect(resultado.success).toBe(true);
    expect(resultado.data.pagina).toBe(1);
    expect(resultado.data.por_pagina).toBe(10);
    expect(resultado.data.orden).toBe('relevancia');
  });

  it('rechaza consulta ausente, vacía o de solo espacios', () => {
    expect(esquemaBusquedaSimple.safeParse({}).success).toBe(false);
    expect(esquemaBusquedaSimple.safeParse({ q: '' }).success).toBe(false);
    expect(esquemaBusquedaSimple.safeParse({ q: '   ' }).success).toBe(false);
  });

  it('respeta el límite de 200 caracteres', () => {
    expect(esquemaBusquedaSimple.safeParse({ q: 'a'.repeat(200) }).success).toBe(true);
    expect(esquemaBusquedaSimple.safeParse({ q: 'a'.repeat(201) }).success).toBe(false);
  });

  it('respeta los límites de paginación 1 y 50', () => {
    expect(esquemaBusquedaSimple.safeParse({ ...base, pagina: '1', por_pagina: '1' }).success).toBe(true);
    expect(esquemaBusquedaSimple.safeParse({ ...base, por_pagina: '50' }).success).toBe(true);
    expect(esquemaBusquedaSimple.safeParse({ ...base, por_pagina: '51' }).success).toBe(false);
    expect(esquemaBusquedaSimple.safeParse({ ...base, por_pagina: '0' }).success).toBe(false);
    expect(esquemaBusquedaSimple.safeParse({ ...base, pagina: '0' }).success).toBe(false);
  });

  it('rechaza un orden no admitido', () => {
    expect(esquemaBusquedaSimple.safeParse({ ...base, orden: 'relevancia' }).success).toBe(true);
    expect(esquemaBusquedaSimple.safeParse({ ...base, orden: 'fecha' }).success).toBe(true);
    expect(esquemaBusquedaSimple.safeParse({ ...base, orden: 'antiguo' }).success).toBe(true);
    expect(esquemaBusquedaSimple.safeParse({ ...base, orden: 'titulo' }).success).toBe(true);
    expect(esquemaBusquedaSimple.safeParse({ ...base, orden: 'aleatorio' }).success).toBe(false);
  });
});

describe('esquemaBusquedaAvanzada', () => {
  it('exige al menos un criterio', () => {
    expect(esquemaBusquedaAvanzada.safeParse({}).success).toBe(false);
    expect(esquemaBusquedaAvanzada.safeParse({ pagina: '1' }).success).toBe(false);
    expect(esquemaBusquedaAvanzada.safeParse({ texto: 'cabildo' }).success).toBe(true);
    expect(esquemaBusquedaAvanzada.safeParse({ fondo: '1' }).success).toBe(true);
    expect(esquemaBusquedaAvanzada.safeParse({ serie: 'Actas de cabildo' }).success).toBe(true);
    expect(esquemaBusquedaAvanzada.safeParse({ tipologia: 'Testimonio' }).success).toBe(true);
    expect(esquemaBusquedaAvanzada.safeParse({ conservacion: 'Bueno' }).success).toBe(true);
  });

  it('valida el formato de las fechas', () => {
    expect(esquemaBusquedaAvanzada.safeParse({ fecha_desde: '1848-01-01' }).success).toBe(true);
    expect(esquemaBusquedaAvanzada.safeParse({ fecha_desde: '2024/01/01' }).success).toBe(false);
    expect(esquemaBusquedaAvanzada.safeParse({ fecha_desde: '1848-1-1' }).success).toBe(false);
  });

  it('rechaza un rango de fechas invertido', () => {
    const resultado = esquemaBusquedaAvanzada.safeParse({
      fecha_desde: '1900-01-01',
      fecha_hasta: '1850-01-01',
    });
    expect(resultado.success).toBe(false);
  });

  it('rechaza fondo no numérico o no positivo', () => {
    expect(esquemaBusquedaAvanzada.safeParse({ fondo: 'abc' }).success).toBe(false);
    expect(esquemaBusquedaAvanzada.safeParse({ fondo: '0' }).success).toBe(false);
    expect(esquemaBusquedaAvanzada.safeParse({ fondo: '-3' }).success).toBe(false);
  });

  it('rechaza un estado de conservación no admitido', () => {
    expect(esquemaBusquedaAvanzada.safeParse({ conservacion: 'Excelente' }).success).toBe(false);
    expect(esquemaBusquedaAvanzada.safeParse({ conservacion: 'Malo' }).success).toBe(true);
  });

  it('trata los valores vacíos como criterios ausentes', () => {
    expect(esquemaBusquedaAvanzada.safeParse({ texto: '', fondo: '', serie: '' }).success).toBe(false);
    expect(esquemaBusquedaAvanzada.safeParse({ texto: '   ' }).success).toBe(false);
  });

  it('respeta por_pagina 50 y rechaza 51', () => {
    expect(esquemaBusquedaAvanzada.safeParse({ texto: 'agua', por_pagina: '50' }).success).toBe(true);
    expect(esquemaBusquedaAvanzada.safeParse({ texto: 'agua', por_pagina: '51' }).success).toBe(false);
  });

  it('respeta el límite de 200 caracteres del texto', () => {
    expect(esquemaBusquedaAvanzada.safeParse({ texto: 'a'.repeat(200) }).success).toBe(true);
    expect(esquemaBusquedaAvanzada.safeParse({ texto: 'a'.repeat(201) }).success).toBe(false);
  });
});
