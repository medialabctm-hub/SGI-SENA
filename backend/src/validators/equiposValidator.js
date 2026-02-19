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
  categoria: z.string().min(1, 'La categoría es requerida').max(100).optional().nullable(),
  modelo: z.string().max(100).optional().nullable(),
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
  estado_fisico: z.enum(['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado'], {
    errorMap: () => ({ message: 'Estado físico inválido' }),
  }),
  specs_completas: z.string().optional().nullable(),
  atributos: z.string().optional().nullable(),
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
  id_cuentadante: z.union([
    z.number().int().positive(),
    z.string().transform((val) => {
      if (!val || val === '') return null;
      const num = parseInt(val, 10);
      return isNaN(num) || num <= 0 ? null : num;
    }),
    z.null()
  ]).optional().nullable(),
});

export const actualizarEquipoSchema = z.object({
  placa: z.string().max(100).optional().nullable(),
  r_centro: z.string().optional().nullable(),
  centro: z.string().optional().nullable(), // Alias de r_centro
  consecutivo: z.string().optional().nullable(),
  tipo: z.string().max(100).optional().nullable(),
  modelo: z.string().max(100).optional().nullable(),
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
  estado_fisico: z.enum(['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado']).optional().nullable(),
  estado_operativo: z.enum(['Disponible', 'En Uso', 'En Mantenimiento', 'Dañado', 'Dado de Baja'], {
    errorMap: () => ({ message: 'Estado operativo inválido' }),
  }).optional().nullable(),
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

export const solicitudAutorizacionMovimientoSchema = z.object({
  codigo_equipo: z.union([z.number().int().positive(), z.string().transform(v => (v ? parseInt(v, 10) : 0))]),
  id_ambiente_destino: z.union([z.number().int().positive(), z.string().transform(v => (v ? parseInt(v, 10) : 0))]),
  motivo: z.string().min(1, 'El motivo es obligatorio').max(2000),
  id_autorizador: z.union([z.number().int().positive(), z.string().transform(v => (v ? parseInt(v, 10) : 0))]),
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

// Mapa de variantes sin tilde / lowercase a valor canónico (para formularios que envían "Miercoles", "Sabado", etc.)
const diaNormalizadoMap = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', miércoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', sábado: 'Sábado', domingo: 'Domingo',
};

/** Normaliza un solo día (string) al valor canónico del enum. Acepta con/sin tildes y cualquier capitalización. */
function normalizarUnDia(val) {
  if (val == null || typeof val !== 'string') return null;
  const s = val.trim();
  if (!s) return null;
  const key = s.toLowerCase().normalize('NFD').replace(/\u0307/g, '').replace(/\u0301/g, ''); // sin tildes
  return diaNormalizadoMap[key] ?? (diasSemanaEnum.includes(s) ? s : (diasSemanaEnumLower.includes(s.toLowerCase()) ? diasSemanaEnum[diasSemanaEnumLower.indexOf(s.toLowerCase())] : null));
}

// Función para normalizar array de días de la semana (acepta strings con espacios, mayúsculas, con/sin tildes)
const normalizarDiasSemana = (dias) => {
  if (!dias || !Array.isArray(dias)) return null;
  const out = [];
  for (const d of dias) {
    const normalized = normalizarUnDia(typeof d === 'string' ? d : String(d));
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out.length ? out : null;
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
 * Cada usuario debe tener: documento (la ficha ahora es opcional), dias_semana (opcional), hora_inicio (opcional), hora_fin (opcional)
 * El nombre se obtiene automáticamente buscando el usuario por documento en la base de datos
 */

// Schema flexible para un día: acepta "Lunes", "lunes", "Miercoles", "miércoles", etc. y normaliza al canónico
const diaSemanaFlexible = z.string().min(1).transform((s) => {
  const n = normalizarUnDia(s);
  if (!n) throw new Error('Día de la semana inválido. Use: Lunes, Martes, Miércoles, Jueves, Viernes, Sábado, Domingo.');
  return n;
});

const usuarioExternoSchema = z.object({
  ficha: z.string().min(1, 'La ficha es obligatoria').max(50, 'La ficha no puede exceder 50 caracteres').optional().nullable(),
  documento: z.string().min(5, 'El documento de identificación debe tener al menos 5 caracteres').max(20, 'El documento no puede exceder 20 caracteres'),
  dias_semana: z.union([
    z.array(diaSemanaFlexible).transform((val) => (val && val.length ? normalizarDiasSemana(val) : null)),
    z.string().transform((s) => {
      const trimmed = (s && String(s).trim()) || '';
      if (!trimmed) return null;
      const parsed = trimmed.includes(',') ? trimmed.split(',').map((x) => x.trim()) : [trimmed];
      return normalizarDiasSemana(parsed);
    })
  ]).optional().nullable(),
  diasSemana: z.union([
    z.array(diaSemanaFlexible).transform((val) => (val && val.length ? normalizarDiasSemana(val) : null)),
    z.string().transform((s) => {
      const trimmed = (s && String(s).trim()) || '';
      if (!trimmed) return null;
      const parsed = trimmed.includes(',') ? trimmed.split(',').map((x) => x.trim()) : [trimmed];
      return normalizarDiasSemana(parsed);
    })
  ]).optional().nullable(),
  hora_inicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido (HH:MM o HH:MM:SS)').optional().nullable(),
  horaInicio: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido').optional().nullable(),
  hora_fin: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido').optional().nullable(),
  horaFin: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:00)?$/, 'Formato de hora inválido').optional().nullable(),
}).transform((data) => {
  const dias = data.dias_semana ?? data.diasSemana ?? null;
  const horaInicio = data.hora_inicio ?? data.horaInicio ?? null;
  const horaFin = data.hora_fin ?? data.horaFin ?? null;
  return {
    ficha: data.ficha ? data.ficha.trim() : null,
    documento: data.documento.trim(),
    dias_semana: dias,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
  };
});

// Schema para compatibilidad con formato antiguo (un solo usuario en el nivel raíz)
const schemaFormatoAntiguo = z.object({
  placa: z.string().min(1, 'La placa del equipo es obligatoria').max(100, 'La placa no puede exceder 100 caracteres'),
  ambiente: z.union([
    z.string().min(1, 'El código del ambiente es obligatorio').max(50, 'El código del ambiente no puede exceder 50 caracteres'),
    z.number().int().positive('El código del ambiente debe ser un número positivo')
  ]).transform(val => String(val)),
  // Campos de usuario en el nivel raíz (formato antiguo)
  ficha: z.string().min(1, 'La ficha es obligatoria').max(50, 'La ficha no puede exceder 50 caracteres').optional().nullable(),
  documento: z.string().min(5, 'El documento de identificación debe tener al menos 5 caracteres').max(20, 'El documento no puede exceder 20 caracteres'),
  // CAMPOS DESACTIVADOS - No se reciben desde página externa
  // dias_semana, diasSemana, hora_inicio, horaInicio, hora_fin, horaFin
}).transform((data) => {
  // Convertir formato antiguo a formato nuevo (con array de usuarios)
  return {
    placa: data.placa,
    ambiente: data.ambiente,
    usuarios: [{
      ficha: data.ficha ? data.ficha.trim() : null,
      documento: data.documento,
    }]
  };
});

// Schema para formato nuevo (array de usuarios). Ambiente opcional para uso desde web/app con auth.
const schemaFormatoNuevo = z.object({
  placa: z.string().min(1, 'La placa del equipo es obligatoria').max(100, 'La placa no puede exceder 100 caracteres'),
  ambiente: z.union([
    z.string().min(1).max(50),
    z.number().int().positive()
  ]).transform(val => String(val)).optional().nullable(),
  usuarios: z.union([
    z.array(usuarioExternoSchema).min(1, 'Debe haber al menos un usuario').max(50, 'No se pueden registrar más de 50 usuarios a la vez'),
    z.string().transform((val) => {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        throw new z.ZodError([{
          code: 'custom',
          path: ['usuarios'],
          message: 'usuarios debe ser un array válido o un string JSON válido'
        }]);
      }
    }).pipe(z.array(usuarioExternoSchema).min(1, 'Debe haber al menos un usuario').max(50, 'No se pueden registrar más de 50 usuarios a la vez'))
  ]),
});

// Schema que acepta ambos formatos. Se prueba primero el formato nuevo (usuarios array) para evitar fallar por documento faltante en raíz.
export const registrarUsoEquipoExternoSchema = z.union([
  schemaFormatoNuevo,
  schemaFormatoAntiguo
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

