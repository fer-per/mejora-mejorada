export const NOMBRE_COOKIE_SESION = 'siarc_sesion';

export function opcionesCookie(esProduccion) {
  return {
    httpOnly: true,
    secure: esProduccion,
    sameSite: 'strict',
    path: '/',
  };
}

export function leerCookie(req, nombre) {
  const cabecera = req.headers.cookie;
  if (!cabecera) return null;
  for (const parte of cabecera.split(';')) {
    const separador = parte.indexOf('=');
    if (separador === -1) continue;
    const clave = parte.slice(0, separador).trim();
    if (clave === nombre) {
      return decodeURIComponent(parte.slice(separador + 1).trim());
    }
  }
  return null;
}

export function extraerToken(req) {
  const desdeCookie = leerCookie(req, NOMBRE_COOKIE_SESION);
  if (desdeCookie) return desdeCookie;
  const cabecera = req.headers.authorization ?? '';
  const [esquema, token] = cabecera.split(' ');
  if (esquema === 'Bearer' && token) return token;
  return null;
}
