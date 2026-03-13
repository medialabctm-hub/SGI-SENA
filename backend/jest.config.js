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
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
};



