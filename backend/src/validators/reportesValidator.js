import { z } from 'zod';

/**
 * Validadores para las rutas de reportes
 */

// Debe coincidir con el ENUM de la tabla Reportes en BD (SGI_SENA.sql)
const tiposReporteValidos = [
  'General',
  'Equipos',
  'Mantenimiento',
  'Novedades',
  'Uso',
  'Otro'
];

// Normaliza tipo_reporte: trim y coincidencia insensible a mayúsculas (p. ej. app Flutter envía "general" -> "General")
function normalizarTipoReporte(val) {
  if (val == null || typeof val !== 'string') return val;
  const trimmed = val.trim();
  const found = tiposReporteValidos.find((t) => t.toLowerCase() === trimmed.toLowerCase());
  return found ?? trimmed;
}

export const crearReporteSchema = z.object({
  // codigo_equipo es opcional (puede ser reporte general o específico de equipo). "" se normaliza a undefined.
  codigo_equipo: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.union([
      z.string().min(1),
      z.number().int().positive()
    ]).optional()
  ),
  tipo_reporte: z.preprocess(
    normalizarTipoReporte,
    z.enum(tiposReporteValidos, {
      error: `Tipo de reporte inválido. Tipos válidos: ${tiposReporteValidos.join(', ')}`,
    })
  ),
  titulo: z.string()
    .min(5, 'El título debe tener al menos 5 caracteres')
    .max(200, 'El título no puede exceder 200 caracteres'),
  descripcion: z.string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(5000, 'La descripción no puede exceder 5000 caracteres'),
  prioridad: z.enum(['Baja', 'Media', 'Alta', 'Urgente']).optional().default('Media'),
});

export const actualizarReporteSchema = z.object({
  tipo_reporte: z.enum(tiposReporteValidos).optional(),
  titulo: z.string().min(5).max(200).optional(),
  descripcion: z.string().min(10).max(5000).optional(),
  prioridad: z.enum(['Baja', 'Media', 'Alta', 'Urgente']).optional(),
  estado: z.enum(['Pendiente', 'En Proceso', 'Resuelto', 'Cerrado']).optional(),
  observaciones: z.string().max(2000).optional().nullable(),
});

/**
 * Middleware de validación genérico
 */
// Normaliza body para APIs que envían camelCase (p. ej. Flutter): tipoReporte -> tipo_reporte
function normalizarBodyReportes(body) {
  if (!body || typeof body !== 'object') return body;
  const normalized = { ...body };
  if (normalized.tipo_reporte === undefined && normalized.tipoReporte !== undefined) {
    normalized.tipo_reporte = normalized.tipoReporte;
  }
  return normalized;
}

export const validate = (schema) => (req, res, next) => {
  try {
    const body = normalizarBodyReportes(req.body);
    const validated = schema.parse(body);
    req.body = validated;
    next();
  } catch (error) {
    if (error instanceof z.ZodError && error.issues && Array.isArray(error.issues)) {
      const details = error.issues.map((e) => ({
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

