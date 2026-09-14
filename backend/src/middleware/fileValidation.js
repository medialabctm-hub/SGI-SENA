import fs from 'fs/promises';
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

const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
];

const EXCEL_MIME_EXTENSIONS = {
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsx'],
};

const IMAGE_MIME_EXTENSIONS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
};

const imageMimeFromSignature = (bytes) => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a')) return 'image/gif';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
};

/**
 * Validates image bytes after Multer writes the temporary file and before
 * database persistence. Buffers keep this testable without touching uploads.
 */
export async function validateImageContent(file) {
  if (!file?.buffer && !file?.path) return { valid: true };

  const bytes = file.buffer
    ? file.buffer.subarray(0, 12)
    : (await fs.readFile(file.path)).subarray(0, 12);
  const actualMime = imageMimeFromSignature(bytes);
  const expectedMimes = file.mimetype === 'image/jpg' ? ['image/jpeg'] : [file.mimetype];

  if (!actualMime || !expectedMimes.includes(actualMime)) {
    return { valid: false, error: 'El contenido del archivo no coincide con el tipo MIME declarado' };
  }
  return { valid: true };
}


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

  if (!IMAGE_MIME_EXTENSIONS[file.mimetype].includes(extension)) {
    return { valid: false, error: 'El tipo MIME no coincide con la extensión del archivo' };
  }

  // Validar que el nombre del archivo no contenga caracteres peligrosos
  const dangerousChars = /[<>:"/\\|?*]/;
  const hasControlCharacter = [...file.originalname].some(character => character.charCodeAt(0) < 0x20);
  if (dangerousChars.test(file.originalname) || hasControlCharacter) {
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

  if (!EXCEL_MIME_EXTENSIONS[file.mimetype].includes(extension)) {
    return { valid: false, error: 'El tipo MIME no coincide con la extensión del archivo' };
  }

  // Validar que el nombre del archivo no contenga caracteres peligrosos
  const dangerousChars = /[<>:"/\\|?*]/;
  const hasControlCharacter = [...file.originalname].some(character => character.charCodeAt(0) < 0x20);
  if (dangerousChars.test(file.originalname) || hasControlCharacter) {
    return { valid: false, error: 'El nombre del archivo contiene caracteres no permitidos' };
  }

  if (Buffer.isBuffer(file.buffer)) {
    return validateExcelBuffer(file, extension);
  }

  return { valid: true };
}

function detectExcelContainer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  if (buffer.length >= OLE_SIGNATURE.length && buffer.subarray(0, OLE_SIGNATURE.length).equals(OLE_SIGNATURE)) {
    return 'ole';
  }
  if (ZIP_SIGNATURES.some(signature => buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature))) {
    return 'zip';
  }
  return null;
}

function validateExcelBuffer(file, extension, buffer = file.buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, error: 'El archivo Excel está vacío o no se pudo leer correctamente' };
  }

  const container = detectExcelContainer(buffer);
  const expectedContainer = extension === '.xls' ? 'ole' : 'zip';
  if (container !== expectedContainer) {
    return { valid: false, error: 'El contenido del archivo no coincide con la extensión de Excel declarada' };
  }

  return { valid: true };
}

/**
 * Valida la firma del archivo después de que Multer haya materializado el
 * buffer. El fileFilter solo puede validar metadatos porque todavía no tiene
 * acceso al contenido del stream.
 */
export async function validateExcelContent(file) {
  if (!file) {
    return { valid: false, error: 'No se proporcionó ningún archivo Excel' };
  }

  const extension = file.originalname?.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (Buffer.isBuffer(file.buffer)) {
    return validateExcelBuffer(file, extension);
  }

  if (!file.path) {
    return { valid: false, error: 'El archivo Excel está vacío o no se pudo leer correctamente' };
  }

  try {
    const buffer = await fs.readFile(file.path);
    return validateExcelBuffer(file, extension, buffer);
  } catch {
    return { valid: false, error: 'El archivo Excel está vacío o no se pudo leer correctamente' };
  }
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
export async function validateExcel(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No se proporcionó ningún archivo Excel'
    });
  }

  const validation = validateExcelFile(req.file);
  if (!validation.valid) {
    logger.warn('Validación de archivo Excel fallida', { 
      error: validation.error
    });
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }

  const contentValidation = await validateExcelContent(req.file);
  if (!contentValidation.valid) {
    logger.warn('Validación de archivo Excel fallida', {
      error: contentValidation.error
    });
    return res.status(400).json({
      success: false,
      error: contentValidation.error
    });
  }

  next();
}

