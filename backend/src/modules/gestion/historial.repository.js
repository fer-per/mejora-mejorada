import { consultar } from '../../config/database.js';

export async function registrarCambio(
  cliente,
  {
    idOperacion = undefined,
    idUsuario = null,
    idArchivo = null,
    entidad,
    idEntidad = null,
    tipoOperacion,
    idCambioOrigen = null,
    antes = null,
    despues = null,
  },
) {
  const columnas = [
    'id_usuario',
    'id_archivo',
    'entidad',
    'id_entidad',
    'tipo_operacion',
    'id_cambio_origen',
    'antes',
    'despues',
  ];
  const valores = [
    idUsuario,
    idArchivo,
    entidad,
    idEntidad,
    tipoOperacion,
    idCambioOrigen,
    antes == null ? null : JSON.stringify(antes),
    despues == null ? null : JSON.stringify(despues),
  ];

  if (idOperacion) {
    columnas.push('id_operacion');
    valores.push(idOperacion);
  }

  const marcadores = valores.map((_, indice) => `$${indice + 1}`);
  const { rows } = await cliente.query(
    `INSERT INTO historial_cambio (${columnas.join(', ')})
     VALUES (${marcadores.join(', ')})
     RETURNING id, id_operacion, fecha_hora`,
    valores,
  );
  return rows[0];
}

const COLUMNAS_HISTORIAL = `
    hc.id,
    hc.id_operacion,
    hc.id_usuario,
    hc.id_archivo,
    hc.entidad,
    hc.id_entidad,
    hc.tipo_operacion,
    hc.id_cambio_origen,
    hc.antes,
    hc.despues,
    hc.fecha_hora,
    u.nombre_usuario
`;

const RELACION_HISTORIAL = `
    FROM historial_cambio hc
    LEFT JOIN usuario u ON u.id = hc.id_usuario
`;

export async function listarHistorial({ idArchivo, entidad, idEntidad, idOperacion, pagina, porPagina }) {
  const parametros = [];
  const condiciones = [];
  const agregar = (condicion, valor) => {
    parametros.push(valor);
    condiciones.push(condicion.replace('?', `$${parametros.length}`));
  };

  if (idArchivo) agregar('hc.id_archivo = ?', idArchivo);
  if (entidad) agregar('hc.entidad = ?', entidad);
  if (idEntidad) agregar('hc.id_entidad = ?', idEntidad);
  if (idOperacion) agregar('hc.id_operacion = ?', idOperacion);

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows: conteo } = await consultar(
    `SELECT COUNT(*)::int AS total ${RELACION_HISTORIAL} ${where}`,
    parametros,
  );

  const desplazamiento = (pagina - 1) * porPagina;
  const { rows } = await consultar(
    `SELECT ${COLUMNAS_HISTORIAL} ${RELACION_HISTORIAL} ${where}
      ORDER BY hc.fecha_hora DESC, hc.id DESC
      LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    [...parametros, porPagina, desplazamiento],
  );

  return { total: conteo[0].total, filas: rows };
}

export async function obtenerCambio(id, cliente = null) {
  const ejecutar = cliente ? (texto, params) => cliente.query(texto, params) : consultar;
  const { rows } = await ejecutar(
    `SELECT ${COLUMNAS_HISTORIAL} ${RELACION_HISTORIAL} WHERE hc.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listarCambiosOperacion(idOperacion) {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS_HISTORIAL} ${RELACION_HISTORIAL}
      WHERE hc.id_operacion = $1
      ORDER BY hc.id ASC`,
    [idOperacion],
  );
  return rows;
}

export async function listarOperaciones({ pagina, porPagina, tipoOperacion, idUsuario }) {
  const parametros = [];
  const condiciones = [];
  const agregar = (condicion, valor) => {
    parametros.push(valor);
    condiciones.push(condicion.replace('?', `$${parametros.length}`));
  };

  if (tipoOperacion) agregar('hc.tipo_operacion = ?', tipoOperacion);
  if (idUsuario) agregar('hc.id_usuario = ?', idUsuario);

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const { rows: conteo } = await consultar(
    `SELECT COUNT(*)::int AS total FROM (
       SELECT hc.id_operacion ${RELACION_HISTORIAL} ${where} GROUP BY hc.id_operacion
     ) operaciones`,
    parametros,
  );

  const desplazamiento = (pagina - 1) * porPagina;
  const { rows } = await consultar(
    `SELECT hc.id_operacion,
            COUNT(*)::int AS cambios,
            COUNT(DISTINCT hc.id_archivo)::int AS documentos,
            MIN(hc.fecha_hora) AS fecha_inicio,
            MAX(hc.fecha_hora) AS fecha_fin,
            MIN(hc.tipo_operacion) AS tipo_operacion,
            MAX(u.nombre_usuario) AS usuario
       ${RELACION_HISTORIAL}
       ${where}
      GROUP BY hc.id_operacion
      ORDER BY MAX(hc.fecha_hora) DESC
      LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
    [...parametros, porPagina, desplazamiento],
  );

  return { total: conteo[0].total, filas: rows };
}
