import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/authorization.js';
import { 
  obtenerEstadisticas, 
  obtenerEstadisticasInstructor, 
  obtenerEstadisticasCuentadante 
} from '../controller/estadisticasController.js';
import { readLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Obtener estadísticas según el rol del usuario
router.get('/', readLimiter, async (req, res, next) => {
  const userRole = req.user?.rol;
  
  try {
    if (userRole === 'Administrador') {
      return await obtenerEstadisticas(req, res);
    } else if (userRole === 'Instructor') {
      return await obtenerEstadisticasInstructor(req, res);
    } else if (userRole === 'Cuentadante') {
      return await obtenerEstadisticasCuentadante(req, res);
    } else {
      return res.status(403).json({ 
        error: 'No tienes permiso para ver estadísticas' 
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;

