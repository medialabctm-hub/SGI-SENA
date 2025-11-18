/**
 * Configuración del contenedor de dependencias
 * 
 * Patrón: Dependency Injection
 * 
 * Registra todas las dependencias del sistema en el contenedor,
 * estableciendo las relaciones entre servicios, repositorios y utilidades.
 */
import { container } from './Container.js';
import { pool } from '../config/dbconfig.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { RoleRepository } from '../repositories/RoleRepository.js';
import { logger } from '../utils/logger.js';
import { PasswordService } from '../services/PasswordService.js';
import { JwtService } from '../services/JwtService.js';
import { AuthService } from '../services/AuthService.js';
import process from 'process';

// Wrapper para la base de datos que incluye el pool
const dbWrapper = {
  execute: async (query, params) => {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(query, params);
      return [rows];
    } finally {
      connection.release();
    }
  },
  pool, // Exponer el pool para transacciones
};

// Registrar base de datos (singleton)
container.register('db', dbWrapper, true);

// Registrar repositorios (singleton)
container.register('userRepository', (c) => {
  return new UserRepository(c.resolve('db'));
}, true);

container.register('roleRepository', (c) => {
  return new RoleRepository(c.resolve('db'));
}, true);

// Registrar servicios de utilidad (singleton)
container.register('passwordService', () => {
  return new PasswordService(10);
}, true);

container.register('jwtService', () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no configurado');
  }
  return new JwtService(secret, process.env.JWT_EXPIRES_IN || '1d');
}, true);

// Registrar logger (singleton)
container.register('logger', logger, true);

// Registrar servicios de negocio (singleton)
container.register('authService', (c) => {
  return new AuthService(
    c.resolve('userRepository'),
    c.resolve('roleRepository'),
    c.resolve('passwordService'),
    c.resolve('jwtService'),
    c.resolve('logger')
  );
}, true);

export { container };

