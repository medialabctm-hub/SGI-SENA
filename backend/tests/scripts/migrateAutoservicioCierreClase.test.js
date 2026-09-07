import { jest } from '@jest/globals';

const migrationSql = "CREATE PROCEDURE sp_finalizar_clase() COMMENT 'AUTOSERVICIO_CIERRE_V2' BEGIN SELECT 1; END";

describe('runner MySQL 8 de migración de cierre de autoservicio', () => {
  it('crea conexión solo con DB_* sin importar configuración global de la aplicación', async () => {
    const { createMigrationConnection } = await import('../../scripts/migrate-autoservicio-cierre-clase.js');
    const createConnection = jest.fn().mockResolvedValue({ end: jest.fn() });

    await createMigrationConnection({
      DB_HOST: 'db.example',
      DB_USER: 'admin',
      DB_PASSWORD: 'secret',
      DB_NAME: 'sgi',
      DB_PORT: '3307'
    }, createConnection);

    expect(createConnection).toHaveBeenCalledWith({
      host: 'db.example', user: 'admin', password: 'secret', database: 'sgi', port: 3307, charset: 'utf8mb4'
    });
  });

  it('no altera la rutina cuando el marcador ya está instalado', async () => {
    const { runAutoservicioCierreMigration } = await import('../../scripts/migrate-autoservicio-cierre-clase.js');
    const connection = { query: jest.fn().mockResolvedValueOnce([[{ ROUTINE_COMMENT: 'AUTOSERVICIO_CIERRE_V2' }]]) };

    await expect(runAutoservicioCierreMigration({ connection, migrationSql })).resolves.toEqual({ applied: false });
    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  it('restaura la rutina respaldada si la creación de destino falla después del DROP', async () => {
    const { runAutoservicioCierreMigration } = await import('../../scripts/migrate-autoservicio-cierre-clase.js');
    const backup = 'CREATE DEFINER=`root`@`%` PROCEDURE `sp_finalizar_clase`() SELECT 0';
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ ROUTINE_COMMENT: '' }]])
        .mockResolvedValueOnce([[{ 'Create Procedure': backup }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]])
        .mockRejectedValueOnce(new Error('syntax error creating target'))
        .mockResolvedValueOnce([[]])
    };

    await expect(runAutoservicioCierreMigration({ connection, migrationSql })).rejects.toThrow('syntax error creating target');
    expect(connection.query).toHaveBeenCalledWith(backup);
  });

  it('limpia la rutina temporal de validación cuando falla la validación previa', async () => {
    const { runAutoservicioCierreMigration } = await import('../../scripts/migrate-autoservicio-cierre-clase.js');
    const routineMissing = Object.assign(new Error('routine missing'), { code: 'ER_SP_DOES_NOT_EXIST' });
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ ROUTINE_COMMENT: '' }]])
        .mockRejectedValueOnce(routineMissing)
        .mockRejectedValueOnce(new Error('syntax error validating target'))
        .mockResolvedValueOnce([[]])
    };

    await expect(runAutoservicioCierreMigration({ connection, migrationSql })).rejects.toThrow('syntax error validating target');
    expect(connection.query).toHaveBeenLastCalledWith('DROP PROCEDURE IF EXISTS sp_finalizar_clase_mdl77_validation');
  });

  it('crea desde rutina ausente y deja la segunda invocación como no-op', async () => {
    const { runAutoservicioCierreMigration } = await import('../../scripts/migrate-autoservicio-cierre-clase.js');
    let routineComment = null;
    const calls = [];
    const connection = {
      query: jest.fn(async (sql) => {
        calls.push(sql);
        if (/SELECT ROUTINE_COMMENT/.test(sql)) return [[routineComment ? { ROUTINE_COMMENT: routineComment } : undefined]];
        if (/SHOW CREATE PROCEDURE/.test(sql)) throw Object.assign(new Error('missing'), { code: 'ER_SP_DOES_NOT_EXIST' });
        if (/CREATE PROCEDURE sp_finalizar_clase\(\)/.test(sql)) routineComment = 'AUTOSERVICIO_CIERRE_V2';
        return [[]];
      })
    };

    await expect(runAutoservicioCierreMigration({ connection, migrationSql })).resolves.toEqual({ applied: true });
    await expect(runAutoservicioCierreMigration({ connection, migrationSql })).resolves.toEqual({ applied: false });
    expect(calls).toEqual(expect.arrayContaining([
      expect.stringMatching(/CREATE PROCEDURE sp_finalizar_clase_mdl77_validation/),
      'DROP PROCEDURE IF EXISTS sp_finalizar_clase_mdl77_validation',
      migrationSql
    ]));
  });
});
