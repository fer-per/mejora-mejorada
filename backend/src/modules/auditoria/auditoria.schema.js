import { z } from 'zod';
import { esquemaFecha } from '../../common/fechas.js';

const aIndefinido = (valor) => {
  if (valor === undefined || valor === null) return undefined;
  return String(valor).trim() === '' ? undefined : valor;
};

export const esquemaListaAuditoria = z
  .object({
    tipo_accion: z.preprocess(aIndefinido, z.string().trim().max(40).optional()),
    id_usuario: z.preprocess(aIndefinido, z.coerce.number().int().positive().optional()),
    desde: z.preprocess(aIndefinido, esquemaFecha.optional()),
    hasta: z.preprocess(aIndefinido, esquemaFecha.optional()),
    pagina: z.coerce.number().int().min(1).default(1),
    por_pagina: z.coerce.number().int().min(1).max(100, 'Máximo 100 registros por página').default(20),
  })
  .superRefine((datos, contexto) => {
    if (datos.desde && datos.hasta && datos.desde > datos.hasta) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hasta'],
        message: 'La fecha inicial no puede ser posterior a la fecha final',
      });
    }
  });

export const esquemaIdAccion = z.object({
  id: z.coerce.number().int().positive('Identificador inválido'),
});
