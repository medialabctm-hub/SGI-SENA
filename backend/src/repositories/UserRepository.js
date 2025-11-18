import { BaseRepository } from './BaseRepository.js';

/**
 * UserRepository - Repositorio para operaciones de usuarios
 * 
 * Patrón: Repository Pattern
 * Principio: Single Responsibility Principle (SRP)
 * 
 * Encapsula toda la lógica de acceso a datos relacionada con usuarios,
 * separando la persistencia de la lógica de negocio.
 */
export class UserRepository extends BaseRepository {
  /**
   * Busca un usuario por cédula o correo
   * @param {string} cedula - Cédula del usuario
   * @param {string} correo - Correo del usuario
   * @returns {Promise<Object|null>} Usuario encontrado o null
   */
  async findByCedulaOrEmail(cedula, correo) {
    return this.findOne(
      'SELECT id_usuario FROM Usuarios WHERE LOWER(TRIM(correo)) = ? OR cedula = ?',
      [correo?.toLowerCase().trim(), cedula]
    );
  }

  /**
   * Busca un usuario por cédula
   * @param {string} cedula - Cédula del usuario
   * @returns {Promise<Object|null>} Usuario encontrado o null
   */
  async findByCedula(cedula) {
    return this.findOne(
      `SELECT u.*, u.area_usuarios AS area, r.nombre_rol
       FROM Usuarios u
       LEFT JOIN Roles r ON r.id_rol = u.id_rol
       WHERE u.cedula = ? AND u.estado = "Activo"`,
      [cedula]
    );
  }

  /**
   * Busca un usuario por ID
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object|null>} Usuario encontrado o null
   */
  async findById(userId) {
    return this.findOne(
      `SELECT u.id_usuario, u.nombre_usuario, u.correo, u.telefono, u.cedula, 
              u.area_usuarios AS area, r.nombre_rol
       FROM Usuarios u
       LEFT JOIN Roles r ON r.id_rol = u.id_rol
       WHERE u.id_usuario = ? AND u.estado = "Activo"`,
      [userId]
    );
  }

  /**
   * Lista todos los usuarios activos
   * @returns {Promise<Array>} Lista de usuarios
   */
  async findAll() {
    return this.execute(
      `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.correo, u.telefono,
              u.area_usuarios AS area, r.nombre_rol,
              (SELECT COUNT(*) FROM Responsables_Equipo re 
               WHERE re.id_usuario = u.id_usuario 
               AND re.estado_responsabilidad = 'Activo') AS equipos_asignados
       FROM Usuarios u
       LEFT JOIN Roles r ON r.id_rol = u.id_rol
       WHERE u.estado = 'Activo'
       ORDER BY u.nombre_usuario`
    );
  }

  /**
   * Crea un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} Resultado de la inserción
   */
  async create(userData) {
    const {
      nombre,
      cedula,
      correo,
      telefono,
      area,
      contrasena,
      idRol,
    } = userData;

    const [result] = await this.db.execute(
      `INSERT INTO Usuarios 
       (nombre_usuario, cedula, correo, telefono, area_usuarios, contrasena, id_rol, estado) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, cedula, correo.toLowerCase().trim(), telefono, area || null, contrasena, idRol, 'Activo']
    );

    return { insertId: result.insertId, affectedRows: result.affectedRows };
  }

  /**
   * Actualiza un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} userData - Datos a actualizar
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async update(userId, userData) {
    const updates = [];
    const values = [];

    if (userData.nombre) {
      updates.push('nombre_usuario = ?');
      values.push(userData.nombre);
    }
    if (userData.cedula) {
      updates.push('cedula = ?');
      values.push(userData.cedula);
    }
    if (userData.correo) {
      updates.push('correo = ?');
      values.push(userData.correo.toLowerCase().trim());
    }
    if (userData.telefono) {
      updates.push('telefono = ?');
      values.push(userData.telefono);
    }
    if (userData.idRol) {
      updates.push('id_rol = ?');
      values.push(userData.idRol);
    }

    if (updates.length === 0) {
      return { affectedRows: 0 };
    }

    values.push(userId);

    const [result] = await this.db.execute(
      `UPDATE Usuarios SET ${updates.join(', ')} WHERE id_usuario = ?`,
      values
    );

    return { affectedRows: result.affectedRows };
  }

  /**
   * Elimina un usuario (borrado lógico)
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async delete(userId) {
    const [result] = await this.db.execute(
      'UPDATE Usuarios SET estado = "Inactivo" WHERE id_usuario = ?',
      [userId]
    );

    return { affectedRows: result.affectedRows };
  }

  /**
   * Obtiene los equipos asignados a un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Array>} Lista de equipos asignados
   */
  async getAssignedEquipos(userId) {
    return this.execute(
      `SELECT e.codigo_equipo, e.numero_serie, e.tipo, e.marca, e.modelo, 
              ee.estado_operativo, a.nombre_ambiente, a.codigo_ambiente, 
              re.fecha_asignacion, re.tipo_responsabilidad, 
              DATEDIFF(NOW(), re.fecha_asignacion) AS dias_asignado
       FROM Responsables_Equipo re
       INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
       LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
       LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
       WHERE re.id_usuario = ? AND re.estado_responsabilidad = 'Activo'
       ORDER BY re.fecha_asignacion DESC`,
      [userId]
    );
  }
}

