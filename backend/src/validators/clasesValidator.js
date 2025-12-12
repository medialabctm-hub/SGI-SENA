import { z } from 'zod';

/**
 * Validadores para las rutas de clases
 */

export const crearClaseSchema = z.object({
  id_ambiente: z.number().int().positive('El ID del ambiente es requerido'),
  id_instructor: z.number().int().positive('El ID del instructor es requerido').optional(),
  nombre_clase: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(200).optional(),
  codigo_ficha: z.string().min(1).max(50).optional(),
  descripcion: z.string().max(1000).nullable().optional(),
  fecha_clase: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM:SS)'),
  hora_fin: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM:SS)'),
  observaciones: z.string().max(2000).nullable().optional(),
  participantes: z.array(z.number().int().positive()).optional().default([]),
}).refine((data) => {
  // Validar que hora_fin sea posterior a hora_inicio
  if (data.hora_inicio && data.hora_fin) {
    const inicio = new Date(`2000-01-01T${data.hora_inicio}`);
    const fin = new Date(`2000-01-01T${data.hora_fin}`);
    return fin > inicio;
  }
  return true;
}, {
  message: 'La hora de fin debe ser posterior a la hora de inicio',
  path: ['hora_fin'],
});

export const actualizarClaseSchema = z.object({
  id_ambiente: z.number().int().positive().optional(),
  id_instructor: z.number().int().positive().optional(),
  nombre_clase: z.string().min(3).max(200).optional(),
  codigo_ficha: z.string().min(1).max(50).optional(),
  descripcion: z.string().max(1000).nullable().optional(),
  fecha_clase: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  hora_fin: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  observaciones: z.string().max(2000).nullable().optional(),
  estado_clase: z.enum(['Programada', 'En Curso', 'Finalizada', 'Cancelada']).optional(),
});

export const agregarParticipantesSchema = z.object({
  participantes: z.array(z.number().int().positive('Cada participante debe ser un ID válido'))
    .min(1, 'Debe agregar al menos un participante')
    .max(50, 'No se pueden agregar más de 50 participantes a la vez'),
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

