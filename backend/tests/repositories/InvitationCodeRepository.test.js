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
  // consumeCode()
  // ──────────────────────────────────────────────
  describe('consumeCode()', () => {
    const makeConnection = () => ({
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    });

    it('debe bloquear la fila y actualizar el cupo dentro de una transacción', async () => {
      const connection = makeConnection();
      const code = {
        id_codigo: 8,
        codigo: 'ATOMIC-001',
        rol_destinado: 'Instructor',
        fecha_expiracion: null,
        max_usos: 2,
        usos_actuales: 1,
        estado: 'Activo',
      };
      connection.execute
        .mockResolvedValueOnce([[code]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      db.pool.getConnection.mockResolvedValue(connection);

      const result = await repo.consumeCode('ATOMIC-001');

      expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(connection.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/SELECT[\s\S]*FOR UPDATE/i),
        ['ATOMIC-001']
      );
      expect(connection.execute).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(/SET usos_actuales = usos_actuales \+ 1[\s\S]*max_usos/i),
        [8]
      );
      expect(connection.commit).toHaveBeenCalledTimes(1);
      expect(connection.release).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expect.objectContaining({ consumed: true, reason: 'consumed' }));
      expect(result.code.usos_actuales).toBe(2);
      expect(result.code.estado).toBe('Agotado');
    });

    it('debe marcar agotado sin incrementar cuando el cupo ya está consumido', async () => {
      const connection = makeConnection();
      const code = {
        id_codigo: 9,
        codigo: 'ATOMIC-FULL',
        rol_destinado: 'Instructor',
        fecha_expiracion: null,
        max_usos: 1,
        usos_actuales: 1,
        estado: 'Activo',
      };
      connection.execute
        .mockResolvedValueOnce([[code]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
      db.pool.getConnection.mockResolvedValue(connection);

      const result = await repo.consumeCode('ATOMIC-FULL');

      expect(result).toEqual(expect.objectContaining({ consumed: false, reason: 'exhausted' }));
      expect(connection.execute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('SET estado = ?'),
        ['Agotado', 9]
      );
      expect(connection.commit).toHaveBeenCalledTimes(1);
    });

    it('debe serializar dos consumos concurrentes sin superar el último cupo', async () => {
      const state = {
        id_codigo: 10,
        codigo: 'RACE-001',
        rol_destinado: 'Instructor',
        fecha_expiracion: null,
        max_usos: 1,
        usos_actuales: 0,
        estado: 'Activo',
      };
      let lockTail = Promise.resolve();
      const connections = [];
      const acquireLock = async () => {
        const previous = lockTail;
        let release;
        lockTail = new Promise((resolve) => { release = resolve; });
        await previous;
        return release;
      };
      const makeSerializedConnection = () => {
        let releaseLock;
        const connection = makeConnection();
        connection.execute.mockImplementation(async (query) => {
          if (/FOR UPDATE/i.test(query)) {
            releaseLock = await acquireLock();
            return [[{ ...state }]];
          }
          if (/SET usos_actuales = usos_actuales \+ 1/i.test(query)) {
            if (state.estado !== 'Activo' || state.usos_actuales >= state.max_usos) {
              return [{ affectedRows: 0 }];
            }
            state.usos_actuales += 1;
            state.estado = 'Agotado';
            return [{ affectedRows: 1 }];
          }
          if (/SET estado = \?/i.test(query)) {
            state.estado = 'Agotado';
            return [{ affectedRows: 1 }];
          }
          throw new Error(`Consulta no simulada: ${query}`);
        });
        connection.commit.mockImplementation(async () => {
          releaseLock?.();
        });
        connection.rollback.mockImplementation(async () => {
          releaseLock?.();
        });
        connections.push(connection);
        return connection;
      };
      db.pool.getConnection.mockImplementation(async () => makeSerializedConnection());

      const results = await Promise.all([
        repo.consumeCode('RACE-001'),
        repo.consumeCode('RACE-001'),
      ]);

      expect(results.filter(result => result.consumed)).toHaveLength(1);
      expect(results.filter(result => !result.consumed && result.reason === 'exhausted')).toHaveLength(1);
      expect(state.usos_actuales).toBe(1);
      expect(connections).toHaveLength(2);
      expect(connections.every(connection => connection.commit.mock.calls.length === 1)).toBe(true);
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
