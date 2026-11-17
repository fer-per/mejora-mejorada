import { useState } from 'react';
import { actualizarEstructura } from '../../../services/gestionApi.js';
import { CAMPOS_ESTRUCTURA } from '../constants.js';
import ModalBase from './ModalBase.jsx';

function valoresIniciales(tipo, item) {
  return Object.fromEntries(
    Object.keys(CAMPOS_ESTRUCTURA[tipo]).map((campo) => [campo, item[campo] == null ? '' : String(item[campo])]),
  );
}

function construirCambios(tipo, item, valores) {
  const cambios = {};
  for (const [campo, definicion] of Object.entries(CAMPOS_ESTRUCTURA[tipo])) {
    const valor = valores[campo].trim();
    const previo = item[campo] == null ? '' : String(item[campo]);
    if (valor === previo) continue;
    if (valor === '') {
      cambios[campo] = null;
    } else {
      cambios[campo] = definicion.numerico ? Number(valor) : valor;
    }
  }
  return cambios;
}

export default function EstructuraModal({ tipo, item, onClose, onSaved }) {
  const [valores, setValores] = useState(() => valoresIniciales(tipo, item));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const campos = CAMPOS_ESTRUCTURA[tipo];

  const guardar = async (evento) => {
    evento.preventDefault();
    const cambios = construirCambios(tipo, item, valores);
    if (Object.keys(cambios).length === 0) {
      setError('No se detectaron cambios en la estructura.');
      return;
    }

    setGuardando(true);
    setError('');
    try {
      await actualizarEstructura(tipo, item.id, {
        ...cambios,
        ...(item.version ? { version: item.version } : {}),
      });
      onSaved(`Se actualizó ${tipo} #${item.id}.`);
      onClose();
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalBase
      titulo={`Editar ${tipo} #${item.id}`}
      etiqueta="Edición de jerarquía"
      onCerrar={() => !guardando && onClose()}
    >
      <form onSubmit={guardar}>
        {error && <div className="alert alert-danger py-2 px-3 small">{error}</div>}
        <div className="row g-3">
          {Object.entries(campos).map(([campo, definicion]) => (
            <div className={definicion.tipo === 'textarea' ? 'col-12' : 'col-12 col-md-6'} key={campo}>
              <label className="form-label filtro-label" htmlFor={`estructura-${campo}`}>
                {definicion.etiqueta}
              </label>
              {definicion.tipo === 'textarea' ? (
                <textarea
                  id={`estructura-${campo}`}
                  className="form-control"
                  rows={3}
                  value={valores[campo]}
                  onChange={(evento) => setValores({ ...valores, [campo]: evento.target.value })}
                />
              ) : (
                <input
                  id={`estructura-${campo}`}
                  type={definicion.tipo === 'number' ? 'number' : 'text'}
                  className="form-control"
                  value={valores[campo]}
                  onChange={(evento) => setValores({ ...valores, [campo]: evento.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        <p className="small text-muted mt-3 mb-0">
          Se enviará la versión del registro para impedir sobrescribir cambios concurrentes.
        </p>
        <div className="modal-acciones">
          <button type="button" className="btn boton-secundario" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn boton-buscar boton-compacto" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
