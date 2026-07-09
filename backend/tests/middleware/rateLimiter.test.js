import { describe, it, expect, jest } from '@jest/globals';

const rateLimitMock = jest.fn((options) => {
  const middleware = (req, res, next) => {
    if (next) next();
  };
  middleware.__options = options;
  return middleware;
});

await jest.unstable_mockModule('express-rate-limit', () => ({
  default: rateLimitMock,
}));

const {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  writeLimiter,
  readLimiter,
  strictLimiter,
  searchLimiter,
  webhookLimiter,
} = await import('../../src/middleware/rateLimiter.js');

describe('rateLimiter config', () => {
  it('debe registrar todos los limiters esperados', () => {
    expect(rateLimitMock).toHaveBeenCalledTimes(8);
    expect(authLimiter.__options.windowMs).toBe(15 * 60 * 1000);
    expect(registerLimiter.__options.windowMs).toBe(60 * 60 * 1000);
    expect(passwordResetLimiter.__options.windowMs).toBe(60 * 60 * 1000);
    expect(webhookLimiter.__options.max).toBe(100);
  });

  it('authLimiter keyGenerator debe usar user_<id> cuando hay usuario autenticado', () => {
    const key = authLimiter.__options.keyGenerator({
      user: { id: 42 },
      ip: '10.0.0.1',
      connection: { remoteAddress: '10.0.0.2' },
    });

    expect(key).toBe('user_42');
  });

  it('keyGenerator debe usar ip si no hay usuario autenticado', () => {
    const key = authLimiter.__options.keyGenerator({
      user: null,
      ip: '10.1.1.1',
      connection: { remoteAddress: '10.0.0.2' },
    });

    expect(key).toBe('10.1.1.1');
  });

  it('keyGenerator usa remoteAddress como fallback', () => {
    const key = readLimiter.__options.keyGenerator({
      user: null,
      ip: null,
      connection: { remoteAddress: '172.16.0.9' },
    });

    expect(key).toBe('172.16.0.9');
  });

  it('writeLimiter debe permitir maximo dinamico 100 anonimo y 150 autenticado', () => {
    const maxAnon = writeLimiter.__options.max({
      user: null,
      ip: '10.0.0.1',
    });

    const maxAuth = writeLimiter.__options.max({
      user: { id: 7 },
      ip: '10.0.0.1',
    });

    expect(maxAnon).toBe(100);
    expect(maxAuth).toBe(150);
  });

  it('readLimiter y searchLimiter deben exponer max dinámico', () => {
    expect(readLimiter.__options.max({ user: null })).toBe(200);
    expect(readLimiter.__options.max({ user: { id: 1 } })).toBe(300);
    expect(searchLimiter.__options.max({ user: null })).toBe(50);
    expect(searchLimiter.__options.max({ user: { id: 1 } })).toBe(80);
  });

  it('handlers personalizados responden 429 con retryAfter', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    authLimiter.__options.handler({}, res);
    writeLimiter.__options.handler({}, res);
    readLimiter.__options.handler({}, res);
    strictLimiter.__options.handler({}, res);
    searchLimiter.__options.handler({}, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('debe conservar configuración base de skipSuccessfulRequests y max estático', () => {
    expect(authLimiter.__options.skipSuccessfulRequests).toBe(false);
    expect(writeLimiter.__options.skipSuccessfulRequests).toBe(true);
    expect(readLimiter.__options.skipSuccessfulRequests).toBe(true);
    expect(strictLimiter.__options.max).toBe(20);
    expect(registerLimiter.__options.max).toBe(5);
    expect(passwordResetLimiter.__options.max).toBe(3);
  });
});
