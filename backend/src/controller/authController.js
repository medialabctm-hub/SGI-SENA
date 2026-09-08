import { ServiceFactory } from '../factories/ServiceFactory.js';
import { logger } from '../utils/logger.js';
import defaultDb from '../config/dbconfig.js';
import { SESSION_COOKIE_NAME, buildSessionCookieOptions } from '../utils/sessionCookie.js';

/**
 * Controlador de autenticación - Solo orquestación, sin lógica de negocio
 * 
 * Patrón: Controller Pattern
 * Principio: Single Responsibility Principle (SRP)
 * 
 * Los controladores solo se encargan de:
 * - Recibir requests HTTP
 * - Extraer datos del request
 * - Llamar a los servicios apropiados
 * - Formatear y enviar respuestas HTTP
 */

/**
 * Listar nombres de roles (público, para formulario de registro).
 * Devuelve solo roles activos ordenados por nombre_rol.
 */
export const listRolesPublic = async (req, res, next) => {
  try {
    const [rows] = await defaultDb.execute(
      "SELECT nombre_rol FROM Roles WHERE estado = 'Activo' ORDER BY nombre_rol"
    );
    const roles = rows.map((r) => ({ nombre_rol: r.nombre_rol }));
    return res.json({ roles });
  } catch (error) {
    logger.error('Error en listRolesPublic', { error: error.message });
    return next(error);
  }
};

/**
 * Registro de usuario
 */
export const registerUser = async (req, res, next) => {
  try {
    const authService = ServiceFactory.create('authService');
    const result = await authService.registerUser(req.body);
    return res.status(201).json(result);
  } catch (error) {
    logger.error('Error en registerUser', { error: error.message });
    return next(error);
  }
};

/**
 * Login de usuario (flujo web).
 * El JWT nunca se expone en el cuerpo de la respuesta: se transporta
 * exclusivamente en una cookie httpOnly, para que el navegador no pueda
 * persistirlo en localStorage/sessionStorage.
 */
export const loginUser = async (req, res, next) => {
  try {
    const { cedula, contrasena } = req.body;
    const authService = ServiceFactory.create('authService');
    const { token, ...sessionResponse } = await authService.loginUser(cedula, contrasena);
    res.cookie(SESSION_COOKIE_NAME, token, buildSessionCookieOptions());
    return res.json(sessionResponse);
  } catch (error) {
    logger.error('Error en loginUser', { error: error.message });
    return next(error);
  }
};

/**
 * Cierra la sesión revocando la cookie httpOnly.
 * Idempotente y público: debe funcionar incluso si el JWT ya expiró.
 */
export const logoutUser = async (req, res, next) => {
  try {
    res.clearCookie(SESSION_COOKIE_NAME, buildSessionCookieOptions());
    return res.json({ message: 'Sesión cerrada correctamente' });
  } catch (error) {
    logger.error('Error en logoutUser', { error: error.message });
    return next(error);
  }
};

/**
 * Login de usuario con validación de placa (para app de escritorio).
 * No forma parte del flujo web/navegador de MDL-127: sigue devolviendo el
 * token en el cuerpo porque el cliente de escritorio no es un navegador y no
 * gestiona cookies httpOnly.
 */
export const loginUserWithPlaca = async (req, res, next) => {
  try {
    const { cedula, contrasena, placa } = req.body;
    
    if (!cedula || !contrasena || !placa) {
      return res.status(400).json({ 
        error: 'Faltan campos obligatorios: cedula, contrasena, placa' 
      });
    }

    const authService = ServiceFactory.create('authService');
    const result = await authService.loginUserWithPlaca(cedula, contrasena, placa);
    return res.json(result);
  } catch (error) {
    logger.error('Error en loginUserWithPlaca', { error: error.message });
    return next(error);
  }
};

/**
 * Obtener perfil del usuario autenticado
 */
export const me = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const authService = ServiceFactory.create('authService');
    const user = await authService.getCurrentUser(req.user.id);
    return res.json({ user });
  } catch (error) {
    logger.error('Error en me', { error: error.message });
    return next(error);
  }
};

/**
 * Listar usuarios activos
 * Query params: rol (opcional) - Filtrar por nombre de rol
 */
export const listUsers = async (req, res, next) => {
  try {
    const authService = ServiceFactory.create('authService');
    const rol = req.query.rol || null;
    const users = await authService.listUsers(rol);
    return res.json(users);
  } catch (error) {
    logger.error('Error en listUsers', { error: error.message });
    return next(error);
  }
};

/**
 * Obtener detalles de un usuario
 */
export const getUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const authService = ServiceFactory.create('authService');
    const result = await authService.getUserDetails(id);
    return res.json(result);
  } catch (error) {
    logger.error('Error en getUserDetails', { error: error.message });
    return next(error);
  }
};

/**
 * Buscar usuario por cédula
 */
export const getUserByCedula = async (req, res, next) => {
  try {
    const { cedula } = req.params;
    const authService = ServiceFactory.create('authService');
    const user = await authService.getUserByCedula(cedula);
    return res.json(user);
  } catch (error) {
    logger.error('Error en getUserByCedula', { error: error.message });
    return next(error);
  }
};

/**
 * Actualizar usuario
 */
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const authService = ServiceFactory.create('authService');
    const result = await authService.updateUser(id, req.body);
    return res.json(result);
  } catch (error) {
    logger.error('Error en updateUser', { error: error.message });
    return next(error);
  }
};

/**
 * Eliminar usuario (borrado lógico)
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const authService = ServiceFactory.create('authService');
    const result = await authService.deleteUser(id);
    return res.json(result);
  } catch (error) {
    logger.error('Error en deleteUser', { error: error.message });
    return next(error);
  }
};

/**
 * Cambiar contraseña obligatorio (cuando requiere_cambio_contrasena es true)
 */
export const cambiarContrasenaObligatorio = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { contrasenaActual, nuevaContrasena } = req.body;
    const authService = ServiceFactory.create('authService');
    const result = await authService.cambiarContrasenaObligatorio(
      req.user.id,
      contrasenaActual,
      nuevaContrasena
    );
    return res.json(result);
  } catch (error) {
    logger.error('Error en cambiarContrasenaObligatorio', { error: error.message });
    return next(error);
  }
};

/**
 * Solicitar recuperación de contraseña
 */
export const solicitarRecuperacionContrasena = async (req, res, next) => {
  try {
    const { cedula, correo } = req.body;
    const authService = ServiceFactory.create('authService');
    const result = await authService.solicitarRecuperacionContrasena(cedula, correo);
    return res.json(result);
  } catch (error) {
    logger.error('Error en solicitarRecuperacionContrasena', { error: error.message });
    return next(error);
  }
};

/**
 * Validar token de recuperación de contraseña
 */
export const validarTokenRecuperacion = async (req, res, next) => {
  try {
    const { token } = req.params;
    const authService = ServiceFactory.create('authService');
    const result = await authService.validarTokenRecuperacion(token);
    return res.json(result);
  } catch (error) {
    logger.error('Error en validarTokenRecuperacion', { error: error.message });
    return next(error);
  }
};

/**
 * Restablecer contraseña con token
 */
export const restablecerContrasena = async (req, res, next) => {
  try {
    const { token, nuevaContrasena } = req.body;
    const authService = ServiceFactory.create('authService');
    const result = await authService.restablecerContrasena(token, nuevaContrasena);
    return res.json(result);
  } catch (error) {
    logger.error('Error en restablecerContrasena', { error: error.message });
    return next(error);
  }
};

/**
 * Subir foto de perfil
 */
export const uploadProfilePhoto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id_usuario || req.user?.id;
    
    // Verificar que el usuario solo puede subir su propia foto
    if (parseInt(id) !== parseInt(userId)) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar este perfil' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    const authService = ServiceFactory.create('authService');
    const { getProfileImagePath } = await import('../middleware/uploadProfileMiddleware.js');
    const fotoPerfilPath = getProfileImagePath(req.file.filename);
    
    const result = await authService.updateUserProfilePhoto(id, fotoPerfilPath);
    return res.json(result);
  } catch (error) {
    logger.error('Error en uploadProfilePhoto', { error: error.message });
    return next(error);
  }
};