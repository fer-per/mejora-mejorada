import { useEffect, useMemo, useState } from 'react';
import BarraNavegacion from '../components/BarraNavegacion.jsx';
import { IconoBuscar, IconoCerrar, IconoUsuario } from '../components/Iconos.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  actualizarUsuario,
  cambiarEstadoUsuario,
  crearUsuario,
  listarUsuarios,
} from '../services/api.js';

const FILTROS_INICIALES = { q: '', perfil: '', estado: '' };

const FORMULARIO_VACIO = {
  nombres: '',
  apellidos: '',
  correo: '',
  nombre_usuario: '',
  contrasena: '',
  perfil: 'USUARIO_EXTERNO',
  estado: 'ACTIVO',
};

const ETIQUETA_PERFIL = {
  ADMINISTRADOR: 'Administrador',
  ARCHIVISTA: 'Archivista',
  USUARIO_EXTERNO: 'Usuario externo',
};

const POR_PAGINA = 15;

export default function UsuariosPage() {
  const { usuario: sesion } = useAuth();
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [entrada, setEntrada] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ total: 0, pagina: 1, porPagina: POR_PAGINA, resultados: [] });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [version, setVersion] = useState(0);
  const [formulario, setFormulario] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');

    listarUsuarios({ ...filtros, pagina, porPagina: POR_PAGINA })
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
  }, [filtros, pagina, version]);

  const paginas = useMemo(() => {
    const total = Math.max(1, Math.ceil(datos.total / (datos.porPagina || POR_PAGINA)));
    const inicio = Math.max(1, Math.min(pagina - 2, total - 4));
    const fin = Math.min(total, inicio + 4);
    return Array.from({ length: Math.max(0, fin - inicio + 1) }, (_, indice) => inicio + indice);
  }, [datos, pagina]);

  const totalPaginas = Math.max(1, Math.ceil(datos.total / (datos.porPagina || POR_PAGINA)));

  const aplicarFiltros = (evento) => {
    evento.preventDefault();
    setPagina(1);
    setFiltros({ ...filtros, q: entrada.trim() });
  };

  const limpiarFiltros = () => {
    setEntrada('');
    setFiltros(FILTROS_INICIALES);
    setPagina(1);
  };

  const abrirCrear = () => {
    setError('');
    setExito('');
    setFormulario({ id: null, ...FORMULARIO_VACIO });
  };

  const abrirEditar = (usuario) => {
    setError('');
    setExito('');
    setFormulario({
      id: usuario.id,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      nombre_usuario: usuario.nombreUsuario,
      contrasena: '',
      perfil: usuario.perfil,
      estado: usuario.estado,
    });
  };

  const cerrarFormulario = () => {
    if (guardando) return;
    setFormulario(null);
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setError('');
    setExito('');

    const esEdicion = Boolean(formulario.id);
    const cuerpo = {
      nombres: formulario.nombres.trim(),
      apellidos: formulario.apellidos.trim(),
      correo: formulario.correo.trim(),
      nombre_usuario: formulario.nombre_usuario.trim(),
      perfil: formulario.perfil,
      estado: formulario.estado,
    };

    if (formulario.contrasena.trim()) {
      cuerpo.contrasena = formulario.contrasena;
    } else if (!esEdicion) {
      setError('La contraseña es obligatoria para un usuario nuevo.');
      return;
    }

    setGuardando(true);
    try {
      if (esEdicion) {
        await actualizarUsuario(formulario.id, cuerpo);
        setExito(`Se actualizó el usuario "${formulario.nombre_usuario}".`);
      } else {
        await crearUsuario(cuerpo);
        setExito(`Se registró el usuario "${formulario.nombre_usuario}".`);
      }
      setFormulario(null);
      setVersion((valor) => valor + 1);
    } catch (errorApi) {
      setError(errorApi.message);
    } finally {
      setGuardando(false);
    }
  };

  const alternarEstado = async (usuario) => {
    const nuevoEstado = usuario.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    if (nuevoEstado === 'INACTIVO') {
      const confirmado = window.confirm(
        `¿Desactivar al usuario "${usuario.nombreUsuario}"? No podrá iniciar sesión hasta que se reactive.`,
      );
      if (!confirmado) return;
    }

    setError('');
    setExito('');
    try {
      await cambiarEstadoUsuario(usuario.id, nuevoEstado);
      setExito(
        nuevoEstado === 'ACTIVO'
          ? `Se activó el usuario "${usuario.nombreUsuario}".`
          : `Se desactivó el usuario "${usuario.nombreUsuario}".`,
      );
      setVersion((valor) => valor + 1);
    } catch (errorApi) {
      setError(errorApi.message);
    }
  };

  return (
    <div className="app-fondo">
      <BarraNavegacion />

      <main className="contenedor-busqueda">
        <header className="encabezado-busqueda">
          <div>
            <p className="encabezado-etiqueta">Administración del sistema</p>
            <h1 className="encabezado-titulo">Gestión de usuarios</h1>
            <p className="encabezado-descripcion">
              Registre, actualice y controle el acceso del personal del archivo y de los usuarios externos del piloto.
            </p>
          </div>
          <div className="resumen-datos">
            <div className="dato-resumen">
              <span className="dato-resumen-numero">{datos.total}</span>
              <span className="dato-resumen-etiqueta">Usuarios</span>
            </div>
            <div className="dato-resumen">
              <span className="dato-resumen-numero">
                {datos.resultados.filter((item) => item.estado === 'ACTIVO').length}
              </span>
              <span className="dato-resumen-etiqueta">Activos en página</span>
            </div>
          </div>
        </header>

        <section className="panel-busqueda">
          <form className="row g-3 align-items-end" onSubmit={aplicarFiltros}>
            <div className="col-12 col-lg-5">
              <label htmlFor="q-usuarios" className="form-label filtro-label">Buscar</label>
              <div className="buscador-input">
                <IconoBuscar size={17} />
                <input
                  id="q-usuarios"
                  type="search"
                  className="form-control"
                  placeholder="Nombre, usuario o correo"
                  value={entrada}
                  onChange={(evento) => setEntrada(evento.target.value)}
                  maxLength={150}
                />
              </div>
            </div>
            <div className="col-6 col-lg-2">
              <label htmlFor="perfil-usuarios" className="form-label filtro-label">Perfil</label>
              <select
                id="perfil-usuarios"
                className="form-select filtro-control"
                value={filtros.perfil}
                onChange={(evento) => {
                  setPagina(1);
                  setFiltros({ ...filtros, perfil: evento.target.value });
                }}
              >
                <option value="">Todos</option>
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="ARCHIVISTA">Archivista</option>
                <option value="USUARIO_EXTERNO">Usuario externo</option>
              </select>
            </div>
            <div className="col-6 col-lg-2">
              <label htmlFor="estado-usuarios" className="form-label filtro-label">Estado</label>
              <select
                id="estado-usuarios"
                className="form-select filtro-control"
                value={filtros.estado}
                onChange={(evento) => {
                  setPagina(1);
                  setFiltros({ ...filtros, estado: evento.target.value });
                }}
              >
                <option value="">Todos</option>
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
            </div>
            <div className="col-12 col-lg-3 d-flex gap-2 justify-content-end">
              <button type="button" className="btn boton-secundario" onClick={limpiarFiltros}>
                Limpiar
              </button>
              <button type="submit" className="btn boton-buscar boton-compacto">
                <IconoBuscar size={15} />
                Buscar
              </button>
            </div>
          </form>
        </section>

        {error && (
          <div className="alert alert-danger mt-3 py-2 px-3 small" role="alert">
            {error}
          </div>
        )}
        {exito && (
          <div className="alert alert-success mt-3 py-2 px-3 small" role="alert">
            {exito}
          </div>
        )}

        <section className="panel-resultados mt-4">
          <div className="resultados-barra">
            <div>
              <p className="resultados-titulo">
                {datos.total} {datos.total === 1 ? 'usuario registrado' : 'usuarios registrados'}
              </p>
              {totalPaginas > 1 && <p className="resultados-subtitulo">Página {pagina} de {totalPaginas}</p>}
            </div>
            <button type="button" className="btn boton-buscar boton-compacto" onClick={abrirCrear}>
              <IconoUsuario size={15} />
              Nuevo usuario
            </button>
          </div>

          {cargando ? (
            <div className="estado-resultados">
              <div className="spinner-border text-secondary" role="status" />
              <p>Cargando usuarios...</p>
            </div>
          ) : datos.resultados.length === 0 ? (
            <div className="estado-resultados">
              <div className="estado-icono">
                <IconoUsuario size={26} />
              </div>
              <h3>Sin usuarios</h3>
              <p>No se encontraron usuarios con los criterios seleccionados.</p>
            </div>
          ) : (
            <div className="tabla-usuarios-contenedor">
              <table className="table tabla-usuarios align-middle">
                <thead>
                  <tr>
                    <th scope="col">Usuario</th>
                    <th scope="col">Nombre completo</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Perfil</th>
                    <th scope="col">Estado</th>
                    <th scope="col" className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.resultados.map((usuario) => (
                    <tr key={usuario.id}>
                      <td className="usuario-codigo">{usuario.nombreUsuario}</td>
                      <td>{`${usuario.nombres} ${usuario.apellidos}`}</td>
                      <td className="usuario-correo">{usuario.correo}</td>
                      <td>{ETIQUETA_PERFIL[usuario.perfil] ?? usuario.perfil}</td>
                      <td>
                        <span className={`insignia-estado ${usuario.estado === 'ACTIVO' ? 'activo' : 'inactivo'}`}>
                          {usuario.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="acciones-usuario">
                          <button
                            type="button"
                            className="btn btn-sm boton-secundario"
                            onClick={() => abrirEditar(usuario)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${usuario.estado === 'ACTIVO' ? 'boton-peligro' : 'boton-exito'}`}
                            onClick={() => alternarEstado(usuario)}
                            disabled={usuario.id === sesion?.id && usuario.estado === 'ACTIVO'}
                          >
                            {usuario.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPaginas > 1 && !cargando && (
            <nav className="paginacion" aria-label="Paginación de usuarios">
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
          Piloto SIARC-ARA · Toda alta, edición y cambio de estado queda registrada en auditoría
        </footer>
      </main>

      {formulario && (
        <div className="modal-fondo" role="presentation" onMouseDown={cerrarFormulario}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-usuario"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="modal-cabecera">
              <div>
                <p className="encabezado-etiqueta">{formulario.id ? 'Edición' : 'Registro'}</p>
                <h2 id="titulo-modal-usuario" className="modal-titulo">
                  {formulario.id ? 'Editar usuario' : 'Nuevo usuario'}
                </h2>
              </div>
              <button type="button" className="modal-cerrar" onClick={cerrarFormulario} aria-label="Cerrar">
                <IconoCerrar />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label htmlFor="nombres" className="form-label filtro-label">Nombres</label>
                  <input
                    id="nombres"
                    className="form-control"
                    value={formulario.nombres}
                    onChange={(evento) => setFormulario({ ...formulario, nombres: evento.target.value })}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="apellidos" className="form-label filtro-label">Apellidos</label>
                  <input
                    id="apellidos"
                    className="form-control"
                    value={formulario.apellidos}
                    onChange={(evento) => setFormulario({ ...formulario, apellidos: evento.target.value })}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="nombre_usuario" className="form-label filtro-label">Nombre de usuario</label>
                  <input
                    id="nombre_usuario"
                    className="form-control"
                    value={formulario.nombre_usuario}
                    onChange={(evento) => setFormulario({ ...formulario, nombre_usuario: evento.target.value })}
                    maxLength={50}
                    pattern="[a-zA-Z0-9._\-]+"
                    title="Use solo letras, números, punto, guion o guion bajo"
                    required
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="correo" className="form-label filtro-label">Correo electrónico</label>
                  <input
                    id="correo"
                    type="email"
                    className="form-control"
                    value={formulario.correo}
                    onChange={(evento) => setFormulario({ ...formulario, correo: evento.target.value })}
                    maxLength={150}
                    required
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="contrasena" className="form-label filtro-label">
                    Contraseña {formulario.id ? '(opcional)' : ''}
                  </label>
                  <input
                    id="contrasena"
                    type="password"
                    className="form-control"
                    value={formulario.contrasena}
                    onChange={(evento) => setFormulario({ ...formulario, contrasena: evento.target.value })}
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required={!formulario.id}
                  />
                </div>
                <div className="col-12 col-md-3">
                  <label htmlFor="perfil" className="form-label filtro-label">Perfil</label>
                  <select
                    id="perfil"
                    className="form-select"
                    value={formulario.perfil}
                    onChange={(evento) => setFormulario({ ...formulario, perfil: evento.target.value })}
                  >
                    <option value="ADMINISTRADOR">Administrador</option>
                    <option value="ARCHIVISTA">Archivista</option>
                    <option value="USUARIO_EXTERNO">Usuario externo</option>
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <label htmlFor="estado" className="form-label filtro-label">Estado</label>
                  <select
                    id="estado"
                    className="form-select"
                    value={formulario.estado}
                    onChange={(evento) => setFormulario({ ...formulario, estado: evento.target.value })}
                  >
                    <option value="ACTIVO">Activo</option>
                    <option value="INACTIVO">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="modal-acciones">
                <button type="button" className="btn boton-secundario" onClick={cerrarFormulario} disabled={guardando}>
                  Cancelar
                </button>
                <button type="submit" className="btn boton-buscar boton-compacto" disabled={guardando}>
                  {guardando ? 'Guardando...' : formulario.id ? 'Guardar cambios' : 'Registrar usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
