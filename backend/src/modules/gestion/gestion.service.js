import { errores } from '../../common/errors.js';
import { registrarAccion } from '../auditoria/auditoria.repository.js';
import * as documentosRepositorio from '../documentos/documentos.repository.js';
import { aDtoResumenDocumento } from '../documentos/documentos.service.js';
import * as repositorio from './gestion.repository.js';

function aIso(fecha) {
  return fecha instanceof Date ? fecha.toISOString() : fecha;
}

function aDtoHistorial(fila) {
  return {
    id: fila.id,
    idOperacion: fila.id_operacion,
    idUsuario: fila.id_usuario,
    usuario: fila.nombre_usuario ?? null,
    idArchivo: fila.id_archivo,
    entidad: fila.entidad,
    idEntidad: fila.id_entidad,
    tipoOperacion: fila.tipo_operacion,
    idCambioOrigen: fila.id_cambio_origen,
    antes: fila.antes,
    despues: fila.despues,
    fechaHora: aIso(fila.fecha_hora),
  };
}

export async function resumen() {
  const datos = await repositorio.resumen();
  return {
    documentos: datos.documentos,
    anulados: datos.anulados,
    titulos: datos.titulos,
    interesados: datos.interesados,
    roles: datos.roles,
    registros: datos.registros,
    anios: datos.anios,
    protocolos: datos.protocolos,
    escribanos: datos.escribanos,
    fondos: datos.fondos,
    repositorios: datos.repositorios,
    cambios: datos.cambios,
  };
}

export async function listarDocumentos(datos, usuario) {
  const { total, filas } = await documentosRepositorio.buscarDocumentos({
    texto: datos.texto,
    fondo: datos.fondo,
    serie: datos.serie,
    tipologia: datos.tipologia,
    conservacion: datos.conservacion,
    fechaDesde: datos.fecha_desde,
    fechaHasta: datos.fecha_hasta,
    orden: datos.orden,
    pagina: datos.pagina,
    porPagina: datos.por_pagina,
    incluirAnulados: datos.incluir_anulados,
    soloAnulados: datos.solo_anulados,
  });

  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'CONSULTA_GESTION',
    descripcion: `Consulta de gestión documental devolvió ${total} resultado(s).`,
  });

  return {
    total,
    pagina: datos.pagina,
    porPagina: datos.por_pagina,
    resultados: filas.map(aDtoResumenDocumento),
  };
}

export async function listarEstructura(tipo, datos, usuario) {
  const resultado = await repositorio.listarEstructura(tipo, {
    q: datos.q,
    pagina: datos.pagina,
    porPagina: datos.por_pagina,
  });
  if (!resultado) {
    throw errores.noEncontrado('Tipo de entidad');
  }
  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'CONSULTA_ESTRUCTURA',
    descripcion: `Consulta de estructura "${tipo}"${datos.q ? ` con filtro "${datos.q}"` : ''}.`,
  });
  return resultado;
}

export async function actualizarEstructura(tipo, id, datos, usuario) {
  const { version, ...cambios } = datos;
  const resultado = await repositorio.actualizarEstructura(tipo, id, cambios, version, usuario.id);

  if (resultado.noEncontrado) throw errores.noEncontrado('Entidad');
  if (resultado.conflictoVersion) throw errores.conflictoVersion();
  if (resultado.errorPadre) throw errores.operacionNoPermitida(resultado.errorPadre);
  if (resultado.conflictoJerarquia) throw errores.conflictoJerarquia(resultado.conflictoJerarquia);
  if (resultado.sinCambios) throw errores.operacionNoPermitida('No se recibieron cambios.');

  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'EDICION_ESTRUCTURA',
    descripcion: `Edición de ${tipo} #${id}. Campos: ${Object.keys(cambios).join(', ')}.`,
  });

  return resultado;
}

export async function previsualizarFusion(tipo, datos, usuario) {
  const resultado = await repositorio.previsualizarFusion(tipo, datos.origen, datos.destino);
  if (resultado.error) throw errores.operacionNoPermitida(resultado.error);
  if (resultado.noEncontrado) throw errores.noEncontrado('Entidad');
  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'PREVISUALIZACION_FUSION',
    descripcion: `Previsualización de fusión ${tipo}: #${datos.origen} hacia #${datos.destino}.`,
  });
  return resultado;
}

export async function fusionar(tipo, datos, usuario) {
  const resultado = await repositorio.fusionarEstructura(
    tipo,
    datos.origen,
    datos.destino,
    { versionOrigen: datos.version_origen, versionDestino: datos.version_destino },
    usuario.id,
  );

  if (resultado.error) throw errores.operacionNoPermitida(resultado.error);
  if (resultado.noEncontrado) throw errores.noEncontrado('Entidad');
  if (resultado.conflictoVersion) throw errores.conflictoVersion();

  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'FUSION_ESTRUCTURA',
    descripcion: `Fusión de ${tipo}: #${datos.origen} hacia #${datos.destino}.`,
  });
  return resultado;
}

export async function edicionMasiva(datos, usuario) {
  const resultado = await repositorio.edicionMasiva(datos.ids, datos.cambios, usuario.id);
  if (resultado.faltantes) {
    throw errores.operacionNoPermitida(
      `No se encontraron documentos activos para los siguientes identificadores: ${resultado.faltantes.join(', ')}.`,
    );
  }

  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'EDICION_MASIVA',
    descripcion: `Edición masiva de ${resultado.afectados} documento(s). Operación ${resultado.idOperacion}. Campos: ${Object.keys(datos.cambios).join(', ')}.`,
  });
  return resultado;
}

export async function revertirOperacion(idOperacion, datos, usuario) {
  const resultado = await repositorio.revertirOperacion(idOperacion, usuario.id, {
    forzar: datos.forzar === true,
  });
  if (resultado.noEncontrado) throw errores.noEncontrado('Operación');
  if (resultado.noReversible) {
    throw errores.operacionNoPermitida('La operación contiene cambios que no se pueden revertir automáticamente.');
  }
  if (resultado.conflicto) throw errores.conflictoReversion();

  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'REVERSION_OPERACION',
    descripcion: `Reversión de la operación ${idOperacion} (${resultado.afectados} documento(s)). Nueva operación ${resultado.idOperacion}.`,
  });
  return resultado;
}

export async function listarOperaciones(datos) {
  const { total, filas } = await repositorio.listarOperaciones({
    pagina: datos.pagina,
    porPagina: datos.por_pagina,
    tipoOperacion: datos.tipo_operacion,
    idUsuario: datos.id_usuario,
  });
  return {
    total,
    pagina: datos.pagina,
    porPagina: datos.por_pagina,
    resultados: filas.map((fila) => ({
      idOperacion: fila.id_operacion,
      cambios: fila.cambios,
      documentos: fila.documentos,
      fechaInicio: aIso(fila.fecha_inicio),
      fechaFin: aIso(fila.fecha_fin),
      tipoOperacion: fila.tipo_operacion,
      usuario: fila.usuario,
    })),
  };
}

export async function obtenerOperacion(idOperacion) {
  const filas = await repositorio.obtenerOperacion(idOperacion);
  if (!filas) throw errores.noEncontrado('Operación');
  return {
    idOperacion,
    cambios: filas.map(aDtoHistorial),
  };
}

export async function historialEntidad(tipo, id, datos) {
  const resultado = await repositorio.historialEntidad(tipo, id, {
    pagina: datos.pagina,
    porPagina: datos.por_pagina,
  });
  if (!resultado) throw errores.noEncontrado('Tipo de entidad');
  return {
    total: resultado.total,
    pagina: datos.pagina,
    porPagina: datos.por_pagina,
    resultados: resultado.filas.map(aDtoHistorial),
  };
}

export async function duplicados(usuario) {
  const datos = await repositorio.duplicados();
  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'CONSULTA_DUPLICADOS',
    descripcion: `Consulta de duplicados: ${datos.totales.protocolos} protocolo(s), ${datos.totales.registros} registro(s), ${datos.totales.escribanos} escribano(s), ${datos.totales.interesados} grupo(s) de interesados.`,
  });

  return {
    protocolos: datos.protocolos.map((fila) => ({
      idFondo: fila.id_fondo,
      fondo: fila.fondo,
      numero: fila.numero,
      cantidad: fila.cantidad,
      entidades: fila.entidades,
    })),
    escribanos: datos.escribanos.map((fila) => ({
      idFondo: fila.id_fondo,
      fondo: fila.fondo,
      nombreNormalizado: fila.nombre_normalizado,
      cantidad: fila.cantidad,
      entidades: fila.entidades,
    })),
    registros: datos.registros.map((fila) => ({
      idAnioProtocolo: fila.id_anio_protocolo,
      anio: fila.anio,
      protocolo: fila.protocolo,
      numero: fila.numero,
      cantidad: fila.cantidad,
      entidades: fila.entidades,
    })),
    interesados: datos.interesados.map((fila) => ({
      nombreNormalizado: fila.nombre_normalizado,
      documento: fila.documento,
      cantidad: fila.cantidad,
      entidades: fila.entidades,
    })),
    totales: datos.totales,
  };
}

export function mapearDocumento(fila) {
  return aDtoResumenDocumento(fila);
}
