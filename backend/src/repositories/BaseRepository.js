/**
 * BaseRepository - Clase base abstracta para todos los repositorios
 * 
 * Patrón: Repository Pattern
 * Principio: Dependency Inversion Principle (DIP)
 * 
 * Proporciona una interfaz común para el acceso a datos,
 * permitiendo cambiar la implementación sin afectar la lógica de negocio.
 */
export class BaseRepository {
  constructor(db) {
    if (this.constructor === BaseRepository) {
      throw new Error('BaseRepository es una clase abstracta y no puede ser instanciada directamente');
    }
    this.db = db;
  }

  /**
   * Ejecuta una consulta SQL
   * @param {string} query - Consulta SQL
   * @param {Array} params - Parámetros de la consulta
   * @returns {Promise<Array>} Resultado de la consulta
   */
  async execute(query, params = []) {
    const [rows] = await this.db.execute(query, params);
    return rows;
  }

  /**
   * Ejecuta una consulta y retorna el primer resultado
   * @param {string} query - Consulta SQL
   * @param {Array} params - Parámetros de la consulta
   * @returns {Promise<Object|null>} Primer resultado o null
   */
  async findOne(query, params = []) {
    const rows = await this.execute(query, params);
    return rows[0] || null;
  }

  /**
   * Ejecuta una transacción
   * @param {Function} callback - Función que contiene las operaciones de la transacción
   * @returns {Promise<any>} Resultado de la transacción
   */
  async transaction(callback) {
    // El db wrapper debe tener acceso al pool
    if (!this.db.pool) {
      throw new Error('El repositorio no tiene acceso al pool de conexiones');
    }
    
    const connection = await this.db.pool.getConnection();
    await connection.beginTransaction();
    
    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

