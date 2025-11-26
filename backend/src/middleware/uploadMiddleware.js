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

// Filtro de archivos: solo imágenes
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, GIF, WEBP)'), false);
  }
};

// Configuración de Multer
export const uploadEquipoImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
  },
});

// Middleware para manejar errores de Multer
export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. Tamaño máximo: 5MB' });
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

