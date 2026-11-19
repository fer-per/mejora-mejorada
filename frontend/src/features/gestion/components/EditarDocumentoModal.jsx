import { useEffect, useState } from 'react';
import { IconoCerrar } from '../../../components/Iconos.jsx';
import { obtenerDocumento } from '../../../services/api.js';
import { actualizarDocumento } from '../../../services/gestionApi.js';
import ModalBase from './ModalBase.jsx';

const FORMULARIO_VACIO = {
  titulo: '',
  tipologia: '',
  serie: '',
  subserie: '',
  folios: '',
  estado_conservacion: 'Bueno',
  fecha_produccion: '',
  alcance_contenido: '',
  descriptores: '',
  observaciones: '',
  ubicacion_fisica: '',
  interesados: [],
};

function formularioDesdeDocumento(documento) {
  return {
    titulo: documento.titulo ?? '',
    tipologia: documento.tipologia ?? '',
    serie: documento.serie ?? '',
    subserie: documento.subserie ?? '',
    folios: documento.folios ?? '',
    estado_conservacion: documento.estadoConservacion ?? 'Bueno',
    fecha_produccion: documento.fechaProduccion ?? '',
    alcance_contenido: documento.alcanceContenido ?? '',
    descriptores: documento.descriptoresTexto ?? '',
    observaciones: documento.observaciones ?? '',
    ubicacion_fisica: documento.ubicacionFisica ?? '',
    interesados: (documento.interesados ?? []).map((interesado) => ({
      nombre: interesado.nombre ?? '',
      documento: interesado.documento ?? '',
      rol: interesado.rol ?? '',
    })),
  };
}

function construirCambios(formulario, original) {
  const cambios = {};
  const compararTexto = (campo, originalValor) => {
    const valor = formulario[campo].trim();
    const previo = originalValor == null ? '' : String(originalValor);
    if (valor !== previo) cambios[campo] = valor === '' ? null : valor;
  };

  if (formulario.titulo.trim() !== original.titulo) cambios.titulo = formulario.titulo.trim();
  if (formulario.tipologia.trim() !== original.tipologia) {
    cambios.tipologia = formulario.tipologia.trim();
  }
  compararTexto('serie', original.serie);
  compararTexto('subserie', original.subserie);
  compararTexto('alcance_contenido', original.alcanceContenido);
  compararTexto('descriptores', original.descriptoresTexto);
  compararTexto('observaciones', original.observaciones);
  compararTexto('ubicacion_fisica', original.ubicacionFisica);

  const folios = formulario.folios === '' ? null : Number(formulario.folios);
  if (String(folios ?? '') !== String(original.folios ?? '')) cambios.folios = folios;
  if (formulario.estado_conservacion !== original.estadoConservacion) {
    cambios.estado_conservacion = formulario.estado_conservacion;
  }
  if ((formulario.fecha_produccion || null) !== (original.fechaProduccion || null)) {
    cambios.fecha_produccion = formulario.fecha_produccion || null;
  }

  const interesados = formulario.interesados
    .map((interesado) => ({
      nombre: interesado.nombre.trim(),
      documento: interesado.documento.trim() || null,
      rol: interesado.rol.trim(),
    }))
    .filter((interesado) => interesado.nombre && interesado.rol);
  const originales = (original.interesados ?? []).map((interesado) => ({
    nombre: interesado.nombre,
    documento: interesado.documento ?? null,
    rol: interesado.rol,
  }));
  if (JSON.stringify(interesados) !== JSON.stringify(originales)) {
    cambios.interesados = interesados;
  }

  return cambios;
}

export default function EditarDocumentoModal({ id, onClose, onSaved }) {
  const [documento, setDocumento] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    obtenerDocumento(id)
      .then((respuesta) => {
        if (!activo) return;
        setDocumento(respuesta);
        setFormulario(formularioDesdeDocumento(respuesta));
      })
      .catch((errorApi) => {
        if (activo) setError(errorApi.message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [id]);

  const actualizarCampo = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  };

  const actualizarInteresado = (indice, campo, valor) => {
    setFormulario((actual) => ({
      ...actual,
      interesados: actual.interesados.map((interesado, posicion) =>
        posicion === indice ? { ...interesado, [campo]: valor } : interesado,
      ),
    }));
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    if (!documento) return;
    setError('');
    if (!formulario.titulo.trim() || !formulario.tipologia.trim()) {
      setError('El título de la unidad y el título/escritura son obligatorios.');
      return;
    }

    const cambios = construirCambios(formulario, documento);
    if (Object.keys(cambios).length === 0) {
      setError('No se detectaron cambios para guardar.');
      return;
    }

    setGuardando(true);
    try {
      await actualizarDocumento(documento.id, {
        ...cambios,
        fecha_actualizacion: documento.fechaActualizacion,
      });
      onSaved(`Se actualizó el documento #${documento.id}.`);
      onClose();
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalBase
      titulo={
        documento
          ? `Editar documento #${documento.id}`
          : cargando
            ? 'Cargando documento'
            : 'No se pudo cargar el documento'
      }
      etiqueta="Edición de metadatos"
      onCerrar={onClose}
      ancho="960px"
    >
      {cargando ? (
        <div className="estado-resultados">
          <div className="spinner-border text-secondary" role="status" />
          <p>Cargando ficha...</p>
        </div>
      ) : !documento ? (
        <>
          {error && <div className="alert alert-danger py-2 px-3 small">{error}</div>}
          <div className="modal-acciones">
            <button type="button" className="btn boton-secundario" onClick={onClose}>Cerrar</button>
          </div>
        </>
      ) : (
        <form onSubmit={guardar}>
          {error && <div className="alert alert-danger py-2 px-3 small">{error}</div>}
          {documento?.anulado && (
            <div className="alert alert-warning py-2 px-3 small">
              Documento anulado: {documento.motivoAnulacion ?? 'sin motivo registrado'}.
            </div>
          )}
          <div className="row g-3">
            <div className="col-12 col-md-8">
              <label className="form-label filtro-label" htmlFor="edit-titulo">Título de la unidad *</label>
              <input id="edit-titulo" className="form-control" value={formulario.titulo} onChange={(evento) => actualizarCampo('titulo', evento.target.value)} maxLength={300} required />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label filtro-label" htmlFor="edit-tipologia">Título/Escritura *</label>
              <input id="edit-tipologia" className="form-control" value={formulario.tipologia} onChange={(evento) => actualizarCampo('tipologia', evento.target.value)} maxLength={100} required />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label filtro-label" htmlFor="edit-serie">Serie</label>
              <input id="edit-serie" className="form-control" value={formulario.serie} onChange={(evento) => actualizarCampo('serie', evento.target.value)} maxLength={150} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label filtro-label" htmlFor="edit-subserie">Subserie</label>
              <input id="edit-subserie" className="form-control" value={formulario.subserie} onChange={(evento) => actualizarCampo('subserie', evento.target.value)} maxLength={150} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label filtro-label" htmlFor="edit-folios">Nro. de folios</label>
              <input id="edit-folios" type="number" className="form-control" value={formulario.folios} onChange={(evento) => actualizarCampo('folios', evento.target.value)} min={1} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label filtro-label" htmlFor="edit-conservacion">Conservación</label>
              <select id="edit-conservacion" className="form-select" value={formulario.estado_conservacion} onChange={(evento) => actualizarCampo('estado_conservacion', evento.target.value)}>
                <option value="Bueno">Bueno</option>
                <option value="Regular">Regular</option>
                <option value="Malo">Malo</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label filtro-label" htmlFor="edit-fecha">Fecha de producción</label>
              <input id="edit-fecha" type="date" className="form-control" value={formulario.fecha_produccion} onChange={(evento) => actualizarCampo('fecha_produccion', evento.target.value)} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label filtro-label" htmlFor="edit-ubicacion">Data tópica</label>
              <input id="edit-ubicacion" className="form-control" value={formulario.ubicacion_fisica} onChange={(evento) => actualizarCampo('ubicacion_fisica', evento.target.value)} maxLength={150} />
            </div>
            <div className="col-12">
              <label className="form-label filtro-label" htmlFor="edit-alcance">Alcance y contenido</label>
              <textarea id="edit-alcance" className="form-control" rows={3} value={formulario.alcance_contenido} onChange={(evento) => actualizarCampo('alcance_contenido', evento.target.value)} maxLength={5000} />
            </div>
            <div className="col-12">
              <label className="form-label filtro-label" htmlFor="edit-descriptores">Descriptores</label>
              <input id="edit-descriptores" className="form-control" value={formulario.descriptores} onChange={(evento) => actualizarCampo('descriptores', evento.target.value)} maxLength={2000} placeholder="Separe los descriptores con comas" />
            </div>
            <div className="col-12">
              <label className="form-label filtro-label" htmlFor="edit-observaciones">Observaciones</label>
              <textarea id="edit-observaciones" className="form-control" rows={2} value={formulario.observaciones} onChange={(evento) => actualizarCampo('observaciones', evento.target.value)} maxLength={2000} />
            </div>
          </div>

          <div className="seccion-formulario">
            <div className="seccion-formulario-cabecera">
              <h2 className="seccion-formulario-titulo">Interesados</h2>
              <button type="button" className="btn btn-sm boton-secundario" onClick={() => actualizarCampo('interesados', [...formulario.interesados, { nombre: '', documento: '', rol: '' }])}>
                Agregar interesado
              </button>
            </div>
            {formulario.interesados.length === 0 ? (
              <p className="seccion-formulario-ayuda">Sin interesados registrados.</p>
            ) : (
              <div className="lista-interesados-formulario">
                {formulario.interesados.map((interesado, indice) => (
                  <div className="fila-interesado" key={indice}>
                    <input className="form-control" placeholder="Nombre" value={interesado.nombre} onChange={(evento) => actualizarInteresado(indice, 'nombre', evento.target.value)} maxLength={200} />
                    <input className="form-control" placeholder="Documento" value={interesado.documento} onChange={(evento) => actualizarInteresado(indice, 'documento', evento.target.value)} maxLength={20} />
                    <input className="form-control" placeholder="Rol" value={interesado.rol} onChange={(evento) => actualizarInteresado(indice, 'rol', evento.target.value)} maxLength={50} />
                    <button
                      type="button"
                      className="boton-quitar"
                      onClick={() => actualizarCampo('interesados', formulario.interesados.filter((_, posicion) => posicion !== indice))}
                      aria-label="Quitar interesado"
                    >
                      <IconoCerrar />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-acciones">
            <button type="button" className="btn boton-secundario" onClick={onClose} disabled={guardando}>Cancelar</button>
            <button type="submit" className="btn boton-buscar boton-compacto" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}
    </ModalBase>
  );
}
