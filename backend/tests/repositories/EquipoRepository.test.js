/**
 * Tests para repositories/EquipoRepository
 *
 * Cubre: findByCodigo, findByPlaca, findAll (filtros/paginación),
 *        create, update, delete, findCategoriaByNombre,
 *        createCategoriaIfNotExists, columnExists
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EquipoRepository } from '../../src/repositories/EquipoRepository.js';

// ──────────────────────────────────────────────
// Mock de db
// ──────────────────────────────────────────────
function makeMockDb() {
  return {
    execute: jest.fn(),
    pool: { getConnection: jest.fn() },
  };
}

// Equipo mock representativo
const equipoMock = {
  codigo_equipo: 1,
  placa: 'SENA-001',
  tipo: 'Laptop',
  modelo: 'ThinkPad X1',
  descripcion: 'Laptop corporativa',
  estado_fisico: 'Bueno',
  nombre_ambiente: 'Sala 101',
  nombre_categoria: 'Computadores',
};

describe('EquipoRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = makeMockDb();
    repo = new EquipoRepository(db);
  });

  // ──────────────────────────────────────────────
  // findByCodigo()
  // ──────────────────────────────────────────────
  describe('findByCodigo()', () => {
    it('debe retornar el equipo cuando existe', async () => {
      db.execute.mockResolvedValue([[equipoMock]]);

      const result = await repo.findByCodigo(1);

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('codigo_equipo = ?'),
        [1]
      );
      expect(result).toEqual(equipoMock);
    });

    it('debe retornar null si el equipo no existe', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.findByCodigo(9999);

      expect(result).toBeNull();
    });

    it('la query debe hacer JOIN con Ambientes y Categorias_Equipo', async () => {
      db.execute.mockResolvedValue([[equipoMock]]);

      await repo.findByCodigo(1);

      const query = db.execute.mock.calls[0][0];
      expect(query.toLowerCase()).toContain('join');
      expect(query.toLowerCase()).toContain('ambientes');
    });
  });

  // ──────────────────────────────────────────────
  // findByPlaca()
  // ──────────────────────────────────────────────
  describe('findByPlaca()', () => {
    it('debe retornar el equipo cuando la placa existe', async () => {
      db.execute.mockResolvedValue([[{ codigo_equipo: 3 }]]);

      const result = await repo.findByPlaca('SENA-001');

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('placa = ?'),
        ['SENA-001']
      );
      expect(result).toEqual({ codigo_equipo: 3 });
    });

    it('debe retornar null si la placa no existe', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.findByPlaca('INVALIDA-999');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // findAll()
  // ──────────────────────────────────────────────
  describe('findAll()', () => {
    // Mock del resultado para findAll: necesita la query count + la query principal
    function setupFindAllMock(equipos = [], total = 0) {
      db.execute
        .mockResolvedValueOnce([[{ total }]])  // count query → execute() devuelve [{total}]
        .mockResolvedValueOnce([equipos]);     // main query → execute() devuelve equipos[]
    }

    it('debe retornar equipos con datos de paginación', async () => {
      setupFindAllMock([equipoMock], 1);

      const result = await repo.findAll({}, { page: 1, limit: 10 });

      expect(result).toHaveProperty('equipos');
      expect(result).toHaveProperty('pagination');
    });

    it('debe calcular totalPages correctamente', async () => {
      setupFindAllMock([equipoMock, equipoMock], 25);

      const result = await repo.findAll({}, { page: 1, limit: 10 });

      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('debe aplicar la paginación por defecto (página 1, límite 50)', async () => {
      setupFindAllMock([], 0);

      const result = await repo.findAll();

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
    });

    it('debe filtrar por cuentadanteId cuando se provee', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ cuentadanteId: 5 });

      const allCalls = db.execute.mock.calls;
      const countQuery = allCalls[0][0];
      expect(countQuery).toContain('cuentadante');
    });

    it('debe filtrar por búsqueda de texto', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ search: 'laptop' });

      const mainQuery = db.execute.mock.calls[1][0];
      expect(mainQuery.toLowerCase()).toContain('like');
    });

    it('debe filtrar por categoria', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ categoria: 'Computadores' });

      const mainQuery = db.execute.mock.calls[1][0];
      expect(mainQuery).toContain('nombre_categoria');
    });

    it('debe filtrar por estado_fisico array', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ estado_fisico: ['Bueno', 'Regular'] });

      const mainQuery = db.execute.mock.calls[1][0];
      expect(mainQuery.toLowerCase()).toContain('estado_fisico');
    });

    it('debe retornar hasNext=false en la última página', async () => {
      setupFindAllMock([equipoMock], 5);

      const result = await repo.findAll({}, { page: 1, limit: 10 });

      expect(result.pagination.hasNext).toBe(false);
    });

    it('debe retornar hasPrev=false en la primera página', async () => {
      setupFindAllMock([equipoMock], 5);

      const result = await repo.findAll({}, { page: 1, limit: 10 });

      expect(result.pagination.hasPrev).toBe(false);
    });

    it('debe retornar hasPrev=true cuando page > 1', async () => {
      setupFindAllMock([], 50);

      const result = await repo.findAll({}, { page: 2, limit: 10 });

      expect(result.pagination.hasPrev).toBe(true);
    });

    it('debe aplicar filtro cuentadanteOrAmbientes', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ cuentadanteOrAmbientes: { cuentadanteId: 5, ambientesIds: [1, 2] } });

      const countQuery = db.execute.mock.calls[0][0];
      expect(countQuery.toLowerCase()).toContain('cuentadante');
    });

    it('debe filtrar por cuentadanteOrAmbientes con ambientesIds vacío (solo cuentadante)', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ cuentadanteOrAmbientes: { cuentadanteId: 7, ambientesIds: [] } });

      const countQuery = db.execute.mock.calls[0][0];
      expect(countQuery).toContain('cuentadante');
      // Debe usar solo el filtro por cuentadante sin IN
      expect(countQuery).not.toContain('id_ambiente IN');
    });

    it('debe filtrar por ambientesIds en ruta regular', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ ambientesIds: [3, 5, 8] });

      const countQuery = db.execute.mock.calls[0][0];
      expect(countQuery).toContain('id_ambiente IN');
    });

    it('debe filtrar por estado_operativo array', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ estado_operativo: ['Disponible', 'En Uso'] });

      const mainQuery = db.execute.mock.calls[1][0];
      expect(mainQuery.toLowerCase()).toContain('estado_operativo');
    });

    it('debe filtrar por fecha_desde', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ fecha_desde: '2024-01-01' });

      const mainQuery = db.execute.mock.calls[1][0];
      expect(mainQuery).toContain('fecha_adquisicion >=');
    });

    it('debe filtrar por fecha_hasta', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ fecha_hasta: '2024-12-31' });

      const mainQuery = db.execute.mock.calls[1][0];
      expect(mainQuery).toContain('fecha_adquisicion <=');
    });

    it('debe filtrar por rango de valor (valor_min y valor_max)', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ valor_min: 500000, valor_max: 2000000 });

      const mainQuery = db.execute.mock.calls[1][0];
      expect(mainQuery.toLowerCase()).toContain('valor_ingreso');
    });

    it('debe ignorar valor_min o valor_max si son NaN', async () => {
      setupFindAllMock([], 0);

      // String no numérico → parseFloat devuelve NaN → se ignora
      await expect(
        repo.findAll({ valor_min: 'abc', valor_max: 'xyz' })
      ).resolves.toBeDefined();
    });

    it('debe filtrar por tipo', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({ tipo: 'Laptop' });

      const mainQuery = db.execute.mock.calls[1][0];
      expect(mainQuery).toContain('e.tipo = ?');
    });

    it('debe ordenar de forma descendente con order:desc', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({}, {}, { field: 'placa', order: 'desc' });

      const mainQuery = db.execute.mock.calls[1][0];
      expect(mainQuery).toContain('DESC');
    });

    it('debe ordenar por nombre_ambiente usando alias de tabla a.', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({}, {}, { field: 'nombre_ambiente' });

      const mainQuery = db.execute.mock.calls[1][0];
      expect(mainQuery).toContain('a.nombre_ambiente');
    });

    it('debe usar campo de ordenamiento por defecto para campo inválido', async () => {
      setupFindAllMock([], 0);

      await repo.findAll({}, {}, { field: 'campo_inexistente' });

      const mainQuery = db.execute.mock.calls[1][0];
      expect(mainQuery).toContain('e.codigo_equipo');
    });

    it('debe sanitizar parámetros undefined en ambientesIds (líneas 194-195, 250-251)', async () => {
      setupFindAllMock([], 0);

      // ambientesIds con undefined → params.push(undefined) → sanitización a null
      await expect(
        repo.findAll({ ambientesIds: [1, undefined, 3] })
      ).resolves.toBeDefined();
    });

    it('debe sanitizar parámetros NaN en ambientesIds (líneas 199-200, 255-256)', async () => {
      setupFindAllMock([], 0);

      // ambientesIds con NaN → params.push(NaN) → sanitización a null
      await expect(
        repo.findAll({ ambientesIds: [NaN, 2] })
      ).resolves.toBeDefined();
    });

    it('debe sanitizar undefined en cuentadanteOrAmbientes.ambientesIds', async () => {
      setupFindAllMock([], 0);

      // undefined en el spread de ambientesIds dentro de orFilter
      await expect(
        repo.findAll({ cuentadanteOrAmbientes: { cuentadanteId: 5, ambientesIds: [undefined, 1] } })
      ).resolves.toBeDefined();
    });
  });

  // ──────────────────────────────────────────────
  // create()
  // ──────────────────────────────────────────────
  describe('create()', () => {
    it('debe insertar un equipo y retornar insertId y affectedRows', async () => {
      db.execute.mockResolvedValue([{ insertId: 42, affectedRows: 1 }]);

      const equipoData = {
        idCategoria: 1, idTipo: null, idAmbiente: 2, idCuentadante: 3,
        tipo: 'Laptop', modelo: 'HP 450', descripcion: 'Portátil',
        fechaAdquisicion: '2024-01-01', valorIngreso: 2500000,
        estadoFisico: 'Bueno', specsCompletas: '{}', atributos: '{}',
        rCentro: 'RC-001', consecutivo: '001', placa: 'PL-001', registradoPor: 1,
      };

      const result = await repo.create(equipoData);

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO Elementos'),
        expect.any(Array)
      );
      expect(result).toEqual({ insertId: 42, affectedRows: 1 });
    });

    it('debe incluir id_tipo en la query si se proporciona', async () => {
      db.execute.mockResolvedValue([{ insertId: 43, affectedRows: 1 }]);

      const equipoData = {
        idCategoria: 1, idTipo: 5, idAmbiente: 2, idCuentadante: 3,
        tipo: 'Tablet', modelo: 'iPad', descripcion: 'Tableta',
        fechaAdquisicion: '2024-01-01', valorIngreso: 1500000,
        estadoFisico: 'Bueno', specsCompletas: '{}', atributos: '{}',
        rCentro: 'RC-002', consecutivo: '002', placa: 'PL-002', registradoPor: 1,
      };

      await repo.create(equipoData);

      const query = db.execute.mock.calls[0][0];
      expect(query.toLowerCase()).toContain('id_tipo');
    });
  });

  // ──────────────────────────────────────────────
  // update()
  // ──────────────────────────────────────────────
  describe('update()', () => {
    it('debe actualizar los campos permitidos', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await repo.update(1, { modelo: 'HP 500', estado_fisico: 'Regular' });

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE Elementos SET'),
        expect.arrayContaining(['HP 500', 'Regular', 1])
      );
      expect(result.affectedRows).toBe(1);
    });

    it('debe retornar affectedRows=0 si no hay campos permitidos', async () => {
      const result = await repo.update(1, { campo_invalido: 'valor' });

      expect(db.execute).not.toHaveBeenCalled();
      expect(result).toEqual({ affectedRows: 0 });
    });

    it('no debe incluir campos no permitidos en la actualización', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await repo.update(1, { modelo: 'Nuevo', campo_secreto: 'hack' });

      const query = db.execute.mock.calls[0][0];
      expect(query).not.toContain('campo_secreto');
    });
  });

  // ──────────────────────────────────────────────
  // delete()
  // ──────────────────────────────────────────────
  describe('delete()', () => {
    it('debe eliminar el equipo y retornar affectedRows', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await repo.delete(1);

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM Elementos'),
        [1]
      );
      expect(result.affectedRows).toBe(1);
    });

    it('debe retornar affectedRows=0 si el equipo no existe', async () => {
      db.execute.mockResolvedValue([{ affectedRows: 0 }]);

      const result = await repo.delete(9999);

      expect(result.affectedRows).toBe(0);
    });
  });

  // ──────────────────────────────────────────────
  // findCategoriaByNombre()
  // ──────────────────────────────────────────────
  describe('findCategoriaByNombre()', () => {
    it('debe retornar la categoría cuando existe', async () => {
      const mockCat = { id_categoria: 3, nombre_categoria: 'Computadores', es_componente: false };
      db.execute.mockResolvedValue([[mockCat]]);

      const result = await repo.findCategoriaByNombre('Computadores');

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('nombre_categoria = ?'),
        ['Computadores']
      );
      expect(result).toEqual(mockCat);
    });

    it('debe retornar null si la categoría no existe', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await repo.findCategoriaByNombre('NoExiste');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // createCategoriaIfNotExists()
  // ──────────────────────────────────────────────
  describe('createCategoriaIfNotExists()', () => {
    it('debe retornar categoría existente sin crear una nueva', async () => {
      const mockCat = { id_categoria: 5, es_componente: false };
      db.execute.mockResolvedValue([[mockCat]]);

      const result = await repo.createCategoriaIfNotExists('Computadores');

      expect(db.execute).toHaveBeenCalledTimes(1); // Solo búsqueda, no INSERT
      expect(result).toEqual(mockCat);
    });

    it('debe crear la categoría si no existe', async () => {
      db.execute
        .mockResolvedValueOnce([[]])             // findCategoriaByNombre → null
        .mockResolvedValueOnce([{ insertId: 10, affectedRows: 1 }]); // INSERT

      const result = await repo.createCategoriaIfNotExists('NuevaCategoria');

      expect(db.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ id_categoria: 10, es_componente: false });
    });

    it('debe manejar ER_DUP_ENTRY reintentando la búsqueda', async () => {
      const mockCat = { id_categoria: 7, es_componente: true };
      const dupError = new Error('Duplicate entry');
      dupError.code = 'ER_DUP_ENTRY';

      db.execute
        .mockResolvedValueOnce([[]])    // primera búsqueda → no existe
        .mockRejectedValueOnce(dupError) // INSERT → falla con duplicado
        .mockResolvedValueOnce([[mockCat]]); // segunda búsqueda → encontrada

      const result = await repo.createCategoriaIfNotExists('Duplicada');

      expect(result).toEqual(mockCat);
    });

    it('debe propagar un error que no sea ER_DUP_ENTRY', async () => {
      const otherError = new Error('DB connection failed');
      otherError.code = 'ER_ACCESS_DENIED_ERROR';

      db.execute
        .mockResolvedValueOnce([[]])       // findCategoriaByNombre → null
        .mockRejectedValueOnce(otherError); // INSERT → error no-dup

      await expect(
        repo.createCategoriaIfNotExists('Categoria')
      ).rejects.toThrow('DB connection failed');
    });
  });

  // ──────────────────────────────────────────────
  // columnExists()
  // ──────────────────────────────────────────────
  describe('columnExists()', () => {
    it('debe retornar true si la columna existe', async () => {
      db.execute.mockResolvedValue([[{ cnt: 1 }]]);

      const result = await repo.columnExists('placa');

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('INFORMATION_SCHEMA.COLUMNS'),
        ['placa']
      );
      expect(result).toBe(true);
    });

    it('debe retornar false si la columna no existe', async () => {
      db.execute.mockResolvedValue([[{ cnt: 0 }]]);

      const result = await repo.columnExists('columna_inexistente');

      expect(result).toBe(false);
    });
  });
});
