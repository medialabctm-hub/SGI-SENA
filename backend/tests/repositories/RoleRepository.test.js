/**
 * Tests para repositories/RoleRepository
 *
 * Cubre: findByName, findAll
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RoleRepository } from '../../src/repositories/RoleRepository.js';

// ──────────────────────────────────────────────
// Mock de db
// ──────────────────────────────────────────────
function makeMockDb() {
  return {
    execute: jest.fn(),
    pool: { getConnection: jest.fn() },
  };
}

describe('RoleRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = makeMockDb();
    repo = new RoleRepository(db);
  });

  // ──────────────────────────────────────────────
  // findByName()
  // ──────────────────────────────────────────────
  describe('findByName()', () => {
    it('debe retornar el rol cuando existe', async () => {
      const mockRol = { id_rol: 2, nombre_rol: 'Instructor' };
      db.execute.mockResolvedValue([[mockRol]]);

      const result = await repo.findByName('Instructor');

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('nombre_rol = ?'),
        ['Instructor']
      );
      expect(result).toEqual(mockRol);
    });

    it('debe retornar null si el rol no existe', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.findByName('RolInexistente');

      expect(result).toBeNull();
    });

    it('debe buscar en la tabla Roles', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findByName('Administrador');

      const query = db.execute.mock.calls[0][0];
      expect(query.toLowerCase()).toContain('roles');
    });

    it('debe pasar el nombre del rol como parámetro', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findByName('Aprendiz');

      expect(db.execute.mock.calls[0][1]).toEqual(['Aprendiz']);
    });
  });

  // ──────────────────────────────────────────────
  // findAll()
  // ──────────────────────────────────────────────
  describe('findAll()', () => {
    it('debe retornar todos los roles activos', async () => {
      const mockRoles = [
        { id_rol: 1, nombre_rol: 'Administrador', descripcion: 'Admin', estado: 'Activo' },
        { id_rol: 2, nombre_rol: 'Instructor', descripcion: 'Instructor', estado: 'Activo' },
        { id_rol: 3, nombre_rol: 'Aprendiz', descripcion: 'Aprendiz', estado: 'Activo' },
      ];
      db.execute.mockResolvedValue([mockRoles]);

      const result = await repo.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('debe retornar array vacío si no hay roles activos', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });

    it('la query debe filtrar por estado Activo', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findAll();

      const query = db.execute.mock.calls[0][0];
      expect(query).toContain('Activo');
    });

    it('la query debe seleccionar campos relevantes', async () => {
      db.execute.mockResolvedValue([[]]);

      await repo.findAll();

      const query = db.execute.mock.calls[0][0];
      expect(query.toLowerCase()).toContain('nombre_rol');
    });
  });
});
