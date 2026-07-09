import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta donde se almacenarán las fotos de perfil
const profilesDir = path.join(__dirname, '../../uploads/perfiles');

// Crear el directorio si no existe
if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilesDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre único: timestamp-id_usuario-nombre_original
    const userId = req.user?.id_usuario || req.params.id || 'temp';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${timestamp}-${userId}-${sanitizedName}${ext}`;
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

// Configuración de Multer para foto de perfil (una sola imagen)
export const uploadProfileImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Middleware para manejar errores de Multer
export const handleProfileUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. Tamaño máximo: 10MB' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Solo se permite una imagen de perfil' });
    }
    return res.status(400).json({ error: `Error al subir archivo: ${err.message}` });
  }
  
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  
  next();
};

// Función para obtener la ruta relativa de la foto de perfil
export const getProfileImagePath = (filename) => {
  return `/uploads/perfiles/${filename}`;
};

// Función para eliminar archivo físico de foto de perfil
export const deleteProfileImageFile = (filename) => {
  if (!filename) return false;
  
  // Extraer solo el nombre del archivo si viene con ruta completa
  const fileNameOnly = filename.includes('/') ? filename.split('/').pop() : filename;
  const filePath = path.join(profilesDir, fileNameOnly);
  
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      logger.info('Foto de perfil eliminada', { filename: fileNameOnly });
      return true;
    } catch (error) {
      logger.error('Error al eliminar foto de perfil', { error: error.message, filename: fileNameOnly });
      return false;
    }
  }
  return false;
};

