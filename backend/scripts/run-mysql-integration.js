import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_READY_TIMEOUT_MS = 120000;
const DEFAULT_READY_INTERVAL_MS = 1000;

function redactText(value, redactions = []) {
  return redactions
    .filter((secret) => typeof secret === 'string' && secret.length > 0)
    .reduce((text, secret) => text.split(secret).join('[redacted]'), String(value));
}

export function runDocker(args, options = {}) {
  const { redactions = [], ...spawnOptions } = options;
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    ...spawnOptions,
  });

  if (result.error) {
    throw new Error(`No se pudo ejecutar Docker: ${redactText(result.error.message, redactions)}`);
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    const safeDetail = redactText(detail, redactions);
    const command = args.slice(0, 2).join(' ');
    throw new Error(`docker ${command} falló${safeDetail ? `: ${safeDetail}` : ''}`);
  }
  return result.stdout;
}

function runJest(environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--experimental-vm-modules',
        'node_modules/jest/bin/jest.js',
        '--runInBand',
        '--forceExit',
        'tests/integration/equipmentClaim.mysql.test.js',
      ],
      { env: environment, stdio: 'inherit' },
    );
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

function positiveIntegerFromEnvironment(environment, name, fallback) {
  const value = environment[name] === undefined ? fallback : Number(environment[name]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} debe ser un entero positivo en milisegundos`);
  }
  return value;
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function createDockerEnvironmentFile(password, database) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sgi-mdl71-'));
  const filePath = path.join(directory, 'mysql.env');
  try {
    await writeFile(
      filePath,
      `MYSQL_ROOT_PASSWORD=${password}\nMYSQL_DATABASE=${database}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    filePath,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

export function mysqlAdminPing({
  host,
  port,
  user,
  password,
  containerName,
  spawnSyncImpl = spawnSync,
  environment = process.env,
}) {
  const pingEnvironment = { ...environment };
  if (password === undefined) {
    delete pingEnvironment.MYSQL_PWD;
  } else {
    pingEnvironment.MYSQL_PWD = password;
  }

  let result;
  try {
    const command = containerName ? 'docker' : 'mysqladmin';
    const args = containerName
      ? [
        'exec',
        containerName,
        'sh',
        '-c',
        `MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqladmin ping --protocol=tcp --host ${host} --port ${String(port)} --user ${user}`,
      ]
      : ['ping', '--protocol=tcp', '--host', host, '--port', String(port), '--user', user];
    result = spawnSyncImpl(
      command,
      args,
      {
        encoding: 'utf8',
        env: pingEnvironment,
        stdio: 'pipe',
      },
    );
  } catch {
    return false;
  }

  return !result.error && result.status === 0;
}

export async function waitForMysqlReady({
  host,
  port,
  user,
  password,
  timeoutMs = DEFAULT_READY_TIMEOUT_MS,
  intervalMs = DEFAULT_READY_INTERVAL_MS,
  ping = mysqlAdminPing,
  sleep: sleepImpl = sleep,
  now = Date.now,
}) {
  const deadline = now() + timeoutMs;

  while (true) {
    try {
      if (await ping({ host, port, user, password })) {
        return;
      }
    } catch {
      // A connection refusal is expected while MySQL initializes. Keep polling
      // until the bounded deadline and report one stable diagnostic below.
    }

    const remainingMs = deadline - now();
    if (remainingMs <= 0) {
      break;
    }
    await sleepImpl(Math.min(intervalMs, remainingMs));
  }

  throw new Error(`MySQL no estuvo listo dentro del timeout de ${timeoutMs} ms`);
}

export async function runAgainstProvidedMysql(environment = process.env) {
  const required = ['MYSQL_TEST_HOST', 'MYSQL_TEST_USER', 'MYSQL_TEST_DATABASE'];
  const missing = required.filter((key) => !environment[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables para MySQL externo: ${missing.join(', ')}`);
  }
  return runJest({ ...environment, RUN_MYSQL_INTEGRATION: '1' });
}

export async function runEphemeralMysql({
  environment = process.env,
  runDockerCommand = runDocker,
  runJestCommand = runJest,
  waitForReady = waitForMysqlReady,
} = {}) {
  const image = environment.MYSQL_TEST_DOCKER_IMAGE || 'mysql:8.0';
  const password = environment.MYSQL_TEST_PASSWORD || 'mdl71_ephemeral_password';
  const database = environment.MYSQL_TEST_DATABASE || 'sgi_mdl71';
  const port = Number(environment.MYSQL_TEST_DOCKER_PORT || 33306);
  const timeoutMs = positiveIntegerFromEnvironment(
    environment,
    'MYSQL_TEST_READY_TIMEOUT_MS',
    DEFAULT_READY_TIMEOUT_MS,
  );
  const intervalMs = positiveIntegerFromEnvironment(
    environment,
    'MYSQL_TEST_READY_INTERVAL_MS',
    DEFAULT_READY_INTERVAL_MS,
  );

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('MYSQL_TEST_DOCKER_PORT debe ser un puerto entero positivo');
  }

  const containerName = `sgi-mdl71-mysql-${Date.now().toString(36)}`;
  const jestEnvironment = {
    ...environment,
    RUN_MYSQL_INTEGRATION: '1',
    MYSQL_TEST_HOST: '127.0.0.1',
    MYSQL_TEST_PORT: String(port),
    MYSQL_TEST_USER: 'root',
    MYSQL_TEST_PASSWORD: password,
    MYSQL_TEST_DATABASE: database,
  };
  const dockerEnvironmentFile = await createDockerEnvironmentFile(password, database);

  let cleanupRequired = false;
  try {
    // The env file path is safe to pass as an argument; its contents never enter
    // Docker's command line or diagnostics.
    cleanupRequired = true;
    runDockerCommand(
      [
        'run',
        '--detach',
        '--name',
        containerName,
        '--env-file',
        dockerEnvironmentFile.filePath,
        '--publish',
        `127.0.0.1:${port}:3306`,
        image,
      ],
      { redactions: [password], stdio: 'pipe' },
    );

    await waitForReady({
      host: '127.0.0.1',
      port,
      user: 'root',
      password,
      timeoutMs,
      intervalMs,
      ping: ({ password: pingPassword }) => mysqlAdminPing({
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: pingPassword,
        containerName,
      }),
    });
    return await runJestCommand(jestEnvironment);
  } finally {
    if (cleanupRequired) {
      try {
        runDockerCommand(['rm', '--force', containerName], { stdio: 'ignore' });
      } catch {
        // Preserve the readiness or test error; cleanup is best effort and is
        // attempted on success, timeout, and every failure after docker run.
      }
    }
    try {
      await dockerEnvironmentFile.cleanup();
    } catch {
      // Preserve the readiness or test error if temporary credential cleanup fails.
    }
  }
}

export async function main(environment = process.env) {
  const exitCode = environment.MYSQL_TEST_HOST
    ? await runAgainstProvidedMysql(environment)
    : await runEphemeralMysql({ environment });
  process.exitCode = exitCode;
  return exitCode;
}

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((error) => {
    console.error(`Falló la preparación de la prueba MySQL: ${error.message}`);
    process.exitCode = 1;
  });
}
