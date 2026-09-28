// Local-only visual regression harness. No real credentials, database or remote API.
// Run with Playwright available in node_modules or NODE_PATH and a local Vite server.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const baseURL = process.env.DESIGN_UAT_URL || 'http://127.0.0.1:5175';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname), 'This harness must never target a remote deployment');
const output = process.env.DESIGN_UAT_OUTPUT || path.join(os.tmpdir(), 'sgi-design-uat');
const user = { id_usuario: 1, nombre_usuario: 'Administrador de ensayo', nombre_rol: 'Administrador', cedula: 'TEST-ADMIN', correo: 'ensayo@example.invalid' };
const ambientes = [{ id_ambiente: 101, codigo_ambiente: '101', nombre_ambiente: 'Aula de ensayo' }];
const equipos = Array.from({ length: 5 }, (_, i) => ({ codigo_equipo: i + 1, codigo_inventario: `TEST-000${i + 1}`, tipo: 'PORTATIL', modelo: 'Modelo de ensayo con nombre largo', consecutivo: `TEST-${i}`, estado_fisico: 'Bueno', estado_operativo: 'Disponible', status_verificacion: 'Verificado', fecha_adquisicion: '2024-01-15', valor_ingreso: 3500000, id_ambiente: 101, nombre_ambiente: 'Aula de ensayo', descripcion: 'Equipo sintético para validar diseño, no corresponde a inventario real', specs_completas: '' }));
const aprendices = [{ id_aprendiz: 1, nombre: 'Aprendiz de ensayo', documento: 'TEST-LEARNER', tipo_documento: 'CC', tipo_aprendiz: 'Regular', ficha: 'TEST-FICHA', jornada: 'Mañana', creado_en: '2024-01-01' }];
const categorias = [{ id_categoria: 1, nombre_categoria: 'PORTATIL DE ENSAYO', descripcion: 'Categoría sintética', es_componente: 0 }];

async function fixtures(page) {
  await page.addInitScript(profile => localStorage.setItem('user', JSON.stringify(profile)), user);
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== new URL(baseURL).origin) return route.abort();
    if (url.pathname.startsWith('/socket.io')) return route.fulfill({ status: 503, body: '' });
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let payload = {};
    if (url.pathname === '/api/auth/me') payload = { user };
    else if (url.pathname === '/api/auth/users') payload = [user];
    else if (url.pathname === '/api/auth/user/1') payload = { user, equipos: [] };
    else if (url.pathname === '/api/permissions/roles') payload = { roles: [{ rol: 'Administrador' }, { rol: 'Cuentadante' }] };
    else if (url.pathname === '/api/aprendices') payload = { aprendices };
    else if (url.pathname === '/api/equipos/categorias') payload = categorias;
    else if (url.pathname === '/api/ambientes/activos') payload = ambientes;
    else if (url.pathname === '/api/equipos') payload = { data: equipos, equipos, pagination: { page: 1, total: 5, totalPages: 1 } };
    else if (url.pathname === '/api/equipos/verificacion/ambientes') payload = { ambientes };
    else if (url.pathname.includes('/pendientes/count')) payload = { count: 0 };
    else if (url.pathname === '/api/notifications') payload = { notifications: [], unreadCount: 0 };
    // Deletions are never forwarded, even if a regression unexpectedly sends one.
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

async function openPage(browser, width, height = 800) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await fixtures(page);
  return { context, page };
}

async function assertContainedFields(page, sheet) {
  await sheet.evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
  const bounds = await sheet.boundingBox();
  assert.ok(bounds && bounds.y >= -1 && bounds.x >= -1, 'Dialog starts outside viewport');
  const viewport = page.viewportSize();
  assert.ok(bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, 'Dialog exceeds viewport');
  const clipped = await sheet.locator('input, select, .custom-select').evaluateAll(elements => elements.filter(element => {
    const field = element.getBoundingClientRect();
    const dialog = element.closest('.modal-sheet').getBoundingClientRect();
    return field.width > 0 && (field.left < dialog.left - 1 || field.right > dialog.right + 1);
  }).length);
  assert.equal(clipped, 0, 'A form field is clipped horizontally');
  await sheet.getByRole('button', { name: /Guardar/ }).scrollIntoViewIfNeeded();
  const save = await sheet.getByRole('button', { name: /Guardar/ }).boundingBox();
  assert.ok(save && save.y >= 0 && save.y + save.height <= viewport.height + 1, 'Save action cannot be reached');
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const check = async (name, action) => {
    if (process.env.DESIGN_UAT_FILTER && !name.includes(process.env.DESIGN_UAT_FILTER)) return;
    try { await action(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
    catch (error) { results.push({ name, status: 'FAIL', error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
  };
  try {
    for (const width of [320, 375, 768, 1024, 1280, 1864]) {
      await check(`equipos-${width}`, async () => {
        const { context, page } = await openPage(browser, width);
        try {
          await page.goto(`${baseURL}/equipos/consultar`);
          const last = page.locator('.consultar-equipo-more').last();
          await last.waitFor();
          await last.locator('summary').click();
          const actions = last.locator('.consultar-equipo-more-list button');
          assert.ok(await actions.count() >= 6, 'Expected contextual actions missing');
          for (const action of await actions.all()) {
            assert.equal(await action.locator('svg').count(), 1, 'Action missing SVG');
            await action.scrollIntoViewIfNeeded();
            assert.ok(await action.isVisible(), 'Action cannot be reached');
            await action.click({ trial: true });
          }
          const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, main: document.querySelector('.dashboard-main').getBoundingClientRect().right }));
          assert.ok(layout.document <= layout.viewport + 1 && layout.main <= layout.viewport + 1, 'Horizontal page overflow');
          await actions.last().focus();
          await page.keyboard.press('Escape');
          assert.equal(await last.getAttribute('open'), null, 'Escape does not close actions');
          assert.equal(await last.locator('summary').evaluate(el => document.activeElement === el), true, 'Focus not restored to trigger');
          await page.screenshot({ path: path.join(output, `equipos-${width}.png`), fullPage: true });
        } finally { await context.close(); }
      });
    }
    for (const [width, height] of [[320, 640], [375, 667], [640, 360], [768, 600], [1366, 600], [1864, 930]]) {
      for (const route of ['aprendices', 'usuarios']) {
        await check(`${route}-editar-${width}x${height}`, async () => {
          const { context, page } = await openPage(browser, width, height);
          try {
            await page.goto(`${baseURL}/${route}`);
            const edit = page.getByRole('button', { name: 'Editar', exact: true }).first();
            await edit.click();
            const sheet = page.locator('.modal-sheet').filter({ has: page.getByRole('heading', { name: /Editar (aprendiz|usuario)/ }) });
            await sheet.waitFor();
            await assertContainedFields(page, sheet);
            const select = sheet.getByRole('combobox').first();
            await select.scrollIntoViewIfNeeded();
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await select.click();
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => document.querySelector('.form-dialog [role="combobox"]')?.getAttribute('aria-expanded') === 'false');
            assert.ok(await sheet.isVisible(), 'First Escape closed dialog instead of selector');
            await select.click();
            await page.getByRole('option', { name: 'CC', exact: true }).click();
            await page.screenshot({ path: path.join(output, `${route}-${width}.png`), fullPage: true });
            await page.keyboard.press('Escape');
            await sheet.waitFor({ state: 'detached' });
            assert.equal(await sheet.count(), 0, 'Escape does not close edit dialog');
            assert.equal(await edit.evaluate(el => document.activeElement === el), true, 'Focus not returned to Editar');
          } finally { await context.close(); }
        });
      }
    }
    await check('jornada-manana', async () => {
      const { context, page } = await openPage(browser, 1280);
      try {
        await page.goto(`${baseURL}/aprendices`);
        const badge = page.locator('.jornada-badge').first();
        await badge.waitFor();
        const visual = await badge.evaluate(el => ({ text: el.textContent, background: getComputedStyle(el).backgroundColor, image: getComputedStyle(el).backgroundImage }));
        assert.equal(visual.text, 'Mañana');
        assert.ok(visual.image !== 'none' || visual.background !== 'rgba(0, 0, 0, 0)', 'Morning badge has no identifying background');
      } finally { await context.close(); }
    });
    await check('selectores-usuarios', async () => {
      const { context, page } = await openPage(browser, 1280);
      try {
        await page.goto(`${baseURL}/usuarios`);
        await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
        await page.locator('.modal-sheet').getByRole('combobox').first().click();
        await page.getByRole('option', { name: 'CC', exact: true }).click();
      } finally { await context.close(); }
    });
    for (const route of ['/aprendices', '/config?section=tipos-equipo']) {
      await check(`cancelar-eliminacion-${route}`, async () => {
        const { context, page } = await openPage(browser, 1280);
        let nativeDialogs = 0;
        let deleteRequests = 0;
        page.on('dialog', async dialog => { nativeDialogs++; await dialog.dismiss(); });
        page.on('request', request => { if (request.method() === 'DELETE') deleteRequests++; });
        try {
          await page.goto(baseURL + route);
          await page.getByRole('button', { name: 'Eliminar', exact: true }).first().click();
          assert.equal(nativeDialogs, 0, 'Uses native browser confirmation');
          const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
          await dialog.waitFor();
          await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
          assert.equal(deleteRequests, 0, 'Cancel sent DELETE');
          assert.equal(await dialog.count(), 0, 'Cancel did not close dialog');
        } finally { await context.close(); }
      });
    }
  } finally { await browser.close(); }
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ baseURL, fixtures: true, results }, null, 2));
  console.log(`Checks: ${results.filter(result => result.status === 'PASS').length}/${results.length} PASS`);
  console.log(`Artifacts: ${output}`);
  if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
