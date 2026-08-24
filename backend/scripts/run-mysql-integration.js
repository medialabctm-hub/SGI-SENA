import { spawn, spawnSync } from 'node:child_process';

const image = process.env.MYSQL_TEST_DOCKER_IMAGE || 'mysql:8.0';
const password = process.env.MYSQL_TEST_PASSWORD || 'mdl71_ephemeral_password';
const database = process.env.MYSQL_TEST_DATABASE || 'sgi_mdl71';
const containerName = `sgi-mdl71-mysql-${Date.now().toString(36)}`;

function runDocker(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`docker ${args.join(' ')} falló${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout;
}

function runJest(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--forceExit', 'tests/integration/equipmentClaim.mysql.test.js'],
      { env, stdio: 'inherit' }
    );
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function runAgainstProvidedMysql() {
  const required = ['MYSQL_TEST_HOST', 'MYSQL_TEST_USER', 'MYSQL_TEST_DATABASE'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Faltan variables para MySQL externo: ${missing.join(', ')}`);
  }
  return runJest({ ...process.env, RUN_MYSQL_INTEGRATION: '1' });
}

async function runEphemeralMysql() {
  const port = Number(process.env.MYSQL_TEST_DOCKER_PORT || 33306);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('MYSQL_TEST_DOCKER_PORT debe ser un puerto entero positivo');
  }
  const env = {
    ...process.env,
    RUN_MYSQL_INTEGRATION: '1',
    MYSQL_TEST_HOST: '127.0.0.1',
    MYSQL_TEST_PORT: String(port),
    MYSQL_TEST_USER: 'root',
    MYSQL_TEST_PASSWORD: password,
    MYSQL_TEST_DATABASE: database
  };
  let started = false;
  try {
    runDocker([
      'run', '--detach', '--name', containerName,
      '--env', `MYSQL_ROOT_PASSWORD=${password}`,
      '--env', `MYSQL_DATABASE=${database}`,
      '--publish', `127.0.0.1:${port}:3306`, image
    ], { stdio: 'pipe' });
    started = true;
    // La imagen puede reiniciar mysqld durante la inicialización; esperar el
    // ciclo completo evita arrancar Jest contra el servidor temporal.
    await new Promise((resolve) => {
      setTimeout(resolve, 45000);
    });
    return runJest(env);
  } finally {
    if (started) {
      runDocker(['rm', '--force', containerName], { stdio: 'ignore' });
    }
  }
}

const main = async () => {
  const exitCode = process.env.MYSQL_TEST_HOST
    ? await runAgainstProvidedMysql()
    : await runEphemeralMysql();
  process.exitCode = exitCode;
};

main().catch((error) => {
  console.error(`Falló la preparación de la prueba MySQL: ${error.message}`);
  process.exitCode = 1;
});
