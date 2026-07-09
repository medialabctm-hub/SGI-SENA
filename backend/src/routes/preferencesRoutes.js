import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { getPreferences, updatePreferences } from '../controller/preferencesController.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /api/preferences
 * Obtiene las preferencias del usuario autenticado
 */
router.get('/', getPreferences);

/**
 * PUT /api/preferences
 * Actualiza las preferencias del usuario autenticado
 */
router.put('/', updatePreferences);

export default router;

