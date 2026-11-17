import { useCallback, useEffect, useState } from 'react';
import { listarEstructura } from '../../../services/gestionApi.js';

export function useEstructuraGestion({ tipo, q }) {
  const [estructura, setEstructura] = useState({ total: 0, items: [] });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  const recargar = useCallback(() => setRecarga((valor) => valor + 1), []);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    listarEstructura(tipo, { q, porPagina: 200 })
      .then((respuesta) => {
        if (activo) setEstructura(respuesta ?? { total: 0, items: [] });
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
  }, [tipo, q, recarga]);

  return { estructura, cargando, error, recargar };
}
