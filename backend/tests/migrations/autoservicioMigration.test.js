import { jest } from '@jest/globals';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(__dirname, '../../scripts/migrate-autoservicio-cierre-clase.sql');
const serverPath = path.resolve(__dirname, '../../server.js');

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
  it('declara la rutina sin PREPARE, EXECUTE ni SQL dinámico no soportado por MySQL 8', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toMatch(/CREATE PROCEDURE sp_finalizar_clase/i);
    expect(sql).not.toMatch(/^\s*(PREPARE|EXECUTE|DEALLOCATE)\b/im);
  });

  it('mantiene la definición sin DROP para que el runner pueda restaurar la rutina previa', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).not.toMatch(/^\s*DROP PROCEDURE\b/im);
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
          { INDEX_NAME: 'idx_documento_externo', COLUMN_NAME: 'documento_externo', SEQ_IN_INDEX: 1, NON_UNIQUE: 1 },
          { INDEX_NAME: 'idx_id_aprendiz', COLUMN_NAME: 'id_aprendiz', SEQ_IN_INDEX: 1, NON_UNIQUE: 1 },
          { INDEX_NAME: 'uq_autoservicio_idempotency_key', COLUMN_NAME: 'idempotency_key', SEQ_IN_INDEX: 1, NON_UNIQUE: 0 }
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
      /AUTOSERVICIO_CIERRE_V1.*migrate-autoservicio-cierre-clase\.js/i
    );
  });

  it('rechaza un índice con el nombre correcto pero columna, orden o unicidad incorrecta', async () => {
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
          { INDEX_NAME: 'idx_documento_externo', COLUMN_NAME: 'id_aprendiz', SEQ_IN_INDEX: 1, NON_UNIQUE: 1 },
          { INDEX_NAME: 'idx_id_aprendiz', COLUMN_NAME: 'id_aprendiz', SEQ_IN_INDEX: 1, NON_UNIQUE: 1 },
          { INDEX_NAME: 'uq_autoservicio_idempotency_key', COLUMN_NAME: 'idempotency_key', SEQ_IN_INDEX: 1, NON_UNIQUE: 1 }
        ]];
      }
      if (/INFORMATION_SCHEMA\.ROUTINES/.test(sql)) return [[{ ROUTINE_COMMENT: 'AUTOSERVICIO_CIERRE_V1' }]];
      return [[]];
    });
    const { ensureAutoservicioSchema } = await importControllerWithDb(execute);

    await expect(ensureAutoservicioSchema({ execute })).rejects.toThrow(
      /idx_documento_externo.*documento_externo.*uq_autoservicio_idempotency_key.*único/i
    );
  });

  it('rechaza uq_autoservicio_idempotency_key si es compuesto aunque idempotency_key sea la primera columna', async () => {
    const execute = jest.fn(async (sql) => {
      if (/COLUMN_NAME = 'id_usuario'/.test(sql)) return [[{ IS_NULLABLE: 'YES' }]];
      if (/COLUMN_NAME IN/.test(sql)) return [[
        { COLUMN_NAME: 'id_usuario', IS_NULLABLE: 'YES' },
        { COLUMN_NAME: 'documento_externo' },
        { COLUMN_NAME: 'nombre_externo' },
        { COLUMN_NAME: 'id_aprendiz' },
        { COLUMN_NAME: 'idempotency_key' }
      ]];
      if (/INFORMATION_SCHEMA\.STATISTICS/.test(sql)) return [[
        { INDEX_NAME: 'idx_documento_externo', COLUMN_NAME: 'documento_externo', SEQ_IN_INDEX: 1, NON_UNIQUE: 1 },
        { INDEX_NAME: 'idx_id_aprendiz', COLUMN_NAME: 'id_aprendiz', SEQ_IN_INDEX: 1, NON_UNIQUE: 1 },
        { INDEX_NAME: 'uq_autoservicio_idempotency_key', COLUMN_NAME: 'idempotency_key', SEQ_IN_INDEX: 1, NON_UNIQUE: 0 },
        { INDEX_NAME: 'uq_autoservicio_idempotency_key', COLUMN_NAME: 'codigo_equipo', SEQ_IN_INDEX: 2, NON_UNIQUE: 0 }
      ]];
      if (/INFORMATION_SCHEMA\.ROUTINES/.test(sql)) return [[{ ROUTINE_COMMENT: 'AUTOSERVICIO_CIERRE_V1' }]];
      return [[]];
    });
    const { ensureAutoservicioSchema } = await importControllerWithDb(execute);

    await expect(ensureAutoservicioSchema({ execute })).rejects.toThrow(
      /uq_autoservicio_idempotency_key.*único sobre idempotency_key/i
    );
  });

  it('conecta el healthcheck del servidor con un helper testeable de readiness', async () => {
    const server = await readFile(serverPath, 'utf8');

    expect(server).toMatch(/buildAutoservicioHealth/);
  });
});
