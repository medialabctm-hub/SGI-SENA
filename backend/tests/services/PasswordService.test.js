/**
 * Tests para services/PasswordService
 *
 * Cubre: hash(), compare()
 * Usa bcrypt real con saltRounds=1 para velocidad en tests.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PasswordService } from '../../src/services/PasswordService.js';

describe('PasswordService', () => {
  let service;

  beforeEach(() => {
    // saltRounds=1 para que los tests sean rápidos
    service = new PasswordService(1);
  });

  // ──────────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────────
  describe('constructor', () => {
    it('debe instanciarse con saltRounds por defecto (10)', () => {
      const defaultService = new PasswordService();
      expect(defaultService.saltRounds).toBe(10);
    });

    it('debe instanciarse con saltRounds personalizado', () => {
      const customService = new PasswordService(12);
      expect(customService.saltRounds).toBe(12);
    });
  });

  // ──────────────────────────────────────────────
  // hash()
  // ──────────────────────────────────────────────
  describe('hash()', () => {
    it('debe retornar un string hasheado', async () => {
      const hash = await service.hash('miContrasena123');

      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('el hash no debe ser igual a la contraseña original', async () => {
      const password = 'contrasenaSecreta';
      const hash = await service.hash(password);

      expect(hash).not.toBe(password);
    });

    it('el hash debe empezar con el prefijo de bcrypt ($2b$)', async () => {
      const hash = await service.hash('cualquierContrasena');

      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('dos llamadas con la misma contraseña deben producir hashes diferentes (salt aleatorio)', async () => {
      const hash1 = await service.hash('mismaContrasena');
      const hash2 = await service.hash('mismaContrasena');

      expect(hash1).not.toBe(hash2);
    });
  });

  // ──────────────────────────────────────────────
  // compare()
  // ──────────────────────────────────────────────
  describe('compare()', () => {
    it('debe retornar true si la contraseña coincide con el hash', async () => {
      const password = 'contrasenaCorrecta!';
      const hash = await service.hash(password);

      const result = await service.compare(password, hash);

      expect(result).toBe(true);
    });

    it('debe retornar false si la contraseña NO coincide con el hash', async () => {
      const hash = await service.hash('contrasenaOriginal');

      const result = await service.compare('contrasenaEquivocada', hash);

      expect(result).toBe(false);
    });

    it('debe retornar false para una contraseña vacía contra un hash válido', async () => {
      const hash = await service.hash('contrasena123');

      const result = await service.compare('', hash);

      expect(result).toBe(false);
    });

    it('debe ser sensible a mayúsculas y minúsculas', async () => {
      const hash = await service.hash('Contrasena');

      const resultMinusculas = await service.compare('contrasena', hash);
      const resultMayusculas = await service.compare('CONTRASENA', hash);

      expect(resultMinusculas).toBe(false);
      expect(resultMayusculas).toBe(false);
    });

    it('un hash generado con saltRounds=1 debe ser verificable con saltRounds=10', async () => {
      // bcrypt almacena los saltRounds en el hash, no importa el del servicio
      const serviceSlow = new PasswordService(10);
      const hash = await service.hash('miPass'); // saltRounds=1

      const result = await serviceSlow.compare('miPass', hash);

      expect(result).toBe(true);
    });
  });
});
