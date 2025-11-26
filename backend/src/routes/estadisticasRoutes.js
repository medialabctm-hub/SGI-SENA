import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/authorization.js';
import { obtenerEstadisticas } from '../controller/estadisticasController.js';
import { readLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Todas las rutas requieren autenticación y rol de Administrador
router.use(authenticate);
router.use(requireRole('Administrador'));

// Obtener estadísticas del sistema - Protegido con rate limiting
router.get('/', readLimiter, obtenerEstadisticas);

export default router;

