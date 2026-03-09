/**
 * Tests ligeros para authController
 * Validan ramas de control simples sin tocar la lógica de negocio.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  loginUserWithPlaca,
  me,
} from '../../src/controller/authController.js';

// Mock de ServiceFactory para evitar depender del contenedor real
jest.mock(
  '../../src/factories/ServiceFactory.js',
  () => ({
    ServiceFactory: {
      create: jest.fn(() => ({
        loginUserWithPlaca: jest.fn().mockResolvedValue({ ok: true }),
        getCurrentUser: jest.fn().mockResolvedValue({ id: 1 }),
      })),
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

describe('authController', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: null,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('loginUserWithPlaca', () => {
    it('debe devolver 400 si faltan campos obligatorios', async () => {
      req.body = {
        cedula: '123',
        // falta contrasena y placa
      };

      await loginUserWithPlaca(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Faltan campos obligatorios: cedula, contrasena, placa',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('debe devolver 401 si no hay usuario en la request', async () => {
      req.user = null;

      await me(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No autorizado' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});

