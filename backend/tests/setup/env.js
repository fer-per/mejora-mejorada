import 'dotenv/config';

process.env.NODE_ENV = 'test';

process.env.DB_NAME = process.env.DB_NAME_TEST ?? 'siarc_db_test';
process.env.JWT_SECRET = 'secreto-de-pruebas-siarc-ara-2026';
process.env.JWT_EXPIRA_EN = '1h';

process.env.BLOQUEO_INTENTOS = process.env.BLOQUEO_INTENTOS ?? '5';
process.env.BLOQUEO_MINUTOS = process.env.BLOQUEO_MINUTOS ?? '15';

process.env.ALMACENAMIENTO = 'local';
process.env.R2_PREFIX = '';
process.env.RUTA_REPOSITORIO = process.env.RUTA_REPOSITORIO ?? '../storage/repositorio';
process.env.CORS_ORIGIN = 'http://localhost:5173';
