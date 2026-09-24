/**
 * MDL-202 / H-03 — gate de registro Aprendiz (invitación + roster).
 *
 * Suite aislada con mock ESM de ServiceFactory para el camino por invitación.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';
import { REGISTER_APRENDIZ_DENIED_MESSAGE } from '../../src/utils/authRegisterGate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mockValidateCode = jest.fn();
const mockUseCode = jest.fn();

jest.unstable_mockModule(
  path.resolve(__dirname, '../../src/factories/ServiceFactory.js'),
  () => ({
    ServiceFactory: {
      create: jest.fn((name) => {
        if (name === 'invitationCodeService') {
          return { validateCode: mockValidateCode, useCode: mockUseCode };
        }
        throw new Error(`Unexpected service: ${name}`);
      }),
    },
  })
);

const { AuthService } = await import('../../src/services/authService.js');
const { ValidationError } = await import('../../src/utils/errors.js');

const mockUserRepository = {
  findByCedulaOrEmail: jest.fn(),
  findInactiveByCedulaOrEmail: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  db: { execute: jest.fn() },
};

const mockRoleRepository = { findByName: jest.fn() };
const mockPasswordService = { hash: jest.fn().mockResolvedValue('hashed') };
const mockJwtService = { sign: jest.fn() };
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const baseAprendiz = {
  nombre: 'Ana Aprendiz',
  cedula: '1098765432',
  tipo_documento: 'CC',
  correo: 'ana@sena.edu.co',
  telefono: '3001112233',
  contrasena: 'Pass1234*',
  rol: 'Aprendiz',
};

describe('AuthService — gate registro Aprendiz (MDL-202/H-03)', () => {
  let authService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPasswordService.hash.mockResolvedValue('hashed');
    mockValidateCode.mockResolvedValue({ codigo: 'INV-OK' });
    mockUseCode.mockResolvedValue({ consumed: true });
    mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
    mockUserRepository.findInactiveByCedulaOrEmail.mockResolvedValue(null);
    mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3 });
    mockUserRepository.create.mockResolvedValue({ insertId: 77 });
    mockUserRepository.db.execute.mockResolvedValue([[]]);

    authService = new AuthService(
      mockUserRepository,
      mockRoleRepository,
      mockPasswordService,
      mockJwtService,
      mockLogger
    );
  });

  it('registra Aprendiz con invitación válida (201 path / consume código)', async () => {
    const result = await authService.registerUser({
      ...baseAprendiz,
      codigo_invitacion: 'INV-APRENDIZ-1',
    });

    expect(result).toEqual({ message: 'Usuario registrado correctamente' });
    expect(mockValidateCode).toHaveBeenCalledWith('INV-APRENDIZ-1', 'Aprendiz');
    expect(mockUseCode).toHaveBeenCalledWith('INV-APRENDIZ-1');
    expect(mockUserRepository.create).toHaveBeenCalled();
    // Sin consulta de roster cuando hay invitación
    expect(mockUserRepository.db.execute).not.toHaveBeenCalled();
  });

  it('rechaza Aprendiz con invitación inválida con mensaje genérico (no filtra causa)', async () => {
    mockValidateCode.mockRejectedValue(new ValidationError('Código de invitación inválido o no encontrado'));

    await expect(
      authService.registerUser({ ...baseAprendiz, codigo_invitacion: 'BAD-CODE' })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      message: REGISTER_APRENDIZ_DENIED_MESSAGE,
      statusCode: 400,
    });

    expect(mockUseCode).not.toHaveBeenCalled();
    expect(mockUserRepository.create).not.toHaveBeenCalled();
  });

  it('registra Aprendiz cuando la cédula está en roster Aprendices (camino institucional)', async () => {
    mockUserRepository.db.execute.mockResolvedValue([[
      { id_aprendiz: 5, nombre: 'Ana Aprendiz', documento: '1098765432', ficha: 'F-9' },
    ]]);

    const result = await authService.registerUser(baseAprendiz);

    expect(result.message).toContain('registrado');
    expect(mockValidateCode).not.toHaveBeenCalled();
    expect(mockUserRepository.db.execute).toHaveBeenCalledWith(
      expect.stringContaining('FROM Aprendices'),
      ['1098765432']
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('roster institucional'),
      expect.objectContaining({ cedula: '1098765432', id_aprendiz: 5 })
    );
  });

  it('rechaza Aprendiz sin invitación ni fila en roster', async () => {
    mockUserRepository.db.execute.mockResolvedValue([[]]);

    await expect(authService.registerUser(baseAprendiz)).rejects.toMatchObject({
      message: REGISTER_APRENDIZ_DENIED_MESSAGE,
      statusCode: 400,
    });
  });

  it('Instructor sin código sigue fallando con mensaje específico (sin cambio)', async () => {
    await expect(
      authService.registerUser({ ...baseAprendiz, rol: 'Instructor' })
    ).rejects.toThrow(/código de invitación es requerido/);
  });
});
