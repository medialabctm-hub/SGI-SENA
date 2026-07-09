import express from 'express';
import {
  subirImagenesEquipo,
  listarImagenesEquipo,
  obtenerImagenEquipo,
  eliminarImagenEquipo,
  marcarImagenPrincipal,
  actualizarImagenEquipo,
} from '../controller/imagenesEquipoController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission, requireAnyPermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter.js';
import { uploadEquipoImage, handleUploadError } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// ============================================
// RUTAS DE IMÁGENES DE EQUIPOS
// ============================================

// Subir una o múltiples imágenes para un equipo
// POST /api/equipos/:codigoEquipo/imagenes
router.post(
  '/:codigoEquipo/imagenes',
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  uploadEquipoImage.array('imagenes', 10), // Máximo 10 imágenes
  handleUploadError,
  subirImagenesEquipo
);

// Listar todas las imágenes de un equipo
// GET /api/equipos/:codigoEquipo/imagenes
router.get(
  '/:codigoEquipo/imagenes',
  authenticate,
  readLimiter,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_OWN,
  ]),
  listarImagenesEquipo
);

// Obtener una imagen específica
// GET /api/equipos/imagenes/:idImagen
router.get(
  '/imagenes/:idImagen',
  authenticate,
  readLimiter,
  requireAnyPermission([
    PERMISSIONS.EQUIPOS.VIEW,
    PERMISSIONS.EQUIPOS.VIEW_OWN,
  ]),
  obtenerImagenEquipo
);

// Actualizar información de una imagen
// PUT /api/equipos/imagenes/:idImagen
router.put(
  '/imagenes/:idImagen',
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  actualizarImagenEquipo
);

// Marcar una imagen como principal
// PATCH /api/equipos/imagenes/:idImagen/principal
router.patch(
  '/imagenes/:idImagen/principal',
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  marcarImagenPrincipal
);

// Eliminar una imagen
// DELETE /api/equipos/imagenes/:idImagen
router.delete(
  '/imagenes/:idImagen',
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  eliminarImagenEquipo
);

export default router;

