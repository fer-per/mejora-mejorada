import { useMemo, useState } from 'react';
import {
  IconoBuscar,
  IconoDocumento,
  IconoHistorial,
} from '../../../components/Iconos.jsx';
import {
  anularDocumento,
  listarHistorialDocumento,
  restaurarDocumento,
} from '../../../services/gestionApi.js';
import { FILTROS_DOCUMENTOS_INICIALES } from '../constants.js';
import { useAvisos } from '../hooks/useAvisos.js';
import { useDocumentosGestion } from '../hooks/useDocumentosGestion.js';
import { calcularPaginas, paginasTotales } from '../utils.js';
import Avisos from './Avisos.jsx';
import EdicionMasivaModal from './EdicionMasivaModal.jsx';
import EditarDocumentoModal from './EditarDocumentoModal.jsx';
import HistorialModal from './HistorialModal.jsx';
import ReemplazoModal from './ReemplazoModal.jsx';

const POR_PAGINA = 15;

export default function DocumentosTab({ esAdmin, onCambio }) {
  const [entrada, setEntrada] = useState('');
  const [filtros, setFiltros] = useState(FILTROS_DOCUMENTOS_INICIALES);
  const [pagina, setPagina] = useState(1);
  const [seleccion, setSeleccion] = useState([]);
  const [documentoEditando, setDocumentoEditando] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [idsMasiva, setIdsMasiva] = useState(null);
  const [documentoReemplazo, setDocumentoReemplazo] = useState(null);
  const avisos = useAvisos();

  const { datos, cargando, error: errorCarga, recargar } = useDocumentosGestion({
    filtros,
    pagina,
    porPagina: POR_PAGINA,
  });

  const totalPaginas = paginasTotales(datos, POR_PAGINA);
  const idsPagina = useMemo(() => datos.resultados.map((documento) => documento.id), [datos.resultados]);
  const seleccionados = useMemo(
    () => seleccion.filter((id) => idsPagina.includes(id)),
    [seleccion, idsPagina],
  );
  const todosSeleccionados = idsPagina.length > 0 && seleccionados.length === idsPagina.length;
  const paginas = useMemo(() => calcularPaginas(pagina, totalPaginas), [pagina, totalPaginas]);

  const refrescar = (mensaje) => {
    recargar();
    onCambio();
    if (mensaje) avisos.setExito(mensaje);
  };

  const aplicarFiltros = (evento) => {
    evento.preventDefault();
    setPagina(1);
    setFiltros({ ...filtros, texto: entrada.trim() });
  };

  const limpiarFiltros = () => {
    setEntrada('');
    setFiltros(FILTROS_DOCUMENTOS_INICIALES);
    setPagina(1);
  };

  const alternarSeleccion = (id) => {
    setSeleccion((actual) => (actual.includes(id) ? actual.filter((valor) => valor !== id) : [...actual, id]));
  };

  const alternarTodos = () => {
    setSeleccion(todosSeleccionados ? [] : idsPagina);
  };

  const abrirHistorial = async (documento) => {
    avisos.limpiar();
    try {
      const respuesta = await listarHistorialDocumento(documento.id, { porPagina: 100 });
      setHistorial({
        titulo: `Historial del documento #${documento.id}`,
        filas: respuesta.resultados ?? [],
        idDocumento: documento.id,
      });
    } catch (errorApi) {
      avisos.setError(errorApi.message);
    }
  };

  const anular = async (documento) => {
    const motivo = window.prompt(`Motivo de anulación del documento #${documento.id}:`);
    if (!motivo || !motivo.trim()) return;
    avisos.limpiar();
    try {
      await anularDocumento(documento.id, motivo.trim());
      setSeleccion([]);
      refrescar(`Se anuló el documento #${documento.id}.`);
    } catch (errorApi) {
      avisos.setError(errorApi.message);
    }
  };

  const restaurar = async (documento) => {
    if (!window.confirm(`¿Restaurar el documento #${documento.id}?`)) return;
    avisos.limpiar();
    try {
      await restaurarDocumento(documento.id);
      refrescar(`Se restauró el documento #${documento.id}.`);
    } catch (errorApi) {
      avisos.setError(errorApi.message);
    }
  };

  return (
    <>
      <Avisos error={avisos.error || errorCarga} exito={avisos.exito} />

      <section className="panel-busqueda">
        <form className="row g-3 align-items-end" onSubmit={aplicarFiltros}>
          <div className="col-12 col-lg-4">
            <label htmlFor="gestion-texto" className="form-label filtro-label">Buscar</label>
            <div className="buscador-input">
              <IconoBuscar size={17} />
              <input
                id="gestion-texto"
                type="search"
                className="form-control"
                placeholder="Título, registro o descriptor"
                value={entrada}
                onChange={(evento) => setEntrada(evento.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <div className="col-6 col-lg-2">
            <label htmlFor="gestion-conservacion" className="form-label filtro-label">Conservación</label>
            <select
              id="gestion-conservacion"
              className="form-select filtro-control"
              value={filtros.conservacion}
              onChange={(evento) => {
                setPagina(1);
                setFiltros({ ...filtros, conservacion: evento.target.value });
              }}
            >
              <option value="">Todas</option>
              <option value="Bueno">Bueno</option>
              <option value="Regular">Regular</option>
              <option value="Malo">Malo</option>
            </select>
          </div>
          <div className="col-6 col-lg-2">
            <label htmlFor="gestion-estado" className="form-label filtro-label">Estado</label>
            <select
              id="gestion-estado"
              className="form-select filtro-control"
              value={filtros.estado}
              onChange={(evento) => {
                setPagina(1);
                setFiltros({ ...filtros, estado: evento.target.value });
              }}
            >
              <option value="activos">Activos</option>
              <option value="anulados">Anulados</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          <div className="col-6 col-lg-2">
            <label htmlFor="gestion-orden" className="form-label filtro-label">Orden</label>
            <select
              id="gestion-orden"
              className="form-select filtro-control"
              value={filtros.orden}
              onChange={(evento) => {
                setPagina(1);
                setFiltros({ ...filtros, orden: evento.target.value });
              }}
            >
              <option value="fecha">Más recientes</option>
              <option value="antiguo">Más antiguos</option>
              <option value="titulo">Título</option>
              <option value="relevancia">Relevancia</option>
            </select>
          </div>
          <div className="col-12 col-lg-2 d-flex gap-2 justify-content-end">
            <button type="button" className="btn boton-secundario" onClick={limpiarFiltros}>Limpiar</button>
            <button type="submit" className="btn boton-buscar boton-compacto">
              <IconoBuscar size={15} /> Buscar
            </button>
          </div>
        </form>
      </section>

      <section className="panel-resultados mt-4">
        <div className="resultados-barra">
          <div>
            <p className="resultados-titulo">
              {datos.total} {datos.total === 1 ? 'documento' : 'documentos'}
            </p>
            {totalPaginas > 1 && <p className="resultados-subtitulo">Página {pagina} de {totalPaginas}</p>}
          </div>
          {seleccionados.length > 0 && (
            <button type="button" className="btn boton-buscar boton-compacto" onClick={() => setIdsMasiva(seleccionados)}>
              Editar selección ({seleccionados.length})
            </button>
          )}
        </div>

        {cargando ? (
          <div className="estado-resultados">
            <div className="spinner-border text-secondary" role="status" />
            <p>Cargando documentos...</p>
          </div>
        ) : datos.resultados.length === 0 ? (
          <div className="estado-resultados">
            <div className="estado-icono"><IconoDocumento size={26} /></div>
            <h3>Sin documentos</h3>
            <p>No se encontraron documentos con los criterios seleccionados.</p>
          </div>
        ) : (
          <div className="tabla-usuarios-contenedor">
            <table className="table tabla-usuarios align-middle">
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={todosSeleccionados}
                      onChange={alternarTodos}
                      aria-label="Seleccionar todos los documentos de la página"
                    />
                  </th>
                  <th scope="col">Código</th>
                  <th scope="col">Título</th>
                  <th scope="col">Tipología</th>
                  <th scope="col">Fondo / año</th>
                  <th scope="col">Conservación</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datos.resultados.map((documento) => (
                  <tr key={documento.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={seleccionados.includes(documento.id)}
                        onChange={() => alternarSeleccion(documento.id)}
                        aria-label={`Seleccionar documento ${documento.codigo}`}
                      />
                    </td>
                    <td className="usuario-codigo">{documento.codigo}</td>
                    <td>{documento.titulo}</td>
                    <td>{documento.tipologia ?? '—'}</td>
                    <td className="small">{documento.fondo} / {documento.anio ?? '—'}</td>
                    <td>{documento.conservacion ?? '—'}</td>
                    <td>
                      <span className={`insignia-estado ${documento.anulado ? 'inactivo' : 'activo'}`}>
                        {documento.anulado ? 'Anulado' : 'Activo'}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="acciones-usuario flex-wrap justify-content-end">
                        <button type="button" className="btn btn-sm boton-secundario" onClick={() => setDocumentoEditando(documento.id)}>
                          Editar
                        </button>
                        <button type="button" className="btn btn-sm boton-secundario" onClick={() => abrirHistorial(documento)}>
                          <IconoHistorial size={13} /> Historial
                        </button>
                        {esAdmin && !documento.anulado && (
                          <>
                            <button type="button" className="btn btn-sm boton-secundario" onClick={() => setDocumentoReemplazo(documento)}>
                              Reemplazar
                            </button>
                            <button type="button" className="btn btn-sm boton-peligro" onClick={() => anular(documento)}>
                              Anular
                            </button>
                          </>
                        )}
                        {esAdmin && documento.anulado && (
                          <button type="button" className="btn btn-sm boton-exito" onClick={() => restaurar(documento)}>
                            Restaurar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPaginas > 1 && !cargando && (
          <nav className="paginacion" aria-label="Paginación de documentos">
            <button type="button" className="btn btn-sm boton-pagina" disabled={pagina <= 1} onClick={() => setPagina((valor) => valor - 1)}>
              Anterior
            </button>
            {paginas.map((numero) => (
              <button
                key={numero}
                type="button"
                className={`btn btn-sm boton-pagina ${numero === pagina ? 'activo' : ''}`}
                onClick={() => setPagina(numero)}
              >
                {numero}
              </button>
            ))}
            <button type="button" className="btn btn-sm boton-pagina" disabled={pagina >= totalPaginas} onClick={() => setPagina((valor) => valor + 1)}>
              Siguiente
            </button>
          </nav>
        )}
      </section>

      {documentoEditando && (
        <EditarDocumentoModal
          id={documentoEditando}
          onClose={() => setDocumentoEditando(null)}
          onSaved={refrescar}
        />
      )}
      {historial && (
        <HistorialModal
          titulo={historial.titulo}
          filas={historial.filas}
          idDocumento={historial.idDocumento}
          onClose={() => setHistorial(null)}
          onChanged={refrescar}
        />
      )}
      {idsMasiva && (
        <EdicionMasivaModal
          ids={idsMasiva}
          onClose={() => setIdsMasiva(null)}
          onSaved={(mensaje) => {
            setSeleccion([]);
            refrescar(mensaje);
          }}
        />
      )}
      {documentoReemplazo && (
        <ReemplazoModal
          documento={documentoReemplazo}
          onClose={() => setDocumentoReemplazo(null)}
          onSaved={refrescar}
        />
      )}
    </>
  );
}
