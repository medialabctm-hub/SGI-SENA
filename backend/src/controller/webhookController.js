import dbWrapper from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';
import { config } from '../config/config.js';

// Cachear el secret al cargar el módulo (una sola vez)
const WEBHOOK_SECRET = config.webhook?.secret || process.env.WEBHOOK_SECRET;

// Query SQL pre-compilado (mejor rendimiento)
const INSERT_QUERY = `
  INSERT INTO pedidos_externos (usuario, id_ambiente, ficha, estado, fecha_recepcion, jornada, dias_semana, hora_inicio, hora_fin)
  VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?)
`;

/** Valores válidos de jornada (coinciden con ENUM en BD) */
const JORNADAS_VALIDAS = ['Mañana', 'Tarde', 'Noche'];

/** Días de la semana aceptados en español (para validar dias_semana) */
const DIAS_SEMANA_VALIDOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

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
 * Valida jornada: debe ser uno de Mañana, Tarde, Noche. Opcional (null si no se envía).
 */
const validarJornada = (jornada) => {
  if (jornada === undefined || jornada === null || jornada === '') return null;
  const valor = typeof jornada === 'string' ? jornada.trim() : String(jornada);
  return JORNADAS_VALIDAS.includes(valor) ? valor : null;
};

/**
 * Valida dias_semana: array de strings con nombres de días. Opcional.
 * Acepta también números 1-7 (1=Lunes, 7=Domingo) y los convierte a nombre.
 */
const validarDiasSemana = (dias) => {
  if (dias === undefined || dias === null) return null;
  if (!Array.isArray(dias) || dias.length === 0) return null;
  const normalizados = dias
    .map((d) => {
      if (typeof d === 'number' && d >= 1 && d <= 7) return DIAS_SEMANA_VALIDOS[d - 1];
      const s = typeof d === 'string' ? d.trim() : String(d);
      return DIAS_SEMANA_VALIDOS.includes(s) ? s : null;
    })
    .filter(Boolean);
  return normalizados.length > 0 ? JSON.stringify(normalizados) : null;
};

/**
 * Parsea y valida hora en formato HH:mm o HH:mm:ss. Retorna string para TIME o null si inválido.
 */
const validarHora = (hora) => {
  if (hora === undefined || hora === null || hora === '') return null;
  const s = typeof hora === 'string' ? hora.trim() : String(hora);
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const sec = match[3] ? parseInt(match[3], 10) : 0;
  if (h < 0 || h > 23 || m < 0 || m > 59 || sec < 0 || sec > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
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

    // Extraer datos requeridos y opcionales (jornada, dias_semana, hora desde SGI-SENA_DATA)
    const { usuario, ambiente, ficha, estado, jornada, dias_semana, hora, hora_inicio, hora_fin } = req.body;

    // Validación optimizada: una sola pasada para campos obligatorios
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

    // Validar campos opcionales: jornada, dias_semana, hora(s)
    const jornadaValida = validarJornada(jornada);
    if (jornada !== undefined && jornada !== null && jornada !== '' && jornadaValida === null) {
      return res.status(400).json({
        success: false,
        error: 'Valor de jornada inválido',
        detalles: `jornada debe ser uno de: ${JORNADAS_VALIDAS.join(', ')}`,
      });
    }

    const diasSemanaJson = validarDiasSemana(dias_semana);
    if (dias_semana !== undefined && dias_semana !== null && !Array.isArray(dias_semana)) {
      return res.status(400).json({
        success: false,
        error: 'dias_semana inválido',
        detalles: 'dias_semana debe ser un array de días (ej. ["Lunes","Martes"]) o números 1-7.',
      });
    }

    const horaInicioValida = validarHora(hora_inicio ?? hora);
    const horaFinValida = validarHora(hora_fin);
    if (hora_inicio !== undefined && hora_inicio !== null && hora_inicio !== '' && horaInicioValida === null) {
      return res.status(400).json({
        success: false,
        error: 'hora_inicio inválida',
        detalles: 'hora_inicio debe tener formato HH:mm o HH:mm:ss',
      });
    }
    if (hora_fin !== undefined && hora_fin !== null && hora_fin !== '' && horaFinValida === null) {
      return res.status(400).json({
        success: false,
        error: 'hora_fin inválida',
        detalles: 'hora_fin debe tener formato HH:mm o HH:mm:ss',
      });
    }

    // Guardar en la base de datos usando dbWrapper (más eficiente)
    try {
      const [result] = await dbWrapper.execute(INSERT_QUERY, [
        usuario,
        ambienteNumero,
        ficha,
        estado,
        jornadaValida,
        diasSemanaJson,
        horaInicioValida,
        horaFinValida,
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

