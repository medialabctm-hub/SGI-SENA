import { ServiceFactory } from '../factories/ServiceFactory.js';
import { logger } from '../utils/logger.js';

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
 * Login de usuario
 */
export const loginUser = async (req, res, next) => {
  try {
    const { cedula, contrasena } = req.body;
    const authService = ServiceFactory.create('authService');
    const result = await authService.loginUser(cedula, contrasena);
    return res.json(result);
  } catch (error) {
    logger.error('Error en loginUser', { error: error.message });
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
 */
export const listUsers = async (req, res, next) => {
  try {
    const authService = ServiceFactory.create('authService');
    const users = await authService.listUsers();
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
