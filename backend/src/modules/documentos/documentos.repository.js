import { consultar, conTransaccion } from '../../config/database.js';

const COLUMNAS = `
    a.id,
    a.id_titulo_escritura,
    te.nombre AS titulo,
    a.tipologia_documental AS tipologia,
    a.serie,
    a.subserie,
    a.formato,
    a.folios,
    a.estado_conservacion,
    a.alcance_contenido,
    a.descriptores,
    a.fecha_produccion,
    a.fecha_carga,
    a.observaciones,
    a.ubicacion_fisica,
    a.ruta_archivo,
    a.ruta_miniatura,
    a.nombre_original,
    a.tamano_bytes,
    r.numero AS registro,
    ap.anio AS anio_protocolo,
    p.numero AS protocolo,
    f.id AS id_fondo,
    f.denominacion AS fondo,
    rep.numero AS repositorio,
    rep.siglo,
    rd.nombre_completo AS responsable_descripcion,
    u.nombre_usuario AS usuario_carga
`;

const RELACIONES = `
    FROM archivo a
    JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
    JOIN registro r          ON r.id = te.id_registro
    JOIN anio_protocolo ap   ON ap.id = r.id_anio_protocolo
    JOIN protocolo p         ON p.id = ap.id_protocolo
    JOIN fondo f             ON f.id = p.id_fondo
    JOIN repositorio rep     ON rep.id = f.id_repositorio
    LEFT JOIN responsable_descripcion rd ON rd.id = a.id_responsable_descripcion
    LEFT JOIN usuario u      ON u.id = a.id_usuario_carga
`;

const CONTENIDO_TS = `to_tsvector('spanish', f_unaccent(coalesce(a.alcance_contenido, '')))`;
const ORDEN_FECHA = 'coalesce(a.fecha_produccion, a.fecha_carga::date) DESC, a.id DESC';
const ORDEN_ANTIGUO = 'coalesce(a.fecha_produccion, a.fecha_carga::date) ASC, a.id ASC';
const ORDEN_TITULO = 'f_unaccent(te.nombre) ASC, a.id ASC';

export async function buscarDocumentos({
  texto,
  fondo,
  serie,
  tipologia,
  conservacion,
  fechaDesde,
  fechaHasta,
  orden,
  pagina,
  porPagina,
}) {
  const parametros = [];
  const parametro = (valor) => {
    parametros.push(valor);
    return `$${parametros.length}`;
  };
  const condiciones = [];

  if (texto) {
    const p = parametro(texto);
    condiciones.push(`(
      ${CONTENIDO_TS} @@ plainto_tsquery('spanish', f_unaccent(${p}))
      OR f_unaccent(te.nombre) % f_unaccent(${p})
      OR f_unaccent(te.nombre) ILIKE '%' || f_unaccent(${p}) || '%'
      OR f_unaccent(coalesce(a.descriptores, '')) % f_unaccent(${p})
    )`);
  }
  if (fondo) condiciones.push(`f.id = ${parametro(fondo)}`);
  if (serie) condiciones.push(`a.serie = ${parametro(serie)}`);
  if (tipologia) condiciones.push(`a.tipologia_documental = ${parametro(tipologia)}`);
  if (conservacion) condiciones.push(`a.estado_conservacion = ${parametro(conservacion)}`);
  if (fechaDesde) condiciones.push(`a.fecha_produccion >= ${parametro(fechaDesde)}`);
  if (fechaHasta) condiciones.push(`a.fecha_produccion <= ${parametro(fechaHasta)}`);

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join('\n    AND ')}` : '';

  const { rows: conteo } = await consultar(
    `SELECT COUNT(*)::int AS total ${RELACIONES} ${where}`,
    parametros,
  );

  const columnaRelevancia = texto
    ? `(ts_rank(${CONTENIDO_TS}, plainto_tsquery('spanish', f_unaccent($1)))
        + similarity(f_unaccent(te.nombre), f_unaccent($1)) * 0.5
        + similarity(f_unaccent(coalesce(a.descriptores, '')), f_unaccent($1)) * 0.3) AS relevancia`
    : 'NULL::double precision AS relevancia';

  let ordenSql;
  if (orden === 'fecha') {
    ordenSql = ORDEN_FECHA;
  } else if (orden === 'antiguo') {
    ordenSql = ORDEN_ANTIGUO;
  } else if (orden === 'titulo') {
    ordenSql = ORDEN_TITULO;
  } else if (texto) {
    ordenSql = `relevancia DESC, ${ORDEN_FECHA}`;
  } else {
    ordenSql = ORDEN_FECHA;
  }

  const desplazamiento = (pagina - 1) * porPagina;
  const { rows } = await consultar(
    `SELECT ${columnaRelevancia}, ${COLUMNAS}
       ${RELACIONES}
       ${where}
      ORDER BY ${ordenSql}
      LIMIT ${parametro(porPagina)}
      OFFSET ${parametro(desplazamiento)}`,
    parametros,
  );

  return { total: conteo[0].total, filas: rows };
}

export async function obtenerDocumento(id) {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} ${RELACIONES} WHERE a.id = $1`,
    [id],
  );
  const documento = rows[0];
  if (!documento) return null;

  const { rows: interesados } = await consultar(
    `SELECT i.nombre, i.documento, ri.rol
       FROM rol_interesado ri
       JOIN interesado i ON i.id = ri.id_interesado
      WHERE ri.id_titulo_escritura = $1
      ORDER BY ri.rol, i.nombre`,
    [documento.id_titulo_escritura],
  );

  return { ...documento, interesados };
}

const CAMPOS_ACTUALIZABLES = {
  tipologia: 'tipologia_documental',
  serie: 'serie',
  subserie: 'subserie',
  folios: 'folios',
  formato: 'formato',
  estado_conservacion: 'estado_conservacion',
  alcance_contenido: 'alcance_contenido',
  descriptores: 'descriptores',
  fecha_produccion: 'fecha_produccion',
  observaciones: 'observaciones',
  ubicacion_fisica: 'ubicacion_fisica',
};

async function guardarInteresados(cliente, idTituloEscritura, interesados) {
  await cliente.query(
    'DELETE FROM rol_interesado WHERE id_titulo_escritura = $1',
    [idTituloEscritura],
  );
  for (const interesado of interesados) {
    const { rows: existentes } = await cliente.query(
      'SELECT id FROM interesado WHERE nombre = $1 AND documento IS NOT DISTINCT FROM $2 LIMIT 1',
      [interesado.nombre, interesado.documento ?? null],
    );
    let idInteresado = existentes[0]?.id;
    if (!idInteresado) {
      const { rows: creados } = await cliente.query(
        'INSERT INTO interesado (nombre, documento) VALUES ($1, $2) RETURNING id',
        [interesado.nombre, interesado.documento ?? null],
      );
      idInteresado = creados[0].id;
    }
    await cliente.query(
      `INSERT INTO rol_interesado (id_titulo_escritura, id_interesado, rol)
       VALUES ($1, $2, $3)
       ON CONFLICT (id_titulo_escritura, id_interesado)
       DO UPDATE SET rol = EXCLUDED.rol`,
      [idTituloEscritura, idInteresado, interesado.rol],
    );
  }
}

export async function crearDocumento(datos, archivo) {
  return conTransaccion(async (cliente) => {
    const { rows: fondos } = await cliente.query('SELECT id FROM fondo WHERE id = $1', [datos.idFondo]);
    if (!fondos[0]) return null;

    let { rows } = await cliente.query(
      'SELECT id FROM protocolo WHERE id_fondo = $1 AND numero = $2 ORDER BY id LIMIT 1',
      [datos.idFondo, datos.protocolo],
    );
    let idProtocolo = rows[0]?.id;
    if (!idProtocolo) {
      ({ rows } = await cliente.query(
        'INSERT INTO protocolo (id_fondo, numero) VALUES ($1, $2) RETURNING id',
        [datos.idFondo, datos.protocolo],
      ));
      idProtocolo = rows[0].id;
    }

    ({ rows } = await cliente.query(
      'SELECT id FROM anio_protocolo WHERE id_protocolo = $1 AND anio = $2',
      [idProtocolo, datos.anio],
    ));
    let idAnio = rows[0]?.id;
    if (!idAnio) {
      ({ rows } = await cliente.query(
        'INSERT INTO anio_protocolo (id_protocolo, anio) VALUES ($1, $2) RETURNING id',
        [idProtocolo, datos.anio],
      ));
      idAnio = rows[0].id;
    }

    ({ rows } = await cliente.query(
      'SELECT id FROM registro WHERE id_anio_protocolo = $1 AND numero = $2 ORDER BY id LIMIT 1',
      [idAnio, datos.registro],
    ));
    let idRegistro = rows[0]?.id;
    if (!idRegistro) {
      ({ rows } = await cliente.query(
        'INSERT INTO registro (id_anio_protocolo, numero) VALUES ($1, $2) RETURNING id',
        [idAnio, datos.registro],
      ));
      idRegistro = rows[0].id;
    }

    ({ rows } = await cliente.query(
      `INSERT INTO titulo_escritura (id_registro, nombre, mes)
       VALUES ($1, $2, $3) RETURNING id`,
      [idRegistro, datos.titulo, datos.mes ?? null],
    ));
    const idTituloEscritura = rows[0].id;

    ({ rows } = await cliente.query(
      `INSERT INTO archivo (
         id_titulo_escritura, id_responsable_descripcion, id_usuario_carga,
         tipologia_documental, serie, subserie, folios, formato, estado_conservacion,
         alcance_contenido, descriptores, fecha_produccion, ruta_archivo,
         nombre_original, tamano_bytes, observaciones, ubicacion_fisica
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15, $16, $17
       ) RETURNING id`,
      [
        idTituloEscritura,
        datos.idResponsableDescripcion ?? null,
        datos.idUsuarioCarga,
        datos.tipologia,
        datos.serie ?? null,
        datos.subserie ?? null,
        datos.folios ?? null,
        archivo.formato,
        datos.estadoConservacion,
        datos.alcanceContenido ?? null,
        datos.descriptores ?? null,
        datos.fechaProduccion ?? null,
        archivo.ruta,
        archivo.nombreOriginal,
        archivo.tamanoBytes,
        datos.observaciones ?? null,
        datos.ubicacionFisica ?? null,
      ],
    ));
    const idArchivo = rows[0].id;

    if (datos.interesados?.length) {
      await guardarInteresados(cliente, idTituloEscritura, datos.interesados);
    }

    return { id: idArchivo, idTituloEscritura };
  });
}

export async function actualizarDocumento(id, cambios, idUsuario) {
  return conTransaccion(async (cliente) => {
    const { rows } = await cliente.query(
      'SELECT id, id_titulo_escritura FROM archivo WHERE id = $1 FOR UPDATE',
      [id],
    );
    const actual = rows[0];
    if (!actual) return null;

    const asignaciones = [];
    const parametros = [];
    const agregar = (columna, valor) => {
      parametros.push(valor);
      asignaciones.push(`${columna} = $${parametros.length}`);
    };

    for (const [campo, columna] of Object.entries(CAMPOS_ACTUALIZABLES)) {
      if (cambios[campo] !== undefined) {
        agregar(columna, cambios[campo]);
      }
    }
    agregar('id_usuario_actualizacion', idUsuario);
    asignaciones.push('fecha_actualizacion = now()');

    parametros.push(id);
    await cliente.query(
      `UPDATE archivo SET ${asignaciones.join(', ')} WHERE id = $${parametros.length}`,
      parametros,
    );

    if (cambios.titulo !== undefined) {
      await cliente.query(
        'UPDATE titulo_escritura SET nombre = $1 WHERE id = $2',
        [cambios.titulo, actual.id_titulo_escritura],
      );
    }

    if (cambios.interesados !== undefined) {
      await guardarInteresados(cliente, actual.id_titulo_escritura, cambios.interesados);
    }

    return { id: actual.id };
  });
}

export async function obtenerArchivo(id) {
  const { rows } = await consultar(
    `SELECT a.ruta_archivo, a.ruta_miniatura, a.formato, te.nombre AS titulo
       FROM archivo a
       JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
      WHERE a.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
