/**
 * Tests para EquipoService
 * Cubre listarEquipos, registrarEquipo, obtenerEquipoPorCodigo,
 * actualizarEquipo y eliminarEquipo
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EquipoService } from '../../src/services/equipoService.js';
import { NotFoundError, ConflictError, ValidationError } from '../../src/utils/errors.js';

describe('EquipoService', () => {
  let service;
  let mockRepository;
  let mockLogger;

  beforeEach(() => {
    mockRepository = {
      execute: jest.fn(),
      findAll: jest.fn(),
      findByCodigo: jest.fn(),
      findByPlaca: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createCategoriaIfNotExists: jest.fn(),
      findOne: jest.fn(),
      columnExists: jest.fn(),
      db: { execute: jest.fn() },
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    service = new EquipoService(mockRepository, mockLogger);
  });

  // ------------------------------------------------------------------
  // obtenerAmbientesInstructor
  // ------------------------------------------------------------------
  describe('obtenerAmbientesInstructor()', () => {
    it('debe retornar lista de ids de ambientes asignados', async () => {
      mockRepository.execute.mockResolvedValue([
        { id_ambiente: 1 },
        { id_ambiente: 3 },
      ]);

      const result = await service.obtenerAmbientesInstructor(5);
      expect(result).toEqual([1, 3]);
    });

    it('debe retornar array vacío si no hay ambientes', async () => {
      mockRepository.execute.mockResolvedValue([]);
      const result = await service.obtenerAmbientesInstructor(5);
      expect(result).toEqual([]);
    });
  });

  // ------------------------------------------------------------------
  // listarEquipos
  // ------------------------------------------------------------------
  describe('listarEquipos()', () => {
    it('debe retornar equipos para rol Administrador sin restricciones', async () => {
      const expected = { equipos: [{ codigo_equipo: 1 }], pagination: {} };
      mockRepository.findAll.mockResolvedValue(expected);

      const result = await service.listarEquipos({}, {}, {}, 1, 'Administrador');
      expect(result).toEqual(expected);
    });

    it('debe retornar lista vacía si Instructor no tiene ambientes', async () => {
      mockRepository.execute.mockResolvedValue([]); // Sin ambientes

      const result = await service.listarEquipos({}, { page: 1, limit: 50 }, {}, 2, 'Instructor');

      expect(result.equipos).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('debe aplicar filtro de ambientes para Instructor', async () => {
      mockRepository.execute.mockResolvedValue([{ id_ambiente: 1 }]);
      mockRepository.findAll.mockResolvedValue({ equipos: [], pagination: {} });

      await service.listarEquipos({}, {}, {}, 2, 'Instructor');

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ ambientesIds: [1] }),
        expect.anything(),
        expect.anything()
      );
    });

    it('debe aplicar vista_inventario=ambientes para Cuentadante con ambientes', async () => {
      mockRepository.execute.mockResolvedValue([{ id_ambiente: 2 }]);
      mockRepository.findAll.mockResolvedValue({ equipos: [], pagination: {} });

      await service.listarEquipos(
        { vista_inventario: 'ambientes' }, {}, {}, 3, 'Cuentadante'
      );

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ ambientesIds: [2] }),
        expect.anything(),
        expect.anything()
      );
    });

    it('debe usar inventario_total para Cuentadante con vista=inventario_total', async () => {
      mockRepository.execute.mockResolvedValue([{ id_ambiente: 2 }]);
      mockRepository.findAll.mockResolvedValue({ equipos: [], pagination: {} });

      await service.listarEquipos(
        { vista_inventario: 'inventario_total' }, {}, {}, 3, 'Cuentadante'
      );

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ cuentadanteId: 3 }),
        expect.anything(),
        expect.anything()
      );
    });

    it('debe usar solo cuentadanteId si Cuentadante no tiene ambientes', async () => {
      mockRepository.execute.mockResolvedValue([]); // Sin ambientes
      mockRepository.findAll.mockResolvedValue({ equipos: [], pagination: {} });

      await service.listarEquipos({}, {}, {}, 3, 'Cuentadante');

      expect(mockRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ cuentadanteId: 3 }),
        expect.anything(),
        expect.anything()
      );
    });
  });

  // ------------------------------------------------------------------
  // registrarEquipo
  // ------------------------------------------------------------------
  describe('registrarEquipo()', () => {
    const baseData = {
      placa: 'PLC001',
      tipo: 'Computador',
      modelo: 'Dell',
      estado_fisico: 'Bueno',
      fecha_adquisicion: '2024-01-01',
      categoria: 'PC',
      id_ambiente: 1,
    };

    it('debe lanzar ValidationError si falta la placa', async () => {
      await expect(
        service.registrarEquipo({ ...baseData, placa: '' }, 1, 'Administrador')
      ).rejects.toThrow(ValidationError);
    });

    it('debe lanzar ValidationError si faltan campos obligatorios (tipo)', async () => {
      await expect(
        service.registrarEquipo({ ...baseData, tipo: '' }, 1, 'Administrador')
      ).rejects.toThrow(ValidationError);
    });

    it('debe lanzar ValidationError si falta la categoría', async () => {
      await expect(
        service.registrarEquipo({ ...baseData, categoria: '' }, 1, 'Administrador')
      ).rejects.toThrow(ValidationError);
    });

    it('debe lanzar ConflictError si la placa ya existe', async () => {
      mockRepository.findByPlaca.mockResolvedValue({ codigo_equipo: 99 });

      await expect(
        service.registrarEquipo(baseData, 1, 'Administrador')
      ).rejects.toThrow(ConflictError);
    });

    it('debe lanzar ValidationError si el ambiente no existe', async () => {
      mockRepository.findByPlaca.mockResolvedValue(null);
      mockRepository.createCategoriaIfNotExists.mockResolvedValue({ id_categoria: 1 });
      mockRepository.findOne.mockResolvedValue(null); // ambiente no encontrado
      mockRepository.columnExists.mockResolvedValue(false);

      await expect(
        service.registrarEquipo({ ...baseData, id_ambiente: null, ambiente: '999' }, 1, 'Administrador')
      ).rejects.toThrow(ValidationError);
    });
  });

  // ------------------------------------------------------------------
  // obtenerEquipoPorCodigo
  // ------------------------------------------------------------------
  describe('obtenerEquipoPorCodigo()', () => {
    it('debe retornar el equipo si existe', async () => {
      const equipo = { codigo_equipo: 1, tipo: 'PC' };
      mockRepository.findByCodigo.mockResolvedValue(equipo);

      const result = await service.obtenerEquipoPorCodigo(1);
      expect(result).toEqual(equipo);
    });

    it('debe lanzar NotFoundError si el equipo no existe', async () => {
      mockRepository.findByCodigo.mockResolvedValue(null);

      await expect(service.obtenerEquipoPorCodigo(99)).rejects.toThrow(NotFoundError);
    });
  });

  // ------------------------------------------------------------------
  // actualizarEquipo
  // ------------------------------------------------------------------
  describe('actualizarEquipo()', () => {
    it('debe lanzar NotFoundError si el equipo no existe', async () => {
      mockRepository.findByCodigo.mockResolvedValue(null);

      await expect(service.actualizarEquipo(99, { modelo: 'HP' })).rejects.toThrow(NotFoundError);
    });

    it('debe lanzar ConflictError si la nueva placa ya existe en otro equipo', async () => {
      mockRepository.findByCodigo.mockResolvedValue({ codigo_equipo: 1, placa: 'OLD' });
      mockRepository.findByPlaca.mockResolvedValue({ codigo_equipo: 2, placa: 'NEW' });

      await expect(
        service.actualizarEquipo(1, { placa: 'NEW' })
      ).rejects.toThrow(ConflictError);
    });

    it('debe actualizar el equipo correctamente', async () => {
      const equipo = { codigo_equipo: 1, placa: 'PLC001' };
      mockRepository.findByCodigo.mockResolvedValue(equipo);
      mockRepository.findByPlaca.mockResolvedValue(null);
      mockRepository.update.mockResolvedValue({ affectedRows: 1 });

      const result = await service.actualizarEquipo(1, { modelo: 'HP' });
      expect(result).toEqual({ affectedRows: 1 });
    });
  });

  // ------------------------------------------------------------------
  // eliminarEquipo
  // ------------------------------------------------------------------
  describe('eliminarEquipo()', () => {
    it('debe lanzar NotFoundError si el equipo no existe', async () => {
      mockRepository.findByCodigo.mockResolvedValue(null);

      await expect(service.eliminarEquipo(99)).rejects.toThrow(NotFoundError);
    });

    it('debe eliminar el equipo si existe', async () => {
      mockRepository.findByCodigo.mockResolvedValue({ codigo_equipo: 1 });
      mockRepository.delete.mockResolvedValue({ affectedRows: 1 });

      const result = await service.eliminarEquipo(1);
      expect(result).toEqual({ affectedRows: 1 });
    });
  });
});
