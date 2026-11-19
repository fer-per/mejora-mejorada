import { useEffect, useState } from 'react';
import { IconoBuscar } from '../../../components/Iconos.jsx';
import {
  fusionarEstructura,
  listarHistorialEntidad,
  previsualizarFusion,
} from '../../../services/gestionApi.js';
import {
  COLUMNAS_ESTRUCTURA,
  TIPOS_ESTRUCTURA,
  TIPOS_FUSION,
} from '../constants.js';
import { useAvisos } from '../hooks/useAvisos.js';
import { useEstructuraGestion } from '../hooks/useEstructuraGestion.js';
import { valorLegible } from '../utils.js';
import Avisos from './Avisos.jsx';
import EstructuraModal from './EstructuraModal.jsx';
import HistorialModal from './HistorialModal.jsx';

export default function EstructuraTab({ esAdmin, onCambio, fusionInicial }) {
  const [tipo, setTipo] = useState('titulos');
  const [entrada, setEntrada] = useState('');
  const [q, setQ] = useState('');
  const [modalEstructura, setModalEstructura] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [fusionTipo, setFusionTipo] = useState('protocolos');
  const [fusionOrigen, setFusionOrigen] = useState('');
  const [fusionDestino, setFusionDestino] = useState('');
  const [fusionPreview, setFusionPreview] = useState(null);
  const [fusionando, setFusionando] = useState(false);
  const avisos = useAvisos();

  const { estructura, cargando, error: errorCarga, recargar } = useEstructuraGestion({ tipo, q });

  useEffect(() => {
    if (!fusionInicial) return;
    setFusionTipo(fusionInicial.tipo);
    setTipo(fusionInicial.tipo);
    setFusionOrigen(String(fusionInicial.entidades?.[0]?.id ?? ''));
    setFusionDestino(String(fusionInicial.entidades?.[1]?.id ?? ''));
    setFusionPreview(null);
  }, [fusionInicial]);

  const refrescar = (mensaje) => {
    recargar();
    onCambio();
    if (mensaje) avisos.setExito(mensaje);
  };

  const buscar = (evento) => {
    evento.preventDefault();
    setQ(entrada.trim());
  };

  const abrirHistorial = async (item) => {
    avisos.limpiar();
    try {
      const respuesta = await listarHistorialEntidad(tipo, item.id, { porPagina: 100 });
      setHistorial({
        titulo: `Historial de ${tipo} #${item.id}`,
        filas: respuesta.resultados ?? [],
        idDocumento: null,
      });
    } catch (errorApi) {
      avisos.setError(errorApi.message);
    }
  };

  const previsualizar = async () => {
    const origen = Number(fusionOrigen);
    const destino = Number(fusionDestino);
    if (!origen || !destino || origen === destino) {
      avisos.setError('Indique dos identificadores diferentes para la fusión.');
      return;
    }
    avisos.limpiar();
    try {
      setFusionPreview(await previsualizarFusion(fusionTipo, { origen, destino }));
    } catch (errorApi) {
      setFusionPreview(null);
      avisos.setError(errorApi.message);
    }
  };

  const ejecutarFusion = async () => {
    if (!fusionPreview) return;
    if (!window.confirm(`¿Fusionar ${fusionPreview.tipo} #${fusionPreview.origen.id} en #${fusionPreview.destino.id}? Esta acción no se revierte automáticamente.`)) {
      return;
    }
    setFusionando(true);
    avisos.limpiar();
    try {
      await fusionarEstructura(fusionTipo, {
        origen: fusionPreview.origen.id,
        destino: fusionPreview.destino.id,
      });
      setFusionPreview(null);
      setFusionOrigen('');
      setFusionDestino('');
      refrescar(`Se fusionó ${fusionTipo} #${fusionPreview.origen.id} en #${fusionPreview.destino.id}.`);
    } catch (errorApi) {
      avisos.setError(errorApi.message);
    } finally {
      setFusionando(false);
    }
  };

  const columnas = COLUMNAS_ESTRUCTURA[tipo] ?? [];

  return (
    <>
      <Avisos error={avisos.error || errorCarga} exito={avisos.exito} />

      <section className="panel-busqueda">
        <form className="row g-3 align-items-end" onSubmit={buscar}>
          <div className="col-12 col-md-4">
            <label htmlFor="tipo-estructura" className="form-label filtro-label">Entidad</label>
            <select
              id="tipo-estructura"
              className="form-select filtro-control"
              value={tipo}
              onChange={(evento) => {
                setTipo(evento.target.value);
                setEntrada('');
                setQ('');
              }}
            >
              {TIPOS_ESTRUCTURA.map((item) => (
                <option key={item.id} value={item.id}>{item.etiqueta}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-5">
            <label htmlFor="q-estructura" className="form-label filtro-label">Buscar</label>
            <div className="buscador-input">
              <IconoBuscar size={17} />
              <input
                id="q-estructura"
                type="search"
                className="form-control"
                value={entrada}
                onChange={(evento) => setEntrada(evento.target.value)}
                placeholder="Nombre, número o año"
                maxLength={200}
              />
            </div>
          </div>
          <div className="col-12 col-md-3 d-flex gap-2 justify-content-md-end align-items-center">
            <span className="small text-muted me-auto">{estructura.total} registro(s)</span>
            <button type="submit" className="btn boton-buscar boton-compacto">Buscar</button>
          </div>
        </form>
      </section>

      {esAdmin && TIPOS_FUSION.includes(tipo) && (
        <section className="panel-busqueda mt-3">
          <div className="seccion-formulario-cabecera">
            <h2 className="seccion-formulario-titulo">Fusionar {tipo}</h2>
          </div>
          <div className="row g-3 align-items-end">
            <div className="col-6 col-md-2">
              <label htmlFor="fusion-origen" className="form-label filtro-label">Origen</label>
              <input
                id="fusion-origen"
                type="number"
                className="form-control"
                value={fusionOrigen}
                onChange={(evento) => {
                  setFusionOrigen(evento.target.value);
                  setFusionPreview(null);
                }}
                min={1}
              />
            </div>
            <div className="col-6 col-md-2">
              <label htmlFor="fusion-destino" className="form-label filtro-label">Destino</label>
              <input
                id="fusion-destino"
                type="number"
                className="form-control"
                value={fusionDestino}
                onChange={(evento) => {
                  setFusionDestino(evento.target.value);
                  setFusionPreview(null);
                }}
                min={1}
              />
            </div>
            <div className="col-12 col-md-4">
              <label htmlFor="fusion-tipo" className="form-label filtro-label">Tipo</label>
              <select
                id="fusion-tipo"
                className="form-select filtro-control"
                value={fusionTipo}
                onChange={(evento) => {
                  setFusionTipo(evento.target.value);
                  setFusionPreview(null);
                }}
              >
                {TIPOS_FUSION.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="col-12 col-md-4 d-flex gap-2 justify-content-end">
              <button type="button" className="btn boton-secundario" onClick={previsualizar}>Previsualizar</button>
              <button type="button" className="btn boton-peligro" onClick={ejecutarFusion} disabled={!fusionPreview || fusionando}>
                {fusionando ? 'Fusionando...' : 'Fusionar'}
              </button>
            </div>
          </div>
          {fusionPreview && (
            <div className="alert alert-warning mt-3 py-2 px-3 small" role="alert">
              <strong>Origen:</strong> {fusionPreview.origen.etiqueta} (#{fusionPreview.origen.id}) ·{' '}
              <strong>Destino:</strong> {fusionPreview.destino.etiqueta} (#{fusionPreview.destino.id})
              {fusionPreview.conflictos?.length > 0 && (
                <ul className="mb-0 mt-2">
                  {fusionPreview.conflictos.map((conflicto) => <li key={conflicto}>{conflicto}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      <section className="panel-resultados mt-4">
        <div className="resultados-barra">
          <p className="resultados-titulo">Jerarquía archivística</p>
        </div>
        {cargando ? (
          <div className="estado-resultados">
            <div className="spinner-border text-secondary" role="status" />
            <p>Cargando estructura...</p>
          </div>
        ) : estructura.items.length === 0 ? (
          <div className="estado-resultados">
            <h3>Sin registros</h3>
            <p>No se encontraron entidades para el filtro seleccionado.</p>
          </div>
        ) : (
          <div className="tabla-usuarios-contenedor">
            <table className="table tabla-usuarios align-middle">
              <thead>
                <tr>
                  {columnas.map(([campo, etiqueta]) => <th key={campo} scope="col">{etiqueta}</th>)}
                  <th scope="col" className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {estructura.items.map((item) => (
                  <tr key={item.id}>
                    {columnas.map(([campo]) => <td key={campo}>{valorLegible(item[campo])}</td>)}
                    <td className="text-end">
                      <div className="acciones-usuario justify-content-end">
                        {esAdmin && (
                          <button type="button" className="btn btn-sm boton-secundario" onClick={() => setModalEstructura(item)}>
                            Editar
                          </button>
                        )}
                        <button type="button" className="btn btn-sm boton-secundario" onClick={() => abrirHistorial(item)}>
                          Historial
                        </button>
                        {esAdmin && TIPOS_FUSION.includes(tipo) && (
                          <button
                            type="button"
                            className="btn btn-sm boton-secundario"
                            onClick={() => {
                              setFusionTipo(tipo);
                              setFusionDestino(String(item.id));
                              setFusionPreview(null);
                            }}
                          >
                            Usar como destino
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
      </section>

      {modalEstructura && (
        <EstructuraModal
          tipo={tipo}
          item={modalEstructura}
          onClose={() => setModalEstructura(null)}
          onSaved={refrescar}
        />
      )}
      {historial && (
        <HistorialModal
          titulo={historial.titulo}
          filas={historial.filas}
          idDocumento={null}
          onClose={() => setHistorial(null)}
          onChanged={refrescar}
        />
      )}
    </>
  );
}
