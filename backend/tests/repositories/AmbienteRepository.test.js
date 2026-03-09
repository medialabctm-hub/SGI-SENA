/**
 * Tests para repositories/AmbienteRepository
 *
 * Cubre: findById, findByCodigo, findByNombre, findAll, create, update, delete
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AmbienteRepository } from '../../src/repositories/AmbienteRepository.js';

// ──────────────────────────────────────────────
// Mock de db
// ──────────────────────────────────────────────
function makeMockDb(rows = []) {
  return {
    execute: jest.fn().mockResolvedValue([rows]),
  };
}

describe('AmbienteRepository', () => {
  let mockDb;
  let repo;

  beforeEach(() => {
    mockDb = makeMockDb();
    repo = new AmbienteRepository(mockDb);
  });

  // ──────────────────────────────────────────────
  // findById()
  // ──────────────────────────────────────────────
  describe('findById()', () => {
    it('debe retornar el ambiente si existe', async () => {
      const ambiente = { id_ambiente: 1, codigo_ambiente: 'A101', nombre_ambiente: 'Aula 101' };
      mockDb.execute.mockResolvedValue([[ambiente]]);

      const result = await repo.findById(1);

      expect(result).toEqual(ambiente);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'SELECT * FROM Ambientes WHERE id_ambiente = ?',
        [1]
      );
    });

    it('debe retornar null si el ambiente no existe', async () => {
      mockDb.execute.mockResolvedValue([[]]);

      const result = await repo.findById(999);

      expect(result).toBeNull();
    });

    it('debe propagar errores de la base de datos', async () => {
      mockDb.execute.mockRejectedValue(new Error('DB error'));

      await expect(repo.findById(1)).rejects.toThrow('DB error');
    });
  });

  // ──────────────────────────────────────────────
  // findByCodigo()
  // ──────────────────────────────────────────────
  describe('findByCodigo()', () => {
    it('debe retornar el ambiente por código', async () => {
      const ambiente = { id_ambiente: 2, codigo_ambiente: 'B202', nombre_ambiente: 'Lab 202' };
      mockDb.execute.mockResolvedValue([[ambiente]]);

      const result = await repo.findByCodigo('B202');

      expect(result).toEqual(ambiente);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'SELECT * FROM Ambientes WHERE codigo_ambiente = ?',
        ['B202']
      );
    });

    it('debe retornar null si el código no existe', async () => {
      mockDb.execute.mockResolvedValue([[]]);

      const result = await repo.findByCodigo('INEXISTENTE');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // findByNombre()
  // ──────────────────────────────────────────────
  describe('findByNombre()', () => {
    it('debe retornar el ambiente por nombre', async () => {
      const ambiente = { id_ambiente: 3, nombre_ambiente: 'Taller de Sistemas' };
      mockDb.execute.mockResolvedValue([[ambiente]]);

      const result = await repo.findByNombre('Taller de Sistemas');

      expect(result).toEqual(ambiente);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'SELECT * FROM Ambientes WHERE nombre_ambiente = ? LIMIT 1',
        ['Taller de Sistemas']
      );
    });

    it('debe retornar null si el nombre no existe', async () => {
      mockDb.execute.mockResolvedValue([[]]);

      const result = await repo.findByNombre('Sala Inexistente');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // findAll()
  // ──────────────────────────────────────────────
  describe('findAll()', () => {
    it('debe retornar todos los ambientes activos', async () => {
      const ambientes = [
        { id_ambiente: 1, codigo_ambiente: 'A101', estado_ambiente: 'Activo' },
        { id_ambiente: 2, codigo_ambiente: 'B202', estado_ambiente: 'Activo' },
      ];
      mockDb.execute.mockResolvedValue([ambientes]);

      const result = await repo.findAll();

      expect(result).toEqual(ambientes);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('estado_ambiente = "Activo"'),
        []
      );
    });

    it('debe retornar array vacío si no hay ambientes activos', async () => {
      mockDb.execute.mockResolvedValue([[]]);

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────
  // create()
  // ──────────────────────────────────────────────
  describe('create()', () => {
    it('debe insertar un nuevo ambiente y retornar insertId', async () => {
      mockDb.execute.mockResolvedValue([{ insertId: 10, affectedRows: 1 }]);

      const data = {
        codigoAmbiente: 'C303',
        nombreAmbiente: 'Sala Multimedia',
        tipoAmbiente: 'Laboratorio',
        capacidadPersonas: 30,
        piso: 3,
        edificio: 'C',
        descripcion: 'Sala de multimedia SENA',
        estadoAmbiente: 'Activo',
      };

      const result = await repo.create(data);

      expect(result.insertId).toBe(10);
      expect(result.affectedRows).toBe(1);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO Ambientes'),
        ['C303', 'Sala Multimedia', 'Laboratorio', 30, 3, 'C', 'Sala de multimedia SENA', 'Activo']
      );
    });

    it('debe usar "Activo" como estado por defecto', async () => {
      mockDb.execute.mockResolvedValue([{ insertId: 11, affectedRows: 1 }]);

      const data = {
        codigoAmbiente: 'D404',
        nombreAmbiente: 'Aula 404',
        tipoAmbiente: 'Aula',
        capacidadPersonas: 20,
        piso: 4,
        edificio: 'D',
        descripcion: null,
        // estadoAmbiente omitido → debe usar 'Activo'
      };

      await repo.create(data);

      const callArgs = mockDb.execute.mock.calls[0];
      expect(callArgs[1]).toContain('Activo');
    });
  });

  // ──────────────────────────────────────────────
  // update()
  // ──────────────────────────────────────────────
  describe('update()', () => {
    it('debe actualizar campos permitidos y retornar affectedRows', async () => {
      mockDb.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await repo.update(1, {
        nombre_ambiente: 'Aula Renovada',
        estado_ambiente: 'Inactivo',
      });

      expect(result.affectedRows).toBe(1);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE Ambientes SET'),
        ['Aula Renovada', 'Inactivo', 1]
      );
    });

    it('debe retornar affectedRows: 0 si no se envían campos permitidos', async () => {
      const result = await repo.update(1, { campo_invalido: 'valor' });

      expect(result).toEqual({ affectedRows: 0 });
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('debe ignorar campos no permitidos y actualizar solo los válidos', async () => {
      mockDb.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await repo.update(2, {
        nombre_ambiente: 'Lab Actualizado',
        campo_desconocido: 'ignorar',
        piso: 2,
      });

      expect(result.affectedRows).toBe(1);
      const callArgs = mockDb.execute.mock.calls[0];
      // Debe incluir nombre_ambiente y piso, no campo_desconocido
      expect(callArgs[0]).toContain('nombre_ambiente = ?');
      expect(callArgs[0]).toContain('piso = ?');
      expect(callArgs[0]).not.toContain('campo_desconocido');
    });

    it('debe propagar errores de la base de datos en update', async () => {
      mockDb.execute.mockRejectedValue(new Error('Update failed'));

      await expect(repo.update(1, { estado_ambiente: 'Activo' })).rejects.toThrow('Update failed');
    });
  });

  // ──────────────────────────────────────────────
  // delete()
  // ──────────────────────────────────────────────
  describe('delete()', () => {
    it('debe eliminar un ambiente y retornar affectedRows', async () => {
      mockDb.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await repo.delete(1);

      expect(result.affectedRows).toBe(1);
      expect(mockDb.execute).toHaveBeenCalledWith(
        'DELETE FROM Ambientes WHERE id_ambiente = ?',
        [1]
      );
    });

    it('debe retornar affectedRows: 0 si el ambiente no existe', async () => {
      mockDb.execute.mockResolvedValue([{ affectedRows: 0 }]);

      const result = await repo.delete(999);

      expect(result.affectedRows).toBe(0);
    });

    it('debe propagar errores de la base de datos en delete', async () => {
      mockDb.execute.mockRejectedValue(new Error('Delete failed'));

      await expect(repo.delete(1)).rejects.toThrow('Delete failed');
    });
  });
});
