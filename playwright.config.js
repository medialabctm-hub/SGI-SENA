/**
 * Configuración de Playwright para tests E2E.
 * Arranca el frontend automáticamente si no está corriendo (webServer).
 */
const { defineConfig, devices } = require('@playwright/test');
const localBaseURL = 'http://127.0.0.1:4173';
const baseURL = process.env.BASE_URL || localBaseURL;

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run dev --prefix frontend -- --host 127.0.0.1 --port 4173',
    url: localBaseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
