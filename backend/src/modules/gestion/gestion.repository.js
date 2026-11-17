import crypto from 'node:crypto';
import { consultar, conTransaccion } from '../../config/database.js';
import {
  aplicarCambiosDocumento,
  obtenerSnapshotDocumento,
  snapshotSinFecha,
} from '../documentos/documentos.repository.js';
import {
  listarHistorial,
  listarOperaciones as listarOperacionesHistorial,
  listarCambiosOperacion,
  registrarCambio,
} from './historial.repository.js';

const TABLAS = {
  repositorios: 'repositorio',
  fondos: 'fondo',
  escribanos: 'entidad_escribano',
  protocolos: 'protocolo',
  anios: 'anio_protocolo',
  registros: 'registro',
  titulos: 'titulo_escritura',
};

const ENTIDADES = {
  repositorios: 'REPOSITORIO',
  fondos: 'FONDO',
  escribanos: 'ESCRIBANO',
  protocolos: 'PROTOCOLO',
  anios: 'ANIO',
  registros: 'REGISTRO',
  titulos: 'TITULO',
};

const COLUMNAS_ESTRUCTURA = {
  repositorios: { siglo: 'siglo', numero: 'numero' },
  fondos: {
    id_repositorio: 'id_repositorio',
    denominacion: 'denominacion',
    descripcion: 'descripcion',
  },
  escribanos: {
    id_fondo: 'id_fondo',
    nombre_completo: 'nombre_completo',
    periodo_ejercicio: 'periodo_ejercicio',
    seccion: 'seccion',
  },
  protocolos: { id_fondo: 'id_fondo', id_escribano: 'id_escribano', numero: 'numero' },
  anios: { id_protocolo: 'id_protocolo', anio: 'anio' },
  registros: { id_anio_protocolo: 'id_anio_protocolo', numero: 'numero' },
  titulos: { id_registro: 'id_registro', nombre: 'nombre', mes: 'mes' },
};

function estable(valor) {
  if (Array.isArray(valor)) return valor.map(estable);
  if (valor && typeof valor === 'object') {
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

async function recalcularContadores(cliente) {
  await cliente.query(`
    UPDATE protocolo p
       SET cantidad_registros = (
         SELECT COUNT(*)::int
           FROM registro r
           JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
          WHERE ap.id_protocolo = p.id
       )
  `);
  await cliente.query(`
    UPDATE registro r
       SET cantidad_documentos = (
         SELECT COUNT(*)::int
           FROM archivo a
           JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
          WHERE te.id_registro = r.id AND a.anulado = false
       )
  `);
  await cliente.query(`
    UPDATE entidad_escribano e
       SET cantidad_protocolos = (
         SELECT COUNT(*)::int FROM protocolo p WHERE p.id_escribano = e.id
       )
  `);
}

async function obtenerVersion(cliente, tipo, id) {
  const { rows } = await cliente.query(
    `SELECT id, xmin::text AS version FROM ${TABLAS[tipo]} WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

async function snapshotEntidad(cliente, tipo, id) {
  const { rows } = await cliente.query(
    `SELECT to_jsonb(t) AS datos FROM ${TABLAS[tipo]} t WHERE t.id = $1`,
    [id],
  );
  return rows[0]?.datos ?? null;
}

async function validarPadres(cliente, tipo, cambios, actual) {
  if (tipo === 'fondos' && cambios.id_repositorio !== undefined) {
    const { rows } = await cliente.query('SELECT id FROM repositorio WHERE id = $1', [cambios.id_repositorio]);
    if (!rows[0]) return 'El repositorio seleccionado no existe.';
  }
  if (tipo === 'escribanos' && cambios.id_fondo !== undefined) {
    const { rows } = await cliente.query('SELECT id FROM fondo WHERE id = $1', [cambios.id_fondo]);
    if (!rows[0]) return 'El fondo seleccionado no existe.';
  }
  if (tipo === 'protocolos') {
    const idFondo = cambios.id_fondo ?? actual.id_fondo;
    const idEscribano = cambios.id_escribano !== undefined ? cambios.id_escribano : actual.id_escribano;
    const { rows: fondos } = await cliente.query('SELECT id FROM fondo WHERE id = $1', [idFondo]);
    if (!fondos[0]) return 'El fondo seleccionado no existe.';
    if (idEscribano != null) {
      const { rows: escribanos } = await cliente.query(
        'SELECT id, id_fondo FROM entidad_escribano WHERE id = $1',
        [idEscribano],
      );
      if (!escribanos[0]) return 'El escribano seleccionado no existe.';
      if (escribanos[0].id_fondo !== idFondo) {
        return 'El escribano seleccionado pertenece a otro fondo.';
      }
    }
  }
  if (tipo === 'anios' && cambios.id_protocolo !== undefined) {
    const { rows } = await cliente.query('SELECT id FROM protocolo WHERE id = $1', [cambios.id_protocolo]);
    if (!rows[0]) return 'El protocolo seleccionado no existe.';
  }
  if (tipo === 'registros' && cambios.id_anio_protocolo !== undefined) {
    const { rows } = await cliente.query('SELECT id FROM anio_protocolo WHERE id = $1', [cambios.id_anio_protocolo]);
    if (!rows[0]) return 'El año seleccionado no existe.';
  }
  if (tipo === 'titulos' && cambios.id_registro !== undefined) {
    const { rows } = await cliente.query('SELECT id FROM registro WHERE id = $1', [cambios.id_registro]);
    if (!rows[0]) return 'El registro seleccionado no existe.';
  }
  return null;
}

const LISTADOS = {
  repositorios: `
    SELECT r.id, r.siglo, r.numero, r.xmin::text AS version,
           (SELECT COUNT(*)::int FROM fondo f WHERE f.id_repositorio = r.id) AS fondos
      FROM repositorio r
     WHERE ($1 = '' OR f_unaccent(r.numero) ILIKE '%' || f_unaccent($1) || '%')
     ORDER BY r.siglo, r.numero`,
  fondos: `
    SELECT f.id, f.id_repositorio, f.denominacion, f.descripcion, f.xmin::text AS version,
           r.siglo, r.numero AS repositorio,
           (SELECT COUNT(*)::int FROM entidad_escribano e WHERE e.id_fondo = f.id) AS escribanos,
           (SELECT COUNT(*)::int FROM protocolo p WHERE p.id_fondo = f.id) AS protocolos
      FROM fondo f
      JOIN repositorio r ON r.id = f.id_repositorio
     WHERE ($1 = '' OR f_unaccent(f.denominacion) ILIKE '%' || f_unaccent($1) || '%')
     ORDER BY f.denominacion`,
  escribanos: `
    SELECT e.id, e.id_fondo, e.nombre_completo, e.periodo_ejercicio, e.seccion,
           e.xmin::text AS version, f.denominacion AS fondo,
           (SELECT COUNT(*)::int FROM protocolo p WHERE p.id_escribano = e.id) AS protocolos
      FROM entidad_escribano e
      JOIN fondo f ON f.id = e.id_fondo
     WHERE ($1 = '' OR f_unaccent(e.nombre_completo) ILIKE '%' || f_unaccent($1) || '%')
     ORDER BY e.nombre_completo`,
  protocolos: `
    SELECT p.id, p.id_fondo, p.id_escribano, p.numero, p.xmin::text AS version,
           f.denominacion AS fondo, e.nombre_completo AS escribano,
           (SELECT COUNT(*)::int FROM anio_protocolo ap WHERE ap.id_protocolo = p.id) AS anios,
           (SELECT COUNT(*)::int FROM registro r
              JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
             WHERE ap.id_protocolo = p.id) AS registros,
           (SELECT COUNT(*)::int FROM archivo a
              JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
              JOIN registro r ON r.id = te.id_registro
              JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
             WHERE ap.id_protocolo = p.id AND a.anulado = false) AS documentos
      FROM protocolo p
      JOIN fondo f ON f.id = p.id_fondo
      LEFT JOIN entidad_escribano e ON e.id = p.id_escribano
     WHERE ($1 = '' OR f_unaccent(p.numero) ILIKE '%' || f_unaccent($1) || '%')
     ORDER BY p.numero::text, p.id`,
  anios: `
    SELECT ap.id, ap.id_protocolo, ap.anio, ap.xmin::text AS version,
           p.numero AS protocolo, f.denominacion AS fondo,
           (SELECT COUNT(*)::int FROM registro r WHERE r.id_anio_protocolo = ap.id) AS registros,
           (SELECT COUNT(*)::int FROM archivo a
              JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
              JOIN registro r ON r.id = te.id_registro
             WHERE r.id_anio_protocolo = ap.id AND a.anulado = false) AS documentos
      FROM anio_protocolo ap
      JOIN protocolo p ON p.id = ap.id_protocolo
      JOIN fondo f ON f.id = p.id_fondo
     WHERE ($1 = '' OR ap.anio::text ILIKE '%' || $1 || '%')
     ORDER BY ap.anio, p.numero::text`,
  registros: `
    SELECT r.id, r.id_anio_protocolo, r.numero, r.xmin::text AS version,
           ap.anio, p.id AS id_protocolo, p.numero AS protocolo,
           (SELECT COUNT(*)::int FROM titulo_escritura te WHERE te.id_registro = r.id) AS titulos,
           (SELECT COUNT(*)::int FROM archivo a
              JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
             WHERE te.id_registro = r.id AND a.anulado = false) AS documentos
      FROM registro r
      JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
      JOIN protocolo p ON p.id = ap.id_protocolo
     WHERE ($1 = '' OR r.numero ILIKE '%' || $1 || '%' OR ap.anio::text ILIKE '%' || $1 || '%')
     ORDER BY ap.anio, p.numero::text, r.numero::text`,
  titulos: `
    SELECT te.id, te.id_registro, te.nombre, te.mes, te.xmin::text AS version,
           r.numero AS registro, ap.anio, p.numero AS protocolo,
           (SELECT COUNT(*)::int FROM archivo a
             WHERE a.id_titulo_escritura = te.id AND a.anulado = false) AS documentos
      FROM titulo_escritura te
      JOIN registro r ON r.id = te.id_registro
      JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
      JOIN protocolo p ON p.id = ap.id_protocolo
     WHERE ($1 = '' OR f_unaccent(te.nombre) ILIKE '%' || f_unaccent($1) || '%')
     ORDER BY te.nombre, te.id`,
};

export async function listarEstructura(tipo, { q = '', pagina, porPagina }) {
  const sql = LISTADOS[tipo];
  if (!sql) return null;

  if (tipo === 'titulos') {
    const { rows: conteo } = await consultar(
      `SELECT COUNT(*)::int AS total
         FROM titulo_escritura te
        WHERE ($1 = '' OR f_unaccent(te.nombre) ILIKE '%' || f_unaccent($1) || '%')`,
      [q],
    );
    const desplazamiento = (pagina - 1) * porPagina;
    const { rows } = await consultar(`${sql} LIMIT $2 OFFSET $3`, [q, porPagina, desplazamiento]);
    return { total: conteo[0].total, items: rows };
  }

  const { rows } = await consultar(sql, [q]);
  return { total: rows.length, items: rows };
}

export async function actualizarEstructura(tipo, id, cambios, versionEsperada, idUsuario) {
  return conTransaccion(async (cliente) => {
    const actual = await obtenerVersion(cliente, tipo, id);
    if (!actual) return { noEncontrado: true };
    if (versionEsperada && versionEsperada !== actual.version) return { conflictoVersion: true };

    const { rows: filas } = await cliente.query(
      `SELECT to_jsonb(t) AS datos FROM ${TABLAS[tipo]} t WHERE t.id = $1`,
      [id],
    );
    const datosActuales = filas[0]?.datos ?? {};

    const errorPadre = await validarPadres(cliente, tipo, cambios, datosActuales);
    if (errorPadre) return { errorPadre };

    const columnas = COLUMNAS_ESTRUCTURA[tipo];
    const asignaciones = [];
    const parametros = [];
    for (const [campo, columna] of Object.entries(columnas)) {
      if (cambios[campo] !== undefined) {
        parametros.push(cambios[campo]);
        asignaciones.push(`${columna} = $${parametros.length}`);
      }
    }

    if (asignaciones.length === 0) return { sinCambios: true };

    const antes = await snapshotEntidad(cliente, tipo, id);
    parametros.push(id);
    try {
      await cliente.query(
        `UPDATE ${TABLAS[tipo]} SET ${asignaciones.join(', ')} WHERE id = $${parametros.length}`,
        parametros,
      );
    } catch (error) {
      if (error.code === '23505') {
        return { conflictoJerarquia: 'Ya existe otra entidad con esos datos en la misma ubicación.' };
      }
      throw error;
    }

    const despues = await snapshotEntidad(cliente, tipo, id);
    await recalcularContadores(cliente);

    const { rows: versionDespues } = await cliente.query(
      `SELECT xmin::text AS version FROM ${TABLAS[tipo]} WHERE id = $1`,
      [id],
    );

    await registrarCambio(cliente, {
      idUsuario,
      entidad: ENTIDADES[tipo],
      idEntidad: id,
      tipoOperacion: 'EDICION_ESTRUCTURA',
      antes,
      despues,
    });

    return { id, antes, despues, version: versionDespues[0]?.version ?? null };
  });
}

async function contarEntidad(tipo, id) {
  if (tipo === 'fondos') {
    const { rows } = await consultar(
      `SELECT
         (SELECT COUNT(*)::int FROM protocolo p WHERE p.id_fondo = $1) AS protocolos,
         (SELECT COUNT(*)::int FROM entidad_escribano e WHERE e.id_fondo = $1) AS escribanos,
         (SELECT COUNT(*)::int FROM archivo a
            JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
            JOIN registro r ON r.id = te.id_registro
            JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
            JOIN protocolo p ON p.id = ap.id_protocolo
           WHERE p.id_fondo = $1 AND a.anulado = false) AS documentos`,
      [id],
    );
    return rows[0];
  }
  if (tipo === 'escribanos') {
    const { rows } = await consultar(
      `SELECT
         (SELECT COUNT(*)::int FROM protocolo p WHERE p.id_escribano = $1) AS protocolos,
         (SELECT COUNT(*)::int FROM archivo a
            JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
            JOIN registro r ON r.id = te.id_registro
            JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
            JOIN protocolo p ON p.id = ap.id_protocolo
           WHERE p.id_escribano = $1 AND a.anulado = false) AS documentos`,
      [id],
    );
    return rows[0];
  }
  if (tipo === 'protocolos') {
    const { rows } = await consultar(
      `SELECT
         (SELECT COUNT(*)::int FROM anio_protocolo ap WHERE ap.id_protocolo = $1) AS anios,
         (SELECT COUNT(*)::int FROM registro r
            JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
           WHERE ap.id_protocolo = $1) AS registros,
         (SELECT COUNT(*)::int FROM titulo_escritura te
            JOIN registro r ON r.id = te.id_registro
            JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
           WHERE ap.id_protocolo = $1) AS titulos,
         (SELECT COUNT(*)::int FROM archivo a
            JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
            JOIN registro r ON r.id = te.id_registro
            JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
           WHERE ap.id_protocolo = $1 AND a.anulado = false) AS documentos`,
      [id],
    );
    return rows[0];
  }
  if (tipo === 'anios') {
    const { rows } = await consultar(
      `SELECT
         (SELECT COUNT(*)::int FROM registro r WHERE r.id_anio_protocolo = $1) AS registros,
         (SELECT COUNT(*)::int FROM titulo_escritura te
            JOIN registro r ON r.id = te.id_registro
           WHERE r.id_anio_protocolo = $1) AS titulos,
         (SELECT COUNT(*)::int FROM archivo a
            JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
            JOIN registro r ON r.id = te.id_registro
           WHERE r.id_anio_protocolo = $1 AND a.anulado = false) AS documentos`,
      [id],
    );
    return rows[0];
  }
  if (tipo === 'registros') {
    const { rows } = await consultar(
      `SELECT
         (SELECT COUNT(*)::int FROM titulo_escritura te WHERE te.id_registro = $1) AS titulos,
         (SELECT COUNT(*)::int FROM archivo a
            JOIN titulo_escritura te ON te.id = a.id_titulo_escritura
           WHERE te.id_registro = $1 AND a.anulado = false) AS documentos`,
      [id],
    );
    return rows[0];
  }
  return {};
}

async function etiquetaEntidad(tipo, id) {
  const consultas = {
    fondos: `SELECT denominacion AS etiqueta FROM fondo WHERE id = $1`,
    escribanos: `SELECT nombre_completo AS etiqueta FROM entidad_escribano WHERE id = $1`,
    protocolos: `SELECT numero AS etiqueta FROM protocolo WHERE id = $1`,
    anios: `SELECT anio::text AS etiqueta FROM anio_protocolo WHERE id = $1`,
    registros: `SELECT numero AS etiqueta FROM registro WHERE id = $1`,
  };
  const { rows } = await consultar(consultas[tipo], [id]);
  return rows[0]?.etiqueta ?? null;
}

export async function previsualizarFusion(tipo, origen, destino) {
  if (origen === destino) return { error: 'El origen y el destino deben ser diferentes.' };
  const etiquetaOrigen = await etiquetaEntidad(tipo, origen);
  const etiquetaDestino = await etiquetaEntidad(tipo, destino);
  if (etiquetaOrigen == null || etiquetaDestino == null) return { noEncontrado: true };

  const conteosOrigen = await contarEntidad(tipo, origen);
  const conteosDestino = await contarEntidad(tipo, destino);

  let conflictos = [];
  if (tipo === 'protocolos') {
    const { rows } = await consultar(
      `SELECT o.anio
         FROM anio_protocolo o
         JOIN anio_protocolo d ON d.anio = o.anio AND d.id_protocolo = $2
        WHERE o.id_protocolo = $1
        ORDER BY o.anio`,
      [origen, destino],
    );
    conflictos = rows.map((fila) => `El año ${fila.anio} ya existe en el destino; se unirán sus registros.`);
  }
  if (tipo === 'anios') {
    const { rows } = await consultar(
      `SELECT o.numero
         FROM registro o
         JOIN registro d ON d.numero = o.numero AND d.id_anio_protocolo = $2
        WHERE o.id_anio_protocolo = $1
        ORDER BY o.numero`,
      [origen, destino],
    );
    conflictos = rows.map(
      (fila) => `El registro ${fila.numero} ya existe en el destino; se unirán sus títulos.`,
    );
  }

  return {
    tipo,
    origen: { id: origen, etiqueta: etiquetaOrigen, ...conteosOrigen },
    destino: { id: destino, etiqueta: etiquetaDestino, ...conteosDestino },
    conflictos,
  };
}

async function fusionarProtocolos(cliente, origen, destino) {
  const { rows: aniosOrigen } = await cliente.query(
    'SELECT id, anio FROM anio_protocolo WHERE id_protocolo = $1 ORDER BY anio, id',
    [origen],
  );

  for (const anioOrigen of aniosOrigen) {
    const { rows: aniosDestino } = await cliente.query(
      'SELECT id FROM anio_protocolo WHERE id_protocolo = $1 AND anio = $2',
      [destino, anioOrigen.anio],
    );

    if (!aniosDestino[0]) {
      await cliente.query(
        'UPDATE anio_protocolo SET id_protocolo = $1 WHERE id = $2',
        [destino, anioOrigen.id],
      );
      continue;
    }

    const idAnioDestino = aniosDestino[0].id;
    const { rows: registrosOrigen } = await cliente.query(
      'SELECT id, numero FROM registro WHERE id_anio_protocolo = $1 ORDER BY id',
      [anioOrigen.id],
    );

    for (const registroOrigen of registrosOrigen) {
      const { rows: registrosDestino } = await cliente.query(
        'SELECT id FROM registro WHERE id_anio_protocolo = $1 AND numero = $2',
        [idAnioDestino, registroOrigen.numero],
      );
      if (registrosDestino[0]) {
        await cliente.query(
          'UPDATE titulo_escritura SET id_registro = $1 WHERE id_registro = $2',
          [registrosDestino[0].id, registroOrigen.id],
        );
        await cliente.query('DELETE FROM registro WHERE id = $1', [registroOrigen.id]);
      } else {
        await cliente.query(
          'UPDATE registro SET id_anio_protocolo = $1 WHERE id = $2',
          [idAnioDestino, registroOrigen.id],
        );
      }
    }
    await cliente.query('DELETE FROM anio_protocolo WHERE id = $1', [anioOrigen.id]);
  }
}

async function fusionarAnios(cliente, origen, destino) {
  const { rows: registrosOrigen } = await cliente.query(
    'SELECT id, numero FROM registro WHERE id_anio_protocolo = $1 ORDER BY id',
    [origen],
  );
  for (const registroOrigen of registrosOrigen) {
    const { rows: registrosDestino } = await cliente.query(
      'SELECT id FROM registro WHERE id_anio_protocolo = $1 AND numero = $2',
      [destino, registroOrigen.numero],
    );
    if (registrosDestino[0]) {
      await cliente.query(
        'UPDATE titulo_escritura SET id_registro = $1 WHERE id_registro = $2',
        [registrosDestino[0].id, registroOrigen.id],
      );
      await cliente.query('DELETE FROM registro WHERE id = $1', [registroOrigen.id]);
    } else {
      await cliente.query(
        'UPDATE registro SET id_anio_protocolo = $1 WHERE id = $2',
        [destino, registroOrigen.id],
      );
    }
  }
}

async function fusionarRegistros(cliente, origen, destino) {
  await cliente.query('UPDATE titulo_escritura SET id_registro = $1 WHERE id_registro = $2', [
    destino,
    origen,
  ]);
}

async function fusionarEscribanos(cliente, origen, destino) {
  await cliente.query('UPDATE protocolo SET id_escribano = $1 WHERE id_escribano = $2', [
    destino,
    origen,
  ]);
}

async function fusionarFondos(cliente, origen, destino) {
  await cliente.query('UPDATE protocolo SET id_fondo = $1 WHERE id_fondo = $2', [destino, origen]);
  await cliente.query('UPDATE entidad_escribano SET id_fondo = $1 WHERE id_fondo = $2', [
    destino,
    origen,
  ]);
}

export async function fusionarEstructura(
  tipo,
  origen,
  destino,
  { versionOrigen = null, versionDestino = null } = {},
  idUsuario,
) {
  if (origen === destino) return { error: 'El origen y el destino deben ser diferentes.' };

  return conTransaccion(async (cliente) => {
    const { rows: bloqueados } = await cliente.query(
      `SELECT id, xmin::text AS version FROM ${TABLAS[tipo]}
        WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
      [[origen, destino]],
    );
    if (bloqueados.length !== 2) return { noEncontrado: true };

    const versionO = bloqueados.find((fila) => fila.id === origen)?.version;
    const versionD = bloqueados.find((fila) => fila.id === destino)?.version;
    if (versionOrigen && versionOrigen !== versionO) return { conflictoVersion: true };
    if (versionDestino && versionDestino !== versionD) return { conflictoVersion: true };

    const conteosOrigen = await contarEntidad(tipo, origen);
    const conteosDestino = await contarEntidad(tipo, destino);
    const antesOrigen = await snapshotEntidad(cliente, tipo, origen);
    const antesDestino = await snapshotEntidad(cliente, tipo, destino);

    if (tipo === 'protocolos') await fusionarProtocolos(cliente, origen, destino);
    if (tipo === 'anios') await fusionarAnios(cliente, origen, destino);
    if (tipo === 'registros') await fusionarRegistros(cliente, origen, destino);
    if (tipo === 'escribanos') await fusionarEscribanos(cliente, origen, destino);
    if (tipo === 'fondos') await fusionarFondos(cliente, origen, destino);

    await cliente.query(`DELETE FROM ${TABLAS[tipo]} WHERE id = $1`, [origen]);
    await recalcularContadores(cliente);

    const resumen = {
      origen,
      destino,
      conteosOrigen,
      conteosDestino,
    };

    await registrarCambio(cliente, {
      idUsuario,
      entidad: ENTIDADES[tipo],
      idEntidad: origen,
      tipoOperacion: 'FUSION',
      antes: antesOrigen,
      despues: { fusionado_en: destino, ...resumen },
    });
    await registrarCambio(cliente, {
      idUsuario,
      entidad: ENTIDADES[tipo],
      idEntidad: destino,
      tipoOperacion: 'FUSION',
      antes: antesDestino,
      despues: resumen,
    });

    return resumen;
  });
}

export async function edicionMasiva(ids, cambios, idUsuario) {
  return conTransaccion(async (cliente) => {
    const ordenados = [...ids].sort((a, b) => a - b);
    const { rows: documentos } = await cliente.query(
      'SELECT id FROM archivo WHERE id = ANY($1::int[]) AND anulado = false ORDER BY id FOR UPDATE',
      [ordenados],
    );

    const encontrados = documentos.map((fila) => fila.id);
    const faltantes = ordenados.filter((id) => !encontrados.includes(id));
    if (faltantes.length > 0) {
      return { faltantes };
    }

    const idOperacion = crypto.randomUUID();
    let afectados = 0;
    for (const id of ordenados) {
      const antes = await obtenerSnapshotDocumento(cliente, id);
      await aplicarCambiosDocumento(cliente, id, cambios, idUsuario);
      const despues = await obtenerSnapshotDocumento(cliente, id);
      await registrarCambio(cliente, {
        idOperacion,
        idUsuario,
        idArchivo: id,
        entidad: 'DOCUMENTO',
        idEntidad: id,
        tipoOperacion: 'EDICION_MASIVA',
        antes: snapshotSinFecha(antes),
        despues: snapshotSinFecha(despues),
      });
      afectados += 1;
    }

    return { idOperacion, afectados };
  });
}

export async function revertirOperacion(idOperacion, idUsuario, { forzar = false } = {}) {
  return conTransaccion(async (cliente) => {
    const { rows: cambios } = await cliente.query(
      `SELECT * FROM historial_cambio
        WHERE id_operacion = $1
        ORDER BY id
        FOR UPDATE`,
      [idOperacion],
    );
    if (cambios.length === 0) return { noEncontrado: true };

    const reversibles = cambios.filter(
      (cambio) =>
        cambio.entidad === 'DOCUMENTO' &&
        cambio.id_archivo &&
        cambio.antes &&
        cambio.tipo_operacion !== 'REEMPLAZO_ARCHIVO',
    );
    if (reversibles.length !== cambios.length) return { noReversible: true };

    for (const cambio of reversibles) {
      await cliente.query('SELECT id FROM archivo WHERE id = $1 FOR UPDATE', [cambio.id_archivo]);
      const actual = await obtenerSnapshotDocumento(cliente, cambio.id_archivo);
      if (!forzar && !iguales(snapshotSinFecha(actual), cambio.despues ?? {})) {
        return { conflicto: true };
      }
    }

    const nuevaOperacion = crypto.randomUUID();
    for (const cambio of reversibles) {
      const actual = await obtenerSnapshotDocumento(cliente, cambio.id_archivo);
      await aplicarCambiosDocumento(cliente, cambio.id_archivo, cambio.antes, idUsuario);
      const restaurado = await obtenerSnapshotDocumento(cliente, cambio.id_archivo);
      await registrarCambio(cliente, {
        idOperacion: nuevaOperacion,
        idUsuario,
        idArchivo: cambio.id_archivo,
        entidad: 'DOCUMENTO',
        idEntidad: cambio.id_archivo,
        tipoOperacion: 'REVERSION',
        idCambioOrigen: cambio.id,
        antes: snapshotSinFecha(actual),
        despues: snapshotSinFecha(restaurado),
      });
    }

    return { idOperacion: nuevaOperacion, afectados: reversibles.length };
  });
}

export async function listarOperaciones({ pagina, porPagina, tipoOperacion, idUsuario }) {
  return listarOperacionesHistorial({ pagina, porPagina, tipoOperacion, idUsuario });
}

export async function obtenerOperacion(idOperacion) {
  const filas = await listarCambiosOperacion(idOperacion);
  if (filas.length === 0) return null;
  return filas;
}

export async function historialEntidad(tipo, id, { pagina, porPagina }) {
  const entidad = ENTIDADES[tipo];
  if (!entidad) return null;
  return listarHistorial({ entidad, idEntidad: id, pagina, porPagina });
}

export async function duplicados() {
  const { rows: protocolos } = await consultar(`
    SELECT p.id_fondo, f.denominacion AS fondo, p.numero,
           COUNT(*)::int AS cantidad,
           json_agg(json_build_object(
             'id', p.id,
             'anios', (SELECT COUNT(*)::int FROM anio_protocolo ap WHERE ap.id_protocolo = p.id),
             'registros', (SELECT COUNT(*)::int FROM registro r
                             JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
                            WHERE ap.id_protocolo = p.id)
           ) ORDER BY p.id) AS entidades
      FROM protocolo p
      JOIN fondo f ON f.id = p.id_fondo
     GROUP BY p.id_fondo, f.denominacion, p.numero
    HAVING COUNT(*) > 1
     ORDER BY p.numero::text
  `);

  const { rows: escribanos } = await consultar(`
    SELECT e.id_fondo, f.denominacion AS fondo,
           lower(f_unaccent(e.nombre_completo)) AS nombre_normalizado,
           COUNT(*)::int AS cantidad,
           json_agg(json_build_object('id', e.id, 'nombre', e.nombre_completo) ORDER BY e.id) AS entidades
      FROM entidad_escribano e
      JOIN fondo f ON f.id = e.id_fondo
     GROUP BY e.id_fondo, f.denominacion, lower(f_unaccent(e.nombre_completo))
    HAVING COUNT(*) > 1
     ORDER BY cantidad DESC, nombre_normalizado
  `);

  const { rows: registros } = await consultar(`
    SELECT r.id_anio_protocolo, ap.anio, p.numero AS protocolo, r.numero,
           COUNT(*)::int AS cantidad,
           json_agg(json_build_object('id', r.id) ORDER BY r.id) AS entidades
      FROM registro r
      JOIN anio_protocolo ap ON ap.id = r.id_anio_protocolo
      JOIN protocolo p ON p.id = ap.id_protocolo
     GROUP BY r.id_anio_protocolo, ap.anio, p.numero, r.numero
    HAVING COUNT(*) > 1
     ORDER BY ap.anio, p.numero::text, r.numero::text
  `);

  const { rows: interesados } = await consultar(`
    SELECT lower(f_unaccent(nombre::text)) AS nombre_normalizado,
           documento,
           COUNT(*)::int AS cantidad,
           json_agg(json_build_object('id', id, 'nombre', nombre) ORDER BY id) AS entidades
      FROM interesado
     GROUP BY lower(f_unaccent(nombre::text)), documento
    HAVING COUNT(*) > 1
     ORDER BY cantidad DESC, nombre_normalizado
     LIMIT 500
  `);

  const { rows: totalInteresados } = await consultar(`
    SELECT COUNT(*)::int AS total FROM (
      SELECT lower(f_unaccent(nombre::text)), documento
        FROM interesado
       GROUP BY 1, 2
      HAVING COUNT(*) > 1
    ) grupos
  `);

  return {
    protocolos,
    escribanos,
    registros,
    interesados,
    totales: {
      protocolos: protocolos.length,
      escribanos: escribanos.length,
      registros: registros.length,
      interesados: totalInteresados[0]?.total ?? 0,
    },
  };
}

export async function resumen() {
  const { rows } = await consultar(`
    SELECT
      (SELECT COUNT(*)::int FROM archivo WHERE anulado = false) AS documentos,
      (SELECT COUNT(*)::int FROM archivo WHERE anulado = true) AS anulados,
      (SELECT COUNT(*)::int FROM titulo_escritura) AS titulos,
      (SELECT COUNT(*)::int FROM interesado) AS interesados,
      (SELECT COUNT(*)::int FROM rol_interesado) AS roles,
      (SELECT COUNT(*)::int FROM registro) AS registros,
      (SELECT COUNT(*)::int FROM anio_protocolo) AS anios,
      (SELECT COUNT(*)::int FROM protocolo) AS protocolos,
      (SELECT COUNT(*)::int FROM entidad_escribano) AS escribanos,
      (SELECT COUNT(*)::int FROM fondo) AS fondos,
      (SELECT COUNT(*)::int FROM repositorio) AS repositorios,
      (SELECT COUNT(*)::int FROM historial_cambio) AS cambios
  `);
  return rows[0];
}
