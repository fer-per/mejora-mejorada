import { useEffect, useState } from 'react';
import { obtenerResumenGestion } from '../../../services/gestionApi.js';

export function useResumenGestion(version) {
  const [resumen, setResumen] = useState(null);

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

  return resumen;
}
