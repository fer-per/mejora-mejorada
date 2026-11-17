import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config/env.js';
import { existeObjeto, subirObjeto, usaAlmacenamientoRemoto } from '../../config/almacenamiento.js';
import { errores } from '../../common/errors.js';
import { tituloDesdeNombre, validarArchivoDigital } from '../../common/archivos.js';
import { registrarAccion } from '../auditoria/auditoria.repository.js';
import * as historial from '../gestion/historial.repository.js';
import * as repositorio from './documentos.repository.js';

function aIso(fecha) {
  return fecha instanceof Date ? fecha.toISOString() : fecha;
}

function puedeVerAnulados(usuario) {
  return usuario?.perfil === 'ADMINISTRADOR' || usuario?.perfil === 'ARCHIVISTA';
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
    digitalizado: Boolean(fila.ruta_archivo),
    miniaturaUrl: fila.ruta_miniatura ? `/api/documentos/${fila.id}/miniatura` : null,
    anulado: Boolean(fila.anulado),
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
    fechaActualizacion: aIso(fila.fecha_actualizacion),
    usuarioCarga: fila.usuario_carga,
    responsableDescripcion: fila.responsable_descripcion,
    nombreOriginal: fila.nombre_original,
    tamanoBytes: fila.tamano_bytes == null ? null : Number(fila.tamano_bytes),
    interesados: fila.interesados ?? [],
    archivoUrl: `/api/documentos/${fila.id}/archivo`,
    anulado: Boolean(fila.anulado),
    fechaAnulacion: aIso(fila.fecha_anulacion),
    motivoAnulacion: fila.motivo_anulacion,
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

async function guardarArchivoDigital(rutaRelativa, buffer, tipoContenido) {
  if (usaAlmacenamientoRemoto) {
    await subirObjeto(rutaRelativa, buffer, tipoContenido);
    return null;
  }
  const absoluta = resolverRutaAbsoluta(rutaRelativa);
  await fsp.mkdir(path.dirname(absoluta), { recursive: true });
  await fsp.writeFile(absoluta, buffer);
  return absoluta;
}

export async function crearDocumento(datos, archivoRecibido, usuario) {
  if (!archivoRecibido) {
    throw errores.archivoInvalido('Debe adjuntar un archivo PDF/A o TIFF en el campo "archivo".');
  }

  const { formato, extension, tipoContenido } = validarArchivoDigital({
    buffer: archivoRecibido.buffer,
    nombreOriginal: archivoRecibido.originalname,
    tipoMime: archivoRecibido.mimetype,
  });

  const rutaRelativa = `ingesta/${datos.anio}/${crypto.randomUUID()}.${extension}`;
  const rutaLocal = await guardarArchivoDigital(rutaRelativa, archivoRecibido.buffer, tipoContenido);

  let creado;
  try {
    creado = await repositorio.crearDocumento(
      {
        idFondo: datos.id_fondo,
        protocolo: datos.protocolo,
        anio: datos.anio,
        registro: datos.registro,
        titulo: datos.titulo ?? tituloDesdeNombre(archivoRecibido.originalname),
        mes: datos.mes,
        idResponsableDescripcion: datos.id_responsable_descripcion,
        idUsuarioCarga: usuario.id,
        tipologia: datos.tipologia,
        serie: datos.serie,
        subserie: datos.subserie,
        folios: datos.folios,
        estadoConservacion: datos.estado_conservacion,
        alcanceContenido: datos.alcance_contenido,
        descriptores: datos.descriptores,
        fechaProduccion: datos.fecha_produccion,
        observaciones: datos.observaciones,
        ubicacionFisica: datos.ubicacion_fisica,
        interesados: datos.interesados,
      },
      {
        formato,
        ruta: rutaRelativa,
        nombreOriginal: archivoRecibido.originalname,
        tamanoBytes: archivoRecibido.size,
      },
    );
  } catch (error) {
    if (rutaLocal) await fsp.unlink(rutaLocal).catch(() => {});
    throw error;
  }

  if (!creado) {
    if (rutaLocal) await fsp.unlink(rutaLocal).catch(() => {});
    throw errores.noEncontrado('Fondo');
  }

  const documento = await repositorio.obtenerDocumento(creado.id);

  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'CARGA_DOCUMENTO',
    descripcion: `Carga del documento #${creado.id} "${documento.titulo}" (${formato}, ${archivoRecibido.size} bytes) en el fondo #${datos.id_fondo}.`,
  });

  return aDtoDetalle(documento);
}

export async function obtenerDetalle(id, usuario) {
  const documento = await repositorio.obtenerDocumento(id);
  if (!documento || (documento.anulado && !puedeVerAnulados(usuario))) {
    throw errores.noEncontrado('Documento');
  }
  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'CONSULTA_DETALLE_DOCUMENTO',
    descripcion: `Consulta del detalle del documento #${id} "${documento.titulo}".`,
  });
  return aDtoDetalle(documento);
}

export async function actualizarDocumento(id, datos, usuario) {
  const { fecha_actualizacion: fechaEsperada, ...cambios } = datos;
  const resultado = await repositorio.actualizarDocumento(id, cambios, usuario.id, {
    fechaEsperada,
  });

  if (resultado.noEncontrado) {
    throw errores.noEncontrado('Documento');
  }
  if (resultado.conflicto) {
    throw errores.conflictoConcurrencia();
  }

  const documento = await repositorio.obtenerDocumento(id);
  const campos = Object.keys(cambios).filter((campo) => cambios[campo] !== undefined);

  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'EDICION_DOCUMENTO',
    descripcion: `Edición del documento #${id} "${documento.titulo}". Campos actualizados: ${campos.join(', ')}.`,
  });

  return aDtoDetalle(documento);
}

export async function anularDocumento(id, datos, usuario) {
  const resultado = await repositorio.anularDocumento(id, usuario.id, datos.motivo);
  if (resultado.noEncontrado) {
    throw errores.noEncontrado('Documento');
  }
  if (resultado.yaAnulado) {
    throw errores.operacionNoPermitida('El documento ya se encuentra anulado.');
  }

  const documento = await repositorio.obtenerDocumento(id);
  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'ANULACION_DOCUMENTO',
    descripcion: `Anulación del documento #${id} "${documento.titulo}". Motivo: ${datos.motivo}.`,
  });
  return aDtoDetalle(documento);
}

export async function restaurarDocumento(id, usuario) {
  const resultado = await repositorio.restaurarDocumento(id, usuario.id);
  if (resultado.noEncontrado) {
    throw errores.noEncontrado('Documento');
  }
  if (resultado.yaActivo) {
    throw errores.operacionNoPermitida('El documento ya se encuentra activo.');
  }

  const documento = await repositorio.obtenerDocumento(id);
  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'RESTAURACION_DOCUMENTO',
    descripcion: `Restauración del documento #${id} "${documento.titulo}".`,
  });
  return aDtoDetalle(documento);
}

export async function reemplazarArchivo(id, archivoRecibido, usuario) {
  if (!archivoRecibido) {
    throw errores.archivoInvalido('Debe adjuntar un archivo PDF/A o TIFF en el campo "archivo".');
  }

  const documentoActual = await repositorio.obtenerDocumento(id);
  if (!documentoActual) {
    throw errores.noEncontrado('Documento');
  }
  if (documentoActual.anulado) {
    throw errores.operacionNoPermitida('Restaure el documento antes de reemplazar su archivo.');
  }

  const { formato, extension, tipoContenido } = validarArchivoDigital({
    buffer: archivoRecibido.buffer,
    nombreOriginal: archivoRecibido.originalname,
    tipoMime: archivoRecibido.mimetype,
  });

  const anio = documentoActual.fecha_produccion
    ? String(documentoActual.fecha_produccion).slice(0, 4)
    : String(new Date().getFullYear());
  const rutaRelativa = `reemplazos/${anio}/${crypto.randomUUID()}.${extension}`;
  const rutaLocal = await guardarArchivoDigital(rutaRelativa, archivoRecibido.buffer, tipoContenido);

  let resultado;
  try {
    resultado = await repositorio.reemplazarArchivoDocumento(id, {
      ruta: rutaRelativa,
      nombreOriginal: archivoRecibido.originalname,
      tamanoBytes: archivoRecibido.size,
      formato,
    }, usuario.id);
  } catch (error) {
    if (rutaLocal) await fsp.unlink(rutaLocal).catch(() => {});
    throw error;
  }

  if (resultado.noEncontrado) {
    if (rutaLocal) await fsp.unlink(rutaLocal).catch(() => {});
    throw errores.noEncontrado('Documento');
  }
  if (resultado.anulado) {
    if (rutaLocal) await fsp.unlink(rutaLocal).catch(() => {});
    throw errores.operacionNoPermitida('Restaure el documento antes de reemplazar su archivo.');
  }

  const documento = await repositorio.obtenerDocumento(id);
  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'REEMPLAZO_ARCHIVO',
    descripcion: `Reemplazo del archivo digital del documento #${id} "${documento.titulo}" por "${archivoRecibido.originalname}" (${formato}, ${archivoRecibido.size} bytes).`,
  });
  return aDtoDetalle(documento);
}

export async function listarHistorialDocumento(id, datos, usuario) {
  const documento = await repositorio.obtenerDocumento(id);
  if (!documento || (documento.anulado && !puedeVerAnulados(usuario))) {
    throw errores.noEncontrado('Documento');
  }

  const pagina = datos.pagina ?? 1;
  const porPagina = datos.porPagina ?? datos.por_pagina ?? 20;
  const { total, filas } = await historial.listarHistorial({
    idArchivo: id,
    pagina,
    porPagina,
  });

  return {
    total,
    pagina,
    porPagina,
    resultados: filas.map(aDtoHistorial),
  };
}

export async function revertirCambioDocumento(id, idCambio, usuario, { forzar = false } = {}) {
  const documento = await repositorio.obtenerDocumento(id);
  if (!documento) {
    throw errores.noEncontrado('Documento');
  }

  const resultado = await repositorio.revertirCambioDocumento(idCambio, usuario.id, { forzar });
  if (resultado.noEncontrado) {
    throw errores.noEncontrado('Cambio');
  }
  if (resultado.noReversible) {
    throw errores.operacionNoPermitida('Este cambio no se puede revertir automáticamente.');
  }
  if (resultado.conflicto) {
    throw errores.conflictoReversion();
  }

  const actualizado = await repositorio.obtenerDocumento(id);
  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'REVERSION_DOCUMENTO',
    descripcion: `Reversión del cambio #${idCambio} en el documento #${id} "${actualizado.titulo}".`,
  });
  return {
    documento: aDtoDetalle(actualizado),
    idCambio: resultado.idCambio,
    idOperacion: resultado.idOperacion,
  };
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
  if (!registro || (registro.anulado && !puedeVerAnulados(usuario))) {
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

export { aDtoResumen as aDtoResumenDocumento, aDtoDetalle as aDtoDetalleDocumento };
