import { ServiceFactory } from '../factories/ServiceFactory.js';
import { AuthenticationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware de autenticación JWT
 * Valida el token y adjunta información completa del usuario al request
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return next(new AuthenticationError('Token no proporcionado'));
    }

    try {
      // Usar JwtService para verificar el token
      const jwtService = ServiceFactory.create('jwtService');
      const payload = jwtService.verify(token);

      // Obtener información completa del usuario desde el repositorio
      const userRepository = ServiceFactory.create('userRepository');
      const user = await userRepository.findById(payload.id);

      if (!user) {
        return next(new AuthenticationError('Usuario no encontrado o inactivo'));
      }

      // Adjuntar información completa al request
      req.user = {
        id: user.id_usuario,
        nombre: user.nombre_usuario,
        cedula: user.cedula,
        correo: user.correo,
        id_rol: user.id_rol,
        rol: user.nombre_rol, // 'Administrador', 'Instructor', 'Aprendiz'
      };

      return next();
    } catch (error) {
      if (error.message === 'Token expirado') {
        return next(new AuthenticationError('Token expirado'));
      }
      if (error.message === 'Token inválido') {
        return next(new AuthenticationError('Token inválido'));
      }
      return next(error);
    }
  } catch (err) {
    logger.error('Error en middleware de autenticación', { error: err.message });
    return next(err);
  }
}

/**
 * Autenticación opcional: si hay token válido adjunta req.user; si no hay o es inválido, continúa sin adjuntar.
 * No responde 401 cuando falta o falla el token.
 */
export async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return next();

    try {
      const jwtService = ServiceFactory.create('jwtService');
      const payload = jwtService.verify(token);
      const userRepository = ServiceFactory.create('userRepository');
      const user = await userRepository.findById(payload.id);
      if (!user) return next();

      req.user = {
        id: user.id_usuario,
        nombre: user.nombre_usuario,
        cedula: user.cedula,
        correo: user.correo,
        id_rol: user.id_rol,
        rol: user.nombre_rol,
      };
    } catch {
      // Token inválido o expirado: no bloquear, seguir sin req.user
    }
    return next();
  } catch (err) {
    logger.error('Error en optionalAuthenticate', { error: err.message });
    return next();
  }
}

export default authenticate