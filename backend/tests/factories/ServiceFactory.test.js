/**
 * Tests para ServiceFactory
 * Patron Factory - usa el container real con servicios de prueba registrados
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ServiceFactory } from '../../src/factories/ServiceFactory.js';
import { container } from '../../src/di/Container.js';

describe('ServiceFactory', () => {
  // Limpiar servicios de prueba despues de cada test
  afterEach(() => {
    // Limpiar solo los servicios de test para no afectar otros
    container.services.delete('testService');
    container.services.delete('testServiceA');
    container.services.delete('testServiceB');
    container.services.delete('testServiceC');
    container.singletons.delete('testService');
    container.singletons.delete('testServiceA');
    container.singletons.delete('testServiceB');
    container.singletons.delete('testServiceC');
  });

  describe('create()', () => {
    it('debe resolver y retornar un servicio registrado', () => {
      const mockService = { doSomething: () => 'ok' };
      container.register('testService', () => mockService);

      const result = ServiceFactory.create('testService');

      expect(result).toBe(mockService);
    });

    it('debe lanzar error descriptivo si el servicio no esta registrado', () => {
      expect(() => ServiceFactory.create('noExiste_xyz')).toThrow(
        "Error al crear servicio 'noExiste_xyz':"
      );
    });
  });

  describe('createMany()', () => {
    it('debe resolver multiples servicios y retornarlos como objeto', () => {
      const svcA = { name: 'A' };
      const svcB = { name: 'B' };
      container.register('testServiceA', () => svcA);
      container.register('testServiceB', () => svcB);

      const result = ServiceFactory.createMany(['testServiceA', 'testServiceB']);

      expect(result.testServiceA).toBe(svcA);
      expect(result.testServiceB).toBe(svcB);
    });

    it('debe lanzar error descriptivo si uno de los servicios no existe', () => {
      container.register('testServiceC', () => ({}));

      expect(() =>
        ServiceFactory.createMany(['testServiceC', 'noExiste_zzz'])
      ).toThrow("Error al crear servicio 'noExiste_zzz':");
    });
  });
});