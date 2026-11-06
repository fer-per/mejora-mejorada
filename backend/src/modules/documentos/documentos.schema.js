import { z } from 'zod';

const esquemaPagina = z.coerce.number().int().min(1, 'Página inválida').default(1);
const esquemaPorPagina = z.coerce.number().int().min(1).max(50, 'Máximo 50 resultados por página').default(10);
const esquemaOrden = z.enum(['relevancia', 'fecha', 'antiguo', 'titulo'], {
  errorMap: () => ({ message: 'El orden debe ser "relevancia", "fecha", "antiguo" o "titulo"' }),
}).default('relevancia');
const esquemaFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use el formato AAAA-MM-DD');

const aIndefinido = (valor) => {
  if (valor === undefined || valor === null) return undefined;
  return String(valor).trim() === '' ? undefined : valor;
};

export const esquemaId = z.object({
  id: z.coerce.number().int().positive('Identificador inválido'),
});

export const esquemaBusquedaSimple = z.object({
  q: z
    .string({ required_error: 'Ingrese una palabra clave' })
    .trim()
    .min(1, 'Ingrese una palabra clave')
    .max(200, 'La consulta no puede exceder 200 caracteres'),
  pagina: esquemaPagina,
  por_pagina: esquemaPorPagina,
  orden: esquemaOrden,
});

export const esquemaBusquedaAvanzada = z
  .object({
    texto: z.preprocess(aIndefinido, z.string().trim().max(200, 'El texto no puede exceder 200 caracteres').optional()),
    fondo: z.preprocess(aIndefinido, z.coerce.number().int().positive().optional()),
    serie: z.preprocess(aIndefinido, z.string().trim().max(150).optional()),
    tipologia: z.preprocess(aIndefinido, z.string().trim().max(100).optional()),
    conservacion: z.preprocess(aIndefinido, z.enum(['Bueno', 'Regular', 'Malo']).optional()),
    fecha_desde: z.preprocess(aIndefinido, esquemaFecha.optional()),
    fecha_hasta: z.preprocess(aIndefinido, esquemaFecha.optional()),
    pagina: esquemaPagina,
    por_pagina: esquemaPorPagina,
    orden: esquemaOrden,
  })
  .superRefine((datos, contexto) => {
    const criterios = [
      datos.texto,
      datos.fondo,
      datos.serie,
      datos.tipologia,
      datos.conservacion,
      datos.fecha_desde,
      datos.fecha_hasta,
    ];
    if (!criterios.some((criterio) => criterio !== undefined)) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['texto'],
        message: 'Ingrese al menos un criterio de búsqueda',
      });
    }
    if (datos.fecha_desde && datos.fecha_hasta && datos.fecha_desde > datos.fecha_hasta) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fecha_hasta'],
        message: 'La fecha inicial no puede ser posterior a la fecha final',
      });
    }
  });
