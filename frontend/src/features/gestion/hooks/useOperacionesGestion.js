import { useCallback, useEffect, useState } from 'react';
import { listarOperacionesGestion } from '../../../services/gestionApi.js';

export function useOperacionesGestion({ tipoOperacion, pagina }) {
  const [operaciones, setOperaciones] = useState({ total: 0, resultados: [] });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  const recargar = useCallback(() => setRecarga((valor) => valor + 1), []);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    listarOperacionesGestion({ tipoOperacion, pagina, porPagina: 20 })
      .then((respuesta) => {
        if (activo) setOperaciones(respuesta);
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
  }, [tipoOperacion, pagina, recarga]);

  return { operaciones, cargando, error, recargar };
}
