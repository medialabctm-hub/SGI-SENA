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
  sendErrorResponse,
  sendSuccessResponse,
} from '../../src/utils/controllerHelpers.js';

describe('utils/controllerHelpers', () => {
  it('handleControllerError debe registrar y devolver respuesta 500', () => {
    const err = new Error('falló');
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const result = handleControllerError(err, res, 'contexto', 'Mensaje por defecto');

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Mensaje por defecto',
      detalle: 'falló',
    });
    expect(result).toBe(res);
  });

  it('sendErrorResponse debe enviar error con detalle opcional', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    sendErrorResponse(res, 400, 'mensaje', 'detalle');

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'mensaje',
      detalle: 'detalle',
    });
  });

  it('sendSuccessResponse debe incluir message cuando se pasa', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    sendSuccessResponse(res, 200, { ok: true }, 'hecho');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      message: 'hecho',
    });
  });

  it('handleControllerError debe usar mensaje por defecto cuando no se proporciona', () => {
    const err = new Error('internal');
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    handleControllerError(err, res, 'ctx'); // sin defaultMessage

    expect(res.json).toHaveBeenCalledWith({
      error: 'Error en el servidor',
      detalle: 'internal',
    });
  });

  it('sendErrorResponse debe funcionar sin detalle (rama false de if(details))', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    sendErrorResponse(res, 404, 'no encontrado'); // sin details

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'no encontrado' });
  });

  it('sendSuccessResponse sin message no debe agregar la clave message', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    sendSuccessResponse(res, 200, { data: 'value' }); // sin message

    expect(res.json).toHaveBeenCalledWith({ data: 'value' });
  });
});

