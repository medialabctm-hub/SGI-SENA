/**
 * ValidationStrategy - Estrategia base para validaciones
 * 
 * Patrón: Strategy Pattern
 * Principio: Open/Closed Principle (OCP)
 * 
 * Permite definir diferentes estrategias de validación que pueden
 * ser intercambiadas en tiempo de ejecución.
 */
export class ValidationStrategy {
  /**
   * Valida un valor
   * @param {any} value - Valor a validar
   * @returns {Object} { valid: boolean, error: string|null }
   */
  validate(value) {
    throw new Error('Método validate debe ser implementado por las subclases');
  }
}

/**
 * EmailValidationStrategy - Estrategia para validar emails
 */
export class EmailValidationStrategy extends ValidationStrategy {
  validate(value) {
    if (!value) {
      return { valid: false, error: 'El correo es requerido' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, error: 'Formato de correo inválido' };
    }

    return { valid: true, error: null };
  }
}

/**
 * PasswordValidationStrategy - Estrategia para validar contraseñas
 */
export class PasswordValidationStrategy extends ValidationStrategy {
  constructor(minLength = 6) {
    super();
    this.minLength = minLength;
  }

  validate(value) {
    if (!value) {
      return { valid: false, error: 'La contraseña es requerida' };
    }

    if (value.length < this.minLength) {
      return {
        valid: false,
        error: `La contraseña debe tener al menos ${this.minLength} caracteres`,
      };
    }

    return { valid: true, error: null };
  }
}

/**
 * CedulaValidationStrategy - Estrategia para validar cédulas
 */
export class CedulaValidationStrategy extends ValidationStrategy {
  constructor(minLength = 5) {
    super();
    this.minLength = minLength;
  }

  validate(value) {
    if (!value) {
      return { valid: false, error: 'La cédula es requerida' };
    }

    if (value.trim().length < this.minLength) {
      return {
        valid: false,
        error: `La cédula debe tener al menos ${this.minLength} caracteres`,
      };
    }

    return { valid: true, error: null };
  }
}

/**
 * ValidationContext - Contexto que usa las estrategias de validación
 */
export class ValidationContext {
  constructor(strategy) {
    this.strategy = strategy;
  }

  /**
   * Establece la estrategia de validación
   * @param {ValidationStrategy} strategy - Estrategia a usar
   */
  setStrategy(strategy) {
    this.strategy = strategy;
  }

  /**
   * Ejecuta la validación usando la estrategia actual
   * @param {any} value - Valor a validar
   * @returns {Object} { valid: boolean, error: string|null }
   */
  validate(value) {
    if (!this.strategy) {
      throw new Error('Estrategia de validación no establecida');
    }
    return this.strategy.validate(value);
  }
}

