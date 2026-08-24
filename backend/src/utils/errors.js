/**
 * Clases de error personalizadas para el manejo de errores en la aplicación
 */
import { logger } from './logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400);
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'No tienes permisos para realizar esta acción') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(`${resource} no encontrado`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflicto con el estado actual del recurso') {
    super(message, 409);
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Error en la base de datos', originalError = null) {
    super(message, 500);
    this.originalError = originalError;
  }
}

/**
 * Nombres de tabla → entidad en lenguaje del usuario.
 * Se usa para explicar por qué una restricción de integridad impide una operación,
 * en vez de mostrar el mensaje crudo de MySQL.
 */
const ENTIDADES_POR_TABLA = {
  Usuarios: 'usuarios',
  Aprendices: 'aprendices',
  Roles: 'roles',
  Rol_Permisos: 'permisos de rol',
  Ambientes: 'ambientes',
  Imagenes_Ambiente: 'imágenes de ambiente',
  Categorias_Equipo: 'categorías de equipo',
  Elementos: 'equipos',
  Imagenes_Equipo: 'imágenes de equipo',
  Componentes_Asociados: 'componentes asociados',
  Estado_Equipo: 'estados de equipo',
  Responsables_Equipo: 'habilitaciones de equipo',
  Clases: 'clases',
  Participantes_Clase: 'participantes de clase',
  Responsabilidades_Ambiente: 'responsabilidades de ambiente',
  Mantenimiento: 'mantenimientos',
  Novedades: 'novedades',
  Reportes: 'reportes',
  Historial_Equipos: 'movimientos de equipo',
  Solicitudes_Autorizacion_Movimiento: 'solicitudes de autorización',
  Auditoria: 'registros de auditoría',
  Auditoria_Clases: 'auditoría de clases',
  Invitation_Codes: 'códigos de invitación',
  Preferencias_Usuario: 'preferencias de usuario',
  Verificaciones_Inventario: 'verificaciones de inventario',
  Historial_Uso_Equipos: 'historial de uso',
  Nombres_Clases: 'nombres de clase',
  Notificaciones: 'notificaciones',
};

const nombreEntidad = (tabla) => {
  if (!tabla) return null;
  const clave = Object.keys(ENTIDADES_POR_TABLA)
    .find((t) => t.toLowerCase() === tabla.toLowerCase());
  return clave ? ENTIDADES_POR_TABLA[clave] : null;
};

/**
 * Un mensaje de clave foránea de MySQL nombra DOS tablas:
 *
 *   ...fails (`bd`.`Clases`, CONSTRAINT `fk` FOREIGN KEY (`id_instructor`)
 *             ^^^^^^^^ tabla hija          REFERENCES `Usuarios` (`id_usuario`))
 *                                                      ^^^^^^^^ tabla padre
 *
 * Cuál importa depende del error: si no se puede borrar, el usuario necesita saber
 * qué registros HIJOS lo impiden; si no se puede insertar, cuál es el registro
 * PADRE que falta. Tomar la tabla equivocada produce un mensaje engañoso.
 */
const tablaHijaDesdeMensaje = (mensaje = '') => {
  const match = mensaje.match(/\(\s*`[^`]+`\.`([^`]+)`/);
  return match ? match[1] : null;
};

const tablaPadreDesdeMensaje = (mensaje = '') => {
  const match = mensaje.match(/REFERENCES\s+`([^`]+)`/i);
  return match ? match[1] : null;
};

/** Último recurso: buscar cualquier tabla conocida mencionada en el texto. */
const tablaMencionada = (mensaje = '') => Object.keys(ENTIDADES_POR_TABLA)
  .find((tabla) => new RegExp(`\`${tabla}\`|\\b${tabla}\\b`, 'i').test(mensaje)) || null;

/**
 * Extrae el nombre de columna de mensajes del tipo:
 *   Data too long for column 'nombre_usuario' at row 1
 *   Column 'correo' cannot be null
 */
const columnaDesdeMensaje = (mensaje = '') => {
  const match = mensaje.match(/column '([^']+)'/i);
  return match ? match[1] : null;
};

/**
 * Traduce un error de base de datos (o de red hacia ella) a un error de dominio
 * con el código HTTP correcto y un mensaje entendible por el usuario final.
 *
 * Devuelve el error original cuando no reconoce el código: así los fallos
 * genuinamente inesperados siguen siendo 500.
 *
 * @param {Error & {code?: string, sqlMessage?: string}} err
 * @returns {Error} error de dominio (AppError) o el error original
 */
export const translateDbError = (err) => {
  if (!err || !err.code) return err;

  const mensajeSql = err.sqlMessage || err.message || '';
  const columna = columnaDesdeMensaje(mensajeSql);

  // Registros hijos que impiden borrar; padre que falta al insertar
  const entidadHija = nombreEntidad(tablaHijaDesdeMensaje(mensajeSql) || tablaMencionada(mensajeSql));
  const entidadPadre = nombreEntidad(tablaPadreDesdeMensaje(mensajeSql))
    || nombreEntidad(tablaHijaDesdeMensaje(mensajeSql))
    || nombreEntidad(tablaMencionada(mensajeSql));

  switch (err.code) {
    // La fila está referenciada por otras: no se puede eliminar ni cambiar su clave
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return new ConflictError(
        entidadHija
          ? `No se puede completar la operación porque este registro tiene ${entidadHija} asociados. Elimina o reasigna esos ${entidadHija} primero.`
          : 'No se puede completar la operación porque este registro está siendo usado por otros datos del sistema.'
      );

    // Se referencia una fila que no existe
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return new ValidationError(
        entidadPadre
          ? `El registro de ${entidadPadre} seleccionado ya no existe. Actualiza la página e inténtalo de nuevo.`
          : 'Uno de los datos seleccionados ya no existe. Actualiza la página e inténtalo de nuevo.'
      );

    case 'ER_DUP_ENTRY':
      return new ConflictError(
        entidadHija
          ? `Ya existe un registro de ${entidadHija} con esos datos.`
          : 'Ya existe un registro con esos datos.'
      );

    case 'ER_DATA_TOO_LONG':
      return new ValidationError(
        columna
          ? `El valor del campo "${columna}" es demasiado largo.`
          : 'Uno de los valores ingresados es demasiado largo.'
      );

    case 'ER_BAD_NULL_ERROR':
      return new ValidationError(
        columna
          ? `El campo "${columna}" es obligatorio.`
          : 'Falta completar un campo obligatorio.'
      );

    case 'WARN_DATA_TRUNCATED':
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
      return new ValidationError(
        columna
          ? `El valor del campo "${columna}" no tiene un formato válido.`
          : 'Uno de los valores ingresados no tiene un formato válido.'
      );

    // Base de datos ocupada o no disponible: es temporal, conviene reintentar
    case 'ER_LOCK_WAIT_TIMEOUT':
    case 'ER_LOCK_DEADLOCK':
      return new AppError(
        'El sistema está procesando otra operación sobre estos datos. Espera unos segundos e inténtalo de nuevo.',
        503
      );

    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ETIMEDOUT':
    case 'ER_CON_COUNT_ERROR':
      return new AppError(
        'No hay conexión con la base de datos en este momento. Inténtalo de nuevo en unos segundos.',
        503
      );

    default:
      return err;
  }
};

/**
 * Middleware para manejar errores de forma centralizada
 */
export const errorHandler = (err, req, res, _next) => {
  // Log del error técnico completo (solo servidor, nunca al cliente)
  logger.error('Error capturado por errorHandler', {
    error: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code
  });

  let error = err;

  // Error de validación de Zod
  if (err.name === 'ZodError') {
    const message = 'Error de validación';
    const details = err.errors && Array.isArray(err.errors)
      ? err.errors.map((e) => ({
          path: e.path && Array.isArray(e.path) ? e.path.join('.') : 'unknown',
          message: e.message || 'Error de validación',
        }))
      : [{ path: 'unknown', message: 'Error de validación desconocido' }];
    error = new ValidationError(message, details);
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    error = new AuthenticationError('Token inválido');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AuthenticationError('Token expirado');
  }

  // Errores de base de datos: se traducen a errores de dominio con mensaje para el usuario
  if (!(error instanceof AppError)) {
    error = translateDbError(error);
  }

  const statusCode = error.statusCode || 500;

  // userMessage: texto apto para mostrar tal cual en la interfaz. Solo se envía
  // cuando proviene de un error de dominio controlado; nunca para un 500 genérico,
  // donde el mensaje podría contener detalles técnicos.
  const userMessage = error instanceof AppError && error.isOperational
    ? error.message
    : undefined;

  res.status(statusCode).json({
    success: false,
    error: error.message || 'Error en el servidor',
    ...(userMessage && { userMessage }),
    ...(error.details && { details: error.details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

