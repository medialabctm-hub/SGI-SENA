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
      `SELECT id_codigo, codigo, rol_destinado, fecha_expiracion, max_usos, 
              usos_actuales, creado_por, fecha_creacion, estado
       FROM Invitation_Codes 
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
   * Consume un código de forma serializada.
   *
   * La fila se bloquea dentro de una transacción antes de comprobar
   * expiración/cupo. Así, dos registros concurrentes no pueden observar el
   * mismo cupo y aumentarlo por encima de max_usos.
   *
   * @param {string} codigo - Código de invitación
   * @returns {Promise<{consumed: boolean, reason: string, code: Object|null}>}
   */
  async consumeCode(codigo) {
    return this.transaction(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT id_codigo, codigo, rol_destinado, fecha_expiracion, max_usos,
                usos_actuales, creado_por, fecha_creacion, estado
         FROM Invitation_Codes
         WHERE codigo = ?
         LIMIT 1
         FOR UPDATE`,
        [codigo]
      );

      const code = rows[0];
      if (!code) {
        return { consumed: false, reason: 'not_found', code: null };
      }

      let reason = null;
      if (code.estado !== 'Activo') {
        reason = code.estado === 'Expirado'
          ? 'expired'
          : code.estado === 'Agotado'
            ? 'exhausted'
            : 'inactive';
      } else if (code.fecha_expiracion && new Date(code.fecha_expiracion) <= new Date()) {
        reason = 'expired';
      } else if (code.max_usos > 0 && code.usos_actuales >= code.max_usos) {
        reason = 'exhausted';
      }

      if (reason) {
        if (code.estado === 'Activo' && (reason === 'expired' || reason === 'exhausted')) {
          await connection.execute(
            `UPDATE Invitation_Codes
             SET estado = ?
             WHERE id_codigo = ? AND estado = 'Activo'`,
            [reason === 'expired' ? 'Expirado' : 'Agotado', code.id_codigo]
          );
        }

        return { consumed: false, reason, code };
      }

      const [result] = await connection.execute(
        `UPDATE Invitation_Codes
         SET usos_actuales = usos_actuales + 1,
             estado = CASE
               WHEN max_usos > 0 AND usos_actuales + 1 >= max_usos THEN 'Agotado'
               ELSE estado
             END
         WHERE id_codigo = ?
           AND estado = 'Activo'
           AND (fecha_expiracion IS NULL OR fecha_expiracion > NOW())
           AND (max_usos = 0 OR usos_actuales < max_usos)`,
        [code.id_codigo]
      );

      if (result.affectedRows !== 1) {
        return { consumed: false, reason: 'unavailable', code };
      }

      const usosActuales = Number(code.usos_actuales) + 1;
      return {
        consumed: true,
        reason: 'consumed',
        code: {
          ...code,
          usos_actuales: usosActuales,
          estado: code.max_usos > 0 && usosActuales >= code.max_usos ? 'Agotado' : 'Activo',
        },
      };
    });
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

