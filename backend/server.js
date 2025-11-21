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
import invitationCodeRoutes from './src/routes/invitationCodeRoutes.js';
import preferencesRoutes from './src/routes/preferencesRoutes.js';
import schedulerService from './src/services/schedulerService.js';

const app = express();
const desiredPort = Number(config.server.PORT) || 3000;

// ============================================
// MIDDLEWARES DE SEGURIDAD
// ============================================

// Helmet - Configuración de headers de seguridad
app.use(helmet());

// CORS - Configuración de origen cruzado
app.use(
  cors({
    origin: config.cors.origin || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// HPP - Protección contra HTTP Parameter Pollution
app.use(hpp());

// XSS Clean - Protección contra XSS
app.use(xssClean());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Morgan - Logging de requests
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
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
app.use('/api/invitation-codes', invitationCodeRoutes);
app.use('/api/preferences', preferencesRoutes);

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
      
      // Iniciar scheduler para sincronización automática de responsabilidades
      // Se ejecuta cada minuto para verificar clases que deben iniciar/finalizar
      if (process.env.NODE_ENV !== 'test') {
        schedulerService.start(1); // Sincronizar cada 1 minuto
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
