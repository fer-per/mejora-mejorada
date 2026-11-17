import { peticion } from './api.js';
import { normalizarFicha, normalizarResultado } from './normalizadores.js';

export async function actualizarDocumento(id, datos) {
  const respuesta = await peticion(`/api/documentos/${id}`, { metodo: 'PUT', cuerpo: datos });
  return normalizarFicha(respuesta.documento);
}

export async function anularDocumento(id, motivo) {
  const respuesta = await peticion(`/api/documentos/${id}/anular`, {
    metodo: 'POST',
    cuerpo: { motivo },
  });
  return normalizarFicha(respuesta.documento);
}

export async function restaurarDocumento(id) {
  const respuesta = await peticion(`/api/documentos/${id}/restaurar`, { metodo: 'POST' });
  return normalizarFicha(respuesta.documento);
}

export async function reemplazarArchivoDocumento(id, archivo) {
  const formulario = new FormData();
  formulario.append('archivo', archivo);
  const respuesta = await peticion(`/api/documentos/${id}/archivo`, {
    metodo: 'PUT',
    formulario,
  });
  return normalizarFicha(respuesta.documento);
}

export function listarHistorialDocumento(id, { pagina = 1, porPagina = 20 } = {}) {
  return peticion(`/api/documentos/${id}/historial?pagina=${pagina}&por_pagina=${porPagina}`);
}

export function revertirCambioDocumento(id, idCambio, forzar = false) {
  return peticion(`/api/documentos/${id}/historial/${idCambio}/revertir`, {
    metodo: 'POST',
    cuerpo: { forzar },
  });
}

export function obtenerResumenGestion() {
  return peticion('/api/gestion/resumen');
}

export async function listarDocumentosGestion(filtros = {}) {
  const parametros = new URLSearchParams();
  const mapa = {
    texto: 'texto',
    fondo: 'fondo',
    serie: 'serie',
    tipologia: 'tipologia',
    conservacion: 'conservacion',
    fecha_desde: 'fecha_desde',
    fecha_hasta: 'fecha_hasta',
    incluir_anulados: 'incluir_anulados',
    solo_anulados: 'solo_anulados',
    orden: 'orden',
    pagina: 'pagina',
    por_pagina: 'por_pagina',
  };
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '' && valor !== false) {
      parametros.set(mapa[clave] ?? clave, String(valor));
    }
  }
  return normalizarResultado(await peticion(`/api/gestion/documentos?${parametros}`));
}

export function listarEstructura(tipo, { q = '', pagina = 1, porPagina = 50 } = {}) {
  const parametros = new URLSearchParams({
    q,
    pagina: String(pagina),
    por_pagina: String(porPagina),
  });
  return peticion(`/api/gestion/estructura/${tipo}?${parametros}`);
}

export function actualizarEstructura(tipo, id, datos) {
  return peticion(`/api/gestion/estructura/${tipo}/${id}`, { metodo: 'PATCH', cuerpo: datos });
}

export function listarHistorialEntidad(tipo, id, { pagina = 1, porPagina = 20 } = {}) {
  return peticion(
    `/api/gestion/estructura/${tipo}/${id}/historial?pagina=${pagina}&por_pagina=${porPagina}`,
  );
}

export function previsualizarFusion(tipo, { origen, destino }) {
  return peticion(`/api/gestion/fusiones/previsualizar/${tipo}`, {
    metodo: 'POST',
    cuerpo: { origen, destino },
  });
}

export function fusionarEstructura(tipo, datos) {
  return peticion(`/api/gestion/fusiones/${tipo}`, { metodo: 'POST', cuerpo: datos });
}

export function edicionMasiva(ids, cambios) {
  return peticion('/api/gestion/edicion-masiva', { metodo: 'POST', cuerpo: { ids, cambios } });
}

export function listarOperacionesGestion({
  tipoOperacion = '',
  idUsuario = '',
  pagina = 1,
  porPagina = 20,
} = {}) {
  const parametros = new URLSearchParams();
  if (tipoOperacion) parametros.set('tipo_operacion', tipoOperacion);
  if (idUsuario) parametros.set('id_usuario', String(idUsuario));
  parametros.set('pagina', String(pagina));
  parametros.set('por_pagina', String(porPagina));
  return peticion(`/api/gestion/operaciones?${parametros}`);
}

export function obtenerOperacionGestion(idOperacion) {
  return peticion(`/api/gestion/operaciones/${idOperacion}`);
}

export function revertirOperacionGestion(idOperacion, forzar = false) {
  return peticion(`/api/gestion/operaciones/${idOperacion}/revertir`, {
    metodo: 'POST',
    cuerpo: { forzar },
  });
}

export function listarDuplicados() {
  return peticion('/api/gestion/duplicados');
}
