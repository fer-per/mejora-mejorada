import { useState } from 'react';
import { edicionMasiva } from '../../../services/gestionApi.js';
import { FORMULARIO_MASIVA_INICIAL } from '../constants.js';
import ModalBase from './ModalBase.jsx';

export default function EdicionMasivaModal({ ids, onClose, onSaved }) {
  const [formulario, setFormulario] = useState(FORMULARIO_MASIVA_INICIAL);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const actualizar = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    const cambios = {};
    for (const [campo, valor] of Object.entries(formulario)) {
      if (String(valor).trim() !== '') cambios[campo] = valor;
    }
    if (Object.keys(cambios).length === 0) {
      setError('Seleccione al menos un campo a modificar.');
      return;
    }

    setGuardando(true);
    setError('');
    try {
      const respuesta = await edicionMasiva(ids, cambios);
      onSaved(`Se editaron ${respuesta.afectados} documento(s). Operación ${respuesta.idOperacion}.`);
      onClose();
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalBase
      titulo={`Edición masiva de ${ids.length} documento(s)`}
      etiqueta="Edición por lote"
      onCerrar={() => !guardando && onClose()}
    >
      <form onSubmit={guardar}>
        <p className="small text-muted">Solo se modificarán los campos que complete. La operación es todo o nada.</p>
        {error && <div className="alert alert-danger py-2 px-3 small">{error}</div>}
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label filtro-label" htmlFor="masiva-conservacion">Conservación</label>
            <select id="masiva-conservacion" className="form-select" value={formulario.estado_conservacion} onChange={(evento) => actualizar('estado_conservacion', evento.target.value)}>
              <option value="">No modificar</option>
              <option value="Bueno">Bueno</option>
              <option value="Regular">Regular</option>
              <option value="Malo">Malo</option>
            </select>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label filtro-label" htmlFor="masiva-tipologia">Tipología</label>
            <input id="masiva-tipologia" className="form-control" value={formulario.tipologia} onChange={(evento) => actualizar('tipologia', evento.target.value)} maxLength={100} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label filtro-label" htmlFor="masiva-serie">Serie</label>
            <input id="masiva-serie" className="form-control" value={formulario.serie} onChange={(evento) => actualizar('serie', evento.target.value)} maxLength={150} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label filtro-label" htmlFor="masiva-subserie">Subserie</label>
            <input id="masiva-subserie" className="form-control" value={formulario.subserie} onChange={(evento) => actualizar('subserie', evento.target.value)} maxLength={150} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label filtro-label" htmlFor="masiva-ubicacion">Ubicación física</label>
            <input id="masiva-ubicacion" className="form-control" value={formulario.ubicacion_fisica} onChange={(evento) => actualizar('ubicacion_fisica', evento.target.value)} maxLength={150} />
          </div>
          <div className="col-12">
            <label className="form-label filtro-label" htmlFor="masiva-observaciones">Observaciones</label>
            <textarea id="masiva-observaciones" className="form-control" rows={2} value={formulario.observaciones} onChange={(evento) => actualizar('observaciones', evento.target.value)} maxLength={2000} />
          </div>
        </div>
        <div className="modal-acciones">
          <button type="button" className="btn boton-secundario" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn boton-buscar boton-compacto" disabled={guardando}>
            {guardando ? 'Aplicando...' : 'Aplicar cambios'}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
