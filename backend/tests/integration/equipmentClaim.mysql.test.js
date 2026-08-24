import { jest } from '@jest/globals';
import mysql from 'mysql2/promise';
import { beginEquipmentClaim } from '../../src/utils/equipmentClaim.js';
import { runAutoservicioCierreMigration } from '../../scripts/migrate-autoservicio-cierre-clase.js';

const describeMysql = process.env.RUN_MYSQL_INTEGRATION === '1' ? describe : describe.skip;
const MIGRATION_VERSION = 'AUTOSERVICIO_CIERRE_V1';
const TRIGGER_NAME = 'mdl71_fail_historial_update';

const pause = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

async function createMysqlConnectionWithRetry(config) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      // Retry sequentially so the ephemeral server is not flooded at startup.
      // eslint-disable-next-line no-await-in-loop
      return await mysql.createConnection({ ...config, connectTimeout: 1000 });
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-await-in-loop
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
    charset: 'utf8mb4'
  };
  const missing = ['host', 'user', 'database'].filter((key) => !config[key]);
  if (missing.length > 0 || !Number.isInteger(config.port) || config.port <= 0) {
    throw new Error(`Faltan variables MYSQL_TEST_* para la prueba real: ${missing.join(', ') || 'port'}`);
  }
  return config;
}

describeMysql('MDL-71: concurrencia, migración e idempotencia con MySQL 8 real', () => {
  jest.setTimeout(90000);
  let adminConnection;
  let claimPool;
  let config;

  const clearFixture = async () => {
    await adminConnection.query(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME}`);
    await adminConnection.query('DELETE FROM Historial_Uso_Equipos');
    await adminConnection.query('DELETE FROM Responsables_Equipo');
    await adminConnection.query('DELETE FROM Responsabilidades_Ambiente');
    await adminConnection.query('DELETE FROM Clases');
    await adminConnection.query('DELETE FROM Elementos');
    await adminConnection.query('DELETE FROM Ambientes');
  };

  const seedEquipment = async () => {
    await adminConnection.execute(
      `INSERT INTO Ambientes (id_ambiente, codigo_ambiente, nombre_ambiente, tipo_ambiente, detalles_uso)
       VALUES (1, '101', 'Ambiente 101', 'Laboratorio', ?)`,
      [JSON.stringify([])]
    );
    await adminConnection.execute(
      `INSERT INTO Elementos (codigo_equipo, placa, tipo, modelo, id_ambiente, estado_fisico)
       VALUES (1, 'P-1', 'Laptop', 'Fixture', 1, 'Bueno')`
    );
  };

  const insertUsage = async (connection, { userId, key, classId = null }) => {
    await connection.execute(
      `INSERT INTO Historial_Uso_Equipos
       (codigo_equipo, id_usuario, nombre_usuario, idempotency_key, fecha_hora_inicio, estado, id_clase)
       VALUES (1, ?, 'Fixture user', ?, NOW(), 'En Uso', ?)`,
      [userId, key, classId]
    );
  };

  const ensureRoutine = async () => runAutoservicioCierreMigration({ connection: adminConnection });

  const seedClassUsage = async () => {
    await seedEquipment();
    await adminConnection.execute(
      `UPDATE Ambientes SET detalles_uso = ? WHERE id_ambiente = 1`,
      [JSON.stringify([{ id_clase: 7, estado: 'En Curso' }])]
    );
    await adminConnection.execute(
      `INSERT INTO Clases
       (id_clase, id_ambiente, id_instructor, nombre_clase, codigo_ficha, fecha_clase, hora_inicio, hora_fin, estado_clase)
       VALUES (7, 1, 10, 'Clase fixture', 'F-7', '2026-08-24', '08:00:00', '10:00:00', 'En Curso')`
    );
    await adminConnection.execute(
      `INSERT INTO Responsabilidades_Ambiente (id_clase, estado_responsabilidad, fecha_fin)
       VALUES (7, 'Activa', NULL)`
    );
    await adminConnection.execute(
      `INSERT INTO Responsables_Equipo
       (codigo_equipo, id_usuario, estado_responsabilidad, observaciones)
       VALUES (1, 10, 'Activo', 'inicio de clase #7')`
    );
    await insertUsage(adminConnection, { userId: 10, key: 'mdl71-class-usage', classId: 7 });
  };

  beforeAll(async () => {
    config = getMysqlConfig();
    adminConnection = await createMysqlConnectionWithRetry(config);
    const statements = [
      `CREATE TABLE IF NOT EXISTS Ambientes (
        id_ambiente INT PRIMARY KEY,
        codigo_ambiente VARCHAR(20) NOT NULL,
        nombre_ambiente VARCHAR(100) NOT NULL,
        tipo_ambiente VARCHAR(50) NOT NULL,
        detalles_uso JSON NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS Elementos (
        codigo_equipo INT PRIMARY KEY,
        placa VARCHAR(100) NOT NULL,
        tipo VARCHAR(100) NOT NULL,
        modelo VARCHAR(100) NULL,
        id_ambiente INT NULL,
        estado_fisico VARCHAR(30) NOT NULL DEFAULT 'Bueno',
        verificado_ambiente TINYINT(1) NOT NULL DEFAULT 0,
        UNIQUE KEY uq_mdl71_placa (placa),
        CONSTRAINT fk_mdl71_elemento_ambiente FOREIGN KEY (id_ambiente) REFERENCES Ambientes(id_ambiente)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS Clases (
        id_clase INT PRIMARY KEY,
        id_ambiente INT NOT NULL,
        id_instructor INT NOT NULL,
        nombre_clase VARCHAR(200) NULL,
        codigo_ficha VARCHAR(50) NULL,
        fecha_clase DATE NULL,
        hora_inicio TIME NULL,
        hora_fin TIME NULL,
        estado_clase VARCHAR(30) NOT NULL,
        fecha_fin_real DATETIME NULL,
        CONSTRAINT fk_mdl71_clase_ambiente FOREIGN KEY (id_ambiente) REFERENCES Ambientes(id_ambiente)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS Responsabilidades_Ambiente (
        id_responsabilidad_ambiente INT PRIMARY KEY AUTO_INCREMENT,
        id_clase INT NOT NULL,
        estado_responsabilidad VARCHAR(30) NOT NULL,
        fecha_fin DATETIME NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS Responsables_Equipo (
        id_responsable INT PRIMARY KEY AUTO_INCREMENT,
        codigo_equipo INT NOT NULL,
        id_usuario INT NULL,
        estado_responsabilidad VARCHAR(30) NOT NULL,
        fecha_desvinculacion DATETIME NULL,
        observaciones TEXT NULL,
        CONSTRAINT fk_mdl71_responsable_equipo FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS Historial_Uso_Equipos (
        id_historial INT PRIMARY KEY AUTO_INCREMENT,
        codigo_equipo INT NOT NULL,
        id_usuario INT NULL,
        nombre_usuario VARCHAR(100) NULL,
        documento_externo VARCHAR(50) NULL,
        nombre_externo VARCHAR(200) NULL,
        id_aprendiz INT NULL,
        idempotency_key VARCHAR(128) NULL,
        fecha_hora_inicio DATETIME NOT NULL,
        fecha_hora_fin DATETIME NULL,
        estado VARCHAR(30) NOT NULL,
        observaciones TEXT NULL,
        id_clase INT NULL,
        UNIQUE KEY uq_mdl71_idempotency (idempotency_key),
        CONSTRAINT fk_mdl71_historial_equipo FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo),
        CONSTRAINT fk_mdl71_historial_clase FOREIGN KEY (id_clase) REFERENCES Clases(id_clase)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ];
    for (const statement of statements) {
      // Preserve DDL order because later tables reference earlier fixtures.
      // eslint-disable-next-line no-await-in-loop
      await adminConnection.query(statement);
    }
    claimPool = mysql.createPool({ ...config, connectionLimit: 4, waitForConnections: true });
  });

  afterEach(async () => {
    if (adminConnection) await clearFixture();
  });

  afterAll(async () => {
    await claimPool?.end();
    await adminConnection?.end();
  });

  it('serializa dos claims reales y deja un solo préstamo activo', async () => {
    await seedEquipment();
    const first = await beginEquipmentClaim(claimPool, { codigoEquipo: 1 });
    let secondSettled = false;
    const secondPromise = beginEquipmentClaim(claimPool, { codigoEquipo: 1 }).then((claim) => {
      secondSettled = true;
      return claim;
    });

    await pause(150);
    expect(secondSettled).toBe(false);

    await insertUsage(first.connection, { userId: 101, key: 'mdl71-concurrency-a' });
    await first.connection.commit();
    first.connection.release();

    const second = await secondPromise;
    const [[active]] = await second.connection.execute(
      `SELECT id_usuario, idempotency_key FROM Historial_Uso_Equipos
       WHERE codigo_equipo = 1 AND estado = 'En Uso' LIMIT 1`
    );
    expect(active).toEqual(expect.objectContaining({ id_usuario: 101, idempotency_key: 'mdl71-concurrency-a' }));
    await second.connection.rollback();
    second.connection.release();

    const [[count]] = await adminConnection.execute(
      `SELECT COUNT(*) AS total FROM Historial_Uso_Equipos WHERE codigo_equipo = 1 AND estado = 'En Uso'`
    );
    expect(Number(count.total)).toBe(1);
  });

  it('hace idempotente el reintento mediante el índice único real', async () => {
    await seedEquipment();
    const first = await claimPool.getConnection();
    await first.beginTransaction();
    await insertUsage(first, { userId: 202, key: 'mdl71-retry-1' });
    await first.commit();
    first.release();

    const retry = await claimPool.getConnection();
    await retry.beginTransaction();
    await expect(insertUsage(retry, { userId: 202, key: 'mdl71-retry-1' })).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    await retry.rollback();
    retry.release();

    const [[count]] = await adminConnection.execute(
      `SELECT COUNT(*) AS total FROM Historial_Uso_Equipos WHERE idempotency_key = 'mdl71-retry-1'`
    );
    expect(Number(count.total)).toBe(1);
  });

  it('revierte responsabilidad e historial cuando falla una inserción dentro del claim', async () => {
    await seedEquipment();
    const claim = await beginEquipmentClaim(claimPool, { codigoEquipo: 1 });
    await claim.connection.execute(
      `INSERT INTO Responsables_Equipo (codigo_equipo, id_usuario, estado_responsabilidad, observaciones)
       VALUES (1, 303, 'Activo', 'MDL-71 rollback')`
    );
    await expect(claim.connection.execute(
      `INSERT INTO Historial_Uso_Equipos (codigo_equipo, columna_inexistente, fecha_hora_inicio, estado)
       VALUES (1, NOW(), NOW(), 'En Uso')`
    )).rejects.toMatchObject({ code: 'ER_BAD_FIELD_ERROR' });
    await claim.connection.rollback();
    claim.connection.release();

    const [[responsabilidadCount]] = await adminConnection.execute(
      `SELECT COUNT(*) AS total FROM Responsables_Equipo WHERE codigo_equipo = 1`
    );
    const [[historialCount]] = await adminConnection.execute(
      `SELECT COUNT(*) AS total FROM Historial_Uso_Equipos WHERE codigo_equipo = 1`
    );
    expect(Number(responsabilidadCount.total)).toBe(0);
    expect(Number(historialCount.total)).toBe(0);
  });

  it('instala la migración de cierre una vez y deja un marcador verificable', async () => {
    await adminConnection.query('DROP PROCEDURE IF EXISTS sp_finalizar_clase');
    await expect(ensureRoutine()).resolves.toEqual({ applied: true });
    await expect(ensureRoutine()).resolves.toEqual({ applied: false });

    const [[routine]] = await adminConnection.query(
      `SELECT ROUTINE_COMMENT FROM INFORMATION_SCHEMA.ROUTINES
       WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'sp_finalizar_clase'`
    );
    expect(routine.ROUTINE_COMMENT).toContain(MIGRATION_VERSION);
  });

  it('cierra dos ejecuciones concurrentes sin dejar estado activo', async () => {
    await ensureRoutine();
    await seedClassUsage();
    const closerA = await mysql.createConnection(config);
    const closerB = await mysql.createConnection(config);
    try {
      await Promise.all([
        closerA.query("CALL sp_finalizar_clase(7, '2026-08-24 12:00:00')"),
        closerB.query("CALL sp_finalizar_clase(7, '2026-08-24 12:00:00')")
      ]);
    } finally {
      await closerA.end();
      await closerB.end();
    }

    const [[clase]] = await adminConnection.execute('SELECT estado_clase, fecha_fin_real FROM Clases WHERE id_clase = 7');
    const [[responsabilidad]] = await adminConnection.execute(
      `SELECT estado_responsabilidad FROM Responsabilidades_Ambiente WHERE id_clase = 7`
    );
    const [[responsable]] = await adminConnection.execute(
      `SELECT estado_responsabilidad FROM Responsables_Equipo WHERE codigo_equipo = 1`
    );
    const [[historialActivo]] = await adminConnection.execute(
      `SELECT COUNT(*) AS total FROM Historial_Uso_Equipos WHERE id_clase = 7 AND estado = 'En Uso'`
    );
    expect(clase.estado_clase).toBe('Finalizada');
    expect(clase.fecha_fin_real).not.toBeNull();
    expect(responsabilidad.estado_responsabilidad).toBe('Finalizada');
    expect(responsable.estado_responsabilidad).toBe('Finalizado');
    expect(Number(historialActivo.total)).toBe(0);
  });

  it('revierte todo el cierre si una actualización de historial falla', async () => {
    await ensureRoutine();
    await seedClassUsage();
    await adminConnection.query(`
      CREATE TRIGGER ${TRIGGER_NAME}
      BEFORE UPDATE ON Historial_Uso_Equipos
      FOR EACH ROW
      BEGIN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'MDL-71 forced history failure';
      END`
    );

    try {
      await expect(adminConnection.query("CALL sp_finalizar_clase(7, '2026-08-24 12:00:00')")).rejects.toMatchObject({ sqlState: '45000' });
    } finally {
      await adminConnection.query(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME}`);
    }

    const [[clase]] = await adminConnection.execute('SELECT estado_clase FROM Clases WHERE id_clase = 7');
    const [[responsabilidad]] = await adminConnection.execute(
      `SELECT estado_responsabilidad FROM Responsabilidades_Ambiente WHERE id_clase = 7`
    );
    const [[responsable]] = await adminConnection.execute(
      `SELECT estado_responsabilidad FROM Responsables_Equipo WHERE codigo_equipo = 1`
    );
    const [[historial]] = await adminConnection.execute(
      `SELECT estado FROM Historial_Uso_Equipos WHERE id_clase = 7`
    );
    expect(clase.estado_clase).toBe('En Curso');
    expect(responsabilidad.estado_responsabilidad).toBe('Activa');
    expect(responsable.estado_responsabilidad).toBe('Activo');
    expect(historial.estado).toBe('En Uso');
  });
});
