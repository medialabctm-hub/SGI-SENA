/**
 * Tests unitarios para AuthService
 *
 * Ejecutar con: npm test -- authService.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthService } from '../../src/services/authService.js';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../../src/utils/errors.js';

// ─── Mocks de conexión de BD (para transacciones) ───────────────────────────
const mockConnection = {
  beginTransaction: jest.fn().mockResolvedValue(undefined),
  execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
  commit: jest.fn().mockResolvedValue(undefined),
  rollback: jest.fn().mockResolvedValue(undefined),
  release: jest.fn(),
};

// ─── Mock de repositorios ────────────────────────────────────────────────────
const mockUserRepository = {
  findByCedula: jest.fn(),
  findByCedulaOrEmail: jest.fn(),
  findInactiveByCedulaOrEmail: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  getAssignedEquipos: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findOne: jest.fn(),
  db: {
    execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
    pool: {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
    },
  },
};

const mockRoleRepository = {
  findByName: jest.fn(),
};

// ─── Mock de servicios de apoyo ──────────────────────────────────────────────
const mockPasswordService = {
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// ─── Datos reutilizables ─────────────────────────────────────────────────────
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

const validAprendizData = {
  nombre: 'Test User',
  cedula: '1234567890',
  tipo_documento: 'CC',
  correo: 'test@example.com',
  telefono: '3001234567',
  contrasena: 'pass123',
  rol: 'Aprendiz',
};

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Restablecer implementaciones por defecto que clearAllMocks limpia de "once"
    mockPasswordService.hash.mockResolvedValue('hashed_password');
    mockJwtService.sign.mockReturnValue('mock-jwt-token');
    mockUserRepository.db.execute.mockResolvedValue([{ affectedRows: 1 }]);
    mockUserRepository.db.pool.getConnection.mockResolvedValue(mockConnection);
    mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);
    mockConnection.beginTransaction.mockResolvedValue(undefined);
    mockConnection.commit.mockResolvedValue(undefined);
    mockConnection.rollback.mockResolvedValue(undefined);

    authService = new AuthService(
      mockUserRepository,
      mockRoleRepository,
      mockPasswordService,
      mockJwtService,
      mockLogger
    );
  });

  // ─── loginUser ──────────────────────────────────────────────────────────────
  describe('loginUser', () => {
    it('debe autenticar un usuario con credenciales válidas', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(baseUser);
      mockPasswordService.compare.mockResolvedValue(true);

      const result = await authService.loginUser('1234567890', 'password123');

      expect(result).toHaveProperty('token', 'mock-jwt-token');
      expect(result).toHaveProperty('user');
      expect(result.user.cedula).toBe('1234567890');
      expect(mockUserRepository.findByCedula).toHaveBeenCalledWith('1234567890');
      expect(mockPasswordService.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
    });

    it('debe lanzar AuthenticationError si el usuario no existe', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(null);

      await expect(
        authService.loginUser('1234567890', 'password123')
      ).rejects.toThrow(AuthenticationError);

      expect(mockPasswordService.compare).not.toHaveBeenCalled();
    });

    it('debe lanzar AuthenticationError si la contraseña es incorrecta', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(baseUser);
      mockPasswordService.compare.mockResolvedValue(false);

      await expect(
        authService.loginUser('1234567890', 'wrongPassword')
      ).rejects.toThrow(AuthenticationError);
    });

    it('debe incluir requiereCambioContrasena true cuando el campo es 1', async () => {
      const userWithChange = { ...baseUser, requiere_cambio_contrasena: 1 };
      mockUserRepository.findByCedula.mockResolvedValue(userWithChange);
      mockPasswordService.compare.mockResolvedValue(true);

      const result = await authService.loginUser('1234567890', 'pass');
      expect(result.requiereCambioContrasena).toBe(true);
    });
  });

  // ─── validateUserData ───────────────────────────────────────────────────────
  describe('validateUserData', () => {
    it('debe pasar validación con datos correctos', () => {
      expect(() =>
        authService.validateUserData({
          correo: 'test@example.com',
          contrasena: 'pass123',
          cedula: '12345',
        })
      ).not.toThrow();
    });

    it('debe lanzar ValidationError con correo inválido', () => {
      expect(() =>
        authService.validateUserData({ correo: 'no-email', contrasena: 'pass123', cedula: '12345' })
      ).toThrow(ValidationError);
    });

    it('debe lanzar ValidationError con contraseña muy corta', () => {
      expect(() =>
        authService.validateUserData({ correo: 'test@example.com', contrasena: 'abc', cedula: '12345' })
      ).toThrow(ValidationError);
    });

    it('debe lanzar ValidationError con cédula muy corta', () => {
      expect(() =>
        authService.validateUserData({ correo: 'test@example.com', contrasena: 'pass123', cedula: '123' })
      ).toThrow(ValidationError);
    });

    it('debe acumular múltiples errores de validación', () => {
      try {
        authService.validateUserData({ correo: 'no-email', contrasena: 'ab', cedula: '12' });
        expect(true).toBe(false); // must not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect(e.details.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ─── registerUser ───────────────────────────────────────────────────────────
  describe('registerUser', () => {
    it('debe registrar un nuevo usuario Aprendiz exitosamente', async () => {
      mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
      mockUserRepository.findInactiveByCedulaOrEmail.mockResolvedValue(null);
      mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3 });
      mockUserRepository.create.mockResolvedValue({ insertId: 1 });

      const result = await authService.registerUser(validAprendizData);
      expect(result.message).toContain('registrado');
      expect(mockPasswordService.hash).toHaveBeenCalled();
    });

    it('debe lanzar ConflictError si el usuario activo ya existe', async () => {
      mockUserRepository.findByCedulaOrEmail.mockResolvedValue({ id_usuario: 99 });

      await expect(authService.registerUser(validAprendizData)).rejects.toThrow(ConflictError);
    });

    it('debe eliminar usuario inactivo y registrar el nuevo', async () => {
      mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
      mockUserRepository.findInactiveByCedulaOrEmail.mockResolvedValue({ id_usuario: 5 });
      mockUserRepository.delete.mockResolvedValue({ affectedRows: 1 });
      mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3 });
      mockUserRepository.create.mockResolvedValue({ insertId: 1 });

      const result = await authService.registerUser(validAprendizData);
      expect(mockUserRepository.delete).toHaveBeenCalledWith(5);
      expect(result.message).toContain('registrado');
    });

    it('debe lanzar ValidationError si el rol no existe en BD', async () => {
      mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
      mockUserRepository.findInactiveByCedulaOrEmail.mockResolvedValue(null);
      mockRoleRepository.findByName.mockResolvedValue(null);

      await expect(authService.registerUser(validAprendizData)).rejects.toThrow(ValidationError);
    });

    it('debe convertir error de clave duplicada en ConflictError', async () => {
      mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
      mockUserRepository.findInactiveByCedulaOrEmail.mockResolvedValue(null);
      mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3 });
      mockUserRepository.create.mockRejectedValue(new Error('El usuario ya está registrado'));

      await expect(authService.registerUser(validAprendizData)).rejects.toThrow(ConflictError);
    });

    it('debe re-lanzar errores genéricos de la BD', async () => {
      mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
      mockUserRepository.findInactiveByCedulaOrEmail.mockResolvedValue(null);
      mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3 });
      mockUserRepository.create.mockRejectedValue(new Error('DB connection failed'));

      await expect(authService.registerUser(validAprendizData)).rejects.toThrow('DB connection failed');
    });

    it('debe lanzar ValidationError para Instructor sin código de invitación', async () => {
      const data = { ...validAprendizData, rol: 'Instructor' };
      await expect(authService.registerUser(data)).rejects.toThrow(ValidationError);
    });

    it('debe lanzar ValidationError para Administrador sin código de invitación', async () => {
      const data = { ...validAprendizData, rol: 'Administrador' };
      await expect(authService.registerUser(data)).rejects.toThrow(ValidationError);
    });

    it('debe lanzar ValidationError para Cuentadante sin código de invitación', async () => {
      const data = { ...validAprendizData, rol: 'Cuentadante' };
      await expect(authService.registerUser(data)).rejects.toThrow(ValidationError);
    });

    it('debe lanzar ValidationError con correo inválido en los datos', async () => {
      const badData = { ...validAprendizData, correo: 'not-valid' };
      await expect(authService.registerUser(badData)).rejects.toThrow(ValidationError);
    });

    it('debe usar tipo_documento_otro cuando tipo_documento es Otro', async () => {
      const otroData = { ...validAprendizData, tipo_documento: 'Otro', tipo_documento_otro: 'Pasaporte' };
      mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
      mockUserRepository.findInactiveByCedulaOrEmail.mockResolvedValue(null);
      mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3 });
      mockUserRepository.create.mockResolvedValue({ insertId: 1 });

      const result = await authService.registerUser(otroData);
      expect(result.message).toContain('registrado');
    });
  });

  // ─── loginUserWithPlaca ─────────────────────────────────────────────────────
  describe('loginUserWithPlaca', () => {
    it('debe autenticar usuario con placa correctamente asignada', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(baseUser);
      mockPasswordService.compare.mockResolvedValue(true);
      mockUserRepository.getAssignedEquipos.mockResolvedValue([
        { placa: 'ABC123', codigo_equipo: 'EQ1', tipo: 'Laptop', modelo: 'Dell' },
      ]);

      const result = await authService.loginUserWithPlaca('1234567890', 'pass', 'ABC123');

      expect(result.token).toBe('mock-jwt-token');
      expect(result.equipo.placa).toBe('ABC123');
    });

    it('debe lanzar AuthenticationError si el usuario no existe', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(null);
      await expect(
        authService.loginUserWithPlaca('123', 'pass', 'ABC123')
      ).rejects.toThrow(AuthenticationError);
    });

    it('debe lanzar AuthenticationError si la contraseña es incorrecta', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(baseUser);
      mockPasswordService.compare.mockResolvedValue(false);
      await expect(
        authService.loginUserWithPlaca('123', 'wrong', 'ABC123')
      ).rejects.toThrow(AuthenticationError);
    });

    it('debe lanzar AuthenticationError si la placa no está asignada al usuario', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(baseUser);
      mockPasswordService.compare.mockResolvedValue(true);
      mockUserRepository.getAssignedEquipos.mockResolvedValue([{ placa: 'XYZ999' }]);

      await expect(
        authService.loginUserWithPlaca('123', 'pass', 'ABC123')
      ).rejects.toThrow(AuthenticationError);
    });

    it('debe retornar requiereCambioContrasena=true cuando el campo es 1', async () => {
      const userChange = { ...baseUser, requiere_cambio_contrasena: 1 };
      mockUserRepository.findByCedula.mockResolvedValue(userChange);
      mockPasswordService.compare.mockResolvedValue(true);
      mockUserRepository.getAssignedEquipos.mockResolvedValue([
        { placa: 'ABC123', codigo_equipo: 'EQ1', tipo: 'Laptop', modelo: 'Dell' },
      ]);

      const result = await authService.loginUserWithPlaca('123', 'pass', 'ABC123');
      expect(result.requiereCambioContrasena).toBe(true);
    });
  });

  // ─── getCurrentUser ─────────────────────────────────────────────────────────
  describe('getCurrentUser', () => {
    it('debe retornar datos del usuario autenticado', async () => {
      mockUserRepository.findById.mockResolvedValue(baseUser);

      const result = await authService.getCurrentUser(1);
      expect(result.id_usuario).toBe(1);
      expect(result.requiere_cambio_contrasena).toBe(false);
    });

    it('debe retornar requiereCambioContrasena=true cuando es 1', async () => {
      mockUserRepository.findById.mockResolvedValue({ ...baseUser, requiere_cambio_contrasena: 1 });

      const result = await authService.getCurrentUser(1);
      expect(result.requiere_cambio_contrasena).toBe(true);
    });

    it('debe lanzar NotFoundError si el usuario no existe', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      await expect(authService.getCurrentUser(999)).rejects.toThrow(NotFoundError);
    });
  });

  // ─── listUsers ──────────────────────────────────────────────────────────────
  describe('listUsers', () => {
    it('debe retornar todos los usuarios sin filtro', async () => {
      mockUserRepository.findAll.mockResolvedValue([baseUser]);
      const result = await authService.listUsers();
      expect(result).toHaveLength(1);
      expect(mockUserRepository.findAll).toHaveBeenCalledWith(null);
    });

    it('debe filtrar usuarios por rol', async () => {
      mockUserRepository.findAll.mockResolvedValue([baseUser]);
      await authService.listUsers('Aprendiz');
      expect(mockUserRepository.findAll).toHaveBeenCalledWith('Aprendiz');
    });
  });

  // ─── getUserDetails ─────────────────────────────────────────────────────────
  describe('getUserDetails', () => {
    it('debe retornar usuario con sus equipos asignados', async () => {
      mockUserRepository.findById.mockResolvedValue(baseUser);
      mockUserRepository.getAssignedEquipos.mockResolvedValue([{ id_equipo: 10 }]);

      const result = await authService.getUserDetails(1);
      expect(result.user.id_usuario).toBe(1);
      expect(result.equipos).toHaveLength(1);
    });

    it('debe lanzar NotFoundError si el usuario no existe', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      await expect(authService.getUserDetails(999)).rejects.toThrow(NotFoundError);
    });
  });

  // ─── getUserByCedula ────────────────────────────────────────────────────────
  describe('getUserByCedula', () => {
    it('debe retornar usuario por cédula', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(baseUser);
      const result = await authService.getUserByCedula('1234567890');
      expect(result.id_usuario).toBe(1);
    });

    it('debe lanzar NotFoundError si no existe usuario con esa cédula', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(null);
      await expect(authService.getUserByCedula('0000000')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── updateUser ─────────────────────────────────────────────────────────────
  describe('updateUser', () => {
    it('debe actualizar usuario exitosamente con nombre y rol', async () => {
      mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3 });
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });

      const result = await authService.updateUser(1, { nombre: 'Nuevo Nombre', rol: 'Aprendiz' });
      expect(result.message).toContain('actualizado');
    });

    it('debe actualizar solo el correo válido sin cambiar rol', async () => {
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });

      const result = await authService.updateUser(1, { correo: 'nuevo@test.com' });
      expect(result.message).toContain('actualizado');
    });

    it('debe lanzar ValidationError cuando no hay campos para actualizar', async () => {
      await expect(authService.updateUser(1, {})).rejects.toThrow(ValidationError);
    });

    it('debe lanzar ValidationError con correo inválido', async () => {
      await expect(authService.updateUser(1, { correo: 'not-valid' })).rejects.toThrow(ValidationError);
    });

    it('debe lanzar ValidationError si el rol no existe', async () => {
      mockRoleRepository.findByName.mockResolvedValue(null);
      await expect(
        authService.updateUser(1, { nombre: 'Test', rol: 'RolInexistente' })
      ).rejects.toThrow(ValidationError);
    });

    it('debe lanzar NotFoundError si el usuario no existe', async () => {
      mockUserRepository.update.mockResolvedValue({ affectedRows: 0 });
      await expect(authService.updateUser(1, { nombre: 'Test' })).rejects.toThrow(NotFoundError);
    });

    it('debe actualizar teléfono y cédula', async () => {
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });
      const result = await authService.updateUser(1, { telefono: '3009876543', cedula: '9876543210' });
      expect(result.message).toContain('actualizado');
    });
  });

  // ─── updateUserProfilePhoto ─────────────────────────────────────────────────
  describe('updateUserProfilePhoto', () => {
    it('debe actualizar foto cuando no hay foto previa', async () => {
      mockUserRepository.findById
        .mockResolvedValueOnce({ ...baseUser, foto_perfil: null })
        .mockResolvedValueOnce({ ...baseUser, foto_perfil: '/uploads/perfiles/nueva.jpg' });
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });

      const result = await authService.updateUserProfilePhoto(1, '/uploads/perfiles/nueva.jpg');
      expect(result.message).toContain('Foto');
      expect(result.foto_perfil).toBe('/uploads/perfiles/nueva.jpg');
    });

    it('debe lanzar NotFoundError si el usuario no existe', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      await expect(authService.updateUserProfilePhoto(999, '/photo.jpg')).rejects.toThrow(NotFoundError);
    });

    it('debe lanzar NotFoundError si la actualización no afecta filas', async () => {
      mockUserRepository.findById.mockResolvedValue({ ...baseUser, foto_perfil: null });
      mockUserRepository.update.mockResolvedValue({ affectedRows: 0 });
      await expect(authService.updateUserProfilePhoto(1, '/photo.jpg')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── deleteUser ─────────────────────────────────────────────────────────────
  describe('deleteUser', () => {
    it('debe eliminar usuario correctamente', async () => {
      mockUserRepository.delete.mockResolvedValue({ affectedRows: 1 });
      const result = await authService.deleteUser(1);
      expect(result.message).toContain('eliminado');
    });

    it('debe lanzar NotFoundError si el usuario no existe', async () => {
      mockUserRepository.delete.mockResolvedValue({ affectedRows: 0 });
      await expect(authService.deleteUser(999)).rejects.toThrow(NotFoundError);
    });
  });

  // ─── cambiarContrasenaObligatorio ───────────────────────────────────────────
  describe('cambiarContrasenaObligatorio', () => {
    it('debe cambiar contraseña exitosamente', async () => {
      mockUserRepository.findById.mockResolvedValue(baseUser);
      mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashed', requiere_cambio_contrasena: 1 });
      mockPasswordService.compare.mockResolvedValue(true);

      const result = await authService.cambiarContrasenaObligatorio(1, 'actual123', 'nueva123');
      expect(result.message).toContain('Contraseña');
      expect(mockUserRepository.db.execute).toHaveBeenCalled();
    });

    it('debe lanzar NotFoundError si findById no encuentra al usuario', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      await expect(
        authService.cambiarContrasenaObligatorio(999, 'old', 'new123')
      ).rejects.toThrow(NotFoundError);
    });

    it('debe lanzar NotFoundError si findOne no retorna datos de contraseña', async () => {
      mockUserRepository.findById.mockResolvedValue(baseUser);
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(
        authService.cambiarContrasenaObligatorio(1, 'old', 'new123')
      ).rejects.toThrow(NotFoundError);
    });

    it('debe lanzar AuthenticationError si la contraseña actual es incorrecta', async () => {
      mockUserRepository.findById.mockResolvedValue(baseUser);
      mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashed' });
      mockPasswordService.compare.mockResolvedValue(false);
      await expect(
        authService.cambiarContrasenaObligatorio(1, 'wrong', 'new123')
      ).rejects.toThrow(AuthenticationError);
    });

    it('debe lanzar ValidationError si la nueva contraseña es muy corta', async () => {
      mockUserRepository.findById.mockResolvedValue(baseUser);
      mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashed' });
      mockPasswordService.compare.mockResolvedValue(true);
      await expect(
        authService.cambiarContrasenaObligatorio(1, 'actual', 'abc')
      ).rejects.toThrow(ValidationError);
    });
  });

  // ─── validarTokenRecuperacion ───────────────────────────────────────────────
  describe('validarTokenRecuperacion', () => {
    it('debe retornar datos de un token válido', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        token: 'valid_token',
        nombre_usuario: 'Test',
        correo: 'test@example.com',
      });

      const result = await authService.validarTokenRecuperacion('valid_token');
      expect(result.token).toBe('valid_token');
      expect(result.nombre_usuario).toBe('Test');
    });

    it('debe lanzar AuthenticationError con token inválido o expirado', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(authService.validarTokenRecuperacion('bad_token')).rejects.toThrow(AuthenticationError);
    });
  });

  // ─── solicitarRecuperacionContrasena ────────────────────────────────────────
  describe('solicitarRecuperacionContrasena', () => {
    it('debe retornar mensaje genérico cuando el usuario no existe por cédula', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(null)  // usuarioPorCedula
        .mockResolvedValueOnce(null); // usuario (correo+cédula activo)

      const result = await authService.solicitarRecuperacionContrasena('000', 'nope@test.com');
      expect(result.message).toContain('Si el usuario');
    });

    it('debe retornar mensaje genérico cuando existe por cédula pero el correo no coincide', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce({
          id_usuario: 1,
          nombre_usuario: 'Test',
          correo: 'real@test.com',
          estado: 'Activo',
        })
        .mockResolvedValueOnce(null); // correo no coincide → usuario null

      const result = await authService.solicitarRecuperacionContrasena('123', 'wrong@test.com');
      expect(result.message).toContain('Si el usuario');
    });
  });

  // ─── restablecerContrasena ──────────────────────────────────────────────────
  describe('restablecerContrasena', () => {
    it('debe lanzar AuthenticationError con token inválido o expirado', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      await expect(
        authService.restablecerContrasena('invalid_token', 'nuevaPass123')
      ).rejects.toThrow(AuthenticationError);
    });

    it('debe lanzar ValidationError si la nueva contraseña es inválida', async () => {
      mockUserRepository.findOne.mockResolvedValue({ token: 'abc', id_usuario: 1 });
      await expect(
        authService.restablecerContrasena('abc', 'abc')
      ).rejects.toThrow(ValidationError);
    });

    it('debe restablecer la contraseña exitosamente', async () => {
      mockUserRepository.findOne.mockResolvedValue({ token: 'abc', id_usuario: 1 });

      const result = await authService.restablecerContrasena('abc', 'validPass123');
      expect(result.message).toContain('Contraseña');
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('debe hacer rollback y re-lanzar error en fallo de transacción', async () => {
      mockUserRepository.findOne.mockResolvedValue({ token: 'abc', id_usuario: 1 });
      mockConnection.execute.mockRejectedValueOnce(new Error('DB error en transacción'));

      await expect(
        authService.restablecerContrasena('abc', 'validPass123')
      ).rejects.toThrow('DB error en transacción');

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });
});



