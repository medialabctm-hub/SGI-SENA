import { z } from 'zod';
import path from 'path';

/** Extensiones de imagen permitidas al servir evidencias de equipo. */
export const EVIDENCE_IMAGE_EXTENSIONS = Object.freeze([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]);

/**
 * Nombre de archivo de evidencia: basename seguro + extensión de imagen.
 * Rechaza path traversal, separadores y nombres no-imagen antes del controlador.
 */
export const evidenceFilenameParamSchema = z.object({
  filename: z
    .string({ required_error: 'Nombre de archivo requerido' })
    .min(1, 'Nombre de archivo requerido')
    .max(255, 'Nombre de archivo demasiado largo')
    .refine(
      (value) => value === path.basename(value) && !value.includes('..') && !path.isAbsolute(value),
      { message: 'Nombre de archivo de evidencia no válido' }
    )
    .refine(
      (value) => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value),
      { message: 'Nombre de archivo de evidencia no válido' }
    )
    .refine(
      (value) => EVIDENCE_IMAGE_EXTENSIONS.includes(path.extname(value).toLowerCase()),
      { message: 'El archivo solicitado no es una imagen permitida' }
    ),
});

export const idImagenParamSchema = z.object({
  idImagen: z
    .string({ required_error: 'ID de imagen requerido' })
    .regex(/^\d+$/, 'ID de imagen inválido'),
});

export const codigoEquipoParamSchema = z.object({
  codigoEquipo: z
    .string({ required_error: 'Código de equipo requerido' })
    .regex(/^\d+$/, 'Código de equipo inválido'),
});
