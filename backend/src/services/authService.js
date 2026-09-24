/**
 * AuthService - Servicio de autenticación refactorizado
 * 
 * Patrón: Service Layer
 * Principio: Dependency Inversion Principle (DIP), Single Responsibility Principle (SRP)
 * 
 * Contiene la lógica de negocio de autenticación, usando repositorios
 * y servicios inyectados en lugar de acceder directamente a la base de datos.
 */
import crypto from 'node:crypto';
import {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
} from '../utils/errors.js';
import {
  REGISTER_APRENDIZ_DENIED_MESSAGE,
  APRENDIZ_ROSTER_PATH_NOTE,
} from '../utils/authRegisterGate.js';
import { UserBuilder } from '../builders/UserBuilder.js';
import {
  EmailValidationStrategy,
  PasswordValidationStrategy,
  CedulaValidationStrategy,
  ValidationContext,
} from '../strategies/ValidationStrategy.js';
import { normalizeCedula, normalizeCorreo } from '../utils/normalizeIdentity.js';
import { toPublicUser, toPublicUserList } from '../utils/usuarioPublico.js';

/**
 * Hash en reposo del token de recuperación (H-09).
 * El token en claro solo viaja por el correo/URL al usuario; en la base de
 * datos únicamente se guarda su SHA-256, de modo que una filtración de la BD
 * no entrega tokens de reset utilizables.
 * @param {string} token Token en claro.
 * @returns {string} SHA-256 en hexadecimal.
 */
export function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/** TTL del token de reset (MDL-232): máximo 1 hora. */
export const PASSWORD_RESET_TOKEN_TTL_HOURS = 1;

/**
 * Enmascara un correo para respuestas de validar-token (MDL-232).
 * Ej.: "abc@example.com" → "a***@example.com"
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '***';
  }
  const [local, domain] = email.split('@');
  if (!local.length) return `***@${domain}`;
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}


export class AuthService {
  constructor(userRepository, roleRepository, passwordService, jwtService, logger) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.passwordService = passwordService;
    this.jwtService = jwtService;
    this.logger = logger;

    // Configurar estrategias de validación
    this.emailValidator = new ValidationContext(new EmailValidationStrategy());
    this.passwordValidator = new ValidationContext(new PasswordValidationStrategy(8));
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
   * Busca una fila del roster institucional Aprendices por documento/cédula.
   * Vinculación operativa: Usuarios.cedula ↔ Aprendices.documento (TRIM).
   * @param {string} cedula
   * @returns {Promise<object|null>}
   */
  async findAprendizInRoster(cedula) {
    const documentoNormalizado = typeof cedula === 'string' ? cedula.trim() : String(cedula ?? '').trim();
    if (!documentoNormalizado) {
      return null;
    }

    const db = this.userRepository?.db;
    if (!db?.execute) {
      this.logger.warn('No hay acceso a BD para consultar roster Aprendices');
      return null;
    }

    const resultado = await db.execute(
      `SELECT id_aprendiz, nombre, documento, ficha
       FROM Aprendices
       WHERE TRIM(documento) = ?
       LIMIT 1`,
      [documentoNormalizado]
    );
    const filas = Array.isArray(resultado?.[0]) ? resultado[0] : [];
    return filas[0] || null;
  }

  /**
   * MDL-202 / H-03: Aprendiz solo puede registrarse con invitación válida
   * o con cédula presente en roster Aprendices. Denegaciones usan un único
   * mensaje genérico (anti-enumeración / H-05).
   *
   * Camino roster = institucional (Excel import). Tras 201, la cuenta solo
   * es operable si permanece vinculada al roster (login fail-closed).
   *
   * @param {object} userData
   * @throws {ValidationError}
   */
  async enforceAprendizRegistrationGate(userData) {
    const { cedula, rol, codigo_invitacion } = userData;
    if (rol !== 'Aprendiz') {
      return { path: null, rosterRow: null };
    }

    const codigo = typeof codigo_invitacion === 'string' ? codigo_invitacion.trim() : '';

    if (codigo) {
      try {
        const { ServiceFactory } = await import('../factories/ServiceFactory.js');
        const invitationCodeService = ServiceFactory.create('invitationCodeService');
        await invitationCodeService.validateCode(codigo, rol);
        await invitationCodeService.useCode(codigo);
      } catch (error) {
        this.logger.warn('Registro Aprendiz denegado — invitación no válida', {
          cedula,
          reason: error?.message,
        });
        throw new ValidationError(REGISTER_APRENDIZ_DENIED_MESSAGE);
      }
      this.logger.info('Registro Aprendiz autorizado por código de invitación', { cedula });
      return { path: 'invitation', rosterRow: null };
    }

    // Camino institucional: cédula en roster Aprendices (import Excel).
    const rosterRow = await this.findAprendizInRoster(cedula);
    if (!rosterRow) {
      this.logger.warn('Registro Aprendiz denegado — sin invitación ni roster', { cedula });
      throw new ValidationError(REGISTER_APRENDIZ_DENIED_MESSAGE);
    }

    this.logger.info(APRENDIZ_ROSTER_PATH_NOTE, {
      cedula,
      id_aprendiz: rosterRow.id_aprendiz,
      ficha: rosterRow.ficha || null,
    });
    return { path: 'roster', rosterRow };
  }

  /**
   * Registra un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} Resultado del registro
   */
  async registerUser(userData) {
    const { nombre, cedula, tipo_documento, tipo_documento_otro, correo, telefono, contrasena, rol, codigo_invitacion } = userData;

    // Validar datos usando estrategias
    this.validateUserData({ correo, contrasena, cedula });

    // Aprendiz: invitación válida O cédula en roster Aprendices (MDL-202 / H-03).
    // Instructor / Administrador / Cuentadante: invitación requerida (sin cambio).
    if (rol === 'Aprendiz') {
      await this.enforceAprendizRegistrationGate(userData);
    } else if (rol === 'Instructor' || rol === 'Administrador' || rol === 'Cuentadante') {
      if (!codigo_invitacion) {
        throw new ValidationError(`El código de invitación es requerido para registrarse como ${rol}`);
      }

      const { ServiceFactory } = await import('../factories/ServiceFactory.js');
      const invitationCodeService = ServiceFactory.create('invitationCodeService');

      await invitationCodeService.validateCode(codigo_invitacion, rol);
      await invitationCodeService.useCode(codigo_invitacion);
    }

    // Validar si el usuario ya existe (solo activos).
    // Para Aprendiz usamos el mismo mensaje/status genérico que el gate
    // (no distinguir Usuarios vs Aprendices — H-05).
    const usuarioExistente = await this.userRepository.findByCedulaOrEmail(cedula, correo);
    if (usuarioExistente) {
      this.logger.warn('Intento de registro con usuario existente', { 
        cedula, 
        correo, 
        id_usuario_existente: usuarioExistente.id_usuario,
        rol,
      });
      if (rol === 'Aprendiz') {
        throw new ValidationError(REGISTER_APRENDIZ_DENIED_MESSAGE);
      }
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
      .withTipoDocumento(tipo_documento || 'CC')
      .withTipoDocumentoOtro(tipo_documento === 'Otro' ? tipo_documento_otro : null)
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
      // (Aprendiz: mensaje genérico para no enumerar — H-05 / MDL-202).
      if (error.message.includes('ya está registrado') || error.message.includes('duplicado')) {
        if (rol === 'Aprendiz') {
          throw new ValidationError(REGISTER_APRENDIZ_DENIED_MESSAGE);
        }
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

    // MDL-202 / H-03: cuenta Aprendiz solo operable si está vinculada al roster.
    // Fail-closed: misma respuesta que credenciales inválidas (no enumerar roster).
    if (usuario.nombre_rol === 'Aprendiz') {
      const rosterRow = await this.findAprendizInRoster(usuario.cedula || cedula);
      if (!rosterRow) {
        this.logger.warn('Login Aprendiz denegado — sin vínculo a roster Aprendices', {
          cedula,
          id_usuario: usuario.id_usuario,
        });
        throw new AuthenticationError('Credenciales inválidas');
      }
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
      user: toPublicUser({
        id_usuario: usuario.id_usuario,
        nombre_usuario: usuario.nombre_usuario,
        correo: usuario.correo,
        telefono: usuario.telefono,
        cedula: usuario.cedula,
        nombre_rol: usuario.nombre_rol,
      }),
    };
  }

  /**
   * Autentica un usuario con validación de placa del equipo (para app de escritorio)
   * @param {string} cedula - Cédula del usuario
   * @param {string} contrasena - Contraseña del usuario
   * @param {string} placa - Placa del equipo donde se está intentando iniciar sesión
   * @returns {Promise<Object>} Token y datos del usuario
   */
  async loginUserWithPlaca(cedula, contrasena, placa) {
    const usuario = await this.userRepository.findByCedula(cedula);

    if (!usuario) {
      this.logger.warn('Intento de login con placa fallido - Usuario no encontrado', { cedula, placa });
      throw new AuthenticationError('Credenciales inválidas');
    }

    const valid = await this.passwordService.compare(contrasena, usuario.contrasena);
    if (!valid) {
      this.logger.warn('Intento de login con placa fallido - Contraseña incorrecta', { cedula, placa });
      throw new AuthenticationError('Credenciales inválidas');
    }

    // MDL-202 / H-03: Aprendiz no operable sin vínculo a roster Aprendices.
    if (usuario.nombre_rol === 'Aprendiz') {
      const rosterRow = await this.findAprendizInRoster(usuario.cedula || cedula);
      if (!rosterRow) {
        this.logger.warn('Login-placa Aprendiz denegado — sin vínculo a roster Aprendices', {
          cedula,
          placa,
          id_usuario: usuario.id_usuario,
        });
        throw new AuthenticationError('Credenciales inválidas');
      }
    }

    // Validar que el usuario tenga un equipo asignado con la placa proporcionada
    // Usar el repositorio de usuarios para obtener equipos asignados
    const equiposAsignados = await this.userRepository.getAssignedEquipos(usuario.id_usuario);
    
    // Filtrar por placa
    const equipoConPlaca = equiposAsignados.find(eq => eq.placa === placa);

    if (!equipoConPlaca) {
      this.logger.warn('Intento de login con placa fallido - Placa no asignada al usuario', { 
        cedula, 
        placa,
        id_usuario: usuario.id_usuario 
      });
      throw new AuthenticationError('Este equipo no está asignado a su usuario. Por favor, contacte al administrador.');
    }

    // Generar token JWT
    const token = this.jwtService.sign({
      id: usuario.id_usuario,
      rol: usuario.id_rol,
    });

    this.logger.info('Usuario autenticado exitosamente con placa', {
      cedula,
      id: usuario.id_usuario,
      placa,
    });

    return {
      token,
      requiereCambioContrasena: usuario.requiere_cambio_contrasena === 1 || usuario.requiere_cambio_contrasena === true,
      user: toPublicUser({
        id_usuario: usuario.id_usuario,
        nombre_usuario: usuario.nombre_usuario,
        correo: usuario.correo,
        telefono: usuario.telefono,
        cedula: usuario.cedula,
        nombre_rol: usuario.nombre_rol,
      }),
      equipo: {
        codigo_equipo: equipoConPlaca.codigo_equipo,
        placa: equipoConPlaca.placa,
        tipo: equipoConPlaca.tipo,
        modelo: equipoConPlaca.modelo,
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

    return toPublicUser({
      id_usuario: user.id_usuario,
      nombre_usuario: user.nombre_usuario,
      correo: user.correo,
      telefono: user.telefono,
      cedula: user.cedula,
      nombre_rol: user.nombre_rol,
      foto_perfil: user.foto_perfil,
      requiere_cambio_contrasena: user.requiere_cambio_contrasena === 1 || user.requiere_cambio_contrasena === true,
    });
  }

  /**
   * Lista todos los usuarios activos
   * @returns {Promise<Array>} Lista de usuarios
   */
  async listUsers(rol = null) {
    // Defensa en profundidad MDL-230 (findAll ya omite contrasena).
    return toPublicUserList(await this.userRepository.findAll(rol));
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
      user: toPublicUser({
        id_usuario: user.id_usuario,
        nombre_usuario: user.nombre_usuario,
        cedula: user.cedula,
        correo: user.correo,
        telefono: user.telefono,
        nombre_rol: user.nombre_rol,
      }),
      equipos,
    };
  }

  /**
   * Busca un usuario por cédula
   * @param {string} cedula - Cédula del usuario
   * @returns {Promise<Object>} Datos del usuario
   */
  async getUserByCedula(cedula) {
    const documentoNormalizado = typeof cedula === 'string' ? cedula.trim() : cedula;
    const user = await this.userRepository.findByCedula(documentoNormalizado);

    if (user) {
      // MDL-230: findByCedula incluye contrasena para login; nunca devolverla al cliente.
      return toPublicUser(user);
    }

    const db = this.userRepository.db;
    if (db?.execute) {
      const resultadoAprendices = await db.execute(
        `SELECT id_aprendiz, nombre, documento, ficha
         FROM Aprendices
         WHERE TRIM(documento) = ?
         LIMIT 1`,
        [documentoNormalizado]
      );
      const filasAprendices = Array.isArray(resultadoAprendices?.[0]) ? resultadoAprendices[0] : [];
      const [aprendiz] = filasAprendices;

      if (aprendiz) {
        const documentoAprendiz = String(aprendiz.documento).trim();
        return {
          origen: 'aprendiz',
          id_usuario: null,
          id_aprendiz: aprendiz.id_aprendiz,
          nombre: aprendiz.nombre,
          nombre_usuario: aprendiz.nombre,
          documento: documentoAprendiz,
          ficha: aprendiz.ficha || null,
        };
      }
    }

    throw new NotFoundError('Usuario');
  }

  /**
   * Actualiza un usuario (perfil propio o Admin sobre otro).
   *
   * MDL-192 / H-07 fase 1 — gates de identidad en PUT /api/auth/user/:id:
   * - Nadie (incluido Admin) puede cambiar su propia cédula.
   * - Cambio de correo propio exige contraseña actual (mensaje genérico si falla).
   * - Admin que cambia cédula y/o correo de OTRO usuario: motivo obligatorio + log
   *   server-side (actor, target, field, motivo; nunca valor nuevo/viejo de correo/cédula).
   *   Un solo motivo cubre ambos campos si cambian juntos.
   * - Si cedula/correo normalizados no cambian, no se aplica ningún gate (Perfil
   *   siempre reenvía ambos campos).
   *
   * @param {number} userId - ID del usuario a actualizar
   * @param {Object} userData - Datos a actualizar
   * @param {{ id?: number, rol?: string }} [actor] - Quién ejecuta la petición
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateUser(userId, userData, actor = {}) {
    const IDENTITY_REJECT_MESSAGE = 'No se pudo completar la operación.';

    // Extraer y borrar de inmediato para que nunca llegue a UserRepository.update,
    // respuestas ni meta de logs (MDL-192 / H-07).
    const contrasena_actual = userData?.contrasena_actual;
    if (userData && Object.prototype.hasOwnProperty.call(userData, 'contrasena_actual')) {
      delete userData.contrasena_actual;
    }

    const { nombre, cedula, correo, telefono, rol, motivo } = userData || {};

    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new NotFoundError('Usuario');
    }

    const actorId = actor?.id;
    const isSelf = actorId != null && Number(actorId) === Number(userId);

    const storedCedula = normalizeCedula(existing.cedula);
    const storedCorreo = normalizeCorreo(existing.correo);
    const incomingCedula = cedula !== undefined && cedula !== null ? normalizeCedula(cedula) : null;
    const incomingCorreo = correo !== undefined && correo !== null ? normalizeCorreo(correo) : null;

    const cedulaChanging = incomingCedula !== null
      && incomingCedula !== ''
      && incomingCedula !== storedCedula;
    const correoChanging = incomingCorreo !== null
      && incomingCorreo !== ''
      && incomingCorreo !== storedCorreo;

    // Guard explícito: requireOwnership deja pasar al Admin sobre sí mismo;
    // requireAdminForRoleChange solo mira `rol`. Nadie cambia su propia cédula.
    if (cedulaChanging && isSelf) {
      throw new ValidationError(IDENTITY_REJECT_MESSAGE);
    }

    // Admin sobre otro usuario: motivo obligatorio al cambiar cédula y/o correo.
    if ((cedulaChanging || correoChanging) && !isSelf) {
      const motivoNormalizado = motivo == null ? '' : String(motivo).trim();
      if (!motivoNormalizado || motivoNormalizado.length > 500) {
        throw new ValidationError(IDENTITY_REJECT_MESSAGE);
      }
      const logBase = {
        targetUserId: Number(userId),
        adminId: actorId != null ? Number(actorId) : null,
        motivo: motivoNormalizado,
      };
      if (cedulaChanging) {
        this.logger.info('Cambio de identidad (cédula) por administrador', {
          ...logBase,
          field: 'cedula',
        });
      }
      if (correoChanging) {
        this.logger.info('Cambio de identidad (correo) por administrador', {
          ...logBase,
          field: 'correo',
        });
      }
    }

    if (correoChanging && isSelf) {
      const passwordProvided = contrasena_actual != null && String(contrasena_actual).length > 0;
      if (!passwordProvided) {
        throw new ValidationError(IDENTITY_REJECT_MESSAGE);
      }
      const credenciales = await this.userRepository.findOne(
        'SELECT contrasena FROM Usuarios WHERE id_usuario = ? AND estado = "Activo"',
        [userId]
      );
      if (!credenciales?.contrasena) {
        throw new ValidationError(IDENTITY_REJECT_MESSAGE);
      }
      const passwordOk = await this.passwordService.compare(
        String(contrasena_actual),
        credenciales.contrasena
      );
      if (!passwordOk) {
        throw new ValidationError(IDENTITY_REJECT_MESSAGE);
      }
    }

    // Buscar id_rol si se proporciona
    let idRol = null;
    if (rol) {
      const rolRow = await this.roleRepository.findByName(rol);
      if (!rolRow) {
        throw new ValidationError('Rol inválido');
      }
      idRol = rolRow.id_rol;
    }

    // Preparar datos de actualización (nunca incluye contrasena_actual)
    const updateData = {};
    if (nombre) updateData.nombre = nombre;
    if (cedulaChanging) {
      updateData.cedula = incomingCedula;
    }
    if (correoChanging) {
      const emailResult = this.emailValidator.validate(incomingCorreo);
      if (!emailResult.valid) {
        throw new ValidationError(emailResult.error);
      }
      updateData.correo = incomingCorreo;
    }
    if (telefono) updateData.telefono = telefono;
    if (idRol) updateData.idRol = idRol;

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No hay campos para actualizar');
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'contrasena_actual')
      || Object.prototype.hasOwnProperty.call(updateData, 'contrasena')) {
      throw new ValidationError(IDENTITY_REJECT_MESSAGE);
    }

    const result = await this.userRepository.update(userId, updateData);

    if (result.affectedRows === 0) {
      throw new NotFoundError('Usuario');
    }

    this.logger.info('Usuario actualizado', { userId });
    return { message: 'Usuario actualizado correctamente' };
  }

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
      user: toPublicUser(updatedUser),
      foto_perfil: fotoPerfilPath
    };
  }

  /**
   * Elimina un usuario.
   *
   * Antes de intentar el borrado se comprueban las dependencias que la base de datos
   * bloquearía por clave foránea. Así el usuario recibe el motivo concreto
   * ("tiene 3 equipos registrados y 2 clases asignadas") en lugar de un error de
   * servidor provocado por la restricción de integridad.
   *
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async deleteUser(userId) {
    const dependencias = await this.userRepository.getBlockingDependencies(userId);

    if (dependencias.length > 0) {
      const detalle = dependencias
        .map(({ cantidad, etiqueta, etiquetaPlural }) =>
          `${cantidad} ${cantidad === 1 ? etiqueta : etiquetaPlural}`)
        .join(', ');

      throw new ConflictError(
        `No se puede eliminar este usuario porque tiene ${detalle} en el sistema. ` +
        `Reasigna o elimina esos registros antes de continuar.`
      );
    }

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
    const GENERIC_MESSAGE = {
      message: 'Si el usuario existe, se enviará un correo con las instrucciones',
    };

    // Normalización mínima (trim / lowercase). Shared normalizeIdentity → PR #44.
    const cedulaNormalizada = String(cedula ?? '').trim();
    const correoNormalizado = String(correo ?? '').trim().toLowerCase();

    // Una sola búsqueda; no hay lookup diagnóstico por cédula (anti-PII / MDL-231).
    const usuario = await this.userRepository.findOne(
      'SELECT id_usuario, nombre_usuario, correo FROM Usuarios WHERE cedula = ? AND LOWER(TRIM(correo)) = ? AND estado = "Activo"',
      [cedulaNormalizada, correoNormalizado]
    );

    if (!usuario) {
      // Misma respuesta que el camino exitoso; sin flag de existencia ni PII.
      this.logger.info('Solicitud de recuperación de contraseña procesada', {
        outcome: 'noop',
      });
      return GENERIC_MESSAGE;
    }

    // Invalidar tokens previos activos del usuario (MDL-232 / R42-05).
    await this.userRepository.db.execute(
      `UPDATE Tokens_Recuperacion_Contrasena
       SET usado = 1, fecha_uso = NOW()
       WHERE id_usuario = ? AND usado = 0`,
      [usuario.id_usuario]
    );

    // Generar token único. El token en claro (rawToken) viaja al usuario por
    // correo; en la BD solo se persiste su hash SHA-256 (H-09).
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const fechaExpiracion = new Date();
    fechaExpiracion.setTime(
      fechaExpiracion.getTime() + PASSWORD_RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000
    ); // Expira en ≤ 1 hora (MDL-232)

    // Guardar SOLO el hash del token en la base de datos
    await this.userRepository.db.execute(
      `INSERT INTO Tokens_Recuperacion_Contrasena (id_usuario, token, fecha_expiracion)
       VALUES (?, ?, ?)`,
      [usuario.id_usuario, tokenHash, fechaExpiracion]
    );

    // Token en fragmento (#token=) para no filtrarlo en Referer/logs de query (MDL-232).
    const frontendBase = (process.env.FRONTEND_URL || 'https://sgi-sena.up.railway.app/').replace(/\/?$/, '/');
    const urlRecuperacion = `${frontendBase}restablecer-contrasena#token=${rawToken}`;

    // MDL-231: no await del mailer en el path HTTP — misma latencia exista o no.
    // Errores se capturan en background; logs solo userId/outcome (sin correo/token).
    this.enqueuePasswordRecoveryEmail({
      userId: usuario.id_usuario,
      correo: usuario.correo,
      nombreUsuario: usuario.nombre_usuario,
      urlRecuperacion,
    });

    return GENERIC_MESSAGE;
  }

  /**
   * Programa el envío de correo fuera del request path (setImmediate por defecto).
   * `this.scheduleAsync` es inyectable en tests para evitar handles abiertos.
   */
  enqueuePasswordRecoveryEmail(payload) {
    const schedule = typeof this.scheduleAsync === 'function' ? this.scheduleAsync : setImmediate;
    // Defensa en profundidad: aunque sendPasswordRecoveryEmail ya tiene try/catch,
    // un throw en el logger del catch no debe producir unhandledRejection.
    // setImmediate ignora el retorno; el .catch queda enganchado a la cadena.
    schedule(() => Promise.resolve()
      .then(() => this.sendPasswordRecoveryEmail(payload))
      .catch((err) => {
        try {
          this.logger.error('Fallo inesperado en envío de correo de recuperación', {
            userId: payload.userId,
            outcome: 'email_unhandled',
            error: err?.code || err?.name,
          });
        } catch {
          // Último recurso: nunca propagar (ni mensaje ni PII).
        }
      }));
  }

  async sendPasswordRecoveryEmail({ userId, correo, nombreUsuario, urlRecuperacion }) {
    try {
      const emailService = (await import('./emailService.js')).default;

      const apiKey = process.env.BREVO_API_KEY;
      if (!emailService.apiInstance && apiKey) {
        this.logger.info('Reinicializando servicio de email API');
        emailService.reinitialize();
      }

      const resultadoCorreo = await emailService.enviarCorreoRecuperacion(
        correo,
        nombreUsuario,
        urlRecuperacion,
      );

      if (!resultadoCorreo?.success) {
        this.logger.warn('Error al enviar correo de recuperación', {
          userId,
          outcome: 'email_failed',
        });
        return;
      }

      this.logger.info('Solicitud de recuperación de contraseña procesada', {
        userId,
        outcome: 'email_queued',
      });
    } catch (err) {
      this.logger.warn('Error al enviar correo de recuperación', {
        userId,
        outcome: 'email_error',
        // Solo name/code — el message podría incluir correo o token.
        error: err?.code || err?.name,
      });
    }
  }

  async validarTokenRecuperacion(token) {
    // Se busca por el hash del token; en la BD nunca está el token en claro (H-09).
    const tokenData = await this.userRepository.findOne(
      `SELECT t.id_token, t.id_usuario, t.token, t.fecha_creacion, t.fecha_expiracion, t.usado, t.fecha_uso,
              u.nombre_usuario, u.correo
       FROM Tokens_Recuperacion_Contrasena t
       INNER JOIN Usuarios u ON u.id_usuario = t.id_usuario
       WHERE t.token = ? AND t.usado = 0 AND t.fecha_expiracion > NOW()`,
      [hashResetToken(token)]
    );

    if (!tokenData) {
      throw new AuthenticationError('Token inválido o expirado');
    }

    return {
      // No devolvemos el token: el cliente ya lo tiene. Correo enmascarado (MDL-232).
      nombre_usuario: tokenData.nombre_usuario,
      correo: maskEmail(tokenData.correo),
    };
  }

  /**
   * Restablece la contraseña usando un token de recuperación
   * @param {string} token - Token de recuperación
   * @param {string} nuevaContrasena - Nueva contraseña
   * @returns {Promise<Object>} Resultado del restablecimiento
   */
  async restablecerContrasena(token, nuevaContrasena) {
    // Validar política ANTES de consumir el token (no quemar token por password débil).
    // Claim atómico por hash más abajo (H-09 / MDL-232); no SELECT previo que compita con la carrera.
    const passwordResult = this.passwordValidator.validate(nuevaContrasena);
    if (!passwordResult.valid) {
      throw new ValidationError(passwordResult.error);
    }

    const tokenHash = hashResetToken(token);
    const nuevaContrasenaHash = await this.passwordService.hash(nuevaContrasena);

    // Carrera atómica (MDL-232): claim del token con UPDATE ... AND usado = 0.
    // Solo affectedRows === 1 puede cambiar la contraseña.
    const connection = await this.userRepository.db.pool.getConnection();
    let userId;
    try {
      await connection.beginTransaction();

      const [claimResult] = await connection.execute(
        `UPDATE Tokens_Recuperacion_Contrasena
         SET usado = 1, fecha_uso = NOW()
         WHERE token = ? AND usado = 0 AND fecha_expiracion > NOW()`,
        [tokenHash]
      );

      if (!claimResult || claimResult.affectedRows !== 1) {
        await connection.rollback();
        // 400 genérico: no distinguir expirado / ya usado / carrera (MDL-232).
        throw new ValidationError('Token inválido o expirado');
      }

      const [tokenRows] = await connection.execute(
        `SELECT id_usuario FROM Tokens_Recuperacion_Contrasena WHERE token = ? LIMIT 1`,
        [tokenHash]
      );
      userId = tokenRows?.[0]?.id_usuario;
      if (!userId) {
        await connection.rollback();
        throw new ValidationError('Token inválido o expirado');
      }

      await connection.execute(
        'UPDATE Usuarios SET contrasena = ?, requiere_cambio_contrasena = 0 WHERE id_usuario = ?',
        [nuevaContrasenaHash, userId]
      );

      // Invalidar demás tokens activos del usuario (R42-04).
      await connection.execute(
        `UPDATE Tokens_Recuperacion_Contrasena
         SET usado = 1, fecha_uso = NOW()
         WHERE id_usuario = ? AND usado = 0 AND token <> ?`,
        [userId, tokenHash]
      );

      await connection.commit();
    } catch (error) {
      // Si ya hicimos rollback por claim fallido, evitar segundo rollback ruidoso.
      try {
        await connection.rollback();
      } catch {
        // ignore
      }
      throw error;
    } finally {
      connection.release();
    }

    this.logger.info('Contraseña restablecida exitosamente', {
      userId,
    });

    return { message: 'Contraseña restablecida correctamente' };
  }
}
