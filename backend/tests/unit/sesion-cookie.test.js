import { describe, expect, it } from 'vitest';
import {
  NOMBRE_COOKIE_SESION,
  extraerToken,
  leerCookie,
} from '../../src/modules/auth/sesion-cookie.js';

describe('sesion-cookie', () => {
  it('lee la cookie de sesión entre otras cookies', () => {
    const req = {
      headers: { cookie: `tema=oscuro; ${NOMBRE_COOKIE_SESION}=abc.def.ghi; otra=1` },
    };
    expect(leerCookie(req, NOMBRE_COOKIE_SESION)).toBe('abc.def.ghi');
  });

  it('prefiere la cookie y cae a Bearer', () => {
    expect(extraerToken({ headers: { cookie: `${NOMBRE_COOKIE_SESION}=desde-cookie` } })).toBe(
      'desde-cookie',
    );
    expect(extraerToken({ headers: { authorization: 'Bearer desde-header' } })).toBe(
      'desde-header',
    );
    expect(extraerToken({ headers: {} })).toBeNull();
  });

  it('ignora esquemas distintos de Bearer', () => {
    expect(extraerToken({ headers: { authorization: 'Basic xyz' } })).toBeNull();
  });
});
