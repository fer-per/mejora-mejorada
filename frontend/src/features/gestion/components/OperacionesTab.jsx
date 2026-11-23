import { useState } from 'react';
import {
  obtenerOperacionGestion,
  revertirOperacionGestion,
} from '../../../services/gestionApi.js';
import { useAvisos } from '../hooks/useAvisos.js';
import { useOperacionesGestion } from '../hooks/useOperacionesGestion.js';
import { formatearFechaHora } from '../utils.js';
import Avisos from './Avisos.jsx';
import HistorialModal from './HistorialModal.jsx';

const TIPOS_OPERACION = [
  ['EDICION_MASIVA', 'Edición masiva'],
  ['ANULACION', 'Anulación'],
  ['RESTAURACION', 'Restauración'],
  ['REVERSION_OPERACION', 'Reversión'],
  ['REEMPLAZO_ARCHIVO', 'Reemplazo de archivo'],
];

export default function OperacionesTab({ onCambio }) {
  const [tipoOperacion, setTipoOperacion] = useState('');
  const [pagina, setPagina] = useState(1);
  const [detalle, setDetalle] = useState(null);
  const avisos = useAvisos();

  const { operaciones, cargando, error: errorCarga, recargar } = useOperacionesGestion({
    tipoOperacion,
    pagina,
  });

  const verDetalle = async (idOperacion) => {
    avisos.limpiar();
    try {
      setDetalle(await obtenerOperacionGestion(idOperacion));
    } catch (errorApi) {
      avisos.setError(errorApi.message);
    }
  };

  const revertir = async (operacion) => {
    if (!window.confirm(`¿Revertir la operación ${operacion.idOperacion} (${operacion.documentos} documento(s))?`)) {
      return;
    }
    avisos.limpiar();
    try {
      const respuesta = await revertirOperacionGestion(operacion.idOperacion);
      recargar();
      onCambio();
      avisos.setExito(`Se revirtieron ${respuesta.afectados} documento(s).`);
    } catch (errorApi) {
      avisos.setError(errorApi.message);
    }
  };

  return (
    <>
      <Avisos error={avisos.error || errorCarga} exito={avisos.exito} />

      <section className="panel-resultados">
        <div className="resultados-barra">
          <div>
            <p className="resultados-titulo">{operaciones.total} operación(es) registradas</p>
            <p className="resultados-subtitulo">Revierta ediciones masivas y anulaciones de forma controlada.</p>
          </div>
          <select
            className="form-select filtro-control"
            style={{ minWidth: '180px' }}
            value={tipoOperacion}
            onChange={(evento) => {
              setPagina(1);
              setTipoOperacion(evento.target.value);
            }}
            aria-label="Filtrar por tipo de operación"
          >
            <option value="">Todas las operaciones</option>
            {TIPOS_OPERACION.map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>{etiqueta}</option>
            ))}
          </select>
        </div>

        {cargando ? (
          <div className="estado-resultados">
            <div className="spinner-border text-secondary" role="status" />
            <p>Cargando operaciones...</p>
          </div>
        ) : operaciones.resultados.length === 0 ? (
          <div className="estado-resultados">
            <h3>Sin operaciones</h3>
            <p>No hay operaciones registradas para los criterios seleccionados.</p>
          </div>
        ) : (
          <div className="tabla-usuarios-contenedor">
            <p className="tabla-scroll-aviso">Desplace horizontalmente para ver todas las columnas.</p>
            <table className="table tabla-usuarios tabla-auditoria align-middle">
              <thead>
                <tr>
                  <th scope="col">Operación</th>
                  <th scope="col">Inicio</th>
                  <th scope="col">Usuario</th>
                  <th scope="col">Cambios</th>
                  <th scope="col">Documentos</th>
                  <th scope="col" className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {operaciones.resultados.map((operacion) => (
                  <tr key={operacion.idOperacion}>
                    <td>
                      <span className="insignia-accion accion-gestion">{operacion.tipoOperacion}</span>
                      <div className="small text-muted mt-1">{operacion.idOperacion}</div>
                    </td>
                    <td className="auditoria-fecha">{formatearFechaHora(operacion.fechaInicio)}</td>
                    <td>{operacion.usuario ?? '—'}</td>
                    <td>{operacion.cambios}</td>
                    <td>{operacion.documentos}</td>
                    <td className="text-end">
                      <div className="acciones-usuario justify-content-end">
                        <button type="button" className="btn btn-sm boton-secundario" onClick={() => verDetalle(operacion.idOperacion)}>
                          Detalle
                        </button>
                        {operacion.tipoOperacion !== 'FUSION' && (
                          <button type="button" className="btn btn-sm boton-peligro" onClick={() => revertir(operacion)}>
                            Revertir
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

        <nav className="paginacion" aria-label="Paginación de operaciones">
          <button type="button" className="btn btn-sm boton-pagina" disabled={pagina <= 1} onClick={() => setPagina((valor) => valor - 1)}>
            Anterior
          </button>
          <span className="small text-muted align-self-center">Página {pagina}</span>
          <button
            type="button"
            className="btn btn-sm boton-pagina"
            disabled={pagina * 20 >= operaciones.total}
            onClick={() => setPagina((valor) => valor + 1)}
          >
            Siguiente
          </button>
        </nav>
      </section>

      {detalle && (
        <HistorialModal
          titulo={`Operación ${detalle.idOperacion}`}
          filas={detalle.cambios}
          idDocumento={null}
          onClose={() => setDetalle(null)}
          onChanged={() => {}}
        />
      )}
    </>
  );
}
