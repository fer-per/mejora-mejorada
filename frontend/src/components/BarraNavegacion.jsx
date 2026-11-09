import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { IconoDocumento, IconoHistorial, IconoLibro, IconoSalir, IconoUsuario } from './Iconos.jsx';

const ETIQUETA_PERFIL = {
  admin: 'Administrador',
  archivero: 'Archivista',
  viewer: 'Usuario externo',
};

export default function BarraNavegacion() {
  const { usuario, cerrarSesion } = useAuth();

  const enlaces = [{ to: '/busqueda', etiqueta: 'Consulta', icono: <IconoLibro size={15} /> }];
  if (usuario?.role === 'admin' || usuario?.role === 'archivero') {
    enlaces.push({ to: '/ingesta', etiqueta: 'Ingesta', icono: <IconoDocumento size={15} /> });
  }
  if (usuario?.role === 'admin') {
    enlaces.push({ to: '/usuarios', etiqueta: 'Usuarios', icono: <IconoUsuario size={15} /> });
  }
  if (usuario?.role === 'admin' || usuario?.role === 'archivero') {
    enlaces.push({ to: '/auditoria', etiqueta: 'Auditoría', icono: <IconoHistorial size={15} /> });
  }

  const claseEnlace = ({ isActive }) => `navbar-enlace ${isActive ? 'activo' : ''}`;

  return (
    <>
      <header className="navbar-siarc">
        <div className="navbar-marca">
          <img src="/marcas/logo-ara.png" alt="Archivo Regional de Arequipa" className="navbar-logo" />
          <div className="navbar-textos">
            <p className="navbar-titulo">Sistema de consultas documentarias ARA</p>
          </div>
        </div>

        <nav className="navbar-menu" aria-label="Secciones principales">
          {enlaces.map((enlace) => (
            <NavLink key={enlace.to} to={enlace.to} className={claseEnlace}>
              {enlace.icono}
              <span>{enlace.etiqueta}</span>
            </NavLink>
          ))}
        </nav>

        <div className="navbar-sesion">
          <div className="navbar-usuario">
            <span className="navbar-nombre">{usuario?.name}</span>
            <span className="navbar-perfil">{ETIQUETA_PERFIL[usuario?.role] ?? usuario?.perfil}</span>
          </div>
          <button type="button" className="navbar-salir" onClick={cerrarSesion}>
            <IconoSalir />
            <span>Salir</span>
          </button>
        </div>

        <div className="navbar-marca-secundaria">
          <img src="/marcas/logo-gra.png" alt="Gobierno Regional de Arequipa" className="navbar-logo-gra" />
        </div>

        <div className="navbar-movil">
          <div className="navbar-movil-usuario">
            <IconoLibro size={16} />
            <span>{usuario?.name}</span>
          </div>
          <button type="button" className="navbar-salir" onClick={cerrarSesion} aria-label="Cerrar sesión">
            <IconoSalir />
          </button>
        </div>
      </header>

      <nav className="navbar-movil-menu" aria-label="Secciones principales">
        {enlaces.map((enlace) => (
          <NavLink key={enlace.to} to={enlace.to} className={claseEnlace}>
            {enlace.icono}
            <span>{enlace.etiqueta}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
