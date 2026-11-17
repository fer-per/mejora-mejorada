import { z } from 'zod';
import { esquemaFecha } from '../../common/fechas.js';

export const TIPOS_ESTRUCTURA = [
  'repositorios',
  'fondos',
  'escribanos',
  'protocolos',
  'anios',
  'registros',
  'titulos',
];

export const TIPOS_FUSION = ['fondos', 'escribanos', 'protocolos', 'anios', 'registros'];

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

const aBooleano = (valor) => valor === true || valor === 'true' || valor === 1 || valor === '1';

const version = z.preprocess(aNulo, z.string().trim().max(40).nullable().optional());

const idPositivo = z.coerce.number().int().positive('Identificador inválido');

export const esquemaTipoEstructura = z.object({
  tipo: z.enum(TIPOS_ESTRUCTURA),
});

export const esquemaTipoFusion = z.object({
  tipo: z.enum(TIPOS_FUSION),
});

export const esquemaId = z.object({
  id: idPositivo,
});

export const esquemaListadoEstructura = z.object({
  q: z.preprocess(aIndefinido, z.string().trim().max(200).optional()),
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(200).default(50),
});

export const ESQUEMAS_ESTRUCTURA = {
  repositorios: z
    .object({
      siglo: z.preprocess(aIndefinido, z.coerce.number().int().min(1500).max(2100).optional()),
      numero: z.preprocess(aIndefinido, z.string().trim().max(20).optional()),
      version,
    })
    .superRefine((datos, contexto) => {
      if (datos.siglo === undefined && datos.numero === undefined) {
        contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Envíe al menos un campo para actualizar' });
      }
    }),
  fondos: z
    .object({
      id_repositorio: z.preprocess(aIndefinido, idPositivo.optional()),
      denominacion: z.preprocess(aIndefinido, z.string().trim().min(1).max(200).optional()),
      descripcion: textoOpcional(2000),
      version,
    })
    .superRefine((datos, contexto) => {
      if (datos.id_repositorio === undefined && datos.denominacion === undefined && datos.descripcion === undefined) {
        contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Envíe al menos un campo para actualizar' });
      }
    }),
  escribanos: z
    .object({
      id_fondo: z.preprocess(aIndefinido, idPositivo.optional()),
      nombre_completo: z.preprocess(aIndefinido, z.string().trim().min(1).max(200).optional()),
      periodo_ejercicio: textoOpcional(100),
      seccion: textoOpcional(100),
      version,
    })
    .superRefine((datos, contexto) => {
      if (
        datos.id_fondo === undefined &&
        datos.nombre_completo === undefined &&
        datos.periodo_ejercicio === undefined &&
        datos.seccion === undefined
      ) {
        contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Envíe al menos un campo para actualizar' });
      }
    }),
  protocolos: z
    .object({
      id_fondo: z.preprocess(aIndefinido, idPositivo.optional()),
      id_escribano: z.preprocess(aNulo, idPositivo.nullable().optional()),
      numero: z.preprocess(aIndefinido, z.string().trim().min(1).max(50).optional()),
      version,
    })
    .superRefine((datos, contexto) => {
      if (
        datos.id_fondo === undefined &&
        datos.id_escribano === undefined &&
        datos.numero === undefined
      ) {
        contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Envíe al menos un campo para actualizar' });
      }
    }),
  anios: z
    .object({
      id_protocolo: z.preprocess(aIndefinido, idPositivo.optional()),
      anio: z.preprocess(aIndefinido, z.coerce.number().int().min(1500).max(2100).optional()),
      version,
    })
    .superRefine((datos, contexto) => {
      if (datos.id_protocolo === undefined && datos.anio === undefined) {
        contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Envíe al menos un campo para actualizar' });
      }
    }),
  registros: z
    .object({
      id_anio_protocolo: z.preprocess(aIndefinido, idPositivo.optional()),
      numero: z.preprocess(aIndefinido, z.string().trim().min(1).max(50).optional()),
      version,
    })
    .superRefine((datos, contexto) => {
      if (datos.id_anio_protocolo === undefined && datos.numero === undefined) {
        contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Envíe al menos un campo para actualizar' });
      }
    }),
  titulos: z
    .object({
      id_registro: z.preprocess(aIndefinido, idPositivo.optional()),
      nombre: z.preprocess(aIndefinido, z.string().trim().min(1).max(300).optional()),
      mes: z.preprocess(aNulo, z.coerce.number().int().min(1).max(12).nullable().optional()),
      version,
    })
    .superRefine((datos, contexto) => {
      if (datos.id_registro === undefined && datos.nombre === undefined && datos.mes === undefined) {
        contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Envíe al menos un campo para actualizar' });
      }
    }),
};

export const esquemaFusion = z.object({
  origen: idPositivo,
  destino: idPositivo,
  version_origen: version,
  version_destino: version,
});

export const esquemaEdicionMasiva = z
  .object({
    ids: z
      .array(idPositivo)
      .min(1, 'Seleccione al menos un documento')
      .max(500, 'No se pueden editar más de 500 documentos por operación'),
    cambios: z
      .object({
        estado_conservacion: z.preprocess(aIndefinido, z.enum(['Bueno', 'Regular', 'Malo']).optional()),
        tipologia: z.preprocess(aIndefinido, z.string().trim().min(1).max(100).optional()),
        serie: textoOpcional(150),
        subserie: textoOpcional(150),
        ubicacion_fisica: textoOpcional(150),
        observaciones: textoOpcional(2000),
      })
      .superRefine((datos, contexto) => {
        if (!Object.values(datos).some((valor) => valor !== undefined)) {
          contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Seleccione al menos un campo a modificar' });
        }
      }),
  })
  .refine((datos) => new Set(datos.ids).size === datos.ids.length, {
    message: 'La selección contiene documentos repetidos',
    path: ['ids'],
  });

export const esquemaBusquedaGestion = z.object({
  texto: z.preprocess(aIndefinido, z.string().trim().max(200).optional()),
  fondo: z.preprocess(aIndefinido, z.coerce.number().int().positive().optional()),
  serie: z.preprocess(aIndefinido, z.string().trim().max(150).optional()),
  tipologia: z.preprocess(aIndefinido, z.string().trim().max(100).optional()),
  conservacion: z.preprocess(aIndefinido, z.enum(['Bueno', 'Regular', 'Malo']).optional()),
  fecha_desde: z.preprocess(aIndefinido, esquemaFecha.optional()),
  fecha_hasta: z.preprocess(aIndefinido, esquemaFecha.optional()),
  incluir_anulados: z.preprocess(aBooleano, z.boolean().default(false)),
  solo_anulados: z.preprocess(aBooleano, z.boolean().default(false)),
  orden: z.enum(['relevancia', 'fecha', 'antiguo', 'titulo']).default('fecha'),
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(100).default(20),
});

export const esquemaOperaciones = z.object({
  tipo_operacion: z.preprocess(aIndefinido, z.string().trim().max(40).optional()),
  id_usuario: z.preprocess(aIndefinido, z.coerce.number().int().positive().optional()),
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(100).default(20),
});

export const esquemaHistorial = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(100).default(20),
});

export const esquemaRevertirOperacion = z.object({
  forzar: z.preprocess(aBooleano, z.boolean().default(false)),
});
