import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const BusquedaPage = lazy(() => import('./pages/BusquedaPage.jsx'));
const IngestaPage = lazy(() => import('./pages/IngestaPage.jsx'));
const UsuariosPage = lazy(() => import('./pages/UsuariosPage.jsx'));
const AuditoriaPage = lazy(() => import('./pages/AuditoriaPage.jsx'));
const GestionPage = lazy(() => import('./pages/GestionPage.jsx'));

function RutaPrivada({ children }) {
  const { usuario } = useAuth();
  return usuario ? children : <Navigate to="/login" replace />;
}

function RutaPorPerfil({ perfiles, children }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return perfiles.includes(usuario.role) ? children : <Navigate to="/busqueda" replace />;
}

function Inicio() {
  const { usuario } = useAuth();
  return <Navigate to={usuario ? '/busqueda' : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="text-center text-muted py-5" role="status">
              Cargando interfaz...
            </div>
          }
        >
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/busqueda"
            element={
              <RutaPrivada>
                <BusquedaPage />
              </RutaPrivada>
            }
          />
          <Route
            path="/gestion"
            element={
              <RutaPorPerfil perfiles={['admin', 'archivero']}>
                <GestionPage />
              </RutaPorPerfil>
            }
          />
          <Route
            path="/ingesta"
            element={
              <RutaPorPerfil perfiles={['admin', 'archivero']}>
                <IngestaPage />
              </RutaPorPerfil>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RutaPorPerfil perfiles={['admin']}>
                <UsuariosPage />
              </RutaPorPerfil>
            }
          />
          <Route
            path="/auditoria"
            element={
              <RutaPorPerfil perfiles={['admin']}>
                <AuditoriaPage />
              </RutaPorPerfil>
            }
          />
          <Route path="/" element={<Inicio />} />
          <Route path="*" element={<Inicio />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
