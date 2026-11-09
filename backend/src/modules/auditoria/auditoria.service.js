import { errores } from '../../common/errors.js';
import * as repositorio from './auditoria.repository.js';

function aDto(fila) {
  return {
    id: fila.id,
    tipoAccion: fila.tipo_accion,
    fechaHora: fila.fecha_hora instanceof Date ? fila.fecha_hora.toISOString() : fila.fecha_hora,
    descripcion: fila.descripcion,
    usuario: fila.id_usuario
      ? {
          id: fila.id_usuario,
          nombreUsuario: fila.nombre_usuario,
          nombres: fila.nombres,
          apellidos: fila.apellidos,
        }
      : null,
  };
}

export async function listar(datos) {
  const { total, filas } = await repositorio.listarAcciones({
    tipoAccion: datos.tipo_accion,
    idUsuario: datos.id_usuario,
    desde: datos.desde,
    hasta: datos.hasta,
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

export async function listarUsuarios() {
  const usuarios = await repositorio.listarUsuariosAuditados();
  return { usuarios };
}

export async function obtener(id) {
  const fila = await repositorio.obtenerAccion(id);
  if (!fila) {
    throw errores.noEncontrado('Registro de auditoría');
  }
  return aDto(fila);
}
