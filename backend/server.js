// Backend placeholder - simple Express server for health checks
import express from 'express';
import { config } from './src/config/config.js';
import process from 'process';

import authRoutes from './src/routes/authRoutes.js';
import equiposRoutes from './src/routes/equiposRoutes.js';
import ambientesRoutes from './src/routes/ambientesRoutes.js';


const app = express();
app.use(express.json());
const PORT = config.server.PORT || 3000;


app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// Rutas de autenticación

app.use('/api/auth', authRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api', ambientesRoutes);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT} en modo ${config.server.mode || 'development'}`);
});
