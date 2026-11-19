import { consultar, conTransaccion } from '../../config/database.js';
import { registrarCambio } from '../gestion/historial.repository.js';

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
    a.fecha_actualizacion,
    a.observaciones,
    a.ubicacion_fisica,
    a.ruta_archivo,
    a.ruta_miniatura,
    a.nombre_original,
    a.tamano_bytes,
    a.anulado,
    a.fecha_anulacion,
    a.motivo_anulacion,
    a.id_usuario_anulacion,
    r.numero AS registro,
    ap.anio AS anio_protocolo,
    p.numero AS protocolo,
    p.id_escribano,
    e.nombre_completo AS escribano,
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
    LEFT JOIN entidad_escribano e ON e.id = p.id_escribano
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
  incluirAnulados = false,
  soloAnulados = false,
}) {
  const parametros = [];
  const parametro = (valor) => {
    parametros.push(valor);
    return `$${parametros.length}`;
  };
  const condiciones = [];

  if (soloAnulados) {
    condiciones.push('a.anulado = true');
  } else if (!incluirAnulados) {
    condiciones.push('a.anulado = false');
  }

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

const CAMPOS_SNAPSHOT = [
  'titulo',
  'tipologia',
  'serie',
  'subserie',
  'folios',
  'formato',
  'estado_conservacion',
  'alcance_contenido',
  'descriptores',
  'fecha_produccion',
  'observaciones',
  'ubicacion_fisica',
  'anulado',
  'fecha_anulacion',
  'motivo_anulacion',
  'id_usuario_anulacion',
];

function fechaIso(valor) {
  if (!valor) return null;
  return valor instanceof Date ? valor.toISOString() : String(valor);
}

function normalizarDocumento(fila) {
  return {
    titulo: fila.titulo,
    tipologia: fila.tipologia,
    serie: fila.serie ?? null,
    subserie: fila.subserie ?? null,
    folios: fila.folios == null ? null : Number(fila.folios),
    formato: fila.formato,
    estado_conservacion: fila.estado_conservacion,
    alcance_contenido: fila.alcance_contenido ?? null,
    descriptores: fila.descriptores ?? null,
    fecha_produccion: fila.fecha_produccion ?? null,
    observaciones: fila.observaciones ?? null,
    ubicacion_fisica: fila.ubicacion_fisica ?? null,
    anulado: Boolean(fila.anulado),
    fecha_anulacion: fechaIso(fila.fecha_anulacion),
    motivo_anulacion: fila.motivo_anulacion ?? null,
    id_usuario_anulacion: fila.id_usuario_anulacion ?? null,
  };
}

async function obtenerSnapshot(cliente, id) {
  const { rows } = await cliente.query(
    `SELECT a.id, a.id_titulo_escritura, te.nombre AS titulo,
            a.tipologia_documental AS tipologia, a.serie, a.subserie, a.folios,
            a.formato, a.estado_conservacion, a.alcance_contenido, a.descriptores,
            a.fecha_produccion, a.observaciones, a.ubicacion_fisica,
            a.anulado, a.fecha_anulacion, a.motivo_anulacion, a.id_usuario_anulacion,
            a.fecha_actualizacion
       FROM archivo a
       JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
      WHERE a.id = $1`,
    [id],
  );
  const fila = rows[0];
  if (!fila) return null;

  const { rows: interesados } = await cliente.query(
    `SELECT i.nombre, i.documento, ri.rol
       FROM rol_interesado ri
       JOIN interesado i ON i.id = ri.id_interesado
      WHERE ri.id_titulo_escritura = $1
      ORDER BY ri.rol, i.nombre`,
    [fila.id_titulo_escritura],
  );

  return {
    ...normalizarDocumento(fila),
    fecha_actualizacion: fila.fecha_actualizacion,
    interesados: interesados.map((interesado) => ({
      nombre: interesado.nombre,
      documento: interesado.documento ?? null,
      rol: interesado.rol,
    })),
  };
}

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

async function aplicarCambios(cliente, id, cambios, idUsuario) {
  const { rows: actuales } = await cliente.query(
    'SELECT id_titulo_escritura, fecha_anulacion, motivo_anulacion, id_usuario_anulacion FROM archivo WHERE id = $1',
    [id],
  );
  const actual = actuales[0];
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

  if (cambios.anulado !== undefined) {
    agregar('anulado', Boolean(cambios.anulado));
    if (cambios.anulado) {
      agregar('fecha_anulacion', cambios.fecha_anulacion ?? actual.fecha_anulacion ?? new Date());
      agregar('id_usuario_anulacion', cambios.id_usuario_anulacion ?? actual.id_usuario_anulacion ?? idUsuario);
      agregar('motivo_anulacion', cambios.motivo_anulacion ?? actual.motivo_anulacion ?? null);
    } else {
      agregar('fecha_anulacion', null);
      agregar('id_usuario_anulacion', null);
      agregar('motivo_anulacion', null);
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

  return actual.id_titulo_escritura;
}

function snapshotSinFecha(snapshot) {
  if (!snapshot) return null;
  const { fecha_actualizacion, ...resto } = snapshot;
  return resto;
}

function estable(valor) {
  if (Array.isArray(valor)) return valor.map(estable);
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    return Object.keys(valor)
      .sort()
      .reduce((resultado, clave) => {
        resultado[clave] = estable(valor[clave]);
        return resultado;
      }, {});
  }
  return valor;
}

function iguales(a, b) {
  return JSON.stringify(estable(a)) === JSON.stringify(estable(b));
}

async function resolverEscribano(cliente, idFondo, idEscribano, nombreEscribano) {
  if (idEscribano) {
    const { rows } = await cliente.query(
      'SELECT id FROM entidad_escribano WHERE id = $1 AND id_fondo = $2',
      [idEscribano, idFondo],
    );
    return rows[0]?.id ?? null;
  }

  const nombre = String(nombreEscribano ?? '').trim();
  if (!nombre) return null;

  let { rows } = await cliente.query(
    `SELECT id
       FROM entidad_escribano
      WHERE id_fondo = $1
        AND lower(f_unaccent(nombre_completo)) = lower(f_unaccent($2))
      ORDER BY id
      LIMIT 1`,
    [idFondo, nombre],
  );
  if (rows[0]) return rows[0].id;

  ({ rows } = await cliente.query(
    'INSERT INTO entidad_escribano (id_fondo, nombre_completo) VALUES ($1, $2) RETURNING id',
    [idFondo, nombre],
  ));
  return rows[0].id;
}

async function resolverResponsable(cliente, idResponsable, nombreResponsable) {
  if (idResponsable) {
    const { rows } = await cliente.query(
      'SELECT id FROM responsable_descripcion WHERE id = $1',
      [idResponsable],
    );
    return rows[0]?.id ?? null;
  }

  const nombre = String(nombreResponsable ?? '').trim();
  if (!nombre) return null;

  let { rows } = await cliente.query(
    `SELECT id
       FROM responsable_descripcion
      WHERE lower(f_unaccent(nombre_completo)) = lower(f_unaccent($1))
      ORDER BY id
      LIMIT 1`,
    [nombre],
  );
  if (rows[0]) return rows[0].id;

  ({ rows } = await cliente.query(
    'INSERT INTO responsable_descripcion (nombre_completo) VALUES ($1) RETURNING id',
    [nombre],
  ));
  return rows[0].id;
}

async function buscarDuplicado(cliente, datos) {
  const { rows } = await cliente.query(
    `SELECT a.id
       FROM archivo a
       JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
       JOIN registro r          ON r.id = te.id_registro
       JOIN anio_protocolo ap   ON ap.id = r.id_anio_protocolo
       JOIN protocolo p         ON p.id = ap.id_protocolo
      WHERE p.id_fondo = $1
        AND p.numero = $2
        AND ap.anio = $3
        AND r.numero = $4
        AND (
          ($5::smallint IS NOT NULL AND a.folios = $5)
          OR (
            $5::smallint IS NULL
            AND a.folios IS NULL
            AND lower(f_unaccent(te.nombre)) = lower(f_unaccent($6))
          )
        )
      ORDER BY a.id
      LIMIT 1`,
    [
      datos.idFondo,
      datos.protocolo,
      datos.anio,
      datos.registro,
      datos.folios ?? null,
      datos.titulo ?? '',
    ],
  );
  return rows[0]?.id ?? null;
}

function claveCache(...partes) {
  return partes
    .map((parte) => String(parte ?? '').trim().toLowerCase())
    .join('|');
}

async function insertarDocumento(cliente, datos, archivo, cache) {
  const claveEscribano = claveCache(
    datos.idFondo,
    datos.idEscribano ? `id:${datos.idEscribano}` : `nombre:${datos.escribano}`,
  );
  let idEscribano = cache?.escribanos.get(claveEscribano);
  if (idEscribano === undefined) {
    idEscribano = await resolverEscribano(
      cliente,
      datos.idFondo,
      datos.idEscribano,
      datos.escribano,
    );
    cache?.escribanos.set(claveEscribano, idEscribano);
  }

  const claveProtocolo = claveCache(datos.idFondo, datos.protocolo);
  let protocolo = cache?.protocolos.get(claveProtocolo);
  if (!protocolo) {
    const { rows } = await cliente.query(
      'SELECT id, id_escribano FROM protocolo WHERE id_fondo = $1 AND numero = $2 ORDER BY id LIMIT 1',
      [datos.idFondo, datos.protocolo],
    );
    protocolo = rows[0] ? { id: rows[0].id, idEscribano: rows[0].id_escribano } : null;
    if (!protocolo) {
      const { rows: creados } = await cliente.query(
        'INSERT INTO protocolo (id_fondo, id_escribano, numero) VALUES ($1, $2, $3) RETURNING id',
        [datos.idFondo, idEscribano, datos.protocolo],
      );
      protocolo = { id: creados[0].id, idEscribano };
    }
    if (idEscribano && !protocolo.idEscribano) {
      await cliente.query('UPDATE protocolo SET id_escribano = $1 WHERE id = $2', [
        idEscribano,
        protocolo.id,
      ]);
      protocolo.idEscribano = idEscribano;
    }
    cache?.protocolos.set(claveProtocolo, protocolo);
  }

  const claveAnio = claveCache(protocolo.id, datos.anio);
  let idAnio = cache?.anios.get(claveAnio);
  if (!idAnio) {
    const { rows } = await cliente.query(
      'SELECT id FROM anio_protocolo WHERE id_protocolo = $1 AND anio = $2',
      [protocolo.id, datos.anio],
    );
    idAnio = rows[0]?.id;
    if (!idAnio) {
      const { rows: creados } = await cliente.query(
        'INSERT INTO anio_protocolo (id_protocolo, anio) VALUES ($1, $2) RETURNING id',
        [protocolo.id, datos.anio],
      );
      idAnio = creados[0].id;
    }
    cache?.anios.set(claveAnio, idAnio);
  }

  const claveRegistro = claveCache(idAnio, datos.registro);
  let idRegistro = cache?.registros.get(claveRegistro);
  if (!idRegistro) {
    const { rows } = await cliente.query(
      'SELECT id FROM registro WHERE id_anio_protocolo = $1 AND numero = $2 ORDER BY id LIMIT 1',
      [idAnio, datos.registro],
    );
    idRegistro = rows[0]?.id;
    if (!idRegistro) {
      const { rows: creados } = await cliente.query(
        'INSERT INTO registro (id_anio_protocolo, numero) VALUES ($1, $2) RETURNING id',
        [idAnio, datos.registro],
      );
      idRegistro = creados[0].id;
    }
    cache?.registros.set(claveRegistro, idRegistro);
  }

  const claveResponsable = claveCache(
    datos.idResponsableDescripcion
      ? `id:${datos.idResponsableDescripcion}`
      : `nombre:${datos.responsableDescripcion}`,
  );
  let idResponsable = cache?.responsables.get(claveResponsable);
  if (idResponsable === undefined) {
    idResponsable = await resolverResponsable(
      cliente,
      datos.idResponsableDescripcion,
      datos.responsableDescripcion,
    );
    cache?.responsables.set(claveResponsable, idResponsable);
  }

  const { rows: titulos } = await cliente.query(
    `INSERT INTO titulo_escritura (id_registro, nombre, mes)
     VALUES ($1, $2, $3) RETURNING id`,
    [idRegistro, datos.titulo, datos.mes ?? null],
  );
  const idTituloEscritura = titulos[0].id;

  const { rows: archivos } = await cliente.query(
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
      idResponsable,
      datos.idUsuarioCarga,
      datos.tipologia,
      datos.serie ?? null,
      datos.subserie ?? null,
      datos.folios ?? null,
      archivo?.formato ?? null,
      datos.estadoConservacion,
      datos.alcanceContenido ?? null,
      datos.descriptores ?? null,
      datos.fechaProduccion ?? null,
      archivo?.ruta ?? null,
      archivo?.nombreOriginal ?? null,
      archivo?.tamanoBytes ?? null,
      datos.observaciones ?? null,
      datos.ubicacionFisica ?? null,
    ],
  );
  const idArchivo = archivos[0].id;

  if (datos.interesados?.length) {
    await guardarInteresados(cliente, idTituloEscritura, datos.interesados);
  }

  return { id: idArchivo, idTituloEscritura };
}

export async function crearDocumento(datos, archivo) {
  return conTransaccion(async (cliente) => {
    const { rows: fondos } = await cliente.query('SELECT id FROM fondo WHERE id = $1', [datos.idFondo]);
    if (!fondos[0]) return null;
    return insertarDocumento(cliente, datos, archivo);
  });
}

export async function crearDocumentosMetadatos(documentos, idUsuario) {
  return conTransaccion(async (cliente) => {
    const { rows: fondos } = await cliente.query('SELECT id FROM fondo');
    const fondosValidos = new Set(fondos.map((fondo) => Number(fondo.id)));
    const cache = {
      escribanos: new Map(),
      protocolos: new Map(),
      anios: new Map(),
      registros: new Map(),
      responsables: new Map(),
    };
    const vistos = new Set();
    const resultados = [];

    for (const datos of documentos) {
      const fila = datos.fila;
      if (!fondosValidos.has(Number(datos.idFondo))) {
        resultados.push({ fila, estado: 'error', mensaje: 'Fondo no encontrado.' });
        continue;
      }

      const clave = claveCache(
        datos.idFondo,
        datos.protocolo,
        datos.anio,
        datos.registro,
        datos.folios ?? '',
        datos.folios == null ? datos.titulo : '',
      );
      if (vistos.has(clave)) {
        resultados.push({ fila, estado: 'omitido', motivo: 'Duplicado en el lote.' });
        continue;
      }
      vistos.add(clave);

      await cliente.query('SAVEPOINT lote_item');
      try {
        const duplicado = await buscarDuplicado(cliente, datos);
        if (duplicado) {
          await cliente.query('ROLLBACK TO SAVEPOINT lote_item');
          await cliente.query('RELEASE SAVEPOINT lote_item');
          resultados.push({
            fila,
            estado: 'omitido',
            motivo: 'Ya existe un documento con el mismo protocolo, registro y folios.',
            id: duplicado,
          });
          continue;
        }

        const creado = await insertarDocumento(
          cliente,
          { ...datos, idUsuarioCarga: idUsuario },
          null,
          cache,
        );
        await cliente.query('RELEASE SAVEPOINT lote_item');
        resultados.push({ fila, estado: 'creado', id: creado.id });
      } catch (error) {
        await cliente.query('ROLLBACK TO SAVEPOINT lote_item');
        await cliente.query('RELEASE SAVEPOINT lote_item');
        resultados.push({ fila, estado: 'error', mensaje: error.message });
      }
    }

    return resultados;
  });
}

export async function actualizarDocumento(
  id,
  cambios,
  idUsuario,
  { fechaEsperada = null, idOperacion = undefined, tipoOperacion = 'EDICION' } = {},
) {
  return conTransaccion(async (cliente) => {
    const { rows } = await cliente.query(
      'SELECT id FROM archivo WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!rows[0]) return { noEncontrado: true };

    const antes = await obtenerSnapshot(cliente, id);
    if (fechaEsperada && fechaIso(antes.fecha_actualizacion) !== fechaEsperada) {
      return { conflicto: true };
    }

    await aplicarCambios(cliente, id, cambios, idUsuario);
    const despues = await obtenerSnapshot(cliente, id);

    await registrarCambio(cliente, {
      idOperacion,
      idUsuario,
      idArchivo: id,
      entidad: 'DOCUMENTO',
      idEntidad: id,
      tipoOperacion,
      antes: snapshotSinFecha(antes),
      despues: snapshotSinFecha(despues),
    });

    return { id, antes, despues };
  });
}

export async function anularDocumento(id, idUsuario, motivo, idOperacion = undefined) {
  return conTransaccion(async (cliente) => {
    const { rows } = await cliente.query(
      'SELECT id, anulado FROM archivo WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!rows[0]) return { noEncontrado: true };
    if (rows[0].anulado) return { yaAnulado: true };

    const antes = await obtenerSnapshot(cliente, id);
    await aplicarCambios(
      cliente,
      id,
      {
        anulado: true,
        fecha_anulacion: new Date(),
        id_usuario_anulacion: idUsuario,
        motivo_anulacion: motivo,
      },
      idUsuario,
    );
    const despues = await obtenerSnapshot(cliente, id);

    await registrarCambio(cliente, {
      idOperacion,
      idUsuario,
      idArchivo: id,
      entidad: 'DOCUMENTO',
      idEntidad: id,
      tipoOperacion: 'ANULACION',
      antes: snapshotSinFecha(antes),
      despues: snapshotSinFecha(despues),
    });

    return { id, antes, despues };
  });
}

export async function restaurarDocumento(id, idUsuario, idOperacion = undefined) {
  return conTransaccion(async (cliente) => {
    const { rows } = await cliente.query(
      'SELECT id, anulado FROM archivo WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!rows[0]) return { noEncontrado: true };
    if (!rows[0].anulado) return { yaActivo: true };

    const antes = await obtenerSnapshot(cliente, id);
    await aplicarCambios(cliente, id, { anulado: false }, idUsuario);
    const despues = await obtenerSnapshot(cliente, id);

    await registrarCambio(cliente, {
      idOperacion,
      idUsuario,
      idArchivo: id,
      entidad: 'DOCUMENTO',
      idEntidad: id,
      tipoOperacion: 'RESTAURACION',
      antes: snapshotSinFecha(antes),
      despues: snapshotSinFecha(despues),
    });

    return { id, antes, despues };
  });
}

export async function reemplazarArchivoDocumento(id, archivo, idUsuario, idOperacion = undefined) {
  return conTransaccion(async (cliente) => {
    const { rows } = await cliente.query(
      'SELECT id, anulado FROM archivo WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!rows[0]) return { noEncontrado: true };
    if (rows[0].anulado) return { anulado: true };

    const antes = await obtenerSnapshot(cliente, id);
    const { rows: anteriores } = await cliente.query(
      'SELECT ruta_archivo, ruta_miniatura, nombre_original, tamano_bytes, formato FROM archivo WHERE id = $1',
      [id],
    );
    const anterior = anteriores[0];

    await cliente.query(
      `UPDATE archivo
          SET ruta_archivo = $1,
              ruta_miniatura = NULL,
              nombre_original = $2,
              tamano_bytes = $3,
              formato = $4,
              id_usuario_actualizacion = $5,
              fecha_actualizacion = now()
        WHERE id = $6`,
      [
        archivo.ruta,
        archivo.nombreOriginal,
        archivo.tamanoBytes,
        archivo.formato,
        idUsuario,
        id,
      ],
    );

    const despues = await obtenerSnapshot(cliente, id);
    await registrarCambio(cliente, {
      idOperacion,
      idUsuario,
      idArchivo: id,
      entidad: 'DOCUMENTO',
      idEntidad: id,
      tipoOperacion: 'REEMPLAZO_ARCHIVO',
      antes: { ...snapshotSinFecha(antes), archivo: anterior },
      despues: {
        ...snapshotSinFecha(despues),
        archivo: {
          ruta_archivo: archivo.ruta,
          ruta_miniatura: null,
          nombre_original: archivo.nombreOriginal,
          tamano_bytes: archivo.tamanoBytes,
          formato: archivo.formato,
        },
      },
    });

    return { id, antes, despues };
  });
}

export async function revertirCambioDocumento(idCambio, idUsuario, { forzar = false } = {}) {
  return conTransaccion(async (cliente) => {
    const { rows: cambios } = await cliente.query(
      'SELECT * FROM historial_cambio WHERE id = $1 FOR UPDATE',
      [idCambio],
    );
    const cambio = cambios[0];
    if (!cambio) return { noEncontrado: true };
    if (
      cambio.entidad !== 'DOCUMENTO' ||
      !cambio.id_archivo ||
      !cambio.antes ||
      cambio.tipo_operacion === 'REEMPLAZO_ARCHIVO'
    ) {
      return { noReversible: true };
    }

    const { rows: bloqueo } = await cliente.query(
      'SELECT id FROM archivo WHERE id = $1 FOR UPDATE',
      [cambio.id_archivo],
    );
    if (!bloqueo[0]) return { noEncontrado: true };

    const actual = await obtenerSnapshot(cliente, cambio.id_archivo);
    const comparable = snapshotSinFecha(actual);
    const esperado = cambio.despues ?? {};

    if (!forzar && !iguales(comparable, esperado)) {
      return { conflicto: true };
    }

    await aplicarCambios(cliente, cambio.id_archivo, cambio.antes, idUsuario);
    const restaurado = await obtenerSnapshot(cliente, cambio.id_archivo);

    const nuevo = await registrarCambio(cliente, {
      idUsuario,
      idArchivo: cambio.id_archivo,
      entidad: 'DOCUMENTO',
      idEntidad: cambio.id_archivo,
      tipoOperacion: 'REVERSION',
      idCambioOrigen: cambio.id,
      antes: snapshotSinFecha(actual),
      despues: snapshotSinFecha(restaurado),
    });

    return {
      id: cambio.id_archivo,
      idCambio: nuevo.id,
      idOperacion: nuevo.id_operacion,
      antes: actual,
      despues: restaurado,
    };
  });
}

export async function obtenerArchivo(id) {
  const { rows } = await consultar(
    `SELECT a.ruta_archivo, a.ruta_miniatura, a.formato, a.anulado, te.nombre AS titulo
       FROM archivo a
       JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
      WHERE a.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function contarCambiosDocumento(id) {
  const { rows } = await consultar(
    'SELECT COUNT(*)::int AS total FROM historial_cambio WHERE id_archivo = $1',
    [id],
  );
  return rows[0]?.total ?? 0;
}

export async function listarInteresadosTitulo(idTituloEscritura) {
  const { rows } = await consultar(
    `SELECT i.nombre, i.documento, ri.rol
       FROM rol_interesado ri
       JOIN interesado i ON i.id = ri.id_interesado
      WHERE ri.id_titulo_escritura = $1
      ORDER BY ri.rol, i.nombre`,
    [idTituloEscritura],
  );
  return rows;
}

export async function obtenerTitulo(id) {
  const { rows } = await consultar(
    'SELECT id, id_registro, nombre, mes FROM titulo_escritura WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

export {
  aplicarCambios as aplicarCambiosDocumento,
  obtenerSnapshot as obtenerSnapshotDocumento,
  snapshotSinFecha,
  CAMPOS_SNAPSHOT,
};
