import express from 'express';
import multer from 'multer';
import { importarEquipos, importarUsuarios } from '../controller/importController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = express.Router();

// Configurar multer para manejar archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Aceptar solo archivos Excel
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'), false);
    }
  }
});

// Importar equipos desde Excel - Solo Admin
router.post('/equipos',
  authenticate,
  requirePermission(PERMISSIONS.EQUIPOS.CREATE),
  upload.single('archivo'),
  importarEquipos
);

// Importar usuarios desde Excel - Solo Admin
router.post('/usuarios',
  authenticate,
  requirePermission(PERMISSIONS.USERS.CREATE),
  upload.single('archivo'),
  importarUsuarios
);

export default router;

