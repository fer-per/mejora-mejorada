import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config/env.js';
import { existeObjeto, usaAlmacenamientoRemoto } from '../../config/almacenamiento.js';
import { errores } from '../../common/errors.js';
import { registrarAccion } from '../auditoria/auditoria.repository.js';
import * as repositorio from './documentos.repository.js';

function aIso(fecha) {
  return fecha instanceof Date ? fecha.toISOString() : fecha;
}

function aDtoResumen(fila) {
  const fecha = fila.fecha_produccion ?? (fila.fecha_carga ? aIso(fila.fecha_carga).slice(0, 10) : null);
  return {
    id: fila.id,
    titulo: fila.titulo,
    tipologia: fila.tipologia,
    serie: fila.serie,
    subserie: fila.subserie,
    formato: fila.formato,
    folios: fila.folios,
    estadoConservacion: fila.estado_conservacion,
    fecha,
    fechaProduccion: fila.fecha_produccion ?? null,
    fondo: fila.fondo,
    protocolo: fila.protocolo,
    anio: fila.anio_protocolo,
    registro: fila.registro,
    repositorio: fila.repositorio,
    siglo: fila.siglo,
    relevancia: fila.relevancia == null ? null : Number(Number(fila.relevancia).toFixed(4)),
    miniaturaUrl: fila.ruta_miniatura ? `/api/documentos/${fila.id}/miniatura` : null,
  };
}

function aDtoDetalle(fila) {
  return {
    ...aDtoResumen(fila),
    alcanceContenido: fila.alcance_contenido,
    descriptores: fila.descriptores,
    estadoConservacion: fila.estado_conservacion,
    observaciones: fila.observaciones,
    ubicacionFisica: fila.ubicacion_fisica,
    fechaCarga: aIso(fila.fecha_carga),
    usuarioCarga: fila.usuario_carga,
    responsableDescripcion: fila.responsable_descripcion,
    interesados: fila.interesados ?? [],
    archivoUrl: `/api/documentos/${fila.id}/archivo`,
  };
}

function descripcionCriterios(criterios) {
  return Object.entries(criterios)
    .filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
    .map(([clave, valor]) => `${clave}=${valor}`)
    .join(', ');
}

async function ejecutarBusqueda(criterios, usuario) {
  const { total, filas } = await repositorio.buscarDocumentos(criterios);

  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'CONSULTA_DOCUMENTAL',
    descripcion: `Búsqueda ${criterios.tipo} (${descripcionCriterios(criterios)}) devolvió ${total} resultado(s).`,
  });

  return {
    total,
    pagina: criterios.pagina,
    porPagina: criterios.porPagina,
    resultados: filas.map(aDtoResumen),
  };
}

export function buscarSimple(datos, usuario) {
  return ejecutarBusqueda(
    {
      tipo: 'simple',
      texto: datos.q,
      orden: datos.orden,
      pagina: datos.pagina,
      porPagina: datos.por_pagina,
    },
    usuario,
  );
}

export function buscarAvanzada(datos, usuario) {
  return ejecutarBusqueda(
    {
      tipo: 'avanzada',
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
    },
    usuario,
  );
}

export async function obtenerDetalle(id, usuario) {
  const documento = await repositorio.obtenerDocumento(id);
  if (!documento) {
    throw errores.noEncontrado('Documento');
  }
  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'CONSULTA_DETALLE_DOCUMENTO',
    descripcion: `Consulta del detalle del documento #${id} "${documento.titulo}".`,
  });
  return aDtoDetalle(documento);
}

export function resolverRutaAbsoluta(rutaRelativa) {
  const base = config.rutas.repositorio.endsWith(path.sep)
    ? config.rutas.repositorio
    : config.rutas.repositorio + path.sep;
  const absoluta = path.resolve(config.rutas.repositorio, rutaRelativa);
  if (!absoluta.startsWith(base)) {
    throw errores.rutaInvalida();
  }
  return absoluta;
}

export function nombreDescarga(titulo, extension) {
  const limpio = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${limpio || 'documento'}.${extension}`;
}

async function prepararArchivo(id, usuario, tipo) {
  const registro = await repositorio.obtenerArchivo(id);
  if (!registro) {
    throw errores.noEncontrado('Documento');
  }

  const rutaRelativa = tipo === 'miniatura' ? registro.ruta_miniatura : registro.ruta_archivo;
  if (!rutaRelativa) {
    throw errores.archivoNoDisponible();
  }

  let ubicacion;
  if (usaAlmacenamientoRemoto) {
    if (!(await existeObjeto(rutaRelativa))) {
      throw errores.archivoNoDisponible();
    }
    ubicacion = { remoto: true, clave: rutaRelativa };
  } else {
    const rutaAbsoluta = resolverRutaAbsoluta(rutaRelativa);
    if (!fs.existsSync(rutaAbsoluta)) {
      throw errores.archivoNoDisponible();
    }
    ubicacion = { remoto: false, rutaAbsoluta };
  }

  const esMiniatura = tipo === 'miniatura';
  const esTiff = !esMiniatura && registro.formato === 'TIFF';

  return {
    ...ubicacion,
    tipoContenido: esMiniatura ? 'image/png' : esTiff ? 'image/tiff' : 'application/pdf',
    nombre: esMiniatura
      ? `${nombreDescarga(registro.titulo, 'png')}`
      : nombreDescarga(registro.titulo, esTiff ? 'tif' : 'pdf'),
    registro,
  };
}

export async function obtenerArchivo(id, usuario) {
  const preparado = await prepararArchivo(id, usuario, 'documento');
  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'VISUALIZACION_DOCUMENTO',
    descripcion: `Visualización del documento #${id} "${preparado.registro.titulo}" (${preparado.registro.formato}).`,
  });
  return preparado;
}

export async function obtenerMiniatura(id, usuario) {
  return prepararArchivo(id, usuario, 'miniatura');
}
