/**
 * MDL-232: el logger no debe filtrar token / contraseñas en meta.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { redactSensitive, logger } from '../../src/utils/logger.js';

describe('redactSensitive (MDL-232)', () => {
  it('redacta token, nuevaContrasena y campos de password', () => {
    const input = {
      token: 'super-secret-token-value',
      nuevaContrasena: 'ValidPass123*',
      contrasena: 'old',
      password: 'x',
      userId: 42,
      nested: { token: 'nested-token', ok: true },
    };
    const out = redactSensitive(input);
    expect(out.token).toBe('[REDACTED]');
    expect(out.nuevaContrasena).toBe('[REDACTED]');
    expect(out.contrasena).toBe('[REDACTED]');
    expect(out.password).toBe('[REDACTED]');
    expect(out.userId).toBe(42);
    expect(out.nested.token).toBe('[REDACTED]');
    expect(out.nested.ok).toBe(true);
  });
});

describe('logger.error redacts sensitive meta (MDL-232)', () => {
  let spy;
  beforeEach(() => {
    spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    spy.mockRestore();
  });

  it('no imprime el token en claro', () => {
    logger.error('validar-token', { token: 'abc123secrettoken', userId: 1 });
    const printed = spy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(printed).not.toContain('abc123secrettoken');
    expect(printed).toContain('[REDACTED]');
  });
});
