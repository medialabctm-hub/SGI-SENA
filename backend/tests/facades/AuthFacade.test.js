/**
 * Tests para AuthFacade
 * Patron Facade - registra servicios mock en el container real
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { container } from '../../src/di/Container.js';
import { AuthFacade } from '../../src/facades/AuthFacade.js';

describe('AuthFacade', () => {
  let mockAuthService, mockLogger, facade;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthService = {
      registerUser: jest.fn(),
      loginUser: jest.fn(),
      getCurrentUser: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    // Registrar mocks en el container real (sobrescribir si existen)
    container.services.set('authService', { factory: () => mockAuthService, singleton: false });
    container.services.set('logger', { factory: () => mockLogger, singleton: false });
    // Limpiar singletons para que se creen nuevos
    container.singletons.delete('authService');
    container.singletons.delete('logger');

    facade = new AuthFacade();
  });

  afterEach(() => {
    // No eliminar authService/logger - son servicios reales del sistema
    // Solo limpiar los singletons que creamos
    container.singletons.delete('authService');
    container.singletons.delete('logger');
  });

  describe('register()', () => {
    it('debe registrar un usuario y retornar el resultado', async () => {
      const userData = { cedula: '123', nombre: 'Test' };
      const expected = { id: 1, cedula: '123' };
      mockAuthService.registerUser.mockResolvedValue(expected);

      const result = await facade.register(userData);

      expect(mockAuthService.registerUser).toHaveBeenCalledWith(userData);
      expect(result).toEqual(expected);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Iniciando registro de usuario',
        expect.objectContaining({ cedula: '123' })
      );
    });

    it('debe lanzar el error si registerUser falla', async () => {
      const error = new Error('DB error');
      mockAuthService.registerUser.mockRejectedValue(error);

      await expect(facade.register({ cedula: '999' })).rejects.toThrow('DB error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('login()', () => {
    it('debe autenticar un usuario y retornar token', async () => {
      const expected = { token: 'abc123', user: { id: 1 } };
      mockAuthService.loginUser.mockResolvedValue(expected);

      const result = await facade.login('123', 'pass');

      expect(mockAuthService.loginUser).toHaveBeenCalledWith('123', 'pass');
      expect(result).toEqual(expected);
    });

    it('debe lanzar el error si loginUser falla', async () => {
      mockAuthService.loginUser.mockRejectedValue(new Error('Invalid credentials'));
      await expect(facade.login('bad', 'wrong')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('getProfile()', () => {
    it('debe retornar el perfil del usuario', async () => {
      const profile = { id: 1, nombre: 'Test', rol: 'Admin' };
      mockAuthService.getCurrentUser.mockResolvedValue(profile);

      const result = await facade.getProfile(1);

      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(1);
      expect(result).toEqual(profile);
    });

    it('debe lanzar el error si getCurrentUser falla', async () => {
      mockAuthService.getCurrentUser.mockRejectedValue(new Error('Not found'));
      await expect(facade.getProfile(99)).rejects.toThrow('Not found');
    });
  });
});