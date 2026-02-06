import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta donde se almacenarán las imágenes
const uploadsDir = path.join(__dirname, '../../uploads/equipos');

// Crear el directorio si no existe
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre único: timestamp-codigo_equipo-nombre_original
    const codigoEquipo = req.params.codigoEquipo || req.body.codigo_equipo || 'temp';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${timestamp}-${codigoEquipo}-${sanitizedName}${ext}`;
    cb(null, filename);
  },
});

import { validateImageFile } from './fileValidation.js';

// Filtro de archivos: solo imágenes (usando validación mejorada)
const fileFilter = (req, file, cb) => {
  const validation = validateImageFile(file);
  if (validation.valid) {
    cb(null, true);
  } else {
    cb(new Error(validation.error), false);
  }
};

// Filtro de archivos para endpoint público: solo imágenes (usando validación mejorada)
const fileFilterPublico = (req, file, cb) => {
  const validation = validateImageFile(file);
  if (validation.valid) {
    cb(null, true);
  } else {
    cb(new Error(validation.error), false);
  }
};

// Configuración de Multer
export const uploadEquipoImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo (mejorado desde 5MB)
  },
});

// Middleware para manejar errores de Multer
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. Tamaño máximo: 10MB' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Demasiados archivos. Máximo permitido: 10' });
    }
    return res.status(400).json({ error: `Error al subir archivo: ${err.message}` });
  }
  
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  
  next();
};

// Función para obtener la ruta relativa de la imagen
export const getImagePath = (filename) => {
  return `/uploads/equipos/${filename}`;
};

// Función para eliminar archivo físico
export const deleteImageFile = (filename) => {
  const filePath = path.join(uploadsDir, filename);
  
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      logger.error('Error al eliminar archivo', { error: error.message, filename });
      return false;
    }
  }
  return false;
};

// Configuración de Multer para endpoint público (verificación de ambiente / asignación aprendices)
// Usa un nombre temporal y luego se renombra en el controlador con el codigo_equipo
const storagePublico = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre temporal único: timestamp-random-nombre_original
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${timestamp}-${random}-${sanitizedName}${ext}`;
    cb(null, filename);
  },
});

// Configuración de Multer para endpoint público
export const uploadEquipoImagePublico = multer({
  storage: storagePublico,
  fileFilter: fileFilterPublico,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo (mejorado desde 5MB)
    files: 10, // Máximo 10 imágenes
  },
});

