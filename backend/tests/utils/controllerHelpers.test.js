/**
 * Tests para utils/controllerHelpers
 */

import { describe, it, expect, jest } from '@jest/globals';

jest.mock(
  '../../src/utils/logger.js',
  () => ({
    logger: {
      error: jest.fn(),
    },
  }),
  { virtual: true }
);

// Jest ESM mocks must be registered before loading the module under test.
// eslint-disable-next-line import/first
import {
  handleControllerError,
} from '../../src/utils/controllerHelpers.js';
import { AppError } from '../../src/utils/errors.js';

describe('utils/controllerHelpers', () => {
  it('handleControllerError debe registrar y devolver respuesta 500 sin exponer el detalle tecnico', () => {
    const err = new Error('falló');
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const result = handleControllerError(err, res, 'contexto', 'Mensaje por defecto');

    expect(res.status).toHaveBeenCalledWith(500);
    // El mensaje tecnico ('falló') queda solo en los logs, nunca en la respuesta
    expect(res.json).toHaveBeenCalledWith({
      error: 'Mensaje por defecto',
      userMessage: 'Mensaje por defecto',
    });
    expect(result).toBe(res);
  });

  it('handleControllerError debe usar mensaje por defecto cuando no se proporciona', () => {
    const err = new Error('internal');
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    handleControllerError(err, res, 'ctx'); // sin defaultMessage

    expect(res.json).toHaveBeenCalledWith({
      error: 'No se pudo completar la operación. Inténtalo de nuevo.',
      userMessage: 'No se pudo completar la operación. Inténtalo de nuevo.',
    });
  });

  it('handleControllerError usa clientMessage y no filtra detalle interno (MDL-204)', () => {
    const err = new AppError(
      'Autoservicio no está listo: faltan Historial_Uso_Equipos, sp_finalizar_clase. Ejecute migrate-autoservicio-cierre-clase.js',
      503
    );
    err.clientMessage = 'El autoservicio no está disponible temporalmente. Inténtalo de nuevo más tarde.';
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    handleControllerError(err, res, 'iniciarUsoAutoservicio', 'fallback');

    expect(res.status).toHaveBeenCalledWith(503);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error).toBe(err.clientMessage);
    expect(payload.userMessage).toBe(err.clientMessage);
    expect(JSON.stringify(payload)).not.toMatch(/Historial_Uso_Equipos|sp_finalizar_clase|migrate-autoservicio/i);
  });

});

