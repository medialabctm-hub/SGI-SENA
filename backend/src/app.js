/**
 * Aplicación Express (sin listen).
 * Exportada para tests de integración con supertest y para arranque desde server.js.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import xssClean from 'xss-clean';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import process from 'process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { config } from './config/config.js';
import { errorHandler } from './utils/errors.js';
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

// DI y email se cargan al importar server.js; en tests solo necesitamos la app
import './di/setup.js';

const app = express();

app.set('trust proxy', 1);

const normalizeOrigin = (o) => (o || '').trim().replace(/\/+$/, '') || o;

const getAllowedOrigins = () => {
  const origins = [];
  if (config.cors.origin) {
    const originList = config.cors.origin.split(',').map((o) => o.trim()).filter(Boolean);
    origins.push(...originList);
  } else {
    origins.push('http://localhost:5173');
  }
  const externalDomain = 'https://sgi-senadata.up.railway.app';
  if (!origins.some((o) => normalizeOrigin(o) === externalDomain)) origins.push(externalDomain);
  return origins;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = normalizeOrigin(origin);
    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.some((o) => normalizeOrigin(o) === normalized)) return callback(null, true);
    const isLocalhost = normalized.startsWith('http://localhost:') || normalized.startsWith('http://127.0.0.1:');
    if (isLocalhost && process.env.NODE_ENV === 'development') return callback(null, true);
    if (process.env.NODE_ENV === 'development') return callback(null, true);
    callback(new Error('No permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  exposedHeaders: ['Content-Type'],
};

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

const __filenameApp = fileURLToPath(import.meta.url);
const __dirnameApp = dirname(__filenameApp);
app.use('/uploads', express.static(path.join(__dirnameApp, '..', 'uploads')));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('common', { skip: (req, res) => res.statusCode < 400 }));
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

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

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
  });
});

app.use(errorHandler);

export { app };
