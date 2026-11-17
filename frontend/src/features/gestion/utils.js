import { ETIQUETA_CAMBIO } from './constants.js';

export function formatearFechaHora(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  return fecha.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

export function valorLegible(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

export function diferencias(antes, despues) {
  if (!antes || !despues) return [];
  const claves = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  return [...claves]
    .filter((clave) => JSON.stringify(antes[clave]) !== JSON.stringify(despues[clave]))
    .map((clave) => ({
      clave,
      etiqueta: ETIQUETA_CAMBIO[clave] ?? clave,
      antes: antes[clave],
      despues: despues[clave],
    }));
}

export function calcularPaginas(pagina, totalPaginas) {
  const inicio = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
  const fin = Math.min(totalPaginas, inicio + 4);
  return Array.from({ length: Math.max(0, fin - inicio + 1) }, (_, indice) => inicio + indice);
}

export function paginasTotales(datos, porPaginaPredeterminado = 15) {
  return Math.max(1, Math.ceil(datos.total / (datos.porPagina || porPaginaPredeterminado)));
}
