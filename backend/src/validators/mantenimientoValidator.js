import { z } from 'zod';

/**
 * Validadores para las rutas de mantenimiento
 */

export const crearMantenimientoSchema = z.object({
  codigo_equipo: z.union([
    z.string().min(1, 'El código del equipo es requerido'),
    z.number().int().positive('El código del equipo debe ser un número positivo'),
  ]),
  tipo_mantenimiento: z.enum(['Preventivo', 'Correctivo', 'Predictivo'], {
    error: 'Tipo de mantenimiento inv\u00e1lido. Debe ser: Preventivo, Correctivo o Predictivo',
  }),
  descripcion: z.string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(2000, 'La descripción no puede exceder 2000 caracteres'),
  fecha_mantenimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  fecha_proximo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional().nullable(),
  estado_mantenimiento: z.enum(['Programado', 'En Proceso', 'Completado', 'Cancelado']).optional().default('Programado'),
  observaciones: z.string().max(1000).optional().nullable(),
});

export const actualizarEstadoMantenimientoSchema = z.object({
  estado_mantenimiento: z.enum(['Programado', 'En Proceso', 'Completado', 'Cancelado'], {
    error: 'Estado de mantenimiento inv\u00e1lido. Debe ser: Programado, En Proceso, Completado o Cancelado',
  }),
});

export const actualizarFechaProximoSchema = z.object({
  fecha_proximo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
});

export const actualizarFechaMantenimientoSchema = z.object({
  fecha_mantenimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'Formato de fecha inválido (YYYY-MM-DD o YYYY-MM-DDTHH:mm)'),
});

/**
 * Middleware de validación genérico
 */
export const validate = (schema) => (req, res, next) => {
  try {
    const validated = schema.parse(req.body);
    req.body = validated;
    next();
  } catch (error) {
    if (error instanceof z.ZodError && error.issues && Array.isArray(error.issues)) {
      const details = error.issues.map((e) => ({
        path: e.path && Array.isArray(e.path) ? e.path.join('.') : 'unknown',
        message: e.message || 'Error de validación desconocido',
        code: e.code || 'invalid_type',
      }));
      
      return res.status(400).json({
        success: false,
        error: 'Error de validación',
        details: details.length > 0 ? details : [{ path: 'unknown', message: 'Error de validación desconocido' }],
      });
    }
    next(error);
  }
};

