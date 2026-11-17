import { useCallback, useEffect, useState } from 'react';
import { listarDuplicados } from '../../../services/gestionApi.js';

export function useDuplicadosGestion() {
  const [duplicados, setDuplicados] = useState(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  const recargar = useCallback(() => setRecarga((valor) => valor + 1), []);

  useEffect(() => {
    let activo = true;
    setError('');
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
  }, [recarga]);

  return { duplicados, error, recargar };
}
