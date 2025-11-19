import { BaseRepository } from './BaseRepository.js';

/**
 * InvitationCodeRepository - Repositorio para operaciones de códigos de invitación
 * 
 * Patrón: Repository Pattern
 * Principio: Single Responsibility Principle (SRP)
 */
export class InvitationCodeRepository extends BaseRepository {
  /**
   * Busca un código de invitación por código
   * @param {string} codigo - Código de invitación
   * @returns {Promise<Object|null>} Código encontrado o null
   */
  async findByCode(codigo) {
    return this.findOne(
      `SELECT * FROM Invitation_Codes 
       WHERE codigo = ? AND estado = 'Activo'`,
      [codigo]
    );
  }

  /**
   * Crea un nuevo código de invitación
   * @param {Object} codeData - Datos del código
   * @returns {Promise<Object>} Resultado de la inserción
   */
  async create(codeData) {
    const {
      codigo,
      rol_destinado,
      fecha_expiracion,
      max_usos,
      creado_por
    } = codeData;

    const [result] = await this.db.execute(
      `INSERT INTO Invitation_Codes 
       (codigo, rol_destinado, fecha_expiracion, max_usos, creado_por, estado) 
       VALUES (?, ?, ?, ?, ?, 'Activo')`,
      [codigo, rol_destinado, fecha_expiracion || null, max_usos || 1, creado_por || null]
    );

    return { insertId: result.insertId, affectedRows: result.affectedRows };
  }

  /**
   * Incrementa el contador de usos de un código
   * @param {string} codigo - Código de invitación
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async incrementUsage(codigo) {
    const [result] = await this.db.execute(
      `UPDATE Invitation_Codes 
       SET usos_actuales = usos_actuales + 1 
       WHERE codigo = ?`,
      [codigo]
    );
    return result;
  }

  /**
   * Actualiza el estado de un código
   * @param {string} codigo - Código de invitación
   * @param {string} estado - Nuevo estado
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateStatus(codigo, estado) {
    const [result] = await this.db.execute(
      `UPDATE Invitation_Codes 
       SET estado = ? 
       WHERE codigo = ?`,
      [estado, codigo]
    );
    return result;
  }

  /**
   * Obtiene todos los códigos de invitación
   * @param {Object} filters - Filtros opcionales
   * @returns {Promise<Array>} Lista de códigos
   */
  async findAll(filters = {}) {
    let query = `SELECT 
      ic.*,
      u.nombre_usuario as creado_por_nombre
    FROM Invitation_Codes ic
    LEFT JOIN Usuarios u ON ic.creado_por = u.id_usuario
    WHERE 1=1`;
    const params = [];

    if (filters.rol) {
      query += ' AND ic.rol_destinado = ?';
      params.push(filters.rol);
    }

    if (filters.estado) {
      query += ' AND ic.estado = ?';
      params.push(filters.estado);
    }

    query += ' ORDER BY ic.fecha_creacion DESC';

    return this.execute(query, params);
  }

  /**
   * Obtiene un código por ID
   * @param {number} id - ID del código
   * @returns {Promise<Object|null>} Código encontrado o null
   */
  async findById(id) {
    return this.findOne(
      `SELECT 
        ic.*,
        u.nombre_usuario as creado_por_nombre
      FROM Invitation_Codes ic
      LEFT JOIN Usuarios u ON ic.creado_por = u.id_usuario
      WHERE ic.id_codigo = ?`,
      [id]
    );
  }

  /**
   * Elimina un código de invitación
   * @param {number} id - ID del código
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async delete(id) {
    const [result] = await this.db.execute(
      'DELETE FROM Invitation_Codes WHERE id_codigo = ?',
      [id]
    );
    return result;
  }

  /**
   * Actualiza códigos expirados o agotados
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateExpiredCodes() {
    const [result] = await this.db.execute(
      `UPDATE Invitation_Codes 
       SET estado = 'Expirado' 
       WHERE estado = 'Activo' 
       AND fecha_expiracion IS NOT NULL 
       AND fecha_expiracion < NOW()`
    );

    const [result2] = await this.db.execute(
      `UPDATE Invitation_Codes 
       SET estado = 'Agotado' 
       WHERE estado = 'Activo' 
       AND max_usos > 0 
       AND usos_actuales >= max_usos`
    );

    return { expired: result.affectedRows, exhausted: result2.affectedRows };
  }
}

