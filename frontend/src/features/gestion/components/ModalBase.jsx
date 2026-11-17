import { IconoCerrar } from '../../../components/Iconos.jsx';

export default function ModalBase({ titulo, etiqueta, onCerrar, children, ancho = '760px' }) {
  return (
    <div className="modal-fondo" role="presentation" onMouseDown={onCerrar}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{ maxWidth: ancho, width: '100%' }}
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="modal-cabecera">
          <div>
            <p className="encabezado-etiqueta">{etiqueta}</p>
            <h2 className="modal-titulo">{titulo}</h2>
          </div>
          <button type="button" className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <IconoCerrar />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
