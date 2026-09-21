import fs from 'fs';
import path from 'path';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import {
  isSafeEvidenceFilename,
  getImageFilePath,
} from '../middleware/uploadMiddleware.js';
import { EVIDENCE_IMAGE_EXTENSIONS } from '../validators/imagenesEquipoValidator.js';

/**
 * Resuelve la ruta absoluta de un archivo de evidencia de equipo.
 * Lanza errores de dominio controlados (400/404) en lugar de Error genéricos
 * que podrían escapar como 500 / uncaught.
 *
 * @param {string} filename
 * @returns {string} ruta absoluta dentro del directorio de uploads/equipos
 */
export function resolveEvidenceImagePath(filename) {
  if (!isSafeEvidenceFilename(filename)) {
    throw new ValidationError('Nombre de archivo de evidencia no válido');
  }

  const ext = path.extname(filename).toLowerCase();
  if (!EVIDENCE_IMAGE_EXTENSIONS.includes(ext)) {
    throw new ValidationError('El archivo solicitado no es una imagen permitida');
  }

  const absolutePath = getImageFilePath(filename);
  if (!absolutePath) {
    throw new ValidationError('Nombre de archivo de evidencia no válido');
  }

  if (!fs.existsSync(absolutePath)) {
    throw new NotFoundError('Imagen');
  }

  return absolutePath;
}

/**
 * Envía un archivo de evidencia con callback de error controlado
 * (evita que sendFile tumbe el proceso o exponga rutas internas).
 *
 * @param {import('express').Response} res
 * @param {string} absolutePath
 */
export function sendEvidenceImage(res, absolutePath) {
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(absolutePath, { dotfiles: 'deny' }, (err) => {
    if (!err || res.headersSent) return undefined;
    const status = err.statusCode === 404 ? 404 : 500;
    return res.status(status).json({
      success: false,
      error: status === 404 ? 'Imagen no encontrada' : 'Error al obtener la imagen',
    });
  });
}
