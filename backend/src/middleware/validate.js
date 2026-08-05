import { z } from 'zod';

/**
 * Middleware de validación de Zod para el body del request.
 * Centraliza un patrón que antes estaba duplicado casi idéntico en cada
 * archivo de validators/* (authValidator, clasesValidator, equiposValidator,
 * mantenimientoValidator, novedadesValidator, reportesValidator).
 *
 * @param {Object} [options]
 * @param {(body: Object) => Object} [options.preprocessBody] - Transforma el
 *   body antes de validar (ej. normalizar nombres de campo alternativos).
 *   Solo reportesValidator lo necesita hoy.
 * @param {string} [options.fallbackIssueMessage] - Mensaje a usar cuando un
 *   issue de Zod no trae su propio `message`.
 * @returns {(schema: import('zod').ZodSchema) => import('express').RequestHandler}
 */
export const createValidator = ({ preprocessBody, fallbackIssueMessage = 'Error de validación' } = {}) => (schema) => (req, res, next) => {
  try {
    const body = preprocessBody ? preprocessBody(req.body) : req.body;
    const validated = schema.parse(body);
    req.body = validated;
    next();
  } catch (error) {
    if (error instanceof z.ZodError && error.issues && Array.isArray(error.issues)) {
      const details = error.issues.map((e) => ({
        path: e.path && Array.isArray(e.path) ? e.path.join('.') : 'unknown',
        message: e.message || fallbackIssueMessage,
        code: e.code || 'invalid_type',
      }));

      return res.status(400).json({
        success: false,
        error: 'Error de validación',
        details: details.length > 0 ? details : [{ path: 'unknown', message: 'Error de validación desconocido' }],
      });
    }
    // Si no es un ZodError, loguear y pasar al middleware global de errores
    console.error('Validation middleware error:', error);
    next(error);
  }
};

/** Middleware de validación estándar, sin preprocesamiento de body. */
export const validate = createValidator();
