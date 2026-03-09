/**
 * Tests para services/JwtService
 *
 * Cubre: constructor, sign(), verify(), decode()
 * Usa JWT real (no mock) ya que las operaciones son rápidas y sin efectos secundarios.
 */

import { describe, it, expect } from '@jest/globals';
import { JwtService } from '../../src/services/JwtService.js';

const SECRET = 'test-secret-para-unit-tests';

describe('JwtService', () => {
  // ──────────────────────────────────────────────
  // Constructor
  // ──────────────────────────────────────────────
  describe('constructor', () => {
    it('debe instanciarse correctamente con secret y expiresIn', () => {
      const service = new JwtService(SECRET, '2h');
      expect(service.secret).toBe(SECRET);
      expect(service.expiresIn).toBe('2h');
    });

    it('debe usar "1d" como expiresIn por defecto', () => {
      const service = new JwtService(SECRET);
      expect(service.expiresIn).toBe('1d');
    });

    it('debe lanzar error si no se provee el secret', () => {
      expect(() => new JwtService()).toThrow('JWT_SECRET es requerido');
      expect(() => new JwtService(null)).toThrow('JWT_SECRET es requerido');
      expect(() => new JwtService('')).toThrow('JWT_SECRET es requerido');
    });
  });

  // ──────────────────────────────────────────────
  // sign()
  // ──────────────────────────────────────────────
  describe('sign()', () => {
    let service;

    beforeEach(() => {
      service = new JwtService(SECRET, '1h');
    });

    it('debe generar un token JWT como string', () => {
      const token = service.sign({ id: 1, rol: 'Aprendiz' });

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // header.payload.signature
    });

    it('debe incluir el payload en el token generado', () => {
      const payload = { id: 42, rol: 'Instructor', correo: 'test@sena.edu.co' };
      const token = service.sign(payload);
      const decoded = service.decode(token);

      expect(decoded.id).toBe(42);
      expect(decoded.rol).toBe('Instructor');
      expect(decoded.correo).toBe('test@sena.edu.co');
    });

    it('debe aceptar expiresIn personalizado en las opciones', () => {
      const token = service.sign({ id: 1 }, { expiresIn: '30s' });
      const decoded = service.decode(token);

      // El campo exp debe existir y estar en el futuro
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('el token debe ser verificable con el mismo secret', () => {
      const token = service.sign({ id: 5 });
      const verified = service.verify(token);

      expect(verified.id).toBe(5);
    });
  });

  // ──────────────────────────────────────────────
  // verify()
  // ──────────────────────────────────────────────
  describe('verify()', () => {
    let service;

    beforeEach(() => {
      service = new JwtService(SECRET, '1h');
    });

    it('debe decodificar y retornar el payload de un token válido', () => {
      const token = service.sign({ id: 10, nombre: 'Carlos' });
      const payload = service.verify(token);

      expect(payload.id).toBe(10);
      expect(payload.nombre).toBe('Carlos');
    });

    it('debe lanzar Error("Token inválido") con un token mal formado', () => {
      expect(() => service.verify('esto-no-es-un-token')).toThrow('Token inválido');
    });

    it('debe lanzar Error("Token inválido") si el secret es diferente', () => {
      const otroService = new JwtService('otro-secret');
      const token = otroService.sign({ id: 1 });

      expect(() => service.verify(token)).toThrow('Token inválido');
    });

    it('debe lanzar Error("Token expirado") con un token vencido', async () => {
      // Crear token que vence en 1 segundo
      const shortService = new JwtService(SECRET, '1ms');
      const token = shortService.sign({ id: 99 });

      // Esperar a que expire
      await new Promise((r) => setTimeout(r, 50));

      expect(() => service.verify(token)).toThrow('Token expirado');
    });

    it('debe re-lanzar errores no reconocidos (NotBeforeError) [line 51]', async () => {
      // NotBeforeError ocurre cuando el token tiene nbf en el futuro
      const jwt = await import('jsonwebtoken');
      const futureToken = jwt.default.sign(
        { id: 1, nbf: Math.floor(Date.now() / 1000) + 3600 },
        SECRET
      );

      // jwt.verify lanza NotBeforeError, no cubierto por los if anteriores
      expect(() => service.verify(futureToken)).toThrow();
    });
  });

  // ──────────────────────────────────────────────
  // decode()
  // ──────────────────────────────────────────────
  describe('decode()', () => {
    let service;

    beforeEach(() => {
      service = new JwtService(SECRET);
    });

    it('debe decodificar el payload sin verificar la firma', () => {
      const token = service.sign({ id: 7, rol: 'Cuentadante' });
      const decoded = service.decode(token);

      expect(decoded.id).toBe(7);
      expect(decoded.rol).toBe('Cuentadante');
    });

    it('debe decodificar un token aunque sea de un secret diferente', () => {
      const otroService = new JwtService('otro-secret-cualquiera');
      const token = otroService.sign({ id: 15 });
      const decoded = service.decode(token); // sin verificar

      expect(decoded.id).toBe(15);
    });

    it('debe retornar null para un token completamente inválido', () => {
      const result = service.decode('no-es-un-token');
      expect(result).toBeNull();
    });

    it('el token decodificado debe incluir iat y exp', () => {
      const token = service.sign({ id: 1 });
      const decoded = service.decode(token);

      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });
  });
});
