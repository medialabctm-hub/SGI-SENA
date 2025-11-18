/**
 * AuthFacade - Facade para operaciones de autenticación
 * 
 * Patrón: Facade Pattern
 * Principio: Single Responsibility Principle (SRP)
 * 
 * Proporciona una interfaz simplificada para operaciones complejas
 * de autenticación, ocultando la complejidad de los subsistemas.
 */
import { ServiceFactory } from '../factories/ServiceFactory.js';

export class AuthFacade {
  constructor() {
    this.authService = ServiceFactory.create('authService');
    this.logger = ServiceFactory.create('logger');
  }

  /**
   * Registra un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} Resultado del registro
   */
  async register(userData) {
    try {
      this.logger.info('Iniciando registro de usuario', { cedula: userData.cedula });
      const result = await this.authService.registerUser(userData);
      this.logger.info('Usuario registrado exitosamente', { cedula: userData.cedula });
      return result;
    } catch (error) {
      this.logger.error('Error en registro de usuario', { error: error.message });
      throw error;
    }
  }

  /**
   * Autentica un usuario
   * @param {string} cedula - Cédula del usuario
   * @param {string} contrasena - Contraseña del usuario
   * @returns {Promise<Object>} Token y datos del usuario
   */
  async login(cedula, contrasena) {
    try {
      this.logger.info('Iniciando autenticación', { cedula });
      const result = await this.authService.loginUser(cedula, contrasena);
      this.logger.info('Autenticación exitosa', { cedula });
      return result;
    } catch (error) {
      this.logger.warn('Error en autenticación', { cedula, error: error.message });
      throw error;
    }
  }

  /**
   * Obtiene el perfil del usuario actual
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Datos del usuario
   */
  async getProfile(userId) {
    try {
      return await this.authService.getCurrentUser(userId);
    } catch (error) {
      this.logger.error('Error al obtener perfil', { userId, error: error.message });
      throw error;
    }
  }
}

