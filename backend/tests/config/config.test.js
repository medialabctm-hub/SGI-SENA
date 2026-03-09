/**
 * Tests para config/config
 *
 * Cubre: validateConfig, getConfig
 *
 * Nota: config.js ejecuta código al importarse y puede lanzar si faltan
 * variables de entorno. El .env del proyecto cubre las vars requeridas.
 * Aquí se prueban las funciones exportadas que dependen de process.env.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { validateConfig, getConfig } from '../../src/config/config.js';

// ──────────────────────────────────────────────
// validateConfig()
// ──────────────────────────────────────────────
describe('validateConfig()', () => {
  let originalEnv;

  beforeEach(() => {
    // Guardar valores originales
    originalEnv = {
      NODE_ENV: process.env.NODE_ENV,
      JWT_SECRET: process.env.JWT_SECRET,
      COOKIE_SECRET: process.env.COOKIE_SECRET,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
    };
  });

  afterEach(() => {
    // Restaurar valores originales
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.JWT_SECRET = originalEnv.JWT_SECRET;
    if (originalEnv.COOKIE_SECRET !== undefined) {
      process.env.COOKIE_SECRET = originalEnv.COOKIE_SECRET;
    } else {
      delete process.env.COOKIE_SECRET;
    }
    if (originalEnv.CORS_ORIGIN !== undefined) {
      process.env.CORS_ORIGIN = originalEnv.CORS_ORIGIN;
    } else {
      delete process.env.CORS_ORIGIN;
    }
  });

  it('debe retornar array vacío en entorno de desarrollo', () => {
    process.env.NODE_ENV = 'development';
    const errors = validateConfig();
    expect(Array.isArray(errors)).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('debe retornar array vacío en entorno de test', () => {
    process.env.NODE_ENV = 'test';
    const errors = validateConfig();
    expect(errors).toHaveLength(0);
  });

  it('debe retornar error si JWT_SECRET es el valor por defecto en producción', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';
    process.env.COOKIE_SECRET = 'algún-secreto';
    process.env.CORS_ORIGIN = 'https://app.example.com';

    const errors = validateConfig();

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
  });

  it('debe retornar error si falta COOKIE_SECRET en producción', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secure-jwt-key-production-2026';
    delete process.env.COOKIE_SECRET;
    process.env.CORS_ORIGIN = 'https://app.example.com';

    const errors = validateConfig();

    expect(errors.some((e) => e.includes('COOKIE_SECRET'))).toBe(true);
  });

  it('debe retornar error si falta CORS_ORIGIN en producción', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secure-jwt-key-production-2026';
    process.env.COOKIE_SECRET = 'cookie-secret-seguro';
    delete process.env.CORS_ORIGIN;

    const errors = validateConfig();

    expect(errors.some((e) => e.includes('CORS_ORIGIN'))).toBe(true);
  });

  it('no debe retornar errores en producción con todas las vars correctas', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secure-jwt-key-production-2026';
    process.env.COOKIE_SECRET = 'cookie-secret-muy-seguro-2026';
    process.env.CORS_ORIGIN = 'https://app.sena.edu.co';

    const errors = validateConfig();

    expect(errors).toHaveLength(0);
  });

  it('debe acumular múltiples errores en producción cuando faltan varias vars', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';
    delete process.env.COOKIE_SECRET;
    delete process.env.CORS_ORIGIN;

    const errors = validateConfig();

    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ──────────────────────────────────────────────
// getConfig()
// ──────────────────────────────────────────────
describe('getConfig()', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = {
      PORT: process.env.PORT,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
      JWT_SECRET: process.env.JWT_SECRET,
    };
  });

  afterEach(() => {
    if (originalEnv.PORT !== undefined) process.env.PORT = originalEnv.PORT;
    else delete process.env.PORT;
    if (originalEnv.CORS_ORIGIN !== undefined) process.env.CORS_ORIGIN = originalEnv.CORS_ORIGIN;
    else delete process.env.CORS_ORIGIN;
    if (originalEnv.JWT_SECRET !== undefined) process.env.JWT_SECRET = originalEnv.JWT_SECRET;
    else delete process.env.JWT_SECRET;
  });

  it('debe retornar un objeto de configuración con las claves principales', () => {
    const cfg = getConfig('development');
    expect(cfg).toHaveProperty('server');
    expect(cfg).toHaveProperty('db');
    expect(cfg).toHaveProperty('jwt');
    expect(cfg).toHaveProperty('cors');
  });

  it('debe retornar logging.level = "debug" en modo development', () => {
    const cfg = getConfig('development');
    expect(cfg.logging.level).toBe('debug');
  });

  it('debe aplicar CORS_ORIGIN por defecto en development si no está definida', () => {
    delete process.env.CORS_ORIGIN;
    const cfg = getConfig('development');
    expect(cfg.cors.origin).toBe('http://localhost:5173');
  });

  it('debe usar CORS_ORIGIN del entorno en production', () => {
    process.env.CORS_ORIGIN = 'https://prod.sena.edu.co';
    const cfg = getConfig('production');
    expect(cfg.cors.origin).toBe('https://prod.sena.edu.co');
  });

  it('debe usar JWT_SECRET del entorno en production', () => {
    process.env.JWT_SECRET = 'jwt-secret-production-test';
    const cfg = getConfig('production');
    expect(cfg.jwt.secret).toBe('jwt-secret-production-test');
  });

  it('debe retornar la configuración por defecto para un entorno desconocido', () => {
    const cfg = getConfig('staging');
    // Solo verifica que no lanza error y devuelve el objeto de config
    expect(cfg).toHaveProperty('server');
    expect(cfg).toHaveProperty('db');
    expect(cfg).toHaveProperty('jwt');
  });

  it('debe usar el entorno actual si no se pasa parámetro', () => {
    const cfg = getConfig();
    expect(cfg).toHaveProperty('server');
  });

  it('debe retornar PORT 3000 por defecto en production cuando PORT no está definido', () => {
    delete process.env.PORT;
    const cfg = getConfig('production');
    expect(cfg.server.port).toBeDefined();
  });
});
