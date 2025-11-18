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
    const { nombre, cedula, correo, telefono, contrasena, rol, area } = userData;

    // Validar datos usando estrategias
    this.validateUserData({ correo, contrasena, cedula });

    // Validar si el usuario ya existe
    const usuarioExistente = await this.userRepository.findByCedulaOrEmail(cedula, correo);
    if (usuarioExistente) {
      throw new ConflictError('El usuario ya existe');
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
      .withArea(area)
      .withContrasena(contrasena)
      .withIdRol(rolRow.id_rol)
      .build();

    // Hashear contraseña
    const hash = await this.passwordService.hash(userToCreate.contrasena);

    // Crear usuario en el repositorio
    await this.userRepository.create({
      ...userToCreate,
      contrasena: hash,
    });

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
      user: {
        id_usuario: usuario.id_usuario,
        nombre_usuario: usuario.nombre_usuario,
        correo: usuario.correo,
        telefono: usuario.telefono,
        cedula: usuario.cedula,
        nombre_rol: usuario.nombre_rol,
        area: usuario.area,
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
      area: user.area,
      nombre_rol: user.nombre_rol,
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
        area: user.area,
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
   * Elimina un usuario (borrado lógico)
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async deleteUser(userId) {
    const result = await this.userRepository.delete(userId);

    if (result.affectedRows === 0) {
      throw new NotFoundError('Usuario');
    }

    this.logger.info('Usuario eliminado (borrado lógico)', { userId });
    return { message: 'Usuario eliminado correctamente' };
  }
}
