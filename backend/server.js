import process from 'process';

import { config } from './src/config/config.js';
import { logger } from './src/utils/logger.js';
import { createApp } from './src/app.js';
// Importar servicio de email para inicializarlo al arrancar
import emailService from './src/services/emailService.js';

import schedulerService from './src/services/schedulerService.js';
import socketService from './src/services/socketService.js';
import { ensureAutoservicioSchema } from './src/controller/equiposController.js';
import { backfillLegacyEquipoImagePaths } from './src/middleware/uploadMiddleware.js';
import defaultDb from './src/config/dbconfig.js';

const app = createApp();
const desiredPort = Number(config.server.PORT) || 3000;

// ============================================
// INICIO DEL SERVIDOR
// ============================================

const maxPort = 65535;

const startServer = (port) => {
  try {
    const server = app.listen(port, async () => {
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

      // Asegurar schema de autoservicio (préstamos de aprendices sin cuenta) ANTES de que el
      // scheduler empiece a finalizar clases, para que sp_finalizar_clase ya sepa cerrarlos.
      try {
        await ensureAutoservicioSchema(defaultDb);
      } catch (schemaErr) {
        logger.error('No se pudo asegurar el schema de autoservicio al iniciar', { error: schemaErr.message });
      }

      // Backfill de rutas de imágenes de equipos legadas: filas insertadas antes de la
      // migración de seguridad que cerró el acceso estático público a /uploads/equipos
      // (commit 2ddeb3f) siguen apuntando a esa URL muerta. Reescribirlas al formato de
      // endpoint autenticado actual. Idempotente y no bloqueante: un fallo aquí no debe
      // impedir que el servidor arranque.
      try {
        const resultado = await backfillLegacyEquipoImagePaths(defaultDb);
        if (resultado.migradas > 0) {
          logger.info('Rutas de imágenes de equipos legadas migradas al iniciar', resultado);
        }
      } catch (backfillErr) {
        logger.error('No se pudo migrar rutas de imágenes de equipos legadas al iniciar', { error: backfillErr.message });
      }

      // Scheduler ACTIVADO para automatización de clases
      // El scheduler AUTOMÁTICAMENTE:
      // - Inicia clases cuando llega la hora de inicio programada (margen ±2 min)
      // - Finaliza clases cuando pasa la hora de fin programada (margen ±2 min)
      // - Envía notificaciones de advertencia 5 minutos antes del inicio/fin
      if (process.env.NODE_ENV !== 'test') {
        schedulerService.start(1); // Ejecutar cada 1 minuto para automatizar y notificar
        logger.info('✅ Scheduler ACTIVADO - Automatizando inicio y finalización de clases');
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
