/**
 * Aplicación Express (sin listen).
 *
 * La fábrica es compartida por el proceso de producción y por los tests de
 * integración. El servidor solo debe encargarse del bootstrap de procesos
 * (schema, scheduler y señales), no de volver a construir la app.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import xssClean from 'xss-clean';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import process from 'process';

import { config } from './config/config.js';
import { PERMISSIONS } from './config/permissions.js';
import { errorHandler } from './utils/errors.js';
import { buildAutoservicioHealth } from './utils/autoservicioHealth.js';
import { getAutoservicioReadiness } from './controller/equiposController.js';
import { serveEnvironmentImage, serveProfileImage } from './controller/privateUploadController.js';

// DI y email se cargan al importar server.js; en tests solo necesitamos la app.
import './di/setup.js';

import { authenticate } from './middleware/authMiddleware.js';
import { requirePermission } from './middleware/authorization.js';
import authRoutes from './routes/authRoutes.js';
import equiposRoutes from './routes/equiposRoutes.js';
import ambientesRoutes from './routes/ambientesRoutes.js';
import notificationsRoutes from './routes/notificationsRoutes.js';
import permissionsRoutes from './routes/permissionsRoutes.js';
import novedadesRoutes from './routes/novedadesRoutes.js';
import reportesRoutes from './routes/reportesRoutes.js';
import mantenimientoRoutes from './routes/mantenimientoRoutes.js';
import estadisticasRoutes from './routes/estadisticasRoutes.js';
import clasesRoutes from './routes/clasesRoutes.js';
import horariosRoutes from './routes/horariosRoutes.js';
import importRoutes from './routes/importRoutes.js';
import aprendicesRoutes from './routes/aprendicesRoutes.js';
import invitationCodeRoutes from './routes/invitationCodeRoutes.js';
import preferencesRoutes from './routes/preferencesRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import imagenesEquipoRoutes from './routes/imagenesEquipoRoutes.js';
import imagenesAmbienteRoutes from './routes/imagenesAmbienteRoutes.js';

const normalizeOrigin = (origin) => (origin || '').trim().replace(/\/+$/, '') || origin;

const getAllowedOrigins = () => {
  const origins = [];

  if (config.cors.origin) {
    const originList = config.cors.origin.split(',').map((origin) => origin.trim()).filter(Boolean);
    origins.push(...originList);
  } else {
    origins.push('http://localhost:5173');
  }

  const externalDomain = 'https://sgi-senadata.up.railway.app';
  if (!origins.some((origin) => normalizeOrigin(origin) === externalDomain)) {
    origins.push(externalDomain);
  }

  return origins;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const normalized = normalizeOrigin(origin);
    const allowedOrigins = getAllowedOrigins();
    const allowed = allowedOrigins.some((allowedOrigin) => normalizeOrigin(allowedOrigin) === normalized);

    if (allowed) return callback(null, true);

    // Permitir localhost y otros orígenes solo durante desarrollo.
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    return callback(new Error('No permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  exposedHeaders: ['Content-Type'],
};

const applySecurityMiddleware = (app) => {
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors(corsOptions));
  app.use(hpp());
  app.use(xssClean());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Los uploads privados conservan sus URLs históricas, pero nunca se sirven
  // como static: metadata, sesión y permisos preceden a cualquier sendFile.
  app.get('/uploads/perfiles/:filename', authenticate, serveProfileImage);
  app.get(
    '/uploads/ambientes/:filename',
    authenticate,
    requirePermission(PERMISSIONS.AMBIENTES.VIEW),
    serveEnvironmentImage
  );

  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('common', { skip: (req, res) => res.statusCode < 400 }));
  }
};

const applyRoutes = (app, readinessProvider) => {
  app.get('/health', (req, res) => {
    const health = buildAutoservicioHealth(readinessProvider());
    res.status(health.statusCode).json({
      ...health.body,
      env: process.env.NODE_ENV || 'development',
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/equipos', equiposRoutes);
  app.use('/api/equipos', imagenesEquipoRoutes);
  // aprendicesRoutes debe montarse ANTES que los routers genéricos de /api
  // (ambientesRoutes, imagenesAmbienteRoutes, clasesRoutes, horariosRoutes) porque estos usan
  // router.use(authenticate) sin restricción de ruta: si se montan primero, interceptan
  // (con 401) cualquier request bajo /api/*, incluidas las rutas públicas de aprendicesRoutes.
  app.use('/api/aprendices', aprendicesRoutes);
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
  app.use('/api/invitation-codes', invitationCodeRoutes);
  app.use('/api/preferences', preferencesRoutes);
  app.use('/webhook', webhookRoutes);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Ruta no encontrada',
      path: req.originalUrl,
    });
  });

  app.use(errorHandler);
};

export function createApp({ readinessProvider = getAutoservicioReadiness } = {}) {
  const app = express();
  applySecurityMiddleware(app);
  applyRoutes(app, readinessProvider);
  return app;
}

const app = createApp();

export { app };
