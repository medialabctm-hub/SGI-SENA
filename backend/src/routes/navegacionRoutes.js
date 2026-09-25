import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { readLimiter } from '../middleware/rateLimiter.js';
import { obtenerEstado } from '../controller/navegacionController.js';

const router = express.Router();

// Contadores del sidebar de consulta. Cualquier usuario autenticado; el servicio
// decide qué bloques devolver según el rol y aplica su alcance.
router.get('/estado', authenticate, readLimiter, obtenerEstado);

export default router;
