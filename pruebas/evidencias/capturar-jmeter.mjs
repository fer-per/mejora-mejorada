import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA_REPORTE =
  process.env.JMETER_REPORT ??
  path.resolve(AQUI, '..', 'jmeter', 'resultados', 'ren-03', 'index.html');

const RUTAS_CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function buscarNavegador() {
  const encontrada = RUTAS_CHROME.find((ruta) => fs.existsSync(ruta));
  if (!encontrada) {
    throw new Error(
      'No se encontro Chrome ni Edge. Defina CHROME_PATH con la ruta del ejecutable.',
    );
  }
  return encontrada;
}

async function capturarPagina(page, archivo, nombre) {
  const destino = path.join(AQUI, nombre);
  const url = pathToFileURL(archivo).href;
  console.log(`Abriendo ${url}`);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: destino, fullPage: true });
  console.log(`Captura: ${destino}`);
}

if (!fs.existsSync(RUTA_REPORTE)) {
  console.error(`No existe el reporte JMeter: ${RUTA_REPORTE}`);
  console.error(
    'Genere el reporte con: jmeter -n -t pruebas/jmeter/siarc-carga.jmx -l pruebas/jmeter/resultados/ren-03.jtl -e -o pruebas/jmeter/resultados/ren-03',
  );
  process.exit(1);
}

const carpeta = path.dirname(RUTA_REPORTE);
const navegador = await chromium.launch({
  executablePath: buscarNavegador(),
  headless: process.env.HEADED !== '1',
});
const contexto = await navegador.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await contexto.newPage();

try {
  await capturarPagina(page, RUTA_REPORTE, 'fig-iv-06-jmeter.png');

  const estadisticas = path.join(carpeta, 'statistics.html');
  if (fs.existsSync(estadisticas)) {
    await capturarPagina(page, estadisticas, 'fig-iv-06b-jmeter-estadisticas.png');
  } else {
    const tabla = page.locator('#statisticsTable');
    if ((await tabla.count()) > 0) {
      const destino = path.join(AQUI, 'fig-iv-06b-jmeter-estadisticas.png');
      await tabla.screenshot({ path: destino });
      console.log(`Captura: ${destino}`);
    }
  }

  const candidatosGrafico = [
    'content/pages/OverTime.html',
    'content/pages/ResponseTimes.html',
    'content/pages/Throughput.html',
  ];
  const grafico = candidatosGrafico
    .map((relativa) => path.join(carpeta, relativa))
    .find((ruta) => fs.existsSync(ruta));
  if (grafico) {
    await capturarPagina(page, grafico, 'fig-iv-10-jmeter-grafico.png');
  } else {
    console.warn('No se encontro un grafico de tiempos de respuesta en el reporte.');
  }

  console.log('Capturas de JMeter completadas.');
} catch (error) {
  console.error(`Error al capturar JMeter: ${error.message}`);
  process.exitCode = 1;
} finally {
  await contexto.close();
  await navegador.close();
}
