/**
 * Runner de migraciones (preDeploy de Railway) contra MySQL 8 real.
 * Corre solo con RUN_MYSQL_INTEGRATION=1 (scripts/run-mysql-integration.js).
 * Recrea el escenario del incidente MDL-229: una BD sin token_version.
 */
import { jest } from '@jest/globals';
import mysql from 'mysql2/promise';
import { runMigrations } from '../../scripts/run-migrations.js';

const describeMysql = process.env.RUN_MYSQL_INTEGRATION === '1' ? describe : describe.skip;

function getConfig(env = process.env) {
  return {
    host: env.MYSQL_TEST_HOST || env.DB_HOST,
    port: Number(env.MYSQL_TEST_PORT || env.DB_PORT || 3306),
    user: env.MYSQL_TEST_USER || env.DB_USER,
    password: env.MYSQL_TEST_PASSWORD ?? env.DB_PASSWORD,
    database: env.MYSQL_TEST_DATABASE || env.DB_NAME,
    charset: 'utf8mb4',
    multipleStatements: true,
  };
}

const silent = { log: () => {}, warn: () => {} };

describeMysql('runner de migraciones con MySQL 8 real', () => {
  jest.setTimeout(90000);
  let connection;

  const columnCount = async () => {
    const [[row]] = await connection.query(
      `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'token_version'`,
    );
    return Number(row.total);
  };

  beforeAll(async () => {
    connection = await mysql.createConnection(getConfig());
  });

  beforeEach(async () => {
    await connection.query(`
      DROP TABLE IF EXISTS schema_migrations;
      DROP TABLE IF EXISTS Tokens_Recuperacion_Contrasena;
      DROP TABLE IF EXISTS Usuarios;
      CREATE TABLE Usuarios (
        id_usuario INT PRIMARY KEY AUTO_INCREMENT,
        cedula VARCHAR(20) NOT NULL UNIQUE
      ) ENGINE=InnoDB;
      CREATE TABLE Tokens_Recuperacion_Contrasena (
        id_token INT PRIMARY KEY AUTO_INCREMENT,
        token VARCHAR(255) NOT NULL,
        usado TINYINT(1) DEFAULT 0,
        fecha_expiracion DATETIME NOT NULL
      ) ENGINE=InnoDB;
    `);
  });

  afterAll(async () => {
    if (connection) {
      // Deja la BD limpia: otras suites MySQL crean estas tablas con su propio esquema.
      await connection.query(`
        DROP TABLE IF EXISTS schema_migrations;
        DROP TABLE IF EXISTS Tokens_Recuperacion_Contrasena;
        DROP TABLE IF EXISTS Usuarios;
      `);
      await connection.end();
    }
  });

  it('una BD sin token_version queda con la columna tras correr el runner', async () => {
    expect(await columnCount()).toBe(0);

    const result = await runMigrations({ connection, log: silent });

    expect(result.applied).toContain('20261001_mdl229_token_version.sql');
    expect(await columnCount()).toBe(1);
  });

  it('una segunda ejecución no aplica nada y no duplica la columna', async () => {
    await runMigrations({ connection, log: silent });
    const second = await runMigrations({ connection, log: silent });

    expect(second.applied).toEqual([]);
    expect(await columnCount()).toBe(1);
    const [[row]] = await connection.query('SELECT COUNT(*) AS total FROM schema_migrations');
    expect(Number(row.total)).toBeGreaterThanOrEqual(2);
  });

  it('un ambiente que ya aplicó la migración a mano la registra sin error (primer despliegue con el runner)', async () => {
    await connection.query('ALTER TABLE Usuarios ADD COLUMN token_version INT NOT NULL DEFAULT 0');

    const result = await runMigrations({ connection, log: silent });

    expect(result.applied).toContain('20261001_mdl229_token_version.sql');
    expect(await columnCount()).toBe(1);
  });
});
