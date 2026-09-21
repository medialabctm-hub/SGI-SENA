import { describe, it, expect } from '@jest/globals';
import {
  containsInternalErrorDetail,
  resolveClientErrorMessage,
  buildClientErrorBody,
  GENERIC_CLIENT_MESSAGES,
} from '../../src/utils/errorScrubber.js';
import { AppError } from '../../src/utils/errors.js';

describe('errorScrubber (MDL-204 / H-04)', () => {
  it('detecta fugas de tablas, SP, scripts y SQL', () => {
    expect(containsInternalErrorDetail(
      'Autoservicio no está listo: faltan Historial_Uso_Equipos.id_usuario nullable, sp_finalizar_clase con marcador AUTOSERVICIO_CIERRE_V2. Ejecute node scripts/migrate-autoservicio-cierre-clase.js'
    )).toBe(true);
    expect(containsInternalErrorDetail('select * from Elementos where 1=1')).toBe(true);
    expect(containsInternalErrorDetail('KnexTimeoutError: pool')).toBe(true);
    expect(containsInternalErrorDetail('El autoservicio no está disponible temporalmente.')).toBe(false);
  });

  it('prioriza clientMessage seguro sobre message interno', () => {
    const err = new AppError(
      'Autoservicio no está listo: faltan Historial_Uso_Equipos.documento_externo. Ejecute migrate-autoservicio-cierre-clase.js',
      503
    );
    err.clientMessage = 'El autoservicio no está disponible temporalmente. Inténtalo de nuevo más tarde.';
    expect(resolveClientErrorMessage(err)).toBe(err.clientMessage);
  });

  it('sustituye message interno sin clientMessage por genérico de status', () => {
    const err = new AppError('Falta sp_finalizar_clase en INFORMATION_SCHEMA', 503);
    expect(resolveClientErrorMessage(err)).toBe(GENERIC_CLIENT_MESSAGES[503]);
  });

  it('buildClientErrorBody no incluye stack cuando el message interno fue scrubbeado', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const err = new AppError('Falta tabla Historial_Uso_Equipos', 503);
    err.stack = 'Error\n    at /workspace/SGI-SENA/backend/src/controller/equiposController.js:1:1';
    const { body } = buildClientErrorBody(err, { includeStack: true });
    expect(body.error).toBe(GENERIC_CLIENT_MESSAGES[503]);
    expect(body.stack).toBeUndefined();
    process.env.NODE_ENV = original;
  });
});
