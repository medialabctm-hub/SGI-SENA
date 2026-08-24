import express from 'express';
import {
  subirImagenesEquipo,
  listarImagenesEquipo,
  obtenerImagenEquipo,
  eliminarImagenEquipo,
  marcarImagenPrincipal,
  actualizarImagenEquipo,
  descargarImagenEquipo,
} from '../controller/imagenesEquipoController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission, requireAnyPermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter.js';
import { uploadEquipoImage, handleUploadError, validateUploadedImageContent } from '../middleware/uploadMiddleware.js';
import { requireEquipmentEvidenceScope, resolveCodigoEquipoFromImage } from '../middleware/equipmentEvidenceScope.js';

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
  requireEquipmentEvidenceScope(),
  uploadEquipoImage.array('imagenes', 10), // Máximo 10 imágenes
  handleUploadError,
  validateUploadedImageContent,
  subirImagenesEquipo
);

// The file itself is private: URLs returned by the API are protected and the
// static /uploads mount explicitly refuses the equipment directory.
router.get(
  '/imagenes/archivo/:filename',
  authenticate,
  readLimiter,
  requireAnyPermission([PERMISSIONS.EQUIPOS.VIEW, PERMISSIONS.EQUIPOS.VIEW_OWN]),
  requireEquipmentEvidenceScope({
    resolveCodigoEquipo: async (req) => {
      const { default: db } = await import('../config/dbconfig.js');
      const [[image]] = await db.execute(
        'SELECT codigo_equipo FROM Imagenes_Equipo WHERE nombre_archivo = ? LIMIT 1',
        [req.params.filename]
      );
      return image?.codigo_equipo;
    },
  }),
  descargarImagenEquipo
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
  requireEquipmentEvidenceScope(),
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
  requireEquipmentEvidenceScope({ resolveCodigoEquipo: resolveCodigoEquipoFromImage }),
  obtenerImagenEquipo
);

// Actualizar información de una imagen
// PUT /api/equipos/imagenes/:idImagen
router.put(
  '/imagenes/:idImagen',
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  requireEquipmentEvidenceScope({ resolveCodigoEquipo: resolveCodigoEquipoFromImage }),
  actualizarImagenEquipo
);

// Marcar una imagen como principal
// PATCH /api/equipos/imagenes/:idImagen/principal
router.patch(
  '/imagenes/:idImagen/principal',
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  requireEquipmentEvidenceScope({ resolveCodigoEquipo: resolveCodigoEquipoFromImage }),
  marcarImagenPrincipal
);

// Eliminar una imagen
// DELETE /api/equipos/imagenes/:idImagen
router.delete(
  '/imagenes/:idImagen',
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  requireEquipmentEvidenceScope({ resolveCodigoEquipo: resolveCodigoEquipoFromImage }),
  eliminarImagenEquipo
);

export default router;

