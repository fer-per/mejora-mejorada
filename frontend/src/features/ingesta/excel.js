export const ALIAS_COLUMNAS = {
  registro: [
    'n de registro',
    'n registro',
    'numero de registro',
    'numero registro',
    'registro',
  ],
  escribano: ['escribano notario', 'escribano o notario', 'escribano', 'notario', 'escribano notarial'],
  protocolo: [
    'n de prot',
    'n de protocolo',
    'n protocolo',
    'numero de protocolo',
    'numero protocolo',
    'protocolo',
  ],
  folios: [
    'n de folios',
    'n folios',
    'nro de folios',
    'nro folios',
    'numero de folios',
    'numero folios',
    'cantidad de folios',
    'folios',
  ],
  ubicacion_fisica: ['data topica lugar', 'data topica', 'ubicacion fisica', 'ubicacion', 'localizacion fisica'],
  fecha_inicio: ['fecha inicial'],
  fecha_fin: ['fecha final'],
  fecha_produccion: ['fecha de produccion', 'fecha produccion'],
  fecha_descripcion: ['fecha de la descripcion', 'fecha descripcion'],
  titulo: ['titulo escritura', 'titulo o escritura', 'titulo', 'escritura', 'denominacion del documento'],
  tipologia: ['tipologia', 'tipologia documental', 'tipo documental', 'tipo de documento', 'clase documental'],
  interesado_1: ['interesado 1', 'interesado uno'],
  interesado_2: ['interesado 2', 'interesado dos'],
  interesado_3: ['interesado 3', 'interesado tres'],
  alcance_contenido: ['alcance y contenido', 'alcance contenido', 'alcance'],
  estado_conservacion: ['estado de conservacion', 'estado conservacion', 'conservacion'],
  observaciones: ['observaciones', 'notas', 'observacion'],
  responsable_descripcion: [
    'responsable de la descripcion',
    'responsable descripcion',
    'responsable',
  ],
  serie: ['serie', 'serie documental'],
  subserie: ['subserie', 'sub serie'],
  descriptores: ['descriptores', 'palabras clave', 'descriptor'],
  archivo: ['archivo', 'archivo digital', 'nombre del archivo', 'nombre archivo', 'documento digital', 'file', 'filename'],
};

const CAMPOS_OBLIGATORIOS = ['registro', 'protocolo'];

const TEXTO_INSTRUCTIVO =
  /NOMBRES Y APELLIDOS|SIN ESPACIO|MAYUSCULA|FECHA CORTA|BUENO\s*\/\s*REGULAR|GLOSARIO|PRIMER NOMBRE/i;

export function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizarCabecera(valor) {
  return normalizarTexto(valor);
}

function textoPlano(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  if (typeof valor === 'object') {
    if (Array.isArray(valor.richText)) {
      return valor.richText.map((parte) => parte.text ?? '').join('').trim();
    }
    if (valor.text !== undefined) return String(valor.text).trim();
    if (valor.result !== undefined) return textoPlano(valor.result);
    if (valor.formula !== undefined) return '';
  }
  return '';
}

function fechaCalendarioValida(fecha) {
  const coincidencia = String(fecha ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!coincidencia) return false;
  const [, anio, mes, dia] = coincidencia.map(Number);
  const comprobacion = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    comprobacion.getUTCFullYear() === anio &&
    comprobacion.getUTCMonth() === mes - 1 &&
    comprobacion.getUTCDate() === dia
  );
}

function fechaAiso(valor) {
  if (valor instanceof Date) {
    const anio = valor.getUTCFullYear();
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(valor.getUTCDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const fecha = new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86400000);
    return fechaAiso(fecha);
  }

  const texto = textoPlano(valor);
  if (!texto) return '';

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return texto;

  const latino = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (latino) {
    const [, dia, mes, anio] = latino;
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  const fecha = new Date(texto);
  if (!Number.isNaN(fecha.getTime())) return fechaAiso(fecha);
  return '';
}

function contarFolios(valor) {
  const texto = textoPlano(valor).trim();
  if (!texto || /^sin folios/i.test(texto)) return null;
  const numeros = [...texto.matchAll(/\d+/g)]
    .map((coincidencia) => Number(coincidencia[0]))
    .filter((numero) => Number.isFinite(numero));
  if (!numeros.length) return null;
  if (numeros.length === 1) return 1;
  const [inicio, fin] = numeros;
  if (fin >= inicio && fin - inicio < 10000) return fin - inicio + 1;
  return null;
}

function coincide(texto, alias) {
  if (!texto || !alias) return false;
  return (
    texto === alias ||
    texto.endsWith(` ${alias}`) ||
    texto.startsWith(`${alias} `)
  );
}

function construirIndice(encabezados) {
  const indice = {};
  const normalizados = encabezados
    .map((encabezado, columna) =>
      columna === 0 ? null : { columna, texto: normalizarCabecera(encabezado) },
    )
    .filter(Boolean);

  for (const [campo, alias] of Object.entries(ALIAS_COLUMNAS)) {
    for (const nombre of alias) {
      const buscado = normalizarCabecera(nombre);
      const encontrado = normalizados.find(({ texto }) => coincide(texto, buscado));
      if (encontrado) {
        indice[campo] = encontrado.columna;
        break;
      }
    }
  }

  return indice;
}

function leerValor(fila, indice, campo) {
  const columna = indice[campo];
  if (columna === undefined) return '';
  return textoPlano(fila.getCell(columna).value);
}

function leerCrudo(fila, indice, campo) {
  const columna = indice[campo];
  if (columna === undefined) return undefined;
  return fila.getCell(columna).value;
}

function posixRelativa(base, objetivo) {
  const partesBase = String(base).split('/').filter(Boolean);
  const partesObjetivo = String(objetivo).split('/').filter(Boolean);
  let comunes = 0;
  while (
    comunes < partesBase.length &&
    comunes < partesObjetivo.length &&
    partesBase[comunes] === partesObjetivo[comunes]
  ) {
    comunes += 1;
  }
  const subida = partesBase.length - comunes;
  return [...Array(subida).fill('..'), ...partesObjetivo.slice(comunes)].join('/');
}

async function cargarLibro(archivo) {
  const [{ default: ExcelJS }, { default: JSZip }] = await Promise.all([
    import('exceljs'),
    import('jszip'),
  ]);

  const buffer = await archivo.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  let modificado = false;

  for (const nombre of Object.keys(zip.files)) {
    if (!/^xl\/worksheets\/_rels\/.+\.rels$/.test(nombre)) continue;
    const xml = await zip.file(nombre).async('string');
    const base = nombre.replace(/\/_rels\/[^/]+$/, '');
    const corregido = xml.replace(/Target="\/([^"]+)"/g, (_, objetivo) => {
      modificado = true;
      return `Target="${posixRelativa(base, objetivo)}"`;
    });
    if (corregido !== xml) zip.file(nombre, corregido);
  }

  const libro = new ExcelJS.Workbook();
  const contenido = modificado ? await zip.generateAsync({ type: 'arraybuffer' }) : buffer;
  await libro.xlsx.load(contenido);
  return libro;
}

function leerContexto(hoja, hasta) {
  const contexto = {};
  const limiteFilas = Math.min(hasta, hoja.rowCount);
  const limiteColumnas = Math.min(hoja.columnCount, 30);

  for (let fila = 1; fila < limiteFilas; fila += 1) {
    for (let columna = 1; columna <= limiteColumnas; columna += 1) {
      const texto = textoPlano(hoja.getRow(fila).getCell(columna).value);
      const coincidencia = texto.match(/^([^:]{2,50}):\s*(.+)$/);
      if (!coincidencia) continue;
      const clave = normalizarTexto(coincidencia[1]);
      if (clave && !contexto[clave]) contexto[clave] = coincidencia[2].trim();
    }
  }

  return contexto;
}

function detectarCabecera(hoja) {
  const limite = Math.min(hoja.rowCount, 60);
  const columnas = Math.min(hoja.columnCount, 40);

  for (let fila = 1; fila <= limite; fila += 1) {
    const valores = [];
    for (let columna = 1; columna <= columnas; columna += 1) {
      valores[columna] = textoPlano(hoja.getRow(fila).getCell(columna).value);
    }
    const indice = construirIndice(valores);
    const encontrados = ['registro', 'protocolo', 'titulo', 'escribano', 'folios'].filter(
      (campo) => indice[campo] !== undefined,
    ).length;

    if (indice.registro !== undefined && indice.protocolo !== undefined && encontrados >= 3) {
      const filaSubencabezado = fila + 1;
      let tieneSubencabezado = false;
      if (filaSubencabezado <= limite) {
        const sub = [];
        for (let columna = 1; columna <= columnas; columna += 1) {
          sub[columna] = textoPlano(hoja.getRow(filaSubencabezado).getCell(columna).value);
        }
        tieneSubencabezado = sub.some((valor) =>
          /^fecha (inicial|final)$/.test(normalizarTexto(valor)),
        );
      }
      return {
        filaCabecera: fila,
        filaSubencabezado: tieneSubencabezado ? filaSubencabezado : null,
        filaInicioDatos: tieneSubencabezado ? filaSubencabezado + 1 : fila + 1,
      };
    }
  }

  return { filaCabecera: 1, filaSubencabezado: null, filaInicioDatos: 2 };
}

function construirEncabezados(hoja, estructura) {
  const encabezados = [];
  const limite = Math.min(hoja.columnCount, 40);
  for (let columna = 1; columna <= limite; columna += 1) {
    const principal = textoPlano(hoja.getRow(estructura.filaCabecera).getCell(columna).value);
    const secundario = estructura.filaSubencabezado
      ? textoPlano(hoja.getRow(estructura.filaSubencabezado).getCell(columna).value)
      : '';
    encabezados[columna] = [principal, secundario].filter(Boolean).join(' ');
  }
  return encabezados;
}

function esFilaInstructiva(valores) {
  const texto = Object.values(valores).join(' ');
  if (TEXTO_INSTRUCTIVO.test(texto)) return true;

  const primera = normalizarTexto(valores.registro);
  if (/^(protocolo|registro) n/.test(primera)) return true;

  const titulo = normalizarTexto(valores.titulo);
  if (/^(protocolo|registro) n/.test(titulo)) return true;

  const noVacias = Object.values(valores)
    .map((valor) => normalizarTexto(valor))
    .filter(Boolean);
  if (noVacias.length >= 3 && new Set(noVacias).size === 1) return true;

  return false;
}

function limpiar(valor) {
  return String(valor ?? '').replace(/\s+/g, ' ').trim();
}

function interesadosDeFila(valores) {
  return [valores.interesado_1, valores.interesado_2, valores.interesado_3]
    .map((nombre, indice) => ({
      nombre: limpiar(nombre),
      rol: `Interesado ${indice + 1}`,
    }))
    .filter((interesado) => interesado.nombre);
}

export async function leerExcel(archivo) {
  const libro = await cargarLibro(archivo);
  const hoja =
    libro.worksheets.find((item) => normalizarTexto(item.name) === 'documentos') ??
    libro.worksheets[0];

  if (!hoja) {
    throw new Error('El archivo Excel no contiene hojas de cálculo.');
  }

  const estructura = detectarCabecera(hoja);
  const contexto = leerContexto(hoja, estructura.filaCabecera);
  const encabezados = construirEncabezados(hoja, estructura);
  const indice = construirIndice(encabezados);
  const faltantes = CAMPOS_OBLIGATORIOS.filter((campo) => indice[campo] === undefined);

  if (faltantes.length) {
    throw new Error(
      `Faltan columnas obligatorias en el Excel: ${faltantes
        .map((campo) => campo.replace('_', ' '))
        .join(', ')}. Descargue la plantilla para revisar el formato.`,
    );
  }

  const filas = [];
  const claves = new Map();
  const fondoContexto = contexto.fondo ?? '';
  const codigoFondo = contexto['codigo del fondo'] ?? '';
  const serieContexto = contexto.serie ?? '';
  const productorContexto = contexto.productor ?? '';

  for (let numero = estructura.filaInicioDatos; numero <= hoja.rowCount; numero += 1) {
    const fila = hoja.getRow(numero);
    const valores = Object.fromEntries(
      Object.keys(ALIAS_COLUMNAS).map((campo) => [campo, leerValor(fila, indice, campo)]),
    );

    const vacia = Object.values(valores).every((valor) => !String(valor).trim());
    if (vacia || esFilaInstructiva(valores)) continue;

    const fechaProduccion =
      fechaAiso(leerCrudo(fila, indice, 'fecha_inicio')) ||
      fechaAiso(leerCrudo(fila, indice, 'fecha_fin')) ||
      fechaAiso(leerCrudo(fila, indice, 'fecha_produccion'));
    const fechaDescripcion = fechaAiso(leerCrudo(fila, indice, 'fecha_descripcion'));
    const anio = fechaProduccion ? Number(fechaProduccion.slice(0, 4)) : '';

    const registro = limpiar(valores.registro);
    const protocolo = limpiar(valores.protocolo);
    const titulo = limpiar(valores.titulo) || limpiar(valores.tipologia);
    const foliosRango = limpiar(valores.folios);
    const escribano =
      limpiar(valores.escribano) ||
      productorContexto ||
      limpiar(serieContexto.replace(/^notario\s+/i, ''));

    const partesClave = [protocolo, anio || '', registro, foliosRango || titulo].map((parte) =>
      normalizarTexto(parte),
    );
    const claveDuplicado = partesClave.join('|');

    const filaExcel = {
      numeroFila: numero,
      datos: {
        id_fondo: '',
        fondo: limpiar(valores.fondo) || fondoContexto,
        codigo_fondo: codigoFondo,
        escribano,
        protocolo,
        anio,
        registro,
        titulo,
        tipologia: limpiar(valores.tipologia) || titulo,
        folios: contarFolios(foliosRango),
        folios_rango: foliosRango,
        ubicacion_fisica: limpiar(valores.ubicacion_fisica),
        fecha_produccion: fechaProduccion,
        fecha_descripcion: fechaDescripcion,
        estado_conservacion: limpiar(valores.estado_conservacion),
        serie: limpiar(valores.serie) || serieContexto,
        subserie: limpiar(valores.subserie),
        alcance_contenido: limpiar(valores.alcance_contenido),
        descriptores: limpiar(valores.descriptores),
        observaciones: limpiar(valores.observaciones),
        responsable_descripcion: limpiar(valores.responsable_descripcion),
        archivo: limpiar(valores.archivo),
      },
      interesados: interesadosDeFila(valores),
    };

    if (partesClave.some(Boolean)) {
      if (claves.has(claveDuplicado)) {
        filaExcel.duplicado = true;
        filaExcel.filaDuplicada = claves.get(claveDuplicado);
      } else {
        claves.set(claveDuplicado, numero);
      }
    }

    filas.push(filaExcel);
  }

  if (!filas.length) {
    throw new Error('El Excel no contiene filas de datos debajo del encabezado.');
  }

  return {
    filas,
    contexto,
    indice,
    tieneColumnaArchivo: indice.archivo !== undefined,
    filaCabecera: estructura.filaCabecera,
    filaInicioDatos: estructura.filaInicioDatos,
  };
}

export function claveArchivo(archivo) {
  return archivo?.webkitRelativePath || archivo?.name || '';
}

function nombreSinExtension(nombre) {
  return String(nombre ?? '').replace(/\.[^.]+$/, '');
}

export function archivoCoincidente(datos, archivos, numeroFila) {
  const candidatos = [datos.archivo, datos.titulo, datos.registro, String(numeroFila - 1)]
    .map(normalizarTexto)
    .filter(Boolean);

  for (const candidato of candidatos) {
    const exacto = archivos.find((archivo) => {
      const nombre = normalizarTexto(archivo.name);
      return nombre === candidato || normalizarTexto(nombreSinExtension(archivo.name)) === candidato;
    });
    if (exacto) return claveArchivo(exacto);
  }

  for (const candidato of candidatos) {
    const parciales = archivos.filter((archivo) =>
      normalizarTexto(archivo.name).includes(candidato),
    );
    if (parciales.length === 1) return claveArchivo(parciales[0]);
  }

  return '';
}

function resolverFondo(datos, catalogos) {
  const fondos = catalogos.fondos ?? [];
  const valores = [datos.id_fondo, datos.fondo, datos.codigo_fondo, datos.serie, datos.fondo_contexto];

  for (const valor of valores) {
    const buscado = normalizarTexto(valor);
    if (!buscado) continue;
    const porId = fondos.find((item) => String(item.id) === String(valor).trim());
    if (porId) return porId;
    const exacto = fondos.find((item) => normalizarTexto(item.denominacion) === buscado);
    if (exacto) return exacto;
  }

  const codigo = String(datos.codigo_fondo ?? '').match(/\d+/)?.[0];
  if (codigo) {
    const porCodigo = fondos.find((item) => {
      const denominacion = normalizarTexto(item.denominacion);
      return denominacion.includes(`numero ${codigo}`) || denominacion.includes(`n ${codigo}`);
    });
    if (porCodigo) return porCodigo;
  }

  for (const valor of valores) {
    const buscado = normalizarTexto(valor);
    if (!buscado) continue;
    const parcial = fondos.find((item) => {
      const denominacion = normalizarTexto(item.denominacion);
      return denominacion.includes(buscado) || buscado.includes(denominacion);
    });
    if (parcial) return parcial;
  }

  return fondos.length === 1 ? fondos[0] : undefined;
}

function normalizarConservacion(valor) {
  const texto = normalizarTexto(valor);
  if (!texto) return null;
  return ['Bueno', 'Regular', 'Malo'].find((estado) => normalizarTexto(estado) === texto) ?? null;
}

export function validarFila(fila, catalogos, archivos, { exigirArchivo = false } = {}) {
  const errores = [];
  const datos = fila.datos;

  const fondo = resolverFondo(datos, catalogos);
  if (!fondo) errores.push(`Fondo no encontrado: "${datos.fondo || datos.codigo_fondo || 'vacío'}".`);
  if (!datos.protocolo) errores.push('Falta el protocolo.');
  if (!datos.registro) errores.push('Falta el registro.');

  const anio = Number(datos.anio);
  if (!Number.isInteger(anio) || anio < 1500 || anio > 2100) {
    errores.push(`Año inválido: "${datos.anio || 'vacío'}".`);
  }

  const titulo = datos.titulo || datos.tipologia;
  if (!titulo) errores.push('Falta el título/escritura.');

  if (datos.folios != null && (!Number.isInteger(Number(datos.folios)) || Number(datos.folios) <= 0)) {
    errores.push(`Nro. de folios inválido: "${datos.folios}".`);
  }

  if (datos.fecha_produccion && !fechaCalendarioValida(datos.fecha_produccion)) {
    errores.push(`Fecha inválida: "${datos.fecha_produccion}".`);
  }

  const conservacion = normalizarConservacion(datos.estado_conservacion);
  if (datos.estado_conservacion && !conservacion) {
    errores.push(`Conservación inválida: "${datos.estado_conservacion}".`);
  }

  const archivo = archivos.find((item) => claveArchivo(item) === fila.archivoAsignado) ?? null;
  if (exigirArchivo && !archivo) errores.push('Seleccione el archivo digital de esta fila.');
  if (!exigirArchivo && fila.archivoAsignado && !archivo) {
    errores.push('El archivo asignado no est? disponible en la carpeta seleccionada.');
  }

  return {
    ...fila,
    fondo,
    archivo,
    titulo,
    anio,
    conservacion,
    errores,
    omitida: fila.duplicado
      ? `Duplicado en el Excel (fila ${fila.filaDuplicada})`
      : '',
  };
}

export function camposParaEnvio(fila) {
  const { datos } = fila;
  const titulo = datos.titulo || datos.tipologia;
  const tipologia = datos.tipologia || datos.titulo;
  const conservacion = normalizarConservacion(datos.estado_conservacion);
  const mes = datos.fecha_produccion ? Number(datos.fecha_produccion.slice(5, 7)) : '';
  const folios = datos.folios == null ? '' : String(datos.folios);

  return {
    id_fondo: String(fila.fondo.id),
    escribano: datos.escribano,
    protocolo: datos.protocolo,
    anio: String(fila.anio),
    registro: datos.registro,
    titulo,
    tipologia,
    folios,
    ubicacion_fisica: datos.ubicacion_fisica,
    fecha_produccion: datos.fecha_produccion,
    mes: mes || '',
    estado_conservacion: conservacion ?? 'Bueno',
    serie: datos.serie,
    subserie: datos.subserie,
    alcance_contenido: datos.alcance_contenido,
    descriptores: datos.descriptores,
    observaciones: datos.observaciones,
    responsable_descripcion: datos.responsable_descripcion,
    interesados: fila.interesados ?? [],
  };
}

function agregarFilaEjemplo(hoja, fondo) {
  const fila = hoja.addRow([
    '1',
    fondo?.denominacion ?? 'Complete con la denominación exacta del fondo',
    'Ramón Castillo y Válchez',
    'P-1848',
    '1848',
    'REG-001',
    'Testimonio de cabildo sobre el reparto de aguas',
    '4',
    'Salón 1, estante A, caja 3',
    '1848-03-14',
    'Bueno',
    'Actas de cabildo',
    'Reparto de aguas',
    'Testimonio del Cabildo de Arequipa sobre el reparto de aguas de la majada.',
    'cabildo, aguas, majada',
    'Documento íntegro, tinta ferrogálica legible.',
    'testimonio-cabildo.pdf',
  ]);
  fila.font = { italic: true, color: { argb: 'FF6B6B6B' } };
}

export async function descargarPlantilla(fondos = []) {
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  libro.creator = 'SIARC-ARA';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Documentos');
  const encabezados = [
    'N°',
    'Fondo',
    'Escribano/Notario',
    'Protocolo',
    'Año',
    'Registro',
    'Título/Escritura',
    'Nro. de Folios',
    'Data tópica',
    'Fecha de producción',
    'Conservación',
    'Serie',
    'Subserie',
    'Alcance y contenido',
    'Descriptores',
    'Observaciones',
    'Archivo',
  ];

  hoja.addRow(encabezados);
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6B1D1F' },
  };
  hoja.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  hoja.getRow(1).height = 26;

  const anchos = [6, 36, 30, 14, 8, 14, 44, 12, 28, 16, 12, 24, 22, 48, 30, 36, 28];
  anchos.forEach((ancho, indice) => {
    hoja.getColumn(indice + 1).width = ancho;
  });

  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  const ejemplo = libro.addWorksheet('Ejemplo');
  ejemplo.addRow(encabezados);
  ejemplo.getRow(1).font = { bold: true };
  agregarFilaEjemplo(ejemplo, fondos[0]);
  ejemplo.getColumn(1).width = 6;
  ejemplo.getColumn(2).width = 40;
  ejemplo.getColumn(7).width = 44;

  const instrucciones = libro.addWorksheet('Instrucciones');
  instrucciones.getColumn(1).width = 110;
  instrucciones.addRow(['Cómo preparar la carga masiva']).font = {
    bold: true,
    size: 14,
    color: { argb: 'FF6B1D1F' },
  };
  instrucciones.addRow(['']);
  instrucciones.addRow([
    '1. Complete una fila por documento en la hoja "Documentos". No cambie los nombres de las columnas.',
  ]);
  instrucciones.addRow([
    'La hoja "Ejemplo" es solo una referencia y no se procesa; cargue únicamente la hoja "Documentos".',
  ]);
  instrucciones.addRow([
    '2. La columna "Fondo" debe coincidir con la denominación del fondo registrado en el sistema (o su ID).',
  ]);
  instrucciones.addRow([
    '3. La columna "Archivo" debe contener el nombre exacto del PDF/A o TIFF que adjuntará en el paso 2. Si se omite, el documento se registrará como metadatos y podrá adjuntar el archivo después.',
  ]);
  instrucciones.addRow([
    '4. El "Título/Escritura" es obligatorio. Si no registra "Tipología", se usará el mismo título como tipología.',
  ]);
  instrucciones.addRow([
    '5. Las fechas deben estar en formato AAAA-MM-DD o como fecha de Excel. La conservación debe ser Bueno, Regular o Malo.',
  ]);
  instrucciones.addRow([
    '6. El escribano/notario se asocia automáticamente al fondo. Si no existe, se creará en la jerarquía.',
  ]);
  instrucciones.addRow(['']);
  instrucciones.addRow([
    'La previsualización valida cada fila antes de importar; las filas con error o duplicadas se omiten y se informan al final.',
  ]).font = { italic: true };

  const contenido = await libro.xlsx.writeBuffer();
  const blob = new Blob([contenido], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'plantilla-ingesta-siarc.xlsx';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
