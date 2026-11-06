import { afterAll, beforeEach } from 'vitest';
import { reiniciarLimiteIntentos } from '../../src/middlewares/rate-limit.js';
import { cerrarPool } from '../../src/config/database.js';

beforeEach(() => {
  reiniciarLimiteIntentos();
});

afterAll(async () => {
  await cerrarPool();
});
