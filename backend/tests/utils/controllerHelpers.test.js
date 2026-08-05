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

import {
  handleControllerError,
} from '../../src/utils/controllerHelpers.js';

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

});

