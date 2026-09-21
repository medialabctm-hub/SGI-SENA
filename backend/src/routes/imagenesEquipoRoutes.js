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
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateParams } from '../middleware/validate.js';
import {
  evidenceFilenameParamSchema,
  idImagenParamSchema,
  codigoEquipoParamSchema,
} from '../validators/imagenesEquipoValidator.js';
import defaultDb from '../config/dbconfig.js';

const router = express.Router();

async function resolveCodigoEquipoFromFilename(req) {
  const [[image]] = await defaultDb.execute(
    'SELECT codigo_equipo FROM Imagenes_Equipo WHERE nombre_archivo = ? LIMIT 1',
    [req.params.filename]
  );
  return image?.codigo_equipo;
}

// ============================================
// RUTAS DE IMÁGENES DE EQUIPOS
// Arquitectura: Route → Middleware → Validator → Controller → Service
// ============================================

// Subir una o múltiples imágenes para un equipo
// POST /api/equipos/:codigoEquipo/imagenes
router.post(
  '/:codigoEquipo/imagenes',
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  validateParams(codigoEquipoParamSchema),
  requireEquipmentEvidenceScope(),
  uploadEquipoImage.array('imagenes', 10), // Máximo 10 imágenes
  handleUploadError,
  asyncHandler(validateUploadedImageContent),
  asyncHandler(subirImagenesEquipo)
);

// The file itself is private: URLs returned by the API are protected and the
// static /uploads mount explicitly refuses the equipment directory.
router.get(
  '/imagenes/archivo/:filename',
  authenticate,
  readLimiter,
  requireAnyPermission([PERMISSIONS.EQUIPOS.VIEW, PERMISSIONS.EQUIPOS.VIEW_OWN]),
  validateParams(evidenceFilenameParamSchema),
  requireEquipmentEvidenceScope({
    resolveCodigoEquipo: resolveCodigoEquipoFromFilename,
  }),
  asyncHandler(descargarImagenEquipo)
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
  validateParams(codigoEquipoParamSchema),
  requireEquipmentEvidenceScope(),
  asyncHandler(listarImagenesEquipo)
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
  validateParams(idImagenParamSchema),
  requireEquipmentEvidenceScope({ resolveCodigoEquipo: resolveCodigoEquipoFromImage }),
  asyncHandler(obtenerImagenEquipo)
);

// Actualizar información de una imagen
// PUT /api/equipos/imagenes/:idImagen
router.put(
  '/imagenes/:idImagen',
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  validateParams(idImagenParamSchema),
  requireEquipmentEvidenceScope({ resolveCodigoEquipo: resolveCodigoEquipoFromImage }),
  asyncHandler(actualizarImagenEquipo)
);

// Marcar una imagen como principal
// PATCH /api/equipos/imagenes/:idImagen/principal
router.patch(
  '/imagenes/:idImagen/principal',
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  validateParams(idImagenParamSchema),
  requireEquipmentEvidenceScope({ resolveCodigoEquipo: resolveCodigoEquipoFromImage }),
  asyncHandler(marcarImagenPrincipal)
);

// Eliminar una imagen
// DELETE /api/equipos/imagenes/:idImagen
router.delete(
  '/imagenes/:idImagen',
  authenticate,
  writeLimiter,
  requirePermission(PERMISSIONS.EQUIPOS.UPDATE),
  validateParams(idImagenParamSchema),
  requireEquipmentEvidenceScope({ resolveCodigoEquipo: resolveCodigoEquipoFromImage }),
  asyncHandler(eliminarImagenEquipo)
);

export default router;
