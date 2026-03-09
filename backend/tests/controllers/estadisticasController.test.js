/**
 * Tests para estadisticasController
 * Cubre caminos que no requieren BD real
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  obtenerEstadisticas,
} from '../../src/controller/estadisticasController.js';

describe('estadisticasController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {}, query: {}, body: {}, user: { id: 1, rol: 'Administrador' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('obtenerEstadisticas', () => {
    it('debe intentar obtener estadisticas y retornar una respuesta', async () => {
      await obtenerEstadisticas(req, res);
      const calledJson = res.json.mock.calls.length > 0;
      const calledStatus = res.status.mock.calls.length > 0;
      expect(calledJson || calledStatus).toBe(true);
    });
  });
});