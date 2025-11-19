import bcrypt from 'bcrypt';

/**
 * PasswordService - Servicio para operaciones relacionadas con contraseñas
 * 
 * Patrón: Service Layer
 * Principio: Single Responsibility Principle (SRP)
 * 
 * Encapsula toda la lógica relacionada con el manejo de contraseñas,
 * permitiendo cambiar la implementación sin afectar otros servicios.
 */
export class PasswordService {
  constructor(saltRounds = 10) {
    this.saltRounds = saltRounds;
  }

  /**
   * Hashea una contraseña
   * @param {string} password - Contraseña a hashear
   * @returns {Promise<string>} Hash de la contraseña
   */
  async hash(password) {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compara una contraseña con un hash
   * @param {string} password - Contraseña en texto plano
   * @param {string} hash - Hash de la contraseña
   * @returns {Promise<boolean>} True si coinciden, false en caso contrario
   */
  async compare(password, hash) {
    return bcrypt.compare(password, hash);
  }
}

