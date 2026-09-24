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
  rateLimit: rateLimitMock,
  // Passthrough: en unit tests alimentamos IPv4 literales en req.ip
  ipKeyGenerator: (ip) => ip,
}));

const {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  writeLimiter,
  readLimiter,
  strictLimiter,
  searchLimiter,
  publicLookupLimiter,
  identityReauthIpLimiter,
  identityReauthUserLimiter,
  invitationIpLimiter,
  invitationCodeLimiter,
  webhookLimiter,
  autoservicioIpLimiter,
  autoservicioIdentifierLimiter,
} = await import('../../src/middleware/rateLimiter.js');

describe('rateLimiter config', () => {
  it('debe registrar todos los limiters esperados', () => {
    expect(rateLimitMock).toHaveBeenCalledTimes(15);
    expect(authLimiter.__options.windowMs).toBe(15 * 60 * 1000);
    expect(registerLimiter.__options.windowMs).toBe(60 * 60 * 1000);
    expect(passwordResetLimiter.__options.windowMs).toBe(60 * 60 * 1000);
    expect(webhookLimiter.__options.max).toBe(100);
  });

  it('publicLookupLimiter debe ser tan estricto como authLimiter (10 intentos / 15 min por IP)', () => {
    expect(publicLookupLimiter.__options.windowMs).toBe(15 * 60 * 1000);
    expect(publicLookupLimiter.__options.max).toBe(10);

    const key = publicLookupLimiter.__options.keyGenerator({
      user: null,
      ip: '10.2.2.2',
      connection: { remoteAddress: '10.0.0.2' },
    });
    expect(key).toBe('10.2.2.2');

    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    publicLookupLimiter.__options.handler({}, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, retryAfter: 15 }));
  });

  it('identityReauthIpLimiter y identityReauthUserLimiter alinean umbral de login (MDL-192)', () => {
    expect(identityReauthIpLimiter.__options.windowMs).toBe(15 * 60 * 1000);
    expect(identityReauthIpLimiter.__options.max).toBe(10);
    expect(identityReauthUserLimiter.__options.windowMs).toBe(15 * 60 * 1000);
    expect(identityReauthUserLimiter.__options.max).toBe(10);
    expect(identityReauthIpLimiter.__options.skipSuccessfulRequests).toBe(true);
    expect(identityReauthUserLimiter.__options.skipSuccessfulRequests).toBe(true);

    const req = { user: { id: 7 }, ip: '10.9.9.9', connection: { remoteAddress: '10.0.0.9' } };
    expect(identityReauthIpLimiter.__options.keyGenerator(req)).toBe('identity_reauth_ip_10.9.9.9');
    expect(identityReauthUserLimiter.__options.keyGenerator(req)).toBe('identity_reauth_user_7');
  });

  it('invitationIpLimiter limita por IP y invitationCodeLimiter por identificador anonimizado', () => {
    expect(invitationIpLimiter.__options.windowMs).toBe(15 * 60 * 1000);
    expect(invitationIpLimiter.__options.max).toBe(10);
    expect(invitationCodeLimiter.__options.windowMs).toBe(15 * 60 * 1000);
    expect(invitationCodeLimiter.__options.max).toBe(5);

    const req = {
      ip: '10.2.2.2',
      body: { codigo: 'SECRETO-1', rol: 'Instructor' },
      connection: { remoteAddress: '10.0.0.2' },
    };
    const ipKey = invitationIpLimiter.__options.keyGenerator(req);
    const codeKey = invitationCodeLimiter.__options.keyGenerator(req);

    expect(ipKey).toBe('invitation_ip_10.2.2.2');
    expect(codeKey).toMatch(/^invitation_identifier_[0-9a-f]{64}$/);
    expect(codeKey).not.toContain('SECRETO-1');

    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    invitationCodeLimiter.__options.handler(req, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, retryAfter: 15 }));
  });

  it('autoservicioIpLimiter y autoservicioIdentifierLimiter limitan por dimensiones independientes', () => {
    expect(autoservicioIpLimiter.__options.windowMs).toBe(15 * 60 * 1000);
    expect(autoservicioIpLimiter.__options.max).toBe(20);
    expect(autoservicioIdentifierLimiter.__options.windowMs).toBe(15 * 60 * 1000);
    expect(autoservicioIdentifierLimiter.__options.max).toBe(5);

    const reqA = {
      ip: '10.5.5.5',
      body: { documento: '123456789', placa: 'EQ-001' },
      connection: { remoteAddress: '10.0.0.5' },
    };
    const reqB = {
      ip: '10.5.5.5',
      body: { documento: '987654321', placa: 'EQ-002' },
      connection: { remoteAddress: '10.0.0.5' },
    };

    const ipKeyA = autoservicioIpLimiter.__options.keyGenerator(reqA);
    const ipKeyB = autoservicioIpLimiter.__options.keyGenerator(reqB);
    expect(ipKeyA).toBe('autoservicio_ip_10.5.5.5');
    expect(ipKeyA).toBe(ipKeyB); // misma IP -> misma clave, límite compartido por origen

    const identifierKeyA = autoservicioIdentifierLimiter.__options.keyGenerator(reqA);
    const identifierKeyB = autoservicioIdentifierLimiter.__options.keyGenerator(reqB);
    expect(identifierKeyA).toMatch(/^autoservicio_identifier_[0-9a-f]{64}$/);
    expect(identifierKeyA).not.toBe(identifierKeyB); // pares documento+placa distintos -> claves distintas
    expect(identifierKeyA).not.toContain('123456789');
    expect(identifierKeyA).not.toContain('EQ-001');
  });

  it('autoservicioIdentifierLimiter normaliza espacios/mayúsculas y hashea el mismo par igual', () => {
    const reqLower = {
      ip: '10.5.5.6',
      body: { documento: ' 111222333 ', placa: ' eq-010 ' },
    };
    const reqUpper = {
      ip: '10.5.5.7',
      body: { documento: '111222333', placa: 'EQ-010' },
    };

    const keyLower = autoservicioIdentifierLimiter.__options.keyGenerator(reqLower);
    const keyUpper = autoservicioIdentifierLimiter.__options.keyGenerator(reqUpper);
    expect(keyLower).toBe(keyUpper);
  });

  it('autoservicioIdentifierLimiter no rompe con body ausente o campos faltantes', () => {
    const reqSinBody = { ip: '10.5.5.8' };
    const reqCampoFaltante = { ip: '10.5.5.9', body: { documento: '123' } };

    const keySinBody = autoservicioIdentifierLimiter.__options.keyGenerator(reqSinBody);
    const keyCampoFaltante = autoservicioIdentifierLimiter.__options.keyGenerator(reqCampoFaltante);

    expect(keySinBody).toMatch(/^autoservicio_identifier_[0-9a-f]{64}$/);
    expect(keySinBody).toBe(keyCampoFaltante); // ambos colapsan al identificador "missing"
  });

  it('autoservicioIpLimiter y autoservicioIdentifierLimiter responden 429 estable sin datos sensibles', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    autoservicioIpLimiter.__options.handler({}, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, retryAfter: 15 }));

    res.status.mockClear();
    res.json.mockClear();
    autoservicioIdentifierLimiter.__options.handler({}, res);
    expect(res.status).toHaveBeenCalledWith(429);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toEqual(expect.objectContaining({ success: false, retryAfter: 15 }));
    expect(JSON.stringify(payload)).not.toMatch(/document|placa/i);
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
