import { logger } from './logger.js';

export const handleControllerError = (err, res, context, defaultMessage) => {
  logger.error(`Error en ${context}`, { 
    error: err.message, 
    stack: err.stack 
  });
  
  return res.status(500).json({ 
    error: defaultMessage || 'Error en el servidor', 
    detalle: err.message 
  });
};

export const sendErrorResponse = (res, statusCode, message, details = null) => {
  const response = { error: message };
  if (details) {
    response.detalle = details;
  }
  return res.status(statusCode).json(response);
};

export const sendSuccessResponse = (res, statusCode, data, message = null) => {
  const response = { ...data };
  if (message) {
    response.message = message;
  }
  return res.status(statusCode).json(response);
};

