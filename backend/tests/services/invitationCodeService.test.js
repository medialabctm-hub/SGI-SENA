/**
 * Tests para services/invitationCodeService
 *
 * Cubre: generateCode, validateCode, useCode, createCode,
 *        getAllCodes, getCodeById, deleteCode, deactivateCode
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { InvitationCodeService } from '../../src/services/invitationCodeService.js';
import { ValidationError, NotFoundError } from '../../src/utils/errors.js';

// Helper: crea servicio con repositorio y logger mockeados
function makeService() {
  const mockRepo = {
    updateExpiredCodes: jest.fn().mockResolvedValue(undefined),
    findByCode: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ insertId: 1 }),
    delete: jest.fn().mockResolvedValue(undefined),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    incrementUsage: jest.fn().mockResolvedValue(undefined),
  };
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return { service: new InvitationCodeService(mockRepo, mockLogger), mockRepo, mockLogger };
}

// ──────────────────────────────────────────────
// generateCode
// ──────────────────────────────────────────────
describe('generateCode()', () => {
  it('debe devolver un string de 12 caracteres en mayúsculas', () => {
    const { service } = makeService();
    const code = service.generateCode();
    expect(typeof code).toBe('string');
    expect(code.length).toBe(12);
    expect(code).toBe(code.toUpperCase());
  });

  it('debe devolver solo caracteres hexadecimales en mayúsculas', () => {
    const { service } = makeService();
    const code = service.generateCode();
    expect(code).toMatch(/^[0-9A-F]{12}$/);
  });

  it('debe generar códigos distintos en llamadas sucesivas', () => {
    const { service } = makeService();
    const codes = new Set(Array.from({ length: 10 }, () => service.generateCode()));
    // Es estadísticamente imposible que todos sean iguales
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ──────────────────────────────────────────────
// validateCode
// ──────────────────────────────────────────────
describe('validateCode()', () => {
  it('debe lanzar ValidationError si el código es vacío', async () => {
    const { service } = makeService();
    await expect(service.validateCode('', 'Instructor')).rejects.toThrow(ValidationError);
  });

  it('debe lanzar ValidationError si el código es solo espacios', async () => {
    const { service } = makeService();
    await expect(service.validateCode('   ', 'Instructor')).rejects.toThrow(ValidationError);
  });

  it('debe llamar updateExpiredCodes antes de buscar el código', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue(null);
    await expect(service.validateCode('CODIGO1', 'Instructor')).rejects.toThrow();
    expect(mockRepo.updateExpiredCodes).toHaveBeenCalledTimes(1);
  });

  it('debe lanzar ValidationError si el código no existe', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue(null);
    await expect(service.validateCode('NOEXISTE', 'Instructor')).rejects.toThrow('inválido');
  });

  it('debe lanzar ValidationError si el código está Inactivo', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue({
      codigo: 'ABC123',
      estado: 'Inactivo',
      rol_destinado: 'Instructor',
      max_usos: 1,
      usos_actuales: 0,
      fecha_expiracion: null,
    });
    await expect(service.validateCode('ABC123', 'Instructor')).rejects.toThrow('inactivo');
  });

  it('debe lanzar ValidationError si el código está Expirado', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue({
      codigo: 'ABC123',
      estado: 'Expirado',
      rol_destinado: 'Instructor',
      max_usos: 1,
      usos_actuales: 0,
      fecha_expiracion: null,
    });
    await expect(service.validateCode('ABC123', 'Instructor')).rejects.toThrow('expirado');
  });

  it('debe lanzar ValidationError si el rol no coincide con el destinado', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue({
      codigo: 'ABC123',
      estado: 'Activo',
      rol_destinado: 'Instructor',
      max_usos: 5,
      usos_actuales: 0,
      fecha_expiracion: null,
    });
    await expect(service.validateCode('ABC123', 'Aprendiz')).rejects.toThrow('Instructor');
  });

  it('debe lanzar ValidationError y marcar Expirado si fecha de expiración ha pasado', async () => {
    const { service, mockRepo } = makeService();
    const fechaPasada = new Date(Date.now() - 86400000).toISOString();
    mockRepo.findByCode.mockResolvedValue({
      codigo: 'EXPIRED1',
      estado: 'Activo',
      rol_destinado: 'Instructor',
      max_usos: 10,
      usos_actuales: 0,
      fecha_expiracion: fechaPasada,
    });
    await expect(service.validateCode('EXPIRED1', 'Instructor')).rejects.toThrow('expirado');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('EXPIRED1', 'Expirado');
  });

  it('debe lanzar ValidationError y marcar Agotado si usos >= max_usos', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue({
      codigo: 'FULL123',
      estado: 'Activo',
      rol_destinado: 'Instructor',
      max_usos: 5,
      usos_actuales: 5,
      fecha_expiracion: null,
    });
    await expect(service.validateCode('FULL123', 'Instructor')).rejects.toThrow('límite');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('FULL123', 'Agotado');
  });

  it('no debe marcar Agotado si max_usos es 0 (ilimitado) aunque usos sea alto', async () => {
    const { service, mockRepo } = makeService();
    const mockCode = {
      codigo: 'UNLIMITED',
      estado: 'Activo',
      rol_destinado: 'Instructor',
      max_usos: 0,
      usos_actuales: 999,
      fecha_expiracion: null,
    };
    mockRepo.findByCode.mockResolvedValue(mockCode);
    const result = await service.validateCode('UNLIMITED', 'Instructor');
    expect(result).toBe(mockCode);
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('debe devolver el código cuando todas las validaciones pasan', async () => {
    const { service, mockRepo } = makeService();
    const mockCode = {
      codigo: 'VALID123',
      estado: 'Activo',
      rol_destinado: 'Instructor',
      max_usos: 5,
      usos_actuales: 2,
      fecha_expiracion: null,
    };
    mockRepo.findByCode.mockResolvedValue(mockCode);
    const result = await service.validateCode('VALID123', 'Instructor');
    expect(result).toBe(mockCode);
  });
});

// ──────────────────────────────────────────────
// useCode
// ──────────────────────────────────────────────
describe('useCode()', () => {
  it('debe llamar incrementUsage con el código correcto', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue({
      codigo: 'ABC123',
      max_usos: 5,
      usos_actuales: 2,
    });
    await service.useCode('ABC123');
    expect(mockRepo.incrementUsage).toHaveBeenCalledWith('ABC123');
  });

  it('debe llamar logger.info tras usar el código', async () => {
    const { service, mockRepo, mockLogger } = makeService();
    mockRepo.findByCode.mockResolvedValue({
      codigo: 'ABC123',
      max_usos: 5,
      usos_actuales: 2,
    });
    await service.useCode('ABC123');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Código de invitación usado',
      { codigo: 'ABC123' }
    );
  });

  it('debe marcar Agotado si usos_actuales alcanza max_usos tras incremento', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue({
      codigo: 'FULL123',
      max_usos: 3,
      usos_actuales: 3,
    });
    await service.useCode('FULL123');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('FULL123', 'Agotado');
  });

  it('no debe marcar Agotado si max_usos es 0 (ilimitado)', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue({
      codigo: 'UNLIMITED',
      max_usos: 0,
      usos_actuales: 100,
    });
    await service.useCode('UNLIMITED');
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('no debe marcar Agotado si el código no existe después del incremento', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue(null);
    await service.useCode('GHOST');
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// createCode
// ──────────────────────────────────────────────
describe('createCode()', () => {
  it('debe lanzar ValidationError si no se provee rol_destinado', async () => {
    const { service } = makeService();
    await expect(service.createCode({ max_usos: 1 })).rejects.toThrow(ValidationError);
  });

  it('debe lanzar ValidationError si fecha_expiracion está en el pasado', async () => {
    const { service } = makeService();
    const pasado = new Date(Date.now() - 86400000).toISOString();
    await expect(
      service.createCode({ rol_destinado: 'Instructor', fecha_expiracion: pasado })
    ).rejects.toThrow('pasado');
  });

  it('debe crear un código exitosamente con los datos correctos', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue(null); // código único
    mockRepo.create.mockResolvedValue({ insertId: 7 });

    const result = await service.createCode({
      rol_destinado: 'Instructor',
      max_usos: 3,
      creado_por: 1,
    });

    expect(result.id_codigo).toBe(7);
    expect(result.rol_destinado).toBe('Instructor');
    expect(result.estado).toBe('Activo');
    expect(result.max_usos).toBe(3);
    expect(typeof result.codigo).toBe('string');
  });

  it('debe usar max_usos = 1 por defecto', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({ insertId: 1 });

    const result = await service.createCode({ rol_destinado: 'Instructor' });
    expect(result.max_usos).toBe(1);
  });

  it('debe reintentar generación si el código ya existe', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode
      .mockResolvedValueOnce({ codigo: 'EXISTE1' })
      .mockResolvedValueOnce(null); // segundo intento es único
    mockRepo.create.mockResolvedValue({ insertId: 5 });

    const result = await service.createCode({ rol_destinado: 'Instructor' });
    expect(result.estado).toBe('Activo');
    // findByCode fue llamado dos veces durante la generación + una vez en el check
    expect(mockRepo.findByCode).toHaveBeenCalledTimes(2);
  });

  it('debe lanzar Error genérico si falla la generación después de 10 intentos', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue({ codigo: 'SIEMPRE_EXISTE' });

    await expect(
      service.createCode({ rol_destinado: 'Instructor' })
    ).rejects.toThrow('No se pudo generar un código único');
  });

  it('debe aceptar fecha_expiracion futura', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({ insertId: 2 });
    const futuro = new Date(Date.now() + 86400000).toISOString();

    const result = await service.createCode({
      rol_destinado: 'Instructor',
      fecha_expiracion: futuro,
    });
    expect(result.fecha_expiracion).toBe(futuro);
  });

  it('debe llamar logger.info con el código creado', async () => {
    const { service, mockRepo, mockLogger } = makeService();
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({ insertId: 1 });

    await service.createCode({ rol_destinado: 'Instructor' });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Código de invitación creado',
      expect.objectContaining({ rol_destinado: 'Instructor' })
    );
  });
});

// ──────────────────────────────────────────────
// getAllCodes
// ──────────────────────────────────────────────
describe('getAllCodes()', () => {
  it('debe llamar updateExpiredCodes y findAll con los filtros dados', async () => {
    const { service, mockRepo } = makeService();
    const mockList = [{ id_codigo: 1 }];
    mockRepo.findAll.mockResolvedValue(mockList);

    const result = await service.getAllCodes({ estado: 'Activo' });

    expect(mockRepo.updateExpiredCodes).toHaveBeenCalled();
    expect(mockRepo.findAll).toHaveBeenCalledWith({ estado: 'Activo' });
    expect(result).toBe(mockList);
  });

  it('debe llamar findAll con objeto vacío si no se pasan filtros', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findAll.mockResolvedValue([]);

    await service.getAllCodes();

    expect(mockRepo.findAll).toHaveBeenCalledWith({});
  });
});

// ──────────────────────────────────────────────
// getCodeById
// ──────────────────────────────────────────────
describe('getCodeById()', () => {
  it('debe devolver el código si existe', async () => {
    const { service, mockRepo } = makeService();
    const mockCode = { id_codigo: 1, codigo: 'ABC123' };
    mockRepo.findById.mockResolvedValue(mockCode);

    const result = await service.getCodeById(1);
    expect(result).toBe(mockCode);
  });

  it('debe lanzar NotFoundError si no existe', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.getCodeById(99)).rejects.toThrow(NotFoundError);
  });

  it('debe pasar el id correcto a findById', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findById.mockResolvedValue({ id_codigo: 42, codigo: 'XYZ' });

    await service.getCodeById(42);
    expect(mockRepo.findById).toHaveBeenCalledWith(42);
  });
});

// ──────────────────────────────────────────────
// deleteCode
// ──────────────────────────────────────────────
describe('deleteCode()', () => {
  it('debe lanzar NotFoundError si el código no existe', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.deleteCode(99)).rejects.toThrow(NotFoundError);
  });

  it('debe llamar delete con el id correcto', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findById.mockResolvedValue({ id_codigo: 1, codigo: 'ABC123' });

    await service.deleteCode(1);

    expect(mockRepo.delete).toHaveBeenCalledWith(1);
  });

  it('debe llamar logger.info con el id eliminado', async () => {
    const { service, mockRepo, mockLogger } = makeService();
    mockRepo.findById.mockResolvedValue({ id_codigo: 1, codigo: 'ABC123' });

    await service.deleteCode(1);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Código de invitación eliminado',
      { id: 1 }
    );
  });
});

// ──────────────────────────────────────────────
// deactivateCode
// ──────────────────────────────────────────────
describe('deactivateCode()', () => {
  it('debe lanzar NotFoundError si el código no existe', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findById.mockResolvedValue(null);

    await expect(service.deactivateCode(99)).rejects.toThrow(NotFoundError);
  });

  it('debe llamar updateStatus con Inactivo', async () => {
    const { service, mockRepo } = makeService();
    mockRepo.findById.mockResolvedValue({ id_codigo: 2, codigo: 'XYZ789' });

    await service.deactivateCode(2);

    expect(mockRepo.updateStatus).toHaveBeenCalledWith('XYZ789', 'Inactivo');
  });

  it('debe llamar logger.info con el id y el código', async () => {
    const { service, mockRepo, mockLogger } = makeService();
    mockRepo.findById.mockResolvedValue({ id_codigo: 2, codigo: 'XYZ789' });

    await service.deactivateCode(2);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Código de invitación desactivado',
      { id: 2, codigo: 'XYZ789' }
    );
  });
});
