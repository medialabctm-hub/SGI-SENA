import { z } from 'zod';
import { createValidator } from '../middleware/validate.js';

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
    error: `Tipo de novedad inv\u00e1lido. Tipos v\u00e1lidos: ${tiposNovedadValidos.join(', ')}`,
  }),
  descripcion: z.string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(2000, 'La descripción no puede exceder 2000 caracteres'),
});

export const actualizarEstadoNovedadSchema = z.object({
  estado_resolucion: z.enum(['Pendiente', 'En Proceso', 'Resuelto', 'No Resuelto'], {
    error: 'Estado de resoluci\u00f3n inv\u00e1lido. Debe ser: Pendiente, En Proceso, Resuelto o No Resuelto',
  }),
  observaciones_resolucion: z.string().max(1000).optional().nullable(),
});

export const validate = createValidator({ fallbackIssueMessage: 'Error de validación desconocido' });

