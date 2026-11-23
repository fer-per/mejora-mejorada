import { claveArchivo, normalizarTexto } from './excel.js';

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

function normalizarNumero(valor) {
  const texto = normalizarTexto(valor);
  if (!texto) return '';
  return /^\d+$/.test(texto) ? String(Number(texto)) : texto;
}

function numeroMes(texto) {
  const coincidencia = String(texto ?? '').trim().match(/^(\d{1,2})\.\s*(\p{L}+)$/u);
  if (coincidencia) {
    const numero = Number(coincidencia[1]);
    if (numero >= 1 && numero <= 12) return numero;
  }
  return MESES.get(normalizarTexto(texto)) ?? null;
}

function clave(...partes) {
  return partes.join('|');
}

export function parsearRutaAcervo(ruta) {
  const partes = String(ruta ?? '').replace(/\\/g, '/').split('/').filter(Boolean);
  if (partes.length !== 11) {
    return {
      valida: false,
      error: `La ruta debe tener 11 niveles incluyendo la raíz (recibidos ${partes.length}).`,
    };
  }

  const [
    raiz,
    siglo,
    fondo,
    escribano,
    anioTexto,
    protocoloTexto,
    registroTexto,
    tipologia,
    mesTexto,
    interesado,
    archivo,
  ] = partes;

  if (!/\.(pdf|tif|tiff)$/i.test(archivo)) {
    return { valida: false, error: 'El archivo debe ser PDF/A o TIFF.' };
  }

  const anio = /^\d{4}$/.test(anioTexto) ? Number(anioTexto) : null;
  const protocolo = protocoloTexto.replace(/^PROTOCOLO\s+/i, '').trim();
  const registro = registroTexto.replace(/^REGISTRO\s+/i, '').trim();
  const mes = numeroMes(mesTexto);

  return {
    valida: true,
    error: null,
    ruta: partes.join('/'),
    raiz,
    siglo,
    fondo,
    escribano,
    anio,
    anioTexto,
    protocolo,
    registro,
    tipologia,
    mes,
    mesTexto,
    interesado,
    archivo,
    claveCompleta: clave(anio ?? 'SIN ANIO', normalizarNumero(protocolo), normalizarNumero(registro), normalizarTexto(tipologia), mes ?? 'SIN MES'),
    claveSinMes: clave(anio ?? 'SIN ANIO', normalizarNumero(protocolo), normalizarNumero(registro), normalizarTexto(tipologia)),
    claveDatos: clave(anio ?? 'SIN ANIO', normalizarNumero(protocolo), normalizarNumero(registro), mes ?? 'SIN MES'),
  };
}

function mesDeFila(fila) {
  const fecha = String(fila?.datos?.fecha_produccion ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const mes = Number(fecha.slice(5, 7));
  return mes >= 1 && mes <= 12 ? mes : null;
}

function clavesDeFila(fila) {
  const datos = fila?.datos ?? {};
  const anio = /^\d{4}$/.test(String(datos.anio ?? '')) ? Number(datos.anio) : null;
  const protocolo = normalizarNumero(datos.protocolo);
  const registro = normalizarNumero(datos.registro);
  const titulo = normalizarTexto(datos.tipologia || datos.titulo);
  const mes = mesDeFila(fila);

  return {
    anio,
    protocolo,
    registro,
    titulo,
    mes,
    completa: clave(anio ?? 'SIN ANIO', protocolo, registro, titulo, mes ?? 'SIN MES'),
    sinMes: clave(anio ?? 'SIN ANIO', protocolo, registro, titulo),
    datos: clave(anio ?? 'SIN ANIO', protocolo, registro, mes ?? 'SIN MES'),
  };
}

function interesadosRuta(ruta, archivo) {
  return [ruta.interesado, archivo.name.replace(/\.[^.]+$/, '')]
    .map(normalizarTexto)
    .filter((nombre) => nombre.length >= 3);
}

function interesadosFila(fila) {
  return (fila.interesados ?? [])
    .map((interesado) => normalizarTexto(interesado.nombre))
    .filter((nombre) => nombre.length >= 3);
}

function puntajeInteresado(ruta, archivo, fila) {
  const enCarpeta = [...new Set(interesadosRuta(ruta, archivo))];
  const enExcel = [...new Set(interesadosFila(fila))];
  if (!enCarpeta.length || !enExcel.length) return 0;

  let puntaje = 0;
  for (const nombreExcel of enExcel) {
    if (
      enCarpeta.some(
        (nombreCarpeta) =>
          nombreCarpeta === nombreExcel ||
          nombreCarpeta.includes(nombreExcel) ||
          nombreExcel.includes(nombreCarpeta),
      )
    ) {
      puntaje += 1;
    }
  }
  return puntaje;
}

function coincideInteresado(ruta, archivo, fila) {
  return puntajeInteresado(ruta, archivo, fila) > 0;
}

function diferencias(fila, ruta) {
  const datos = fila.datos ?? {};
  const claves = clavesDeFila(fila);
  const resultado = [];

  if (claves.anio == null || claves.anio !== ruta.anio) resultado.push('año');
  if (claves.protocolo !== normalizarNumero(ruta.protocolo)) resultado.push('protocolo');
  if (claves.registro !== normalizarNumero(ruta.registro)) resultado.push('registro');
  if (claves.titulo !== normalizarTexto(ruta.tipologia)) resultado.push('título/tipología');
  if (claves.mes != null && claves.mes !== ruta.mes) resultado.push('mes');
  if (interesadosFila(fila).length && !coincideInteresado(ruta, { name: ruta.archivo }, fila)) {
    resultado.push('interesado');
  }
  if (datos.anio && claves.anio == null) resultado.push('año inválido');

  return resultado;
}

function agregarIndice(indice, nombre, valor, elemento) {
  const lista = indice[nombre].get(valor) ?? [];
  lista.push(elemento);
  indice[nombre].set(valor, lista);
}

export function asignarArchivosDesdeCarpeta(filas, archivos) {
  const indice = {
    completa: new Map(),
    sinMes: new Map(),
    datos: new Map(),
  };
  const invalidas = [];
  let validas = 0;

  for (const archivo of archivos) {
    const rutaRelativa = archivo.webkitRelativePath || '';
    const ruta = parsearRutaAcervo(rutaRelativa);
    if (!ruta.valida) {
      invalidas.push({ nombre: archivo.name, error: ruta.error });
      continue;
    }

    const elemento = { ruta, archivo, clave: claveArchivo(archivo) };
    validas += 1;
    agregarIndice(indice, 'completa', ruta.claveCompleta, elemento);
    agregarIndice(indice, 'sinMes', ruta.claveSinMes, elemento);
    agregarIndice(indice, 'datos', ruta.claveDatos, elemento);
  }

  const usados = new Set();
  const resumen = {
    totalArchivos: archivos.length,
    validas,
    invalidas: invalidas.length,
    filasAnalizadas: filas.length,
    asignadas: 0,
    exactas: 0,
    parciales: 0,
    ambiguas: 0,
    sinCoincidencia: 0,
    yaRegistradas: 0,
  };

  const nuevas = filas.map((fila) => {
    const claves = clavesDeFila(fila);
    let grupo = indice.completa.get(claves.completa) ?? [];
    let origen = 'completa';

    if (!grupo.length) {
      grupo = indice.sinMes.get(claves.sinMes) ?? [];
      origen = 'sin mes';
    }
    if (!grupo.length) {
      grupo = indice.datos.get(claves.datos) ?? [];
      origen = 'datos';
    }

    const disponibles = grupo.filter((elemento) => !usados.has(elemento.ruta.ruta));
    const evaluados = disponibles.map((elemento) => ({
      elemento,
      puntaje: puntajeInteresado(elemento.ruta, elemento.archivo, fila),
    }));
    const maximo = evaluados.reduce((maximoActual, item) => Math.max(maximoActual, item.puntaje), 0);
    const mejores = evaluados
      .filter((item) => item.puntaje > 0 && item.puntaje === maximo)
      .map((item) => item.elemento);
    const opciones = mejores.length ? mejores : disponibles;
    const puedeAsignar =
      (maximo > 0 && mejores.length === 1) || (grupo.length === 1 && disponibles.length === 1);

    if (puedeAsignar) {
      const elegida = mejores.length === 1 ? mejores[0] : disponibles[0];
      const diferenciasRuta = diferencias(fila, elegida.ruta);
      usados.add(elegida.ruta.ruta);
      const estado = diferenciasRuta.length ? 'parcial' : 'exacta';

      resumen.asignadas += 1;
      if (estado === 'parcial') resumen.parciales += 1;
      else resumen.exactas += 1;

      return {
        ...fila,
        archivoAsignado: elegida.clave,
        rutaEstado: estado,
        rutaComparada: elegida.ruta.ruta,
        rutaCandidatos: [],
        rutaMensaje:
          estado === 'exacta'
            ? 'Ruta compatible con los datos del Excel.'
            : `Coincidencia parcial (${origen}): difiere ${diferenciasRuta.join(', ')}.`,
      };
    }

    if (opciones.length > 0) {
      resumen.ambiguas += 1;
      return {
        ...fila,
        archivoAsignado: '',
        rutaEstado: 'ambigua',
        rutaComparada: '',
        rutaCandidatos: opciones.map((elemento) => elemento.clave),
        rutaMensaje:
          opciones.length === 1
            ? 'Hay una ruta compatible, pero requiere confirmación manual.'
            : `Varias rutas compatibles (${opciones.length}); seleccione el archivo manualmente.`,
      };
    }

    resumen.sinCoincidencia += 1;
    return {
      ...fila,
      archivoAsignado: '',
      rutaEstado: 'sin_coincidencia',
      rutaComparada: '',
      rutaCandidatos: [],
      rutaMensaje: 'No se encontró una ruta de 11 niveles compatible con esta fila.',
    };
  });

  return {
    filas: nuevas,
    resumen: { ...resumen, detalleInvalidas: invalidas.slice(0, 20) },
  };
}
