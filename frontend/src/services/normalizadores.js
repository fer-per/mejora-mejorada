function listaDescriptores(descriptores) {
  if (!descriptores) return [];
  if (Array.isArray(descriptores)) return descriptores;
  return String(descriptores)
    .split(',')
    .map((descriptor) => descriptor.trim())
    .filter(Boolean);
}

export function normalizarResumen(documento) {
  return {
    id: documento.id,
    codigo: documento.registro
      ? `ARC-${documento.registro}`
      : `ARC-${String(documento.id).padStart(8, '0')}`,
    titulo: documento.titulo,
    tipo: documento.tipologia,
    tipologia: documento.tipologia,
    fondo: documento.fondo,
    serie: documento.serie,
    subserie: documento.subserie,
    escribano: documento.escribano ?? null,
    idEscribano: documento.idEscribano ?? null,
    protocolo: documento.protocolo,
    registro: documento.registro,
    anio: documento.anio,
    fecha: documento.fecha,
    folios: documento.folios == null ? '' : String(documento.folios),
    lugar: null,
    conservacion: documento.estadoConservacion ?? null,
    estadoConservacion: documento.estadoConservacion ?? null,
    fechaProduccion: documento.fechaProduccion ?? null,
    formato: documento.formato,
    repositorio: documento.repositorio,
    relevancia: documento.relevancia,
    miniatura_url: documento.miniaturaUrl ?? null,
    archivo_url: Object.prototype.hasOwnProperty.call(documento, 'archivoUrl')
      ? documento.archivoUrl
      : `/api/documentos/${documento.id}/archivo`,
    digitalizado: documento.digitalizado ?? Boolean(documento.archivoUrl ?? documento.miniaturaUrl),
    descriptores: listaDescriptores(documento.descriptores),
    alcance: documento.alcanceContenido ?? null,
    anulado: Boolean(documento.anulado),
  };
}

export function normalizarFicha(documento) {
  const resumen = normalizarResumen(documento);
  return {
    ...resumen,
    lugar: documento.ubicacionFisica ?? null,
    observaciones: documento.observaciones ?? null,
    fechaCarga: documento.fechaCarga ?? null,
    usuarioCarga: documento.usuarioCarga ?? null,
    responsableDescripcion: documento.responsableDescripcion ?? null,
    interesados: documento.interesados ?? [],
    fechaActualizacion: documento.fechaActualizacion ?? null,
    fechaAnulacion: documento.fechaAnulacion ?? null,
    motivoAnulacion: documento.motivoAnulacion ?? null,
    nombreOriginal: documento.nombreOriginal ?? null,
    alcanceContenido: documento.alcanceContenido ?? null,
    descriptoresTexto:
      typeof documento.descriptores === 'string'
        ? documento.descriptores
        : (documento.descriptores ?? []).join(', '),
    ubicacionFisica: documento.ubicacionFisica ?? null,
  };
}

export function normalizarResultado(datos) {
  const porPagina = datos.porPagina ?? 10;
  const total = datos.total ?? 0;
  return {
    total,
    pagina: datos.pagina ?? 1,
    porPagina,
    paginas: porPagina > 0 ? Math.ceil(total / porPagina) : 0,
    resultados: (datos.resultados ?? []).map(normalizarResumen),
  };
}

export function normalizarFilaHistorial(fila) {
  return {
    id: fila.id,
    idOperacion: fila.idOperacion ?? fila.id_operacion,
    idUsuario: fila.idUsuario ?? fila.id_usuario,
    usuario: fila.usuario ?? null,
    idArchivo: fila.idArchivo ?? fila.id_archivo ?? null,
    entidad: fila.entidad,
    idEntidad: fila.idEntidad ?? fila.id_entidad,
    tipoOperacion: fila.tipoOperacion ?? fila.tipo_operacion,
    idCambioOrigen: fila.idCambioOrigen ?? fila.id_cambio_origen,
    antes: fila.antes ?? null,
    despues: fila.despues ?? null,
    fechaHora: fila.fechaHora ?? fila.fecha_hora,
  };
}
