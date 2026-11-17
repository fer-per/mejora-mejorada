import { consultar } from '../../config/database.js';

export async function listarFondos() {
  const { rows } = await consultar(
    `SELECT f.id, f.denominacion, rep.numero AS repositorio, rep.siglo
       FROM fondo f
       JOIN repositorio rep ON rep.id = f.id_repositorio
      ORDER BY f.denominacion`,
  );
  return rows;
}

export async function listarSeries() {
  const { rows } = await consultar(
    `SELECT DISTINCT serie
       FROM archivo
      WHERE anulado = false AND serie IS NOT NULL AND serie <> ''
      ORDER BY serie`,
  );
  return rows.map((fila) => fila.serie);
}

export async function listarTipologias() {
  const { rows } = await consultar(
    `SELECT DISTINCT tipologia_documental
       FROM archivo
      WHERE anulado = false
      ORDER BY tipologia_documental`,
  );
  return rows.map((fila) => fila.tipologia_documental);
}

export async function listarConservaciones() {
  const { rows } = await consultar(
    `SELECT DISTINCT estado_conservacion
       FROM archivo
      WHERE anulado = false
      ORDER BY estado_conservacion`,
  );
  return rows.map((fila) => fila.estado_conservacion);
}

export async function obtenerResumen() {
  const { rows } = await consultar(
    `SELECT COUNT(*)::int AS total,
            COUNT(ruta_archivo)::int AS digitalizados,
            EXTRACT(YEAR FROM MIN(fecha_produccion))::int AS desde,
            EXTRACT(YEAR FROM MAX(fecha_produccion))::int AS hasta
       FROM archivo
      WHERE anulado = false`,
  );
  const resumen = rows[0] ?? {};
  return {
    totalDocumentos: resumen.total ?? 0,
    totalDigitalizados: resumen.digitalizados ?? 0,
    rangoAnios: {
      desde: resumen.desde ?? null,
      hasta: resumen.hasta ?? null,
    },
  };
}
