import { logger } from './logger.js';
import { AppError, translateDbError } from './errors.js';
import { buildClientErrorBody } from './errorScrubber.js';

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

  // Error de dominio conocido: scrubber elige clientMessage / mensaje seguro / genérico
  if (error instanceof AppError && error.isOperational) {
    const { statusCode, body } = buildClientErrorBody(error, {
      defaultMessage,
      includeSuccess: false,
      includeUserMessage: true,
    });
    return res.status(statusCode).json({
      error: body.error,
      userMessage: body.userMessage,
      ...(body.details !== undefined && { details: body.details }),
    });
  }

  // Error inesperado: no se expone el mensaje técnico
  return res.status(500).json({
    error: defaultMessage || 'No se pudo completar la operación. Inténtalo de nuevo.',
    userMessage: defaultMessage || 'No se pudo completar la operación. Inténtalo de nuevo.',
  });
};
