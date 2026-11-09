import bcrypt from 'bcryptjs';
import { errores } from '../../common/errors.js';
import { registrarAccion } from '../auditoria/auditoria.repository.js';
import * as repositorio from './usuarios.repository.js';

const COSTO_BCRYPT = 10;

function aDto(fila) {
  return {
    id: fila.id,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    correo: fila.correo,
    nombreUsuario: fila.nombre_usuario,
    perfil: fila.perfil,
    estado: fila.estado,
    intentosFallidos: fila.intentos_fallidos,
    bloqueadoHasta: fila.bloqueado_hasta instanceof Date
      ? fila.bloqueado_hasta.toISOString()
      : fila.bloqueado_hasta,
    fechaCreacion: fila.fecha_creacion instanceof Date
      ? fila.fecha_creacion.toISOString()
      : fila.fecha_creacion,
  };
}

function protegerUltimoAdministrador(existente) {
  if (existente.perfil !== 'ADMINISTRADOR' || existente.estado !== 'ACTIVO') {
    return Promise.resolve(false);
  }
  return repositorio.contarAdministradoresActivos().then((total) => total <= 1);
}

export async function listar(datos) {
  const { total, filas } = await repositorio.listarUsuarios({
    q: datos.q,
    perfil: datos.perfil,
    estado: datos.estado,
    pagina: datos.pagina,
    porPagina: datos.por_pagina,
  });

  return {
    total,
    pagina: datos.pagina,
    porPagina: datos.por_pagina,
    resultados: filas.map(aDto),
  };
}

export async function obtener(id) {
  const usuario = await repositorio.obtenerUsuario(id);
  if (!usuario) {
    throw errores.noEncontrado('Usuario');
  }
  return aDto(usuario);
}

export async function crear(datos, actor) {
  const hash = await bcrypt.hash(datos.contrasena, COSTO_BCRYPT);
  const id = await repositorio.crearUsuario({
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    correo: datos.correo,
    nombreUsuario: datos.nombre_usuario,
    hash,
    perfil: datos.perfil,
    estado: datos.estado,
  });

  await registrarAccion({
    idUsuario: actor.id,
    tipoAccion: 'CREACION_USUARIO',
    descripcion: `Se creó el usuario "${datos.nombre_usuario}" (${datos.perfil}) con id #${id}.`,
  });

  return obtener(id);
}

export async function actualizar(id, datos, actor) {
  const existente = await repositorio.obtenerUsuario(id);
  if (!existente) {
    throw errores.noEncontrado('Usuario');
  }

  if (id === actor.id && datos.estado === 'INACTIVO') {
    throw errores.operacionNoPermitida('No puede desactivar su propia cuenta.');
  }

  const pierdePerfilAdministrador =
    datos.perfil !== undefined &&
    datos.perfil !== 'ADMINISTRADOR' &&
    existente.perfil === 'ADMINISTRADOR' &&
    existente.estado === 'ACTIVO';

  if ((datos.estado === 'INACTIVO' || pierdePerfilAdministrador) && (await protegerUltimoAdministrador(existente))) {
    throw errores.operacionNoPermitida('Debe existir al menos un administrador activo.');
  }

  const hash = datos.contrasena ? await bcrypt.hash(datos.contrasena, COSTO_BCRYPT) : null;
  const cambios = {
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    correo: datos.correo,
    nombreUsuario: datos.nombre_usuario,
    perfil: datos.perfil,
    estado: datos.estado,
  };

  await repositorio.actualizarUsuario(id, cambios, hash);

  const campos = Object.keys(datos).filter((campo) => datos[campo] !== undefined);
  await registrarAccion({
    idUsuario: actor.id,
    tipoAccion: 'ACTUALIZACION_USUARIO',
    descripcion: `Se actualizó el usuario "${existente.nombre_usuario}" (#${id}). Campos: ${campos.join(', ')}.`,
  });

  return obtener(id);
}

export async function cambiarEstado(id, estado, actor) {
  const existente = await repositorio.obtenerUsuario(id);
  if (!existente) {
    throw errores.noEncontrado('Usuario');
  }

  if (estado === 'INACTIVO') {
    if (id === actor.id) {
      throw errores.operacionNoPermitida('No puede desactivar su propia cuenta.');
    }
    if (await protegerUltimoAdministrador(existente)) {
      throw errores.operacionNoPermitida('Debe existir al menos un administrador activo.');
    }
  }

  await repositorio.cambiarEstado(id, estado);

  await registrarAccion({
    idUsuario: actor.id,
    tipoAccion: estado === 'ACTIVO' ? 'ACTIVACION_USUARIO' : 'DESACTIVACION_USUARIO',
    descripcion: `Se ${estado === 'ACTIVO' ? 'activó' : 'desactivó'} el usuario "${existente.nombre_usuario}" (#${id}).`,
  });

  return obtener(id);
}

export function desactivar(id, actor) {
  return cambiarEstado(id, 'INACTIVO', actor);
}
