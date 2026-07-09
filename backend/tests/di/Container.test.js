/**
 * Tests para DI Container
 * Patrón Dependency Injection - cubre registro, resolución y manejo de errores
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Container } from '../../src/di/Container.js';

describe('Container (DI)', () => {
  let container;

  beforeEach(() => {
    container = new Container();
  });

  describe('register / has', () => {
    it('debe registrar un servicio y detectarlo con has()', () => {
      container.register('myService', () => ({ value: 42 }));
      expect(container.has('myService')).toBe(true);
    });

    it('debe devolver false si el servicio no está registrado', () => {
      expect(container.has('nonExistent')).toBe(false);
    });
  });

  describe('resolve', () => {
    it('debe resolver un servicio creado por factory function', () => {
      container.register('calc', () => ({ add: (a, b) => a + b }));
      const calc = container.resolve('calc');
      expect(calc.add(2, 3)).toBe(5);
    });

    it('debe devolver la misma instancia cuando es singleton (default)', () => {
      let count = 0;
      container.register('counter', () => {
        count++;
        return { id: count };
      });

      const inst1 = container.resolve('counter');
      const inst2 = container.resolve('counter');
      expect(inst1).toBe(inst2);
      expect(count).toBe(1);
    });

    it('debe crear nueva instancia cada vez cuando singleton=false', () => {
      let count = 0;
      container.register('transient', () => {
        count++;
        return { id: count };
      }, false);

      const inst1 = container.resolve('transient');
      const inst2 = container.resolve('transient');
      expect(inst1).not.toBe(inst2);
      expect(count).toBe(2);
    });

    it('debe resolver un valor directo (no factory)', () => {
      const obj = { config: 'value' };
      container.register('config', obj);
      const resolved = container.resolve('config');
      expect(resolved).toBe(obj);
    });

    it('debe lanzar error si el servicio no está registrado', () => {
      expect(() => container.resolve('unknownService')).toThrow(
        "Servicio 'unknownService' no registrado en el contenedor"
      );
    });

    it('debe pasar el contenedor como argumento a la factory function', () => {
      container.register('base', () => 'baseValue');
      container.register('derived', (c) => `derived_${c.resolve('base')}`);
      expect(container.resolve('derived')).toBe('derived_baseValue');
    });
  });

  describe('clear', () => {
    it('debe limpiar los singletons sin eliminar los registros', () => {
      let count = 0;
      container.register('srv', () => {
        count++;
        return { id: count };
      });

      container.resolve('srv'); // crea singleton
      container.clear();        // limpia singletons
      container.resolve('srv'); // crea nuevo singleton

      expect(count).toBe(2);
      expect(container.has('srv')).toBe(true); // sigue registrado
    });
  });
});
