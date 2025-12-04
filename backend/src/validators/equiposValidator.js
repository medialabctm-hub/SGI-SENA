import { z } from 'zod';

/**
 * Validadores para las rutas de equipos
 */

export const registrarEquipoSchema = z.object({
  codigo_inventario: z.string().optional(),
  placa: z.string().min(1, 'La placa es requerida').max(100),
  r_centro: z.string().optional().nullable(),
  consecutivo: z.string().optional().nullable(),
  tipo: z.string().min(1, 'El tipo es requerido').max(100),
  marca: z.string().max(100).optional().nullable(),
  modelo: z.string().max(100).optional().nullable(),
  numero_serie: z.string().max(100).optional().nullable(),
  descripcion: z.string().optional().nullable(),
  fecha_adquisicion: z.string().optional().nullable(),
  costo: z.number().min(0).optional().nullable(),
  valor_ingreso: z.number().min(0).optional().nullable(),
  vida_util_meses: z.number().min(1).optional().nullable(),
  estado_fisico: z.enum(['Bueno', 'Regular', 'Malo', 'En Reparación'], {
    errorMap: () => ({ message: 'Estado físico inválido' }),
  }),
  specs_completas: z.string().optional().nullable(),
  id_ambiente: z.number().int().positive().optional().nullable(),
  ambiente: z.string().optional().nullable(),
  comentarios: z.string().max(1000).optional().nullable(),
});

export const actualizarEquipoSchema = z.object({
  placa: z.string().min(1).max(100).optional(),
  r_centro: z.string().optional().nullable(),
  consecutivo: z.string().optional().nullable(),
  tipo: z.string().min(1).max(100).optional(),
  marca: z.string().max(100).optional().nullable(),
  modelo: z.string().max(100).optional().nullable(),
  numero_serie: z.string().max(100).optional().nullable(),
  descripcion: z.string().optional().nullable(),
  fecha_adquisicion: z.string().optional().nullable(),
  costo: z.number().min(0).optional().nullable(),
  valor_ingreso: z.number().min(0).optional().nullable(),
  vida_util_meses: z.number().min(1).optional().nullable(),
  estado_fisico: z.enum(['Bueno', 'Regular', 'Malo', 'En Reparación']).optional(),
  specs_completas: z.string().optional().nullable(),
  id_ambiente: z.number().int().positive().optional().nullable(),
});

export const asignarEquipoSchema = z.object({
  codigo_equipo: z.union([
    z.string().min(1, 'El código del equipo es requerido'),
    z.number().int().positive('El código del equipo debe ser un número positivo'),
  ]),
  id_usuario: z.number().int().positive('El ID del usuario es requerido'),
  tipo_responsabilidad: z.enum(['Permanente', 'Temporal'], {
    errorMap: () => ({ message: 'Tipo de responsabilidad inválido' }),
  }),
  observaciones: z.string().max(500).optional().nullable(),
  fecha_fin: z.string().optional().nullable(), // Para responsabilidades temporales
});

export const verificarInventarioSchema = z.object({
  codigo_equipo: z.union([
    z.string().min(1),
    z.number().int().positive(),
  ]),
  estado_verificado: z.enum(['Presente', 'Ausente', 'Dañado'], {
    errorMap: () => ({ message: 'Estado verificado inválido' }),
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
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Error de validación',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    next(error);
  }
};

