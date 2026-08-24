/**
 * Configuración de Jest para tests
 */

export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/di/setup.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',          // tabla en consola (por archivo)
    'text-summary',  // resumen global con porcentaje general
    'lcov',
    'html',
    'json-summary',  // genera coverage-summary.json con % global
  ],
  // Umbrales mínimos de cobertura global (gate activo para evitar regresiones)
  coverageThreshold: {
    global: {
      statements: 79,
      branches: 69,
      functions: 88,
      lines: 80,
    },
  },
  // Evitar que imports y mocks ESM de una suite contaminen a la siguiente.
  resetModules: true,
  // Cargar los valores seguros de prueba antes de importar cualquier módulo
  // que valide la configuración de producción.
  setupFiles: ['<rootDir>/tests/setUpEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
};



