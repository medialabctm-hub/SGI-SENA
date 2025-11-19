import { BaseRepository } from './BaseRepository.js';

/**
 * RoleRepository - Repositorio para operaciones de roles
 * 
 * Patrón: Repository Pattern
 * Principio: Single Responsibility Principle (SRP)
 */
export class RoleRepository extends BaseRepository {
  /**
   * Busca un rol por nombre
   * @param {string} roleName - Nombre del rol
   * @returns {Promise<Object|null>} Rol encontrado o null
   */
  async findByName(roleName) {
    return this.findOne(
      'SELECT id_rol FROM Roles WHERE nombre_rol = ?',
      [roleName]
    );
  }

  /**
   * Obtiene todos los roles activos
   * @returns {Promise<Array>} Lista de roles
   */
  async findAll() {
    return this.execute('SELECT * FROM Roles WHERE estado = "Activo"');
  }
}

