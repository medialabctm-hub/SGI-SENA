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
 * Middleware para manejar errores de forma centralizada
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log del error
  logger.error('Error capturado por errorHandler', { 
    error: err.message, 
    stack: err.stack,
    name: err.name,
    code: err.code
  });

  // Error de validación de Zod
  if (err.name === 'ZodError') {
    const message = 'Error de validación';
    const details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    error = new ValidationError(message, details);
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    error = new AuthenticationError('Token inválido');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AuthenticationError('Token expirado');
  }

  // Error de MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    error = new ConflictError('El recurso ya existe');
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Error en el servidor',
    ...(error.details && { details: error.details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

