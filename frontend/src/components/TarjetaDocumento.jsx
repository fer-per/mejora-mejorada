import { IconoDocumento, IconoImagen } from './Iconos.jsx';
import Miniatura from './Miniatura.jsx';

const CLASE_CONSERVACION = {
  Bueno: 'conservacion-bueno',
  Regular: 'conservacion-regular',
  Malo: 'conservacion-deteriorado',
};

export default function TarjetaDocumento({ documento, activo, onSeleccionar }) {
  return (
    <button
      type="button"
      className={`tarjeta-documento ${activo ? 'activo' : ''}`}
      onClick={() => onSeleccionar(documento)}
    >
      <div className="tarjeta-miniatura">
        {documento.miniatura_url ? (
          <Miniatura url={documento.miniatura_url} titulo={documento.titulo} />
        ) : (
          <div className="tarjeta-sin-imagen">
            <IconoImagen size={26} />
            <span>{documento.digitalizado ? 'Sin vista previa' : 'Sin digitalizar'}</span>
          </div>
        )}
        <span className="tarjeta-anio">{documento.anio}</span>
      </div>

      <div className="tarjeta-cuerpo">
        <div className="tarjeta-codigo">
          <IconoDocumento size={13} />
          {documento.codigo}
        </div>
        <h3 className="tarjeta-titulo">{documento.titulo}</h3>
        <p className="tarjeta-meta">
          {documento.tipo} · {documento.fondo}
        </p>
        <p className="tarjeta-meta tarjeta-meta-secundaria">
          {documento.escribano ? `Escribano: ${documento.escribano}` : documento.serie}
          {documento.folios ? ` · f. ${documento.folios}` : ''}
        </p>
        <div className="tarjeta-etiquetas">
          {documento.conservacion && (
            <span className={`etiqueta ${CLASE_CONSERVACION[documento.conservacion] ?? ''}`}>
              {documento.conservacion}
            </span>
          )}
          <span className="etiqueta etiqueta-formato">{documento.formato}</span>
          {!documento.digitalizado && <span className="etiqueta etiqueta-alerta">Sin imagen</span>}
        </div>
      </div>
    </button>
  );
}
