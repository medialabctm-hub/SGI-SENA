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

// Validación para crear código
const createCodeSchema = z.object({
  rol_destinado: z.enum(['Administrador', 'Instructor', 'Aprendiz', 'Cuentadante']),
  fecha_expiracion: z.string().datetime().optional().nullable(),
  max_usos: z.number().int().min(0).optional()
});

// Validación para validar código
const validateCodeSchema = z.object({
  codigo: z.string().min(1),
  rol: z.enum(['Administrador', 'Instructor', 'Aprendiz', 'Cuentadante'])
});

const validate = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Error de validación',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
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

