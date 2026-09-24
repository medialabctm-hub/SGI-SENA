/**
 * MDL-231 — POST /api/auth/recuperar-contrasena
 * Sin 500 por bind undefined; 400 genérico; 200 idéntico exista o no; sin PII en logs;
 * respuesta no espera al mailer (envío async).
 */
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mockFindOne = jest.fn();
const mockExecute = jest.fn();
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const mockEnviarCorreo = jest.fn().mockResolvedValue({ success: true });
const mockReinitialize = jest.fn();

jest.unstable_mockModule(
  path.resolve(__dirname, '../../src/factories/ServiceFactory.js'),
  () => ({
    ServiceFactory: {
      create: jest.fn((name) => {
        if (name === 'authService') {
          return authServiceRef.current;
        }
        throw new Error(`Unexpected service: ${name}`);
      }),
    },
  }),
);

jest.unstable_mockModule(
  path.resolve(__dirname, '../../src/services/emailService.js'),
  () => ({
    default: {
      apiInstance: {},
      reinitialize: mockReinitialize,
      enviarCorreoRecuperacion: mockEnviarCorreo,
    },
  }),
);

const { AuthService } = await import('../../src/services/authService.js');
const {
  solicitarRecuperacionSchema,
  validate,
} = await import('../../src/validators/authValidator.js');
const { errorHandler } = await import('../../src/utils/errors.js');
const { passwordResetLimiter } = await import('../../src/middleware/rateLimiter.js');
const { solicitarRecuperacionContrasena } = await import(
  '../../src/controller/authController.js'
);

const authServiceRef = { current: null };
/** Promesas de envío en background; se drenan en afterEach para no dejar handles. */
const pendingMail = [];

function buildApp({ withLimiter = false } = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  const stack = [
    ...(withLimiter ? [passwordResetLimiter] : []),
    validate(solicitarRecuperacionSchema),
    solicitarRecuperacionContrasena,
  ];
  app.post('/api/auth/recuperar-contrasena', ...stack);
  app.use(errorHandler);
  return app;
}

const GENERIC_MSG = 'Si el usuario existe, se enviará un correo con las instrucciones';

describe('MDL-231 POST /api/auth/recuperar-contrasena', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindOne.mockReset();
    mockExecute.mockReset();
    mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
    mockEnviarCorreo.mockReset();
    mockEnviarCorreo.mockResolvedValue({ success: true });
    pendingMail.length = 0;

    const userRepository = {
      findOne: mockFindOne,
      db: { execute: mockExecute },
    };
    authServiceRef.current = new AuthService(
      userRepository,
      {},
      {},
      {},
      mockLogger,
    );
    // Scheduler inyectable: arranca el envío sin await y registra la promesa.
    authServiceRef.current.scheduleAsync = (fn) => {
      const result = fn();
      if (result && typeof result.then === 'function') {
        // La cadena de producción ya trae .catch → cumple siempre.
        pendingMail.push(result);
      }
    };
    app = buildApp();
  });

  afterEach(async () => {
    await Promise.all(pendingMail.splice(0));
  });

  it('RC-01: body vacío → 400, nunca 500', async () => {
    const res = await request(app).post('/api/auth/recuperar-contrasena').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Error de validación');
    expect(String(res.body.error || '')).not.toMatch(/Bind parameters|undefined/i);
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('RC-02: sin correo / cédula corta → 400', async () => {
    const missingCorreo = await request(app)
      .post('/api/auth/recuperar-contrasena')
      .send({ cedula: '1234567890' });
    expect(missingCorreo.status).toBe(400);

    const shortCedula = await request(app)
      .post('/api/auth/recuperar-contrasena')
      .send({ cedula: '12', correo: 'a@b.co' });
    expect(shortCedula.status).toBe(400);
  });

  it('RC-03/04: usuario existente e inexistente → mismo 200 y body', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const missing = await request(app)
      .post('/api/auth/recuperar-contrasena')
      .send({ cedula: '9999999999', correo: 'nobody@example.com' });

    mockFindOne.mockResolvedValueOnce({
      id_usuario: 42,
      nombre_usuario: 'Fixture',
      correo: 'fixture@example.com',
    });
    const existing = await request(app)
      .post('/api/auth/recuperar-contrasena')
      .send({ cedula: '1234567890', correo: 'fixture@example.com' });

    expect(missing.status).toBe(200);
    expect(existing.status).toBe(200);
    expect(missing.body).toEqual(existing.body);
    expect(missing.body.message).toBe(GENERIC_MSG);
  });

  it('RC-04b: correo que no coincide → mismo 200 genérico', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/auth/recuperar-contrasena')
      .send({ cedula: '1234567890', correo: 'other@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC_MSG);
  });

  it('RC-06: logs sin correo ni cédula ni flags de existencia', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    await request(app)
      .post('/api/auth/recuperar-contrasena')
      .send({ cedula: '1234567890', correo: 'secret@example.com' });

    mockFindOne.mockResolvedValueOnce({
      id_usuario: 7,
      nombre_usuario: 'A',
      correo: 'secret@example.com',
    });
    await request(app)
      .post('/api/auth/recuperar-contrasena')
      .send({ cedula: '1234567890', correo: 'secret@example.com' });

    await Promise.all(pendingMail.splice(0));

    const blob = JSON.stringify([
      ...mockLogger.info.mock.calls,
      ...mockLogger.warn.mock.calls,
      ...mockLogger.error.mock.calls,
    ]);
    expect(blob).not.toMatch(/secret@example\.com/i);
    expect(blob).not.toContain('1234567890');
    expect(blob).not.toMatch(/correoEnBD|correoIngresado|usuarioExistePorCedula|cedula/);
  });

  it('async email: 200 no espera a un mailer lento', async () => {
    let release;
    const slowGate = new Promise((resolve) => {
      release = resolve;
    });
    mockEnviarCorreo.mockImplementation(() => slowGate);

    mockFindOne.mockResolvedValueOnce({
      id_usuario: 99,
      nombre_usuario: 'Slow',
      correo: 'slow@example.com',
    });

    const started = Date.now();
    const res = await request(app)
      .post('/api/auth/recuperar-contrasena')
      .send({ cedula: '1234567890', correo: 'slow@example.com' });
    const elapsedMs = Date.now() - started;

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC_MSG);
    expect(elapsedMs).toBeLessThan(150);
    expect(mockExecute).toHaveBeenCalled();
    expect(mockEnviarCorreo).toHaveBeenCalled();

    release({ success: true });
    await Promise.all(pendingMail.splice(0));
  });


  it('mailer reject → 200 genérico, sin unhandledRejection, log email_error', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    // Como setImmediate de producción: el retorno de la callback se descarta.
    authServiceRef.current.scheduleAsync = (fn) => {
      setImmediate(() => {
        fn();
      });
    };

    const leaky = new Error('SMTP fail for leaky@example.com token=abc123');
    leaky.code = 'ETIMEDOUT';
    mockEnviarCorreo.mockRejectedValueOnce(leaky);
    mockFindOne.mockResolvedValueOnce({
      id_usuario: 11,
      nombre_usuario: 'X',
      correo: 'leaky@example.com',
    });

    try {
      const res = await request(app)
        .post('/api/auth/recuperar-contrasena')
        .send({ cedula: '1234567890', correo: 'leaky@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(GENERIC_MSG);

      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(unhandled).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error al enviar correo de recuperación',
        expect.objectContaining({
          userId: 11,
          outcome: 'email_error',
          error: 'ETIMEDOUT',
        }),
      );
      const blob = JSON.stringify([
        ...mockLogger.info.mock.calls,
        ...mockLogger.warn.mock.calls,
        ...mockLogger.error.mock.calls,
      ]);
      expect(blob).not.toMatch(/leaky@example\.com/i);
      expect(blob).not.toMatch(/abc123|token=/i);
      expect(blob).not.toMatch(/SMTP fail/);
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('mailer success:false → outcome email_failed', async () => {
    mockEnviarCorreo.mockResolvedValueOnce({ success: false });
    mockFindOne.mockResolvedValueOnce({
      id_usuario: 12,
      nombre_usuario: 'Y',
      correo: 'failflag@example.com',
    });

    const res = await request(app)
      .post('/api/auth/recuperar-contrasena')
      .send({ cedula: '1234567890', correo: 'failflag@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC_MSG);
    await Promise.all(pendingMail.splice(0));

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Error al enviar correo de recuperación',
      expect.objectContaining({ userId: 12, outcome: 'email_failed' }),
    );
    const blob = JSON.stringify(mockLogger.warn.mock.calls);
    expect(blob).not.toMatch(/failflag@example\.com/i);
  });

  it('logger.warn lanza en catch → outer .catch evita unhandledRejection', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    authServiceRef.current.scheduleAsync = (fn) => {
      setImmediate(() => {
        fn();
      });
    };

    mockEnviarCorreo.mockRejectedValueOnce(new Error('boom for boom@example.com'));
    mockLogger.warn.mockImplementation(() => {
      throw new Error('logger-warn-failed');
    });
    mockFindOne.mockResolvedValueOnce({
      id_usuario: 13,
      nombre_usuario: 'Z',
      correo: 'boom@example.com',
    });

    try {
      const res = await request(app)
        .post('/api/auth/recuperar-contrasena')
        .send({ cedula: '1234567890', correo: 'boom@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe(GENERIC_MSG);

      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(unhandled).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Fallo inesperado en envío de correo de recuperación',
        expect.objectContaining({
          userId: 13,
          outcome: 'email_unhandled',
          error: 'Error',
        }),
      );
      const blob = JSON.stringify([
        ...mockLogger.warn.mock.calls,
        ...mockLogger.error.mock.calls,
      ]);
      expect(blob).not.toMatch(/boom@example\.com/i);
      expect(blob).not.toMatch(/logger-warn-failed/);
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('rate limiter passwordResetLimiter sigue aplicado (3/hora)', async () => {
    const limitedApp = buildApp({ withLimiter: true });
    mockFindOne.mockResolvedValue(null);

    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const statuses = [];
      for (let i = 0; i < 4; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await request(limitedApp)
          .post('/api/auth/recuperar-contrasena')
          .send({ cedula: '1234567890', correo: 'rate@example.com' });
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 3).every((s) => s === 200)).toBe(true);
      expect(statuses[3]).toBe(429);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
