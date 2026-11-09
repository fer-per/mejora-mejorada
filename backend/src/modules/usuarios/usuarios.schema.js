import { z } from 'zod';

const aIndefinido = (valor) => {
  if (valor === undefined || valor === null) return undefined;
  return String(valor).trim() === '' ? undefined : valor;
};

const nombres = z
  .string({ required_error: 'Los nombres son obligatorios' })
  .trim()
  .min(1, 'Ingrese los nombres')
  .max(100, 'Los nombres no pueden exceder 100 caracteres');

const apellidos = z
  .string({ required_error: 'Los apellidos son obligatorios' })
  .trim()
  .min(1, 'Ingrese los apellidos')
  .max(100, 'Los apellidos no pueden exceder 100 caracteres');

const correo = z
  .string({ required_error: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .email('Ingrese un correo electrónico válido')
  .max(150, 'El correo no puede exceder 150 caracteres');

const nombreUsuario = z
  .string({ required_error: 'El nombre de usuario es obligatorio' })
  .trim()
  .toLowerCase()
  .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
  .max(50, 'El nombre de usuario no puede exceder 50 caracteres')
  .regex(/^[a-z0-9._-]+$/, 'Use solo letras, números, punto, guion o guion bajo');

const perfil = z.enum(['ADMINISTRADOR', 'ARCHIVISTA', 'USUARIO_EXTERNO'], {
  errorMap: () => ({ message: 'El perfil debe ser ADMINISTRADOR, ARCHIVISTA o USUARIO_EXTERNO' }),
});

const estado = z.enum(['ACTIVO', 'INACTIVO'], {
  errorMap: () => ({ message: 'El estado debe ser ACTIVO o INACTIVO' }),
});

const contrasena = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña no puede exceder 128 caracteres');

export const esquemaCrearUsuario = z.object({
  nombres,
  apellidos,
  correo,
  nombre_usuario: nombreUsuario,
  contrasena,
  perfil,
  estado: estado.default('ACTIVO'),
});

export const esquemaActualizarUsuario = z
  .object({
    nombres: z.preprocess(aIndefinido, nombres.optional()),
    apellidos: z.preprocess(aIndefinido, apellidos.optional()),
    correo: z.preprocess(aIndefinido, correo.optional()),
    nombre_usuario: z.preprocess(aIndefinido, nombreUsuario.optional()),
    contrasena: z.preprocess(aIndefinido, contrasena.optional()),
    perfil: z.preprocess(aIndefinido, perfil.optional()),
    estado: z.preprocess(aIndefinido, estado.optional()),
  })
  .superRefine((datos, contexto) => {
    if (!Object.values(datos).some((valor) => valor !== undefined)) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Envíe al menos un campo para actualizar',
      });
    }
  });

export const esquemaEstadoUsuario = z.object({
  estado,
});

export const esquemaListaUsuarios = z.object({
  q: z.preprocess(aIndefinido, z.string().trim().max(150).optional()),
  perfil: z.preprocess(aIndefinido, perfil.optional()),
  estado: z.preprocess(aIndefinido, estado.optional()),
  pagina: z.coerce.number().int().min(1).default(1),
  por_pagina: z.coerce.number().int().min(1).max(100, 'Máximo 100 usuarios por página').default(20),
});

export const esquemaIdUsuario = z.object({
  id: z.coerce.number().int().positive('Identificador inválido'),
});
