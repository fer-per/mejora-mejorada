import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  iniciarSesion as iniciarSesionApi,
  cerrarSesion as cerrarSesionApi,
  validarSesion,
  guardarSesion,
  leerUsuario,
  limpiarSesion,
  EVENTO_SESION,
} from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leerUsuario);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  useEffect(() => {
    let activo = true;
    validarSesion()
      .then((datos) => {
        if (!activo) return;
        setUsuario(datos);
        guardarSesion(datos);
      })
      .catch(() => {
        if (activo) setUsuario(null);
      })
      .finally(() => {
        if (activo) setCargandoSesion(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    const alExpirar = () => setUsuario(null);
    window.addEventListener(EVENTO_SESION, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION, alExpirar);
  }, []);

  const iniciarSesion = useCallback(async (username, password) => {
    const user = await iniciarSesionApi(username, password);
    guardarSesion(user);
    setUsuario(user);
    return user;
  }, []);

  const cerrarSesion = useCallback(async () => {
    await cerrarSesionApi();
    limpiarSesion();
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargandoSesion, iniciarSesion, cerrarSesion }),
    [usuario, cargandoSesion, iniciarSesion, cerrarSesion],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return contexto;
}
