import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autorizar, PERFILES, todosPerfiles } from '../../src/middlewares/authorize.js';
import { limitarIntentos, reiniciarLimiteIntentos } from '../../src/middlewares/rate-limit.js';
import { manejarErrores } from '../../src/middlewares/error-handler.js';
import { AppError } from '../../src/common/errors.js';
import { config } from '../../src/config/env.js';

function respuestaFalsa() {
  const capturada = { estado: null, cuerpo: null };
  const res = {
    headersSent: false,
    status(codigo) {
      capturada.estado = codigo;
      return res;
    },
    json(cuerpo) {
      capturada.cuerpo = cuerpo;
      return res;
    },
  };
  return { res, capturada };
}

describe('middleware autorizar', () => {
  it('deja pasar a un perfil permitido', () => {
    const siguiente = vi.fn();
    const req = { usuario: { perfil: PERFILES.ADMINISTRADOR } };
    autorizar(...todosPerfiles)(req, {}, siguiente);
    expect(siguiente).toHaveBeenCalledWith();
  });

  it('rechaza un perfil no autorizado', () => {
    const siguiente = vi.fn();
    const req = { usuario: { perfil: PERFILES.USUARIO_EXTERNO } };
    autorizar(PERFILES.ADMINISTRADOR)(req, {}, siguiente);
    const error = siguiente.mock.calls[0][0];
    expect(error.estado).toBe(403);
    expect(error.codigo).toBe('PERFIL_NO_AUTORIZADO');
  });

  it('rechaza una petición sin usuario autenticado', () => {
    const siguiente = vi.fn();
    autorizar(...todosPerfiles)({}, {}, siguiente);
    const error = siguiente.mock.calls[0][0];
    expect(error.estado).toBe(401);
    expect(error.codigo).toBe('TOKEN_INVALIDO');
  });
});

describe('middleware limitarIntentos', () => {
  beforeEach(() => reiniciarLimiteIntentos());

  it('permite hasta 10 intentos por IP en la ventana', () => {
    const req = { ip: '10.0.0.1' };
    for (let i = 0; i < 10; i += 1) {
      const siguiente = vi.fn();
      limitarIntentos(req, {}, siguiente);
      expect(siguiente).toHaveBeenCalledWith();
    }
  });

  it('bloquea el intento 11 con error 429', () => {
    const req = { ip: '10.0.0.2' };
    for (let i = 0; i < 10; i += 1) {
      limitarIntentos(req, {}, vi.fn());
    }
    const siguiente = vi.fn();
    limitarIntentos(req, {}, siguiente);
    const error = siguiente.mock.calls[0][0];
    expect(error.estado).toBe(429);
    expect(error.codigo).toBe('DEMASIADOS_INTENTOS');
  });

  it('mantiene ventanas independientes por IP', () => {
    for (let i = 0; i < 11; i += 1) {
      limitarIntentos({ ip: '10.0.0.3' }, {}, vi.fn());
    }
    const siguiente = vi.fn();
    limitarIntentos({ ip: '10.0.0.4' }, {}, siguiente);
    expect(siguiente).toHaveBeenCalledWith();
  });
});

describe('manejarErrores', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('no incluye la pila en producción', () => {
    const anterior = config.esProduccion;
    config.esProduccion = true;
    try {
      const { res, capturada } = respuestaFalsa();
      manejarErrores(new AppError('Fallo de prueba', 500, 'ERROR_INTERNO'), {}, res, vi.fn());
      expect(capturada.estado).toBe(500);
      expect(capturada.cuerpo.error.codigo).toBe('ERROR_INTERNO');
      expect(capturada.cuerpo.error).not.toHaveProperty('pila');
    } finally {
      config.esProduccion = anterior;
    }
  });

  it('mapea el error de unicidad de PostgreSQL a 409', () => {
    const { res, capturada } = respuestaFalsa();
    const error = Object.assign(new Error('duplicado'), { code: '23505' });
    manejarErrores(error, {}, res, vi.fn());
    expect(capturada.estado).toBe(409);
    expect(capturada.cuerpo.error.codigo).toBe('REGISTRO_DUPLICADO');
  });

  it('mapea el error de conexión a base de datos a 503', () => {
    const { res, capturada } = respuestaFalsa();
    const error = Object.assign(new Error('sin conexión'), { code: 'ECONNREFUSED' });
    manejarErrores(error, {}, res, vi.fn());
    expect(capturada.estado).toBe(503);
    expect(capturada.cuerpo.error.codigo).toBe('BASE_DE_DATOS_NO_DISPONIBLE');
  });
});
