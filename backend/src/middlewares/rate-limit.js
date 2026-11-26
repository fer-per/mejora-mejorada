import { errores } from '../common/errors.js';

const VENTANA_MS = 5 * 60 * 1000;
const MAX_POR_USUARIO = 10;
const MAX_POR_IP = 100;
const porUsuario = new Map();
const porIp = new Map();

function contar(mapa, clave, maximo, ahora) {
  const registro = mapa.get(clave);
  if (!registro || ahora - registro.inicio > VENTANA_MS) {
    mapa.set(clave, { inicio: ahora, cantidad: 1 });
    return true;
  }
  registro.cantidad += 1;
  return registro.cantidad <= maximo;
}

export function limitarIntentos(req, res, next) {
  const ahora = Date.now();
  const ip = req.ip || 'desconocida';
  const usuario = String(req.body?.usuario ?? '').trim().toLowerCase();
  const dentroDeIp = contar(porIp, ip, MAX_POR_IP, ahora);
  const dentroDeUsuario = contar(porUsuario, `${ip}|${usuario}`, MAX_POR_USUARIO, ahora);
  if (!dentroDeIp || !dentroDeUsuario) {
    return next(errores.demasiadosIntentos());
  }
  return next();
}

export function reiniciarLimiteIntentos() {
  porUsuario.clear();
  porIp.clear();
}

setInterval(() => {
  const ahora = Date.now();
  for (const mapa of [porUsuario, porIp]) {
    for (const [clave, registro] of mapa) {
      if (ahora - registro.inicio > VENTANA_MS) {
        mapa.delete(clave);
      }
    }
  }
}, VENTANA_MS).unref();
