import { z } from 'zod';

/**
 * Validadores para las rutas de reportes
 */

const tiposReporteValidos = [
  'Mantenimiento',
  'Novedad',
  'Consulta',
  'Solicitud',
  'Otro'
];

export const crearReporteSchema = z.object({
  codigo_equipo: z.union([
    z.string().min(1, 'El código del equipo es requerido'),
    z.number().int().positive('El código del equipo debe ser un número positivo'),
  ]),
  tipo_reporte: z.enum(tiposReporteValidos, {
    errorMap: () => ({ 
      message: `Tipo de reporte inválido. Tipos válidos: ${tiposReporteValidos.join(', ')}` 
    }),
  }),
  titulo: z.string()
    .min(5, 'El título debe tener al menos 5 caracteres')
    .max(200, 'El título no puede exceder 200 caracteres'),
  descripcion: z.string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(5000, 'La descripción no puede exceder 5000 caracteres'),
  prioridad: z.enum(['Baja', 'Media', 'Alta', 'Urgente']).optional().default('Media'),
});

export const actualizarReporteSchema = z.object({
  tipo_reporte: z.enum(tiposReporteValidos).optional(),
  titulo: z.string().min(5).max(200).optional(),
  descripcion: z.string().min(10).max(5000).optional(),
  prioridad: z.enum(['Baja', 'Media', 'Alta', 'Urgente']).optional(),
  estado: z.enum(['Pendiente', 'En Proceso', 'Resuelto', 'Cerrado']).optional(),
  observaciones: z.string().max(2000).optional().nullable(),
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
    if (error instanceof z.ZodError && error.errors && Array.isArray(error.errors)) {
      const details = error.errors.map((e) => ({
        path: e.path && Array.isArray(e.path) ? e.path.join('.') : 'unknown',
        message: e.message || 'Error de validación',
        code: e.code || 'invalid_type',
      }));
      
      return res.status(400).json({
        success: false,
        error: 'Error de validación',
        details: details.length > 0 ? details : [{ path: 'unknown', message: 'Error de validación desconocido' }],
      });
    }
    // Si no es un ZodError o no tiene errors, loguear y pasar al siguiente middleware
    console.error('Validation middleware error:', error);
    next(error);
  }
};

