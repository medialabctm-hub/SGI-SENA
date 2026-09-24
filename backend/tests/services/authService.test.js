/**
 * Tests unitarios para AuthService
 *
 * Ejecutar con: npm test -- authService.test.js
 */

import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthService, hashResetToken } from '../../src/services/authService.js';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../../src/utils/errors.js';
import { REGISTER_APRENDIZ_DENIED_MESSAGE } from '../../src/utils/authRegisterGate.js';

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
  getBlockingDependencies: jest.fn().mockResolvedValue([]),
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
  contrasena: 'Pass123*Seg',
  rol: 'Aprendiz',
};


const rosterHit = (documento = '1234567890') => [[
  { id_aprendiz: 10, nombre: 'Test User', documento, ficha: 'F-100' },
]];
const rosterMiss = () => [[]];

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
      mockUserRepository.db.execute.mockResolvedValue(rosterHit());

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
      mockUserRepository.db.execute.mockResolvedValue(rosterHit());

      const result = await authService.loginUser('1234567890', 'pass');
      expect(result.requiereCambioContrasena).toBe(true);
    });

    it('debe denegar login de Aprendiz sin vínculo a roster (fail-closed H-03)', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(baseUser);
      mockPasswordService.compare.mockResolvedValue(true);
      mockUserRepository.db.execute.mockResolvedValue(rosterMiss());

      await expect(authService.loginUser('1234567890', 'pass')).rejects.toThrow(AuthenticationError);
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('debe autenticar Instructor sin consultar roster Aprendices', async () => {
      const instructor = { ...baseUser, nombre_rol: 'Instructor' };
      mockUserRepository.findByCedula.mockResolvedValue(instructor);
      mockPasswordService.compare.mockResolvedValue(true);

      const result = await authService.loginUser('1234567890', 'pass');
      expect(result.token).toBe('mock-jwt-token');
      expect(mockUserRepository.db.execute).not.toHaveBeenCalled();
    });
  });

  // ─── validateUserData ───────────────────────────────────────────────────────
  describe('validateUserData', () => {
    it('debe pasar validación con datos correctos', () => {
      expect(() =>
        authService.validateUserData({
          correo: 'test@example.com',
          contrasena: 'Pass123*',
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
    it('debe registrar un nuevo usuario Aprendiz exitosamente vía roster', async () => {
      mockUserRepository.db.execute.mockResolvedValue(rosterHit());
      mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
      mockUserRepository.findInactiveByCedulaOrEmail.mockResolvedValue(null);
      mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3 });
      mockUserRepository.create.mockResolvedValue({ insertId: 1 });

      const result = await authService.registerUser(validAprendizData);
      expect(result.message).toContain('registrado');
      expect(mockPasswordService.hash).toHaveBeenCalled();
      expect(mockUserRepository.db.execute).toHaveBeenCalledWith(
        expect.stringContaining('FROM Aprendices'),
        ['1234567890']
      );
    });

    it('debe rechazar Aprendiz sin invitación ni roster con mensaje genérico 400', async () => {
      mockUserRepository.db.execute.mockResolvedValue(rosterMiss());

      await expect(authService.registerUser(validAprendizData)).rejects.toMatchObject({
        name: 'ValidationError',
        message: REGISTER_APRENDIZ_DENIED_MESSAGE,
        statusCode: 400,
      });
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('debe rechazar Aprendiz con usuario existente con el mismo mensaje genérico', async () => {
      mockUserRepository.db.execute.mockResolvedValue(rosterHit());
      mockUserRepository.findByCedulaOrEmail.mockResolvedValue({ id_usuario: 99 });

      await expect(authService.registerUser(validAprendizData)).rejects.toMatchObject({
        name: 'ValidationError',
        message: REGISTER_APRENDIZ_DENIED_MESSAGE,
        statusCode: 400,
      });
    });

    it('debe eliminar usuario inactivo y registrar el nuevo (vía roster)', async () => {
      mockUserRepository.db.execute.mockResolvedValue(rosterHit());
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
      mockUserRepository.db.execute.mockResolvedValue(rosterHit());
      mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
      mockUserRepository.findInactiveByCedulaOrEmail.mockResolvedValue(null);
      mockRoleRepository.findByName.mockResolvedValue(null);

      await expect(authService.registerUser(validAprendizData)).rejects.toThrow(ValidationError);
    });

    it('debe convertir error de clave duplicada en mensaje genérico para Aprendiz', async () => {
      mockUserRepository.db.execute.mockResolvedValue(rosterHit());
      mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
      mockUserRepository.findInactiveByCedulaOrEmail.mockResolvedValue(null);
      mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3 });
      mockUserRepository.create.mockRejectedValue(new Error('El usuario ya está registrado'));

      await expect(authService.registerUser(validAprendizData)).rejects.toMatchObject({
        name: 'ValidationError',
        message: REGISTER_APRENDIZ_DENIED_MESSAGE,
      });
    });

    it('debe re-lanzar errores genéricos de la BD', async () => {
      mockUserRepository.db.execute.mockResolvedValue(rosterHit());
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
      mockUserRepository.db.execute.mockResolvedValue(rosterHit());
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
      mockUserRepository.db.execute.mockResolvedValue(rosterHit());
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
      mockUserRepository.db.execute.mockResolvedValue(rosterHit());
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
        it('debe retornar usuario por cédula sin contrasena (MDL-230)', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(baseUser);
      const result = await authService.getUserByCedula('1234567890');
      expect(result.id_usuario).toBe(1);
      expect(result).not.toHaveProperty('contrasena');
      expect(JSON.stringify(result)).not.toMatch(/\$2[aby]\$/);
    });

    it('debe lanzar NotFoundError si no existe usuario con esa cédula', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(null);
      await expect(authService.getUserByCedula('0000000')).rejects.toThrow(NotFoundError);
    });

    it('debe devolver un aprendiz importado como origen aprendiz cuando no existe cuenta', async () => {
      mockUserRepository.findByCedula.mockResolvedValue(null);
      mockUserRepository.db.execute.mockResolvedValueOnce([[
        { id_aprendiz: 44, nombre: 'Aprendiz Importado', documento: ' TI-44 ', ficha: 'F-1' }
      ]]);

      await expect(authService.getUserByCedula(' TI-44 ')).resolves.toEqual({
        origen: 'aprendiz',
        id_usuario: null,
        id_aprendiz: 44,
        nombre: 'Aprendiz Importado',
        nombre_usuario: 'Aprendiz Importado',
        documento: 'TI-44',
        ficha: 'F-1'
      });
      expect(mockUserRepository.db.execute).toHaveBeenCalledWith(
        expect.stringContaining('FROM Aprendices'),
        ['TI-44']
      );
    });
  });

  // ─── updateUser ─────────────────────────────────────────────────────────────
  describe('updateUser', () => {
    const selfActor = { id: 1, rol: 'Aprendiz' };
    const adminActor = { id: 99, rol: 'Administrador' };

    beforeEach(() => {
      mockUserRepository.findById.mockResolvedValue({ ...baseUser });
    });

    it('debe actualizar nombre/teléfono cuando cedula/correo no cambian (QA-192A-01)', async () => {
      mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3 });
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });

      const result = await authService.updateUser(1, {
        nombre: 'Nuevo Nombre',
        telefono: '3009876543',
        cedula: ' 1234567890 ',
        correo: ' Test@Example.com ',
        rol: 'Aprendiz',
      }, selfActor);

      expect(result.message).toContain('actualizado');
      const [, updateArg] = mockUserRepository.update.mock.calls[0];
      expect(updateArg).not.toHaveProperty('cedula');
      expect(updateArg).not.toHaveProperty('correo');
      expect(updateArg).not.toHaveProperty('contrasena_actual');
      expect(mockPasswordService.compare).not.toHaveBeenCalled();
    });

    it('rechaza cambio de cédula propia (QA-192A-02)', async () => {
      await expect(
        authService.updateUser(1, { cedula: '9999999999', correo: baseUser.correo }, selfActor)
      ).rejects.toThrow(ValidationError);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('trata cédula con espacios como no-cambio (QA-192A-03)', async () => {
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });
      const result = await authService.updateUser(1, {
        nombre: 'Test User',
        cedula: ' 1234567890 ',
      }, selfActor);
      expect(result.message).toContain('actualizado');
      expect(mockUserRepository.update.mock.calls[0][1]).not.toHaveProperty('cedula');
    });

    it('exige contrasena_actual correcta para cambio de correo propio (QA-192A-04)', async () => {
      mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashedPassword' });
      mockPasswordService.compare.mockResolvedValue(true);
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });

      const payload = {
        correo: 'nuevo@test.com',
        contrasena_actual: 'Pass123*Seg',
      };
      const result = await authService.updateUser(1, payload, selfActor);
      expect(result.message).toContain('actualizado');
      expect(payload).not.toHaveProperty('contrasena_actual');
      const [, updateArg] = mockUserRepository.update.mock.calls[0];
      expect(updateArg.correo).toBe('nuevo@test.com');
      expect(updateArg).not.toHaveProperty('contrasena_actual');
    });

    it('rechaza con mensaje genérico si contrasena_actual es incorrecta (QA-192A-05)', async () => {
      mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashedPassword' });
      mockPasswordService.compare.mockResolvedValue(false);

      await expect(
        authService.updateUser(1, {
          correo: 'nuevo@test.com',
          contrasena_actual: 'WrongPass1*',
        }, selfActor)
      ).rejects.toThrow(/No se pudo completar la operación/);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('correo solo casing/espacios no exige contraseña (QA-192A-06)', async () => {
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });
      const result = await authService.updateUser(1, {
        nombre: 'Test User',
        correo: ' Test@Example.COM ',
      }, selfActor);
      expect(result.message).toContain('actualizado');
      expect(mockPasswordService.compare).not.toHaveBeenCalled();
      expect(mockUserRepository.update.mock.calls[0][1]).not.toHaveProperty('correo');
    });

    it('Admin no puede cambiar su propia cédula aunque ownership lo deje pasar (QA-192A-08/11)', async () => {
      mockUserRepository.findById.mockResolvedValue({
        ...baseUser,
        id_usuario: 99,
        cedula: '1111111111',
        nombre_rol: 'Administrador',
      });
      await expect(
        authService.updateUser(99, { cedula: '2222222222' }, { id: 99, rol: 'Administrador' })
      ).rejects.toThrow(ValidationError);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('Admin cambia cédula ajena con motivo (QA-192A-09)', async () => {
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });
      const result = await authService.updateUser(1, {
        cedula: '9876543210',
        motivo: 'Corrección de documento',
      }, adminActor);
      expect(result.message).toContain('actualizado');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cambio de identidad (cédula) por administrador',
        expect.objectContaining({
          targetUserId: 1,
          adminId: 99,
          field: 'cedula',
          motivo: 'Corrección de documento',
        })
      );
      const logMeta = mockLogger.info.mock.calls.find(
        ([msg]) => msg.includes('Cambio de identidad')
      )[1];
      expect(JSON.stringify(logMeta)).not.toContain('9876543210');
    });

    it('Admin sin motivo al cambiar cédula ajena → rechazo (QA-192A-10)', async () => {
      await expect(
        authService.updateUser(1, { cedula: '9876543210' }, adminActor)
      ).rejects.toThrow(ValidationError);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('Admin cambia correo ajeno con motivo (log sin valor de correo)', async () => {
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });
      const result = await authService.updateUser(1, {
        correo: 'nuevo-admin-target@test.com',
        motivo: 'Actualización de contacto institucional',
      }, adminActor);
      expect(result.message).toContain('actualizado');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cambio de identidad (correo) por administrador',
        expect.objectContaining({
          targetUserId: 1,
          adminId: 99,
          field: 'correo',
          motivo: 'Actualización de contacto institucional',
        })
      );
      const logMeta = mockLogger.info.mock.calls.find(
        ([msg]) => msg.includes('Cambio de identidad (correo)')
      )[1];
      const blob = JSON.stringify(logMeta);
      expect(blob).not.toContain('nuevo-admin-target@test.com');
      expect(blob).not.toContain(baseUser.correo);
    });

    it('Admin sin motivo al cambiar correo ajeno → rechazo genérico', async () => {
      await expect(
        authService.updateUser(1, { correo: 'otro@test.com' }, adminActor)
      ).rejects.toThrow(/No se pudo completar la operación/);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('Admin cambia cédula y correo ajenos con un solo motivo', async () => {
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });
      await authService.updateUser(1, {
        cedula: '5555555555',
        correo: 'ambos@test.com',
        motivo: 'Corrección integral de ficha',
      }, adminActor);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cambio de identidad (cédula) por administrador',
        expect.objectContaining({ field: 'cedula', motivo: 'Corrección integral de ficha' })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cambio de identidad (correo) por administrador',
        expect.objectContaining({ field: 'correo', motivo: 'Corrección integral de ficha' })
      );
      const [, updateArg] = mockUserRepository.update.mock.calls[0];
      expect(updateArg.cedula).toBe('5555555555');
      expect(updateArg.correo).toBe('ambos@test.com');
    });

    it('correo propio sigue exigiendo contrasena_actual, no motivo', async () => {
      mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashedPassword' });
      mockPasswordService.compare.mockResolvedValue(true);
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });

      await authService.updateUser(1, {
        correo: 'mio-nuevo@test.com',
        contrasena_actual: 'Pass123*Seg',
        motivo: 'no-debe-bastar-solo',
      }, selfActor);

      expect(mockPasswordService.compare).toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Cambio de identidad (correo)'),
        expect.anything()
      );
    });

    it('borra contrasena_actual del payload y no lo pasa al repositorio (sentinel)', async () => {
      const SENTINEL = 'SENTINEL_Pwd_MDL192_X9!';
      mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashedPassword' });
      mockPasswordService.compare.mockResolvedValue(true);
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });

      const payload = { correo: 'otro@test.com', contrasena_actual: SENTINEL };
      await authService.updateUser(1, payload, selfActor);

      expect(payload).not.toHaveProperty('contrasena_actual');
      const [, updateArg] = mockUserRepository.update.mock.calls[0];
      expect(JSON.stringify(updateArg)).not.toContain(SENTINEL);
      expect(updateArg).not.toHaveProperty('contrasena_actual');
    });

    it('debe lanzar ValidationError cuando no hay campos para actualizar', async () => {
      await expect(authService.updateUser(1, {}, selfActor)).rejects.toThrow(ValidationError);
    });

    it('debe lanzar ValidationError con correo inválido', async () => {
      mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashed' });
      mockPasswordService.compare.mockResolvedValue(true);
      await expect(
        authService.updateUser(1, { correo: 'not-valid', contrasena_actual: 'Pass123*Seg' }, selfActor)
      ).rejects.toThrow(ValidationError);
    });

    it('debe lanzar ValidationError si el rol no existe', async () => {
      mockRoleRepository.findByName.mockResolvedValue(null);
      await expect(
        authService.updateUser(1, { nombre: 'Test', rol: 'RolInexistente' }, selfActor)
      ).rejects.toThrow(ValidationError);
    });

    it('debe lanzar NotFoundError si el usuario no existe', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      await expect(
        authService.updateUser(1, { nombre: 'Test' }, selfActor)
      ).rejects.toThrow(NotFoundError);
    });

    it('Admin puede actualizar teléfono/nombre de otro sin tocar identidad', async () => {
      mockUserRepository.update.mockResolvedValue({ affectedRows: 1 });
      const result = await authService.updateUser(1, {
        telefono: '3009876543',
        cedula: baseUser.cedula,
        correo: baseUser.correo,
      }, adminActor);
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
      mockUserRepository.getBlockingDependencies.mockResolvedValue([]);
      mockUserRepository.delete.mockResolvedValue({ affectedRows: 1 });
      const result = await authService.deleteUser(1);
      expect(result.message).toContain('eliminado');
    });

    it('debe lanzar NotFoundError si el usuario no existe', async () => {
      mockUserRepository.getBlockingDependencies.mockResolvedValue([]);
      mockUserRepository.delete.mockResolvedValue({ affectedRows: 0 });
      await expect(authService.deleteUser(999)).rejects.toThrow(NotFoundError);
    });

    // ERR-02: el motivo real llega al usuario en vez de un error de servidor
    it('debe explicar el motivo cuando el usuario tiene registros asociados', async () => {
      mockUserRepository.getBlockingDependencies.mockResolvedValue([
        { cantidad: 3, etiqueta: 'equipo registrado', etiquetaPlural: 'equipos registrados' },
        { cantidad: 1, etiqueta: 'clase asignada', etiquetaPlural: 'clases asignadas' },
      ]);

      await expect(authService.deleteUser(5)).rejects.toThrow(ConflictError);
      await expect(authService.deleteUser(5)).rejects.toThrow(/3 equipos registrados/);
      await expect(authService.deleteUser(5)).rejects.toThrow(/1 clase asignada/);
      // No se intenta el borrado si hay dependencias
      expect(mockUserRepository.delete).not.toHaveBeenCalled();
    });
  });

  // ─── cambiarContrasenaObligatorio ───────────────────────────────────────────
  describe('cambiarContrasenaObligatorio', () => {
    it('debe cambiar contraseña exitosamente', async () => {
      mockUserRepository.findById.mockResolvedValue(baseUser);
      mockUserRepository.findOne.mockResolvedValue({ contrasena: 'hashed', requiere_cambio_contrasena: 1 });
      mockPasswordService.compare.mockResolvedValue(true);

      const result = await authService.cambiarContrasenaObligatorio(1, 'actual123', 'Nueva123*');
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
      // H-09: la búsqueda usa el HASH del token, nunca el token en claro.
      const lookupArgs = mockUserRepository.findOne.mock.calls[0][1];
      expect(lookupArgs).toEqual([hashResetToken('valid_token')]);
      expect(lookupArgs).not.toContain('valid_token');
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

      const result = await authService.restablecerContrasena('abc', 'ValidPass123*');
      expect(result.message).toContain('Contraseña');
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      // H-09: la fila del token se busca y se marca como usada por su HASH.
      expect(mockUserRepository.findOne.mock.calls[0][1]).toEqual([hashResetToken('abc')]);
      const updateTokenCall = mockConnection.execute.mock.calls.find(
        (c) => /UPDATE Tokens_Recuperacion_Contrasena/.test(c[0])
      );
      expect(updateTokenCall).toBeDefined();
      expect(updateTokenCall[1]).toEqual([hashResetToken('abc')]);
    });

    it('debe hacer rollback y re-lanzar error en fallo de transacción', async () => {
      mockUserRepository.findOne.mockResolvedValue({ token: 'abc', id_usuario: 1 });
      mockConnection.execute.mockRejectedValueOnce(new Error('DB error en transacción'));

      await expect(
        authService.restablecerContrasena('abc', 'ValidPass123*')
      ).rejects.toThrow('DB error en transacción');

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });
});




// ─── H-09: helper hashResetToken ─────────────────────────────────────────────
describe('hashResetToken (H-09)', () => {
  it('produce el SHA-256 hex del token (64 chars) y no el token en claro', () => {
    const raw = 'a'.repeat(64);
    const esperado = crypto.createHash('sha256').update(raw).digest('hex');
    const h = hashResetToken(raw);
    expect(h).toBe(esperado);
    expect(h).toHaveLength(64);
    expect(h).not.toBe(raw);
  });

  it('es determinista para el mismo token', () => {
    expect(hashResetToken('token-x')).toBe(hashResetToken('token-x'));
  });

  it('produce hashes distintos para tokens distintos', () => {
    expect(hashResetToken('token-a')).not.toBe(hashResetToken('token-b'));
  });
});
