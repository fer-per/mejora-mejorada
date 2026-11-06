import 'dotenv/config';

process.env.DB_NAME = process.env.DB_NAME_TEST ?? 'siarc_db_test';

const { reiniciarBaseDeDatos } = await import('./db.js');

try {
  await reiniciarBaseDeDatos();
  console.log(`[pruebas] Base de datos "${process.env.DB_NAME}" recreada con esquema y datos semilla.`);
} catch (error) {
  console.error('[pruebas] No se pudo preparar la base de datos de prueba:', error.message);
  process.exit(1);
}
