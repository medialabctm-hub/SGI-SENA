import { logger } from '../utils/logger.js';

/**
 * Middleware para validar archivos subidos
 * Mejora la seguridad validando tipos MIME, extensiones y tamaños
 */

// Tipos MIME permitidos para imágenes
const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

// Tipos MIME permitidos para Excel
const ALLOWED_EXCEL_MIMES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12'
];

// Extensiones permitidas
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_EXCEL_EXTENSIONS = ['.xls', '.xlsx'];

// Tamaños máximos (en bytes)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_EXCEL_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Valida un archivo de imagen
 * @param {Object} file - Archivo de multer
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'No se proporcionó ningún archivo' };
  }

  // Validar tamaño
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `El archivo excede el tamaño máximo de ${MAX_IMAGE_SIZE / 1024 / 1024} MB` };
  }

  // Validar tipo MIME
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    return { valid: false, error: 'Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG, GIF, WEBP)' };
  }

  // Validar extensión
  const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
    return { valid: false, error: 'Extensión de archivo no permitida' };
  }

  // Validar que el nombre del archivo no contenga caracteres peligrosos
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (dangerousChars.test(file.originalname)) {
    return { valid: false, error: 'El nombre del archivo contiene caracteres no permitidos' };
  }

  return { valid: true };
}

/**
 * Valida un archivo de Excel
 * @param {Object} file - Archivo de multer
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateExcelFile(file) {
  if (!file) {
    return { valid: false, error: 'No se proporcionó ningún archivo' };
  }

  // Validar tamaño
  if (file.size > MAX_EXCEL_SIZE) {
    return { valid: false, error: `El archivo excede el tamaño máximo de ${MAX_EXCEL_SIZE / 1024 / 1024} MB` };
  }

  // Validar tipo MIME
  if (!ALLOWED_EXCEL_MIMES.includes(file.mimetype)) {
    return { valid: false, error: 'Tipo de archivo no permitido. Solo se permiten archivos Excel (.xls, .xlsx)' };
  }

  // Validar extensión
  const extension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (!ALLOWED_EXCEL_EXTENSIONS.includes(extension)) {
    return { valid: false, error: 'Extensión de archivo no permitida. Solo se permiten .xls y .xlsx' };
  }

  // Validar que el nombre del archivo no contenga caracteres peligrosos
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (dangerousChars.test(file.originalname)) {
    return { valid: false, error: 'El nombre del archivo contiene caracteres no permitidos' };
  }

  return { valid: true };
}

/**
 * Middleware para validar múltiples archivos de imagen
 */
export function validateMultipleImages(req, res, next) {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  const errors = [];
  for (const file of req.files) {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      errors.push({ filename: file.originalname, error: validation.error });
    }
  }

  if (errors.length > 0) {
    logger.warn('Validación de archivos fallida', { errors, userId: req.user?.id });
    return res.status(400).json({
      success: false,
      error: 'Uno o más archivos no son válidos',
      details: errors
    });
  }

  next();
}

/**
 * Middleware para validar archivo Excel
 */
export function validateExcel(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No se proporcionó ningún archivo Excel'
    });
  }

  const validation = validateExcelFile(req.file);
  if (!validation.valid) {
    logger.warn('Validación de archivo Excel fallida', { 
      error: validation.error, 
      filename: req.file.originalname,
      userId: req.user?.id 
    });
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }

  next();
}

