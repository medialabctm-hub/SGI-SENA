import express from 'express';
import {
  subirImagenesAmbiente,
  listarImagenesAmbiente,
  obtenerImagenAmbiente,
  actualizarImagenAmbiente,
  marcarImagenPrincipal,
  eliminarImagenAmbiente
} from '../controller/imagenesAmbienteController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { uploadAmbienteImage, handleUploadError } from '../middleware/uploadAmbienteMiddleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Subir imágenes para un ambiente
router.post(
  '/ambientes/:idAmbiente/imagenes',
  requirePermission(PERMISSIONS.AMBIENTES.UPDATE),
  uploadAmbienteImage.array('imagenes', 10),
  handleUploadError,
  subirImagenesAmbiente
);

// Listar todas las imágenes de un ambiente
router.get(
  '/ambientes/:idAmbiente/imagenes',
  requirePermission(PERMISSIONS.AMBIENTES.VIEW),
  listarImagenesAmbiente
);

// Obtener una imagen específica
router.get(
  '/ambientes/imagenes/:idImagen',
  requirePermission(PERMISSIONS.AMBIENTES.VIEW),
  obtenerImagenAmbiente
);

// Actualizar información de una imagen
router.put(
  '/ambientes/imagenes/:idImagen',
  requirePermission(PERMISSIONS.AMBIENTES.UPDATE),
  actualizarImagenAmbiente
);

// Marcar una imagen como principal
router.patch(
  '/ambientes/imagenes/:idImagen/principal',
  requirePermission(PERMISSIONS.AMBIENTES.UPDATE),
  marcarImagenPrincipal
);

// Eliminar una imagen
router.delete(
  '/ambientes/imagenes/:idImagen',
  requirePermission(PERMISSIONS.AMBIENTES.UPDATE),
  eliminarImagenAmbiente
);

export default router;

