import { jest } from '@jest/globals';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listMigrationFiles, runMigrations } from '../../scripts/run-migrations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

function makeConnection({ recorded = [], lockGot = 1, failOn = null } = {}) {
  const executed = [];
  const inserted = [];
  const query = jest.fn(async (sql, params) => {
    if (/GET_LOCK/.test(sql)) return [[{ got: lockGot }]];
    if (/RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
    if (/CREATE TABLE IF NOT EXISTS schema_migrations/.test(sql)) return [{}];
    if (/SELECT filename, checksum FROM schema_migrations/.test(sql)) return [recorded];
    if (/INSERT INTO schema_migrations/.test(sql)) {
      inserted.push(params);
      return [{ affectedRows: 1 }];
    }
    executed.push(sql);
    if (failOn && sql.includes(failOn)) {
      const error = new Error('boom');
      error.code = 'ER_TEST';
      throw error;
    }
    return [{}];
  });
  return { query, executed, inserted };
}

describe('run-migrations (preDeploy de Railway)', () => {
  let dir;
  const log = { log: jest.fn(), warn: jest.fn() };

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'sgi-migrations-'));
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('aplica las pendientes en orden alfabético, las registra y libera el bloqueo', async () => {
    await writeFile(path.join(dir, '20261002_b.sql'), 'SELECT 2;');
    await writeFile(path.join(dir, '20261001_a.sql'), 'SELECT 1;');
    await writeFile(path.join(dir, 'README.md'), 'ignorado');
    const connection = makeConnection();

    const result = await runMigrations({ connection, dir, log });

    expect(result.applied).toEqual(['20261001_a.sql', '20261002_b.sql']);
    expect(connection.executed).toEqual(['SELECT 1;', 'SELECT 2;']);
    expect(connection.inserted.map(([file]) => file)).toEqual(['20261001_a.sql', '20261002_b.sql']);
    expect(connection.inserted[0][1]).toMatch(/^[a-f0-9]{64}$/);
    const lastSql = connection.query.mock.calls.at(-1)[0];
    expect(lastSql).toMatch(/RELEASE_LOCK/);
  });

  it('no re-ejecuta las ya registradas', async () => {
    await writeFile(path.join(dir, '20261001_a.sql'), 'SELECT 1;');
    const first = makeConnection();
    await runMigrations({ connection: first, dir, log });
    const digest = first.inserted[0][1];

    const second = makeConnection({ recorded: [{ filename: '20261001_a.sql', checksum: digest }] });
    const result = await runMigrations({ connection: second, dir, log });

    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual(['20261001_a.sql']);
    expect(second.executed).toEqual([]);
    expect(second.inserted).toEqual([]);
  });

  it('avisa si una migración ya aplicada cambió, sin re-ejecutarla ni fallar', async () => {
    await writeFile(path.join(dir, '20261001_a.sql'), 'SELECT 1; -- editada');
    const connection = makeConnection({
      recorded: [{ filename: '20261001_a.sql', checksum: 'otro-checksum' }],
    });

    const result = await runMigrations({ connection, dir, log });

    expect(result.changed).toEqual(['20261001_a.sql']);
    expect(connection.executed).toEqual([]);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('20261001_a.sql'));
  });

  it('se detiene en la primera que falla: error con el archivo, sin registrarla y liberando el bloqueo', async () => {
    await writeFile(path.join(dir, '20261001_a.sql'), 'SELECT 1;');
    await writeFile(path.join(dir, '20261002_b.sql'), 'ALTER TABLE rota;');
    await writeFile(path.join(dir, '20261003_c.sql'), 'SELECT 3;');
    const connection = makeConnection({ failOn: 'ALTER TABLE rota' });

    await expect(runMigrations({ connection, dir, log })).rejects.toThrow(/20261002_b\.sql.*ER_TEST/);

    expect(connection.inserted.map(([file]) => file)).toEqual(['20261001_a.sql']);
    expect(connection.executed).not.toContain('SELECT 3;');
    expect(connection.query.mock.calls.at(-1)[0]).toMatch(/RELEASE_LOCK/);
  });

  it('falla si no obtiene el bloqueo (otra ejecución en curso) y no corre nada', async () => {
    await writeFile(path.join(dir, '20261001_a.sql'), 'SELECT 1;');
    const connection = makeConnection({ lockGot: 0 });

    await expect(runMigrations({ connection, dir, log })).rejects.toThrow(/bloqueo/);
    expect(connection.executed).toEqual([]);
  });

  it('la carpeta real de migraciones solo contiene .sql con prefijo de fecha y token_version está incluida', async () => {
    const files = await listMigrationFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file).toMatch(/^\d{8}_[a-z0-9_]+\.sql$/);
    expect(files).toContain('20261001_mdl229_token_version.sql');
  });
});

describe('Railway ejecuta las migraciones antes de desplegar', () => {
  it('railway.toml y railway.json declaran preDeployCommand con el runner', async () => {
    const toml = await readFile(path.join(repoRoot, 'railway.toml'), 'utf8');
    const json = JSON.parse(await readFile(path.join(repoRoot, 'railway.json'), 'utf8'));

    expect(toml).toMatch(/^preDeployCommand\s*=\s*\[.*run-migrations\.js.*\]/m);
    expect(json.deploy.preDeployCommand.join(' ')).toContain('run-migrations.js');
  });

  it('el comando apunta a un archivo que existe dentro de backend/scripts', async () => {
    const script = await readFile(path.join(repoRoot, 'backend/scripts/run-migrations.js'), 'utf8');
    expect(script).toContain('export async function runMigrations');
  });
});
