import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const RUTA_DIST = path.join(RAIZ, 'frontend', 'dist');

dotenv.config({ path: path.join(RAIZ, 'backend', '.env') });

const secretos = [
  ['JWT_SECRET', process.env.JWT_SECRET],
  ['DB_PASSWORD', process.env.DB_PASSWORD],
  ['R2_SECRET_ACCESS_KEY', process.env.R2_SECRET_ACCESS_KEY],
].filter(([, valor]) => typeof valor === 'string' && valor.length >= 4);

const EXTENSIONES_TEXTO = new Set([
  '.js', '.mjs', '.cjs', '.css', '.html', '.json', '.map', '.txt', '.svg',
]);

async function listarArchivos(directorio) {
  const entradas = await fs.readdir(directorio, { withFileTypes: true });
  const archivos = [];
  for (const entrada of entradas) {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      archivos.push(...(await listarArchivos(ruta)));
    } else if (EXTENSIONES_TEXTO.has(path.extname(entrada.name).toLowerCase())) {
      archivos.push(ruta);
    }
  }
  return archivos;
}

try {
  await fs.access(path.join(RUTA_DIST, 'index.html'));
} catch {
  console.log('[SEG-07] Omitido: no existe frontend/dist. Ejecute "npm run build" en frontend/ primero.');
  process.exit(0);
}

const archivos = await listarArchivos(RUTA_DIST);
const hallazgos = [];

for (const archivo of archivos) {
  const contenido = await fs.readFile(archivo, 'utf8');
  for (const [nombre, valor] of secretos) {
    if (contenido.includes(valor)) {
      hallazgos.push({ archivo, nombre });
    }
  }
}

if (hallazgos.length === 0) {
  console.log(`[SEG-07] Correcto: ningún secreto (${secretos.map(([n]) => n).join(', ') || 'sin variables'}) aparece en frontend/dist (${archivos.length} archivos revisados).`);
  process.exit(0);
}

console.error('[SEG-07] Fallo: se encontraron secretos en la compilación del frontend:');
for (const hallazgo of hallazgos) {
  console.error(` - ${hallazgo.nombre} en ${path.relative(RAIZ, hallazgo.archivo)}`);
}
process.exit(1);
