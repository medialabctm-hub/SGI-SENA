import express from 'express';
import { recibirWebhookExterno } from '../controller/webhookController.js';
import { webhookLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Ruta POST /webhook/externo
 * Recibe datos de sistemas externos mediante webhook
 * Requiere autenticación mediante x-api-key header
 * Protegida con rate limiting
 */
router.post('/externo', webhookLimiter, recibirWebhookExterno);

export default router;

