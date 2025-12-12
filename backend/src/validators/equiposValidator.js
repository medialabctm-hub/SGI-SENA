import { z } from 'zod';

/**
 * Validadores para las rutas de equipos
 */

export const registrarEquipoSchema = z.object({
  codigo_inventario: z.string().optional(),
  placa: z.string().max(100).optional().nullable(),
  r_centro: z.string().optional().nullable(),
  centro: z.string().optional().nullable(), // Alias de r_centro
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
  centro: z.string().optional().nullable(), // Alias de r_centro
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
  tipo_responsabilidad: z.enum(['Principal', 'Secundario'], {
    errorMap: () => ({ message: 'Tipo de responsabilidad inválido. Debe ser "Principal" o "Secundario"' }),
  }),
  observaciones: z.string().max(500).optional().nullable(),
  fecha_fin: z.string().optional().nullable(), // Para responsabilidades temporales
  dias_asignados: z.union([
    z.number().int().positive(),
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const num = parseInt(val, 10);
      return isNaN(num) || num <= 0 ? null : num;
    }),
    z.null()
  ]).optional().nullable(),
});

export const verificarInventarioSchema = z.object({
  codigo_equipo: z.union([
    z.string().min(1),
    z.number().int().positive(),
  ]),
  estado_verificacion: z.enum(['Verificado', 'Con Novedad', 'No Verificado'], {
    errorMap: () => ({ message: 'Estado de verificación inválido. Debe ser: Verificado, Con Novedad o No Verificado' }),
  }),
  observaciones: z.string().max(1000).optional().nullable(),
});

export const crearCategoriaSchema = z.object({
  nombre_categoria: z.string().min(1, 'El nombre de la categoría es obligatorio').max(50, 'El nombre no puede exceder 50 caracteres'),
  descripcion: z.string().max(200, 'La descripción no puede exceder 200 caracteres').optional().nullable(),
  es_componente: z.union([
    z.boolean(),
    z.number().int().min(0).max(1),
    z.string().transform((val) => val === '1' || val === 'true' || val === true),
    z.null()
  ]).optional().default(false),
});

export const actualizarCategoriaSchema = z.object({
  nombre_categoria: z.string().min(1, 'El nombre de la categoría no puede estar vacío').max(50, 'El nombre no puede exceder 50 caracteres').optional(),
  descripcion: z.string().max(200, 'La descripción no puede exceder 200 caracteres').optional().nullable(),
  es_componente: z.union([
    z.boolean(),
    z.number().int().min(0).max(1),
    z.string().transform((val) => val === '1' || val === 'true' || val === true),
    z.null()
  ]).optional(),
});

export const registrarUsoEquipoSchema = z.object({
  codigo_equipo: z.union([
    z.string().min(1, 'El código del equipo es requerido'),
    z.number().int().positive('El código del equipo debe ser un número positivo'),
  ]),
  id_usuario: z.number().int().positive('El ID del usuario es requerido').optional(),
  nombre_usuario: z.string().min(1, 'El nombre del usuario es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
  fecha_hora_inicio: z.string().optional().refine((val) => {
    if (!val) return true; // Opcional
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, { message: 'La fecha de inicio debe ser una fecha válida' }),
  fecha_hora_fin: z.string().optional().nullable().refine((val) => {
    if (!val) return true; // Opcional
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, { message: 'La fecha de fin debe ser una fecha válida' }),
  observaciones: z.string().max(1000, 'Las observaciones no pueden exceder 1000 caracteres').optional().nullable(),
});

export const actualizarUsoEquipoSchema = z.object({
  codigo_equipo: z.union([
    z.string().min(1, 'El código del equipo es requerido'),
    z.number().int().positive('El código del equipo debe ser un número positivo'),
  ]).optional(),
  fecha_hora_fin: z.string().optional().nullable().refine((val) => {
    if (!val) return true; // Opcional
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, { message: 'La fecha de fin debe ser una fecha válida' }),
  observaciones: z.string().max(1000, 'Las observaciones no pueden exceder 1000 caracteres').optional().nullable(),
});

/**
 * Validador para registro de uso de equipo desde página externa
 * Recibe: ficha, placa, nombre, documento
 */
export const registrarUsoEquipoExternoSchema = z.object({
  ficha: z.string().min(1, 'La ficha es obligatoria').max(50, 'La ficha no puede exceder 50 caracteres'),
  placa: z.string().min(1, 'La placa del equipo es obligatoria').max(100, 'La placa no puede exceder 100 caracteres'),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(200, 'El nombre no puede exceder 200 caracteres'),
  documento: z.string().min(5, 'El documento de identificación debe tener al menos 5 caracteres').max(20, 'El documento no puede exceder 20 caracteres'),
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

