import { useMemo, useRef, useState } from 'react';
import { IconoDocumento, IconoSubir } from '../../components/Iconos.jsx';
import {
  escanearAcervo,
  subirArchivoAcervo,
  validarArchivosAcervo,
  vincularArchivosAcervo,
} from '../../services/api.js';

const EXTENSIONES = ['pdf', 'tif', 'tiff'];
const MAX_BYTES = 50 * 1024 * 1024;
const TAMANO_LOTE = 250;

const RESUMEN_VACIO = {
  total: 0,
  totalArchivos: 0,
  validos: 0,
  invalidos: 0,
  yaRegistrados: 0,
  vinculables: 0,
  ambiguos: 0,
  sinCoincidencia: 0,
  noExisten: 0,
};

const ETIQUETAS = {
  vinculable: ['Listo para vincular', 'activo'],
  ambiguo: ['Ambiguo', 'inactivo'],
  sin_coincidencia: ['Sin coincidencia', 'inactivo'],
  no_existe: ['Falta el archivo', 'inactivo'],
  invalido: ['Ruta inválida', 'inactivo'],
  vinculado: ['Vinculado', 'activo'],
  ya_registrado: ['Ya registrado', 'activo'],
};

function extensionDe(nombre) {
  return String(nombre ?? '').split('.').pop()?.toLowerCase() ?? '';
}

function normalizarRuta(ruta) {
  return String(ruta ?? '').replace(/\\/g, '/').toLowerCase();
}

function opcionesDe(resultado) {
  const lista = resultado.candidato
    ? [resultado.candidato, ...(resultado.candidatos ?? [])]
    : resultado.candidatos ?? [];
  const vistos = new Set();
  return lista.filter((documento) => {
    if (vistos.has(documento.id)) return false;
    vistos.add(documento.id);
    return true;
  });
}

function etiquetaDocumento(documento) {
  const anio = documento.anio ? ` · ${documento.anio}` : '';
  return `#${documento.id} · ${documento.titulo}${anio}`;
}

function sumarResumen(actual, siguiente) {
  return {
    total: actual.total + (siguiente.total ?? 0),
    totalArchivos: actual.totalArchivos + (siguiente.total ?? 0),
    validos: actual.validos + (siguiente.validos ?? 0),
    invalidos: actual.invalidos + (siguiente.invalidos ?? 0),
    yaRegistrados: actual.yaRegistrados + (siguiente.yaRegistrados ?? 0),
    vinculables: actual.vinculables + (siguiente.vinculables ?? 0),
    ambiguos: actual.ambiguos + (siguiente.ambiguos ?? 0),
    sinCoincidencia: actual.sinCoincidencia + (siguiente.sinCoincidencia ?? 0),
    noExisten: actual.noExisten + (siguiente.noExisten ?? 0),
  };
}

function seleccionInicial(resultados) {
  const mapa = {};
  for (const resultado of resultados) {
    if (resultado.candidato?.id) mapa[resultado.ruta] = String(resultado.candidato.id);
  }
  return mapa;
}

export default function ArchivosAcervo({ onCargado }) {
  const [resultados, setResultados] = useState([]);
  const [resumen, setResumen] = useState(RESUMEN_VACIO);
  const [seleccion, setSeleccion] = useState({});
  const [archivosLocales, setArchivosLocales] = useState(new Map());
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const carpetaRef = useRef(null);

  const accionables = useMemo(
    () => resultados.filter((resultado) => resultado.estado !== 'ya_registrado'),
    [resultados],
  );

  const pendientes = useMemo(
    () =>
      accionables.filter(
        (resultado) =>
          resultado.valido !== false &&
          resultado.estado !== 'vinculado' &&
          seleccion[resultado.ruta],
      ),
    [accionables, seleccion],
  );

  const aplicarResultados = (nuevos, resumenNuevo, mapaArchivos = null) => {
    setResultados(nuevos);
    setResumen(resumenNuevo);
    setSeleccion(seleccionInicial(nuevos));
    if (mapaArchivos) setArchivosLocales(mapaArchivos);
  };

  const escanear = async () => {
    setError('');
    setExito('');
    setCargando(true);
    try {
      const datos = await escanearAcervo();
      const lista = datos.actionables ?? [];
      aplicarResultados(
        lista,
        {
          ...RESUMEN_VACIO,
          ...datos,
          totalArchivos: datos.totalArchivos ?? 0,
        },
        new Map(),
      );
      setExito(
        `Revisados ${datos.totalArchivos} archivo(s) en el repositorio; ${datos.yaRegistrados} ya estaban registrados.`,
      );
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setCargando(false);
    }
  };

  const seleccionarCarpeta = async (evento) => {
    const archivos = Array.from(evento.target.files ?? []);
    evento.target.value = '';
    setError('');
    setExito('');

    if (!archivos.length) return;

    const locales = new Map();
    const manifiesto = [];
    const rechazados = [];

    for (const archivo of archivos) {
      const ruta = archivo.webkitRelativePath || archivo.name;
      if (!EXTENSIONES.includes(extensionDe(archivo.name))) {
        rechazados.push(archivo.name);
        continue;
      }
      if (archivo.size > MAX_BYTES) {
        rechazados.push(`${archivo.name} (supera 50 MB)`);
        continue;
      }
      locales.set(normalizarRuta(ruta), archivo);
      manifiesto.push({ ruta, tamanoBytes: archivo.size });
    }

    if (!manifiesto.length) {
      setError('No se encontraron archivos PDF/A o TIFF válidos en la carpeta seleccionada.');
      return;
    }

    setCargando(true);
    try {
      let acumulado = { ...RESUMEN_VACIO };
      const lista = [];

      for (let inicio = 0; inicio < manifiesto.length; inicio += TAMANO_LOTE) {
        const lote = manifiesto.slice(inicio, inicio + TAMANO_LOTE);
        const respuesta = await validarArchivosAcervo(lote);
        acumulado = sumarResumen(acumulado, respuesta);

        for (const item of respuesta.resultados ?? []) {
          if (item.estado === 'ya_registrado') continue;
          lista.push(item);
        }
      }

      aplicarResultados(lista, acumulado, locales);
      setExito(
        `Revisados ${acumulado.total} archivo(s): ${acumulado.yaRegistrados} ya registrados y ${lista.length} requieren revisión.`,
      );
      if (rechazados.length) {
        setError(`Se omitieron ${rechazados.length} archivo(s): ${rechazados.slice(0, 5).join('; ')}.`);
      }
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setCargando(false);
    }
  };

  const actualizarSeleccion = (ruta, valor) => {
    setSeleccion((actual) => ({ ...actual, [ruta]: valor }));
  };

  const marcar = (rutas, estado, id) => {
    const conjunto = new Set(rutas);
    setResultados((actuales) =>
      actuales.map((resultado) =>
        conjunto.has(resultado.ruta)
          ? { ...resultado, estado, idDocumento: id ?? resultado.idDocumento }
          : resultado,
      ),
    );
  };

  const vincular = async () => {
    if (!pendientes.length) return;
    setError('');
    setExito('');
    setProcesando(true);

    const fallos = [];
    const exitosos = [];
    const existentes = [];
    const subidas = [];

    for (const resultado of pendientes) {
      const id = Number(seleccion[resultado.ruta]);
      if (!Number.isInteger(id) || id <= 0) {
        fallos.push(`${resultado.ruta}: seleccione un documento.`);
        continue;
      }
      if (resultado.estado === 'no_existe' || resultado.existe === false) {
        const archivo = archivosLocales.get(normalizarRuta(resultado.ruta));
        if (!archivo) {
          fallos.push(`${resultado.ruta}: falta el archivo para subirlo.`);
          continue;
        }
        subidas.push({ resultado, id, archivo });
      } else {
        existentes.push({ resultado, id });
      }
    }

    for (let inicio = 0; inicio < existentes.length; inicio += 100) {
      const lote = existentes.slice(inicio, inicio + 100);
      try {
        const respuesta = await vincularArchivosAcervo(
          lote.map(({ resultado, id }) => ({
            ruta: resultado.ruta,
            id_documento: id,
          })),
        );
        const porRuta = new Map(
          (respuesta.resultados ?? []).map((item) => [item.ruta, item]),
        );
        for (const { resultado, id } of lote) {
          const item = porRuta.get(resultado.ruta);
          if (item?.estado === 'vinculado' || item?.estado === 'ya_registrado') {
            exitosos.push(resultado.ruta);
            marcar([resultado.ruta], 'vinculado', id);
          } else {
            fallos.push(`${resultado.ruta}: ${item?.mensaje ?? 'no fue posible vincularlo.'}`);
          }
        }
      } catch (errorApi) {
        fallos.push(errorApi.message);
      }
    }

    for (const { resultado, id, archivo } of subidas) {
      try {
        const datos = new FormData();
        datos.append('ruta', resultado.ruta);
        datos.append('id_documento', String(id));
        datos.append('archivo', archivo);
        await subirArchivoAcervo(datos);
        exitosos.push(resultado.ruta);
        marcar([resultado.ruta], 'vinculado', id);
      } catch (errorApi) {
        fallos.push(`${resultado.ruta}: ${errorApi.message}`);
      }
    }

    if (exitosos.length) {
      setExito(`${exitosos.length} archivo(s) vinculados al acervo.`);
      onCargado?.();
    }
    if (fallos.length) {
      setError(fallos.slice(0, 5).join(' '));
    }
    setProcesando(false);
  };

  const totalRevisados = resumen.totalArchivos ?? resumen.total;

  return (
    <section className="panel-busqueda mt-4">
      <div className="seccion-formulario">
        <div className="seccion-formulario-cabecera">
          <div>
            <h2 className="seccion-formulario-titulo">Archivos del acervo</h2>
            <p className="seccion-formulario-ayuda mb-0">
              Valide la encarpetación de 11 niveles (raíz, siglo, fondo, escribano, año, protocolo,
              registro, tipología, mes, interesado y archivo) y vincule cada PDF/A o TIFF con sus
              metadatos. No se sobrescriben archivos existentes.
            </p>
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap mt-3">
          <button type="button" className="btn boton-buscar" onClick={escanear} disabled={cargando || procesando}>
            <IconoDocumento size={16} />
            {cargando ? 'Revisando repositorio...' : 'Escanear repositorio del servidor'}
          </button>
          <label
            className={`btn boton-secundario ${cargando || procesando ? 'disabled' : ''}`}
            htmlFor="carpeta-acervo"
            style={{ pointerEvents: cargando || procesando ? 'none' : 'auto' }}
          >
            <IconoSubir size={16} />
            Seleccionar carpeta del acervo
          </label>
          <input
            id="carpeta-acervo"
            ref={carpetaRef}
            type="file"
            multiple
            webkitdirectory=""
            directory=""
            onChange={seleccionarCarpeta}
            style={{ display: 'none' }}
          />
        </div>

        <p className="seccion-formulario-ayuda mt-2 mb-0">
          En el navegador seleccione la carpeta raíz del acervo para que la ruta incluya los 11
          niveles. Las rutas inválidas o ambiguas no se vinculan automáticamente.
        </p>
      </div>

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

      {totalRevisados > 0 && (
        <div className="row g-2 px-2 mt-1">
          {[
            ['Revisados', totalRevisados],
            ['Ya registrados', resumen.yaRegistrados],
            ['Para vincular', resumen.vinculables],
            ['Ambiguos', resumen.ambiguos],
            ['Sin coincidencia', resumen.sinCoincidencia],
            ['Falta el archivo', resumen.noExisten],
            ['Faltan en disco', resumen.faltantesEnDisco],
            ['Inválidos', resumen.invalidos],
          ]
            .filter(([, valor]) => valor != null)
            .map(([etiqueta, valor]) => (
            <div className="col-6 col-md-3 col-xl-2" key={etiqueta}>
              <div className="dato-resumen">
                <span className="dato-resumen-numero">{valor ?? 0}</span>
                <span className="dato-resumen-etiqueta">{etiqueta}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {accionables.length > 0 && (
        <div className="tabla-usuarios-contenedor mt-3">
          <table className="table tabla-usuarios align-middle">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Ruta del archivo</th>
                <th>Documento asignado</th>
              </tr>
            </thead>
            <tbody>
              {accionables.map((resultado) => {
                const [texto, clase] = ETIQUETAS[resultado.estado] ?? ['Revisar', 'inactivo'];
                const opciones = opcionesDe(resultado);
                const seleccionado = seleccion[resultado.ruta] ?? '';
                const bloqueado = resultado.estado === 'vinculado' || resultado.valido === false;
                return (
                  <tr key={resultado.ruta}>
                    <td>
                      <span className={`insignia-estado ${clase}`}>{texto}</span>
                      {resultado.errores?.length > 0 && (
                        <div className="small text-danger mt-1">{resultado.errores.join(' ')}</div>
                      )}
                    </td>
                    <td style={{ maxWidth: '32rem' }}>
                      <div className="small" style={{ wordBreak: 'break-all' }} title={resultado.ruta}>
                        {resultado.ruta}
                      </div>
                      {resultado.tamanoBytes != null && (
                        <div className="small text-muted">
                          {(resultado.tamanoBytes / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      )}
                    </td>
                    <td>
                      {resultado.valido === false ? (
                        <span className="small text-muted">Corrija la ruta</span>
                      ) : opciones.length > 0 ? (
                        <select
                          className="form-select form-select-sm"
                          value={seleccionado}
                          onChange={(evento) => actualizarSeleccion(resultado.ruta, evento.target.value)}
                          disabled={bloqueado || procesando}
                          aria-label={`Documento para ${resultado.ruta}`}
                        >
                          <option value="">Seleccione el documento...</option>
                          {opciones.map((documento) => (
                            <option key={documento.id} value={documento.id}>
                              {etiquetaDocumento(documento)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          className="form-control form-control-sm"
                          placeholder="ID de documento"
                          value={seleccionado}
                          onChange={(evento) => actualizarSeleccion(resultado.ruta, evento.target.value)}
                          disabled={bloqueado || procesando}
                          aria-label={`ID del documento para ${resultado.ruta}`}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {accionables.length > 0 && (
        <div className="buscador-avanzado-acciones px-2 pb-2">
          <span className="small text-muted">
            {pendientes.length} archivo(s) con documento seleccionado.
          </span>
          <button
            type="button"
            className="btn boton-buscar boton-compacto"
            onClick={vincular}
            disabled={procesando || pendientes.length === 0}
          >
            {procesando ? 'Vinculando...' : 'Vincular seleccionados'}
          </button>
        </div>
      )}
    </section>
  );
}
