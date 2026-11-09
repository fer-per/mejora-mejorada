import { z } from 'zod';
import { esquemaFecha } from '../../common/fechas.js';

const esquemaPagina = z.coerce.number().int().min(1, 'Página inválida').default(1);
const esquemaPorPagina = z.coerce.number().int().min(1).max(50, 'Máximo 50 resultados por página').default(10);
const esquemaOrden = z.enum(['relevancia', 'fecha', 'antiguo', 'titulo'], {
  errorMap: () => ({ message: 'El orden debe ser "relevancia", "fecha", "antiguo" o "titulo"' }),
}).default('relevancia');

const aIndefinido = (valor) => {
  if (valor === undefined || valor === null) return undefined;
  return String(valor).trim() === '' ? undefined : valor;
};

const aNulo = (valor) => {
  if (valor === undefined || valor === null) return valor;
  return String(valor).trim() === '' ? null : valor;
};

const textoOpcional = (maximo, mensaje) =>
  z.preprocess(aNulo, z.string().trim().max(maximo, mensaje).nullable().optional());

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

export const esquemaInteresado = z.object({
  nombre: z.string({ required_error: 'El nombre del interesado es obligatorio' }).trim().min(1, 'Ingrese el nombre del interesado').max(200),
  documento: z.preprocess(aNulo, z.string().trim().max(20, 'El documento no puede exceder 20 caracteres').nullable().optional()),
  rol: z.string({ required_error: 'El rol del interesado es obligatorio' }).trim().min(1, 'Ingrese el rol del interesado').max(50),
});

export const esquemaActualizarDocumento = z
  .object({
    titulo: z.preprocess(
      aIndefinido,
      z.string().trim().min(1, 'Ingrese el título').max(300, 'El título no puede exceder 300 caracteres').optional(),
    ),
    tipologia: z.preprocess(
      aIndefinido,
      z.string().trim().min(1, 'Ingrese la tipología').max(100).optional(),
    ),
    serie: textoOpcional(150),
    subserie: textoOpcional(150),
    folios: z.preprocess(aNulo, z.coerce.number().int().positive('Los folios deben ser mayores que cero').nullable().optional()),
    formato: z.preprocess(aIndefinido, z.enum(['TIFF', 'PDF/A']).optional()),
    estado_conservacion: z.preprocess(aIndefinido, z.enum(['Bueno', 'Regular', 'Malo']).optional()),
    alcance_contenido: textoOpcional(5000),
    descriptores: textoOpcional(2000),
    fecha_produccion: z.preprocess(aNulo, esquemaFecha.nullable().optional()),
    observaciones: textoOpcional(2000),
    ubicacion_fisica: textoOpcional(150),
    interesados: z.array(esquemaInteresado).max(50, 'No se pueden registrar más de 50 interesados').optional(),
  })
  .superRefine((datos, contexto) => {
    const tieneCambios = Object.values(datos).some((valor) => valor !== undefined);
    if (!tieneCambios) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Envíe al menos un campo para actualizar',
      });
    }
  });

const parsearJson = (valor) => {
  if (typeof valor !== 'string') return valor;
  const limpio = valor.trim();
  if (!limpio) return undefined;
  try {
    return JSON.parse(limpio);
  } catch {
    return valor;
  }
};

export const esquemaIngestaDocumento = z
  .object({
    id_fondo: z.coerce.number().int().positive('Seleccione un fondo válido'),
    protocolo: z.string({ required_error: 'El protocolo es obligatorio' }).trim().min(1, 'Ingrese el protocolo').max(50),
    anio: z.coerce.number().int().min(1500, 'Año inválido').max(2100, 'Año inválido'),
    registro: z.string({ required_error: 'El registro es obligatorio' }).trim().min(1, 'Ingrese el registro').max(50),
    titulo: z.preprocess(
      aIndefinido,
      z.string().trim().min(1, 'Ingrese el título').max(300, 'El título no puede exceder 300 caracteres').optional(),
    ),
    mes: z.preprocess(aNulo, z.coerce.number().int().min(1).max(12).nullable().optional()),
    id_responsable_descripcion: z.preprocess(
      aNulo,
      z.coerce.number().int().positive().nullable().optional(),
    ),
    tipologia: z.string({ required_error: 'La tipología es obligatoria' }).trim().min(1, 'Ingrese la tipología').max(100),
    serie: textoOpcional(150),
    subserie: textoOpcional(150),
    folios: z.preprocess(aNulo, z.coerce.number().int().positive('Los folios deben ser mayores que cero').nullable().optional()),
    estado_conservacion: z.preprocess(aIndefinido, z.enum(['Bueno', 'Regular', 'Malo']).optional()),
    alcance_contenido: textoOpcional(5000),
    descriptores: textoOpcional(2000),
    fecha_produccion: z.preprocess(aNulo, esquemaFecha.nullable().optional()),
    observaciones: textoOpcional(2000),
    ubicacion_fisica: textoOpcional(150),
    interesados: z.preprocess(parsearJson, z.array(esquemaInteresado).max(50, 'No se pueden registrar más de 50 interesados').optional()),
  })
  .transform((datos) => ({ ...datos, estado_conservacion: datos.estado_conservacion ?? 'Bueno' }));
