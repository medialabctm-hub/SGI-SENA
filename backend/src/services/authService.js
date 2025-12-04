/**
 * AuthService - Servicio de autenticación refactorizado
 * 
 * Patrón: Service Layer
 * Principio: Dependency Inversion Principle (DIP), Single Responsibility Principle (SRP)
 * 
 * Contiene la lógica de negocio de autenticación, usando repositorios
 * y servicios inyectados en lugar de acceder directamente a la base de datos.
 */
import {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
} from '../utils/errors.js';
import { UserBuilder } from '../builders/UserBuilder.js';
import {
  EmailValidationStrategy,
  PasswordValidationStrategy,
  CedulaValidationStrategy,
  ValidationContext,
} from '../strategies/ValidationStrategy.js';

export class AuthService {
  constructor(userRepository, roleRepository, passwordService, jwtService, logger) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.passwordService = passwordService;
    this.jwtService = jwtService;
    this.logger = logger;

    // Configurar estrategias de validación
    this.emailValidator = new ValidationContext(new EmailValidationStrategy());
    this.passwordValidator = new ValidationContext(new PasswordValidationStrategy(6));
    this.cedulaValidator = new ValidationContext(new CedulaValidationStrategy(5));
  }

  /**
   * Valida los datos del usuario usando estrategias de validación
   * @param {Object} userData - Datos del usuario a validar
   * @throws {ValidationError} Si la validación falla
   */
  validateUserData(userData) {
    const errors = [];

    // Validar email
    const emailResult = this.emailValidator.validate(userData.correo);
    if (!emailResult.valid) {
      errors.push(emailResult.error);
    }

    // Validar contraseña
    const passwordResult = this.passwordValidator.validate(userData.contrasena);
    if (!passwordResult.valid) {
      errors.push(passwordResult.error);
    }

    // Validar cédula
    const cedulaResult = this.cedulaValidator.validate(userData.cedula);
    if (!cedulaResult.valid) {
      errors.push(cedulaResult.error);
    }

    if (errors.length > 0) {
      throw new ValidationError('Error de validación', errors);
    }
  }

  /**
   * Registra un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} Resultado del registro
   */
  async registerUser(userData) {
    const { nombre, cedula, correo, telefono, contrasena, rol, codigo_invitacion } = userData;

    // Validar datos usando estrategias
    this.validateUserData({ correo, contrasena, cedula });

    // Si el rol es Instructor, Administrador o Cuentadante, validar código de invitación
    if (rol === 'Instructor' || rol === 'Administrador' || rol === 'Cuentadante') {
      if (!codigo_invitacion) {
        throw new ValidationError(`El código de invitación es requerido para registrarse como ${rol}`);
      }

      // Obtener servicio de códigos de invitación
      const { ServiceFactory } = await import('../factories/ServiceFactory.js');
      const invitationCodeService = ServiceFactory.create('invitationCodeService');
      
      // Validar código
      await invitationCodeService.validateCode(codigo_invitacion, rol);
      
      // Usar código (incrementar contador)
      await invitationCodeService.useCode(codigo_invitacion);
    }

    // Validar si el usuario ya existe (solo activos)
    const usuarioExistente = await this.userRepository.findByCedulaOrEmail(cedula, correo);
    if (usuarioExistente) {
      this.logger.warn('Intento de registro con usuario existente', { 
        cedula, 
        correo, 
        id_usuario_existente: usuarioExistente.id_usuario 
      });
      throw new ConflictError('El usuario ya existe');
    }

    // Verificar si existe un usuario inactivo con la misma cédula o correo
    // Si existe, eliminarlo físicamente para permitir el nuevo registro
    const usuarioInactivo = await this.userRepository.findInactiveByCedulaOrEmail(cedula, correo);
    if (usuarioInactivo) {
      this.logger.info('Eliminando usuario inactivo para permitir nuevo registro', {
        id_usuario_inactivo: usuarioInactivo.id_usuario,
        cedula,
        correo
      });
      await this.userRepository.delete(usuarioInactivo.id_usuario);
    }

    // Buscar rol
    const rolRow = await this.roleRepository.findByName(rol);
    if (!rolRow) {
      throw new ValidationError('Rol inválido');
    }

    // Construir usuario usando Builder
    const userBuilder = new UserBuilder();
    const userToCreate = userBuilder
      .withNombre(nombre)
      .withCedula(cedula)
      .withCorreo(correo)
      .withTelefono(telefono)
      .withContrasena(contrasena)
      .withIdRol(rolRow.id_rol)
      .build();

    // Hashear contraseña
    const hash = await this.passwordService.hash(userToCreate.contrasena);

    // Crear usuario en el repositorio
    try {
      await this.userRepository.create({
        ...userToCreate,
        contrasena: hash,
      });
    } catch (error) {
      // Si es un error de clave duplicada, convertirlo en ConflictError
      if (error.message.includes('ya está registrado') || error.message.includes('duplicado')) {
        throw new ConflictError(error.message || 'El usuario ya existe');
      }
      // Re-lanzar otros errores
      throw error;
    }

    this.logger.info('Usuario registrado exitosamente', { cedula, correo });
    return { message: 'Usuario registrado correctamente' };
  }

  /**
   * Autentica un usuario y genera un token JWT
   * @param {string} cedula - Cédula del usuario
   * @param {string} contrasena - Contraseña del usuario
   * @returns {Promise<Object>} Token y datos del usuario
   */
  async loginUser(cedula, contrasena) {
    const usuario = await this.userRepository.findByCedula(cedula);

    if (!usuario) {
      this.logger.warn('Intento de login fallido - Usuario no encontrado', { cedula });
      throw new AuthenticationError('Credenciales inválidas');
    }

    const valid = await this.passwordService.compare(contrasena, usuario.contrasena);
    if (!valid) {
      this.logger.warn('Intento de login fallido - Contraseña incorrecta', { cedula });
      throw new AuthenticationError('Credenciales inválidas');
    }

    // Generar token JWT
    const token = this.jwtService.sign({
      id: usuario.id_usuario,
      rol: usuario.id_rol,
    });

    this.logger.info('Usuario autenticado exitosamente', {
      cedula,
      id: usuario.id_usuario,
    });

    return {
      token,
      requiereCambioContrasena: usuario.requiere_cambio_contrasena === 1 || usuario.requiere_cambio_contrasena === true,
      user: {
        id_usuario: usuario.id_usuario,
        nombre_usuario: usuario.nombre_usuario,
        correo: usuario.correo,
        telefono: usuario.telefono,
        cedula: usuario.cedula,
        nombre_rol: usuario.nombre_rol,
      },
    };
  }

  /**
   * Obtiene el perfil del usuario autenticado
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Datos del usuario
   */
  async getCurrentUser(userId) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('Usuario');
    }

    return {
      id_usuario: user.id_usuario,
      nombre_usuario: user.nombre_usuario,
      correo: user.correo,
      telefono: user.telefono,
      cedula: user.cedula,
      nombre_rol: user.nombre_rol,
      foto_perfil: user.foto_perfil,
      requiere_cambio_contrasena: user.requiere_cambio_contrasena === 1 || user.requiere_cambio_contrasena === true,
    };
  }

  /**
   * Lista todos los usuarios activos
   * @returns {Promise<Array>} Lista de usuarios
   */
  async listUsers() {
    return this.userRepository.findAll();
  }

  /**
   * Obtiene los detalles de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Datos del usuario y sus equipos
   */
  async getUserDetails(userId) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('Usuario');
    }

    const equipos = await this.userRepository.getAssignedEquipos(userId);

    return {
      user: {
        id_usuario: user.id_usuario,
        nombre_usuario: user.nombre_usuario,
        cedula: user.cedula,
        correo: user.correo,
        telefono: user.telefono,
        nombre_rol: user.nombre_rol,
      },
      equipos,
    };
  }

  /**
   * Busca un usuario por cédula
   * @param {string} cedula - Cédula del usuario
   * @returns {Promise<Object>} Datos del usuario
   */
  async getUserByCedula(cedula) {
    const user = await this.userRepository.findByCedula(cedula);

    if (!user) {
      throw new NotFoundError('Usuario');
    }

    return user;
  }

  /**
   * Actualiza un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} userData - Datos a actualizar
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateUser(userId, userData) {
    const { nombre, cedula, correo, telefono, rol } = userData;

    // Buscar id_rol si se proporciona
    let idRol = null;
    if (rol) {
      const rolRow = await this.roleRepository.findByName(rol);
      if (!rolRow) {
        throw new ValidationError('Rol inválido');
      }
      idRol = rolRow.id_rol;
    }

    // Preparar datos de actualización
    const updateData = {};
    if (nombre) updateData.nombre = nombre;
    if (cedula) updateData.cedula = cedula;
    if (correo) {
      // Validar email si se proporciona
      const emailResult = this.emailValidator.validate(correo);
      if (!emailResult.valid) {
        throw new ValidationError(emailResult.error);
      }
      updateData.correo = correo;
    }
    if (telefono) updateData.telefono = telefono;
    if (idRol) updateData.idRol = idRol;

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No hay campos para actualizar');
    }

    const result = await this.userRepository.update(userId, updateData);

    if (result.affectedRows === 0) {
      throw new NotFoundError('Usuario');
    }

    this.logger.info('Usuario actualizado', { userId });
    return { message: 'Usuario actualizado correctamente' };
  }

  /**
   * Actualiza la foto de perfil del usuario
   * @param {number} userId - ID del usuario
   * @param {string} fotoPerfilPath - Ruta de la foto de perfil
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateUserProfilePhoto(userId, fotoPerfilPath) {
    // Obtener usuario actual para eliminar foto anterior si existe
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Usuario');
    }

    // Si el usuario ya tiene una foto, eliminarla
    if (user.foto_perfil) {
      const { deleteProfileImageFile } = await import('../middleware/uploadProfileMiddleware.js');
      deleteProfileImageFile(user.foto_perfil);
    }

    // Actualizar foto de perfil
    const result = await this.userRepository.update(userId, { fotoPerfil: fotoPerfilPath });

    if (result.affectedRows === 0) {
      throw new NotFoundError('Usuario');
    }

    // Obtener usuario actualizado
    const updatedUser = await this.userRepository.findById(userId);
    
    this.logger.info('Foto de perfil actualizada', { userId });
    return { 
      message: 'Foto de perfil actualizada correctamente',
      user: updatedUser,
      foto_perfil: fotoPerfilPath
    };
  }

  /**
   * Elimina un usuario (borrado lógico)
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async deleteUser(userId) {
    const result = await this.userRepository.delete(userId);

    if (result.affectedRows === 0) {
      throw new NotFoundError('Usuario');
    }

    this.logger.info('Usuario eliminado físicamente de la base de datos', { userId });
    return { message: 'Usuario eliminado correctamente' };
  }

  /**
   * Cambia la contraseña de un usuario (obligatorio cuando requiere_cambio_contrasena es true)
   * @param {number} userId - ID del usuario
   * @param {string} contrasenaActual - Contraseña actual
   * @param {string} nuevaContrasena - Nueva contraseña
   * @returns {Promise<Object>} Resultado del cambio
   */
  async cambiarContrasenaObligatorio(userId, contrasenaActual, nuevaContrasena) {
    const usuario = await this.userRepository.findById(userId);
    
    if (!usuario) {
      throw new NotFoundError('Usuario');
    }

    // Validar contraseña actual
    const usuarioCompleto = await this.userRepository.findOne(
      'SELECT contrasena, requiere_cambio_contrasena FROM Usuarios WHERE id_usuario = ?',
      [userId]
    );

    if (!usuarioCompleto) {
      throw new NotFoundError('Usuario');
    }

    const valid = await this.passwordService.compare(contrasenaActual, usuarioCompleto.contrasena);
    if (!valid) {
      throw new AuthenticationError('La contraseña actual es incorrecta');
    }

    // Validar nueva contraseña
    const passwordResult = this.passwordValidator.validate(nuevaContrasena);
    if (!passwordResult.valid) {
      throw new ValidationError(passwordResult.error);
    }

    // Hash de la nueva contraseña
    const nuevaContrasenaHash = await this.passwordService.hash(nuevaContrasena);

    // Actualizar contraseña y quitar el flag de cambio obligatorio
    await this.userRepository.db.execute(
      'UPDATE Usuarios SET contrasena = ?, requiere_cambio_contrasena = 0 WHERE id_usuario = ?',
      [nuevaContrasenaHash, userId]
    );

    this.logger.info('Contraseña cambiada exitosamente', { userId });
    return { message: 'Contraseña cambiada correctamente' };
  }

  /**
   * Solicita recuperación de contraseña (envía correo con token)
   * @param {string} cedula - Cédula del usuario
   * @param {string} correo - Correo del usuario
   * @returns {Promise<Object>} Resultado de la solicitud
   */
  async solicitarRecuperacionContrasena(cedula, correo) {
    const usuario = await this.userRepository.findOne(
      'SELECT id_usuario, nombre_usuario, correo FROM Usuarios WHERE cedula = ? AND correo = ? AND estado = "Activo"',
      [cedula, correo.toLowerCase().trim()]
    );

    if (!usuario) {
      // Por seguridad, no revelamos si el usuario existe o no
      this.logger.warn('Intento de recuperación de contraseña - Usuario no encontrado', { cedula });
      return { message: 'Si el usuario existe, se enviará un correo con las instrucciones' };
    }

    // Generar token único
    const crypto = await import('crypto');
    const token = crypto.default.randomBytes(32).toString('hex');
    const fechaExpiracion = new Date();
    fechaExpiracion.setHours(fechaExpiracion.getHours() + 1); // Expira en 1 hora

    // Guardar token en la base de datos
    await this.userRepository.db.execute(
      `INSERT INTO Tokens_Recuperacion_Contrasena (id_usuario, token, fecha_expiracion)
       VALUES (?, ?, ?)`,
      [usuario.id_usuario, token, fechaExpiracion]
    );

    // Enviar correo con el token
    const emailService = (await import('../services/emailService.js')).default;
    
    // Asegurar que el servicio esté inicializado antes de enviar
    const smtpKey = process.env.BREVO_SMTP_KEY;
    if (!emailService.transporter && smtpKey) {
      this.logger.info('Reinicializando servicio de email SMTP con BREVO_SMTP_KEY encontrada');
      emailService.reinitialize();
    }
    
    const urlRecuperacion = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/restablecer-contrasena?token=${token}`;
    
    const resultadoCorreo = await emailService.enviarCorreoRecuperacion(
      usuario.correo,
      usuario.nombre_usuario,
      urlRecuperacion
    );

    if (!resultadoCorreo.success) {
      this.logger.warn('Error al enviar correo de recuperación', { 
        userId: usuario.id_usuario,
        cedula,
        error: resultadoCorreo.error
      });
    } else {
      this.logger.info('Solicitud de recuperación de contraseña procesada', { 
        userId: usuario.id_usuario,
        cedula 
      });
    }

    return { message: 'Si el usuario existe, se enviará un correo con las instrucciones' };
  }

  /**
   * Valida un token de recuperación de contraseña
   * @param {string} token - Token de recuperación
   * @returns {Promise<Object>} Información del token
   */
  async validarTokenRecuperacion(token) {
    const tokenData = await this.userRepository.findOne(
      `SELECT t.*, u.nombre_usuario, u.correo 
       FROM Tokens_Recuperacion_Contrasena t
       INNER JOIN Usuarios u ON u.id_usuario = t.id_usuario
       WHERE t.token = ? AND t.usado = 0 AND t.fecha_expiracion > NOW()`,
      [token]
    );

    if (!tokenData) {
      throw new AuthenticationError('Token inválido o expirado');
    }

    return {
      token: tokenData.token,
      nombre_usuario: tokenData.nombre_usuario,
      correo: tokenData.correo
    };
  }

  /**
   * Restablece la contraseña usando un token de recuperación
   * @param {string} token - Token de recuperación
   * @param {string} nuevaContrasena - Nueva contraseña
   * @returns {Promise<Object>} Resultado del restablecimiento
   */
  async restablecerContrasena(token, nuevaContrasena) {
    // Validar token
    const tokenData = await this.userRepository.findOne(
      `SELECT t.*, u.id_usuario 
       FROM Tokens_Recuperacion_Contrasena t
       INNER JOIN Usuarios u ON u.id_usuario = t.id_usuario
       WHERE t.token = ? AND t.usado = 0 AND t.fecha_expiracion > NOW()`,
      [token]
    );

    if (!tokenData) {
      throw new AuthenticationError('Token inválido o expirado');
    }

    // Validar nueva contraseña
    const passwordResult = this.passwordValidator.validate(nuevaContrasena);
    if (!passwordResult.valid) {
      throw new ValidationError(passwordResult.error);
    }

    // Hash de la nueva contraseña
    const nuevaContrasenaHash = await this.passwordService.hash(nuevaContrasena);

    // Actualizar contraseña y marcar token como usado
    const connection = await this.userRepository.db.pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        'UPDATE Usuarios SET contrasena = ?, requiere_cambio_contrasena = 0 WHERE id_usuario = ?',
        [nuevaContrasenaHash, tokenData.id_usuario]
      );

      await connection.execute(
        'UPDATE Tokens_Recuperacion_Contrasena SET usado = 1, fecha_uso = NOW() WHERE token = ?',
        [token]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    this.logger.info('Contraseña restablecida exitosamente', { 
      userId: tokenData.id_usuario 
    });

    return { message: 'Contraseña restablecida correctamente' };
  }
}
