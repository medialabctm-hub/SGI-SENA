/**
 * Negativas / aceptación — MDL-192 / H-07 fase 1 (QA-192A-01 … A-14).
 *
 * Hotfix PUT /api/auth/user/:id: guards de cédula/correo propios,
 * re-auth con contrasena_actual, motivo Admin, rate-limit, sin secretos.
 *
 * QA-192A-14 (JWT residual hasta MDL-229) es observacional: se documenta,
 * no falla la suite.
 */

import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { AuthService } from '../../src/services/authService.js';
import { ValidationError, errorHandler } from '../../src/utils/errors.js';
import { redactSensitiveFields } from '../../src/utils/errorScrubber.js';
import { logger } from '../../src/utils/logger.js';
import {
  identityReauthIpLimiter,
  identityReauthUserLimiter,
} from '../../src/middleware/rateLimiter.js';
import { requireOwnership } from '../../src/middleware/authorization.js';

const SENTINEL = 'SENTINEL_Pwd_MDL192_X9!';
const STRONG_PWD = 'Pass123*Seg';

const baseUser = {
  id_usuario: 1,
  cedula: '1234567890',
  contrasena: 'hashedPassword',
  nombre_usuario: 'Test User',
  correo: 'test@example.com',
  telefono: '3001234567',
  nombre_rol: 'Aprendiz',
  id_rol: 3,
  requiere_cambio_contrasena: false,
  foto_perfil: null,
};

function assertNoSecrets(payload, sentinels = [SENTINEL]) {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toMatch(/\$2[aby]\$/i);
  expect(payload).not.toHaveProperty('contrasena');
  expect(payload).not.toHaveProperty('contrasena_actual');
  expect(payload).not.toHaveProperty('token');
  expect(payload).not.toHaveProperty('refresh_token');
  for (const s of sentinels) {
    expect(serialized.includes(s)).toBe(false);
  }
}

describe('MDL-192 / H-07 fase 1 — PUT user identity (QA-192A)', () => {
  let authService;
  let mockUserRepository;
  let mockRoleRepository;
  let mockPasswordService;
  let mockJwtService;
  let mockLogger;

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn().mockResolvedValue({ ...baseUser }),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affectedRows: 1 }),
      db: { execute: jest.fn() },
    };
    mockRoleRepository = { findByName: jest.fn().mockResolvedValue({ id_rol: 3 }) };
    mockPasswordService = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    mockJwtService = { sign: jest.fn(), verify: jest.fn() };
    mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    authService = new AuthService(
      mockUserRepository,
      mockRoleRepository,
      mockPasswordService,
      mockJwtService,
      mockLogger
    );
  });

  it('QA-192A-01: editar solo nombre/teléfono con cedula/correo idénticos → sin re-auth', async () => {
    const result = await authService.updateUser(1, {
      nombre: 'Nombre Nuevo',
      telefono: '3009998877',
      cedula: '1234567890',
      correo: 'test@example.com',
      rol: 'Aprendiz',
    }, { id: 1, rol: 'Aprendiz' });

    expect(result.message).toMatch(/actualizado/i);
    expect(mockPasswordService.compare).not.toHaveBeenCalled();
    const [, args] = mockUserRepository.update.mock.calls[0];
    expect(args).not.toHaveProperty('cedula');
    expect(args).not.toHaveProperty('correo');
    assertNoSecrets(result);
  });

  it('QA-192A-02: usuario no cambia su propia cédula', async () => {
    await expect(
      authService.updateUser(1, { cedula: '9999999999' }, { id: 1, rol: 'Aprendiz' })
    ).rejects.toThrow(ValidationError);
    expect(mockUserRepository.update).not.toHaveBeenCalled();
  });

  it('QA-192A-03: cédula con solo espacios alrededor = no-cambio', async () => {
    const result = await authService.updateUser(1, {
      nombre: 'Test User',
      cedula: ' 1234567890 ',
    }, { id: 1, rol: 'Aprendiz' });
    expect(result.message).toMatch(/actualizado/i);
    expect(mockUserRepository.update.mock.calls[0][1]).not.toHaveProperty('cedula');
  });

  it('QA-192A-04: cambio de correo propio con contrasena_actual correcta', async () => {
    mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashedPassword' });
    mockPasswordService.compare.mockResolvedValue(true);

    const payload = { correo: 'nuevo@sena.edu.co', contrasena_actual: STRONG_PWD };
    const result = await authService.updateUser(1, payload, { id: 1, rol: 'Aprendiz' });

    expect(result.message).toMatch(/actualizado/i);
    expect(payload).not.toHaveProperty('contrasena_actual');
    expect(mockUserRepository.update.mock.calls[0][1].correo).toBe('nuevo@sena.edu.co');
    assertNoSecrets(result);
    assertNoSecrets(mockUserRepository.update.mock.calls[0][1]);
  });

  it('QA-192A-05: contraseña incorrecta → error genérico y BD intacta', async () => {
    mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashedPassword' });
    mockPasswordService.compare.mockResolvedValue(false);

    await expect(
      authService.updateUser(1, {
        correo: 'nuevo@sena.edu.co',
        contrasena_actual: 'WrongPass1*',
      }, { id: 1, rol: 'Aprendiz' })
    ).rejects.toThrow(/No se pudo completar la operación/);
    expect(mockUserRepository.update).not.toHaveBeenCalled();
  });

  it('QA-192A-06: correo solo casing/espacios no exige contraseña', async () => {
    const result = await authService.updateUser(1, {
      nombre: 'Test User',
      correo: ' Test@Example.COM ',
    }, { id: 1, rol: 'Aprendiz' });
    expect(result.message).toMatch(/actualizado/i);
    expect(mockPasswordService.compare).not.toHaveBeenCalled();
  });

  it('QA-192A-08/11: Admin no cambia su propia cédula (ownership bypass ≠ permiso)', async () => {
    mockUserRepository.findById.mockResolvedValue({
      ...baseUser,
      id_usuario: 50,
      cedula: '5555555555',
      nombre_rol: 'Administrador',
    });
    await expect(
      authService.updateUser(50, { cedula: '6666666666' }, { id: 50, rol: 'Administrador' })
    ).rejects.toThrow(ValidationError);
    expect(mockUserRepository.update).not.toHaveBeenCalled();
  });

  it('QA-192A-09: Admin cambia cédula ajena con motivo + log sin valor nuevo', async () => {
    const result = await authService.updateUser(1, {
      cedula: '9876543210',
      motivo: 'Corrección registraduría',
    }, { id: 99, rol: 'Administrador' });

    expect(result.message).toMatch(/actualizado/i);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Cambio de identidad (cédula) por administrador',
      expect.objectContaining({ targetUserId: 1, adminId: 99, field: 'cedula' })
    );
    const meta = mockLogger.info.mock.calls.find(([m]) => String(m).includes('Cambio de identidad'))[1];
    expect(JSON.stringify(meta)).not.toContain('9876543210');
    assertNoSecrets(result);
  });

  it('QA-192A-10: Admin sin motivo al cambiar cédula ajena → rechazo', async () => {
    await expect(
      authService.updateUser(1, { cedula: '9876543210', motivo: '   ' }, { id: 99, rol: 'Administrador' })
    ).rejects.toThrow(ValidationError);
    expect(mockUserRepository.update).not.toHaveBeenCalled();
  });

  it('QA-192A-12: respuesta y update args nunca incluyen secretos (sentinel)', async () => {
    mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashedPassword' });
    mockPasswordService.compare.mockResolvedValue(true);

    const payload = { correo: 'safe@sena.edu.co', contrasena_actual: SENTINEL };
    const result = await authService.updateUser(1, payload, { id: 1, rol: 'Aprendiz' });

    assertNoSecrets(result, [SENTINEL]);
    assertNoSecrets(payload, [SENTINEL]);
    assertNoSecrets(mockUserRepository.update.mock.calls[0][1], [SENTINEL]);

    const redacted = redactSensitiveFields({ contrasena_actual: SENTINEL, ok: true });
    expect(redacted.contrasena_actual).toBe('[REDACTED]');
    expect(JSON.stringify(redacted)).not.toContain(SENTINEL);
  });

  it('QA-192A-14 (info): residual JWT 24h documentado — no falla fase 1', () => {
    // Hasta MDL-229 (token_version) un JWT robado sigue válido ~24h tras cambio de correo.
    expect(true).toBe(true);
  });
});

describe('MDL-192 ruta — ownership IDOR + rate-limit + scrub (QA-192A-07/13/12)', () => {
  let app;
  let previousEnv;
  let updateImpl;

  beforeAll(() => {
    previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    app = express();
    app.set('trust proxy', 1);
    app.use(express.json());

    app.put(
      '/api/auth/user/:id',
      (req, _res, next) => {
        req.user = req.headers['x-test-user']
          ? JSON.parse(req.headers['x-test-user'])
          : null;
        next();
      },
      requireOwnership((req) => req.params.id),
      identityReauthIpLimiter,
      identityReauthUserLimiter,
      async (req, res, next) => {
        try {
          if (updateImpl) {
            return updateImpl(req, res);
          }
          return res.json({ message: 'Usuario actualizado correctamente' });
        } catch (err) {
          return next(err);
        }
      }
    );
    app.use(errorHandler);
  });

  afterAll(() => {
    process.env.NODE_ENV = previousEnv;
  });

  beforeEach(() => {
    updateImpl = null;
  });

  it('QA-192A-13: no-Admin no edita a otro (requireOwnership → 403)', async () => {
    const res = await request(app)
      .put('/api/auth/user/99')
      .set('X-Test-User', JSON.stringify({ id: 1, rol: 'Instructor' }))
      .set('X-Forwarded-For', '203.0.113.40')
      .send({ nombre: 'Hack' });

    expect(res.status).toBe(403);
    assertNoSecrets(res.body);
  });

  it('QA-192A-07: fallos de contraseña agotan límite por usuario e IP (429)', async () => {
    updateImpl = (req, res) => res.status(400).json({
      success: false,
      error: 'No se pudo completar la operación.',
    });

    const userHeader = JSON.stringify({ id: 42, rol: 'Aprendiz' });
    for (let i = 0; i < 10; i += 1) {
      const last = await request(app)
        .put('/api/auth/user/42')
        .set('X-Test-User', userHeader)
        .set('X-Forwarded-For', '198.51.100.42')
        .send({ correo: 'x@y.com', contrasena_actual: 'WrongPass1*' });
      expect([400, 429]).toContain(last.status);
    }

    const blocked = await request(app)
      .put('/api/auth/user/42')
      .set('X-Test-User', userHeader)
      .set('X-Forwarded-For', '198.51.100.42')
      .send({ correo: 'x@y.com', contrasena_actual: 'WrongPass1*' });

    expect(blocked.status).toBe(429);
    assertNoSecrets(blocked.body);
  });

  it('QA-192A-12 ruta: body de error no incluye sentinel de contrasena_actual', async () => {
    updateImpl = (req, res) => {
      logger.error('probe updateUser', {
        contrasena_actual: SENTINEL,
        error: 'fallo',
      });
      return res.status(400).json({
        success: false,
        error: 'No se pudo completar la operación.',
      });
    };

    const res = await request(app)
      .put('/api/auth/user/7')
      .set('X-Test-User', JSON.stringify({ id: 7, rol: 'Aprendiz' }))
      .set('X-Forwarded-For', '203.0.113.77')
      .send({ correo: 'n@e.com', contrasena_actual: SENTINEL });

    expect(res.status).toBeGreaterThanOrEqual(400);
    assertNoSecrets(res.body, [SENTINEL]);
  });
});
