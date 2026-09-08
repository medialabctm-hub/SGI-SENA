/**
 * Tests unitarios para el contrato de la cookie httpOnly de sesión (MDL-127).
 *
 * Ejecutar con: npm test -- sessionCookie.test.js
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import {
  SESSION_COOKIE_NAME,
  parseDurationToMs,
  buildSessionCookieOptions,
  extractSessionToken,
  extractTokenFromCookieHeader,
} from '../../src/utils/sessionCookie.js';

describe('SESSION_COOKIE_NAME', () => {
  it('es un nombre de cookie no vacío y estable', () => {
    expect(typeof SESSION_COOKIE_NAME).toBe('string');
    expect(SESSION_COOKIE_NAME.length).toBeGreaterThan(0);
  });
});

describe('parseDurationToMs', () => {
  it('convierte horas, días, minutos y segundos a milisegundos', () => {
    expect(parseDurationToMs('24h')).toBe(24 * 60 * 60 * 1000);
    expect(parseDurationToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDurationToMs('30m')).toBe(30 * 60 * 1000);
    expect(parseDurationToMs('45s')).toBe(45 * 1000);
  });

  it('devuelve el valor tal cual si ya es un número', () => {
    expect(parseDurationToMs(12345)).toBe(12345);
  });

  it('cae al fallback si el formato no es reconocido', () => {
    expect(parseDurationToMs('no-valido', 999)).toBe(999);
    expect(parseDurationToMs(undefined, 999)).toBe(999);
    expect(parseDurationToMs('', 999)).toBe(999);
  });
});

describe('buildSessionCookieOptions', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('es httpOnly, path=/ y sameSite=lax siempre', () => {
    const options = buildSessionCookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/');
    expect(options.sameSite).toBe('lax');
    expect(options.maxAge).toBeGreaterThan(0);
  });

  it('secure=false en desarrollo/test para no romper el login por http local', () => {
    process.env.NODE_ENV = 'test';
    expect(buildSessionCookieOptions().secure).toBe(false);
  });

  it('secure=true en producción', () => {
    process.env.NODE_ENV = 'production';
    expect(buildSessionCookieOptions().secure).toBe(true);
  });
});

describe('extractSessionToken', () => {
  it('prioriza la cookie de sesión sobre el header Authorization', () => {
    const req = {
      cookies: { [SESSION_COOKIE_NAME]: 'cookie-token' },
      headers: { authorization: 'Bearer header-token' },
    };
    expect(extractSessionToken(req)).toBe('cookie-token');
  });

  it('cae al header Authorization cuando no hay cookie', () => {
    const req = { cookies: {}, headers: { authorization: 'Bearer header-token' } };
    expect(extractSessionToken(req)).toBe('header-token');
  });

  it('funciona sin req.cookies definido (cookie-parser no montado)', () => {
    const req = { headers: { authorization: 'Bearer header-token' } };
    expect(extractSessionToken(req)).toBe('header-token');
  });

  it('devuelve null si no hay cookie ni header Bearer', () => {
    expect(extractSessionToken({ cookies: {}, headers: {} })).toBeNull();
    expect(extractSessionToken({ cookies: {}, headers: { authorization: 'Basic xyz' } })).toBeNull();
  });
});

describe('extractTokenFromCookieHeader', () => {
  it('extrae el valor de la cookie de sesión de un header Cookie crudo', () => {
    const header = `otra=1; ${SESSION_COOKIE_NAME}=abc.def.ghi; otra2=2`;
    expect(extractTokenFromCookieHeader(header)).toBe('abc.def.ghi');
  });

  it('decodifica valores URL-encoded', () => {
    const header = `${SESSION_COOKIE_NAME}=${encodeURIComponent('a.b.c')}`;
    expect(extractTokenFromCookieHeader(header)).toBe('a.b.c');
  });

  it('devuelve null si el header no trae la cookie de sesión', () => {
    expect(extractTokenFromCookieHeader('otra=1')).toBeNull();
    expect(extractTokenFromCookieHeader('')).toBeNull();
    expect(extractTokenFromCookieHeader(undefined)).toBeNull();
    expect(extractTokenFromCookieHeader(null)).toBeNull();
  });
});
