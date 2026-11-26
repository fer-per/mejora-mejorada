import { normalizarFicha, normalizarResultado } from './normalizadores.js';

const CLAVE_USUARIO = 'siarc_ara_piloto_usuario';
const CLAVE_TOKEN_LEGADO = 'siarc_ara_piloto_token';
export const EVENTO_SESION = 'siarc-ara:sesion-invalida';

const PERFILES = {
  ADMINISTRADOR: 'admin',
  ARCHIVISTA: 'archivero',
  USUARIO_EXTERNO: 'viewer',
};

export function guardarSesion(usuario) {
  localStorage.removeItem(CLAVE_TOKEN_LEGADO);
  localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
}

export function leerUsuario() {
  try {
    const guardado = localStorage.getItem(CLAVE_USUARIO);
    return guardado ? JSON.parse(guardado) : null;
  } catch {
    return null;
  }
}

export function limpiarSesion() {
  localStorage.removeItem(CLAVE_TOKEN_LEGADO);
  localStorage.removeItem(CLAVE_USUARIO);
}

function normalizarUsuario(usuario) {
  if (!usuario) return null;
  return {
    ...usuario,
    name: usuario.nombreCompleto ?? `${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim(),
    role: PERFILES[usuario.perfil] ?? usuario.perfil,
  };
}

function mensajeError(datos) {
  const mensaje = datos?.error?.mensaje ?? datos?.mensaje ?? 'No se pudo completar la operación.';
  const detalles = datos?.error?.detalles;
  if (Array.isArray(detalles) && detalles.length > 0) {
    const campos = detalles
      .map((detalle) => `${detalle.campo}: ${detalle.mensaje}`)
      .filter(Boolean)
      .join(' · ');
    return campos ? `${mensaje} ${campos}` : mensaje;
  }
  return mensaje;
}

const TIEMPO_LIMITE_MS = 30_000;
const TIEMPO_LIMITE_ARCHIVO_MS = 60_000;

async function solicitar(ruta, opciones, limiteMs) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), limiteMs);
  try {
    return await fetch(ruta, { ...opciones, signal: controlador.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Intente nuevamente.', { cause: error });
    }
    throw new Error('No se pudo conectar con el servidor.', { cause: error });
  } finally {
    clearTimeout(temporizador);
  }
}

export async function peticion(ruta, opciones = {}) {
  const { metodo = 'GET', cuerpo, formulario } = opciones;
  const cabeceras = { Accept: 'application/json' };
  if (cuerpo && !formulario) cabeceras['Content-Type'] = 'application/json';

  const respuesta = await solicitar(
    ruta,
    {
      method: metodo,
      headers: cabeceras,
      credentials: 'include',
      body: formulario ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
    },
    TIEMPO_LIMITE_MS,
  );

  const datos = await respuesta.json().catch(() => null);

  if (respuesta.status === 401) {
    limpiarSesion();
    window.dispatchEvent(new Event(EVENTO_SESION));
  }

  if (!respuesta.ok) {
    throw new Error(mensajeError(datos));
  }

  return datos;
}

export async function apiArchivo(ruta) {
  const respuesta = await solicitar(
    ruta,
    { credentials: 'include', headers: { Accept: 'application/json' } },
    TIEMPO_LIMITE_ARCHIVO_MS,
  );

  if (respuesta.status === 401) {
    limpiarSesion();
    window.dispatchEvent(new Event(EVENTO_SESION));
    throw new Error('Sesión no válida o expirada. Inicie sesión nuevamente.');
  }

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null);
    throw new Error(mensajeError(datos));
  }

  return respuesta.blob();
}

export async function iniciarSesion(username, password) {
  const datos = await peticion('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { usuario: username, contrasena: password },
  });
  return normalizarUsuario(datos.usuario);
}

export async function validarSesion() {
  const datos = await peticion('/api/auth/sesion');
  return normalizarUsuario(datos.usuario);
}

export function cerrarSesion() {
  return peticion('/api/auth/logout', { metodo: 'POST' }).catch(() => null);
}

export async function buscarSimple({ q, pagina = 1, porPagina = 10, orden = 'relevancia' }) {
  const parametros = new URLSearchParams({
    q,
    pagina: String(pagina),
    por_pagina: String(porPagina),
    orden,
  });
  return normalizarResultado(await peticion(`/api/documentos/busqueda/simple?${parametros}`));
}

export async function buscarAvanzada(filtros) {
  const parametros = new URLSearchParams();
  const mapa = {
    texto: 'texto',
    fondo: 'fondo',
    serie: 'serie',
    tipologia: 'tipologia',
    conservacion: 'conservacion',
    fecha_desde: 'fecha_desde',
    fecha_hasta: 'fecha_hasta',
    orden: 'orden',
    pagina: 'pagina',
    por_pagina: 'por_pagina',
  };
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      parametros.set(mapa[clave] ?? clave, String(valor));
    }
  }
  return normalizarResultado(await peticion(`/api/documentos/busqueda/avanzada?${parametros}`));
}

export async function obtenerDocumento(id) {
  const datos = await peticion(`/api/documentos/${id}`);
  return normalizarFicha(datos.documento);
}

export function obtenerCatalogos() {
  return peticion('/api/catalogos');
}

export async function listarUsuarios({ q = '', perfil = '', estado = '', pagina = 1, porPagina = 20 } = {}) {
  const parametros = new URLSearchParams();
  if (q) parametros.set('q', q);
  if (perfil) parametros.set('perfil', perfil);
  if (estado) parametros.set('estado', estado);
  parametros.set('pagina', String(pagina));
  parametros.set('por_pagina', String(porPagina));
  return peticion(`/api/usuarios?${parametros}`);
}

export function obtenerUsuario(id) {
  return peticion(`/api/usuarios/${id}`);
}

export function crearUsuario(datos) {
  return peticion('/api/usuarios', { metodo: 'POST', cuerpo: datos });
}

export function actualizarUsuario(id, datos) {
  return peticion(`/api/usuarios/${id}`, { metodo: 'PUT', cuerpo: datos });
}

export function cambiarEstadoUsuario(id, estado) {
  return peticion(`/api/usuarios/${id}/estado`, { metodo: 'PATCH', cuerpo: { estado } });
}

export function desactivarUsuario(id) {
  return peticion(`/api/usuarios/${id}`, { metodo: 'DELETE' });
}

export async function crearDocumento(formulario) {
  const datos = await peticion('/api/documentos', { metodo: 'POST', formulario });
  return normalizarFicha(datos.documento);
}

export function crearDocumentosMasivo(filas) {
  return peticion('/api/documentos/ingesta-masiva', {
    metodo: 'POST',
    cuerpo: { filas },
  });
}

export function validarArchivosAcervo(archivos) {
  return peticion('/api/documentos/acervo/validar', {
    metodo: 'POST',
    cuerpo: { archivos },
  });
}

export function escanearAcervo() {
  return peticion('/api/documentos/acervo/escanear', {
    metodo: 'POST',
    cuerpo: {},
  });
}

export function vincularArchivosAcervo(asignaciones) {
  return peticion('/api/documentos/acervo/vincular', {
    metodo: 'POST',
    cuerpo: { asignaciones },
  });
}

export function subirArchivoAcervo(formulario) {
  return peticion('/api/documentos/acervo/subir', {
    metodo: 'POST',
    formulario,
  });
}

export function listarAuditoria({ tipoAccion = '', idUsuario = '', desde = '', hasta = '', pagina = 1, porPagina = 20 } = {}) {
  const parametros = new URLSearchParams();
  if (tipoAccion) parametros.set('tipo_accion', tipoAccion);
  if (idUsuario) parametros.set('id_usuario', String(idUsuario));
  if (desde) parametros.set('desde', desde);
  if (hasta) parametros.set('hasta', hasta);
  parametros.set('pagina', String(pagina));
  parametros.set('por_pagina', String(porPagina));
  return peticion(`/api/auditoria?${parametros}`);
}

export function listarUsuariosAuditoria() {
  return peticion('/api/auditoria/usuarios');
}

export function obtenerAccionAuditoria(id) {
  return peticion(`/api/auditoria/${id}`);
}
