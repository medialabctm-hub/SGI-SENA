import { jest, describe, it, expect } from '@jest/globals';

const {
  mysqlAdminPing,
  runEphemeralMysql,
  waitForMysqlReady,
  ensureLogBinTrustFunctionCreators,
} = await import('../../scripts/run-mysql-integration.js');

const testEnvironment = {
  PATH: process.env.PATH,
  MYSQL_TEST_PASSWORD: 'password-for-tests-only',
  MYSQL_TEST_DATABASE: 'sgi_test',
  MYSQL_TEST_DOCKER_PORT: '33306',
  MYSQL_TEST_READY_TIMEOUT_MS: '100',
  MYSQL_TEST_READY_INTERVAL_MS: '10',
};

describe('runner de integración MySQL', () => {
  it('hace polling hasta que mysqladmin confirma readiness', async () => {
    let elapsed = 0;
    const attempts = [];

    await waitForMysqlReady({
      host: '127.0.0.1',
      port: 33306,
      user: 'root',
      password: 'password-for-tests-only',
      timeoutMs: 100,
      intervalMs: 10,
      now: () => elapsed,
      sleep: async (milliseconds) => {
        elapsed += milliseconds;
      },
      ping: async () => {
        attempts.push(elapsed);
        return attempts.length === 3;
      },
    });

    expect(attempts).toEqual([0, 10, 20]);
  });

  it('falla con timeout acotado si MySQL nunca queda listo', async () => {
    let elapsed = 0;

    await expect(waitForMysqlReady({
      host: '127.0.0.1',
      port: 33306,
      user: 'root',
      password: 'password-for-tests-only',
      timeoutMs: 25,
      intervalMs: 10,
      now: () => elapsed,
      sleep: async (milliseconds) => {
        elapsed += milliseconds;
      },
      ping: async () => false,
    })).rejects.toThrow(/timeout/i);

    expect(elapsed).toBe(25);
  });

  it('usa MYSQL_PWD y no pone la contraseña en argumentos de mysqladmin', () => {
    const spawnSync = jest.fn(() => ({ status: 0, stdout: 'mysqld is alive', stderr: '' }));
    const password = 'password-that-must-not-be-an-argument';

    expect(mysqlAdminPing({
      host: '127.0.0.1',
      port: 33306,
      user: 'root',
      password,
      spawnSyncImpl: spawnSync,
      environment: { PATH: process.env.PATH },
    })).toBe(true);

    const [command, args, options] = spawnSync.mock.calls[0];
    expect(command).toBe('mysqladmin');
    expect(args).not.toContain(password);
    expect(args.join(' ')).not.toMatch(/password/i);
    expect(options.env.MYSQL_PWD).toBe(password);
  });

  it('limpia el contenedor después de éxito, timeout y error de Jest', async () => {
    const runDockerCommand = jest.fn();
    const runJestCommand = jest.fn().mockResolvedValue(0);
    const waitForReady = jest.fn().mockResolvedValue(undefined);

    await expect(runEphemeralMysql({
      environment: testEnvironment,
      runDockerCommand,
      runJestCommand,
      waitForReady,
    })).resolves.toBe(0);

    expect(runDockerCommand).toHaveBeenCalledTimes(2);
    expect(runDockerCommand.mock.calls[1][0][0]).toBe('rm');
    expect(runDockerCommand.mock.calls[0][0]).not.toContain(testEnvironment.MYSQL_TEST_PASSWORD);

    runDockerCommand.mockClear();
    runJestCommand.mockReset();
    waitForReady.mockRejectedValueOnce(new Error('readiness timeout'));

    await expect(runEphemeralMysql({
      environment: testEnvironment,
      runDockerCommand,
      runJestCommand,
      waitForReady,
    })).rejects.toThrow('readiness timeout');

    expect(runDockerCommand).toHaveBeenCalledTimes(2);
    expect(runDockerCommand.mock.calls[1][0][0]).toBe('rm');

    runDockerCommand.mockClear();
    waitForReady.mockResolvedValueOnce(undefined);
    runJestCommand.mockRejectedValueOnce(new Error('Jest failed'));

    await expect(runEphemeralMysql({
      environment: testEnvironment,
      runDockerCommand,
      runJestCommand,
      waitForReady,
    })).rejects.toThrow('Jest failed');

    expect(runDockerCommand).toHaveBeenCalledTimes(2);
    expect(runDockerCommand.mock.calls[1][0][0]).toBe('rm');
  });

  it('aplica SET GLOBAL log_bin_trust_function_creators cuando hay permiso', async () => {
    const query = jest.fn().mockResolvedValue([[]]);
    const end = jest.fn().mockResolvedValue(undefined);
    const createConnection = jest.fn().mockResolvedValue({ query, end });
    const log = { log: jest.fn(), warn: jest.fn() };

    await ensureLogBinTrustFunctionCreators({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'x',
      createConnection,
      log,
    });

    expect(query).toHaveBeenCalledWith('SET GLOBAL log_bin_trust_function_creators = 1');
    expect(end).toHaveBeenCalled();
    expect(log.log).toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('avisa y continúa si SET GLOBAL no está permitido', async () => {
    const createConnection = jest.fn().mockRejectedValue(new Error('Access denied'));
    const log = { log: jest.fn(), warn: jest.fn() };

    await expect(ensureLogBinTrustFunctionCreators({
      host: '127.0.0.1',
      port: 3306,
      user: 'app',
      password: 'x',
      createConnection,
      log,
    })).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/Continuando/));
  });
});
