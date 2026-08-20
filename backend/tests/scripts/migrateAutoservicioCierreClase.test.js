import { jest } from '@jest/globals';

const migrationSql = "CREATE PROCEDURE sp_finalizar_clase() COMMENT 'AUTOSERVICIO_CIERRE_V1' BEGIN SELECT 1; END";

describe('runner MySQL 8 de migración de cierre de autoservicio', () => {
  it('no altera la rutina cuando el marcador ya está instalado', async () => {
    const { runAutoservicioCierreMigration } = await import('../../scripts/migrate-autoservicio-cierre-clase.js');
    const connection = { query: jest.fn().mockResolvedValueOnce([[{ ROUTINE_COMMENT: 'AUTOSERVICIO_CIERRE_V1' }]]) };

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
});
