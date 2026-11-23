import path from 'node:path';
import { config } from '../../config/env.js';
import { errores } from '../../common/errors.js';

const EXTENSIONES = new Map([
  ['.pdf', 'PDF/A'],
  ['.tif', 'TIFF'],
  ['.tiff', 'TIFF'],
]);

const MESES = new Map([
  ['enero', 1],
  ['febrero', 2],
  ['marzo', 3],
  ['abril', 4],
  ['mayo', 5],
  ['junio', 6],
  ['julio', 7],
  ['agosto', 8],
  ['septiembre', 9],
  ['setiembre', 9],
  ['octubre', 10],
  ['noviembre', 11],
  ['diciembre', 12],
]);

const CARACTERES_INVALIDOS = /[<>:"|?*\u0000-\u001f]/;
const NOMBRES_RESERVADOS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function normalizarComparacion(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fallo(mensaje) {
  return { valido: false, errores: [mensaje] };
}

function validarSegmento(segmento, posicion, errores) {
  if (!segmento) {
    errores.push(`El nivel ${posicion} está vacío.`);
    return false;
  }
  if (segmento === '.' || segmento === '..') {
    errores.push(`El nivel ${posicion} no puede ser "${segmento}".`);
    return false;
  }
  if (CARACTERES_INVALIDOS.test(segmento)) {
    errores.push(`El nivel ${posicion} contiene caracteres no permitidos.`);
    return false;
  }
  if (/\s$|\.$/.test(segmento)) {
    errores.push(`El nivel ${posicion} no puede terminar en espacio ni en punto.`);
    return false;
  }
  if (NOMBRES_RESERVADOS.test(segmento)) {
    errores.push(`El nivel ${posicion} usa un nombre reservado del sistema.`);
    return false;
  }
  return true;
}

function parsearMes(segmento) {
  const texto = String(segmento ?? '').trim();
  if (normalizarComparacion(texto) === 'sin mes') {
    return { valor: null, texto, error: null };
  }

  const coincidencia = texto.match(/^(\d{1,2})\.\s*(\p{L}+)$/u);
  if (!coincidencia) {
    return {
      valor: null,
      texto,
      error: 'El mes debe tener el formato "N. MES" o ser "SIN MES".',
    };
  }

  const numero = Number(coincidencia[1]);
  const nombre = normalizarComparacion(coincidencia[2]);
  const esperado = MESES.get(nombre);
  if (!esperado || esperado !== numero || numero < 1 || numero > 12) {
    return {
      valor: null,
      texto,
      error: `El mes "${texto}" no corresponde a un mes válido.`,
    };
  }
  return { valor: numero, texto, error: null };
}

function parsearProtocolo(segmento) {
  const coincidencia = String(segmento ?? '').match(/^PROTOCOLO\s+(.+)$/i);
  return coincidencia ? coincidencia[1].trim() : null;
}

function parsearRegistro(segmento) {
  const texto = String(segmento ?? '').trim();
  if (normalizarComparacion(texto) === 'sin registro') {
    return { valor: null, texto };
  }
  const coincidencia = texto.match(/^REGISTRO\s+(.+)$/i);
  return coincidencia ? { valor: coincidencia[1].trim(), texto } : { valor: null, texto };
}

export function validarRutaAcervo(entrada, opciones = {}) {
  const raiz = opciones.raiz ?? path.basename(config.rutas.repositorio);
  const incluirRaiz = opciones.incluirRaiz !== false;
  const crudo = String(entrada ?? '').trim();

  if (!crudo) return fallo('La ruta está vacía.');
  if (crudo.startsWith('/') || crudo.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(crudo)) {
    return fallo('La ruta debe ser relativa al repositorio.');
  }

  const crudos = crudo.replace(/\\/g, '/').split('/');
  if (crudos.some((segmento) => segmento === '')) {
    return fallo('La ruta contiene niveles vacíos.');
  }

  const errores = [];
  let segmentos = crudos;

  if (incluirRaiz) {
    if (crudos.length !== 11) {
      return fallo(
        `La ruta debe tener 11 niveles incluyendo la carpeta raíz "${raiz}" (recibidos ${crudos.length}).`,
      );
    }
    if (normalizarComparacion(crudos[0]) !== normalizarComparacion(raiz)) {
      return fallo(`El primer nivel debe ser la carpeta raíz "${raiz}".`);
    }
    segmentos = crudos.slice(1);
  } else if (crudos.length !== 10) {
    return fallo(`La ruta relativa debe tener 10 niveles (recibidos ${crudos.length}).`);
  }

  segmentos.forEach((segmento, indice) => validarSegmento(segmento, indice + 1, errores));

  const [siglo, fondo, escribano, anioTexto, protocoloTexto, registroTexto, tipologia, mesTexto, interesado, archivo] =
    segmentos;

  if (!/^SIGLO\s+\S+$/iu.test(siglo)) {
    errores.push('El nivel 1 debe tener el formato "SIGLO <número>".');
  }
  if (normalizarComparacion(fondo) !== 'fondo documental') {
    errores.push('El nivel 2 debe ser "FONDO DOCUMENTAL".');
  }
  if (!escribano) {
    errores.push('El nivel 3 debe contener el escribano o notario.');
  }

  const anioNormalizado = normalizarComparacion(anioTexto);
  const esSinAnio = ['sin ano', 'sin anio'].includes(anioNormalizado);
  if (!esSinAnio && !/^\d{4}$/.test(anioTexto)) {
    errores.push('El nivel 4 debe ser un año de cuatro dígitos o "SIN AÑO".');
  }

  const protocolo = parsearProtocolo(protocoloTexto);
  if (!protocolo) {
    errores.push('El nivel 5 debe tener el formato "PROTOCOLO <número>".');
  }

  const registro = parsearRegistro(registroTexto);
  if (!registro.valor && normalizarComparacion(registroTexto) !== 'sin registro') {
    errores.push('El nivel 6 debe tener el formato "REGISTRO <número>" o ser "SIN REGISTRO".');
  }

  if (!tipologia) {
    errores.push('El nivel 7 debe contener la tipología o título de la escritura.');
  }

  const mes = parsearMes(mesTexto);
  if (mes.error) errores.push(mes.error);

  if (!interesado) {
    errores.push('El nivel 9 debe contener el interesado.');
  }

  const extension = path.extname(archivo).toLowerCase();
  const formato = EXTENSIONES.get(extension);
  if (!archivo || !formato) {
    errores.push('El nivel 10 debe ser un archivo PDF/A o TIFF (.pdf, .tif, .tiff).');
  }
  if (archivo && path.basename(archivo) !== archivo) {
    errores.push('El nivel 10 debe ser únicamente el nombre del archivo.');
  }

  const rutaRelativa = segmentos.join('/');
  if (rutaRelativa.length > 500) {
    errores.push('La ruta relativa supera los 500 caracteres permitidos.');
  }

  if (errores.length) {
    return { valido: false, errores };
  }

  return {
    valido: true,
    errores: [],
    rutaOriginal: entrada,
    rutaRelativa,
    segmentos,
    siglo,
    fondo,
    escribano,
    anio: esSinAnio ? null : Number(anioTexto),
    anioTexto,
    protocolo,
    protocoloTexto,
    registro: registro.valor,
    registroTexto,
    tipologia,
    mes: mes.valor,
    mesTexto,
    interesado,
    archivo,
    nombreArchivo: archivo,
    extension: extension.replace('.', ''),
    formato,
    clave: [
      esSinAnio ? 'SIN ANIO' : String(Number(anioTexto)),
      normalizarComparacion(protocolo),
      normalizarComparacion(registro.valor ?? registroTexto),
      normalizarComparacion(tipologia),
      mes.valor ?? 'SIN MES',
    ].join('|'),
  };
}

export function exigirRutaAcervo(entrada, opciones = {}) {
  const resultado = validarRutaAcervo(entrada, opciones);
  if (!resultado.valido) {
    throw errores.rutaInvalida(resultado.errores.join(' '));
  }
  return resultado;
}

export function resolverRutaAcervo(rutaRelativa, base = config.rutas.repositorio) {
  const absoluta = path.resolve(base, rutaRelativa);
  const relativa = path.relative(base, absoluta);
  if (!relativa || relativa.startsWith('..') || path.isAbsolute(relativa)) {
    throw errores.rutaInvalida();
  }
  return absoluta;
}

export function formatoDesdeExtension(nombreArchivo) {
  return EXTENSIONES.get(path.extname(String(nombreArchivo ?? '')).toLowerCase()) ?? null;
}

export function extensionDesdeFormato(formato) {
  return formato === 'TIFF' ? 'tif' : 'pdf';
}
