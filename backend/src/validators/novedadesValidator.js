import { z } from 'zod';

/**
 * Validadores para las rutas de novedades
 */

const tiposNovedadValidos = [
  'Daño',
  'Pérdida',
  'Robo',
  'Mal Funcionamiento',
  'Daño Físico',
  'Falta de Componente',
  'Otro'
];

export const crearNovedadSchema = z.object({
  codigo_equipo: z.union([
    z.string().min(1, 'El código del equipo es requerido'),
    z.number().int().positive('El código del equipo debe ser un número positivo'),
  ]),
  tipo_novedad: z.enum(tiposNovedadValidos, {
    errorMap: () => ({ 
      message: `Tipo de novedad inválido. Tipos válidos: ${tiposNovedadValidos.join(', ')}` 
    }),
  }),
  descripcion: z.string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(2000, 'La descripción no puede exceder 2000 caracteres'),
});

export const actualizarEstadoNovedadSchema = z.object({
  estado: z.enum(['Pendiente', 'En Revisión', 'Resuelta', 'Rechazada'], {
    errorMap: () => ({ message: 'Estado inválido' }),
  }),
  observaciones: z.string().max(1000).optional().nullable(),
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
      return res.status(400).json({
        success: false,
        error: 'Error de validación',
        details: error.errors.map((e) => ({
          path: e.path && Array.isArray(e.path) ? e.path.join('.') : 'unknown',
          message: e.message || 'Error de validación',
        })),
      });
    }
    next(error);
  }
};

