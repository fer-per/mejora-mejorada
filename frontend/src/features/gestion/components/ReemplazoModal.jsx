import { useState } from 'react';
import { IconoSubir } from '../../../components/Iconos.jsx';
import { reemplazarArchivoDocumento } from '../../../services/gestionApi.js';
import ModalBase from './ModalBase.jsx';

export default function ReemplazoModal({ documento, onClose, onSaved }) {
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (evento) => {
    evento.preventDefault();
    if (!archivo) {
      setError('Seleccione el archivo PDF/A o TIFF.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await reemplazarArchivoDocumento(documento.id, archivo);
      onSaved(`Se reemplazó el archivo del documento #${documento.id}.`);
      onClose();
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalBase
      titulo={`Reemplazar archivo del documento #${documento.id}`}
      etiqueta="Reemplazo de archivo digital"
      onCerrar={() => !guardando && onClose()}
    >
      <form onSubmit={guardar}>
        <p className="small text-muted">
          El archivo anterior no se elimina. El reemplazo queda registrado en el historial con la ruta anterior y la nueva.
        </p>
        {error && <div className="alert alert-danger py-2 px-3 small">{error}</div>}
        <label htmlFor="reemplazo-archivo" className="zona-archivo">
          <IconoSubir size={26} />
          <span className="zona-archivo-titulo">
            {archivo ? archivo.name : 'Seleccione el archivo PDF/A o TIFF'}
          </span>
          <span className="zona-archivo-ayuda">Extensiones permitidas: .pdf, .tif, .tiff · máximo 50 MB</span>
          <input
            id="reemplazo-archivo"
            type="file"
            accept=".pdf,.tif,.tiff,application/pdf,image/tiff"
            className="zona-archivo-input"
            onChange={(evento) => setArchivo(evento.target.files?.[0] ?? null)}
          />
        </label>
        <div className="modal-acciones">
          <button type="button" className="btn boton-secundario" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn boton-buscar boton-compacto" disabled={guardando}>
            {guardando ? 'Reemplazando...' : 'Reemplazar archivo'}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
