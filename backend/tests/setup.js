/**
 * Configuración global para tests
 * Este archivo se ejecuta antes de todos los tests
 */

import { config } from '../src/config/config.js';

// Configurar entorno de pruebas
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reducir logs en tests

// Mock de variables de entorno si es necesario
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
}

if (!process.env.DB_HOST) {
  process.env.DB_HOST = 'localhost';
}

// Limpiar después de cada test
afterEach(() => {
  jest.clearAllMocks();
});

export default {};



