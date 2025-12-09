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
import invitationCodeRoutes from './src/routes/invitationCodeRoutes.js';
import preferencesRoutes from './src/routes/preferencesRoutes.js';
import webhookRoutes from './src/routes/webhookRoutes.js';
import imagenesEquipoRoutes from './src/routes/imagenesEquipoRoutes.js';
import imagenesAmbienteRoutes from './src/routes/imagenesAmbienteRoutes.js';
import schedulerService from './src/services/schedulerService.js';
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

// Helmet - Configuración de headers de seguridad
app.use(helmet());

// CORS - Configuración de origen cruzado
app.use(
  cors({
    origin: config.cors.origin || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
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

// Endpoint de diagnóstico para verificar uso del volumen
app.get('/api/debug/volumes', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const uploadsBaseDir = path.join(__dirname, 'uploads');
    
    const getDirectorySize = (dirPath) => {
      let totalSize = 0;
      let fileCount = 0;
      const files = [];
      
      if (!fs.existsSync(dirPath)) {
        return { size: 0, count: 0, files: [] };
      }
      
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          const subDir = getDirectorySize(itemPath);
          totalSize += subDir.size;
          fileCount += subDir.count;
          files.push(...subDir.files.map(f => ({ ...f, path: `${item}/${f.path}` })));
        } else {
          totalSize += stats.size;
          fileCount++;
          files.push({
            name: item,
            path: item,
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime || stats.ctime
          });
        }
      }
      
      return { size: totalSize, count: fileCount, files };
    };
    
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };
    
    const uploadsInfo = getDirectorySize(uploadsBaseDir);
    
    // Información por subdirectorio
    const subdirs = {};
    if (fs.existsSync(uploadsBaseDir)) {
      const items = fs.readdirSync(uploadsBaseDir);
      for (const item of items) {
        const itemPath = path.join(uploadsBaseDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
          subdirs[item] = getDirectorySize(itemPath);
        }
      }
    }
    
    // Ordenar archivos por tamaño (más grandes primero)
    uploadsInfo.files.sort((a, b) => b.size - a.size);
    
    res.json({
      uploadsBaseDir,
      exists: fs.existsSync(uploadsBaseDir),
      totalSize: uploadsInfo.size,
      totalSizeFormatted: formatBytes(uploadsInfo.size),
      totalFiles: uploadsInfo.count,
      subdirectories: Object.keys(subdirs).reduce((acc, key) => {
        acc[key] = {
          size: subdirs[key].size,
          sizeFormatted: formatBytes(subdirs[key].size),
          fileCount: subdirs[key].count,
          files: subdirs[key].files.slice(0, 20) // Primeros 20 archivos
        };
        return acc;
      }, {}),
      largestFiles: uploadsInfo.files.slice(0, 10), // Top 10 archivos más grandes
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error al obtener información del volumen', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      error: 'Error al obtener información del volumen', 
      detalle: error.message 
    });
  }
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
      
      // Verificar y reinicializar servicio de email si es necesario
      // (por si las variables de entorno se cargaron después de la importación)
      if (process.env.BREVO_SMTP_KEY && !emailService.transporter) {
        logger.info('BREVO_SMTP_KEY detectada al iniciar servidor. Inicializando servicio de email SMTP...');
        emailService.reinitialize();
      }
      
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
