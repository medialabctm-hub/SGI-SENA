import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockExecute = jest.fn();
const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

jest.unstable_mockModule(path.resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
  default: { execute: mockExecute },
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/logger.js'), () => ({
  logger: mockLogger,
}));

const {
  obtenerEstadisticas,
  obtenerEstadisticasInstructor,
  obtenerEstadisticasCuentadante,
} = await import(path.resolve(__dirname, '../../src/controller/estadisticasController.js'));

function mockReq(overrides = {}) {
  return {
    user: { id: 1, rol: 'Administrador' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('estadisticasController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecute.mockReset();
  });

  describe('obtenerEstadisticas', () => {
    it('retorna estadísticas completas para administrador', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ total_equipos: 10, equipos_nuevos: 2, equipos_buenos: 6, equipos_regulares: 1, equipos_malos: 1, equipos_danados: 0, valor_total_inventario: 15000, valor_promedio_equipo: 1500 }]])
        .mockResolvedValueOnce([[{ nombre_categoria: 'Laptop', cantidad: 5, valor_total: 7000 }]])
        .mockResolvedValueOnce([[{ codigo_ambiente: 'A1', nombre_ambiente: 'Lab', cantidad_equipos: 4, valor_total: 5000 }]])
        .mockResolvedValueOnce([[{ estado_operativo: 'Disponible', cantidad: 8 }]])
        .mockResolvedValueOnce([[{ mes: '2026-03', cantidad: 3 }]])
        .mockResolvedValueOnce([[{ total: 2 }]])
        .mockResolvedValueOnce([[{ total: 1 }]])
        .mockResolvedValueOnce([[{ total: 1 }]])
        .mockResolvedValueOnce([[{ codigo_equipo: 1, placa: 'PL-1', modelo: 'Dell', veces_usado: 4 }]]);

      const req = mockReq();
      const res = mockRes();

      await obtenerEstadisticas(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            total_equipos: 10,
            equipos_buenos: 6,
            por_categoria: expect.any(Array),
            por_ambiente: expect.any(Array),
          }),
        })
      );
    });

    it('si consultas secundarias fallan, usa fallbacks sin romper la respuesta', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ total_equipos: 1, equipos_nuevos: 0, equipos_buenos: 1, equipos_regulares: 0, equipos_malos: 0, equipos_danados: 0, valor_total_inventario: 2000, valor_promedio_equipo: 2000 }]])
        .mockRejectedValueOnce(new Error('cat fail'))
        .mockRejectedValueOnce(new Error('amb fail'))
        .mockRejectedValueOnce(new Error('op fail'))
        .mockRejectedValueOnce(new Error('mes fail'))
        .mockRejectedValueOnce(new Error('nov fail'))
        .mockRejectedValueOnce(new Error('mant fail'))
        .mockRejectedValueOnce(new Error('cuent fail'))
        .mockRejectedValueOnce(new Error('uso fail'));

      const req = mockReq();
      const res = mockRes();

      await obtenerEstadisticas(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({
            total_equipos: 1,
            por_categoria: [],
            por_ambiente: [],
            por_estado_operativo: [],
          }),
        })
      );
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('retorna 500 cuando falla la consulta principal', async () => {
      mockExecute.mockRejectedValueOnce(new Error('fatal db'));

      const req = mockReq();
      const res = mockRes();

      await obtenerEstadisticas(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Error al obtener estadísticas' }));
    });
  });

  describe('obtenerEstadisticasInstructor', () => {
    it('retorna 401 si no hay usuario autenticado', async () => {
      const req = mockReq({ user: null });
      const res = mockRes();

      await obtenerEstadisticasInstructor(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('retorna estadísticas en cero cuando no hay ambientes activos', async () => {
      mockExecute.mockResolvedValueOnce([[]]);

      const req = mockReq({ user: { id: 2, rol: 'Instructor' } });
      const res = mockRes();

      await obtenerEstadisticasInstructor(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({ total_equipos: 0 }),
        })
      );
    });

    it('retorna estadísticas calculadas cuando hay ambientes', async () => {
      mockExecute
        .mockResolvedValueOnce([[{ id_ambiente: 7 }]])
        .mockResolvedValueOnce([[{ total_equipos: 6, equipos_buenos: 4, equipos_regulares: 1, equipos_danados: 1, valor_total_inventario: 6000 }]]);

      const req = mockReq({ user: { id: 2, rol: 'Instructor' } });
      const res = mockRes();

      await obtenerEstadisticasInstructor(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({ total_equipos: 6, equipos_buenos: 4 }),
        })
      );
    });
  });

  describe('obtenerEstadisticasCuentadante', () => {
    it('retorna 401 si no hay usuario autenticado', async () => {
      const req = mockReq({ user: null });
      const res = mockRes();

      await obtenerEstadisticasCuentadante(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('retorna estadísticas del cuentadante', async () => {
      mockExecute.mockResolvedValueOnce([[{ total_equipos: 3, equipos_buenos: 2, equipos_regulares: 1, equipos_danados: 0, valor_total_inventario: 3000 }]]);

      const req = mockReq({ user: { id: 3, rol: 'Cuentadante' } });
      const res = mockRes();

      await obtenerEstadisticasCuentadante(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stats: expect.objectContaining({ total_equipos: 3, valor_total_inventario: 3000 }),
        })
      );
    });

    it('retorna 500 cuando falla la consulta', async () => {
      mockExecute.mockRejectedValueOnce(new Error('db fail'));

      const req = mockReq({ user: { id: 3, rol: 'Cuentadante' } });
      const res = mockRes();

      await obtenerEstadisticasCuentadante(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
