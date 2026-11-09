import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const esquemaEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DB_HOST: z.string().min(1).default('localhost'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: z.string().min(1).default('siarc_db'),
    DB_SCHEMA: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'DB_SCHEMA debe ser un identificador válido')
      .default('public'),
    DB_USER: z.string().min(1).default('postgres'),
    DB_PASSWORD: z.string().default(''),
    DB_SSL: z
      .string()
      .default('false')
      .transform((valor) => ['true', '1', 'si', 'yes'].includes(valor.toLowerCase())),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
    JWT_EXPIRA_EN: z.string().default('8h'),
    BLOQUEO_INTENTOS: z.coerce.number().int().positive().default(5),
    BLOQUEO_MINUTOS: z.coerce.number().int().positive().default(15),
    INGESTA_MAX_MB: z.coerce.number().int().positive().default(50),
    RUTA_REPOSITORIO: z.string().default('../storage/repositorio'),
    RUTA_FRONTEND: z.string().default('../frontend/dist'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    // Repositorio digital: 'local' (disco) o 'r2' (Cloudflare R2, compatible con S3).
    ALMACENAMIENTO: z.enum(['local', 'r2']).default('local'),
    R2_ACCOUNT_ID: z.string().default(''),
    R2_ENDPOINT: z.string().default(''),
    R2_ACCESS_KEY_ID: z.string().default(''),
    R2_SECRET_ACCESS_KEY: z.string().default(''),
    R2_BUCKET: z.string().default(''),
    R2_PREFIX: z.string().default(''),
  })
  .superRefine((valor, ctx) => {
    if (valor.ALMACENAMIENTO !== 'r2') {
      return;
    }
    for (const clave of ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']) {
      if (!valor[clave]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [clave],
          message: `${clave} es obligatorio cuando ALMACENAMIENTO=r2`,
        });
      }
    }
    if (!valor.R2_ENDPOINT && !valor.R2_ACCOUNT_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['R2_ENDPOINT'],
        message: 'Configure R2_ENDPOINT o R2_ACCOUNT_ID cuando ALMACENAMIENTO=r2',
      });
    }
  });

const resultado = esquemaEnv.safeParse(process.env);

if (!resultado.success) {
  const detalles = resultado.error.issues.map((i) => ` - ${i.path.join('.')}: ${i.message}`);
  console.error('[siarc-ara] Configuración inválida:\n' + detalles.join('\n'));
  process.exit(1);
}

const env = resultado.data;

export const config = {
  entorno: env.NODE_ENV,
  esProduccion: env.NODE_ENV === 'production',
  puerto: env.PORT,
  baseDeDatos: {
    host: env.DB_HOST,
    puerto: env.DB_PORT,
    base: env.DB_NAME,
    esquema: env.DB_SCHEMA,
    usuario: env.DB_USER,
    contrasena: env.DB_PASSWORD,
    ssl: env.DB_SSL,
  },
  jwt: {
    secreto: env.JWT_SECRET,
    expiraEn: env.JWT_EXPIRA_EN,
  },
  bloqueo: {
    intentosMaximos: env.BLOQUEO_INTENTOS,
    minutosBloqueo: env.BLOQUEO_MINUTOS,
  },
  ingesta: {
    maxBytes: env.INGESTA_MAX_MB * 1024 * 1024,
  },
  rutas: {
    repositorio: path.resolve(process.cwd(), env.RUTA_REPOSITORIO),
    frontend: path.resolve(process.cwd(), env.RUTA_FRONTEND),
  },
  almacenamiento: {
    tipo: env.ALMACENAMIENTO,
    remoto: env.ALMACENAMIENTO === 'r2',
    endpoint: env.R2_ENDPOINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    prefijo: env.R2_PREFIX.replace(/^\/+|\/+$/g, ''),
  },
  corsOrigen: env.CORS_ORIGIN,
};

export default config;
