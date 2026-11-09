import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import BusquedaPage from './pages/BusquedaPage.jsx';
import IngestaPage from './pages/IngestaPage.jsx';
import UsuariosPage from './pages/UsuariosPage.jsx';
import AuditoriaPage from './pages/AuditoriaPage.jsx';

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
              <RutaPorPerfil perfiles={['admin', 'archivero']}>
                <AuditoriaPage />
              </RutaPorPerfil>
            }
          />
          <Route path="/" element={<Inicio />} />
          <Route path="*" element={<Inicio />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
