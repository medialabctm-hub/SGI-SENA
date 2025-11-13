import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/authorization.js';
import { obtenerEstadisticas } from '../controller/estadisticasController.js';

const router = express.Router();

// Todas las rutas requieren autenticación y rol de Administrador
router.use(authenticate);
router.use(requireRole('Administrador'));

// Obtener estadísticas del sistema
router.get('/', obtenerEstadisticas);

export default router;

