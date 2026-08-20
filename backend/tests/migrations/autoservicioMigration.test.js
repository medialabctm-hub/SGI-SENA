import { jest } from '@jest/globals';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(__dirname, '../../scripts/migrate-autoservicio-cierre-clase.sql');

async function importControllerWithDb(execute) {
  jest.resetModules();
  await jest.unstable_mockModule(path.resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
    default: { execute },
    pool: { query: jest.fn() }
  }));
  await jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/logger.js'), () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
  }));
  await jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/notificationService.js'), () => ({ notifyNuevoEquipo: jest.fn() }));
  await jest.unstable_mockModule(path.resolve(__dirname, '../../src/factories/ServiceFactory.js'), () => ({ ServiceFactory: { create: jest.fn() } }));
  await jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/sqlQueries.js'), () => ({
    obtenerEquipoPorCodigo: jest.fn(),
    obtenerUsuarioPorCedula: jest.fn(),
    verificarDisponibilidadEquipo: jest.fn(),
    verificarAmbienteEquipoAprendiz: jest.fn()
  }));
  await jest.unstable_mockModule(path.resolve(__dirname, '../../src/middleware/uploadMiddleware.js'), () => ({
    getImagePath: jest.fn(),
    deleteImageFile: jest.fn()
  }));
  await jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/socketService.js'), () => ({ default: { emitToAll: jest.fn() } }));
  return import(path.resolve(__dirname, '../../src/controller/equiposController.js'));
}

describe('MDL-77: bootstrap y readiness de autoservicio', () => {
  it('permite una ejecución limpia mediante un guard de versión antes de crear la rutina', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toMatch(/INFORMATION_SCHEMA\.ROUTINES/i);
    expect(sql).toMatch(/AUTOSERVICIO_CIERRE_V1/);
  });

  it('permite una segunda ejecución sin un DROP PROCEDURE incondicional', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toMatch(/IF\s+v_routine_comment\s+NOT LIKE\s+'%AUTOSERVICIO_CIERRE_V1%'.*?DROP PROCEDURE IF EXISTS sp_finalizar_clase/s);
    expect(sql).not.toMatch(/DELIMITER\s+\/\/\s*DROP PROCEDURE IF EXISTS sp_finalizar_clase/i);
  });

  it('reporta la versión cuando el esquema limpio ya contiene columnas, índices y rutina requeridos', async () => {
    const execute = jest.fn(async (sql) => {
      if (/COLUMN_NAME = 'id_usuario'/.test(sql)) return [[{ IS_NULLABLE: 'YES' }]];
      if (/COLUMN_NAME IN/.test(sql)) {
        return [[
          { COLUMN_NAME: 'id_usuario', IS_NULLABLE: 'YES' },
          { COLUMN_NAME: 'documento_externo' },
          { COLUMN_NAME: 'nombre_externo' },
          { COLUMN_NAME: 'id_aprendiz' },
          { COLUMN_NAME: 'idempotency_key' }
        ]];
      }
      if (/INFORMATION_SCHEMA\.STATISTICS/.test(sql)) {
        return [[
          { INDEX_NAME: 'idx_documento_externo' },
          { INDEX_NAME: 'idx_id_aprendiz' },
          { INDEX_NAME: 'uq_autoservicio_idempotency_key' }
        ]];
      }
      if (/INFORMATION_SCHEMA\.ROUTINES/.test(sql)) return [[{ ROUTINE_COMMENT: 'AUTOSERVICIO_CIERRE_V1' }]];
      return [[]];
    });
    const { ensureAutoservicioSchema } = await importControllerWithDb(execute);

    await expect(ensureAutoservicioSchema({ execute })).resolves.toEqual({
      ready: true,
      migrationVersion: 'AUTOSERVICIO_CIERRE_V1',
      missing: []
    });
  });

  it('rechaza readiness cuando el esquema queda parcial porque falta el marcador de la rutina', async () => {
    const execute = jest.fn(async (sql) => {
      if (/COLUMN_NAME = 'id_usuario'/.test(sql)) return [[{ IS_NULLABLE: 'YES' }]];
      if (/COLUMN_NAME IN/.test(sql)) {
        return [[
          { COLUMN_NAME: 'id_usuario', IS_NULLABLE: 'YES' },
          { COLUMN_NAME: 'documento_externo' },
          { COLUMN_NAME: 'nombre_externo' },
          { COLUMN_NAME: 'id_aprendiz' },
          { COLUMN_NAME: 'idempotency_key' }
        ]];
      }
      if (/INFORMATION_SCHEMA\.STATISTICS/.test(sql)) {
        return [[
          { INDEX_NAME: 'idx_documento_externo' },
          { INDEX_NAME: 'idx_id_aprendiz' },
          { INDEX_NAME: 'uq_autoservicio_idempotency_key' }
        ]];
      }
      if (/INFORMATION_SCHEMA\.ROUTINES/.test(sql)) return [[{ ROUTINE_COMMENT: '' }]];
      return [[]];
    });
    const { ensureAutoservicioSchema } = await importControllerWithDb(execute);

    await expect(ensureAutoservicioSchema({ execute })).rejects.toThrow(
      /AUTOSERVICIO_CIERRE_V1.*migrate-autoservicio-cierre-clase/i
    );
  });
});
