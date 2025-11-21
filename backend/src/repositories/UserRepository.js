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
   * Busca un usuario por cédula o correo (solo usuarios activos)
   * Usado para validar registros - no debe encontrar usuarios inactivos
   * @param {string} cedula - Cédula del usuario
   * @param {string} correo - Correo del usuario
   * @returns {Promise<Object|null>} Usuario encontrado o null
   */
  async findByCedulaOrEmail(cedula, correo) {
    const correoNormalizado = correo?.toLowerCase().trim() || null;
    
    // Construir la consulta dinámicamente para manejar valores null
    // Buscar por cédula O correo (si existe), SOLO usuarios activos
    let query = 'SELECT id_usuario, cedula, correo, estado FROM Usuarios WHERE estado = "Activo" AND (cedula = ?';
    const params = [cedula];
    
    if (correoNormalizado) {
      query += ' OR (correo IS NOT NULL AND LOWER(TRIM(correo)) = ?))';
      params.push(correoNormalizado);
    } else {
      query += ')';
    }
    
    // Limitar a 1 resultado
    query += ' LIMIT 1';
    
    return this.findOne(query, params);
  }

  /**
   * Busca un usuario inactivo por cédula o correo
   * Usado para limpiar usuarios inactivos antes de permitir nuevo registro
   * @param {string} cedula - Cédula del usuario
   * @param {string} correo - Correo del usuario
   * @returns {Promise<Object|null>} Usuario inactivo encontrado o null
   */
  async findInactiveByCedulaOrEmail(cedula, correo) {
    const correoNormalizado = correo?.toLowerCase().trim() || null;
    
    // Buscar usuarios inactivos con la misma cédula o correo
    let query = 'SELECT id_usuario, cedula, correo, estado FROM Usuarios WHERE estado = "Inactivo" AND (cedula = ?';
    const params = [cedula];
    
    if (correoNormalizado) {
      query += ' OR (correo IS NOT NULL AND LOWER(TRIM(correo)) = ?))';
      params.push(correoNormalizado);
    } else {
      query += ')';
    }
    
    query += ' LIMIT 1';
    
    return this.findOne(query, params);
  }

  /**
   * Busca un usuario por cédula
   * @param {string} cedula - Cédula del usuario
   * @returns {Promise<Object|null>} Usuario encontrado o null
   */
  async findByCedula(cedula) {
    return this.findOne(
      `SELECT u.*, r.nombre_rol, u.requiere_cambio_contrasena
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
              r.nombre_rol, u.requiere_cambio_contrasena
       FROM Usuarios u
       LEFT JOIN Roles r ON r.id_rol = u.id_rol
       WHERE u.id_usuario = ? AND u.estado = "Activo"`,
      [userId]
    );
  }

  /**
   * Lista todos los usuarios activos con información completa
   * @returns {Promise<Array>} Lista de usuarios
   */
  async findAll() {
    return this.execute(
      `SELECT 
         u.id_usuario, 
         u.nombre_usuario, 
         u.cedula, 
         u.correo, 
         u.telefono,
         r.nombre_rol,
         u.estado,
         u.fecha_registro,
         u.ultimo_acceso,
         u.requiere_cambio_contrasena,
         u.creado_por,
         creador.nombre_usuario AS creado_por_nombre,
         (SELECT COUNT(*) FROM Responsables_Equipo re 
          WHERE re.id_usuario = u.id_usuario 
          AND re.estado_responsabilidad = 'Activo') AS equipos_asignados
       FROM Usuarios u
       LEFT JOIN Roles r ON r.id_rol = u.id_rol
       LEFT JOIN Usuarios creador ON creador.id_usuario = u.creado_por
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
      contrasena,
      idRol,
    } = userData;

    try {
      const [result] = await this.db.execute(
        `INSERT INTO Usuarios 
         (nombre_usuario, cedula, correo, telefono, contrasena, id_rol, estado) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nombre, cedula, correo.toLowerCase().trim(), telefono, contrasena, idRol, 'Activo']
      );

      return { insertId: result.insertId, affectedRows: result.affectedRows };
    } catch (error) {
      // Si es un error de clave duplicada, lanzar un error más descriptivo
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.message.includes('cedula')) {
          throw new Error('La cédula ya está registrada');
        } else if (error.message.includes('correo')) {
          throw new Error('El correo electrónico ya está registrado');
        }
        throw new Error('El usuario ya existe (cédula o correo duplicado)');
      }
      throw error;
    }
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
   * Elimina un usuario físicamente de la base de datos
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async delete(userId) {
    // Primero verificar que el usuario existe
    const usuario = await this.findOne(
      'SELECT id_usuario, cedula, correo FROM Usuarios WHERE id_usuario = ?',
      [userId]
    );
    
    if (!usuario) {
      return { affectedRows: 0 };
    }

    // Eliminar físicamente
    const [result] = await this.db.execute(
      'DELETE FROM Usuarios WHERE id_usuario = ?',
      [userId]
    );

    // Verificar que realmente se eliminó
    const usuarioEliminado = await this.findOne(
      'SELECT id_usuario FROM Usuarios WHERE id_usuario = ?',
      [userId]
    );

    if (usuarioEliminado) {
      throw new Error(`Error: El usuario con ID ${userId} no fue eliminado correctamente`);
    }

    return { affectedRows: result.affectedRows, usuarioEliminado: usuario };
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

