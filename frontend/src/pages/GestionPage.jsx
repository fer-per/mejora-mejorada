import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import { IconoBuscar, IconoCerrar, IconoDocumento, IconoHistorial, IconoSubir } from '../components/Iconos.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  actualizarDocumento,
  actualizarEstructura,
  anularDocumento,
  edicionMasiva,
  fusionarEstructura,
  listarDocumentosGestion,
  listarDuplicados,
  listarEstructura,
  listarHistorialDocumento,
  listarHistorialEntidad,
  listarOperacionesGestion,
  obtenerDocumento,
  obtenerOperacionGestion,
  obtenerResumenGestion,
  previsualizarFusion,
  reemplazarArchivoDocumento,
  restaurarDocumento,
  revertirCambioDocumento,
  revertirOperacionGestion,
} from '../services/api.js';

const SECCIONES = [
  { id: 'documentos', etiqueta: 'Documentos' },
  { id: 'estructura', etiqueta: 'Jerarquía' },
  { id: 'operaciones', etiqueta: 'Historial' },
  { id: 'duplicados', etiqueta: 'Duplicados' },
];

const TIPOS_ESTRUCTURA = [
  { id: 'repositorios', etiqueta: 'Repositorios' },
  { id: 'fondos', etiqueta: 'Fondos' },
  { id: 'escribanos', etiqueta: 'Escribanos' },
  { id: 'protocolos', etiqueta: 'Protocolos' },
  { id: 'anios', etiqueta: 'Años' },
  { id: 'registros', etiqueta: 'Registros' },
  { id: 'titulos', etiqueta: 'Títulos' },
];

const TIPOS_FUSION = ['fondos', 'escribanos', 'protocolos', 'anios', 'registros'];

const CAMPOS_ESTRUCTURA = {
  repositorios: {
    siglo: { etiqueta: 'Siglo', tipo: 'number' },
    numero: { etiqueta: 'Número' },
  },
  fondos: {
    id_repositorio: { etiqueta: 'ID repositorio', tipo: 'number' },
    denominacion: { etiqueta: 'Denominación' },
    descripcion: { etiqueta: 'Descripción', tipo: 'textarea' },
  },
  escribanos: {
    id_fondo: { etiqueta: 'ID fondo', tipo: 'number' },
    nombre_completo: { etiqueta: 'Nombre completo' },
    periodo_ejercicio: { etiqueta: 'Periodo de ejercicio' },
    seccion: { etiqueta: 'Sección' },
  },
  protocolos: {
    id_fondo: { etiqueta: 'ID fondo', tipo: 'number' },
    id_escribano: { etiqueta: 'ID escribano', tipo: 'number' },
    numero: { etiqueta: 'Número de protocolo' },
  },
  anios: {
    id_protocolo: { etiqueta: 'ID protocolo', tipo: 'number' },
    anio: { etiqueta: 'Año', tipo: 'number' },
  },
  registros: {
    id_anio_protocolo: { etiqueta: 'ID año de protocolo', tipo: 'number' },
    numero: { etiqueta: 'Número de registro' },
  },
  titulos: {
    id_registro: { etiqueta: 'ID registro', tipo: 'number' },
    nombre: { etiqueta: 'Nombre del título' },
    mes: { etiqueta: 'Mes', tipo: 'number' },
  },
};

const COLUMNAS_ESTRUCTURA = {
  repositorios: [
    ['id', 'ID'],
    ['siglo', 'Siglo'],
    ['numero', 'Número'],
    ['fondos', 'Fondos'],
  ],
  fondos: [
    ['id', 'ID'],
    ['denominacion', 'Denominación'],
    ['repositorio', 'Repositorio'],
    ['escribanos', 'Escribanos'],
    ['protocolos', 'Protocolos'],
  ],
  escribanos: [
    ['id', 'ID'],
    ['nombre_completo', 'Nombre completo'],
    ['fondo', 'Fondo'],
    ['periodo_ejercicio', 'Periodo'],
    ['protocolos', 'Protocolos'],
  ],
  protocolos: [
    ['id', 'ID'],
    ['numero', 'Número'],
    ['fondo', 'Fondo'],
    ['escribano', 'Escribano'],
    ['anios', 'Años'],
    ['registros', 'Registros'],
    ['documentos', 'Documentos'],
  ],
  anios: [
    ['id', 'ID'],
    ['anio', 'Año'],
    ['protocolo', 'Protocolo'],
    ['fondo', 'Fondo'],
    ['registros', 'Registros'],
    ['documentos', 'Documentos'],
  ],
  registros: [
    ['id', 'ID'],
    ['numero', 'Número'],
    ['anio', 'Año'],
    ['protocolo', 'Protocolo'],
    ['titulos', 'Títulos'],
    ['documentos', 'Documentos'],
  ],
  titulos: [
    ['id', 'ID'],
    ['nombre', 'Nombre'],
    ['anio', 'Año'],
    ['protocolo', 'Protocolo'],
    ['registro', 'Registro'],
    ['documentos', 'Documentos'],
  ],
};

const ETIQUETA_CAMBIO = {
  titulo: 'Título',
  tipologia: 'Tipología',
  serie: 'Serie',
  subserie: 'Subserie',
  folios: 'Folios',
  formato: 'Formato',
  estado_conservacion: 'Conservación',
  alcance_contenido: 'Alcance y contenido',
  descriptores: 'Descriptores',
  fecha_produccion: 'Fecha de producción',
  observaciones: 'Observaciones',
  ubicacion_fisica: 'Ubicación física',
  interesados: 'Interesados',
  anulado: 'Anulado',
  motivo_anulacion: 'Motivo de anulación',
  archivo: 'Archivo digital',
  nombre: 'Nombre',
  numero: 'Número',
  mes: 'Mes',
  id_registro: 'Registro',
  id_anio_protocolo: 'Año de protocolo',
  id_protocolo: 'Protocolo',
  id_escribano: 'Escribano',
  id_fondo: 'Fondo',
  id_repositorio: 'Repositorio',
  denominacion: 'Denominación',
  descripcion: 'Descripción',
  nombre_completo: 'Nombre completo',
  periodo_ejercicio: 'Periodo de ejercicio',
  seccion: 'Sección',
  anio: 'Año',
  siglo: 'Siglo',
};

function formatearFechaHora(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  return fecha.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

function valorLegible(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

function diferencias(antes, despues) {
  if (!antes || !despues) return [];
  const claves = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  return [...claves]
    .filter((clave) => JSON.stringify(antes[clave]) !== JSON.stringify(despues[clave]))
    .map((clave) => ({
      clave,
      etiqueta: ETIQUETA_CAMBIO[clave] ?? clave,
      antes: antes[clave],
      despues: despues[clave],
    }));
}

function Modal({ titulo, etiqueta, onCerrar, children, ancho = '760px' }) {
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

function TablaHistorial({ filas, idDocumento, onRevertir }) {
  const reversibles = new Set(['EDICION', 'EDICION_MASIVA', 'ANULACION', 'RESTAURACION', 'REVERSION']);
  if (!filas?.length) {
    return <div className="estado-resultados"><p>No hay cambios registrados.</p></div>;
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
                    {reversibles.has(fila.tipoOperacion) ? (
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

export default function GestionPage() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.role === 'admin';
  const [searchParams] = useSearchParams();
  const documentoInicial = searchParams.get('documento');

  const [seccion, setSeccion] = useState('documentos');
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [version, setVersion] = useState(0);
  const [modalHistorial, setModalHistorial] = useState(null);
  const [modalOperacion, setModalOperacion] = useState(null);

  const [entrada, setEntrada] = useState('');
  const [filtros, setFiltros] = useState({ texto: '', conservacion: '', estado: 'activos', orden: 'fecha' });
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ total: 0, pagina: 1, porPagina: 15, paginas: 0, resultados: [] });
  const [cargando, setCargando] = useState(false);
  const [seleccion, setSeleccion] = useState([]);
  const [modalDocumento, setModalDocumento] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [modalMasiva, setModalMasiva] = useState(null);
  const [modalReemplazo, setModalReemplazo] = useState(null);
  const [modalEstructura, setModalEstructura] = useState(null);

  const [tipoEstructura, setTipoEstructura] = useState('titulos');
  const [busquedaEstructura, setBusquedaEstructura] = useState('');
  const [estructura, setEstructura] = useState({ total: 0, items: [] });
  const [cargandoEstructura, setCargandoEstructura] = useState(false);
  const [fusionTipo, setFusionTipo] = useState('protocolos');
  const [fusionOrigen, setFusionOrigen] = useState('');
  const [fusionDestino, setFusionDestino] = useState('');
  const [fusionPreview, setFusionPreview] = useState(null);

  const [operaciones, setOperaciones] = useState({ total: 0, resultados: [] });
  const [tipoOperacion, setTipoOperacion] = useState('');
  const [paginaOperaciones, setPaginaOperaciones] = useState(1);
  const [cargandoOperaciones, setCargandoOperaciones] = useState(false);
  const [duplicados, setDuplicados] = useState(null);

  const [formularioDocumento, setFormularioDocumento] = useState(null);
  const [formularioMasiva, setFormularioMasiva] = useState({ estado_conservacion: '', tipologia: '', serie: '', subserie: '', ubicacion_fisica: '', observaciones: '' });
  const archivoReemplazoRef = useRef(null);

  const totalPaginas = Math.max(1, Math.ceil(datos.total / (datos.porPagina || 15)));
  const idsPagina = useMemo(() => datos.resultados.map((documento) => documento.id), [datos.resultados]);
  const seleccionadosValidos = useMemo(
    () => seleccion.filter((id) => idsPagina.includes(id)),
    [seleccion, idsPagina],
  );
  const todosSeleccionados = idsPagina.length > 0 && seleccionadosValidos.length === idsPagina.length;

  useEffect(() => {
    let activo = true;
    obtenerResumenGestion()
      .then((respuesta) => {
        if (activo) setResumen(respuesta);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [version]);

  useEffect(() => {
    if (seccion !== 'documentos') return undefined;
    let activo = true;
    setCargando(true);
    setError('');
    listarDocumentosGestion({
      texto: filtros.texto,
      conservacion: filtros.conservacion,
      solo_anulados: filtros.estado === 'anulados',
      incluir_anulados: filtros.estado === 'todos',
      orden: filtros.orden,
      pagina,
      por_pagina: 15,
    })
      .then((respuesta) => {
        if (activo) {
          setDatos(respuesta);
          setSeleccion([]);
        }
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
  }, [seccion, filtros, pagina, version]);

  useEffect(() => {
    if (seccion !== 'estructura') return undefined;
    let activo = true;
    setCargandoEstructura(true);
    listarEstructura(tipoEstructura, { q: busquedaEstructura, porPagina: 200 })
      .then((respuesta) => {
        if (activo) setEstructura(respuesta ?? { total: 0, items: [] });
      })
      .catch((errorApi) => {
        if (activo) setError(errorApi.message);
      })
      .finally(() => {
        if (activo) setCargandoEstructura(false);
      });
    return () => {
      activo = false;
    };
  }, [seccion, tipoEstructura, busquedaEstructura, version]);

  useEffect(() => {
    if (seccion !== 'operaciones') return undefined;
    let activo = true;
    setCargandoOperaciones(true);
    listarOperacionesGestion({ tipoOperacion, pagina: paginaOperaciones, porPagina: 20 })
      .then((respuesta) => {
        if (activo) setOperaciones(respuesta);
      })
      .catch((errorApi) => {
        if (activo) setError(errorApi.message);
      })
      .finally(() => {
        if (activo) setCargandoOperaciones(false);
      });
    return () => {
      activo = false;
    };
  }, [seccion, tipoOperacion, paginaOperaciones, version]);

  useEffect(() => {
    if (seccion !== 'duplicados') return undefined;
    let activo = true;
    listarDuplicados()
      .then((respuesta) => {
        if (activo) setDuplicados(respuesta);
      })
      .catch((errorApi) => {
        if (activo) setError(errorApi.message);
      });
    return () => {
      activo = false;
    };
  }, [seccion, version]);

  const abrirEditar = async (id) => {
    setError('');
    setExito('');
    setModalDocumento({ cargando: true, id });
    try {
      const documento = await obtenerDocumento(id);
      setModalDocumento({ cargando: false, documento });
      setFormularioDocumento({
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
        fecha_actualizacion: documento.fechaActualizacion,
        original: documento,
      });
    } catch (errorApi) {
      setModalDocumento(null);
      setError(errorApi.message);
    }
  };

  useEffect(() => {
    if (documentoInicial) abrirEditar(documentoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarFiltros = (evento) => {
    evento.preventDefault();
    setPagina(1);
    setFiltros({ ...filtros, texto: entrada.trim() });
  };

  const limpiarFiltros = () => {
    setEntrada('');
    setFiltros({ texto: '', conservacion: '', estado: 'activos', orden: 'fecha' });
    setPagina(1);
  };

  const alternarSeleccion = (id) => {
    setSeleccion((actual) => (actual.includes(id) ? actual.filter((valor) => valor !== id) : [...actual, id]));
  };

  const alternarTodos = () => {
    setSeleccion(todosSeleccionados ? [] : idsPagina);
  };

  const cerrarDocumento = () => {
    if (guardando) return;
    setModalDocumento(null);
    setFormularioDocumento(null);
  };

  const actualizarCampo = (campo, valor) => {
    setFormularioDocumento((actual) => ({ ...actual, [campo]: valor }));
  };

  const actualizarInteresado = (indice, campo, valor) => {
    setFormularioDocumento((actual) => ({
      ...actual,
      interesados: actual.interesados.map((interesado, posicion) =>
        posicion === indice ? { ...interesado, [campo]: valor } : interesado,
      ),
    }));
  };

  const guardarDocumento = async (evento) => {
    evento.preventDefault();
    if (!formularioDocumento) return;
    setError('');
    setExito('');

    const original = formularioDocumento.original;
    const cambios = {};
    const compararTexto = (campo, originalValor) => {
      const valor = formularioDocumento[campo].trim();
      const previo = originalValor == null ? '' : String(originalValor);
      if (valor !== previo) cambios[campo] = valor === '' ? null : valor;
    };

    if (formularioDocumento.titulo.trim() !== original.titulo) {
      cambios.titulo = formularioDocumento.titulo.trim();
    }
    if (formularioDocumento.tipologia.trim() !== original.tipologia) {
      cambios.tipologia = formularioDocumento.tipologia.trim();
    }
    compararTexto('serie', original.serie);
    compararTexto('subserie', original.subserie);
    compararTexto('alcance_contenido', original.alcanceContenido);
    compararTexto('descriptores', original.descriptoresTexto);
    compararTexto('observaciones', original.observaciones);
    compararTexto('ubicacion_fisica', original.ubicacionFisica);

    const folios = formularioDocumento.folios === '' ? null : Number(formularioDocumento.folios);
    if (String(folios ?? '') !== String(original.folios ?? '')) cambios.folios = folios;
    if (formularioDocumento.estado_conservacion !== original.estadoConservacion) {
      cambios.estado_conservacion = formularioDocumento.estado_conservacion;
    }
    if ((formularioDocumento.fecha_produccion || null) !== (original.fechaProduccion || null)) {
      cambios.fecha_produccion = formularioDocumento.fecha_produccion || null;
    }

    const interesados = formularioDocumento.interesados
      .map((interesado) => ({
        nombre: interesado.nombre.trim(),
        documento: interesado.documento.trim() || null,
        rol: interesado.rol.trim(),
      }))
      .filter((interesado) => interesado.nombre && interesado.rol);
    const interesadosOriginales = (original.interesados ?? []).map((interesado) => ({
      nombre: interesado.nombre,
      documento: interesado.documento ?? null,
      rol: interesado.rol,
    }));
    if (JSON.stringify(interesados) !== JSON.stringify(interesadosOriginales)) {
      cambios.interesados = interesados;
    }

    if (Object.keys(cambios).length === 0) {
      setError('No se detectaron cambios para guardar.');
      return;
    }
    if (!formularioDocumento.titulo.trim() || !formularioDocumento.tipologia.trim()) {
      setError('El título y la tipología son obligatorios.');
      return;
    }

    setGuardando(true);
    try {
      await actualizarDocumento(formularioDocumento.original.id, {
        ...cambios,
        fecha_actualizacion: formularioDocumento.fecha_actualizacion,
      });
      setExito(`Se actualizó el documento #${formularioDocumento.original.id}.`);
      setModalDocumento(null);
      setFormularioDocumento(null);
      setVersion((valor) => valor + 1);
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setGuardando(false);
    }
  };

  const anular = async (documento) => {
    const motivo = window.prompt(`Motivo de anulación del documento #${documento.id}:`);
    if (!motivo || !motivo.trim()) return;
    setError('');
    setExito('');
    try {
      await anularDocumento(documento.id, motivo.trim());
      setExito(`Se anuló el documento #${documento.id}.`);
      setVersion((valor) => valor + 1);
    } catch (errorApi) {
      setError(errorApi.message);
    }
  };

  const restaurar = async (documento) => {
    if (!window.confirm(`¿Restaurar el documento #${documento.id}?`)) return;
    setError('');
    setExito('');
    try {
      await restaurarDocumento(documento.id);
      setExito(`Se restauró el documento #${documento.id}.`);
      setVersion((valor) => valor + 1);
    } catch (errorApi) {
      setError(errorApi.message);
    }
  };

  const abrirHistorial = async (documento) => {
    setError('');
    try {
      const respuesta = await listarHistorialDocumento(documento.id, { porPagina: 100 });
      setModalHistorial({
        titulo: `Historial del documento #${documento.id}`,
        filas: respuesta.resultados ?? [],
        idDocumento: documento.id,
      });
    } catch (errorApi) {
      setError(errorApi.message);
    }
  };

  const revertirCambio = async (cambio) => {
    if (!modalHistorial?.idDocumento) return;
    if (!window.confirm(`¿Revertir el cambio #${cambio.id}? Se validará que el documento no haya cambiado después.`)) return;
    setError('');
    setExito('');
    try {
      await revertirCambioDocumento(modalHistorial.idDocumento, cambio.id);
      setExito(`Se revirtió el cambio #${cambio.id}.`);
      setModalHistorial(null);
      setVersion((valor) => valor + 1);
    } catch (errorApi) {
      setError(errorApi.message);
    }
  };

  const abrirMasiva = () => {
    if (seleccionadosValidos.length === 0) return;
    setModalMasiva({ ids: seleccionadosValidos });
    setFormularioMasiva({ estado_conservacion: '', tipologia: '', serie: '', subserie: '', ubicacion_fisica: '', observaciones: '' });
  };

  const guardarMasiva = async (evento) => {
    evento.preventDefault();
    const cambios = {};
    for (const [campo, valor] of Object.entries(formularioMasiva)) {
      if (String(valor).trim() !== '') cambios[campo] = valor;
    }
    if (Object.keys(cambios).length === 0) {
      setError('Seleccione al menos un campo a modificar.');
      return;
    }
    setGuardando(true);
    setError('');
    setExito('');
    try {
      const respuesta = await edicionMasiva(modalMasiva.ids, cambios);
      setExito(`Se editaron ${respuesta.afectados} documento(s). Operación ${respuesta.idOperacion}.`);
      setModalMasiva(null);
      setVersion((valor) => valor + 1);
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirReemplazo = (documento) => {
    setModalReemplazo({ documento, archivo: null });
  };

  const guardarReemplazo = async (evento) => {
    evento.preventDefault();
    if (!modalReemplazo.archivo) {
      setError('Seleccione el archivo PDF/A o TIFF.');
      return;
    }
    setGuardando(true);
    setError('');
    setExito('');
    try {
      await reemplazarArchivoDocumento(modalReemplazo.documento.id, modalReemplazo.archivo);
      setExito(`Se reemplazó el archivo del documento #${modalReemplazo.documento.id}.`);
      setModalReemplazo(null);
      if (archivoReemplazoRef.current) archivoReemplazoRef.current.value = '';
      setVersion((valor) => valor + 1);
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirEstructura = (item) => {
    const campos = CAMPOS_ESTRUCTURA[tipoEstructura];
    const valores = {};
    for (const campo of Object.keys(campos)) {
      valores[campo] = item[campo] == null ? '' : String(item[campo]);
    }
    setModalEstructura({ tipo: tipoEstructura, item, valores });
  };

  const guardarEstructura = async (evento) => {
    evento.preventDefault();
    if (!modalEstructura) return;
    const { tipo, item, valores } = modalEstructura;
    const campos = CAMPOS_ESTRUCTURA[tipo];
    const cuerpo = {};
    const numericos = new Set([
      'siglo',
      'id_repositorio',
      'id_fondo',
      'id_escribano',
      'id_protocolo',
      'anio',
      'id_anio_protocolo',
      'id_registro',
      'mes',
    ]);
    for (const [campo, definicion] of Object.entries(campos)) {
      const valor = valores[campo].trim();
      const previo = item[campo] == null ? '' : String(item[campo]);
      if (valor === previo) continue;
      if (valor === '') {
        cuerpo[campo] = definicion.tipo === 'number' || campo.startsWith('id_') || campo === 'mes' ? null : null;
      } else {
        cuerpo[campo] = numericos.has(campo) ? Number(valor) : valor;
      }
    }
    if (Object.keys(cuerpo).length === 0) {
      setError('No se detectaron cambios en la estructura.');
      return;
    }
    if (item.version) cuerpo.version = item.version;
    setGuardando(true);
    setError('');
    setExito('');
    try {
      await actualizarEstructura(tipo, item.id, cuerpo);
      setExito(`Se actualizó ${tipo} #${item.id}.`);
      setModalEstructura(null);
      setVersion((valor) => valor + 1);
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setGuardando(false);
    }
  };

  const abrirHistorialEntidad = async (item) => {
    try {
      const respuesta = await listarHistorialEntidad(tipoEstructura, item.id, { porPagina: 100 });
      setModalHistorial({
        titulo: `Historial de ${tipoEstructura} #${item.id}`,
        filas: respuesta.resultados ?? [],
        idDocumento: null,
      });
    } catch (errorApi) {
      setError(errorApi.message);
    }
  };

  const previsualizar = async () => {
    const origen = Number(fusionOrigen);
    const destino = Number(fusionDestino);
    if (!origen || !destino || origen === destino) {
      setError('Indique dos identificadores diferentes para la fusión.');
      return;
    }
    setError('');
    try {
      setFusionPreview(await previsualizarFusion(fusionTipo, { origen, destino }));
    } catch (errorApi) {
      setFusionPreview(null);
      setError(errorApi.message);
    }
  };

  const ejecutarFusion = async () => {
    if (!fusionPreview) return;
    if (!window.confirm(`¿Fusionar ${fusionPreview.tipo} #${fusionPreview.origen.id} en #${fusionPreview.destino.id}? Esta acción no se revierte automáticamente.`)) {
      return;
    }
    setGuardando(true);
    setError('');
    setExito('');
    try {
      await fusionarEstructura(fusionTipo, {
        origen: fusionPreview.origen.id,
        destino: fusionPreview.destino.id,
      });
      setExito(`Se fusionó ${fusionTipo} #${fusionPreview.origen.id} en #${fusionPreview.destino.id}.`);
      setFusionPreview(null);
      setFusionOrigen('');
      setFusionDestino('');
      setVersion((valor) => valor + 1);
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setGuardando(false);
    }
  };

  const verOperacion = async (idOperacion) => {
    try {
      const respuesta = await obtenerOperacionGestion(idOperacion);
      setModalOperacion(respuesta);
    } catch (errorApi) {
      setError(errorApi.message);
    }
  };

  const revertirOperacion = async (operacion) => {
    if (!window.confirm(`¿Revertir la operación ${operacion.idOperacion} (${operacion.documentos} documento(s))?`)) return;
    setError('');
    setExito('');
    try {
      const respuesta = await revertirOperacionGestion(operacion.idOperacion);
      setExito(`Se revirtieron ${respuesta.afectados} documento(s).`);
      setVersion((valor) => valor + 1);
    } catch (errorApi) {
      setError(errorApi.message);
    }
  };

  const irAFusionar = (tipo, entidades) => {
    setFusionTipo(tipo);
    setFusionOrigen(String(entidades[0]?.id ?? ''));
    setFusionDestino(String(entidades[1]?.id ?? ''));
    setFusionPreview(null);
    setSeccion('estructura');
    setTipoEstructura(tipo);
  };

  const paginas = useMemo(() => {
    const inicio = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
    const fin = Math.min(totalPaginas, inicio + 4);
    return Array.from({ length: Math.max(0, fin - inicio + 1) }, (_, indice) => inicio + indice);
  }, [pagina, totalPaginas]);

  const columnasEstructura = COLUMNAS_ESTRUCTURA[tipoEstructura] ?? [];

  return (
    <div className="app-fondo">
      <BarraNavegacion />

      <main className="contenedor-busqueda">
        <header className="encabezado-busqueda">
          <div>
            <p className="encabezado-etiqueta">Procesos técnicos archivísticos</p>
            <h1 className="encabezado-titulo">Gestión documental</h1>
            <p className="encabezado-descripcion">
              Edite metadatos e interesados, administre la jerarquía archivística, revise el historial con valores
              anteriores y posteriores, y detecte duplicados.
            </p>
          </div>
          <div className="resumen-datos">
            <div className="dato-resumen">
              <span className="dato-resumen-numero">{resumen?.documentos ?? '—'}</span>
              <span className="dato-resumen-etiqueta">Documentos activos</span>
            </div>
            <div className="dato-resumen">
              <span className="dato-resumen-numero">{resumen?.anulados ?? '—'}</span>
              <span className="dato-resumen-etiqueta">Anulados</span>
            </div>
            <div className="dato-resumen">
              <span className="dato-resumen-numero">{resumen?.cambios ?? '—'}</span>
              <span className="dato-resumen-etiqueta">Cambios registrados</span>
            </div>
          </div>
        </header>

        <div className="panel-busqueda-tabs" role="tablist" aria-label="Secciones de gestión">
          {SECCIONES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={seccion === item.id}
              className={`tab-busqueda ${seccion === item.id ? 'activo' : ''}`}
              onClick={() => {
                setSeccion(item.id);
                setError('');
                setExito('');
              }}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-danger py-2 px-3 small" role="alert">{error}</div>}
        {exito && <div className="alert alert-success py-2 px-3 small" role="alert">{exito}</div>}

        {seccion === 'documentos' && (
          <>
            <section className="panel-busqueda">
              <form className="row g-3 align-items-end" onSubmit={aplicarFiltros}>
                <div className="col-12 col-lg-4">
                  <label htmlFor="gestion-texto" className="form-label filtro-label">Buscar</label>
                  <div className="buscador-input">
                    <IconoBuscar size={17} />
                    <input
                      id="gestion-texto"
                      type="search"
                      className="form-control"
                      placeholder="Título, registro o descriptor"
                      value={entrada}
                      onChange={(evento) => setEntrada(evento.target.value)}
                      maxLength={200}
                    />
                  </div>
                </div>
                <div className="col-6 col-lg-2">
                  <label htmlFor="gestion-conservacion" className="form-label filtro-label">Conservación</label>
                  <select
                    id="gestion-conservacion"
                    className="form-select filtro-control"
                    value={filtros.conservacion}
                    onChange={(evento) => {
                      setPagina(1);
                      setFiltros({ ...filtros, conservacion: evento.target.value });
                    }}
                  >
                    <option value="">Todas</option>
                    <option value="Bueno">Bueno</option>
                    <option value="Regular">Regular</option>
                    <option value="Malo">Malo</option>
                  </select>
                </div>
                <div className="col-6 col-lg-2">
                  <label htmlFor="gestion-estado" className="form-label filtro-label">Estado</label>
                  <select
                    id="gestion-estado"
                    className="form-select filtro-control"
                    value={filtros.estado}
                    onChange={(evento) => {
                      setPagina(1);
                      setFiltros({ ...filtros, estado: evento.target.value });
                    }}
                  >
                    <option value="activos">Activos</option>
                    <option value="anulados">Anulados</option>
                    <option value="todos">Todos</option>
                  </select>
                </div>
                <div className="col-6 col-lg-2">
                  <label htmlFor="gestion-orden" className="form-label filtro-label">Orden</label>
                  <select
                    id="gestion-orden"
                    className="form-select filtro-control"
                    value={filtros.orden}
                    onChange={(evento) => {
                      setPagina(1);
                      setFiltros({ ...filtros, orden: evento.target.value });
                    }}
                  >
                    <option value="fecha">Más recientes</option>
                    <option value="antiguo">Más antiguos</option>
                    <option value="titulo">Título</option>
                    <option value="relevancia">Relevancia</option>
                  </select>
                </div>
                <div className="col-12 col-lg-2 d-flex gap-2 justify-content-end">
                  <button type="button" className="btn boton-secundario" onClick={limpiarFiltros}>Limpiar</button>
                  <button type="submit" className="btn boton-buscar boton-compacto">
                    <IconoBuscar size={15} /> Buscar
                  </button>
                </div>
              </form>
            </section>

            <section className="panel-resultados mt-4">
              <div className="resultados-barra">
                <div>
                  <p className="resultados-titulo">
                    {datos.total} {datos.total === 1 ? 'documento' : 'documentos'}
                  </p>
                  {totalPaginas > 1 && <p className="resultados-subtitulo">Página {pagina} de {totalPaginas}</p>}
                </div>
                <div className="d-flex gap-2">
                  {seleccionadosValidos.length > 0 && (
                    <button type="button" className="btn boton-buscar boton-compacto" onClick={abrirMasiva}>
                      Editar selección ({seleccionadosValidos.length})
                    </button>
                  )}
                </div>
              </div>

              {cargando ? (
                <div className="estado-resultados">
                  <div className="spinner-border text-secondary" role="status" />
                  <p>Cargando documentos...</p>
                </div>
              ) : datos.resultados.length === 0 ? (
                <div className="estado-resultados">
                  <div className="estado-icono"><IconoDocumento size={26} /></div>
                  <h3>Sin documentos</h3>
                  <p>No se encontraron documentos con los criterios seleccionados.</p>
                </div>
              ) : (
                <div className="tabla-usuarios-contenedor">
                  <table className="table tabla-usuarios align-middle">
                    <thead>
                      <tr>
                        <th scope="col">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={todosSeleccionados}
                            onChange={alternarTodos}
                            aria-label="Seleccionar todos los documentos de la página"
                          />
                        </th>
                        <th scope="col">Código</th>
                        <th scope="col">Título</th>
                        <th scope="col">Tipología</th>
                        <th scope="col">Fondo / año</th>
                        <th scope="col">Conservación</th>
                        <th scope="col">Estado</th>
                        <th scope="col" className="text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.resultados.map((documento) => (
                        <tr key={documento.id}>
                          <td>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={seleccionadosValidos.includes(documento.id)}
                              onChange={() => alternarSeleccion(documento.id)}
                              aria-label={`Seleccionar documento ${documento.codigo}`}
                            />
                          </td>
                          <td className="usuario-codigo">{documento.codigo}</td>
                          <td>{documento.titulo}</td>
                          <td>{documento.tipologia ?? '—'}</td>
                          <td className="small">{documento.fondo} / {documento.anio ?? '—'}</td>
                          <td>{documento.conservacion ?? '—'}</td>
                          <td>
                            <span className={`insignia-estado ${documento.anulado ? 'inactivo' : 'activo'}`}>
                              {documento.anulado ? 'Anulado' : 'Activo'}
                            </span>
                          </td>
                          <td className="text-end">
                            <div className="acciones-usuario flex-wrap justify-content-end">
                              <button type="button" className="btn btn-sm boton-secundario" onClick={() => abrirEditar(documento.id)}>
                                Editar
                              </button>
                              <button type="button" className="btn btn-sm boton-secundario" onClick={() => abrirHistorial(documento)}>
                                <IconoHistorial size={13} /> Historial
                              </button>
                              {esAdmin && !documento.anulado && (
                                <>
                                  <button type="button" className="btn btn-sm boton-secundario" onClick={() => abrirReemplazo(documento)}>
                                    Reemplazar
                                  </button>
                                  <button type="button" className="btn btn-sm boton-peligro" onClick={() => anular(documento)}>
                                    Anular
                                  </button>
                                </>
                              )}
                              {esAdmin && documento.anulado && (
                                <button type="button" className="btn btn-sm boton-exito" onClick={() => restaurar(documento)}>
                                  Restaurar
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

              {totalPaginas > 1 && !cargando && (
                <nav className="paginacion" aria-label="Paginación de documentos">
                  <button type="button" className="btn btn-sm boton-pagina" disabled={pagina <= 1} onClick={() => setPagina((valor) => valor - 1)}>
                    Anterior
                  </button>
                  {paginas.map((numero) => (
                    <button
                      key={numero}
                      type="button"
                      className={`btn btn-sm boton-pagina ${numero === pagina ? 'activo' : ''}`}
                      onClick={() => setPagina(numero)}
                    >
                      {numero}
                    </button>
                  ))}
                  <button type="button" className="btn btn-sm boton-pagina" disabled={pagina >= totalPaginas} onClick={() => setPagina((valor) => valor + 1)}>
                    Siguiente
                  </button>
                </nav>
              )}
            </section>
          </>
        )}

        {seccion === 'estructura' && (
          <>
            <section className="panel-busqueda">
              <div className="row g-3 align-items-end">
                <div className="col-12 col-md-4">
                  <label htmlFor="tipo-estructura" className="form-label filtro-label">Entidad</label>
                  <select
                    id="tipo-estructura"
                    className="form-select filtro-control"
                    value={tipoEstructura}
                    onChange={(evento) => {
                      setTipoEstructura(evento.target.value);
                      setBusquedaEstructura('');
                    }}
                  >
                    {TIPOS_ESTRUCTURA.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>{tipo.etiqueta}</option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-5">
                  <label htmlFor="q-estructura" className="form-label filtro-label">Buscar</label>
                  <div className="buscador-input">
                    <IconoBuscar size={17} />
                    <input
                      id="q-estructura"
                      type="search"
                      className="form-control"
                      value={busquedaEstructura}
                      onChange={(evento) => setBusquedaEstructura(evento.target.value)}
                      placeholder="Nombre, número o año"
                      maxLength={200}
                    />
                  </div>
                </div>
                <div className="col-12 col-md-3 text-md-end">
                  <span className="small text-muted">{estructura.total} registro(s)</span>
                </div>
              </div>
            </section>

            {esAdmin && TIPOS_FUSION.includes(tipoEstructura) && (
              <section className="panel-busqueda mt-3">
                <div className="seccion-formulario-cabecera">
                  <h2 className="seccion-formulario-titulo">Fusionar {tipoEstructura}</h2>
                </div>
                <div className="row g-3 align-items-end">
                  <div className="col-6 col-md-2">
                    <label htmlFor="fusion-origen" className="form-label filtro-label">Origen</label>
                    <input id="fusion-origen" type="number" className="form-control" value={fusionOrigen} onChange={(evento) => setFusionOrigen(evento.target.value)} min={1} />
                  </div>
                  <div className="col-6 col-md-2">
                    <label htmlFor="fusion-destino" className="form-label filtro-label">Destino</label>
                    <input id="fusion-destino" type="number" className="form-control" value={fusionDestino} onChange={(evento) => setFusionDestino(evento.target.value)} min={1} />
                  </div>
                  <div className="col-12 col-md-4">
                    <label htmlFor="fusion-tipo" className="form-label filtro-label">Tipo</label>
                    <select
                      id="fusion-tipo"
                      className="form-select filtro-control"
                      value={fusionTipo}
                      onChange={(evento) => {
                        setFusionTipo(evento.target.value);
                        setFusionPreview(null);
                      }}
                    >
                      {TIPOS_FUSION.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                    </select>
                  </div>
                  <div className="col-12 col-md-4 d-flex gap-2 justify-content-end">
                    <button type="button" className="btn boton-secundario" onClick={previsualizar}>Previsualizar</button>
                    <button type="button" className="btn boton-peligro" onClick={ejecutarFusion} disabled={!fusionPreview || guardando}>
                      Fusionar
                    </button>
                  </div>
                </div>
                {fusionPreview && (
                  <div className="alert alert-warning mt-3 py-2 px-3 small" role="alert">
                    <strong>Origen:</strong> {fusionPreview.origen.etiqueta} (#{fusionPreview.origen.id}) ·{' '}
                    <strong>Destino:</strong> {fusionPreview.destino.etiqueta} (#{fusionPreview.destino.id})
                    {fusionPreview.conflictos?.length > 0 && (
                      <ul className="mb-0 mt-2">
                        {fusionPreview.conflictos.map((conflicto) => <li key={conflicto}>{conflicto}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            )}

            <section className="panel-resultados mt-4">
              <div className="resultados-barra">
                <p className="resultados-titulo">Jerarquía archivística</p>
              </div>
              {cargandoEstructura ? (
                <div className="estado-resultados">
                  <div className="spinner-border text-secondary" role="status" />
                  <p>Cargando estructura...</p>
                </div>
              ) : estructura.items.length === 0 ? (
                <div className="estado-resultados">
                  <h3>Sin registros</h3>
                  <p>No se encontraron entidades para el filtro seleccionado.</p>
                </div>
              ) : (
                <div className="tabla-usuarios-contenedor">
                  <table className="table tabla-usuarios align-middle">
                    <thead>
                      <tr>
                        {columnasEstructura.map(([campo, etiqueta]) => <th key={campo} scope="col">{etiqueta}</th>)}
                        <th scope="col" className="text-end">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estructura.items.map((item) => (
                        <tr key={item.id}>
                          {columnasEstructura.map(([campo]) => (
                            <td key={campo}>{valorLegible(item[campo])}</td>
                          ))}
                          <td className="text-end">
                            <div className="acciones-usuario justify-content-end">
                              {esAdmin && (
                                <button type="button" className="btn btn-sm boton-secundario" onClick={() => abrirEstructura(item)}>
                                  Editar
                                </button>
                              )}
                              <button type="button" className="btn btn-sm boton-secundario" onClick={() => abrirHistorialEntidad(item)}>
                                Historial
                              </button>
                              {esAdmin && TIPOS_FUSION.includes(tipoEstructura) && (
                                <button
                                  type="button"
                                  className="btn btn-sm boton-secundario"
                                  onClick={() => {
                                    setFusionTipo(tipoEstructura);
                                    setFusionDestino(String(item.id));
                                    setFusionPreview(null);
                                  }}
                                >
                                  Usar como destino
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
            </section>
          </>
        )}

        {seccion === 'operaciones' && (
          <section className="panel-resultados mt-4">
            <div className="resultados-barra">
              <div>
                <p className="resultados-titulo">{operaciones.total} operación(es) registradas</p>
                <p className="resultados-subtitulo">Revierta ediciones masivas y anulaciones de forma controlada.</p>
              </div>
              <div className="d-flex gap-2">
                <select
                  className="form-select filtro-control"
                  style={{ minWidth: '180px' }}
                  value={tipoOperacion}
                  onChange={(evento) => {
                    setPaginaOperaciones(1);
                    setTipoOperacion(evento.target.value);
                  }}
                >
                  <option value="">Todas las operaciones</option>
                  <option value="EDICION_MASIVA">Edición masiva</option>
                  <option value="ANULACION">Anulación</option>
                  <option value="RESTAURACION">Restauración</option>
                  <option value="REVERSION_OPERACION">Reversión</option>
                  <option value="REEMPLAZO_ARCHIVO">Reemplazo de archivo</option>
                </select>
              </div>
            </div>

            {cargandoOperaciones ? (
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
                            <button type="button" className="btn btn-sm boton-secundario" onClick={() => verOperacion(operacion.idOperacion)}>
                              Detalle
                            </button>
                            {operacion.tipoOperacion !== 'FUSION' && (
                              <button type="button" className="btn btn-sm boton-peligro" onClick={() => revertirOperacion(operacion)}>
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
              <button type="button" className="btn btn-sm boton-pagina" disabled={paginaOperaciones <= 1} onClick={() => setPaginaOperaciones((valor) => valor - 1)}>
                Anterior
              </button>
              <span className="small text-muted align-self-center">Página {paginaOperaciones}</span>
              <button
                type="button"
                className="btn btn-sm boton-pagina"
                disabled={paginaOperaciones * 20 >= operaciones.total}
                onClick={() => setPaginaOperaciones((valor) => valor + 1)}
              >
                Siguiente
              </button>
            </nav>
          </section>
        )}

        {seccion === 'duplicados' && (
          <section className="panel-resultados mt-4">
            <div className="resultados-barra">
              <div>
                <p className="resultados-titulo">Detección de duplicados</p>
                <p className="resultados-subtitulo">Los interesados duplicados se informan para revisión manual.</p>
              </div>
              <button type="button" className="btn boton-secundario" onClick={() => setVersion((valor) => valor + 1)}>
                Actualizar
              </button>
            </div>
            {!duplicados ? (
              <div className="estado-resultados"><p>Cargando duplicados...</p></div>
            ) : (
              <>
                <div className="row g-3 mb-3">
                  {[
                    ['Protocolos', duplicados.totales.protocolos],
                    ['Escribanos', duplicados.totales.escribanos],
                    ['Registros', duplicados.totales.registros],
                    ['Grupos de interesados', duplicados.totales.interesados],
                  ].map(([etiqueta, valor]) => (
                    <div className="col-6 col-md-3" key={etiqueta}>
                      <div className="dato-resumen">
                        <span className="dato-resumen-numero">{valor}</span>
                        <span className="dato-resumen-etiqueta">{etiqueta}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {[
                  ['protocolos', 'Protocolos duplicados', (grupo) => `${grupo.fondo} · ${grupo.numero}`],
                  ['escribanos', 'Escribanos duplicados', (grupo) => `${grupo.fondo} · ${grupo.nombreNormalizado}`],
                  ['registros', 'Registros duplicados', (grupo) => `${grupo.anio} · ${grupo.protocolo} · ${grupo.numero}`],
                  ['interesados', 'Interesados duplicados', (grupo) => grupo.nombreNormalizado],
                ].map(([clave, titulo, describir]) => (
                  <div className="seccion-formulario" key={clave}>
                    <h2 className="seccion-formulario-titulo">{titulo}</h2>
                    {duplicados[clave]?.length === 0 ? (
                      <p className="seccion-formulario-ayuda">No se detectaron grupos duplicados.</p>
                    ) : (
                      <div className="tabla-usuarios-contenedor">
                        <table className="table tabla-usuarios align-middle">
                          <thead>
                            <tr>
                              <th scope="col">Grupo</th>
                              <th scope="col">Cantidad</th>
                              <th scope="col">Entidades</th>
                              {esAdmin && clave !== 'interesados' && <th scope="col" className="text-end">Acciones</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {duplicados[clave].map((grupo) => (
                              <tr key={`${clave}-${describir(grupo)}-${grupo.cantidad}`}>
                                <td>{describir(grupo)}</td>
                                <td>{grupo.cantidad}</td>
                                <td className="small">
                                  {(grupo.entidades ?? []).map((entidad) => (
                                    <span key={entidad.id} className="me-2">
                                      #{entidad.id}{entidad.nombre ? ` ${entidad.nombre}` : ''}
                                    </span>
                                  ))}
                                </td>
                                {esAdmin && clave !== 'interesados' && (
                                  <td className="text-end">
                                    <button
                                      type="button"
                                      className="btn btn-sm boton-secundario"
                                      onClick={() => irAFusionar(clave, grupo.entidades ?? [])}
                                    >
                                      Ir a fusionar
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        <footer className="pie-piloto">
          Piloto SIARC-ARA · Toda edición, anulación y fusión queda registrada en el historial
        </footer>
      </main>

      {modalDocumento && !modalDocumento.cargando && formularioDocumento && (
        <Modal
          titulo={`Editar documento #${formularioDocumento.original.id}`}
          etiqueta="Edición de metadatos"
          onCerrar={cerrarDocumento}
          ancho="960px"
        >
          <form onSubmit={guardarDocumento}>
            {formularioDocumento.original.anulado && (
              <div className="alert alert-warning py-2 px-3 small">
                Documento anulado: {formularioDocumento.original.motivoAnulacion ?? 'sin motivo registrado'}.
              </div>
            )}
            <div className="row g-3">
              <div className="col-12 col-md-8">
                <label className="form-label filtro-label" htmlFor="edit-titulo">Título *</label>
                <input id="edit-titulo" className="form-control" value={formularioDocumento.titulo} onChange={(evento) => actualizarCampo('titulo', evento.target.value)} maxLength={300} required />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label filtro-label" htmlFor="edit-tipologia">Tipología *</label>
                <input id="edit-tipologia" className="form-control" value={formularioDocumento.tipologia} onChange={(evento) => actualizarCampo('tipologia', evento.target.value)} maxLength={100} required />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label filtro-label" htmlFor="edit-serie">Serie</label>
                <input id="edit-serie" className="form-control" value={formularioDocumento.serie} onChange={(evento) => actualizarCampo('serie', evento.target.value)} maxLength={150} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label filtro-label" htmlFor="edit-subserie">Subserie</label>
                <input id="edit-subserie" className="form-control" value={formularioDocumento.subserie} onChange={(evento) => actualizarCampo('subserie', evento.target.value)} maxLength={150} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label filtro-label" htmlFor="edit-folios">Folios</label>
                <input id="edit-folios" type="number" className="form-control" value={formularioDocumento.folios} onChange={(evento) => actualizarCampo('folios', evento.target.value)} min={1} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label filtro-label" htmlFor="edit-conservacion">Conservación</label>
                <select id="edit-conservacion" className="form-select" value={formularioDocumento.estado_conservacion} onChange={(evento) => actualizarCampo('estado_conservacion', evento.target.value)}>
                  <option value="Bueno">Bueno</option>
                  <option value="Regular">Regular</option>
                  <option value="Malo">Malo</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label filtro-label" htmlFor="edit-fecha">Fecha de producción</label>
                <input id="edit-fecha" type="date" className="form-control" value={formularioDocumento.fecha_produccion} onChange={(evento) => actualizarCampo('fecha_produccion', evento.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label filtro-label" htmlFor="edit-ubicacion">Ubicación física</label>
                <input id="edit-ubicacion" className="form-control" value={formularioDocumento.ubicacion_fisica} onChange={(evento) => actualizarCampo('ubicacion_fisica', evento.target.value)} maxLength={150} />
              </div>
              <div className="col-12">
                <label className="form-label filtro-label" htmlFor="edit-alcance">Alcance y contenido</label>
                <textarea id="edit-alcance" className="form-control" rows={3} value={formularioDocumento.alcance_contenido} onChange={(evento) => actualizarCampo('alcance_contenido', evento.target.value)} maxLength={5000} />
              </div>
              <div className="col-12">
                <label className="form-label filtro-label" htmlFor="edit-descriptores">Descriptores</label>
                <input id="edit-descriptores" className="form-control" value={formularioDocumento.descriptores} onChange={(evento) => actualizarCampo('descriptores', evento.target.value)} maxLength={2000} placeholder="Separe los descriptores con comas" />
              </div>
              <div className="col-12">
                <label className="form-label filtro-label" htmlFor="edit-observaciones">Observaciones</label>
                <textarea id="edit-observaciones" className="form-control" rows={2} value={formularioDocumento.observaciones} onChange={(evento) => actualizarCampo('observaciones', evento.target.value)} maxLength={2000} />
              </div>
            </div>

            <div className="seccion-formulario">
              <div className="seccion-formulario-cabecera">
                <h2 className="seccion-formulario-titulo">Interesados</h2>
                <button
                  type="button"
                  className="btn btn-sm boton-secundario"
                  onClick={() => actualizarCampo('interesados', [...formularioDocumento.interesados, { nombre: '', documento: '', rol: '' }])}
                >
                  Agregar interesado
                </button>
              </div>
              {formularioDocumento.interesados.length === 0 ? (
                <p className="seccion-formulario-ayuda">Sin interesados registrados.</p>
              ) : (
                <div className="lista-interesados-formulario">
                  {formularioDocumento.interesados.map((interesado, indice) => (
                    <div className="fila-interesado" key={indice}>
                      <input className="form-control" placeholder="Nombre" value={interesado.nombre} onChange={(evento) => actualizarInteresado(indice, 'nombre', evento.target.value)} maxLength={200} />
                      <input className="form-control" placeholder="Documento" value={interesado.documento} onChange={(evento) => actualizarInteresado(indice, 'documento', evento.target.value)} maxLength={20} />
                      <input className="form-control" placeholder="Rol" value={interesado.rol} onChange={(evento) => actualizarInteresado(indice, 'rol', evento.target.value)} maxLength={50} />
                      <button
                        type="button"
                        className="boton-quitar"
                        onClick={() => actualizarCampo('interesados', formularioDocumento.interesados.filter((_, posicion) => posicion !== indice))}
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
              <button type="button" className="btn boton-secundario" onClick={cerrarDocumento} disabled={guardando}>Cancelar</button>
              <button type="submit" className="btn boton-buscar boton-compacto" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modalDocumento?.cargando && (
        <Modal titulo="Cargando documento" etiqueta="Edición de metadatos" onCerrar={() => setModalDocumento(null)}>
          <div className="estado-resultados"><div className="spinner-border text-secondary" role="status" /><p>Cargando ficha...</p></div>
        </Modal>
      )}

      {modalHistorial && (
        <Modal
          titulo={modalHistorial.titulo}
          etiqueta="Historial de cambios"
          onCerrar={() => setModalHistorial(null)}
          ancho="1000px"
        >
          <TablaHistorial filas={modalHistorial.filas} idDocumento={modalHistorial.idDocumento} onRevertir={revertirCambio} />
          <div className="modal-acciones">
            <button type="button" className="btn boton-secundario" onClick={() => setModalHistorial(null)}>Cerrar</button>
          </div>
        </Modal>
      )}

      {modalOperacion && (
        <Modal
          titulo={`Operación ${modalOperacion.idOperacion}`}
          etiqueta="Detalle de operación"
          onCerrar={() => setModalOperacion(null)}
          ancho="1000px"
        >
          <TablaHistorial filas={modalOperacion.cambios} idDocumento={null} />
          <div className="modal-acciones">
            <button type="button" className="btn boton-secundario" onClick={() => setModalOperacion(null)}>Cerrar</button>
          </div>
        </Modal>
      )}

      {modalMasiva && (
        <Modal
          titulo={`Edición masiva de ${modalMasiva.ids.length} documento(s)`}
          etiqueta="Edición por lote"
          onCerrar={() => !guardando && setModalMasiva(null)}
        >
          <form onSubmit={guardarMasiva}>
            <p className="small text-muted">Solo se modificarán los campos que complete. La operación es todo o nada.</p>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label filtro-label" htmlFor="masiva-conservacion">Conservación</label>
                <select id="masiva-conservacion" className="form-select" value={formularioMasiva.estado_conservacion} onChange={(evento) => setFormularioMasiva({ ...formularioMasiva, estado_conservacion: evento.target.value })}>
                  <option value="">No modificar</option>
                  <option value="Bueno">Bueno</option>
                  <option value="Regular">Regular</option>
                  <option value="Malo">Malo</option>
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label filtro-label" htmlFor="masiva-tipologia">Tipología</label>
                <input id="masiva-tipologia" className="form-control" value={formularioMasiva.tipologia} onChange={(evento) => setFormularioMasiva({ ...formularioMasiva, tipologia: evento.target.value })} maxLength={100} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label filtro-label" htmlFor="masiva-serie">Serie</label>
                <input id="masiva-serie" className="form-control" value={formularioMasiva.serie} onChange={(evento) => setFormularioMasiva({ ...formularioMasiva, serie: evento.target.value })} maxLength={150} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label filtro-label" htmlFor="masiva-subserie">Subserie</label>
                <input id="masiva-subserie" className="form-control" value={formularioMasiva.subserie} onChange={(evento) => setFormularioMasiva({ ...formularioMasiva, subserie: evento.target.value })} maxLength={150} />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label filtro-label" htmlFor="masiva-ubicacion">Ubicación física</label>
                <input id="masiva-ubicacion" className="form-control" value={formularioMasiva.ubicacion_fisica} onChange={(evento) => setFormularioMasiva({ ...formularioMasiva, ubicacion_fisica: evento.target.value })} maxLength={150} />
              </div>
              <div className="col-12">
                <label className="form-label filtro-label" htmlFor="masiva-observaciones">Observaciones</label>
                <textarea id="masiva-observaciones" className="form-control" rows={2} value={formularioMasiva.observaciones} onChange={(evento) => setFormularioMasiva({ ...formularioMasiva, observaciones: evento.target.value })} maxLength={2000} />
              </div>
            </div>
            <div className="modal-acciones">
              <button type="button" className="btn boton-secundario" onClick={() => setModalMasiva(null)} disabled={guardando}>Cancelar</button>
              <button type="submit" className="btn boton-buscar boton-compacto" disabled={guardando}>
                {guardando ? 'Aplicando...' : 'Aplicar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modalReemplazo && (
        <Modal
          titulo={`Reemplazar archivo del documento #${modalReemplazo.documento.id}`}
          etiqueta="Reemplazo de archivo digital"
          onCerrar={() => !guardando && setModalReemplazo(null)}
        >
          <form onSubmit={guardarReemplazo}>
            <p className="small text-muted">
              El archivo anterior no se elimina. El reemplazo queda registrado en el historial con la ruta anterior y la nueva.
            </p>
            <label htmlFor="reemplazo-archivo" className="zona-archivo">
              <IconoSubir size={26} />
              <span className="zona-archivo-titulo">{modalReemplazo.archivo ? modalReemplazo.archivo.name : 'Seleccione el archivo PDF/A o TIFF'}</span>
              <span className="zona-archivo-ayuda">Extensiones permitidas: .pdf, .tif, .tiff · máximo 50 MB</span>
              <input
                id="reemplazo-archivo"
                ref={archivoReemplazoRef}
                type="file"
                accept=".pdf,.tif,.tiff,application/pdf,image/tiff"
                className="zona-archivo-input"
                onChange={(evento) => setModalReemplazo({ ...modalReemplazo, archivo: evento.target.files?.[0] ?? null })}
              />
            </label>
            <div className="modal-acciones">
              <button type="button" className="btn boton-secundario" onClick={() => setModalReemplazo(null)} disabled={guardando}>Cancelar</button>
              <button type="submit" className="btn boton-buscar boton-compacto" disabled={guardando}>
                {guardando ? 'Reemplazando...' : 'Reemplazar archivo'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modalEstructura && (
        <Modal
          titulo={`Editar ${modalEstructura.tipo} #${modalEstructura.item.id}`}
          etiqueta="Edición de jerarquía"
          onCerrar={() => !guardando && setModalEstructura(null)}
        >
          <form onSubmit={guardarEstructura}>
            <div className="row g-3">
              {Object.entries(CAMPOS_ESTRUCTURA[modalEstructura.tipo]).map(([campo, definicion]) => (
                <div className={definicion.tipo === 'textarea' ? 'col-12' : 'col-12 col-md-6'} key={campo}>
                  <label className="form-label filtro-label" htmlFor={`estructura-${campo}`}>{definicion.etiqueta}</label>
                  {definicion.tipo === 'textarea' ? (
                    <textarea
                      id={`estructura-${campo}`}
                      className="form-control"
                      rows={3}
                      value={modalEstructura.valores[campo]}
                      onChange={(evento) => setModalEstructura({ ...modalEstructura, valores: { ...modalEstructura.valores, [campo]: evento.target.value } })}
                    />
                  ) : (
                    <input
                      id={`estructura-${campo}`}
                      type={definicion.tipo === 'number' ? 'number' : 'text'}
                      className="form-control"
                      value={modalEstructura.valores[campo]}
                      onChange={(evento) => setModalEstructura({ ...modalEstructura, valores: { ...modalEstructura.valores, [campo]: evento.target.value } })}
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="small text-muted mt-3 mb-0">
              Se enviará la versión del registro para impedir sobrescribir cambios concurrentes.
            </p>
            <div className="modal-acciones">
              <button type="button" className="btn boton-secundario" onClick={() => setModalEstructura(null)} disabled={guardando}>Cancelar</button>
              <button type="submit" className="btn boton-buscar boton-compacto" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
