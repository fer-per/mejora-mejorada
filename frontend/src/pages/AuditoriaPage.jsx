import { useEffect, useMemo, useState } from 'react';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import { IconoCerrar, IconoFiltro, IconoHistorial } from '../components/Iconos.jsx';
import { listarAuditoria, listarUsuariosAuditoria, obtenerAccionAuditoria } from '../services/api.js';

const FILTROS_INICIALES = { tipoAccion: '', idUsuario: '', desde: '', hasta: '' };
const POR_PAGINA = 20;

const ACCIONES = [
  { valor: 'INICIO_SESION_EXITOSO', etiqueta: 'Inicio de sesión', grupo: 'auth' },
  { valor: 'INICIO_SESION_FALLIDO', etiqueta: 'Intento fallido', grupo: 'auth' },
  { valor: 'INICIO_SESION_BLOQUEADO', etiqueta: 'Cuenta bloqueada', grupo: 'auth' },
  { valor: 'INICIO_SESION_RECHAZADO', etiqueta: 'Acceso rechazado', grupo: 'auth' },
  { valor: 'CUENTA_BLOQUEADA', etiqueta: 'Bloqueo de cuenta', grupo: 'auth' },
  { valor: 'CIERRE_SESION', etiqueta: 'Cierre de sesión', grupo: 'auth' },
  { valor: 'CONSULTA_DOCUMENTAL', etiqueta: 'Búsqueda documental', grupo: 'consulta' },
  { valor: 'CONSULTA_DETALLE_DOCUMENTO', etiqueta: 'Consulta de ficha', grupo: 'consulta' },
  { valor: 'VISUALIZACION_DOCUMENTO', etiqueta: 'Visualización', grupo: 'consulta' },
  { valor: 'CARGA_DOCUMENTO', etiqueta: 'Ingesta documental', grupo: 'carga' },
  { valor: 'EDICION_DOCUMENTO', etiqueta: 'Edición documental', grupo: 'carga' },
  { valor: 'CREACION_USUARIO', etiqueta: 'Alta de usuario', grupo: 'gestion' },
  { valor: 'ACTUALIZACION_USUARIO', etiqueta: 'Edición de usuario', grupo: 'gestion' },
  { valor: 'ACTIVACION_USUARIO', etiqueta: 'Activación de usuario', grupo: 'gestion' },
  { valor: 'DESACTIVACION_USUARIO', etiqueta: 'Desactivación de usuario', grupo: 'gestion' },
];

const ETIQUETA_ACCION = Object.fromEntries(ACCIONES.map((accion) => [accion.valor, accion.etiqueta]));

function grupoAccion(tipo) {
  const encontrada = ACCIONES.find((accion) => accion.valor === tipo);
  if (encontrada) return encontrada.grupo;
  if (tipo.startsWith('INICIO') || tipo.includes('SESION') || tipo.includes('CUENTA')) return 'auth';
  if (tipo.includes('USUARIO')) return 'gestion';
  if (tipo.includes('CARGA') || tipo.includes('EDICION')) return 'carga';
  return 'consulta';
}

function formatearFecha(valor) {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;
  return fecha.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function nombreUsuario(usuario) {
  if (!usuario) return 'Sistema';
  return usuario.nombreUsuario ?? `${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim();
}

export default function AuditoriaPage() {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ total: 0, pagina: 1, porPagina: POR_PAGINA, resultados: [] });
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  useEffect(() => {
    let activo = true;
    listarUsuariosAuditoria()
      .then((respuesta) => {
        if (activo) setUsuarios(respuesta.usuarios ?? []);
      })
      .catch(() => {});

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');

    listarAuditoria({ ...filtros, pagina, porPagina: POR_PAGINA })
      .then((respuesta) => {
        if (activo) setDatos(respuesta);
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
  }, [filtros, pagina]);

  const totalPaginas = Math.max(1, Math.ceil(datos.total / (datos.porPagina || POR_PAGINA)));

  const paginas = useMemo(() => {
    const inicio = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
    const fin = Math.min(totalPaginas, inicio + 4);
    return Array.from({ length: Math.max(0, fin - inicio + 1) }, (_, indice) => inicio + indice);
  }, [pagina, totalPaginas]);

  const cambiarFiltro = (campo, valor) => {
    setPagina(1);
    setFiltros((actuales) => ({ ...actuales, [campo]: valor }));
  };

  const limpiarFiltros = () => {
    setFiltros(FILTROS_INICIALES);
    setPagina(1);
  };

  const verDetalle = async (accion) => {
    setCargandoDetalle(true);
    setError('');
    try {
      const respuesta = await obtenerAccionAuditoria(accion.id);
      setDetalle(respuesta.registro ?? respuesta);
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const hayFiltros = Object.values(filtros).some(Boolean);

  return (
    <div className="app-fondo">
      <BarraNavegacion />

      <main className="contenedor-busqueda">
        <header className="encabezado-busqueda">
          <div>
            <p className="encabezado-etiqueta">Trazabilidad del sistema</p>
            <h1 className="encabezado-titulo">Auditoría</h1>
            <p className="encabezado-descripcion">
              Consulte el historial de accesos, búsquedas, visualizaciones, cargas y operaciones administrativas
              registradas por el sistema.
            </p>
          </div>
          <div className="resumen-datos">
            <div className="dato-resumen">
              <span className="dato-resumen-numero">{datos.total}</span>
              <span className="dato-resumen-etiqueta">Registros</span>
            </div>
            <div className="dato-resumen">
              <span className="dato-resumen-numero">{datos.resultados.length}</span>
              <span className="dato-resumen-etiqueta">En esta página</span>
            </div>
          </div>
        </header>

        <section className="panel-busqueda">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-6 col-lg-3">
              <label htmlFor="tipo_accion" className="form-label filtro-label">Tipo de acción</label>
              <select
                id="tipo_accion"
                className="form-select filtro-control"
                value={filtros.tipoAccion}
                onChange={(evento) => cambiarFiltro('tipoAccion', evento.target.value)}
              >
                <option value="">Todas las acciones</option>
                {ACCIONES.map((accion) => (
                  <option key={accion.valor} value={accion.valor}>{accion.etiqueta}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-lg-3">
              <label htmlFor="id_usuario" className="form-label filtro-label">Usuario</label>
              <select
                id="id_usuario"
                className="form-select filtro-control"
                value={filtros.idUsuario}
                onChange={(evento) => cambiarFiltro('idUsuario', evento.target.value)}
              >
                <option value="">Todos los usuarios</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>{usuario.nombreUsuario}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label htmlFor="desde" className="form-label filtro-label">Desde</label>
              <input
                id="desde"
                type="date"
                className="form-control filtro-control"
                value={filtros.desde}
                onChange={(evento) => cambiarFiltro('desde', evento.target.value)}
              />
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label htmlFor="hasta" className="form-label filtro-label">Hasta</label>
              <input
                id="hasta"
                type="date"
                className="form-control filtro-control"
                value={filtros.hasta}
                onChange={(evento) => cambiarFiltro('hasta', evento.target.value)}
              />
            </div>
            <div className="col-12 col-lg-2 d-flex justify-content-end">
              <button type="button" className="btn boton-secundario" onClick={limpiarFiltros} disabled={!hayFiltros}>
                <IconoFiltro size={15} />
                Limpiar
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="alert alert-danger mt-3 py-2 px-3 small" role="alert">
            {error}
          </div>
        )}

        <section className="panel-resultados mt-4">
          <div className="resultados-barra">
            <div>
              <p className="resultados-titulo">
                {datos.total} {datos.total === 1 ? 'acción registrada' : 'acciones registradas'}
              </p>
              {totalPaginas > 1 && <p className="resultados-subtitulo">Página {pagina} de {totalPaginas}</p>}
            </div>
            <p className="auditoria-nota">Registro inmutable de solo lectura</p>
          </div>

          {cargando ? (
            <div className="estado-resultados">
              <div className="spinner-border text-secondary" role="status" />
              <p>Cargando registros de auditoría...</p>
            </div>
          ) : datos.resultados.length === 0 ? (
            <div className="estado-resultados">
              <div className="estado-icono">
                <IconoHistorial size={26} />
              </div>
              <h3>Sin registros</h3>
              <p>No se encontraron acciones con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="tabla-usuarios-contenedor">
              <table className="table tabla-usuarios tabla-auditoria align-middle">
                <thead>
                  <tr>
                    <th scope="col">Fecha y hora</th>
                    <th scope="col">Acción</th>
                    <th scope="col">Usuario</th>
                    <th scope="col">Descripción</th>
                    <th scope="col" className="text-end">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.resultados.map((accion) => (
                    <tr key={accion.id}>
                      <td className="auditoria-fecha">{formatearFecha(accion.fechaHora)}</td>
                      <td>
                        <span className={`insignia-accion accion-${grupoAccion(accion.tipoAccion)}`}>
                          {ETIQUETA_ACCION[accion.tipoAccion] ?? accion.tipoAccion}
                        </span>
                      </td>
                      <td className="usuario-codigo">{nombreUsuario(accion.usuario)}</td>
                      <td>
                        <span className="auditoria-descripcion" title={accion.descripcion}>{accion.descripcion}</span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm boton-secundario"
                          onClick={() => verDetalle(accion)}
                          disabled={cargandoDetalle}
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPaginas > 1 && !cargando && (
            <nav className="paginacion" aria-label="Paginación de auditoría">
              <button
                type="button"
                className="btn btn-sm boton-pagina"
                disabled={pagina <= 1}
                onClick={() => setPagina((valor) => valor - 1)}
              >
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
              <button
                type="button"
                className="btn btn-sm boton-pagina"
                disabled={pagina >= totalPaginas}
                onClick={() => setPagina((valor) => valor + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
        </section>

        <footer className="pie-piloto">
          Piloto SIARC-ARA · El historial de auditoría no permite modificación ni eliminación
        </footer>
      </main>

      {detalle && (
        <div className="modal-fondo" role="presentation" onMouseDown={() => setDetalle(null)}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-auditoria"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="modal-cabecera">
              <div>
                <p className="encabezado-etiqueta">Registro #{detalle.id}</p>
                <h2 id="titulo-modal-auditoria" className="modal-titulo">Detalle de la acción</h2>
              </div>
              <button type="button" className="modal-cerrar" onClick={() => setDetalle(null)} aria-label="Cerrar">
                <IconoCerrar />
              </button>
            </div>

            <dl className="detalle-auditoria">
              <div>
                <dt>Fecha y hora</dt>
                <dd>{formatearFecha(detalle.fechaHora)}</dd>
              </div>
              <div>
                <dt>Tipo de acción</dt>
                <dd>
                  <span className={`insignia-accion accion-${grupoAccion(detalle.tipoAccion)}`}>
                    {ETIQUETA_ACCION[detalle.tipoAccion] ?? detalle.tipoAccion}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Usuario</dt>
                <dd>{nombreUsuario(detalle.usuario)}</dd>
              </div>
              <div className="detalle-auditoria-completo">
                <dt>Descripción</dt>
                <dd>{detalle.descripcion}</dd>
              </div>
            </dl>

            <div className="modal-acciones">
              <button type="button" className="btn boton-buscar boton-compacto" onClick={() => setDetalle(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
