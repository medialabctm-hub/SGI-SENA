import { z } from 'zod';

/**
 * Validadores para las rutas de equipos
 */

export const registrarEquipoSchema = z.object({
  codigo_inventario: z.string().optional(),
  placa: z.string().max(100).optional().nullable(),
  r_centro: z.string().optional().nullable(),
  consecutivo: z.string().optional().nullable(),
  tipo: z.string().min(1, 'El tipo es requerido').max(100),
  marca: z.string().max(100).optional().nullable(),
  modelo: z.string().max(100).optional().nullable(),
  numero_serie: z.string().max(100).optional().nullable(),
  descripcion: z.string().optional().nullable(),
  fecha_adquisicion: z.string().optional().nullable(),
  costo: z.union([
    z.number().min(0),
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    }),
    z.null()
  ]).optional().nullable(),
  valor_ingreso: z.union([
    z.number().min(0),
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    }),
    z.null()
  ]).optional().nullable(),
  vida_util_meses: z.union([
    z.number().int().min(1),
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const num = parseInt(val, 10);
      return isNaN(num) ? null : num;
    }),
    z.null()
  ]).optional().nullable(),
  estado_fisico: z.enum(['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado'], {
    errorMap: () => ({ message: 'Estado físico inválido' }),
  }),
  specs_completas: z.string().optional().nullable(),
  id_ambiente: z.union([
    z.number().int().positive(),
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const num = parseInt(val, 10);
      return isNaN(num) || num <= 0 ? null : num;
    }),
    z.null()
  ]).optional().nullable(),
  ambiente: z.string().optional().nullable(),
  comentarios: z.string().max(1000).optional().nullable(),
});

export const actualizarEquipoSchema = z.object({
  placa: z.string().max(100).optional().nullable(),
  r_centro: z.string().optional().nullable(),
  consecutivo: z.string().optional().nullable(),
  tipo: z.string().max(100).optional().nullable(),
  marca: z.string().max(100).optional().nullable(),
  modelo: z.string().max(100).optional().nullable(),
  numero_serie: z.string().max(100).optional().nullable(),
  descripcion: z.string().optional().nullable(),
  fecha_adquisicion: z.string().optional().nullable(),
  costo: z.union([
    z.number().min(0),
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    }),
    z.null()
  ]).optional().nullable(),
  valor_ingreso: z.union([
    z.number().min(0),
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    }),
    z.null()
  ]).optional().nullable(),
  vida_util_meses: z.union([
    z.number().int().min(1),
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const num = parseInt(val, 10);
      return isNaN(num) ? null : num;
    }),
    z.null()
  ]).optional().nullable(),
  estado_fisico: z.enum(['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado']).optional().nullable(),
  specs_completas: z.string().optional().nullable(),
  id_ambiente: z.union([
    z.number().int().positive(),
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const num = parseInt(val, 10);
      return isNaN(num) || num <= 0 ? null : num;
    }),
    z.null()
  ]).optional().nullable(),
  // Permitir campos adicionales que pueden venir del frontend pero no se validan
  nombre_ambiente: z.string().optional(),
  codigo_ambiente: z.string().optional(),
  ambiente: z.string().optional(),
  codigo_equipo: z.union([z.number(), z.string()]).optional(),
  codigo_inventario: z.string().optional(),
}).passthrough(); // Permitir campos adicionales sin validar

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
    if (error instanceof z.ZodError && error.errors && Array.isArray(error.errors)) {
      const details = error.errors.map((e) => ({
        path: e.path && Array.isArray(e.path) ? e.path.join('.') : 'unknown',
        message: e.message || 'Error de validación',
        code: e.code || 'invalid_type',
      }));
      
      // Log para debugging
      console.error('Validation error:', {
        body: req.body,
        errors: details
      });
      
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

