import { describe, it, expect, jest } from '@jest/globals';
import { asyncHandler } from '../../src/middleware/asyncHandler.js';

describe('asyncHandler', () => {
  it('propaga el resultado de un handler sync/async exitoso', async () => {
    const handler = asyncHandler(async (req, res) => {
      res.status(200).json({ ok: true });
    });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await handler({}, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('envía rechazos de promesa a next(err) en lugar de tumbar el proceso', async () => {
    const boom = new Error('boom async');
    const handler = asyncHandler(async () => {
      throw boom;
    });
    const next = jest.fn();

    await handler({}, {}, next);

    expect(next).toHaveBeenCalledWith(boom);
  });
});
