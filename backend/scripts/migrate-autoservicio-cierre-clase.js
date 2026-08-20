import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createConnection } from '../src/config/dbconfig.js';

const VERSION = 'AUTOSERVICIO_CIERRE_V1';
const ROUTINE = 'sp_finalizar_clase';
const VALIDATION_ROUTINE = 'sp_finalizar_clase_mdl77_validation';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const definitionPath = path.join(__dirname, 'migrate-autoservicio-cierre-clase.sql');

const createValidationSql = (migrationSql) => migrationSql.replace(
  /CREATE\s+PROCEDURE\s+`?sp_finalizar_clase`?/i,
  `CREATE PROCEDURE ${VALIDATION_ROUTINE}`
);

const getCreateProcedure = (rows) => rows?.[0]?.['Create Procedure'] || null;

async function readMigrationSql() {
  return readFile(definitionPath, 'utf8');
}

async function restoreBackup(connection, backup, originalError) {
  if (!backup) throw originalError;
  try {
    await connection.query(backup);
  } catch (restoreError) {
    throw new AggregateError(
      [originalError, restoreError],
      `No se pudo crear ${ROUTINE} ni restaurar su respaldo`
    );
  }
  throw originalError;
}

export async function runAutoservicioCierreMigration({ connection, migrationSql = null }) {
  const sql = migrationSql || await readMigrationSql();
  const [[routine]] = await connection.query(
    `SELECT ROUTINE_COMMENT FROM INFORMATION_SCHEMA.ROUTINES
     WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = '${ROUTINE}'`
  );
  if (routine?.ROUTINE_COMMENT?.includes(VERSION)) return { applied: false };

  let backup = null;
  try {
    const [backupRows] = await connection.query(`SHOW CREATE PROCEDURE ${ROUTINE}`);
    backup = getCreateProcedure(backupRows);
  } catch (error) {
    if (error.code !== 'ER_SP_DOES_NOT_EXIST') throw error;
  }

  try {
    await connection.query(createValidationSql(sql));
  } finally {
    await connection.query(`DROP PROCEDURE IF EXISTS ${VALIDATION_ROUTINE}`);
  }

  if (backup) await connection.query(`DROP PROCEDURE ${ROUTINE}`);
  try {
    await connection.query(sql);
  } catch (error) {
    await restoreBackup(connection, backup, error);
  }
  return { applied: true };
}

async function runCli() {
  const connection = await createConnection();
  try {
    const result = await runAutoservicioCierreMigration({ connection });
    console.log(result.applied ? `${ROUTINE} actualizado a ${VERSION}` : `${ROUTINE} ya tiene ${VERSION}`);
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error('Falló la migración de autoservicio:', error);
    process.exitCode = 1;
  });
}
