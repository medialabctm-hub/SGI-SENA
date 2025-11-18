import jwt from 'jsonwebtoken';
import process from 'process';

/**
 * JwtService - Servicio para operaciones relacionadas con JWT
 * 
 * Patrón: Service Layer
 * Principio: Single Responsibility Principle (SRP)
 * 
 * Encapsula toda la lógica relacionada con tokens JWT,
 * permitiendo cambiar la implementación sin afectar otros servicios.
 */
export class JwtService {
  constructor(secret, expiresIn = '1d') {
    if (!secret) {
      throw new Error('JWT_SECRET es requerido');
    }
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  /**
   * Genera un token JWT
   * @param {Object} payload - Datos a incluir en el token
   * @param {Object} options - Opciones adicionales (expiresIn, etc.)
   * @returns {string} Token JWT
   */
  sign(payload, options = {}) {
    return jwt.sign(payload, this.secret, {
      expiresIn: options.expiresIn || this.expiresIn,
      ...options,
    });
  }

  /**
   * Verifica y decodifica un token JWT
   * @param {string} token - Token a verificar
   * @returns {Object} Payload del token
   * @throws {Error} Si el token es inválido o ha expirado
   */
  verify(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expirado');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Token inválido');
      }
      throw error;
    }
  }

  /**
   * Decodifica un token sin verificar (útil para debugging)
   * @param {string} token - Token a decodificar
   * @returns {Object} Payload del token
   */
  decode(token) {
    return jwt.decode(token);
  }
}

