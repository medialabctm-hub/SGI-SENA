import { test, expect } from '@playwright/test';

test.describe('contrato público de SGI-SENA', () => {
  test.describe.configure({ timeout: 60_000 });

  test('carga el shell público de login', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    await expect(page.locator('h1.title')).toHaveText('Gestión de Inventario');
    await expect(page.getByText('SGI SENA')).toBeVisible();
    await expect(page.getByPlaceholder('Documento')).toBeVisible();
    await expect(page.getByPlaceholder('Contraseña')).toBeVisible();
  });

  test('valida login vacío en el cliente sin enviar credenciales', async ({ page }) => {
    const apiRequests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request);
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    await expect(page.getByText('El Documento es obligatorio')).toBeVisible();
    await expect(page.getByText('La contraseña es obligatoria')).toBeVisible();
    expect(apiRequests).toHaveLength(0);
  });

  test('valida documento vacío del autoservicio sin mutar ni consultar', async ({ page }) => {
    const apiRequests = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request);
    });

    await page.goto('/solicitar-equipo', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByRole('alert')).toHaveText('El documento es obligatorio');
    expect(apiRequests).toHaveLength(0);
  });
});
