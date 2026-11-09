import { z } from 'zod';

export function esFechaCalendario(valor) {
  const [anio, mes, dia] = valor.split('-').map(Number);
  if (mes < 1 || mes > 12) return false;
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  const diasPorMes = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia >= 1 && dia <= diasPorMes[mes - 1];
}

export const esquemaFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use el formato AAAA-MM-DD')
  .refine(esFechaCalendario, 'La fecha indicada no existe en el calendario');
