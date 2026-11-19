import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { IconoCerrar, IconoDocumento, IconoImagen } from './Iconos.jsx';
import VisorDocumento from './VisorDocumento.jsx';

function formatearFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="dato-detalle">
      <span className="dato-etiqueta">{etiqueta}</span>
      <span className="dato-valor">{valor || 'No registrado'}</span>
    </div>
  );
}

export default function PanelDetalle({ documento, cargando, onCerrar }) {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const puedeEditar = usuario?.role === 'admin' || usuario?.role === 'archivero';

  if (cargando) {
    return (
      <aside className="panel-detalle panel-detalle-vacio">
        <div className="spinner-border text-secondary" role="status" />
        <p>Cargando ficha descriptiva...</p>
      </aside>
    );
  }

  if (!documento) {
    return (
      <aside className="panel-detalle panel-detalle-vacio">
        <div className="panel-vacio-icono">
          <IconoDocumento size={30} />
        </div>
        <h3>Ficha descriptiva</h3>
        <p>Seleccione un documento de los resultados para revisar sus metadatos y la imagen digitalizada.</p>
      </aside>
    );
  }

  return (
    <aside className="panel-detalle">
      <div className="panel-detalle-cabecera">
        <div>
          <p className="panel-detalle-codigo">{documento.codigo}</p>
          <h3 className="panel-detalle-titulo">{documento.titulo}</h3>
        </div>
        <button type="button" className="panel-cerrar" onClick={onCerrar} aria-label="Cerrar ficha">
          <IconoCerrar />
        </button>
      </div>

      {puedeEditar && !documento.anulado && (
        <div className="panel-acciones">
          <button
            type="button"
            className="btn btn-sm boton-secundario"
            onClick={() => navigate(`/gestion?documento=${documento.id}`)}
          >
            Editar documento
          </button>
        </div>
      )}

      <div className={`panel-imagen ${documento.digitalizado ? 'panel-imagen-visor' : ''}`}>
        {documento.digitalizado ? (
          <VisorDocumento documento={documento} />
        ) : (
          <div className="tarjeta-sin-imagen">
            <IconoImagen size={32} />
            <span>Documento no digitalizado</span>
          </div>
        )}
      </div>

      {!documento.digitalizado && (
        <div className="panel-acciones">
          <span className="panel-nota">Registro disponible solo en soporte físico.</span>
        </div>
      )}

      <section className="panel-seccion">
        <h4>Descripción archivística</h4>
        <div className="datos-grid">
          <Dato etiqueta="Fondo" valor={documento.fondo} />
          <Dato etiqueta="Escribano/Notario" valor={documento.escribano} />
          <Dato etiqueta="Serie" valor={documento.serie} />
          <Dato etiqueta="Título/Escritura" valor={documento.tipo} />
          <Dato etiqueta="Fecha" valor={formatearFecha(documento.fecha)} />
          <Dato etiqueta="Data tópica" valor={documento.lugar} />
          <Dato etiqueta="Nro. de folios" valor={documento.folios} />
          <Dato etiqueta="Protocolo / registro" valor={documento.protocolo ? `${documento.protocolo} / ${documento.registro}` : documento.registro} />
          <Dato etiqueta="Conservación" valor={documento.conservacion} />
          <Dato etiqueta="Formato" valor={documento.formato} />
        </div>
      </section>

      <section className="panel-seccion">
        <h4>Alcance y contenido</h4>
        <p className="panel-parrafo">{documento.alcance || 'No registrado'}</p>
      </section>

      {documento.descriptores?.length > 0 && (
        <section className="panel-seccion">
          <h4>Descriptores</h4>
          <div className="panel-descriptores">
            {documento.descriptores.map((descriptor) => (
              <span key={descriptor} className="descriptor">{descriptor}</span>
            ))}
          </div>
        </section>
      )}

      {documento.interesados?.length > 0 && (
        <section className="panel-seccion">
          <h4>Personas e instituciones</h4>
          <ul className="panel-interesados">
            {documento.interesados.map((interesado) => (
              <li key={`${interesado.nombre}-${interesado.rol}`}>
                <span>{interesado.nombre}</span>
                <small>{interesado.rol}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
