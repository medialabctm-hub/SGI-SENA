/**
 * E2E: flujo de login y ruta protegida.
 * Ejecutar con la app corriendo: npm run test:e2e (frontend en 5173, backend en 3000).
 */

const { test, expect } = require('@playwright/test');

test.describe('Auth E2E', () => {
  test('sin login, al abrir la app se muestra la página de login o redirige a ella', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/(login|$)/);
    await expect(page.getByText(/Gestión de Inventario|Iniciar Sesión|Documento/)).toBeVisible({ timeout: 10000 });
  });

  test('ruta protegida redirige a login cuando no hay sesión', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
