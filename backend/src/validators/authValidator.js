import { z } from 'zod';
import { TIPOS_DOCUMENTO } from '../config/documentTypes.js';

/**
 * Validadores para las rutas de autenticación
 */

/**
 * Política de contraseñas (H-10): mín. 8, máx. 128 y complejidad
 * (minúscula, mayúscula, número y carácter especial). Alineada con
 * PasswordValidationStrategy (fuente de verdad en el servicio) para que la
 * validación de la ruta falle rápido con el mismo criterio.
 */
export const passwordPolicySchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña no debe superar los 128 caracteres')
  .regex(/[a-z]/, 'La contraseña debe incluir al menos una letra minúscula')
  .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número')
  .regex(/[^A-Za-z0-9]/, 'La contraseña debe incluir al menos un carácter especial');

export const registerSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  cedula: z.string().min(5, 'La cédula debe tener al menos 5 caracteres').max(20),
  tipo_documento: z.enum(TIPOS_DOCUMENTO, {
    errorMap: () => ({ message: 'Tipo de documento inválido. Debe ser: TI, CC, CE, PPT u Otro' }),
  }).optional().default('CC'),
  tipo_documento_otro: z.string().max(50).optional().nullable(),
  correo: z.string().email('Correo electrónico inválido').toLowerCase(),
  telefono: z.string().min(7, 'El teléfono debe tener al menos 7 caracteres').max(20),
  contrasena: passwordPolicySchema,
  rol: z.enum(['Administrador', 'Instructor', 'Aprendiz', 'Cuentadante'], {
    errorMap: () => ({ message: 'Rol inválido' }),
  }),
  codigo_invitacion: z.string().optional().nullable(),
}).refine((data) => {
  // Instructor / Administrador / Cuentadante: invitación obligatoria (sin cambio).
  // Aprendiz: NO se exige aquí. El servicio aplica el gate H-03/MDL-202
  // (código de invitación O cédula presente en roster Aprendices); la
  // comprobación de roster es asíncrona y no cabe en Zod.
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

