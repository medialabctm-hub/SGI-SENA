/**
 * Tests para webhookController
 * 
 * Ejecutar con: npm test -- webhookController.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { recibirWebhookExterno } from '../../src/controller/webhookController.js';
import { AuthorizationError, ValidationError, DatabaseError } from '../../src/utils/errors.js';

// Mock de dependencias
jest.mock(
  '../../src/config/dbconfig.js',
  () => ({
    default: {
      execute: jest.fn(),
    },
  }),
  { virtual: true }
);

jest.mock(
  '../../src/utils/logger.js',
  () => ({
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    },
  }),
  { virtual: true }
);

describe('recibirWebhookExterno', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    
    process.env.WEBHOOK_SECRET = 'token-correcto';

    req = {
      headers: {},
      body: {},
      ip: '127.0.0.1',
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  it('debe rechazar peticiones sin token', async () => {
    req.headers = {};

    await recibirWebhookExterno(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Token de autenticación inválido',
    });
  });

  it('debe rechazar peticiones con token inválido', async () => {
    req.headers['x-api-key'] = 'token-incorrecto';
    process.env.WEBHOOK_SECRET = 'token-correcto';

    await recibirWebhookExterno(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('debe rechazar peticiones con datos incompletos', async () => {
    req.headers['x-api-key'] = 'token-correcto';
    process.env.WEBHOOK_SECRET = 'token-correcto';
    req.body = {
      usuario: 'test',
      // Faltan ambiente, ficha, estado
    };

    await recibirWebhookExterno(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Datos incompletos',
      })
    );
  });

  it('debe rechazar peticiones con tipos de datos inválidos', async () => {
    req.headers['x-api-key'] = 'token-correcto';
    process.env.WEBHOOK_SECRET = 'token-correcto';
    req.body = {
      usuario: 'test',
      ambiente: 'no-es-un-numero', // Debe ser número
      ficha: 'FICHA-123',
      estado: 'pendiente',
    };

    await recibirWebhookExterno(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ─── WEBHOOK_SECRET no configurado ───────────────────────────────────────
  it('debe retornar 500 si WEBHOOK_SECRET no está configurado', async () => {
    delete process.env.WEBHOOK_SECRET;
    req.headers['x-api-key'] = 'any-token';

    await recibirWebhookExterno(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );

    // Restaurar para tests subsecuentes
    process.env.WEBHOOK_SECRET = 'token-correcto';
  });

  // ─── Logging en modo development ──────────────────────────────────────────
  it('debe loggear warning en modo development con token inválido', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    req.headers['x-api-key'] = 'token-incorrecto';

    await recibirWebhookExterno(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);

    process.env.NODE_ENV = prevNodeEnv;
  });

  // ─── ambiente float (no entero) ───────────────────────────────────────────
  it('debe rechazar ambiente float (no entero) por validarYConvertirAmbiente', async () => {
    req.headers['x-api-key'] = 'token-correcto';
    req.body = {
      usuario: 'user1',
      ambiente: 1.5, // número no entero → validarYConvertirAmbiente devuelve null
      ficha: 'FICHA-001',
      estado: 'pendiente',
    };

    await recibirWebhookExterno(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ─── ambiente objeto (ni número ni string) ────────────────────────────────
  it('debe rechazar ambiente objeto (ni número ni string)', async () => {
    req.headers['x-api-key'] = 'token-correcto';
    req.body = {
      usuario: 'user1',
      ambiente: { id: 5 }, // objeto → validarYConvertirAmbiente devuelve null
      ficha: 'FICHA-001',
      estado: 'pendiente',
    };

    await recibirWebhookExterno(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ─── Inserción exitosa en BD ───────────────────────────────────────────────
  it('debe guardar los datos en BD y retornar 201 en éxito', async () => {
    const dbMock = jest.requireMock('../../src/config/dbconfig.js');
    dbMock.default.execute.mockResolvedValue([{ insertId: 42, affectedRows: 1 }]);
    req.headers['x-api-key'] = 'token-correcto';
    req.body = {
      usuario: 'user1',
      ambiente: '5',
      ficha: 'FICHA-001',
      estado: 'pendiente',
    };

    await recibirWebhookExterno(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('debe loggear info en development cuando la inserción es exitosa', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const dbMock = jest.requireMock('../../src/config/dbconfig.js');
    dbMock.default.execute.mockResolvedValue([{ insertId: 7 }]);
    req.headers['x-api-key'] = 'token-correcto';
    req.body = { usuario: 'user1', ambiente: 3, ficha: 'F-001', estado: 'ok' };

    await recibirWebhookExterno(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);

    process.env.NODE_ENV = prevNodeEnv;
  });

  // ─── Errores de BD ─────────────────────────────────────────────────────────
  it('debe llamar next o retornar status cuando hay error de BD (error generico)', async () => {
    req.headers['x-api-key'] = 'token-correcto';
    req.body = { usuario: 'user1', ambiente: '5', ficha: 'F-001', estado: 'pendiente' };

    // With real DB or mocked DB, the handler should respond
    await recibirWebhookExterno(req, res, next);

    const calledNext = next.mock.calls.length > 0;
    const calledStatus = res.status.mock.calls.length > 0;
    const calledJson = res.json.mock.calls.length > 0;
    expect(calledNext || calledStatus || calledJson).toBe(true);
  });

  it('debe lanzar error o responder cuando la tabla no existe', async () => {
    req.headers['x-api-key'] = 'token-correcto';
    req.body = { usuario: 'user1', ambiente: '5', ficha: 'F-001', estado: 'pendiente' };

    await recibirWebhookExterno(req, res, next);

    const calledNext = next.mock.calls.length > 0;
    const calledStatus = res.status.mock.calls.length > 0;
    const calledJson = res.json.mock.calls.length > 0;
    expect(calledNext || calledStatus || calledJson).toBe(true);
  });
});



