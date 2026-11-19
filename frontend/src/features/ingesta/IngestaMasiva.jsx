import { useEffect, useMemo, useRef, useState } from 'react';
import { IconoDescargar, IconoDocumento, IconoSubir } from '../../components/Iconos.jsx';
import { crearDocumento } from '../../services/api.js';
import {
  archivoCoincidente,
  camposParaEnvio,
  descargarPlantilla,
  leerExcel,
  validarFila,
} from './excel.js';

const EXTENSIONES = ['pdf', 'tif', 'tiff'];
const MAX_BYTES = 50 * 1024 * 1024;

function extensionDe(nombre) {
  return String(nombre ?? '').split('.').pop()?.toLowerCase() ?? '';
}

function combinarArchivos(actuales, nuevos) {
  const mapa = new Map(actuales.map((archivo) => [archivo.name, archivo]));
  for (const archivo of nuevos) mapa.set(archivo.name, archivo);
  return [...mapa.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function IngestaMasiva({ catalogos = { fondos: [] }, onCargado }) {
  const [filas, setFilas] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [nombreExcel, setNombreExcel] = useState('');
  const [cargandoExcel, setCargandoExcel] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [resultados, setResultados] = useState(null);
  const excelRef = useRef(null);
  const archivosRef = useRef(null);

  useEffect(() => {
    if (!archivos.length || !filas.length) return;

    setFilas((actuales) => {
      let cambio = false;
      const siguientes = actuales.map((fila) => {
        if (fila.archivoAsignado && archivos.some((archivo) => archivo.name === fila.archivoAsignado)) {
          return fila;
        }
        const asignado = archivoCoincidente(fila.datos, archivos, fila.numeroFila);
        if (asignado === fila.archivoAsignado) return fila;
        cambio = true;
        return { ...fila, archivoAsignado: asignado };
      });
      return cambio ? siguientes : actuales;
    });
  }, [archivos, filas.length]);

  const filasValidadas = useMemo(
    () => filas.map((fila) => validarFila(fila, catalogos, archivos)),
    [filas, catalogos, archivos],
  );

  const conError = filasValidadas.filter((fila) => fila.errores.length > 0);
  const listos = filasValidadas.length - conError.length;
  const puedeImportar =
    filasValidadas.length > 0 && conError.length === 0 && !importando && !cargandoExcel;

  const descargar = async () => {
    setError('');
    try {
      await descargarPlantilla(catalogos.fondos);
    } catch (errorPlantilla) {
      setError(errorPlantilla.message);
    }
  };

  const seleccionarExcel = async (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    setError('');
    setExito('');
    setResultados(null);

    if (extensionDe(archivo.name) !== 'xlsx') {
      setError('El archivo de migración debe estar en formato Excel .xlsx.');
      evento.target.value = '';
      return;
    }

    setCargandoExcel(true);
    try {
      const leidas = await leerExcel(archivo);
      setFilas(
        leidas.map((fila) => ({
          ...fila,
          archivoAsignado: archivoCoincidente(fila.datos, archivos, fila.numeroFila),
        })),
      );
      setNombreExcel(archivo.name);
    } catch (errorLectura) {
      setFilas([]);
      setNombreExcel('');
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

  const asignarArchivo = (numeroFila, nombreArchivo) => {
    setFilas((actuales) =>
      actuales.map((fila) =>
        fila.numeroFila === numeroFila ? { ...fila, archivoAsignado: nombreArchivo } : fila,
      ),
    );
  };

  const quitarArchivo = (nombreArchivo) => {
    setArchivos((actuales) => actuales.filter((archivo) => archivo.name !== nombreArchivo));
    setFilas((actuales) =>
      actuales.map((fila) =>
        fila.archivoAsignado === nombreArchivo ? { ...fila, archivoAsignado: '' } : fila,
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
    setProgreso({ actual: 0, total: 0 });
    if (excelRef.current) excelRef.current.value = '';
    if (archivosRef.current) archivosRef.current.value = '';
  };

  const importar = async () => {
    if (!puedeImportar) return;

    setImportando(true);
    setError('');
    setExito('');
    setResultados(null);
    setProgreso({ actual: 0, total: filasValidadas.length });

    const exitos = [];
    const fallos = [];

    for (let indice = 0; indice < filasValidadas.length; indice += 1) {
      const fila = filasValidadas[indice];
      setProgreso({ actual: indice + 1, total: filasValidadas.length });

      try {
        const datos = new FormData();
        for (const [campo, valor] of Object.entries(camposParaEnvio(fila))) {
          if (valor !== '' && valor !== null && valor !== undefined) {
            datos.append(campo, valor);
          }
        }
        datos.append('archivo', fila.archivo);
        const documento = await crearDocumento(datos);
        exitos.push({ fila: fila.numeroFila, documento });
      } catch (errorFila) {
        fallos.push({ fila: fila.numeroFila, mensaje: errorFila.message });
      }
    }

    setImportando(false);
    setProgreso({ actual: filasValidadas.length, total: filasValidadas.length });
    setResultados({ exitos, fallos });

    if (exitos.length) {
      setExito(`Se importaron ${exitos.length} documento(s) correctamente.`);
      onCargado?.();
    }

    if (fallos.length) {
      setFilas(
        filasValidadas.filter((fila) => fallos.some((fallo) => fallo.fila === fila.numeroFila)),
      );
      setError(`No se pudieron importar ${fallos.length} fila(s). Revise el detalle y vuelva a intentarlo.`);
      if (excelRef.current) excelRef.current.value = '';
    } else {
      setFilas([]);
      setArchivos([]);
      setNombreExcel('');
      if (excelRef.current) excelRef.current.value = '';
      if (archivosRef.current) archivosRef.current.value = '';
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
          Importando documento {progreso.actual} de {progreso.total}...
        </div>
      )}

      {resultados?.fallos?.length > 0 && (
        <div className="alert alert-warning py-2 px-3 small">
          <strong>Filas con error del servidor:</strong>
          <ul className="mb-0 mt-1">
            {resultados.fallos.map((fallo) => (
              <li key={fallo.fila}>
                Fila {fallo.fila}: {fallo.mensaje}
              </li>
            ))}
          </ul>
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
            equivalentes como “Escribano/Notario”, “Nro. de Folios”, “Data tópica” y “Título/Escritura”.
          </p>
        </div>

        <div className="seccion-formulario">
          <h2 className="seccion-formulario-titulo">2. Archivo Excel y documentos digitales</h2>
          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <label htmlFor="excel-masivo" className="zona-archivo">
                <IconoDocumento size={26} />
                <span className="zona-archivo-titulo">
                  {cargandoExcel ? 'Leyendo Excel...' : nombreExcel || 'Seleccione el Excel .xlsx'}
                </span>
                <span className="zona-archivo-ayuda">
                  {filas.length
                    ? `${filas.length} fila(s) detectada(s)`
                    : 'Una fila por documento, con encabezados en la primera fila'}
                </span>
                <input
                  id="excel-masivo"
                  ref={excelRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={seleccionarExcel}
                  className="zona-archivo-input"
                  disabled={cargandoExcel || importando}
                />
              </label>
            </div>
            <div className="col-12 col-lg-6">
              <label htmlFor="archivos-masivos" className="zona-archivo">
                <IconoSubir size={26} />
                <span className="zona-archivo-titulo">
                  {archivos.length
                    ? `${archivos.length} archivo(s) digital(es) seleccionado(s)`
                    : 'Seleccione los PDF/A o TIFF'}
                </span>
                <span className="zona-archivo-ayuda">
                  Puede seleccionar varios a la vez · máximo 50 MB por archivo
                </span>
                <input
                  id="archivos-masivos"
                  ref={archivosRef}
                  type="file"
                  accept=".pdf,.tif,.tiff,application/pdf,image/tiff"
                  multiple
                  onChange={seleccionarArchivos}
                  className="zona-archivo-input"
                  disabled={importando}
                />
              </label>
            </div>
          </div>

          {archivos.length > 0 && (
            <div className="lista-interesados-formulario mt-3">
              {archivos.map((archivo) => (
                <div className="fila-interesado" key={archivo.name}>
                  <span className="small text-truncate" title={archivo.name}>
                    {archivo.name}
                  </span>
                  <span className="small text-muted">{(archivo.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <span />
                  <button
                    type="button"
                    className="boton-quitar"
                    onClick={() => quitarArchivo(archivo.name)}
                    aria-label={`Quitar ${archivo.name}`}
                    disabled={importando}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {filasValidadas.length > 0 && (
        <>
          <section className="panel-resultados mt-4">
            <div className="resultados-barra">
              <div>
                <p className="resultados-titulo">
                  {filasValidadas.length} fila(s) · {listos} lista(s) · {conError.length} con error
                </p>
                <p className="resultados-subtitulo">
                  Revise la asignación de archivos y los errores antes de importar.
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
                  {importando ? 'Importando...' : `Importar ${filasValidadas.length} documento(s)`}
                </button>
              </div>
            </div>

            <div className="tabla-usuarios-contenedor">
              <table className="table tabla-usuarios align-middle">
                <thead>
                  <tr>
                    <th scope="col">Fila</th>
                    <th scope="col">Fondo</th>
                    <th scope="col">Escribano/Notario</th>
                    <th scope="col">Protocolo</th>
                    <th scope="col">Año</th>
                    <th scope="col">Registro</th>
                    <th scope="col">Título/Escritura</th>
                    <th scope="col">Nro. de folios</th>
                    <th scope="col">Data tópica</th>
                    <th scope="col">Archivo digital</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filasValidadas.map((fila) => (
                    <tr key={fila.numeroFila}>
                      <td className="usuario-codigo">{fila.numeroFila}</td>
                      <td>{fila.fondo?.denominacion ?? fila.datos.fondo ?? '—'}</td>
                      <td>{fila.datos.escribano || '—'}</td>
                      <td>{fila.datos.protocolo || '—'}</td>
                      <td>{fila.datos.anio || '—'}</td>
                      <td>{fila.datos.registro || '—'}</td>
                      <td>{fila.titulo || '—'}</td>
                      <td>{fila.datos.folios || '—'}</td>
                      <td>{fila.datos.ubicacion_fisica || '—'}</td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={fila.archivoAsignado}
                          onChange={(evento) => asignarArchivo(fila.numeroFila, evento.target.value)}
                          disabled={importando}
                        >
                          <option value="">Sin archivo</option>
                          {archivos.map((archivo) => (
                            <option key={archivo.name} value={archivo.name}>
                              {archivo.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {fila.errores.length === 0 ? (
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
        </>
      )}
    </div>
  );
}
