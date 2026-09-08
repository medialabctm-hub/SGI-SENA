import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import { validateImageContent, validateImageFile } from './fileValidation.js';

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
  if (err) {
    const files = req.files || (req.file ? [req.file] : []);
    files.forEach((file) => {
      if (file?.filename) deleteImageFile(file.filename);
    });
  }
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
  if (!isSafeEvidenceFilename(filename)) {
    throw new Error('Nombre de archivo de evidencia no válido');
  }
  return `/api/equipos/imagenes/archivo/${encodeURIComponent(filename)}`;
};

export const isSafeEvidenceFilename = (filename) => (
  typeof filename === 'string'
  && filename.length > 0
  && path.basename(filename) === filename
  && !filename.includes('..')
  && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)
);

export const getImageFilePath = (filename) => {
  if (!isSafeEvidenceFilename(filename)) {
    throw new Error('Nombre de archivo de evidencia no válido');
  }
  return path.join(uploadsDir, filename);
};

// Prefijo legado: antes de la migración de seguridad (commit 2ddeb3f), getImagePath()
// devolvía rutas estáticas públicas bajo /uploads/equipos/. Esas rutas ya no se sirven
// (app.js solo atiende /uploads/ambientes y /uploads/perfiles mediante handlers
// autenticados) por lo que cualquier fila de Imagenes_Equipo insertada antes de
// ese cambio sigue apuntando a una URL muerta.
const LEGACY_RUTA_IMAGEN_PREFIX = '/uploads/equipos/';

/**
 * Reescribe los valores legados de Imagenes_Equipo.ruta_imagen (formato estático público
 * /uploads/equipos/<archivo>) al formato de endpoint autenticado actual devuelto por
 * getImagePath(). Idempotente: solo toca filas cuyo prefijo coincide con el formato legado,
 * por lo que ejecutarla repetidamente (p. ej. en cada arranque) no tiene efecto tras la
 * primera pasada exitosa.
 */
export const backfillLegacyEquipoImagePaths = async (db) => {
  const [filasLegadas] = await db.execute(
    `SELECT id_imagen_equipo, nombre_archivo FROM Imagenes_Equipo WHERE ruta_imagen LIKE ?`,
    [`${LEGACY_RUTA_IMAGEN_PREFIX}%`]
  );

  if (!filasLegadas || filasLegadas.length === 0) {
    return { migradas: 0, omitidas: 0 };
  }

  let migradas = 0;
  let omitidas = 0;

  for (const fila of filasLegadas) {
    const { id_imagen_equipo: idImagen, nombre_archivo: nombreArchivo } = fila;

    if (!isSafeEvidenceFilename(nombreArchivo)) {
      omitidas += 1;
      logger.warn('No se pudo migrar ruta_imagen legada: nombre_archivo inválido', {
        id_imagen_equipo: idImagen,
        nombre_archivo: nombreArchivo,
      });
      continue;
    }

    const nuevaRuta = getImagePath(nombreArchivo);
    await db.execute(
      'UPDATE Imagenes_Equipo SET ruta_imagen = ? WHERE id_imagen_equipo = ?',
      [nuevaRuta, idImagen]
    );
    migradas += 1;
  }

  logger.info('Backfill de ruta_imagen legada completado', { migradas, omitidas });
  return { migradas, omitidas };
};

// Función para eliminar archivo físico
export const deleteImageFile = (filename) => {
  if (!isSafeEvidenceFilename(filename)) return false;
  const filePath = getImageFilePath(filename);
  
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

export const validateUploadedImageContent = async (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);
  for (const file of files) {
    const validation = await validateImageContent(file);
    if (!validation.valid) {
      files.forEach((uploadedFile) => {
        if (uploadedFile?.filename) deleteImageFile(uploadedFile.filename);
      });
      return res.status(400).json({ error: validation.error });
    }
  }
  return next();
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

