import { z } from 'zod';
import { TIPOS_DOCUMENTO } from '../config/documentTypes.js';

/**
 * Validadores para las rutas de autenticación
 */

export const registerSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  cedula: z.string().min(5, 'La cédula debe tener al menos 5 caracteres').max(20),
  tipo_documento: z.enum(TIPOS_DOCUMENTO, {
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

// El login de escritorio conserva su contrato de identidad existente; solo
// limita la entrada antes de llegar al controlador y al servicio de auth.
export const loginPlacaSchema = z.object({
  cedula: z.string().trim().min(1, 'La cédula es requerida').max(20, 'La cédula es demasiado larga'),
  contrasena: z.string().min(1, 'La contraseña es requerida').max(200, 'La contraseña es demasiado larga'),
  placa: z.string().trim().min(1, 'La placa es requerida').max(50, 'La placa es demasiado larga'),
});

export const updateUserSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  cedula: z.string().min(5).max(20).optional(),
  tipo_documento: z.enum(TIPOS_DOCUMENTO).optional(),
  tipo_documento_otro: z.string().max(50).optional().nullable(),
  correo: z.string().email().toLowerCase().optional(),
  telefono: z.string().min(7).max(20).optional(),
  rol: z.enum(['Administrador', 'Instructor', 'Aprendiz', 'Cuentadante']).optional(),
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

export { validate } from '../middleware/validate.js';

