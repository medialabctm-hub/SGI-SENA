/**
 * Tests para webhookController
 * 
 * Ejecutar con: npm test -- webhookController.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { recibirWebhookExterno } from '../../src/controller/webhookController.js';
import { AuthorizationError, ValidationError } from '../../src/utils/errors.js';

// Mock de dependencias
jest.mock('../../src/config/dbconfig.js', () => ({
  default: {
    execute: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('recibirWebhookExterno', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    
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
});



