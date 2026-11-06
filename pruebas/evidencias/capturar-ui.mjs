import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const USUARIO = process.env.UI_USUARIO ?? 'anaquispe';
const CONTRASENA = process.env.UI_CONTRASENA ?? 'Admin123!';
const CONSULTA = process.env.UI_CONSULTA ?? 'aguas';

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

async function capturar(page, nombre, { fullPage = false } = {}) {
  const destino = path.join(AQUI, nombre);
  await page.screenshot({ path: destino, fullPage });
  console.log(`Captura: ${destino}`);
}

const navegador = await chromium.launch({
  executablePath: buscarNavegador(),
  headless: process.env.HEADED !== '1',
});

const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'es-PE',
});

const page = await contexto.newPage();
page.setDefaultTimeout(30000);

try {
  console.log(`Abriendo ${BASE_URL}/login`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#usuario');
  await page.waitForTimeout(700);
  await capturar(page, 'fig-iv-07-ui-login.png');

  if (process.env.SOLO_LOGIN === '1') {
    console.log('Captura de login completada (modo SOLO_LOGIN).');
    await contexto.close();
    await navegador.close();
    process.exit(0);
  }

  await page.fill('#usuario', USUARIO);
  await page.fill('#contrasena', CONTRASENA);
  await page.click('form button[type="submit"]');
  await page.waitForURL('**/busqueda', { timeout: 30000 });
  await page.waitForSelector('.panel-busqueda');
  await page.waitForTimeout(1200);

  await page.fill('input[type="search"]', CONSULTA);
  await page.click('form.buscador-simple button[type="submit"]');
  await page.waitForSelector('.tarjeta-documento, .estado-resultados h3');
  await page.waitForSelector('form.buscador-simple button[type="submit"]:not([disabled])');
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(1200);

  const encontrados = await page.locator('.tarjeta-documento').count();
  console.log(`Documentos encontrados para "${CONSULTA}": ${encontrados}`);
  await capturar(page, 'fig-iv-08-ui-busqueda.png', { fullPage: true });

  if (encontrados > 0) {
    await page.locator('.tarjeta-documento').first().click();
    await page.waitForSelector('.panel-detalle-titulo');
    await page.waitForSelector('.panel-imagen-visor', { timeout: 30000 });
    await page
      .locator('.panel-imagen-visor')
      .getByText('Visor documental')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .catch(() => console.warn('El visor no termino de cargar; se captura igualmente.'));
    await page.waitForTimeout(2500);

    if (await page.locator('.panel-imagen-visor .alert-danger').isVisible().catch(() => false)) {
      console.warn('El visor mostro un error; se reintenta la apertura del documento.');
      await page.locator('.tarjeta-documento').first().click();
      await page.waitForTimeout(3000);
    }

    await capturar(page, 'fig-iv-09-ui-visor.png', { fullPage: true });
  } else {
    console.warn('No se encontro ningun documento para abrir el visor.');
  }

  if (process.env.CAPTURAR_MOVIL === '1') {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/busqueda`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.panel-busqueda');
    await page.fill('input[type="search"]', CONSULTA);
    await page.click('form.buscador-simple button[type="submit"]');
    await page.waitForSelector('.tarjeta-documento, .estado-resultados h3');
    await page.waitForSelector('form.buscador-simple button[type="submit"]:not([disabled])');
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(1200);
    await capturar(page, 'fig-iv-11-ui-movil.png', { fullPage: true });
  }

  console.log('Capturas de interfaz completadas.');
} catch (error) {
  console.error(`Error al capturar la interfaz: ${error.message}`);
  await capturar(page, 'fig-iv-99-error-ui.png', { fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await contexto.close();
  await navegador.close();
}
