import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import { getMigrationDbConfig } from './migrate-autoservicio-cierre-clase.js';

/**
 * Aplica backend/migrations/*.sql en orden alfabético (el prefijo AAAAMMDD
 * define el orden) y registra cada archivo en schema_migrations.
 *
 * Se ejecuta como preDeployCommand de Railway: si falla, Railway NO despliega
 * la versión nueva y deja corriendo la anterior. Así el código que lee una
 * columna nueva nunca llega a producción sin su migración (incidente MDL-229).
 *
 * Reglas para los archivos .sql:
 * - Idempotentes (re-ejecutar no cambia nada): la primera corrida en un
 *   ambiente que ya los aplicó a mano los vuelve a ejecutar y los registra.
 * - Aditivos y compatibles con la versión anterior del código, porque en un
 *   rollback la versión vieja sigue corriendo sobre el esquema nuevo.
 */

const DEFAULT_MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../migrations',
);
const LOCK_NAME = 'sgi_schema_migrations';
const LOCK_TIMEOUT_SECONDS = 60;

const checksum = (sql) => createHash('sha256').update(sql).digest('hex');

export async function listMigrationFiles(dir = DEFAULT_MIGRATIONS_DIR) {
  const entries = await readdir(dir);
  return entries.filter((name) => name.endsWith('.sql')).sort();
}

export async function runMigrations({
  connection,
  dir = DEFAULT_MIGRATIONS_DIR,
  log = console,
} = {}) {
  const files = await listMigrationFiles(dir);

  await connection.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename VARCHAR(255) NOT NULL PRIMARY KEY,
       checksum CHAR(64) NOT NULL,
       applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );

  // Dos despliegues simultáneos no deben correr las mismas migraciones a la vez.
  const [[lock]] = await connection.query('SELECT GET_LOCK(?, ?) AS got', [
    LOCK_NAME,
    LOCK_TIMEOUT_SECONDS,
  ]);
  if (Number(lock?.got) !== 1) {
    throw new Error(
      `No se obtuvo el bloqueo de migraciones en ${LOCK_TIMEOUT_SECONDS}s; otra ejecución sigue en curso`,
    );
  }

  const result = { applied: [], skipped: [], changed: [] };
  try {
    const [rows] = await connection.query('SELECT filename, checksum FROM schema_migrations');
    const recorded = new Map(rows.map((row) => [row.filename, row.checksum]));

    for (const file of files) {
      const sql = await readFile(path.join(dir, file), 'utf8');
      const digest = checksum(sql);

      if (recorded.has(file)) {
        if (recorded.get(file) !== digest) {
          // Editar una migración ya aplicada no la vuelve a ejecutar: crear una nueva.
          log.warn(`Migración ${file} cambió después de aplicarse; no se re-ejecuta. Cree una migración nueva.`);
          result.changed.push(file);
        }
        result.skipped.push(file);
        continue;
      }

      log.log(`Aplicando migración ${file}...`);
      try {
        await connection.query(sql);
      } catch (error) {
        throw new Error(`Falló la migración ${file}: ${error.code || ''} ${error.message}`.trim(), {
          cause: error,
        });
      }
      await connection.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)',
        [file, digest],
      );
      result.applied.push(file);
    }
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]).catch(() => {});
  }

  log.log(
    result.applied.length === 0
      ? 'Migraciones: nada pendiente'
      : `Migraciones aplicadas: ${result.applied.join(', ')}`,
  );
  return result;
}

async function runCli() {
  const connection = await mysql.createConnection({
    ...getMigrationDbConfig(),
    multipleStatements: true,
  });
  try {
    await runMigrations({ connection });
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
