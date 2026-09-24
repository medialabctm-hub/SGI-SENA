/**
 * MDL-232 / R42-01: carrera de restablecerContrasena contra MySQL 8 real.
 * Corre solo con RUN_MYSQL_INTEGRATION=1 (scripts/run-mysql-integration.js).
 */
import { jest } from '@jest/globals';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import {
  AuthService,
  hashResetToken,
  PASSWORD_RESET_TOKEN_TTL_HOURS,
} from '../../src/services/authService.js';
import { PasswordService } from '../../src/services/PasswordService.js';
import { ValidationError } from '../../src/utils/errors.js';

const describeMysql = process.env.RUN_MYSQL_INTEGRATION === '1' ? describe : describe.skip;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createMysqlConnectionWithRetry(config) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await mysql.createConnection({ ...config, connectTimeout: 1000 });
    } catch (error) {
      lastError = error;
      await pause(250);
    }
  }
  throw lastError;
}

function getMysqlConfig(env = process.env) {
  const config = {
    host: env.MYSQL_TEST_HOST || env.DB_HOST,
    port: Number(env.MYSQL_TEST_PORT || env.DB_PORT || 3306),
    user: env.MYSQL_TEST_USER || env.DB_USER,
    password: env.MYSQL_TEST_PASSWORD ?? env.DB_PASSWORD,
    database: env.MYSQL_TEST_DATABASE || env.DB_NAME,
    charset: 'utf8mb4',
    multipleStatements: true,
  };
  const missing = ['host', 'user', 'database'].filter((key) => !config[key]);
  if (missing.length > 0 || !Number.isInteger(config.port) || config.port <= 0) {
    throw new Error(`Faltan MYSQL_TEST_*: ${missing.join(', ') || 'port'}`);
  }
  return config;
}

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
}

describeMysql('MDL-232: carrera de reset + TTL con MySQL 8 real', () => {
  jest.setTimeout(90000);
  let admin;
  let pool;
  let authService;

  beforeAll(async () => {
    const config = getMysqlConfig();
    admin = await createMysqlConnectionWithRetry(config);

    await admin.query(`
      CREATE TABLE IF NOT EXISTS Usuarios (
        id_usuario INT PRIMARY KEY AUTO_INCREMENT,
        nombre_usuario VARCHAR(100) NOT NULL,
        cedula VARCHAR(20) NOT NULL UNIQUE,
        correo VARCHAR(100) NOT NULL UNIQUE,
        contrasena VARCHAR(255) NOT NULL,
        estado ENUM('Activo','Inactivo') DEFAULT 'Activo',
        requiere_cambio_contrasena TINYINT(1) DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS Tokens_Recuperacion_Contrasena (
        id_token INT PRIMARY KEY AUTO_INCREMENT,
        id_usuario INT NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        fecha_creacion DATETIME DEFAULT NOW(),
        fecha_expiracion DATETIME NOT NULL,
        usado TINYINT(1) DEFAULT 0,
        fecha_uso DATETIME NULL,
        FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
        INDEX idx_token (token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
    });

    const userRepository = {
      findOne: async (sql, params) => {
        const [rows] = await pool.execute(sql, params);
        return rows[0] || null;
      },
      db: {
        execute: (...args) => pool.execute(...args),
        pool,
      },
    };

    authService = new AuthService(
      userRepository,
      { findByName: async () => ({ id_rol: 1 }) },
      new PasswordService(10),
      { sign: () => 'jwt', verify: () => ({}) },
      makeLogger(),
    );
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) await admin.end();
  });

  beforeEach(async () => {
    await admin.query('DELETE FROM Tokens_Recuperacion_Contrasena');
    await admin.query('DELETE FROM Usuarios');
  });

  async function seedUserWithToken({ rawToken, passwordHash }) {
    const [userResult] = await admin.execute(
      `INSERT INTO Usuarios (nombre_usuario, cedula, correo, contrasena, estado)
       VALUES ('Reset User', '900100200', 'reset.user@example.com', ?, 'Activo')`,
      [passwordHash],
    );
    const userId = userResult.insertId;
    const exp = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000);
    await admin.execute(
      `INSERT INTO Tokens_Recuperacion_Contrasena (id_usuario, token, fecha_expiracion, usado)
       VALUES (?, ?, ?, 0)`,
      [userId, hashResetToken(rawToken), exp],
    );
    return userId;
  }

  it('TTL exportado es exactamente 1 hora', () => {
    expect(PASSWORD_RESET_TOKEN_TTL_HOURS).toBe(1);
    expect(PASSWORD_RESET_TOKEN_TTL_HOURS).toBeLessThanOrEqual(1);
  });

  it('R42-01: dos restablecer concurrentes → un 200 y un 400; un solo cambio de password', async () => {
    const oldHash = await bcrypt.hash('OldPass123*', 10);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const userId = await seedUserWithToken({ rawToken, passwordHash: oldHash });

    const passA = 'NewPassAAA1*';
    const passB = 'NewPassBBB2*';

    const results = await Promise.allSettled([
      authService.restablecerContrasena(rawToken, passA),
      authService.restablecerContrasena(rawToken, passB),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ValidationError);
    expect(rejected[0].reason.message).toMatch(/Token inválido o expirado/i);
    expect(rejected[0].reason.statusCode).toBe(400);

    const [users] = await admin.execute(
      'SELECT contrasena FROM Usuarios WHERE id_usuario = ?',
      [userId],
    );
    const finalHash = users[0].contrasena;
    expect(finalHash).not.toBe(oldHash);

    const matchesA = await bcrypt.compare(passA, finalHash);
    const matchesB = await bcrypt.compare(passB, finalHash);
    expect(Number(matchesA) + Number(matchesB)).toBe(1);

    const [tokens] = await admin.execute(
      'SELECT usado FROM Tokens_Recuperacion_Contrasena WHERE id_usuario = ?',
      [userId],
    );
    expect(tokens.every((row) => Number(row.usado) === 1)).toBe(true);
  });

  it('R42-04: reset OK invalida otros tokens activos del mismo usuario', async () => {
    const oldHash = await bcrypt.hash('OldPass123*', 10);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const otherRaw = crypto.randomBytes(32).toString('hex');
    const userId = await seedUserWithToken({ rawToken, passwordHash: oldHash });
    const exp = new Date(Date.now() + 60 * 60 * 1000);
    await admin.execute(
      `INSERT INTO Tokens_Recuperacion_Contrasena (id_usuario, token, fecha_expiracion, usado)
       VALUES (?, ?, ?, 0)`,
      [userId, hashResetToken(otherRaw), exp],
    );

    await authService.restablecerContrasena(rawToken, 'BrandNew9*Pass');

    const [tokens] = await admin.execute(
      'SELECT usado FROM Tokens_Recuperacion_Contrasena WHERE id_usuario = ?',
      [userId],
    );
    expect(tokens).toHaveLength(2);
    expect(tokens.every((row) => Number(row.usado) === 1)).toBe(true);
  });
});
