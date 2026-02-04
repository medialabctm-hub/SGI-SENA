import express from 'express';
import {
  createInvitationCode,
  getAllInvitationCodes,
  getInvitationCodeById,
  deleteInvitationCode,
  deactivateInvitationCode,
  validateInvitationCode
} from '../controller/invitationCodeController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/authorization.js';
import { z } from 'zod';

const router = express.Router();

// Validación para crear código (rol_destinado: cualquier rol activo de la BD)
const createCodeSchema = z.object({
  rol_destinado: z.string().min(1, 'El rol es obligatorio'),
  fecha_expiracion: z.string().datetime().optional().nullable(),
  max_usos: z.number().int().min(0).optional()
});

// Validación para validar código (rol: cualquier string, se valida contra BD)
const validateCodeSchema = z.object({
  codigo: z.string().min(1),
  rol: z.string().min(1)
});

const validate = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (err) {
      const rawErrors = err?.errors;
      const list = Array.isArray(rawErrors) ? rawErrors : [];
      const details = list.map((e) => ({
        path: Array.isArray(e?.path) ? e.path.join('.') : String(e?.path ?? ''),
        message: e?.message ?? 'Campo inválido',
      }));
      if (list.length > 0 || (err && err.constructor?.name === 'ZodError')) {
        return res.status(400).json({
          success: false,
          error: 'Error de validación',
          details,
        });
      }
      next(err);
    }
  };
};

// Ruta pública para validar código (usada en el formulario de registro)
router.post('/validate', validate(validateCodeSchema), validateInvitationCode);

// Rutas protegidas - Solo administradores
router.use(authenticate);
router.use(requireRole(['Administrador']));

router.post('/', validate(createCodeSchema), createInvitationCode);
router.get('/', getAllInvitationCodes);
router.get('/:id', getInvitationCodeById);
router.delete('/:id', deleteInvitationCode);
router.patch('/:id/deactivate', deactivateInvitationCode);

export default router;

