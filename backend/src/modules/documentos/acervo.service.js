import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config/env.js';
import {
  existeObjeto,
  subirObjeto,
  usaAlmacenamientoRemoto,
} from '../../config/almacenamiento.js';
import { validarArchivoDigital } from '../../common/archivos.js';
import { errores } from '../../common/errors.js';
import { registrarAccion } from '../auditoria/auditoria.repository.js';
import * as repositorio from './documentos.repository.js';
import {
  exigirRutaAcervo,
  normalizarComparacion,
  resolverRutaAcervo,
  validarRutaAcervo,
} from './rutas-acervo.js';

const MAX_CANDIDATOS = 10;

function claveDocumento(fila) {
  return [
    fila.anio == null ? 'SIN ANIO' : String(Number(fila.anio)),
    normalizarComparacion(fila.protocolo),
    normalizarComparacion(fila.registro),
    normalizarComparacion(fila.titulo),
    fila.mes == null ? 'SIN MES' : String(Number(fila.mes)),
  ].join('|');
}

function resumenDocumento(fila) {
  return {
    id: fila.id,
    titulo: fila.titulo,
    anio: fila.anio == null ? null : Number(fila.anio),
    protocolo: fila.protocolo,
    registro: fila.registro,
    mes: fila.mes == null ? null : Number(fila.mes),
    interesados: [...new Set((fila.interesados ?? []).map(String))],
    tieneArchivo: Boolean(fila.ruta_archivo),
    rutaArchivo: fila.ruta_archivo ?? null,
    anulado: Boolean(fila.anulado),
  };
}

function indexarDocumentos(filas) {
  const porRuta = new Map();
  const porClave = new Map();
  const sinArchivo = [];

  for (const fila of filas) {
    const resumen = resumenDocumento(fila);
    if (fila.ruta_archivo) porRuta.set(fila.ruta_archivo.toLowerCase(), resumen);
    if (!fila.ruta_archivo && !fila.anulado) {
      sinArchivo.push(resumen);
      const clave = claveDocumento(fila);
      const lista = porClave.get(clave) ?? [];
      lista.push(resumen);
      porClave.set(clave, lista);
    }
  }

  return { porRuta, porClave, sinArchivo };
}

function interesaCoincide(documento, validacion) {
  const esperados = [
    validacion.interesado,
    path.parse(validacion.archivo).name,
  ]
    .map(normalizarComparacion)
    .filter((valor) => valor.length >= 3);

  return documento.interesados.some((nombre) => {
    const normalizado = normalizarComparacion(nombre);
    return esperados.some(
      (esperado) => normalizado === esperado || normalizado.includes(esperado) || esperado.includes(normalizado),
    );
  });
}

function buscarPorInteres(validacion, documentos) {
  return documentos.filter((documento) => interesaCoincide(documento, validacion));
}

function evaluar(validacion, indice) {
  const registrado = indice.porRuta.get(validacion.rutaRelativa.toLowerCase());
  if (registrado) {
    return {
      estado: 'ya_registrado',
      documento: registrado,
    };
  }

  const candidatosClave = (indice.porClave.get(validacion.clave) ?? []).filter(
    (documento) => !documento.anulado && !documento.tieneArchivo,
  );

  if (candidatosClave.length > 0) {
    const conInteres = candidatosClave.filter((documento) => interesaCoincide(documento, validacion));
    const opciones = conInteres.length > 0 ? conInteres : candidatosClave;

    if (opciones.length === 1) {
      return {
        estado: 'vinculable',
        candidato: opciones[0],
      };
    }

    return {
      estado: 'ambiguo',
      candidatos: opciones.slice(0, MAX_CANDIDATOS),
    };
  }

  const alternativos = buscarPorInteres(validacion, indice.sinArchivo).slice(0, MAX_CANDIDATOS);
  return {
    estado: 'sin_coincidencia',
    requiereAsignacion: alternativos.length > 0,
    candidatos: alternativos,
  };
}

function conteos(items) {
  const resumen = {
    total: items.length,
    validos: 0,
    invalidos: 0,
    yaRegistrados: 0,
    vinculables: 0,
    ambiguos: 0,
    sinCoincidencia: 0,
    noExisten: 0,
  };

  for (const item of items) {
    if (item.valido) resumen.validos += 1;
    else resumen.invalidos += 1;

    switch (item.estado) {
      case 'ya_registrado':
        resumen.yaRegistrados += 1;
        break;
      case 'vinculable':
        resumen.vinculables += 1;
        break;
      case 'ambiguo':
        resumen.ambiguos += 1;
        break;
      case 'no_existe':
        resumen.noExisten += 1;
        break;
      case 'sin_coincidencia':
        resumen.sinCoincidencia += 1;
        break;
      default:
        break;
    }
  }

  return resumen;
}

async function estadistica(absoluta) {
  try {
    const info = await fsp.stat(absoluta);
    return info.isFile() ? info : null;
  } catch {
    return null;
  }
}

async function existeRemoto(rutaRelativa) {
  if (!usaAlmacenamientoRemoto) return false;
  return Boolean(await existeObjeto(rutaRelativa));
}

function itemConEvaluacion(validacion, rutaOriginal, evaluacion, extra = {}) {
  return {
    ruta: rutaOriginal,
    rutaRelativa: validacion.rutaRelativa,
    valido: true,
    formato: validacion.formato,
    ...evaluacion,
    ...extra,
  };
}

export async function validarManifiesto(archivos) {
  const filas = await repositorio.listarDocumentosParaVinculacion();
  const indice = indexarDocumentos(filas);
  const resultados = [];

  for (const entrada of archivos) {
    const rutaOriginal = entrada.ruta ?? entrada;
    const validacion = validarRutaAcervo(rutaOriginal, { incluirRaiz: true });
    if (!validacion.valido) {
      resultados.push({
        ruta: rutaOriginal,
        valido: false,
        estado: 'invalido',
        errores: validacion.errores,
      });
      continue;
    }

    const absoluta = resolverRutaAcervo(validacion.rutaRelativa);
    const info = await estadistica(absoluta);
    const evaluacion = evaluar(validacion, indice);

    if (!info) {
      const candidato = evaluacion.candidato ?? evaluacion.documento ?? null;
      resultados.push(
        itemConEvaluacion(validacion, rutaOriginal, evaluacion, {
          estado: 'no_existe',
          coincidencia: evaluacion.estado,
          disponibleParaSubir: true,
          ...(candidato ? { candidato } : {}),
        }),
      );
      continue;
    }

    const extra = {
      existe: true,
      tamanoBytes: info.size,
      tamanoCoincide:
        entrada.tamanoBytes == null ? null : Number(entrada.tamanoBytes) === info.size,
    };

    if (evaluacion.estado === 'no_existe') {
      extra.disponibleParaSubir = true;
    }

    resultados.push(itemConEvaluacion(validacion, rutaOriginal, evaluacion, extra));
  }

  return {
    ...conteos(resultados),
    resultados,
  };
}

async function recorrerRepositorio(directorio, base, acumulado) {
  const entradas = await fsp.readdir(directorio, { withFileTypes: true });

  for (const entrada of entradas) {
    if (entrada.isSymbolicLink()) continue;
    const absoluta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      await recorrerRepositorio(absoluta, base, acumulado);
    } else if (entrada.isFile()) {
      const relativa = path.relative(base, absoluta).split(path.sep).join('/');
      acumulado.push({ rutaRelativa: relativa, absoluta });
    }
  }
}

export async function escanearRepositorio() {
  const base = path.resolve(config.rutas.repositorio);
  const inicio = Date.now();

  try {
    const info = await fsp.stat(base);
    if (!info.isDirectory()) throw new Error('no es un directorio');
  } catch {
    throw errores.noEncontrado('Repositorio digital');
  }

  const archivos = [];
  await recorrerRepositorio(base, base, archivos);

  const filas = await repositorio.listarDocumentosParaVinculacion();
  const indice = indexarDocumentos(filas);
  const actionables = [];
  const invalidos = [];
  const encontradas = new Set();
  let yaRegistrados = 0;
  let totalInvalidos = 0;

  for (const archivo of archivos) {
    encontradas.add(archivo.rutaRelativa.toLowerCase());
    const validacion = validarRutaAcervo(archivo.rutaRelativa, { incluirRaiz: false });

    if (!validacion.valido) {
      totalInvalidos += 1;
      if (invalidos.length < 100) {
        invalidos.push({
          ruta: archivo.rutaRelativa,
          errores: validacion.errores,
        });
      }
      continue;
    }

    const evaluacion = evaluar(validacion, indice);
    if (evaluacion.estado === 'ya_registrado') {
      yaRegistrados += 1;
      continue;
    }

    actionables.push(
      itemConEvaluacion(
        validacion,
        `${path.basename(base)}/${archivo.rutaRelativa}`,
        evaluacion,
        { existe: true },
      ),
    );
  }

  const faltantesTodas = filas.filter(
    (fila) =>
      fila.ruta_archivo &&
      !encontradas.has(String(fila.ruta_archivo).toLowerCase()),
  );
  const faltantes = faltantesTodas
    .slice(0, 100)
    .map((fila) => ({ id: fila.id, titulo: fila.titulo, rutaArchivo: fila.ruta_archivo }));

  return {
    ...conteos(actionables),
    totalArchivos: archivos.length,
    yaRegistrados,
    invalidos: totalInvalidos,
    actionables,
    detalleInvalidos: invalidos,
    faltantesEnDisco: faltantesTodas.length,
    detalleFaltantes: faltantes,
    duracionMs: Date.now() - inicio,
  };
}

export async function vincularAsignaciones(asignaciones, usuario) {
  const resultados = [];

  for (const asignacion of asignaciones) {
    const rutaOriginal = asignacion.ruta;
    try {
      const validacion = exigirRutaAcervo(rutaOriginal, { incluirRaiz: true });
      const absoluta = resolverRutaAcervo(validacion.rutaRelativa);
      const info = await estadistica(absoluta);

      if (!info) {
        resultados.push({
          ruta: rutaOriginal,
          estado: 'error',
          mensaje: 'El archivo no existe en el repositorio.',
        });
        continue;
      }

      const documento = await repositorio.obtenerDocumentoParaVinculacion(
        Number(asignacion.id_documento ?? asignacion.idDocumento),
      );
      if (!documento) throw errores.noEncontrado('Documento');
      if (documento.anulado) throw errores.operacionNoPermitida('El documento está anulado.');

      const mismaRuta =
        documento.ruta_archivo &&
        String(documento.ruta_archivo).toLowerCase() === validacion.rutaRelativa.toLowerCase();
      if (documento.ruta_archivo && !mismaRuta) {
        throw errores.conflictoRuta('El documento ya tiene otro archivo vinculado.');
      }
      if (mismaRuta) {
        resultados.push({
          ruta: rutaOriginal,
          estado: 'ya_registrado',
          id: documento.id,
          titulo: documento.titulo,
        });
        continue;
      }

      const existente = await repositorio.buscarDocumentoPorRuta(validacion.rutaRelativa);
      if (existente) {
        throw errores.conflictoRuta(
          `La ruta ya está vinculada al documento #${existente.id}.`,
        );
      }

      const vinculado = await repositorio.vincularArchivoDocumento(
        documento.id,
        {
          ruta: validacion.rutaRelativa,
          nombreOriginal: validacion.nombreArchivo,
          tamanoBytes: info.size,
          formato: validacion.formato,
        },
        usuario.id,
      );
      if (!vinculado) {
        throw errores.conflictoRuta('No fue posible vincular el archivo; recargue e intente nuevamente.');
      }

      await registrarAccion({
        idUsuario: usuario.id,
        tipoAccion: 'VINCULACION_ARCHIVO_ACERVO',
        descripcion: `Vinculación del documento #${documento.id} "${documento.titulo}" con la ruta "${validacion.rutaRelativa}" (${info.size} bytes).`,
      });

      resultados.push({
        ruta: rutaOriginal,
        estado: 'vinculado',
        id: documento.id,
        titulo: documento.titulo,
        tamanoBytes: info.size,
      });
    } catch (error) {
      if (error.code === '23505') {
        resultados.push({
          ruta: rutaOriginal,
          estado: 'error',
          mensaje: 'La ruta ya está registrada por otro documento.',
        });
      } else {
        resultados.push({
          ruta: rutaOriginal,
          estado: 'error',
          mensaje: error.mensaje ?? error.message,
        });
      }
    }
  }

  const vinculados = resultados.filter((item) => item.estado === 'vinculado').length;
  return {
    total: resultados.length,
    vinculados,
    errores: resultados.length - vinculados,
    resultados,
  };
}

export async function subirArchivoAcervo(datos, archivoRecibido, usuario) {
  if (!archivoRecibido) {
    throw errores.archivoInvalido('Debe adjuntar un archivo PDF/A o TIFF en el campo "archivo".');
  }

  const validacion = exigirRutaAcervo(datos.ruta, { incluirRaiz: true });
  const { formato, extension, tipoContenido } = validarArchivoDigital({
    buffer: archivoRecibido.buffer,
    nombreOriginal: archivoRecibido.originalname,
    tipoMime: archivoRecibido.mimetype,
  });

  const extensionRuta = path.extname(validacion.nombreArchivo).replace('.', '').toLowerCase();
  if (extensionRuta !== extension) {
    throw errores.archivoInvalido('El contenido del archivo no coincide con la extensión de la ruta.');
  }
  if (formato !== validacion.formato) {
    throw errores.archivoInvalido('El formato del archivo no coincide con la ruta.');
  }

  const documento = await repositorio.obtenerDocumentoParaVinculacion(
    Number(datos.id_documento ?? datos.idDocumento),
  );
  if (!documento) throw errores.noEncontrado('Documento');
  if (documento.anulado) throw errores.operacionNoPermitida('El documento está anulado.');
  const mismaRuta =
    documento.ruta_archivo &&
    String(documento.ruta_archivo).toLowerCase() === validacion.rutaRelativa.toLowerCase();
  if (documento.ruta_archivo && !mismaRuta) {
    throw errores.conflictoRuta('El documento ya tiene otro archivo vinculado.');
  }

  const existente = await repositorio.buscarDocumentoPorRuta(validacion.rutaRelativa);
  if (existente && existente.id !== documento.id) {
    throw errores.conflictoRuta(`La ruta ya está vinculada al documento #${existente.id}.`);
  }

  const absoluta = resolverRutaAcervo(validacion.rutaRelativa);
  const info = usaAlmacenamientoRemoto
    ? await existeRemoto(validacion.rutaRelativa)
    : Boolean(await estadistica(absoluta));
  let escrito = false;

  if (!info) {
    if (usaAlmacenamientoRemoto) {
      await subirObjeto(validacion.rutaRelativa, archivoRecibido.buffer, tipoContenido);
    } else {
      await fsp.mkdir(path.dirname(absoluta), { recursive: true });
      await fsp.writeFile(absoluta, archivoRecibido.buffer);
    }
    escrito = true;
  }

  let vinculado;
  try {
    vinculado = await repositorio.vincularArchivoDocumento(
      documento.id,
      {
        ruta: validacion.rutaRelativa,
        nombreOriginal: validacion.nombreArchivo,
        tamanoBytes: archivoRecibido.size,
        formato,
      },
      usuario.id,
    );
    if (!vinculado) {
      throw errores.conflictoRuta('No fue posible vincular el archivo; recargue e intente nuevamente.');
    }
  } catch (error) {
    if (escrito && !usaAlmacenamientoRemoto) {
      await fsp.unlink(absoluta).catch(() => {});
    }
    throw error;
  }

  await registrarAccion({
    idUsuario: usuario.id,
    tipoAccion: 'CARGA_ARCHIVO_ACERVO',
    descripcion: `Carga y vinculación del documento #${documento.id} "${documento.titulo}" en la ruta "${validacion.rutaRelativa}" (${archivoRecibido.size} bytes).`,
  });

  return {
    id: documento.id,
    titulo: documento.titulo,
    ruta: validacion.rutaRelativa,
    formato,
    tamanoBytes: archivoRecibido.size,
  };
}
