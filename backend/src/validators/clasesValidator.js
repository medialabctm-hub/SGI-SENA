import { z } from 'zod';

/**
 * Validadores para las rutas de clases
 */

// Función helper para transformar hora de HH:MM a HH:MM:SS
const transformHora = (val) => {
  if (typeof val !== 'string') return val;
  // Si ya tiene formato HH:MM:SS, devolverlo tal cual
  if (/^\d{2}:\d{2}:\d{2}$/.test(val)) return val;
  // Si tiene formato HH:MM, agregar :00
  if (/^\d{2}:\d{2}$/.test(val)) return `${val}:00`;
  return val;
};

// Función helper para transformar id_ambiente de string a number
const transformIdAmbiente = (val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (val === '' || val === null || val === undefined) return val; // Dejar que Zod valide el requerido
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return val;
};

// Función helper para transformar id_instructor de string a number
const transformIdInstructor = (val) => {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return val;
};

// Mapeo de días de la semana en español a números (0=Domingo, 1=Lunes, etc.)
const DIAS_SEMANA_MAP = {
  'lunes': 1,
  'martes': 2,
  'miércoles': 3,
  'miercoles': 3,
  'jueves': 4,
  'viernes': 5,
  'sábado': 6,
  'sabado': 6,
  'domingo': 0
};

// Función helper para transformar dias_semana de strings a números
const transformDiasSemana = (val) => {
  if (!val) return undefined;
  if (!Array.isArray(val)) return val;
  
  // Si ya es un array de números, retornarlo
  if (val.every(item => typeof item === 'number')) {
    return val;
  }
  
  // Si es un array de strings, convertirlos a números
  if (val.every(item => typeof item === 'string')) {
    const diasNumericos = val
      .map(d => String(d).trim().toLowerCase())
      .map(d => DIAS_SEMANA_MAP[d])
      .filter(d => d !== undefined);
    
    // Eliminar duplicados
    return [...new Set(diasNumericos)];
  }
  
  // Si es un array mixto, intentar convertir cada elemento
  return val.map(item => {
    if (typeof item === 'number') return item;
    if (typeof item === 'string') {
      const diaLower = item.trim().toLowerCase();
      return DIAS_SEMANA_MAP[diaLower] !== undefined ? DIAS_SEMANA_MAP[diaLower] : null;
    }
    return null;
  }).filter(item => item !== null);
};

export const crearClaseSchema = z.object({
  id_ambiente: z.preprocess(
    transformIdAmbiente,
    z.number().int().positive('El ID del ambiente es requerido y debe ser un número positivo')
  ),
  id_instructor: z.preprocess(
    transformIdInstructor,
    z.number().int().positive('El ID del instructor debe ser un número positivo').optional()
  ),
  nombre_clase: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(200).optional(),
  codigo_ficha: z.string().min(1).max(50).optional(),
  descripcion: z.string().max(1000).nullable().optional(),
  fecha_clase: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
  dias_semana: z.preprocess(
    transformDiasSemana,
    z.array(z.number().int().min(0).max(6)).optional()
  ),
  hora_inicio: z.preprocess(
    transformHora,
    z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM o HH:MM:SS)')
  ),
  hora_fin: z.preprocess(
    transformHora,
    z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM o HH:MM:SS)')
  ),
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
}).refine((data) => {
  // Si hay dias_semana, fecha_inicio y fecha_fin son obligatorias
  if (data.dias_semana && Array.isArray(data.dias_semana) && data.dias_semana.length > 0) {
    return !!(data.fecha_inicio && data.fecha_fin);
  }
  return true;
}, {
  message: 'Para usar días de semana, debe proporcionar fecha_inicio y fecha_fin',
  path: ['fecha_inicio'],
}).refine((data) => {
  // Si hay dias_semana, validar que fecha_inicio <= fecha_fin
  if (data.dias_semana && Array.isArray(data.dias_semana) && data.dias_semana.length > 0) {
    if (data.fecha_inicio && data.fecha_fin) {
      return data.fecha_inicio <= data.fecha_fin;
    }
  }
  return true;
}, {
  message: 'La fecha de inicio debe ser menor o igual a la fecha de fin',
  path: ['fecha_fin'],
}).refine((data) => {
  // Debe tener fecha_clase O (fecha_inicio + fecha_fin + dias_semana)
  const tieneFechaUnica = !!data.fecha_clase;
  const tieneRangoConDias = !!(data.fecha_inicio && data.fecha_fin && data.dias_semana && Array.isArray(data.dias_semana) && data.dias_semana.length > 0);
  return tieneFechaUnica || tieneRangoConDias;
}, {
  message: 'Debe proporcionar fecha_clase (clase única) o fecha_inicio + fecha_fin + dias_semana (clases recurrentes)',
  path: ['fecha_clase'],
});

export const actualizarClaseSchema = z.object({
  id_ambiente: z.preprocess(
    transformIdAmbiente,
    z.number().int().positive().optional()
  ),
  id_instructor: z.preprocess(
    transformIdInstructor,
    z.number().int().positive().optional()
  ),
  nombre_clase: z.string().min(3).max(200).optional(),
  codigo_ficha: z.string().min(1).max(50).optional(),
  descripcion: z.string().max(1000).nullable().optional(),
  fecha_clase: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hora_inicio: z.preprocess(
    transformHora,
    z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM o HH:MM:SS)').optional()
  ),
  hora_fin: z.preprocess(
    transformHora,
    z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM o HH:MM:SS)').optional()
  ),
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
    if (error instanceof z.ZodError && error.issues && Array.isArray(error.issues)) {
      const details = error.issues.map((e) => ({
        path: e.path && Array.isArray(e.path) ? e.path.join('.') : 'unknown',
        message: e.message || 'Error de validación',
        code: e.code || 'invalid_type',
      }));
      
      // Log detallado para debugging
      console.error('Validation error details:', {
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
    console.error('Validation middleware error:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    next(error);
  }
};

