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
 * Constantes y funciones compartidas para validación de días de la semana y horarios
 */
const diasSemanaEnum = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const diasSemanaEnumLower = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// Función para normalizar días de la semana
const normalizarDiasSemana = (dias) => {
  if (!dias || !Array.isArray(dias)) return null;
  return dias.map(dia => {
    const diaLower = dia.toLowerCase();
    const index = diasSemanaEnumLower.indexOf(diaLower);
    return index >= 0 ? diasSemanaEnum[index] : dia;
  });
};

/**
 * Validador para actualizar una asignación de equipo (Responsables_Equipo)
 */
export const actualizarAsignacionEquipoSchema = z.object({
  ficha: z.string().min(1, 'La ficha es obligatoria').max(50, 'La ficha no puede exceder 50 caracteres').optional().nullable(),
  nombre_externo: z.string().min(1, 'El nombre es obligatorio').max(200, 'El nombre no puede exceder 200 caracteres').optional().nullable(),
  documento_externo: z.string().min(5, 'El documento de identificación debe tener al menos 5 caracteres').max(20, 'El documento no puede exceder 20 caracteres').optional().nullable(),
  dias_semana: z.array(z.union([
    z.enum(diasSemanaEnum),
    z.enum(diasSemanaEnumLower)
  ])).optional().nullable().transform(normalizarDiasSemana),
  diasSemana: z.array(z.union([
    z.enum(diasSemanaEnum),
    z.enum(diasSemanaEnumLower)
  ])).optional().nullable().transform(normalizarDiasSemana),
  hora_inicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
  horaInicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
  hora_fin: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
  horaFin: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
  observaciones: z.string().max(1000, 'Las observaciones no pueden exceder 1000 caracteres').optional().nullable(),
}).transform((data) => {
  return {
    ficha: data.ficha,
    nombre_externo: data.nombre_externo,
    documento_externo: data.documento_externo,
    dias_semana: data.dias_semana || data.diasSemana || null,
    hora_inicio: data.hora_inicio || data.horaInicio || null,
    hora_fin: data.hora_fin || data.horaFin || null,
    observaciones: data.observaciones,
  };
}).refine((data) => {
  // Si se especifica horario, tanto hora_inicio como hora_fin son obligatorios
  if ((data.hora_inicio && !data.hora_fin) || (!data.hora_inicio && data.hora_fin)) {
    return false;
  }
  return true;
}, {
  message: 'Si se especifica horario, tanto hora_inicio como hora_fin son obligatorios',
  path: ['hora_inicio']
});

/**
 * Validador para registro de uso de equipo desde página externa
 * Recibe: placa, ambiente, usuarios (array)
 * Nota: El ambiente debe ser el código numérico que los usuarios conocen (ej: "101", "102")
 * Cada usuario debe tener: ficha, nombre, documento, dias_semana (opcional), hora_inicio (opcional), hora_fin (opcional)
 */

const usuarioExternoSchema = z.object({
  ficha: z.string().min(1, 'La ficha es obligatoria').max(50, 'La ficha no puede exceder 50 caracteres'),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(200, 'El nombre no puede exceder 200 caracteres'),
  documento: z.string().min(5, 'El documento de identificación debe tener al menos 5 caracteres').max(20, 'El documento no puede exceder 20 caracteres'),
  // Aceptar tanto snake_case como camelCase
  dias_semana: z.array(z.union([
    z.enum(diasSemanaEnum),
    z.enum(diasSemanaEnumLower)
  ])).optional().nullable().transform(normalizarDiasSemana),
  diasSemana: z.array(z.union([
    z.enum(diasSemanaEnum),
    z.enum(diasSemanaEnumLower)
  ])).optional().nullable().transform(normalizarDiasSemana),
  hora_inicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
  horaInicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
  hora_fin: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
  horaFin: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
}).transform((data) => {
  // Normalizar a snake_case y unificar campos
  return {
    ficha: data.ficha,
    nombre: data.nombre,
    documento: data.documento,
    dias_semana: data.dias_semana || data.diasSemana || null,
    hora_inicio: data.hora_inicio || data.horaInicio || null,
    hora_fin: data.hora_fin || data.horaFin || null,
  };
}).refine((data) => {
  // Si se proporciona hora_inicio o hora_fin, ambas deben estar presentes
  if ((data.hora_inicio && !data.hora_fin) || (!data.hora_inicio && data.hora_fin)) {
    return false;
  }
  return true;
}, {
  message: 'Si se especifica horario, tanto hora_inicio como hora_fin son obligatorios',
  path: ['hora_inicio']
});

// Schema para compatibilidad con formato antiguo (un solo usuario en el nivel raíz)
const schemaFormatoAntiguo = z.object({
  placa: z.string().min(1, 'La placa del equipo es obligatoria').max(100, 'La placa no puede exceder 100 caracteres'),
  ambiente: z.union([
    z.string().min(1, 'El código del ambiente es obligatorio').max(50, 'El código del ambiente no puede exceder 50 caracteres'),
    z.number().int().positive('El código del ambiente debe ser un número positivo')
  ]).transform(val => String(val)),
  // Campos de usuario en el nivel raíz (formato antiguo)
  ficha: z.string().min(1, 'La ficha es obligatoria').max(50, 'La ficha no puede exceder 50 caracteres'),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(200, 'El nombre no puede exceder 200 caracteres'),
  documento: z.string().min(5, 'El documento de identificación debe tener al menos 5 caracteres').max(20, 'El documento no puede exceder 20 caracteres'),
  // Aceptar tanto snake_case como camelCase para horarios
  dias_semana: z.array(z.union([
    z.enum(diasSemanaEnum),
    z.enum(diasSemanaEnumLower)
  ])).optional().nullable().transform(normalizarDiasSemana),
  diasSemana: z.array(z.union([
    z.enum(diasSemanaEnum),
    z.enum(diasSemanaEnumLower)
  ])).optional().nullable().transform(normalizarDiasSemana),
  hora_inicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
  horaInicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
  hora_fin: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
  horaFin: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (debe ser HH:MM o HH:MM:SS)').optional().nullable(),
}).transform((data) => {
  // Convertir formato antiguo a formato nuevo (array de usuarios)
  return {
    placa: data.placa,
    ambiente: data.ambiente,
    usuarios: [{
      ficha: data.ficha,
      nombre: data.nombre,
      documento: data.documento,
      dias_semana: data.dias_semana || data.diasSemana || null,
      hora_inicio: data.hora_inicio || data.horaInicio || null,
      hora_fin: data.hora_fin || data.horaFin || null,
    }]
  };
}).refine((data) => {
  // Validar que si hay horario, ambas horas estén presentes
  if (data.usuarios && data.usuarios.length > 0) {
    const usuario = data.usuarios[0];
    if ((usuario.hora_inicio && !usuario.hora_fin) || (!usuario.hora_inicio && usuario.hora_fin)) {
      return false;
    }
  }
  return true;
}, {
  message: 'Si se especifica horario, tanto hora_inicio como hora_fin son obligatorios',
  path: ['hora_inicio']
});

// Schema para formato nuevo (array de usuarios)
const schemaFormatoNuevo = z.object({
  placa: z.string().min(1, 'La placa del equipo es obligatoria').max(100, 'La placa no puede exceder 100 caracteres'),
  ambiente: z.union([
    z.string().min(1, 'El código del ambiente es obligatorio').max(50, 'El código del ambiente no puede exceder 50 caracteres'),
    z.number().int().positive('El código del ambiente debe ser un número positivo')
  ]).transform(val => String(val)),
  usuarios: z.array(usuarioExternoSchema).min(1, 'Debe haber al menos un usuario').max(50, 'No se pueden registrar más de 50 usuarios a la vez'),
});

// Schema que acepta ambos formatos
export const registrarUsoEquipoExternoSchema = z.union([
  schemaFormatoAntiguo,
  schemaFormatoNuevo
]).transform((data) => {
  // Asegurar que siempre tengamos el formato nuevo
  if (data.usuarios && Array.isArray(data.usuarios)) {
    return data;
  }
  // Si por alguna razón no tiene usuarios, crear array vacío (no debería pasar)
  return {
    ...data,
    usuarios: []
  };
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

