/**
 * Tests para repositories/InvitationCodeRepository
 *
 * Cubre: findByCode, create, incrementUsage, updateStatus,
 *        findAll, findById, delete, updateExpiredCodes
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InvitationCodeRepository } from '../../src/repositories/InvitationCodeRepository.js';

// ──────────────────────────────────────────────
// Mock de db
// ──────────────────────────────────────────────
function makeMockDb() {
  return {
    execute: jest.fn(),
    pool: { getConnection: jest.fn() },
  };
}

describe('InvitationCodeRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = makeMockDb();
    repo = new InvitationCodeRepository(db);
  });

  // ──────────────────────────────────────────────
  // findByCode()
  // ──────────────────────────────────────────────
  describe('findByCode()', () => {
    it('debe retornar el código cuando existe y está activo', async () => {
      const mockCode = { id_codigo: 1, codigo: 'SENA-2026', rol_destinado: 'Instructor', estado: 'Activo' };
      db.execute.mockResolvedValue([[mockCode]]);

      const result = await repo.findByCode('SENA-2026');

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining("estado = 'Activo'"),
        ['SENA-2026']
      );
      expect(result).toEqual(mockCode);
    });

    it('debe retornar null si el código no existe o está inactivo', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.findByCode('INEXISTENTE');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // create()
  // ──────────────────────────────────────────────
  describe('create()', () => {
    it('debe insertar el código y retornar insertId y affectedRows', async () => {
      db.execute.mockResolvedValue([{ insertId: 10, affectedRows: 1 }]);

      const result = await repo.create({
        codigo: 'NUEVO-001',
        rol_destinado: 'Aprendiz',
        fecha_expiracion: '2026-12-31',
        max_usos: 5,
        creado_por: 1,
      });

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO Invitation_Codes'),
        expect.arrayContaining(['NUEVO-001', 'Aprendiz'])
      );
      expect(result).toEqual({ insertId: 10, affectedRows: 1 });
    });

    it('debe usar valores por defecto para max_usos y creado_por', async () => {
      db.execute.mockResolvedValue([{ insertId: 11, affectedRows: 1 }]);

      await repo.create({ codigo: 'MIN-001', rol_destinado: 'Aprendiz' });

      const params = db.execute.mock.calls[0][1];
      // max_usos default 1 y creado_por default null
      expect(params).toContain(1); // max_usos
      expect(params).toContain(null); // creado_por
    });

    it('debe usar null si fecha_expiracion no se proporciona', async () => {
      db.execute.mockResolvedValue([{ insertId: 12, affectedRows: 1 }]);

      await repo.create({ codigo: 'SIN-EXP', rol_destinado: 'Instructor', max_usos: 1, creado_por: 1 });

      const params = db.execute.mock.calls[0][1];
      expect(params[2]).toBeNull(); // fecha_expiracion en posición 2
    });
  });

  // ──────────────────────────────────────────────
  // incrementUsage()
  // ──────────────────────────────────────────────
  describe('incrementUsage()', () => {
    it('debe ejecutar UPDATE incrementando usos_actuales', async () => {
      const mockResult = { affectedRows: 1 };
      db.execute.mockResolvedValue([mockResult]);

      const result = await repo.incrementUsage('SENA-2026');

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('usos_actuales = usos_actuales + 1'),
        ['SENA-2026']
      );
      expect(result).toEqual(mockResult);
    });

    it('debe retornar el resultado de la actualización', async () => {
      const mockResult = { affectedRows: 0 };
      db.execute.mockResolvedValue([mockResult]);

      const result = await repo.incrementUsage('NO-EXISTE');

      expect(result.affectedRows).toBe(0);
    });
  });

  // ──────────────────────────────────────────────
  // updateStatus()
  // ──────────────────────────────────────────────
  describe('updateStatus()', () => {
    it('debe actualizar el estado del código', async () => {
      const mockResult = { affectedRows: 1 };
      db.execute.mockResolvedValue([mockResult]);

      const result = await repo.updateStatus('SENA-2026', 'Expirado');

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('SET estado = ?'),
        ['Expirado', 'SENA-2026']
      );
      expect(result).toEqual(mockResult);
    });

    it('debe pasar los parámetros en el orden correcto (estado, codigo)', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.updateStatus('CODIGO-X', 'Agotado');

      const params = db.execute.mock.calls[0][1];
      expect(params[0]).toBe('Agotado');
      expect(params[1]).toBe('CODIGO-X');
    });
  });

  // ──────────────────────────────────────────────
  // findAll()
  // ──────────────────────────────────────────────
  describe('findAll()', () => {
    it('debe retornar todos los códigos sin filtros', async () => {
      const mockCodes = [
        { id_codigo: 1, codigo: 'A', estado: 'Activo' },
        { id_codigo: 2, codigo: 'B', estado: 'Expirado' },
      ];
      db.execute.mockResolvedValue([mockCodes]);

      const result = await repo.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockCodes);
    });

    it('debe filtrar por rol cuando se proporciona', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findAll({ rol: 'Instructor' });

      const query = db.execute.mock.calls[0][0];
      expect(query).toContain('rol_destinado = ?');
      expect(db.execute.mock.calls[0][1]).toContain('Instructor');
    });

    it('debe filtrar por estado cuando se proporciona', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findAll({ estado: 'Activo' });

      const query = db.execute.mock.calls[0][0];
      expect(query).toContain('ic.estado = ?');
      expect(db.execute.mock.calls[0][1]).toContain('Activo');
    });

    it('debe filtrar por rol y estado simultáneamente', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findAll({ rol: 'Aprendiz', estado: 'Activo' });

      const query = db.execute.mock.calls[0][0];
      expect(query).toContain('rol_destinado = ?');
      expect(query).toContain('ic.estado = ?');
    });
  });

  // ──────────────────────────────────────────────
  // findById()
  // ──────────────────────────────────────────────
  describe('findById()', () => {
    it('debe retornar el código por ID', async () => {
      const mockCode = { id_codigo: 5, codigo: 'TEST-X', estado: 'Activo' };
      db.execute.mockResolvedValue([[mockCode]]);

      const result = await repo.findById(5);

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('id_codigo = ?'),
        [5]
      );
      expect(result).toEqual(mockCode);
    });

    it('debe retornar null si no existe el ID', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.findById(9999);

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // delete()
  // ──────────────────────────────────────────────
  describe('delete()', () => {
    it('debe ejecutar DELETE con el ID correcto', async () => {
      const mockResult = { affectedRows: 1 };
      db.execute.mockResolvedValue([mockResult]);

      const result = await repo.delete(5);

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM Invitation_Codes'),
        [5]
      );
      expect(result).toEqual(mockResult);
    });

    it('debe retornar affectedRows=0 si el ID no existe', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 0 }]);

      const result = await repo.delete(9999);

      expect(result.affectedRows).toBe(0);
    });
  });

  // ──────────────────────────────────────────────
  // updateExpiredCodes()
  // ──────────────────────────────────────────────
  describe('updateExpiredCodes()', () => {
    it('debe ejecutar dos UPDATEs y retornar { expired, exhausted }', async () => {
      db.execute
        .mockResolvedValueOnce([{ affectedRows: 3 }])  // Expirados
        .mockResolvedValueOnce([{ affectedRows: 2 }]); // Agotados

      const result = await repo.updateExpiredCodes();

      expect(db.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ expired: 3, exhausted: 2 });
    });

    it('debe retornar ceros si no hay códigos expirados ni agotados', async () => {
      db.execute
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await repo.updateExpiredCodes();

      expect(result).toEqual({ expired: 0, exhausted: 0 });
    });

    it('la primera query debe actualizar a estado Expirado por fecha', async () => {
      db.execute
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 0 }]);

      await repo.updateExpiredCodes();

      const query1 = db.execute.mock.calls[0][0];
      expect(query1).toContain("'Expirado'");
      expect(query1).toContain('fecha_expiracion');
    });

    it('la segunda query debe actualizar a estado Agotado por usos', async () => {
      db.execute
        .mockResolvedValueOnce([{ affectedRows: 0 }])
        .mockResolvedValueOnce([{ affectedRows: 0 }]);

      await repo.updateExpiredCodes();

      const query2 = db.execute.mock.calls[1][0];
      expect(query2).toContain("'Agotado'");
      expect(query2).toContain('usos_actuales');
    });
  });
});
