/**
 * Tests unitarios para AuthService
 * 
 * Ejecutar con: npm test -- authService.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthService } from '../../src/services/authService.js';
import { AuthenticationError } from '../../src/utils/errors.js';

// Mock de dependencias
const mockUserRepository = {
  findByCedula: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
};

const mockPasswordService = {
  hash: jest.fn(),
  compare: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(
      mockUserRepository,
      null, // roleRepository
      mockPasswordService,
      mockJwtService,
      mockLogger
    );
  });

  describe('loginUser', () => {
    it('debe autenticar un usuario con credenciales válidas', async () => {
      const mockUser = {
        id_usuario: 1,
        cedula: '1234567890',
        contrasena: 'hashedPassword',
        nombre_usuario: 'Test User',
        correo: 'test@example.com',
        telefono: '1234567890',
        nombre_rol: 'Aprendiz',
        requiere_cambio_contrasena: false,
      };

      mockUserRepository.findByCedula.mockResolvedValue(mockUser);
      mockPasswordService.compare.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await authService.loginUser('1234567890', 'password123');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.cedula).toBe('1234567890');
      expect(mockUserRepository.findByCedula).toHaveBeenCalledWith('1234567890');
      expect(mockPasswordService.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
    });

    it('debe lanzar error si el usuario no existe', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(null);

      await expect(
        authService.loginUser('1234567890', 'password123')
      ).rejects.toThrow(AuthenticationError);

      expect(mockPasswordService.compare).not.toHaveBeenCalled();
    });

    it('debe lanzar error si la contraseña es incorrecta', async () => {
      const mockUser = {
        id_usuario: 1,
        cedula: '1234567890',
        contrasena: 'hashedPassword',
      };

      mockUserRepository.findByCedula.mockResolvedValue(mockUser);
      mockPasswordService.compare.mockResolvedValue(false);

      await expect(
        authService.loginUser('1234567890', 'wrongPassword')
      ).rejects.toThrow(AuthenticationError);
    });
  });
});


