import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const execute = jest.fn();
const here = path.dirname(fileURLToPath(import.meta.url));
jest.unstable_mockModule(path.resolve(here, '../../src/config/dbconfig.js'), () => ({ default: { execute } }));
jest.unstable_mockModule(path.resolve(here, '../../src/utils/logger.js'), () => ({ logger: { error: jest.fn() } }));
const { listarPrestamosInforme } = await import('../../src/controller/prestamosInformeController.js');

const response = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

describe('informe de préstamos: HTTP', () => {
  beforeEach(() => execute.mockReset());

  test('bloquea aprendices antes de consultar datos', async () => {
    const res = response();
    await listarPrestamosInforme({ user: { id: 8, rol: 'Aprendiz' }, query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(execute).not.toHaveBeenCalled();
  });

  test('devuelve total y sesiones usando mismo alcance del cuentadante', async () => {
    const res = response();
    execute.mockResolvedValueOnce([[{ total: 2 }]]).mockResolvedValueOnce([[{ id_historial: 1 }]]);
    await listarPrestamosInforme({ user: { id: 8, rol: 'Cuentadante' }, query: { ambiente: '22' } }, res);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0][1]).toEqual([8, 22]);
    expect(execute.mock.calls[1][1]).toEqual([8, 22]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ sesiones: [{ id_historial: 1 }], pagination: expect.objectContaining({ total: 2 }) }));
  });
});
