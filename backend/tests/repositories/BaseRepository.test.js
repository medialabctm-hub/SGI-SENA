/**
 * Tests para repositories/BaseRepository
 *
 * BaseRepository es abstracta: se instancia mediante una subclase concreta.
 * Cubre: execute(), findOne(), transaction()
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BaseRepository } from '../../src/repositories/BaseRepository.js';

// Subclase concreta para poder instanciar
class TestRepository extends BaseRepository {}

// ──────────────────────────────────────────────
// Mock de db (equivale al pool de mysql2)
// ──────────────────────────────────────────────
function makeMockDb(rows = []) {
  return {
    execute: jest.fn().mockResolvedValue([rows]),
    pool: {
      getConnection: jest.fn(),
    },
  };
}

describe('BaseRepository', () => {
  // ──────────────────────────────────────────────
  // Instanciación
  // ──────────────────────────────────────────────
  describe('constructor', () => {
    it('no debe poder instanciarse directamente', () => {
      expect(() => new BaseRepository({})).toThrow(
        'BaseRepository es una clase abstracta'
      );
    });

    it('debe instanciarse correctamente mediante una subclase', () => {
      const db = makeMockDb();
      const repo = new TestRepository(db);
      expect(repo).toBeInstanceOf(TestRepository);
      expect(repo).toBeInstanceOf(BaseRepository);
      expect(repo.db).toBe(db);
    });
  });

  // ──────────────────────────────────────────────
  // execute()
  // ──────────────────────────────────────────────
  describe('execute()', () => {
    let repo;
    let mockDb;

    beforeEach(() => {
      mockDb = makeMockDb([{ id: 1 }, { id: 2 }]);
      repo = new TestRepository(mockDb);
    });

    it('debe llamar db.execute() con la query y parámetros correctos', async () => {
      await repo.execute('SELECT * FROM Usuarios WHERE id = ?', [1]);

      expect(mockDb.execute).toHaveBeenCalledWith(
        'SELECT * FROM Usuarios WHERE id = ?',
        [1]
      );
    });

    it('debe retornar las filas del resultado', async () => {
      const rows = await repo.execute('SELECT * FROM Usuarios');
      expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('debe usar un array vacío como parámetros por defecto', async () => {
      await repo.execute('SELECT * FROM Usuarios');
      expect(mockDb.execute).toHaveBeenCalledWith('SELECT * FROM Usuarios', []);
    });

    it('debe propagar errores de la base de datos', async () => {
      mockDb.execute.mockRejectedValue(new Error('DB connection failed'));

      await expect(repo.execute('SELECT 1')).rejects.toThrow('DB connection failed');
    });
  });

  // ──────────────────────────────────────────────
  // findOne()
  // ──────────────────────────────────────────────
  describe('findOne()', () => {
    let repo;
    let mockDb;

    beforeEach(() => {
      mockDb = makeMockDb();
      repo = new TestRepository(mockDb);
    });

    it('debe retornar el primer elemento si hay resultados', async () => {
      mockDb.execute.mockResolvedValue([[{ id: 5, nombre: 'Test' }]]);

      const result = await repo.findOne('SELECT * FROM Usuarios WHERE id = ?', [5]);

      expect(result).toEqual({ id: 5, nombre: 'Test' });
    });

    it('debe retornar null si no hay resultados', async () => {
      mockDb.execute.mockResolvedValue([[]]);

      const result = await repo.findOne('SELECT * FROM Usuarios WHERE id = ?', [999]);

      expect(result).toBeNull();
    });

    it('debe pasar la query y parámetros a execute()', async () => {
      mockDb.execute.mockResolvedValue([[{ id: 1 }]]);

      await repo.findOne('SELECT * FROM Roles WHERE id = ?', [1]);

      expect(mockDb.execute).toHaveBeenCalledWith(
        'SELECT * FROM Roles WHERE id = ?',
        [1]
      );
    });

    it('debe propagar errores de la base de datos', async () => {
      mockDb.execute.mockRejectedValue(new Error('Timeout'));

      await expect(repo.findOne('SELECT 1')).rejects.toThrow('Timeout');
    });
  });

  // ──────────────────────────────────────────────
  // transaction()
  // ──────────────────────────────────────────────
  describe('transaction()', () => {
    let repo;
    let mockDb;
    let mockConnection;

    beforeEach(() => {
      mockConnection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      };

      mockDb = {
        execute: jest.fn(),
        pool: {
          getConnection: jest.fn().mockResolvedValue(mockConnection),
        },
      };

      repo = new TestRepository(mockDb);
    });

    it('debe ejecutar el callback, hacer commit y retornar el resultado', async () => {
      const callback = jest.fn().mockResolvedValue({ insertId: 10 });

      const result = await repo.transaction(callback);

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(mockConnection);
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(result).toEqual({ insertId: 10 });
    });

    it('debe hacer rollback si el callback lanza un error', async () => {
      const callback = jest.fn().mockRejectedValue(new Error('Fallo en la transacción'));

      await expect(repo.transaction(callback)).rejects.toThrow(
        'Fallo en la transacción'
      );

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('debe lanzar error si db.pool no existe', async () => {
      const repoSinPool = new TestRepository({ execute: jest.fn() });

      await expect(repoSinPool.transaction(jest.fn())).rejects.toThrow(
        'El repositorio no tiene acceso al pool de conexiones'
      );
    });

    it('siempre debe llamar connection.release() aunque falle el commit', async () => {
      mockConnection.commit.mockRejectedValue(new Error('Commit failed'));
      const callback = jest.fn().mockResolvedValue('ok');

      await expect(repo.transaction(callback)).rejects.toThrow('Commit failed');

      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });
  });
});
