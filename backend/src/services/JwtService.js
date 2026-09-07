import jwt from 'jsonwebtoken';

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
  constructor(secret, expiresIn = '1d', options = {}) {
    if (!secret) {
      throw new Error('JWT_SECRET es requerido');
    }

    // Acepta el constructor histórico (secret, expiresIn) y permite que DI
    // pase el contrato JWT explícito sin convertirlo en una opción del token.
    const serviceOptions = expiresIn && typeof expiresIn === 'object'
      ? expiresIn
      : options;
    const configuredExpiresIn = expiresIn && typeof expiresIn === 'object'
      ? expiresIn.expiresIn || '1d'
      : expiresIn;

    this.secret = secret;
    this.expiresIn = configuredExpiresIn;
    this.algorithm = serviceOptions.algorithm || 'HS256';
    this.issuer = serviceOptions.issuer || 'gse-app';
    this.audience = serviceOptions.audience || 'gse-users';
  }

  /**
   * Genera un token JWT
   * @param {Object} payload - Datos a incluir en el token
   * @param {Object} options - Opciones adicionales (expiresIn, etc.)
   * @returns {string} Token JWT
   */
  sign(payload, options = {}) {
    const { expiresIn, algorithm, issuer, audience, ...additionalOptions } = options;

    return jwt.sign(payload, this.secret, {
      ...additionalOptions,
      expiresIn: expiresIn || this.expiresIn,
      algorithm: this.algorithm,
      issuer: this.issuer,
      audience: this.audience,
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
      return jwt.verify(token, this.secret, {
        algorithms: [this.algorithm],
        issuer: this.issuer,
        audience: this.audience,
      });
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

