import { useState } from 'react';
import { revertirCambioDocumento } from '../../../services/gestionApi.js';
import { OPERACIONES_REVERSIBLES } from '../constants.js';
import { diferencias, formatearFechaHora, valorLegible } from '../utils.js';
import ModalBase from './ModalBase.jsx';

function TablaHistorial({ filas, idDocumento, onRevertir }) {
  if (!filas?.length) {
    return (
      <div className="estado-resultados">
        <p>No hay cambios registrados.</p>
      </div>
    );
  }

  return (
    <div className="tabla-usuarios-contenedor" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
      <table className="table tabla-usuarios tabla-auditoria align-middle">
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Operación</th>
            <th scope="col">Usuario</th>
            <th scope="col">Cambios</th>
            {idDocumento && <th scope="col" className="text-end">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const cambios = diferencias(fila.antes, fila.despues);
            return (
              <tr key={fila.id}>
                <td className="auditoria-fecha">{formatearFechaHora(fila.fechaHora)}</td>
                <td><span className="insignia-accion accion-gestion">{fila.tipoOperacion}</span></td>
                <td>{fila.usuario ?? `Usuario #${fila.idUsuario}`}</td>
                <td>
                  {cambios.length === 0 ? (
                    <span className="text-muted small">Sin diferencias visibles</span>
                  ) : (
                    <details>
                      <summary className="small">{cambios.length} campo(s)</summary>
                      <dl className="detalle-auditoria mt-2">
                        {cambios.map((cambio) => (
                          <div key={cambio.clave} className="detalle-auditoria-completo">
                            <dt>{cambio.etiqueta}</dt>
                            <dd>
                              <span className="text-muted">{valorLegible(cambio.antes)}</span>
                              {' → '}
                              <strong>{valorLegible(cambio.despues)}</strong>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </td>
                {idDocumento && (
                  <td className="text-end">
                    {OPERACIONES_REVERSIBLES.has(fila.tipoOperacion) ? (
                      <button
                        type="button"
                        className="btn btn-sm boton-secundario"
                        onClick={() => onRevertir(fila)}
                      >
                        Revertir
                      </button>
                    ) : (
                      <span className="text-muted small">No reversible</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function HistorialModal({ titulo, filas, idDocumento, onClose, onChanged }) {
  const [error, setError] = useState('');
  const [revirtiendo, setRevirtiendo] = useState(false);

  const revertir = async (cambio) => {
    if (!idDocumento) return;
    if (!window.confirm(`¿Revertir el cambio #${cambio.id}? Se validará que el documento no haya cambiado después.`)) {
      return;
    }
    setRevirtiendo(true);
    setError('');
    try {
      await revertirCambioDocumento(idDocumento, cambio.id);
      onChanged(`Se revirtió el cambio #${cambio.id}.`);
      onClose();
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setRevirtiendo(false);
    }
  };

  return (
    <ModalBase titulo={titulo} etiqueta="Historial de cambios" onCerrar={onClose} ancho="1000px">
      {error && <div className="alert alert-danger py-2 px-3 small">{error}</div>}
      <TablaHistorial filas={filas} idDocumento={idDocumento} onRevertir={revertir} />
      <div className="modal-acciones">
        <button type="button" className="btn boton-secundario" onClick={onClose} disabled={revirtiendo}>
          Cerrar
        </button>
      </div>
    </ModalBase>
  );
}
