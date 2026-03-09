import dbWrapper from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';
import { config } from '../config/config.js';

// Obtener el secret desde configuración/entorno.
// Se evalúa en cada petición para respetar cambios en variables de entorno en tests.
const getWebhookSecret = () => config.webhook?.secret || process.env.WEBHOOK_SECRET;

// Query SQL pre-compilado (mejor rendimiento)
const INSERT_QUERY = `
  INSERT INTO pedidos_externos (usuario, id_ambiente, ficha, estado, fecha_recepcion)
  VALUES (?, ?, ?, ?, NOW())
`;

/**
 * Valida que un valor no esté vacío
 */
const isEmpty = (value) => value === undefined || value === null || value === '';

/**
 * Valida y convierte ambiente a número entero
 */
const validarYConvertirAmbiente = (ambiente) => {
  if (typeof ambiente === 'number') {
    return Number.isInteger(ambiente) ? ambiente : null;
  }
  if (typeof ambiente === 'string') {
    const parsed = parseInt(ambiente, 10);
    return !isNaN(parsed) && Number.isInteger(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Controlador para recibir webhooks externos
 * Valida el token API, los datos recibidos y los guarda en la base de datos
 * Optimizado para mejor rendimiento
 */
export const recibirWebhookExterno = async (req, res, next) => {
  try {
    // Validación temprana del token (antes de procesar body)
    const apiKey = req.headers['x-api-key'];
    const WEBHOOK_SECRET = getWebhookSecret();
    
    if (!WEBHOOK_SECRET) {
      logger.error('WEBHOOK_SECRET no configurado en variables de entorno');
      return res.status(500).json({
        success: false,
        error: 'Error de configuración del servidor',
      });
    }

    if (!apiKey || apiKey !== WEBHOOK_SECRET) {
      // Solo loggear en desarrollo para reducir overhead
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Intento de acceso al webhook con token inválido', {
          ip: req.ip,
        });
      }
      return res.status(403).json({
        success: false,
        error: 'Token de autenticación inválido',
      });
    }

    // Extraer y validar datos en una sola pasada
    const { usuario, ambiente, ficha, estado } = req.body;

    // Validación optimizada: una sola pasada
    const camposFaltantes = [];
    if (isEmpty(usuario)) camposFaltantes.push('usuario');
    if (isEmpty(ambiente)) camposFaltantes.push('ambiente');
    if (isEmpty(ficha)) camposFaltantes.push('ficha');
    if (isEmpty(estado)) camposFaltantes.push('estado');

    if (camposFaltantes.length > 0) {
      logger.warn('Datos incompletos recibidos en webhook', {
        camposFaltantes,
      });
      return res.status(400).json({
        success: false,
        error: 'Datos incompletos',
        detalles: `Faltan los siguientes campos: ${camposFaltantes.join(', ')}`,
      });
    }

    // Validar tipos y convertir ambiente en una sola operación
    const ambienteNumero = validarYConvertirAmbiente(ambiente);
    
    if (typeof usuario !== 'string' || 
        typeof ficha !== 'string' || 
        typeof estado !== 'string' ||
        ambienteNumero === null) {
      logger.warn('Tipos de datos inválidos en webhook');
      return res.status(400).json({
        success: false,
        error: 'Tipos de datos inválidos',
        detalles: 'usuario, ficha y estado deben ser strings. ambiente debe ser un número entero.',
      });
    }

    // Guardar en la base de datos usando dbWrapper (más eficiente)
    try {
      const [result] = await dbWrapper.execute(INSERT_QUERY, [
        usuario,
        ambienteNumero,
        ficha,
        estado,
      ]);

      // Solo loggear en desarrollo para reducir overhead en producción
      if (process.env.NODE_ENV === 'development') {
        logger.info('Webhook externo procesado correctamente', {
          id: result.insertId,
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Datos recibidos y guardados correctamente',
        id: result.insertId,
      });
    } catch (dbError) {
      logger.error('Error al guardar datos del webhook en la base de datos', {
        error: dbError.message,
        code: dbError.code,
      });
      
      // Verificar si es un error de tabla no existente
      if (dbError.code === 'ER_NO_SUCH_TABLE') {
        throw new DatabaseError(
          'La tabla pedidos_externos no existe. Ejecuta el script SQL de creación.',
          dbError
        );
      }
      
      throw new DatabaseError('Error al guardar los datos', dbError);
    }
  } catch (error) {
    // Solo loggear stack en desarrollo
    if (error instanceof DatabaseError) {
      logger.error('Error en recibirWebhookExterno', {
        error: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      });
    } else {
      logger.error('Error inesperado en recibirWebhookExterno', {
        error: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      });
    }
    return next(error);
  }
};

