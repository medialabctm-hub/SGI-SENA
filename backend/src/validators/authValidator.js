import { z } from 'zod';

/**
 * Validadores para las rutas de autenticación
 */

export const registerSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  cedula: z.string().min(5, 'La cédula debe tener al menos 5 caracteres').max(20),
  tipo_documento: z.enum(['TI', 'CC', 'CE', 'PPT', 'Otro'], {
    errorMap: () => ({ message: 'Tipo de documento inválido. Debe ser: TI, CC, CE, PPT u Otro' }),
  }).optional().default('CC'),
  tipo_documento_otro: z.string().max(50).optional().nullable(),
  correo: z.string().email('Correo electrónico inválido').toLowerCase(),
  telefono: z.string().min(7, 'El teléfono debe tener al menos 7 caracteres').max(20),
  contrasena: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rol: z.enum(['Administrador', 'Instructor', 'Aprendiz', 'Cuentadante'], {
    errorMap: () => ({ message: 'Rol inválido' }),
  }),
  codigo_invitacion: z.string().optional().nullable(),
}).refine((data) => {
  // Si el rol es Instructor, Administrador o Cuentadante, el código de invitación es requerido
  if ((data.rol === 'Instructor' || data.rol === 'Administrador' || data.rol === 'Cuentadante') && !data.codigo_invitacion) {
    return false;
  }
  return true;
}, {
  message: 'El código de invitación es requerido para registrarse como Instructor, Administrador o Cuentadante',
  path: ['codigo_invitacion'],
}).refine((data) => {
  // Si tipo_documento es "Otro", tipo_documento_otro es requerido
  if (data.tipo_documento === 'Otro' && (!data.tipo_documento_otro || data.tipo_documento_otro.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'Debe especificar el tipo de documento cuando selecciona "Otro"',
  path: ['tipo_documento_otro'],
});

export const loginSchema = z.object({
  cedula: z.string().min(1, 'La cédula es requerida'),
  contrasena: z.string().min(1, 'La contraseña es requerida'),
});

export const updateUserSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  cedula: z.string().min(5).max(20).optional(),
  tipo_documento: z.enum(['TI', 'CC', 'CE', 'PPT', 'Otro']).optional(),
  tipo_documento_otro: z.string().max(50).optional().nullable(),
  correo: z.string().email().toLowerCase().optional(),
  telefono: z.string().min(7).max(20).optional(),
  rol: z.enum(['Administrador', 'Instructor', 'Aprendiz']).optional(),
}).refine((data) => {
  // Si tipo_documento es "Otro", tipo_documento_otro es requerido
  if (data.tipo_documento === 'Otro' && (!data.tipo_documento_otro || data.tipo_documento_otro.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'Debe especificar el tipo de documento cuando selecciona "Otro"',
  path: ['tipo_documento_otro'],
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

