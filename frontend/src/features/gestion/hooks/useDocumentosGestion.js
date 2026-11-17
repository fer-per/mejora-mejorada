import { useCallback, useEffect, useState } from 'react';
import { listarDocumentosGestion } from '../../../services/gestionApi.js';

const DATOS_INICIALES = {
  total: 0,
  pagina: 1,
  porPagina: 15,
  paginas: 0,
  resultados: [],
};

export function useDocumentosGestion({ filtros, pagina, porPagina = 15 }) {
  const [datos, setDatos] = useState(DATOS_INICIALES);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  const recargar = useCallback(() => setRecarga((valor) => valor + 1), []);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    listarDocumentosGestion({
      texto: filtros.texto,
      conservacion: filtros.conservacion,
      solo_anulados: filtros.estado === 'anulados',
      incluir_anulados: filtros.estado === 'todos',
      orden: filtros.orden,
      pagina,
      por_pagina: porPagina,
    })
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
  }, [filtros, pagina, porPagina, recarga]);

  return { datos, cargando, error, recargar };
}
