import express from 'express';
import {
  importarHorariosExcel,
  descargarPlantillaHorarios,
  upload
} from '../controller/horariosController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Importar horarios desde Excel
router.post(
  '/horarios/importar',
  requirePermission(PERMISSIONS.CLASES.CREATE),
  upload.single('archivo'),
  importarHorariosExcel
);

// Descargar plantilla Excel
router.get(
  '/horarios/plantilla',
  requirePermission(PERMISSIONS.CLASES.VIEW),
  descargarPlantillaHorarios
);

export default router;

