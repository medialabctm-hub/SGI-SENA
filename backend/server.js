import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import xssClean from 'xss-clean';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import process from 'process';

import { config } from './src/config/config.js';
import { errorHandler } from './src/utils/errors.js';
import { logger } from './src/utils/logger.js';
// Inicializar contenedor de dependencias
import './src/di/setup.js';
// Importar servicio de email para inicializarlo al arrancar
import emailService from './src/services/emailService.js';

// Importar rutas
import authRoutes from './src/routes/authRoutes.js';
import equiposRoutes from './src/routes/equiposRoutes.js';
import ambientesRoutes from './src/routes/ambientesRoutes.js';
import notificationsRoutes from './src/routes/notificationsRoutes.js';
import permissionsRoutes from './src/routes/permissionsRoutes.js';
import novedadesRoutes from './src/routes/novedadesRoutes.js';
import reportesRoutes from './src/routes/reportesRoutes.js';
import mantenimientoRoutes from './src/routes/mantenimientoRoutes.js';
import estadisticasRoutes from './src/routes/estadisticasRoutes.js';
import clasesRoutes from './src/routes/clasesRoutes.js';
import horariosRoutes from './src/routes/horariosRoutes.js';
import importRoutes from './src/routes/importRoutes.js';
import aprendicesRoutes from './src/routes/aprendicesRoutes.js';
import invitationCodeRoutes from './src/routes/invitationCodeRoutes.js';
import preferencesRoutes from './src/routes/preferencesRoutes.js';
import webhookRoutes from './src/routes/webhookRoutes.js';
import imagenesEquipoRoutes from './src/routes/imagenesEquipoRoutes.js';
import imagenesAmbienteRoutes from './src/routes/imagenesAmbienteRoutes.js';
import schedulerService from './src/services/schedulerService.js';
import socketService from './src/services/socketService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();
const desiredPort = Number(config.server.PORT) || 3000;

// ============================================
// CONFIGURACIÓN DE PROXY
// ============================================
// Confiar en el primer proxy (Railway usa 1 proxy)
// Esto permite que express-rate-limit identifique correctamente las IPs reales
// sin permitir que cualquiera eluda el rate limiting
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARES DE SEGURIDAD
// ============================================

// Helmet - Configuración de headers de seguridad mejorada
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Permitir recursos externos si es necesario
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Permitir recursos desde otros orígenes
}));

// CORS - Configuración de origen cruzado
// Configuración base: permite múltiples orígenes si están separados por comas
const getAllowedOrigins = () => {
  const origins = [];
  
  if (config.cors.origin) {
    // Si CORS_ORIGIN es una lista separada por comas, dividirla
    const originList = config.cors.origin.split(',').map(o => o.trim()).filter(o => o);
    origins.push(...originList);
  } else {
    origins.push('http://localhost:5173');
  }
  
  // Agregar dominio de página externa para endpoints públicos
  // Este dominio también puede ser usado para endpoints protegidos si está configurado
  const externalDomain = 'https://sgi-senadata.up.railway.app';
  if (!origins.includes(externalDomain)) {
    origins.push(externalDomain);
  }
  
  return origins;
};

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requests sin origen (Postman, curl, mobile apps, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = getAllowedOrigins();
    
    // Verificar si el origen está en la lista permitida
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Permitir localhost SOLO en desarrollo
      const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
      if (isLocalhost && process.env.NODE_ENV === 'development') {
        // En desarrollo, permitir localhost para desarrollo local conectándose a Railway DB
        callback(null, true);
      } else if (process.env.NODE_ENV === 'development') {
        // En desarrollo, permitir cualquier origen para facilitar pruebas
        callback(null, true);
      } else {
        // En producción, rechazar orígenes no permitidos (incluyendo localhost)
        callback(new Error('No permitido por CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  exposedHeaders: ['Content-Type'],
};

app.use(cors(corsOptions));

// HPP - Protección contra HTTP Parameter Pollution
app.use(hpp());

// XSS Clean - Protección contra XSS
app.use(xssClean());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Servir archivos estáticos (imágenes de equipos y fotos de perfil)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Morgan - Logging de requests (optimizado)
// En producción, usar formato más eficiente
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Formato 'combined' es más completo pero más pesado
  // 'common' es más eficiente para producción
  app.use(morgan('common', {
    skip: (req, res) => res.statusCode < 400, // Solo loggear errores en producción
  }));
}

// ============================================
// RUTAS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/equipos', imagenesEquipoRoutes);
app.use('/api', imagenesAmbienteRoutes);
app.use('/api', ambientesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/novedades', novedadesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/mantenimiento', mantenimientoRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api', clasesRoutes);
app.use('/api', horariosRoutes);
app.use('/api/import', importRoutes);
app.use('/api/aprendices', aprendicesRoutes);
app.use('/api/invitation-codes', invitationCodeRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/webhook', webhookRoutes);

// Ruta 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
  });
});

// ============================================
// MANEJO DE ERRORES
// ============================================

app.use(errorHandler);

// ============================================
// INICIO DEL SERVIDOR
// ============================================

const maxPort = 65535;

const startServer = (port) => {
  try {
    const server = app.listen(port, () => {
      logger.info(`Servidor corriendo en puerto ${port}`, {
        mode: config.server.mode || 'development',
        env: process.env.NODE_ENV || 'development',
      });
      
      // Inicializar Socket.io para actualizaciones en tiempo real
      socketService.initialize(server);
      
      // Verificar y reinicializar servicio de email si es necesario
      // (por si las variables de entorno se cargaron después de la importación)
      if (process.env.BREVO_SMTP_KEY && !emailService.transporter) {
        logger.info('BREVO_SMTP_KEY detectada al iniciar servidor. Inicializando servicio de email SMTP...');
        emailService.reinitialize();
      }
      
      // Scheduler ACTIVADO solo para enviar notificaciones
      // IMPORTANTE: El scheduler SOLO envía notificaciones con botones de acción
      // NO cambia estados automáticamente - Los estados son 100% MANUALES
      // Los estados SOLO se cambian mediante los endpoints iniciarClase/finalizarClase
      // El scheduler solo monitorea y notifica, no ejecuta acciones automáticas
      if (process.env.NODE_ENV !== 'test') {
        schedulerService.start(1); // Ejecutar cada 1 minuto para monitorear y notificar
        logger.info('✅ Scheduler ACTIVADO - Enviando notificaciones de inicio/finalización de clases');
      } else {
        logger.info('⚠️ Scheduler DESACTIVADO - Modo test');
      }
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        logger.warn(`Puerto ${port} en uso (EADDRINUSE)`);
        const next = port + 1;
        if (next <= maxPort) {
          logger.info(`Intentando iniciar en el puerto ${next}...`);
          setTimeout(() => startServer(next), 200);
        } else {
          logger.error('No hay puertos disponibles para iniciar el servidor');
          process.exit(1);
        }
      } else {
        logger.error('Error al iniciar el servidor', { error: err.message });
        process.exit(1);
      }
    });

    // Manejo de señales para cierre graceful
    process.on('SIGTERM', () => {
      logger.info('SIGTERM recibido, cerrando servidor...');
      schedulerService.stop();
      server.close(() => {
        logger.info('Servidor cerrado');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT recibido, cerrando servidor...');
      schedulerService.stop();
      server.close(() => {
        logger.info('Servidor cerrado');
        process.exit(0);
      });
    });
  } catch (err) {
    logger.error('Excepción al intentar iniciar el servidor', { error: err.message });
    process.exit(1);
  }
};

startServer(desiredPort);
