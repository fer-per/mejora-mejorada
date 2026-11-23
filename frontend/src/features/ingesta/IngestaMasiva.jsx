import { useEffect, useMemo, useRef, useState } from 'react';
import { IconoDescargar, IconoDocumento, IconoSubir } from '../../components/Iconos.jsx';
import {
  crearDocumento,
  crearDocumentosMasivo,
  validarArchivosAcervo,
} from '../../services/api.js';
import {
  archivoCoincidente,
  camposParaEnvio,
  claveArchivo,
  descargarPlantilla,
  leerExcel,
  validarFila,
} from './excel.js';
import { asignarArchivosDesdeCarpeta } from './rutasAcervo.js';

const EXTENSIONES = ['pdf', 'tif', 'tiff'];
const MAX_BYTES = 50 * 1024 * 1024;
const POR_PAGINA = 50;
const FILAS_POR_LOTE = 100;
const ARCHIVOS_POR_LOTE = 250;
const CONCURRENCIA_SUBIDA = 4;

function extensionDe(nombre) {
  return String(nombre ?? '').split('.').pop()?.toLowerCase() ?? '';
}

function combinarArchivos(actuales, nuevos) {
  const mapa = new Map(actuales.map((archivo) => [claveArchivo(archivo), archivo]));
  for (const archivo of nuevos) mapa.set(claveArchivo(archivo), archivo);
  return [...mapa.values()].sort((a, b) => claveArchivo(a).localeCompare(claveArchivo(b)));
}

function archivosSueltos(archivos) {
  return archivos.filter((archivo) => !archivo.webkitRelativePath);
}

function filasConArchivosSueltos(filas, archivos) {
  const sueltos = archivosSueltos(archivos);
  if (!sueltos.length) return filas;
  return filas.map((fila) => ({
    ...fila,
    archivoAsignado: archivoCoincidente(fila.datos, sueltos, fila.numeroFila),
    rutaEstado: '',
    rutaMensaje: '',
    rutaComparada: '',
    rutaCandidatos: [],
  }));
}

function filaParaApi(fila) {
  const envio = { fila: fila.numeroFila, ...camposParaEnvio(fila) };
  const limpio = { fila: fila.numeroFila };

  for (const [campo, valor] of Object.entries(envio)) {
    if (campo === 'fila') continue;
    if (valor === '' || valor === null || valor === undefined) continue;
    if (Array.isArray(valor) && valor.length === 0) continue;
    limpio[campo] = valor;
  }

  return limpio;
}

export default function IngestaMasiva({ catalogos = { fondos: [] }, onCargado }) {
  const [filas, setFilas] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [nombreExcel, setNombreExcel] = useState('');
  const [cargandoExcel, setCargandoExcel] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [resultados, setResultados] = useState(null);
  const [analisisCarpeta, setAnalisisCarpeta] = useState(null);
  const [analizandoCarpeta, setAnalizandoCarpeta] = useState(false);
  const [validandoRutas, setValidandoRutas] = useState(false);
  const excelRef = useRef(null);
  const archivosRef = useRef(null);
  const carpetaRef = useRef(null);

  useEffect(() => {
    const sueltos = archivosSueltos(archivos);
    if (!sueltos.length || !filas.length) return;

    setFilas((actuales) => {
      let cambio = false;
      const siguientes = actuales.map((fila) => {
        if (fila.rutaEstado) return fila;
        if (fila.archivoAsignado && sueltos.some((archivo) => claveArchivo(archivo) === fila.archivoAsignado)) {
          return fila;
        }
        const asignado = archivoCoincidente(fila.datos, sueltos, fila.numeroFila);
        if (asignado === fila.archivoAsignado) return fila;
        cambio = true;
        return { ...fila, archivoAsignado: asignado };
      });
      return cambio ? siguientes : actuales;
    });
  }, [archivos, filas.length]);

  const filasValidadas = useMemo(() => {
    const hayCarpeta = archivos.some((archivo) => archivo.webkitRelativePath);
    return filas.map((fila) => {
      const validada = validarFila(fila, catalogos, archivos);
      if (hayCarpeta && !validada.archivo && fila.rutaEstado !== 'registrado') {
        validada.errores = [
          ...validada.errores,
          fila.rutaEstado === 'ambigua'
            ? 'Hay varias rutas compatibles; seleccione el PDF correcto.'
            : 'No se encontró el PDF que corresponde a esta fila en la carpeta.',
        ];
      }
      return validada;
    });
  }, [filas, catalogos, archivos]);

  const conError = filasValidadas.filter((fila) => fila.errores.length > 0);
  const duplicadas = filasValidadas.filter((fila) => !fila.errores.length && fila.omitida);
  const registradas = filasValidadas.filter((fila) => fila.rutaEstado === 'registrado');
  const cantidadCarpeta = useMemo(
    () => archivos.filter((archivo) => archivo.webkitRelativePath).length,
    [archivos],
  );
  const importables = filasValidadas.filter(
    (fila) => !fila.errores.length && !fila.omitida && fila.rutaEstado !== 'registrado',
  );
  const puedeImportar =
    importables.length > 0 &&
    !importando &&
    !cargandoExcel &&
    !analizandoCarpeta &&
    !validandoRutas;

  const totalPaginas = Math.max(1, Math.ceil(filasValidadas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicioPagina = (paginaActual - 1) * POR_PAGINA;
  const filasPagina = filasValidadas.slice(inicioPagina, inicioPagina + POR_PAGINA);

  const descargar = async () => {
    setError('');
    try {
      await descargarPlantilla(catalogos.fondos);
    } catch (errorPlantilla) {
      setError(errorPlantilla.message);
    }
  };

  const verificarRutasRegistradas = async (filasNuevas, resumen, listaArchivos) => {
    const porClave = new Map(listaArchivos.map((archivo) => [claveArchivo(archivo), archivo]));
    const rutas = [
      ...new Set(
        filasNuevas
          .map((fila) => porClave.get(fila.archivoAsignado)?.webkitRelativePath)
          .filter(Boolean),
      ),
    ];

    if (!rutas.length) {
      setAnalisisCarpeta({ ...resumen, yaRegistradas: 0 });
      return;
    }

    setValidandoRutas(true);
    const registradasSet = new Set();
    try {
      for (let inicio = 0; inicio < rutas.length; inicio += ARCHIVOS_POR_LOTE) {
        const lote = rutas.slice(inicio, inicio + ARCHIVOS_POR_LOTE);
        const respuesta = await validarArchivosAcervo(lote.map((ruta) => ({ ruta })));
        for (const item of respuesta.resultados ?? []) {
          if (
            item.estado === 'ya_registrado' ||
            (item.estado === 'no_existe' && item.coincidencia === 'ya_registrado')
          ) {
            registradasSet.add(item.ruta);
          }
        }
      }
    } catch (errorRutas) {
      setError(`No se pudieron verificar las rutas ya registradas: ${errorRutas.message}`);
    }

    setFilas((actuales) =>
      actuales.map((fila) => {
        const ruta = porClave.get(fila.archivoAsignado)?.webkitRelativePath;
        if (!ruta || !registradasSet.has(ruta)) return fila;
        return {
          ...fila,
          rutaEstado: 'registrado',
          rutaMensaje: 'La ruta ya está registrada en el servidor; se omitirá.',
        };
      }),
    );
    setAnalisisCarpeta({ ...resumen, yaRegistradas: registradasSet.size });
    setValidandoRutas(false);
  };

  const compararConCarpeta = async (filasBase, listaArchivos) => {
    const carpeta = listaArchivos.filter((archivo) => archivo.webkitRelativePath);
    if (!carpeta.length) {
      setFilas(filasConArchivosSueltos(filasBase, listaArchivos));
      setAnalisisCarpeta(null);
      return;
    }

    setAnalizandoCarpeta(true);
    try {
      const { filas: nuevas, resumen } = asignarArchivosDesdeCarpeta(filasBase, carpeta);
      setFilas(nuevas);
      setAnalisisCarpeta(resumen);
      await verificarRutasRegistradas(nuevas, resumen, listaArchivos);
    } finally {
      setAnalizandoCarpeta(false);
    }
  };

  const seleccionarExcel = async (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    setError('');
    setExito('');
    setResultados(null);
    setPagina(1);

    if (extensionDe(archivo.name) !== 'xlsx') {
      setError('El archivo de migración debe estar en formato Excel .xlsx.');
      evento.target.value = '';
      return;
    }

    setCargandoExcel(true);
    try {
      const leidas = await leerExcel(archivo);
      setNombreExcel(archivo.name);
      await compararConCarpeta(leidas.filas, archivos);
    } catch (errorLectura) {
      setFilas([]);
      setNombreExcel('');
      setAnalisisCarpeta(null);
      setError(errorLectura.message);
      evento.target.value = '';
    } finally {
      setCargandoExcel(false);
    }
  };

  const seleccionarArchivos = (evento) => {
    const seleccionados = Array.from(evento.target.files ?? []);
    setError('');

    const validos = [];
    const rechazados = [];
    for (const archivo of seleccionados) {
      if (!EXTENSIONES.includes(extensionDe(archivo.name))) {
        rechazados.push(`${archivo.name} (formato no permitido)`);
      } else if (archivo.size > MAX_BYTES) {
        rechazados.push(`${archivo.name} (supera 50 MB)`);
      } else {
        validos.push(archivo);
      }
    }

    if (validos.length) setArchivos((actuales) => combinarArchivos(actuales, validos));
    if (rechazados.length) {
      setError(`No se agregaron: ${rechazados.join('; ')}.`);
    }
    evento.target.value = '';
  };

  const seleccionarCarpeta = async (evento) => {
    const seleccionados = Array.from(evento.target.files ?? []);
    evento.target.value = '';
    setError('');
    setExito('');

    if (!seleccionados.length) return;

    const validos = [];
    const rechazados = [];
    for (const archivo of seleccionados) {
      if (!EXTENSIONES.includes(extensionDe(archivo.name))) {
        rechazados.push(`${archivo.name} (formato no permitido)`);
      } else if (archivo.size > MAX_BYTES) {
        rechazados.push(`${archivo.name} (supera 50 MB)`);
      } else {
        validos.push(archivo);
      }
    }

    const combinados = combinarArchivos(archivos, validos);
    setArchivos(combinados);

    if (!filas.length) {
      setExito(
        `Carpeta cargada: ${combinados.filter((archivo) => archivo.webkitRelativePath).length} archivo(s). Ahora seleccione el Excel para comparar.`,
      );
      setAnalisisCarpeta(null);
    } else {
      await compararConCarpeta(filas, combinados);
      setExito('Carpeta analizada contra las filas del Excel.');
    }

    if (rechazados.length) {
      setError(`Se omitieron ${rechazados.length} archivo(s): ${rechazados.slice(0, 5).join('; ')}.`);
    }
  };

  const asignarArchivo = (numeroFila, archivoAsignado) => {
    setFilas((actuales) =>
      actuales.map((fila) =>
        fila.numeroFila === numeroFila
          ? {
              ...fila,
              archivoAsignado,
              rutaEstado: archivoAsignado ? 'manual' : '',
              rutaMensaje: archivoAsignado ? 'Asignación manual.' : '',
              rutaComparada: archivoAsignado.includes('/') ? archivoAsignado : '',
              rutaCandidatos: [],
            }
          : fila,
      ),
    );
  };

  const quitarArchivo = (clave) => {
    setArchivos((actuales) => actuales.filter((archivo) => claveArchivo(archivo) !== clave));
    setFilas((actuales) =>
      actuales.map((fila) =>
        fila.archivoAsignado === clave
          ? { ...fila, archivoAsignado: '', rutaEstado: '', rutaMensaje: '', rutaCandidatos: [] }
          : fila,
      ),
    );
  };

  const limpiar = () => {
    if (importando) return;
    setFilas([]);
    setArchivos([]);
    setNombreExcel('');
    setError('');
    setExito('');
    setResultados(null);
    setAnalisisCarpeta(null);
    setValidandoRutas(false);
    setAnalizandoCarpeta(false);
    setProgreso({ actual: 0, total: 0 });
    setPagina(1);
    if (excelRef.current) excelRef.current.value = '';
    if (archivosRef.current) archivosRef.current.value = '';
    if (carpetaRef.current) carpetaRef.current.value = '';
  };

  const importar = async () => {
    if (!puedeImportar) return;

    const total = importables.length;
    setImportando(true);
    setError('');
    setExito('');
    setResultados(null);
    setProgreso({ actual: 0, total });

    const fallos = [];
    const omitidos = duplicadas.map((fila) => ({
      fila: fila.numeroFila,
      mensaje: fila.omitida,
    }));
    let creados = 0;
    let procesados = 0;

    const conArchivo = importables.filter((fila) => fila.archivo);
    const sinArchivo = importables.filter((fila) => !fila.archivo);

    for (let inicio = 0; inicio < conArchivo.length; inicio += CONCURRENCIA_SUBIDA) {
      const lote = conArchivo.slice(inicio, inicio + CONCURRENCIA_SUBIDA);
      const resultadosLote = await Promise.all(
        lote.map(async (fila) => {
          try {
            const datos = new FormData();
            for (const [campo, valor] of Object.entries(camposParaEnvio(fila))) {
              if (valor === '' || valor === null || valor === undefined) continue;
              datos.append(campo, campo === 'interesados' ? JSON.stringify(valor) : valor);
            }
            if (fila.archivo.webkitRelativePath) {
              datos.append('ruta_relativa', fila.archivo.webkitRelativePath);
            }
            datos.append('archivo', fila.archivo);
            await crearDocumento(datos);
            return { fila, ok: true };
          } catch (errorFila) {
            return { fila, ok: false, mensaje: errorFila.message };
          }
        }),
      );

      for (const resultado of resultadosLote) {
        if (resultado.ok) creados += 1;
        else fallos.push({ fila: resultado.fila.numeroFila, mensaje: resultado.mensaje });
      }

      procesados += lote.length;
      setProgreso({ actual: procesados, total });
    }

    for (let inicio = 0; inicio < sinArchivo.length; inicio += FILAS_POR_LOTE) {
      const lote = sinArchivo.slice(inicio, inicio + FILAS_POR_LOTE);

      try {
        const respuesta = await crearDocumentosMasivo(lote.map(filaParaApi));
        creados += respuesta.creados ?? 0;

        for (const resultado of respuesta.resultados ?? []) {
          if (resultado.estado === 'omitido') {
            omitidos.push({
              fila: resultado.fila,
              mensaje: resultado.motivo ?? 'Duplicado existente.',
            });
          }
          if (resultado.estado === 'error') {
            fallos.push({
              fila: resultado.fila,
              mensaje: resultado.mensaje ?? 'No se pudo registrar la fila.',
            });
          }
        }
      } catch (errorLote) {
        for (const fila of lote) {
          fallos.push({ fila: fila.numeroFila, mensaje: errorLote.message });
        }
      }

      procesados += lote.length;
      setProgreso({ actual: procesados, total });
    }

    setImportando(false);
    setProgreso({ actual: total, total });
    setResultados({ creados, omitidos, fallos });
    setFilas([]);
    setArchivos([]);
    setNombreExcel('');
    setAnalisisCarpeta(null);
    setPagina(1);
    if (excelRef.current) excelRef.current.value = '';
    if (archivosRef.current) archivosRef.current.value = '';
    if (carpetaRef.current) carpetaRef.current.value = '';

    if (creados) {
      setExito(`Se importaron ${creados} documento(s) con sus metadatos y archivos.`);
      onCargado?.();
    }

    const resumen = [
      `${creados} creado(s)`,
      `${omitidos.length} omitido(s)`,
      `${fallos.length} con error`,
    ].join(', ');

    if (fallos.length) {
      setError(`Importación finalizada: ${resumen}. Revise el detalle de los errores.`);
    } else if (!creados && omitidos.length) {
      setExito('');
      setError(`No se crearon documentos nuevos: ${resumen}.`);
    } else {
      setExito(`Importación finalizada: ${resumen}.`);
    }
  };

  return (
    <div>
      {error && (
        <div className="alert alert-danger py-2 px-3 small" role="alert">
          {error}
        </div>
      )}
      {exito && (
        <div className="alert alert-success py-2 px-3 small" role="alert">
          {exito}
        </div>
      )}
      {importando && (
        <div className="alert alert-info py-2 px-3 small" role="status">
          Procesando {progreso.actual} de {progreso.total} fila(s)...
        </div>
      )}

      {resultados && (
        <div className="alert alert-warning py-2 px-3 small">
          <strong>Resumen de la importación:</strong> {resultados.creados} creado(s),{' '}
          {resultados.omitidos.length} omitido(s), {resultados.fallos.length} con error.
          {resultados.omitidos.length > 0 && (
            <>
              <div className="mt-2">Filas omitidas por duplicado:</div>
              <ul className="mb-0 mt-1">
                {resultados.omitidos.slice(0, 20).map((omitida) => (
                  <li key={`omitida-${omitida.fila}`}>
                    Fila {omitida.fila}: {omitida.mensaje}
                  </li>
                ))}
              </ul>
              {resultados.omitidos.length > 20 && (
                <div className="mt-1">... y {resultados.omitidos.length - 20} más.</div>
              )}
            </>
          )}
          {resultados.fallos.length > 0 && (
            <>
              <div className="mt-2">Filas con error del servidor:</div>
              <ul className="mb-0 mt-1">
                {resultados.fallos.slice(0, 20).map((fallo) => (
                  <li key={`fallo-${fallo.fila}`}>
                    Fila {fallo.fila}: {fallo.mensaje}
                  </li>
                ))}
              </ul>
              {resultados.fallos.length > 20 && (
                <div className="mt-1">... y {resultados.fallos.length - 20} más.</div>
              )}
            </>
          )}
        </div>
      )}

      <section className="panel-busqueda">
        <div className="seccion-formulario">
          <div className="seccion-formulario-cabecera">
            <h2 className="seccion-formulario-titulo">1. Plantilla de migración</h2>
            <button type="button" className="btn btn-sm boton-secundario" onClick={descargar}>
              <IconoDescargar size={15} />
              Descargar plantilla
            </button>
          </div>
          <p className="seccion-formulario-ayuda">
            Use la plantilla para conservar los nombres de columna. También se aceptan encabezados
            equivalentes como "Escribano/Notario", "Nro. de Folios", "Data tópica" y "Título/Escritura".
          </p>
        </div>

        <div className="seccion-formulario">
          <h2 className="seccion-formulario-titulo">2. Excel y encarpetado de 11 niveles</h2>
          <p className="seccion-formulario-ayuda">
            Seleccione la carpeta ra?z del acervo y el Excel. El sistema comparar? a?o, protocolo,
            registro, t?tulo, mes e interesados, y propondr? el PDF que corresponde a cada fila.
          </p>
          <div className="row g-3">
            <div className="col-12 col-lg-4">
              <label htmlFor="excel-masivo" className="zona-archivo">
                <IconoDocumento size={26} />
                <span className="zona-archivo-titulo">
                  {cargandoExcel ? 'Leyendo Excel...' : nombreExcel || 'Seleccione el Excel .xlsx'}
                </span>
                <span className="zona-archivo-ayuda">
                  {filas.length ? `${filas.length} fila(s) detectada(s)` : 'Metadatos de cada documento'}
                </span>
                <input
                  id="excel-masivo"
                  ref={excelRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={seleccionarExcel}
                  className="zona-archivo-input"
                  disabled={cargandoExcel || importando || analizandoCarpeta}
                />
              </label>
            </div>
            <div className="col-12 col-lg-4">
              <label htmlFor="carpeta-acervo" className="zona-archivo">
                <IconoSubir size={26} />
                <span className="zona-archivo-titulo">
                  {cantidadCarpeta
                    ? `${cantidadCarpeta} archivo(s) en la carpeta`
                    : 'Seleccione la carpeta ra?z del acervo'}
                </span>
                <span className="zona-archivo-ayuda">
                  Ra?z + siglo + fondo + escribano + a?o + protocolo + registro + tipolog?a + mes + interesado + PDF
                </span>
                <input
                  id="carpeta-acervo"
                  ref={carpetaRef}
                  type="file"
                  multiple
                  webkitdirectory=""
                  directory=""
                  onChange={seleccionarCarpeta}
                  className="zona-archivo-input"
                  disabled={importando || analizandoCarpeta || validandoRutas}
                />
              </label>
            </div>
            <div className="col-12 col-lg-4">
              <label htmlFor="archivos-masivos" className="zona-archivo">
                <IconoSubir size={26} />
                <span className="zona-archivo-titulo">
                  {archivos.length
                    ? `${archivos.length} archivo(s) disponible(s)`
                    : 'Agregar archivos sueltos (opcional)'}
                </span>
                <span className="zona-archivo-ayuda">
                  ?til solo si no seleccion? la carpeta completa. M?ximo 50 MB por archivo.
                </span>
                <input
                  id="archivos-masivos"
                  ref={archivosRef}
                  type="file"
                  accept=".pdf,.tif,.tiff,application/pdf,image/tiff"
                  multiple
                  onChange={seleccionarArchivos}
                  className="zona-archivo-input"
                  disabled={importando || analizandoCarpeta}
                />
              </label>
            </div>
          </div>

          <datalist id="lista-archivos-acervo">
            {archivos.map((archivo) => (
              <option key={claveArchivo(archivo)} value={claveArchivo(archivo)} label={archivo.name} />
            ))}
          </datalist>

          {archivos.length > 0 && (
            <div className="lista-interesados-formulario mt-3">
              {archivos.slice(0, 8).map((archivo) => (
                <div className="fila-interesado" key={claveArchivo(archivo)}>
                  <span className="small text-truncate" title={claveArchivo(archivo)}>
                    {claveArchivo(archivo)}
                  </span>
                  <span className="small text-muted">{(archivo.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <span />
                  <button
                    type="button"
                    className="boton-quitar"
                    onClick={() => quitarArchivo(claveArchivo(archivo))}
                    aria-label={`Quitar ${archivo.name}`}
                    disabled={importando}
                  >
                    ×
                  </button>
                </div>
              ))}
              {archivos.length > 8 && (
                <div className="small text-muted">... y {archivos.length - 8} archivo(s) m?s.</div>
              )}
            </div>
          )}
        </div>
      </section>

      {(analizandoCarpeta || validandoRutas || analisisCarpeta) && (
        <div className="alert alert-info py-2 px-3 small" role="status">
          {analizandoCarpeta && <div>Comparando el Excel con la encarpetación de 11 niveles...</div>}
          {validandoRutas && <div>Verificando si las rutas ya están registradas en el servidor...</div>}
          {analisisCarpeta && (
            <div>
              <strong>Carpeta:</strong> {analisisCarpeta.validas} archivo(s) válido(s) de{' '}
              {analisisCarpeta.totalArchivos}; {analisisCarpeta.asignadas} fila(s) asignada(s) (
              {analisisCarpeta.exactas} exactas, {analisisCarpeta.parciales} parciales);{' '}
              {analisisCarpeta.ambiguas} ambigua(s); {analisisCarpeta.sinCoincidencia} sin coincidencia;{' '}
              {analisisCarpeta.invalidas} ruta(s) inválida(s).
              {analisisCarpeta.yaRegistradas > 0 && (
                <> {analisisCarpeta.yaRegistradas} ya registrada(s) se omitirán.</>
              )}
            </div>
          )}
          {analisisCarpeta?.detalleInvalidas?.length > 0 && (
            <div className="mt-1">
              Rutas inválidas: {analisisCarpeta.detalleInvalidas.map((item) => `${item.nombre} (${item.error})`).join('; ')}
            </div>
          )}
        </div>
      )}

      {filasValidadas.length > 0 && (
        <section className="panel-resultados mt-4">
          <div className="resultados-barra">
            <div>
              <p className="resultados-titulo">
                {filasValidadas.length} fila(s) · {importables.length} lista(s) · {duplicadas.length}{' '}
                duplicada(s) · {conError.length} con error
              </p>
              <p className="resultados-subtitulo">
                Se importarán solo las filas válidas. Las duplicadas y con error se omiten y se
                informan al final.
              </p>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm boton-secundario"
                onClick={limpiar}
                disabled={importando}
              >
                Limpiar lote
              </button>
              <button
                type="button"
                className="btn btn-sm boton-buscar boton-compacto"
                onClick={importar}
                disabled={!puedeImportar}
              >
                <IconoDocumento size={15} />
                {importando ? 'Importando...' : `Importar ${importables.length} documento(s)`}
              </button>
            </div>
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 px-2 py-2 small">
            <span>
              Mostrando {inicioPagina + 1}–{Math.min(inicioPagina + POR_PAGINA, filasValidadas.length)}{' '}
              de {filasValidadas.length}
            </span>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm boton-secundario"
                onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                disabled={paginaActual <= 1 || importando}
              >
                Anterior
              </button>
              <span>
                Página {paginaActual} de {totalPaginas}
              </span>
              <button
                type="button"
                className="btn btn-sm boton-secundario"
                onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
                disabled={paginaActual >= totalPaginas || importando}
              >
                Siguiente
              </button>
            </div>
          </div>

          <p className="tabla-scroll-aviso">Desplace horizontalmente para ver todas las columnas.</p>
          <div className="tabla-usuarios-contenedor">
            <table className="table tabla-usuarios tabla-ingesta-masiva align-middle">
              <thead>
                <tr>
                  <th scope="col">Fila</th>
                  <th scope="col" className="col-ingesta-opcional">Fondo</th>
                  <th scope="col" className="col-ingesta-opcional">Escribano/Notario</th>
                  <th scope="col">Protocolo</th>
                  <th scope="col">Año</th>
                  <th scope="col">Registro</th>
                  <th scope="col">Título/Escritura</th>
                  <th scope="col" className="col-ingesta-opcional">Nro. de folios</th>
                  <th scope="col" className="col-ingesta-opcional">Data tópica</th>
                  <th scope="col">Archivo digital</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filasPagina.map((fila) => (
                  <tr key={fila.numeroFila}>
                    <td className="usuario-codigo">{fila.numeroFila}</td>
                    <td className="col-ingesta-opcional">{fila.fondo?.denominacion ?? fila.datos.fondo ?? '—'}</td>
                    <td className="col-ingesta-opcional">{fila.datos.escribano || '—'}</td>
                    <td>{fila.datos.protocolo || '—'}</td>
                    <td>{fila.datos.anio || '—'}</td>
                    <td>{fila.datos.registro || '—'}</td>
                    <td>{fila.titulo || '—'}</td>
                    <td className="col-ingesta-opcional">{fila.datos.folios || '—'}</td>
                    <td className="col-ingesta-opcional">{fila.datos.ubicacion_fisica || '—'}</td>
                    <td className="celda-archivo-acervo">
                      <input
                        className="form-control form-control-sm"
                        list="lista-archivos-acervo"
                        value={fila.archivoAsignado}
                        onChange={(evento) => asignarArchivo(fila.numeroFila, evento.target.value)}
                        placeholder="Ruta o nombre del archivo"
                        disabled={importando || fila.rutaEstado === 'registrado'}
                      />
                      {fila.rutaComparada && (
                        <div className="small text-muted mt-1" style={{ wordBreak: 'break-all' }}>
                          {fila.rutaComparada}
                        </div>
                      )}
                      {fila.rutaMensaje && (
                        <div
                          className={`small mt-1 ${
                            fila.rutaEstado === 'ambigua' || fila.rutaEstado === 'sin_coincidencia'
                              ? 'text-danger'
                              : fila.rutaEstado === 'registrado'
                                ? 'text-muted'
                                : 'text-success'
                          }`}
                        >
                          {fila.rutaMensaje}
                        </div>
                      )}
                    </td>
                    <td>
                      {fila.rutaEstado === 'registrado' ? (
                        <>
                          <span className="insignia-estado activo">Ya registrada</span>
                          <div className="small text-muted mt-1">{fila.rutaMensaje}</div>
                        </>
                      ) : fila.omitida ? (
                        <>
                          <span className="insignia-estado inactivo">Duplicada</span>
                          <div className="small text-muted mt-1">{fila.omitida}</div>
                        </>
                      ) : fila.errores.length === 0 ? (
                        <span className="insignia-estado activo">Lista</span>
                      ) : (
                        <>
                          <span className="insignia-estado inactivo">Revisar</span>
                          <ul className="small text-danger mb-0 mt-1">
                            {fila.errores.map((mensaje) => (
                              <li key={mensaje}>{mensaje}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
