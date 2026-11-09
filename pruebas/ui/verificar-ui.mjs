import fs from 'node:fs';

const { chromium } = await import(
  new URL('../evidencias/node_modules/playwright-core/index.mjs', import.meta.url).href
);

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const CONSULTA = process.env.UI_CONSULTA ?? 'aguas';

const RUTAS_NAVEGADOR = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function buscarNavegador() {
  const encontrada = RUTAS_NAVEGADOR.find((ruta) => fs.existsSync(ruta));
  if (!encontrada) {
    throw new Error('No se encontro Chrome ni Edge. Defina CHROME_PATH con la ruta del ejecutable.');
  }
  return encontrada;
}

let comprobaciones = 0;
const erroresConsola = [];

function comprobar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
  comprobaciones += 1;
  console.log(`OK: ${mensaje}`);
}

const navegador = await chromium.launch({
  executablePath: buscarNavegador(),
  headless: process.env.HEADED !== '1',
});

async function nuevaPagina(viewport = { width: 1440, height: 900 }) {
  const contexto = await navegador.newContext({ viewport, locale: 'es-PE' });
  const page = await contexto.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => erroresConsola.push(`pageerror: ${error.message}`));
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') erroresConsola.push(`console: ${mensaje.text()}`);
  });
  return { contexto, page };
}

async function iniciarSesion(page, usuario, contrasena) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#usuario', usuario);
  await page.fill('#contrasena', contrasena);
  await page.click('form button[type="submit"]');
  await page.waitForURL('**/busqueda');
  await page.waitForSelector('.navbar-menu .navbar-enlace');
}

function enlaceNavbar(page, texto) {
  return page.locator('.navbar-menu .navbar-enlace', { hasText: texto });
}

async function verificarRutaRestringida(page, ruta, mensaje) {
  await page.goto(`${BASE_URL}${ruta}`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/busqueda');
  comprobar(page.url().endsWith('/busqueda'), mensaje);
}

try {
  const admin = await nuevaPagina();
  await iniciarSesion(admin.page, 'anaquispe', 'Admin123!');

  comprobar((await enlaceNavbar(admin.page, 'Ingesta').count()) === 1, 'ADMIN ve enlace Ingesta');
  comprobar((await enlaceNavbar(admin.page, 'Usuarios').count()) === 1, 'ADMIN ve enlace Usuarios');
  comprobar((await enlaceNavbar(admin.page, 'Auditoría').count()) === 1, 'ADMIN ve enlace Auditoría');

  await admin.page.fill('input[type="search"]', CONSULTA);
  await admin.page.click('form.buscador-simple button[type="submit"]');
  await admin.page.waitForSelector('.tarjeta-documento, .estado-resultados h3');
  await admin.page.waitForSelector('form.buscador-simple button[type="submit"]:not([disabled])');
  comprobar(
    (await admin.page.locator('.alert-danger').count()) === 0,
    `La busqueda simple "${CONSULTA}" responde sin error`,
  );

  await (await enlaceNavbar(admin.page, 'Usuarios')).click();
  await admin.page.waitForURL('**/usuarios');
  await admin.page.waitForSelector('table.tabla-usuarios tbody tr');
  comprobar((await admin.page.locator('table.tabla-usuarios tbody tr').count()) > 0, 'Listado de usuarios con filas');
  await admin.page.getByRole('button', { name: 'Nuevo usuario' }).click();
  await admin.page.waitForSelector('.modal-panel');
  comprobar(await admin.page.locator('#nombre_usuario').isVisible(), 'Modal de alta de usuario visible');
  await admin.page.locator('.modal-cerrar').click();
  comprobar((await admin.page.locator('.modal-panel').count()) === 0, 'Modal de usuario se cierra');

  await (await enlaceNavbar(admin.page, 'Ingesta')).click();
  await admin.page.waitForURL('**/ingesta');
  await admin.page.waitForSelector('#id_fondo');
  await admin.page.waitForFunction(() => document.querySelectorAll('#id_fondo option').length > 1);
  comprobar((await admin.page.locator('#id_fondo option').count()) > 1, 'Formulario de ingesta carga los fondos');
  comprobar((await admin.page.locator('#archivo').count()) === 1, 'Campo de archivo digital presente');
  await admin.page.getByRole('button', { name: 'Agregar interesado' }).click();
  comprobar((await admin.page.locator('.fila-interesado').count()) === 1, 'Formulario agrega interesados dinamicamente');
  await admin.page.locator('.boton-quitar').first().click();
  comprobar((await admin.page.locator('.fila-interesado').count()) === 0, 'Formulario quita interesados');

  await (await enlaceNavbar(admin.page, 'Auditoría')).click();
  await admin.page.waitForURL('**/auditoria');
  await admin.page.waitForSelector('.panel-resultados');
  await admin.page.waitForFunction(() => !document.querySelector('.estado-resultados .spinner-border'));
  comprobar((await admin.page.locator('table.tabla-auditoria tbody tr').count()) > 0, 'Auditoria lista registros');
  await admin.page.selectOption('#tipo_accion', 'INICIO_SESION_EXITOSO');
  await admin.page.waitForTimeout(700);
  comprobar(
    (await admin.page.locator('table.tabla-auditoria tbody tr').count()) > 0,
    'Filtro por tipo de accion devuelve registros',
  );
  await admin.page.locator('table.tabla-auditoria tbody tr').first().getByRole('button', { name: 'Ver' }).click();
  await admin.page.waitForSelector('.detalle-auditoria');
  comprobar(await admin.page.locator('.detalle-auditoria').isVisible(), 'Modal de detalle de auditoria visible');
  await admin.page.locator('.modal-cerrar').click();

  await admin.page.setViewportSize({ width: 390, height: 844 });
  await admin.page.goto(`${BASE_URL}/busqueda`, { waitUntil: 'domcontentloaded' });
  await admin.page.waitForSelector('.navbar-movil-menu');
  comprobar(await admin.page.locator('.navbar-movil-menu').isVisible(), 'Menu movil visible a 390 px');
  comprobar(
    (await admin.page.locator('.navbar-movil-menu .navbar-enlace').count()) === 4,
    'Menu movil muestra 4 secciones para ADMIN',
  );
  comprobar(
    await admin.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    'Sin desborde horizontal a 390 px',
  );
  await admin.contexto.close();

  const archivista = await nuevaPagina();
  await iniciarSesion(archivista.page, 'lmamani', 'Archivo123!');
  comprobar((await enlaceNavbar(archivista.page, 'Ingesta').count()) === 1, 'ARCHIVISTA ve enlace Ingesta');
  comprobar((await enlaceNavbar(archivista.page, 'Usuarios').count()) === 0, 'ARCHIVISTA no ve enlace Usuarios');
  comprobar((await enlaceNavbar(archivista.page, 'Auditoría').count()) === 1, 'ARCHIVISTA ve enlace Auditoria');
  await verificarRutaRestringida(archivista.page, '/usuarios', 'ARCHIVISTA es redirigido de /usuarios a /busqueda');
  await (await enlaceNavbar(archivista.page, 'Auditoría')).click();
  await archivista.page.waitForURL('**/auditoria');
  await archivista.page.waitForSelector('.panel-resultados');
  await archivista.page.waitForFunction(() => !document.querySelector('.estado-resultados .spinner-border'));
  comprobar(
    (await archivista.page.locator('table.tabla-auditoria tbody tr').count()) > 0,
    'ARCHIVISTA consulta el historial de auditoria',
  );
  await archivista.page.waitForFunction(() => document.querySelectorAll('#id_usuario option').length > 1);
  comprobar(
    (await archivista.page.locator('#id_usuario option').count()) > 1,
    'ARCHIVISTA filtra la auditoria por usuario',
  );
  await archivista.page.setViewportSize({ width: 390, height: 844 });
  await archivista.page.goto(`${BASE_URL}/busqueda`, { waitUntil: 'domcontentloaded' });
  await archivista.page.waitForSelector('.navbar-movil-menu');
  comprobar(
    (await archivista.page.locator('.navbar-movil-menu .navbar-enlace').count()) === 3,
    'Menu movil muestra 3 secciones para ARCHIVISTA',
  );
  await archivista.contexto.close();

  const viewer = await nuevaPagina();
  await iniciarSesion(viewer.page, 'cflores', 'Consulta123!');
  comprobar((await enlaceNavbar(viewer.page, 'Ingesta').count()) === 0, 'VIEWER no ve enlace Ingesta');
  comprobar((await enlaceNavbar(viewer.page, 'Usuarios').count()) === 0, 'VIEWER no ve enlace Usuarios');
  comprobar((await enlaceNavbar(viewer.page, 'Auditoría').count()) === 0, 'VIEWER no ve enlace Auditoria');
  await verificarRutaRestringida(viewer.page, '/usuarios', 'VIEWER es redirigido de /usuarios a /busqueda');
  await verificarRutaRestringida(viewer.page, '/ingesta', 'VIEWER es redirigido de /ingesta a /busqueda');
  await verificarRutaRestringida(viewer.page, '/auditoria', 'VIEWER es redirigido de /auditoria a /busqueda');

  await viewer.page.setViewportSize({ width: 390, height: 844 });
  await viewer.page.goto(`${BASE_URL}/busqueda`, { waitUntil: 'domcontentloaded' });
  await viewer.page.waitForSelector('.navbar-movil-menu');
  comprobar(
    (await viewer.page.locator('.navbar-movil-menu .navbar-enlace').count()) === 1,
    'Menu movil muestra solo Consulta para VIEWER',
  );
  await viewer.contexto.close();

  comprobar(erroresConsola.length === 0, 'Sin errores de consola ni excepciones en la interfaz');

  console.log(`\nVerificacion UI completada: ${comprobaciones} comprobaciones aprobadas.`);
} catch (error) {
  console.error(`\nFALLO: ${error.message}`);
  if (erroresConsola.length) {
    console.error('Errores de consola:');
    for (const registro of erroresConsola) console.error(` - ${registro}`);
  }
  process.exitCode = 1;
} finally {
  await navegador.close();
}
