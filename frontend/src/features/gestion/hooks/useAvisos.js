import { useCallback, useState } from 'react';

export function useAvisos() {
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const limpiar = useCallback(() => {
    setError('');
    setExito('');
  }, []);

  const mostrarError = useCallback((mensaje) => {
    setExito('');
    setError(mensaje);
  }, []);

  const mostrarExito = useCallback((mensaje) => {
    setError('');
    setExito(mensaje);
  }, []);

  return { error, exito, setError: mostrarError, setExito: mostrarExito, limpiar };
}
