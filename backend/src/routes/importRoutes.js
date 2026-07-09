import express from 'express';
import multer from 'multer';
import { 
  importarEquipos, 
  obtenerEstadoImportacionEquipos,
  importarUsuarios, 
  importarAprendices, 
  obtenerDuplicadosPendientes, 
  procesarDuplicado, 
  procesarDuplicadosMasivo 
} from '../controller/importController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';
import { validateExcelFile } from '../middleware/fileValidation.js';

const router = express.Router();

// Configurar multer para manejar archivos en memoria con validación mejorada
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB máximo (mejorado desde 10MB)
  },
  fileFilter: (req, file, cb) => {
    // Usar validación mejorada de archivos Excel
    const validation = validateExcelFile(file);
    if (validation.valid) {
      cb(null, true);
    } else {
      cb(new Error(validation.error), false);
    }
  }
});

// Importar equipos desde Excel - Solo Admin (devuelve job_id; progreso vía GET status)
router.post('/equipos',
  authenticate,
  requirePermission(PERMISSIONS.EQUIPOS.CREATE),
  upload.single('archivo'),
  importarEquipos
);

// Estado y progreso de importación de equipos (progreso real)
router.get('/equipos/status/:job_id',
  authenticate,
  requirePermission(PERMISSIONS.EQUIPOS.CREATE),
  obtenerEstadoImportacionEquipos
);

// Importar usuarios desde Excel - Solo Admin
router.post('/usuarios',
  authenticate,
  requirePermission(PERMISSIONS.USERS.CREATE),
  upload.single('archivo'),
  importarUsuarios
);

// Importar aprendices desde Excel - Solo Admin
router.post('/aprendices',
  authenticate,
  requirePermission(PERMISSIONS.USERS.CREATE),
  upload.single('archivo'),
  importarAprendices
);

// Obtener duplicados pendientes de revisión - Admin y Cuentadante
router.get('/duplicados',
  authenticate,
  obtenerDuplicadosPendientes
);

// Procesar un duplicado (aprobar o rechazar) - Admin y Cuentadante
router.post('/duplicados/procesar',
  authenticate,
  procesarDuplicado
);

// Procesar múltiples duplicados - Admin y Cuentadante
router.post('/duplicados/procesar-masivo',
  authenticate,
  procesarDuplicadosMasivo
);

export default router;

