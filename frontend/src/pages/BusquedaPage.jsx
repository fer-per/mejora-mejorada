import { useEffect, useMemo, useRef, useState } from 'react';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import TarjetaDocumento from '../components/TarjetaDocumento.jsx';
import PanelDetalle from '../components/PanelDetalle.jsx';
import { IconoBuscar, IconoFiltro, IconoLibro } from '../components/Iconos.jsx';
import {
  buscarSimple,
  buscarAvanzada,
  obtenerCatalogos,
  obtenerDocumento,
} from '../services/api.js';

const FILTROS_INICIALES = {
  texto: '',
  fondo: '',
  serie: '',
  tipologia: '',
  conservacion: '',
  fecha_desde: '',
  fecha_hasta: '',
};

const CATALOGOS_INICIALES = {
  fondos: [],
  series: [],
  tipologias: [],
  lugares: [],
  conservaciones: [],
  rangoAnios: { desde: null, hasta: null },
  totalDocumentos: 0,
  totalDigitalizados: 0,
};

const POR_PAGINA = 10;

export default function BusquedaPage() {
  const [modo, setModo] = useState('simple');
  const [consulta, setConsulta] = useState('');
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [orden, setOrden] = useState('relevancia');
  const [pagina, setPagina] = useState(1);
  const [catalogos, setCatalogos] = useState(CATALOGOS_INICIALES);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const detalleRef = useRef(null);

  useEffect(() => {
    let activo = true;
    obtenerCatalogos()
      .then((datos) => {
        if (activo) setCatalogos({ ...CATALOGOS_INICIALES, ...datos });
      })
      .catch(() => {});

    return () => {
      activo = false;
    };
  }, []);

  const ejecutarBusqueda = async (paginaDestino = 1, ordenDestino = orden) => {
    if (modo === 'simple' && !consulta.trim()) {
      setError('Ingrese al menos una palabra clave para iniciar la búsqueda.');
      return;
    }

    setCargando(true);
    setError('');

    try {
      const datos =
        modo === 'simple'
          ? await buscarSimple({
              q: consulta.trim(),
              pagina: paginaDestino,
              porPagina: POR_PAGINA,
              orden: ordenDestino,
            })
          : await buscarAvanzada({
              ...filtros,
              pagina: paginaDestino,
              por_pagina: POR_PAGINA,
              orden: ordenDestino,
            });

      setResultado(datos);
      setPagina(datos.pagina);
      setSeleccionado((actual) =>
        datos.resultados.some((documento) => documento.id === actual?.id) ? actual : null,
      );
    } catch (errorApi) {
      setResultado(null);
      setError(errorApi.message);
    } finally {
      setCargando(false);
    }
  };

  const cambiarModo = (nuevoModo) => {
    if (nuevoModo === modo) return;
    setModo(nuevoModo);
    setError('');
    setResultado(null);
    setSeleccionado(null);
    setPagina(1);
  };

  const seleccionarDocumento = async (resumen) => {
    setCargandoDetalle(true);
    try {
      const ficha = await obtenerDocumento(resumen.id);
      setSeleccionado(ficha);
      if (window.innerWidth < 992) {
        setTimeout(() => detalleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      }
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cambiarOrden = (evento) => {
    const nuevoOrden = evento.target.value;
    setOrden(nuevoOrden);
    if (resultado) ejecutarBusqueda(pagina, nuevoOrden);
  };

  const limpiarFiltros = () => {
    setModo('avanzada');
    setFiltros(FILTROS_INICIALES);
    setConsulta('');
    setOrden('relevancia');
    setPagina(1);
    setError('');
    setSeleccionado(null);
    setResultado(null);
    setCargando(false);
  };

  const paginas = useMemo(() => {
    if (!resultado) return [];
    const total = resultado.paginas;
    const inicio = Math.max(1, Math.min(pagina - 2, total - 4));
    const fin = Math.min(total, inicio + 4);
    return Array.from({ length: Math.max(0, fin - inicio + 1) }, (_, indice) => inicio + indice);
  }, [resultado, pagina]);

  const hayFiltros = Object.values(filtros).some(Boolean) || consulta.trim().length > 0;

  return (
    <div className="app-fondo">
      <BarraNavegacion />

      <main className="contenedor-busqueda">
        <header className="encabezado-busqueda">
          <div>
            <p className="encabezado-etiqueta">Módulo de consulta y recuperación</p>
            <h1 className="encabezado-titulo">Consulta documental</h1>
            <p className="encabezado-descripcion">
              Localice documentos históricos del Archivo Regional de Arequipa mediante texto completo o filtros
              archivísticos.
            </p>
          </div>
          <div className="resumen-datos">
            <div className="dato-resumen">
              <span className="dato-resumen-numero">{catalogos.totalDocumentos}</span>
              <span className="dato-resumen-etiqueta">Documentos</span>
            </div>
            <div className="dato-resumen">
              <span className="dato-resumen-numero">{catalogos.totalDigitalizados}</span>
              <span className="dato-resumen-etiqueta">Digitalizados</span>
            </div>
            <div className="dato-resumen">
              <span className="dato-resumen-numero">
                {catalogos.rangoAnios.desde ?? '—'}–{catalogos.rangoAnios.hasta ?? '—'}
              </span>
              <span className="dato-resumen-etiqueta">Rango temporal</span>
            </div>
          </div>
        </header>

        <section className="panel-busqueda">
          <div className="panel-busqueda-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={modo === 'simple'}
              className={`tab-busqueda ${modo === 'simple' ? 'activo' : ''}`}
              onClick={() => cambiarModo('simple')}
            >
              Búsqueda simple
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={modo === 'avanzada'}
              className={`tab-busqueda ${modo === 'avanzada' ? 'activo' : ''}`}
              onClick={() => cambiarModo('avanzada')}
            >
              Búsqueda avanzada
            </button>
          </div>

          {modo === 'simple' ? (
            <form
              className="buscador-simple"
              onSubmit={(evento) => {
                evento.preventDefault();
                ejecutarBusqueda(1);
              }}
            >
              <div className="buscador-input">
                <IconoBuscar size={19} />
                <input
                  type="search"
                  className="form-control"
                  placeholder="Palabra clave, título o descriptor..."
                  value={consulta}
                  onChange={(evento) => setConsulta(evento.target.value)}
                  maxLength={200}
                  aria-label="Palabra clave"
                />
              </div>
              <button type="submit" className="btn boton-buscar" disabled={cargando}>
                {cargando ? 'Buscando...' : 'Buscar'}
              </button>
            </form>
          ) : (
            <form
              className="buscador-avanzado"
              onSubmit={(evento) => {
                evento.preventDefault();
                ejecutarBusqueda(1);
              }}
            >
              <div className="row g-3">
                <div className="col-12">
                  <label htmlFor="texto" className="form-label filtro-label">Texto libre</label>
                  <input
                    id="texto"
                    type="text"
                    className="form-control"
                    placeholder="Palabras contenidas en el título, alcance o descriptores"
                    value={filtros.texto}
                    onChange={(evento) => setFiltros({ ...filtros, texto: evento.target.value })}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="fondo" className="form-label filtro-label">Fondo</label>
                  <select
                    id="fondo"
                    className="form-select"
                    value={filtros.fondo}
                    onChange={(evento) => setFiltros({ ...filtros, fondo: evento.target.value })}
                  >
                    <option value="">Todos los fondos</option>
                    {catalogos.fondos.map((fondo) => (
                      <option key={fondo.id} value={fondo.id}>{fondo.denominacion}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="serie" className="form-label filtro-label">Serie documental</label>
                  <select
                    id="serie"
                    className="form-select"
                    value={filtros.serie}
                    onChange={(evento) => setFiltros({ ...filtros, serie: evento.target.value })}
                  >
                    <option value="">Todas las series</option>
                    {catalogos.series.map((serie) => (
                      <option key={serie} value={serie}>{serie}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="tipologia" className="form-label filtro-label">Título/Escritura</label>
                  <select
                    id="tipologia"
                    className="form-select"
                    value={filtros.tipologia}
                    onChange={(evento) => setFiltros({ ...filtros, tipologia: evento.target.value })}
                  >
                    <option value="">Todos</option>
                    {catalogos.tipologias.map((tipologia) => (
                      <option key={tipologia} value={tipologia}>{tipologia}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="conservacion" className="form-label filtro-label">Estado de conservación</label>
                  <select
                    id="conservacion"
                    className="form-select"
                    value={filtros.conservacion}
                    onChange={(evento) => setFiltros({ ...filtros, conservacion: evento.target.value })}
                  >
                    <option value="">Todos los estados</option>
                    {catalogos.conservaciones.map((estado) => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="fecha_desde" className="form-label filtro-label">Fecha desde</label>
                  <input
                    id="fecha_desde"
                    type="date"
                    className="form-control"
                    value={filtros.fecha_desde}
                    onChange={(evento) => setFiltros({ ...filtros, fecha_desde: evento.target.value })}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="fecha_hasta" className="form-label filtro-label">Fecha hasta</label>
                  <input
                    id="fecha_hasta"
                    type="date"
                    className="form-control"
                    value={filtros.fecha_hasta}
                    onChange={(evento) => setFiltros({ ...filtros, fecha_hasta: evento.target.value })}
                  />
                </div>
              </div>

              <div className="buscador-avanzado-acciones">
                <button type="button" className="btn boton-secundario" onClick={limpiarFiltros}>
                  Limpiar filtros
                </button>
                <button type="submit" className="btn boton-buscar" disabled={cargando}>
                  <IconoFiltro />
                  {cargando ? 'Filtrando...' : 'Aplicar filtros'}
                </button>
              </div>
            </form>
          )}
        </section>

        {error && (
          <div className="alert alert-warning mt-3 py-2 px-3 small" role="alert">
            {error}
          </div>
        )}

        <div className="row g-4 mt-1">
          <div className="col-12 col-lg-7">
            <section className="panel-resultados">
              <div className="resultados-barra">
                <div>
                  <p className="resultados-titulo">
                    {resultado
                      ? `${resultado.total} ${resultado.total === 1 ? 'documento encontrado' : 'documentos encontrados'}`
                      : 'Resultados'}
                  </p>
                  {resultado && resultado.paginas > 1 && (
                    <p className="resultados-subtitulo">Página {resultado.pagina} de {resultado.paginas}</p>
                  )}
                </div>
                <div className="resultados-acciones">
                  <label htmlFor="orden" className="resultados-orden-label">Ordenar</label>
                  <select id="orden" className="form-select form-select-sm" value={orden} onChange={cambiarOrden}>
                    <option value="relevancia">Relevancia</option>
                    <option value="fecha">Más reciente</option>
                    <option value="antiguo">Más antiguo</option>
                    <option value="titulo">Título (A-Z)</option>
                  </select>
                </div>
              </div>

              {cargando ? (
                <div className="estado-resultados">
                  <div className="spinner-border text-secondary" role="status" />
                  <p>Consultando el repositorio documental...</p>
                </div>
              ) : !resultado || resultado.resultados.length === 0 ? (
                <div className="estado-resultados">
                  <div className="estado-icono">
                    <IconoLibro size={28} />
                  </div>
                  <h3>Sin resultados</h3>
                  <p>
                    {hayFiltros
                      ? 'Ningún documento coincide con los criterios ingresados. Pruebe con otros términos o limpie los filtros.'
                      : 'Realice una búsqueda para consultar los documentos del archivo.'}
                  </p>
                  {hayFiltros && (
                    <button type="button" className="btn boton-secundario btn-sm" onClick={limpiarFiltros}>
                      Limpiar filtros
                    </button>
                  )}
                </div>
              ) : (
                <div className="lista-resultados">
                  {resultado.resultados.map((documento) => (
                    <TarjetaDocumento
                      key={documento.id}
                      documento={documento}
                      activo={seleccionado?.id === documento.id}
                      onSeleccionar={seleccionarDocumento}
                    />
                  ))}
                </div>
              )}

              {resultado && resultado.paginas > 1 && !cargando && (
                <nav className="paginacion" aria-label="Paginación de resultados">
                  <button
                    type="button"
                    className="btn btn-sm boton-pagina"
                    disabled={resultado.pagina <= 1}
                    onClick={() => ejecutarBusqueda(resultado.pagina - 1)}
                  >
                    Anterior
                  </button>
                  {paginas.map((numero) => (
                    <button
                      key={numero}
                      type="button"
                      className={`btn btn-sm boton-pagina ${numero === resultado.pagina ? 'activo' : ''}`}
                      onClick={() => ejecutarBusqueda(numero)}
                    >
                      {numero}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm boton-pagina"
                    disabled={resultado.pagina >= resultado.paginas}
                    onClick={() => ejecutarBusqueda(resultado.pagina + 1)}
                  >
                    Siguiente
                  </button>
                </nav>
              )}
            </section>
          </div>

          <div className="col-12 col-lg-5" ref={detalleRef}>
            <PanelDetalle
              documento={seleccionado}
              cargando={cargandoDetalle}
              onCerrar={() => setSeleccionado(null)}
            />
          </div>
        </div>

        <footer className="pie-piloto">
          Piloto SIARC-ARA · Los datos y las imágenes son de demostración · Trazabilidad registrada en auditoría
        </footer>
      </main>
    </div>
  );
}
