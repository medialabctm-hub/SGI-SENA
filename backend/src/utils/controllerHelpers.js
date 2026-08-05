import { logger } from './logger.js';
import { AppError, translateDbError } from './errors.js';

/**
 * Respuesta de error uniforme para los catch de los controladores.
 *
 * Traduce los errores de base de datos a errores de dominio (ver translateDbError)
 * para que el usuario reciba el motivo real —"tiene equipos asociados"— en vez de
 * un genérico "error del servidor". El detalle técnico queda solo en los logs.
 *
 * @param {Error} err              Error capturado
 * @param {import('express').Response} res
 * @param {string} context         Nombre de la operación, para el log
 * @param {string} [defaultMessage] Mensaje mostrado cuando el error no es traducible
 */
export const handleControllerError = (err, res, context, defaultMessage) => {
  logger.error(`Error en ${context}`, {
    error: err?.message,
    code: err?.code,
    stack: err?.stack,
  });

  const error = err instanceof AppError ? err : translateDbError(err);

  // Error de dominio conocido: su mensaje está escrito para el usuario
  if (error instanceof AppError && error.isOperational) {
    return res.status(error.statusCode).json({
      error: error.message,
      userMessage: error.message,
      ...(error.details && { details: error.details }),
    });
  }

  // Error inesperado: no se expone el mensaje técnico
  return res.status(500).json({
    error: defaultMessage || 'No se pudo completar la operación. Inténtalo de nuevo.',
    userMessage: defaultMessage || 'No se pudo completar la operación. Inténtalo de nuevo.',
  });
};
