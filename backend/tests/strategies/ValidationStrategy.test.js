/**
 * Tests para strategies/ValidationStrategy
 *
 * Cubre: ValidationStrategy (abstracta), EmailValidationStrategy,
 *        PasswordValidationStrategy, CedulaValidationStrategy, ValidationContext
 */

import { describe, it, expect } from '@jest/globals';
import {
  ValidationStrategy,
  EmailValidationStrategy,
  PasswordValidationStrategy,
  CedulaValidationStrategy,
  ValidationContext,
} from '../../src/strategies/ValidationStrategy.js';

// ──────────────────────────────────────────────
// ValidationStrategy (clase base abstracta)
// ──────────────────────────────────────────────
describe('ValidationStrategy (base abstracta)', () => {
  it('validate() debe lanzar error — obliga a implementar en subclases', () => {
    const strategy = new ValidationStrategy();
    expect(() => strategy.validate('cualquier-valor')).toThrow(
      'Método validate debe ser implementado por las subclases'
    );
  });
});

// ──────────────────────────────────────────────
// EmailValidationStrategy
// ──────────────────────────────────────────────
describe('EmailValidationStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new EmailValidationStrategy();
  });

  it('debe ser válido para un correo correcto', () => {
    const result = strategy.validate('usuario@sena.edu.co');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('debe ser válido para un correo con subdominio', () => {
    const result = strategy.validate('test@mail.example.com');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('debe fallar si el correo es null', () => {
    const result = strategy.validate(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('El correo es requerido');
  });

  it('debe fallar si el correo es undefined', () => {
    const result = strategy.validate(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('El correo es requerido');
  });

  it('debe fallar si el correo es una cadena vacía', () => {
    const result = strategy.validate('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('El correo es requerido');
  });

  it('debe fallar si no tiene @', () => {
    const result = strategy.validate('usuariosena.edu.co');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Formato de correo inválido');
  });

  it('debe fallar si no tiene dominio', () => {
    const result = strategy.validate('usuario@');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Formato de correo inválido');
  });

  it('debe fallar si no tiene TLD', () => {
    const result = strategy.validate('usuario@sena');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Formato de correo inválido');
  });

  it('debe fallar si tiene espacios en el correo', () => {
    const result = strategy.validate('usuario @sena.edu.co');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Formato de correo inválido');
  });
});

// ──────────────────────────────────────────────
// PasswordValidationStrategy
// ──────────────────────────────────────────────
describe('PasswordValidationStrategy', () => {
  describe('con minLength por defecto (6)', () => {
    let strategy;

    beforeEach(() => {
      strategy = new PasswordValidationStrategy();
    });

    it('debe ser válido con exactamente 6 caracteres', () => {
      const result = strategy.validate('abc123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('debe ser válido con más de 6 caracteres', () => {
      const result = strategy.validate('contraseña-segura-123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('debe fallar si la contraseña es null', () => {
      const result = strategy.validate(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La contraseña es requerida');
    });

    it('debe fallar si la contraseña es undefined', () => {
      const result = strategy.validate(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La contraseña es requerida');
    });

    it('debe fallar si la contraseña es vacía', () => {
      const result = strategy.validate('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La contraseña es requerida');
    });

    it('debe fallar si la contraseña tiene 5 caracteres', () => {
      const result = strategy.validate('abc12');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch('al menos 6 caracteres');
    });
  });

  describe('con minLength personalizado (8)', () => {
    let strategy;

    beforeEach(() => {
      strategy = new PasswordValidationStrategy(8);
    });

    it('debe fallar con 7 caracteres cuando el mínimo es 8', () => {
      const result = strategy.validate('abcdefg');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch('al menos 8 caracteres');
    });

    it('debe ser válido con 8 caracteres', () => {
      const result = strategy.validate('abcdefgh');
      expect(result.valid).toBe(true);
    });
  });
});

// ──────────────────────────────────────────────
// CedulaValidationStrategy
// ──────────────────────────────────────────────
describe('CedulaValidationStrategy', () => {
  describe('con minLength por defecto (5)', () => {
    let strategy;

    beforeEach(() => {
      strategy = new CedulaValidationStrategy();
    });

    it('debe ser válido con exactamente 5 caracteres', () => {
      const result = strategy.validate('12345');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('debe ser válido con más de 5 caracteres', () => {
      const result = strategy.validate('1234567890');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('debe fallar si la cédula es null', () => {
      const result = strategy.validate(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La cédula es requerida');
    });

    it('debe fallar si la cédula es undefined', () => {
      const result = strategy.validate(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La cédula es requerida');
    });

    it('debe fallar si la cédula está vacía', () => {
      const result = strategy.validate('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La cédula es requerida');
    });

    it('debe fallar si la cédula tiene 4 caracteres (con espacios)', () => {
      const result = strategy.validate('1234');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch('al menos 5 caracteres');
    });

    it('debe considerar espacios en la longitud mínima', () => {
      // "  1  " después de trim tiene 1 caracter → falla
      const result = strategy.validate('  1  ');
      expect(result.valid).toBe(false);
    });
  });

  describe('con minLength personalizado (10)', () => {
    let strategy;

    beforeEach(() => {
      strategy = new CedulaValidationStrategy(10);
    });

    it('debe fallar con 9 caracteres cuando el mínimo es 10', () => {
      const result = strategy.validate('123456789');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch('al menos 10 caracteres');
    });

    it('debe ser válido con 10 caracteres', () => {
      const result = strategy.validate('1234567890');
      expect(result.valid).toBe(true);
    });
  });
});

// ──────────────────────────────────────────────
// ValidationContext
// ──────────────────────────────────────────────
describe('ValidationContext', () => {
  it('debe delegar la validación a la estrategia actual', () => {
    const context = new ValidationContext(new EmailValidationStrategy());
    const result = context.validate('test@example.com');
    expect(result.valid).toBe(true);
  });

  it('debe usar la nueva estrategia después de setStrategy()', () => {
    const context = new ValidationContext(new EmailValidationStrategy());
    context.setStrategy(new PasswordValidationStrategy());

    // Con la estrategia de contraseña: 'abc' es demasiado corta
    const result = context.validate('abc');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch('contraseña');
  });

  it('debe lanzar error si no hay estrategia establecida', () => {
    const context = new ValidationContext(null);
    expect(() => context.validate('valor')).toThrow(
      'Estrategia de validación no establecida'
    );
  });

  it('debe funcionar con CedulaValidationStrategy', () => {
    const context = new ValidationContext(new CedulaValidationStrategy());

    expect(context.validate('12345').valid).toBe(true);
    expect(context.validate('123').valid).toBe(false);
  });

  it('setStrategy() debe cambiar la estrategia correctamente', () => {
    const context = new ValidationContext(new EmailValidationStrategy());

    // Cambiar a cédula
    context.setStrategy(new CedulaValidationStrategy());
    const resultEmail = context.validate('invalido@correo.com');
    // Con CedulaValidationStrategy el correo es una cadena válida si tiene >= 5 chars
    expect(resultEmail.valid).toBe(true);
  });
});
