import { z } from 'zod';
import { createValidator } from '../middleware/validate.js';

/**
 * Validadores para las rutas de mantenimiento
 */

// Debe coincidir con el ENUM real de la tabla Mantenimiento (BD/SGI_SENA.sql)
export const crearMantenimientoSchema = z.object({
  codigo_equipo: z.union([
    z.string().min(1, 'El código del equipo es requerido'),
    z.number().int().positive('El código del equipo debe ser un número positivo'),
  ]),
  tipo_mantenimiento: z.enum(['Preventivo', 'Correctivo', 'Actualización'], {
    error: 'Tipo de mantenimiento inválido. Debe ser: Preventivo, Correctivo o Actualización',
  }),
  fecha_mantenimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/, 'Formato de fecha inválido (YYYY-MM-DD o YYYY-MM-DDTHH:mm)'),
  fecha_proximo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional().nullable(),
  descripcion_trabajo: z.string().max(2000, 'La descripción no puede exceder 2000 caracteres').optional().nullable(),
  costo: z.union([z.string(), z.number()]).optional().nullable(),
  id_usuario_tecnico: z.union([z.string(), z.number()]).optional().nullable(),
  observaciones: z.string().max(1000).optional().nullable(),
  estado_mantenimiento: z.enum(['Programado', 'En Proceso', 'Completado', 'Cancelado']).optional().default('Programado'),
});

export const actualizarEstadoMantenimientoSchema = z.object({
  estado_mantenimiento: z.enum(['Programado', 'En Proceso', 'Completado', 'Cancelado'], {
    error: 'Estado de mantenimiento inválido. Debe ser: Programado, En Proceso, Completado o Cancelado',
  }),
});

export const actualizarFechaProximoSchema = z.object({
  fecha_proximo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
});

export const actualizarFechaMantenimientoSchema = z.object({
  fecha_mantenimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, 'Formato de fecha inválido (YYYY-MM-DD o YYYY-MM-DDTHH:mm)'),
});

export const validate = createValidator({ fallbackIssueMessage: 'Error de validación desconocido' });
