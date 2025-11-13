// Backend placeholder - simple Express server for health checks
import express from 'express';
import { config } from './src/config/config.js';
import process from 'process';

import authRoutes from './src/routes/authRoutes.js';
import equiposRoutes from './src/routes/equiposRoutes.js';
import ambientesRoutes from './src/routes/ambientesRoutes.js';
import notificationsRoutes from './src/routes/notificationsRoutes.js';
import permissionsRoutes from './src/routes/permissionsRoutes.js';
import novedadesRoutes from './src/routes/novedadesRoutes.js';
import reportesRoutes from './src/routes/reportesRoutes.js';
import mantenimientoRoutes from './src/routes/mantenimientoRoutes.js';
import estadisticasRoutes from './src/routes/estadisticasRoutes.js';

const app = express();
app.use(express.json());
const desiredPort = Number(config.server.PORT) || 3000;


app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api', ambientesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/novedades', novedadesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/mantenimiento', mantenimientoRoutes);
app.use('/api/estadisticas', estadisticasRoutes);

// Start server with simple retry on EADDRINUSE (tries next ports)
const maxPort = 65535;
const startServer = (port) => {
  try {
    const server = app.listen(port, () => {
      console.log(`Servidor corriendo en puerto ${port} en modo ${config.server.mode || 'development'}`);
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`Puerto ${port} en uso (EADDRINUSE).`);
        const next = port + 1;
        if (next <= maxPort) {
          console.log(`Intentando iniciar en el puerto ${next}...`);
          // small delay to avoid race
          setTimeout(() => startServer(next), 200);
        } else {
          console.error('No hay puertos disponibles para iniciar el servidor.');
          process.exit(1);
        }
      } else {
        console.error('Error al iniciar el servidor:', err);
        process.exit(1);
      }
    });
  } catch (err) {
    console.error('Excepción al intentar iniciar el servidor:', err);
    process.exit(1);
  }
};

startServer(desiredPort);
