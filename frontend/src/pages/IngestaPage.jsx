import { useEffect, useRef, useState } from 'react';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import { IconoCerrar, IconoDocumento, IconoSubir } from '../components/Iconos.jsx';
import { crearDocumento, obtenerCatalogos } from '../services/api.js';

const FORMULARIO_VACIO = {
  id_fondo: '',
  protocolo: '',
  anio: '',
  registro: '',
  titulo: '',
  mes: '',
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
};

const INTERESADO_VACIO = { nombre: '', documento: '', rol: '' };
const MAX_BYTES = 50 * 1024 * 1024;
const EXTENSIONES = ['pdf', 'tif', 'tiff'];

export default function IngestaPage() {
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [interesados, setInteresados] = useState([]);
  const [archivo, setArchivo] = useState(null);
  const [catalogos, setCatalogos] = useState({ fondos: [], series: [], tipologias: [] });
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [enviando, setEnviando] = useState(false);
  const archivoRef = useRef(null);

  useEffect(() => {
    let activo = true;
    obtenerCatalogos()
      .then((datos) => {
        if (activo) setCatalogos({ fondos: datos.fondos ?? [], series: datos.series ?? [], tipologias: datos.tipologias ?? [] });
      })
      .catch(() => {});

    return () => {
      activo = false;
    };
  }, []);

  const actualizar = (campo) => (evento) => {
    setFormulario({ ...formulario, [campo]: evento.target.value });
  };

  const seleccionarArchivo = (evento) => {
    const seleccionado = evento.target.files?.[0] ?? null;
    setError('');

    if (!seleccionado) {
      setArchivo(null);
      return;
    }

    const extension = seleccionado.name.split('.').pop()?.toLowerCase() ?? '';
    if (!EXTENSIONES.includes(extension)) {
      setArchivo(null);
      evento.target.value = '';
      setError('El archivo debe ser PDF/A (.pdf) o TIFF (.tif, .tiff).');
      return;
    }

    if (seleccionado.size > MAX_BYTES) {
      setArchivo(null);
      evento.target.value = '';
      setError('El archivo supera el tamaño máximo permitido de 50 MB.');
      return;
    }

    setArchivo(seleccionado);
  };

  const actualizarInteresado = (indice, campo, valor) => {
    setInteresados((actuales) =>
      actuales.map((interesado, posicion) => (posicion === indice ? { ...interesado, [campo]: valor } : interesado)),
    );
  };

  const agregarInteresado = () => {
    if (interesados.length >= 50) {
      setError('No se pueden registrar más de 50 interesados.');
      return;
    }
    setInteresados([...interesados, { ...INTERESADO_VACIO }]);
  };

  const quitarInteresado = (indice) => {
    setInteresados(interesados.filter((_, posicion) => posicion !== indice));
  };

  const limpiar = () => {
    setFormulario(FORMULARIO_VACIO);
    setInteresados([]);
    setArchivo(null);
    if (archivoRef.current) archivoRef.current.value = '';
    setError('');
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setError('');
    setExito('');

    if (!archivo) {
      setError('Seleccione el archivo digital que desea ingresar.');
      return;
    }

    const datos = new FormData();
    Object.entries(formulario).forEach(([campo, valor]) => {
      const limpio = typeof valor === 'string' ? valor.trim() : valor;
      if (limpio !== '' && limpio !== null && limpio !== undefined) {
        datos.append(campo, limpio);
      }
    });

    const listaInteresados = interesados
      .filter((interesado) => interesado.nombre.trim() && interesado.rol.trim())
      .map((interesado) => ({
        nombre: interesado.nombre.trim(),
        documento: interesado.documento.trim() || null,
        rol: interesado.rol.trim(),
      }));

    if (listaInteresados.length) {
      datos.append('interesados', JSON.stringify(listaInteresados));
    }

    datos.append('archivo', archivo);

    setEnviando(true);
    try {
      const documento = await crearDocumento(datos);
      setExito(`Se ingresó el documento #${documento.id} "${documento.titulo}". Quedó registrado en auditoría.`);
      limpiar();
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="app-fondo">
      <BarraNavegacion />

      <main className="contenedor-busqueda">
        <header className="encabezado-busqueda">
          <div>
            <p className="encabezado-etiqueta">Procesos técnicos archivísticos</p>
            <h1 className="encabezado-titulo">Ingesta documental</h1>
            <p className="encabezado-descripcion">
              Registre la descripción archivística y el archivo digitalizado del documento. El sistema vincula
              automáticamente el fondo, protocolo, año, registro y título.
            </p>
          </div>
          <div className="resumen-datos">
            <div className="dato-resumen">
              <span className="dato-resumen-numero">PDF/A</span>
              <span className="dato-resumen-etiqueta">Formato</span>
            </div>
            <div className="dato-resumen">
              <span className="dato-resumen-numero">TIFF</span>
              <span className="dato-resumen-etiqueta">Formato</span>
            </div>
            <div className="dato-resumen">
              <span className="dato-resumen-numero">50 MB</span>
              <span className="dato-resumen-etiqueta">Tamaño máximo</span>
            </div>
          </div>
        </header>

        {error && (
          <div className="alert alert-danger py-2 px-3 small" role="alert">
            {error}
          </div>
        )}
        {exito && (
          <div className="alert alert-success py-2 px-3 small" role="alert">
            {exito}
          </div>
        )}

        <form className="panel-busqueda" onSubmit={enviar}>
          <div className="seccion-formulario">
            <h2 className="seccion-formulario-titulo">Ubicación archivística</h2>
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <label htmlFor="id_fondo" className="form-label filtro-label">Fondo *</label>
                <select id="id_fondo" className="form-select" value={formulario.id_fondo} onChange={actualizar('id_fondo')} required>
                  <option value="">Seleccione un fondo</option>
                  {catalogos.fondos.map((fondo) => (
                    <option key={fondo.id} value={fondo.id}>{fondo.denominacion}</option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-4">
                <label htmlFor="protocolo" className="form-label filtro-label">Protocolo *</label>
                <input id="protocolo" className="form-control" value={formulario.protocolo} onChange={actualizar('protocolo')} maxLength={50} required />
              </div>
              <div className="col-6 col-md-2">
                <label htmlFor="anio" className="form-label filtro-label">Año *</label>
                <input id="anio" type="number" className="form-control" value={formulario.anio} onChange={actualizar('anio')} min={1500} max={2100} required />
              </div>
              <div className="col-6 col-md-2">
                <label htmlFor="registro" className="form-label filtro-label">Registro *</label>
                <input id="registro" className="form-control" value={formulario.registro} onChange={actualizar('registro')} maxLength={50} required />
              </div>
              <div className="col-12 col-md-8">
                <label htmlFor="titulo" className="form-label filtro-label">Título</label>
                <input
                  id="titulo"
                  className="form-control"
                  value={formulario.titulo}
                  onChange={actualizar('titulo')}
                  maxLength={300}
                  placeholder="Si se deja vacío se genera a partir del protocolo y registro"
                />
              </div>
              <div className="col-6 col-md-2">
                <label htmlFor="mes" className="form-label filtro-label">Mes</label>
                <input id="mes" type="number" className="form-control" value={formulario.mes} onChange={actualizar('mes')} min={1} max={12} />
              </div>
              <div className="col-6 col-md-2">
                <label htmlFor="folios" className="form-label filtro-label">Folios</label>
                <input id="folios" type="number" className="form-control" value={formulario.folios} onChange={actualizar('folios')} min={1} />
              </div>
            </div>
          </div>

          <div className="seccion-formulario">
            <h2 className="seccion-formulario-titulo">Descripción documental</h2>
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <label htmlFor="tipologia" className="form-label filtro-label">Tipología *</label>
                <input
                  id="tipologia"
                  className="form-control"
                  list="lista-tipologias"
                  value={formulario.tipologia}
                  onChange={actualizar('tipologia')}
                  maxLength={100}
                  required
                />
                <datalist id="lista-tipologias">
                  {catalogos.tipologias.map((tipologia) => (
                    <option key={tipologia} value={tipologia} />
                  ))}
                </datalist>
              </div>
              <div className="col-12 col-md-4">
                <label htmlFor="serie" className="form-label filtro-label">Serie</label>
                <input
                  id="serie"
                  className="form-control"
                  list="lista-series"
                  value={formulario.serie}
                  onChange={actualizar('serie')}
                  maxLength={150}
                />
                <datalist id="lista-series">
                  {catalogos.series.map((serie) => (
                    <option key={serie} value={serie} />
                  ))}
                </datalist>
              </div>
              <div className="col-12 col-md-4">
                <label htmlFor="subserie" className="form-label filtro-label">Subserie</label>
                <input id="subserie" className="form-control" value={formulario.subserie} onChange={actualizar('subserie')} maxLength={150} />
              </div>
              <div className="col-6 col-md-3">
                <label htmlFor="fecha_produccion" className="form-label filtro-label">Fecha de producción</label>
                <input id="fecha_produccion" type="date" className="form-control" value={formulario.fecha_produccion} onChange={actualizar('fecha_produccion')} />
              </div>
              <div className="col-6 col-md-3">
                <label htmlFor="estado_conservacion" className="form-label filtro-label">Conservación</label>
                <select id="estado_conservacion" className="form-select" value={formulario.estado_conservacion} onChange={actualizar('estado_conservacion')}>
                  <option value="Bueno">Bueno</option>
                  <option value="Regular">Regular</option>
                  <option value="Malo">Malo</option>
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label htmlFor="ubicacion_fisica" className="form-label filtro-label">Ubicación física</label>
                <input id="ubicacion_fisica" className="form-control" value={formulario.ubicacion_fisica} onChange={actualizar('ubicacion_fisica')} maxLength={150} />
              </div>
              <div className="col-12">
                <label htmlFor="alcance_contenido" className="form-label filtro-label">Alcance y contenido</label>
                <textarea id="alcance_contenido" className="form-control" rows={3} value={formulario.alcance_contenido} onChange={actualizar('alcance_contenido')} maxLength={5000} />
              </div>
              <div className="col-12">
                <label htmlFor="descriptores" className="form-label filtro-label">Descriptores</label>
                <input id="descriptores" className="form-control" value={formulario.descriptores} onChange={actualizar('descriptores')} maxLength={2000} placeholder="Separe los descriptores con comas" />
              </div>
              <div className="col-12">
                <label htmlFor="observaciones" className="form-label filtro-label">Observaciones</label>
                <textarea id="observaciones" className="form-control" rows={2} value={formulario.observaciones} onChange={actualizar('observaciones')} maxLength={2000} />
              </div>
            </div>
          </div>

          <div className="seccion-formulario">
            <div className="seccion-formulario-cabecera">
              <h2 className="seccion-formulario-titulo">Interesados</h2>
              <button type="button" className="btn btn-sm boton-secundario" onClick={agregarInteresado}>
                Agregar interesado
              </button>
            </div>
            {interesados.length === 0 ? (
              <p className="seccion-formulario-ayuda">Opcional. Registre las personas que figuran en la escritura.</p>
            ) : (
              <div className="lista-interesados-formulario">
                {interesados.map((interesado, indice) => (
                  <div className="fila-interesado" key={indice}>
                    <input
                      className="form-control"
                      placeholder="Nombre"
                      value={interesado.nombre}
                      onChange={(evento) => actualizarInteresado(indice, 'nombre', evento.target.value)}
                      maxLength={200}
                    />
                    <input
                      className="form-control"
                      placeholder="Documento"
                      value={interesado.documento}
                      onChange={(evento) => actualizarInteresado(indice, 'documento', evento.target.value)}
                      maxLength={20}
                    />
                    <input
                      className="form-control"
                      placeholder="Rol"
                      value={interesado.rol}
                      onChange={(evento) => actualizarInteresado(indice, 'rol', evento.target.value)}
                      maxLength={50}
                    />
                    <button type="button" className="boton-quitar" onClick={() => quitarInteresado(indice)} aria-label="Quitar interesado">
                      <IconoCerrar />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="seccion-formulario">
            <h2 className="seccion-formulario-titulo">Archivo digital</h2>
            <label htmlFor="archivo" className="zona-archivo">
              <IconoSubir size={26} />
              <span className="zona-archivo-titulo">{archivo ? archivo.name : 'Seleccione el archivo PDF/A o TIFF'}</span>
              <span className="zona-archivo-ayuda">
                {archivo
                  ? `${(archivo.size / (1024 * 1024)).toFixed(2)} MB · listo para cargar`
                  : 'Extensiones permitidas: .pdf, .tif, .tiff · máximo 50 MB'}
              </span>
              <input
                id="archivo"
                ref={archivoRef}
                type="file"
                accept=".pdf,.tif,.tiff,application/pdf,image/tiff"
                onChange={seleccionarArchivo}
                className="zona-archivo-input"
              />
            </label>
          </div>

          <div className="buscador-avanzado-acciones">
            <button type="button" className="btn boton-secundario" onClick={limpiar} disabled={enviando}>
              Limpiar formulario
            </button>
            <button type="submit" className="btn boton-buscar" disabled={enviando}>
              <IconoDocumento size={16} />
              {enviando ? 'Cargando documento...' : 'Registrar documento'}
            </button>
          </div>
        </form>

        <footer className="pie-piloto">
          Piloto SIARC-ARA · La ingesta queda registrada en auditoría con usuario, fecha y archivo
        </footer>
      </main>
    </div>
  );
}
