import { errores } from '../common/errors.js';

const VENTANA_MS = 5 * 60 * 1000;
const MAXIMO_POR_IP = 10;
const intentos = new Map();

export function limitarIntentos(req, res, next) {
  const ahora = Date.now();
  const clave = req.ip || 'desconocida';
  const registro = intentos.get(clave);

  if (!registro || ahora - registro.inicio > VENTANA_MS) {
    intentos.set(clave, { inicio: ahora, cantidad: 1 });
    return next();
  }

  registro.cantidad += 1;
  if (registro.cantidad > MAXIMO_POR_IP) {
    return next(errores.demasiadosIntentos());
  }
  return next();
}

export function reiniciarLimiteIntentos() {
  intentos.clear();
}

setInterval(() => {
  const ahora = Date.now();
  for (const [clave, registro] of intentos) {
    if (ahora - registro.inicio > VENTANA_MS) {
      intentos.delete(clave);
    }
  }
}, VENTANA_MS).unref();
