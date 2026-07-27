import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockExecute = jest.fn();
const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

jest.unstable_mockModule(path.resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
  default: { execute: mockExecute },
}));

jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/logger.js'), () => ({
  logger: mockLogger,
}));

const {
  resolverAutorizador,
  obtenerAutorizadorParaEquipo,
  crearSolicitud,
  listarDisponiblesParaMovimiento,
} = await import(path.resolve(__dirname, '../../src/controller/autorizacionMovimientoController.js'));

function mockReq(overrides = {}) {
  return {
    user: { id: 1, rol: 'Instructor' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const CUENTADANTE = { id_usuario: 20, nombre_usuario: 'Ana Cuentadante', nombre_rol: 'Cuentadante' };
const RESPONSABLE_AMBIENTE = { id_usuario: 30, nombre_usuario: 'Luis Ambiente', nombre_rol: 'Cuentadante' };
const ADMIN = { id_usuario: 40, nombre_usuario: 'Admin Principal', nombre_rol: 'Administrador' };

beforeEach(() => {
  mockExecute.mockReset();
  jest.clearAllMocks();
});

// ERR-01: la autorización se dirige a quien responde por el equipo, no a cualquier admin
describe('resolverAutorizador', () => {
  it('prioriza al cuentadante asignado al equipo', async () => {
    mockExecute.mockResolvedValueOnce([[CUENTADANTE]]);

    const resultado = await resolverAutorizador(5, 9);

    expect(resultado).toEqual(expect.objectContaining({
      id_usuario: 20,
      motivo: 'Cuentadante asignado al equipo',
    }));
    // No consulta los siguientes pasos de la cascada
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('usa el responsable principal del ambiente cuando el equipo no tiene cuentadante', async () => {
    mockExecute
      .mockResolvedValueOnce([[undefined]])              // sin cuentadante
      .mockResolvedValueOnce([[RESPONSABLE_AMBIENTE]]);  // responsable del ambiente

    const resultado = await resolverAutorizador(5, 9);

    expect(resultado).toEqual(expect.objectContaining({
      id_usuario: 30,
      motivo: 'Responsable principal del ambiente',
    }));
  });

  it('cae al administrador cuando no hay cuentadante ni responsable de ambiente', async () => {
    mockExecute
      .mockResolvedValueOnce([[undefined]])  // sin cuentadante
      .mockResolvedValueOnce([[undefined]])  // sin responsable de ambiente
      .mockResolvedValueOnce([[ADMIN]]);     // administrador

    const resultado = await resolverAutorizador(5, 9);

    expect(resultado).toEqual(expect.objectContaining({
      id_usuario: 40,
      motivo: expect.stringContaining('Administrador'),
    }));
  });

  it('devuelve null cuando no hay ningún destinatario posible', async () => {
    mockExecute
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([[undefined]]);

    expect(await resolverAutorizador(5, 9)).toBeNull();
  });

  it('omite el paso del ambiente cuando no se proporciona ambiente de origen', async () => {
    mockExecute
      .mockResolvedValueOnce([[undefined]])  // sin cuentadante
      .mockResolvedValueOnce([[ADMIN]]);     // salta directo al administrador

    const resultado = await resolverAutorizador(5, null);

    expect(resultado.id_usuario).toBe(40);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});

describe('obtenerAutorizadorParaEquipo', () => {
  it('devuelve 400 sin codigo_equipo', async () => {
    const res = mockRes();
    await obtenerAutorizadorParaEquipo(mockReq({ query: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('devuelve 404 cuando el equipo no existe', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const res = mockRes();
    await obtenerAutorizadorParaEquipo(mockReq({ query: { codigo_equipo: '5' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('devuelve el destinatario resuelto', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 5, id_ambiente: 9 }]])
      .mockResolvedValueOnce([[CUENTADANTE]]);
    const res = mockRes();
    await obtenerAutorizadorParaEquipo(mockReq({ query: { codigo_equipo: '5' } }), res);
    expect(res.json).toHaveBeenCalledWith({
      autorizador: expect.objectContaining({ id_usuario: 20 }),
    });
  });
});

describe('crearSolicitud', () => {
  const bodyValido = { codigo_equipo: 5, id_ambiente_destino: 2, motivo: 'Traslado de sala' };

  it('ignora el id_autorizador del body y usa el cuentadante del equipo', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 5, id_ambiente: 1, verificado_ambiente: 1 }]]) // equipo
      .mockResolvedValueOnce([[{ id_ambiente: 2 }]])   // ambiente destino
      .mockResolvedValueOnce([[CUENTADANTE]])          // resolverAutorizador paso 1
      .mockResolvedValueOnce([{ insertId: 77 }]);      // INSERT

    const res = mockRes();
    // El solicitante intenta dirigir la solicitud a otro usuario (999)
    await crearSolicitud(mockReq({ body: { ...bodyValido, id_autorizador: 999 } }), res);

    const insertCall = mockExecute.mock.calls.find(([sql]) =>
      /INSERT INTO Solicitudes_Autorizacion_Movimiento/i.test(sql));
    expect(insertCall).toBeDefined();
    // El id_autorizador persistido es el resuelto (20), no el enviado (999)
    expect(insertCall[1]).toContain(20);
    expect(insertCall[1]).not.toContain(999);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rechaza con 409 cuando el solicitante es el propio autorizador', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 5, id_ambiente: 1, verificado_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ id_ambiente: 2 }]])
      .mockResolvedValueOnce([[{ ...CUENTADANTE, id_usuario: 1 }]]); // mismo id que req.user.id

    const res = mockRes();
    await crearSolicitud(mockReq({ body: bodyValido }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockExecute.mock.calls.some(([sql]) => /INSERT INTO/i.test(sql))).toBe(false);
  });

  it('devuelve 409 cuando no hay ningún destinatario posible', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ codigo_equipo: 5, id_ambiente: 1, verificado_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ id_ambiente: 2 }]])
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([[undefined]])
      .mockResolvedValueOnce([[undefined]]);

    const res = mockRes();
    await crearSolicitud(mockReq({ body: bodyValido }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('sigue exigiendo los campos obligatorios', async () => {
    const res = mockRes();
    await crearSolicitud(mockReq({ body: { codigo_equipo: 5 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('listarDisponiblesParaMovimiento', () => {
  it('solo expone autorizaciones donde el usuario es solicitante o autorizador', async () => {
    mockExecute.mockResolvedValueOnce([[]]);
    const res = mockRes();

    await listarDisponiblesParaMovimiento(
      mockReq({ user: { id: 7 }, query: { codigo_equipo: '5', id_ambiente_destino: '2' } }),
      res
    );

    const [sql, params] = mockExecute.mock.calls[0];
    expect(sql).toMatch(/s\.id_solicitante = \?\s+OR\s+s\.id_autorizador = \?/);
    expect(params).toEqual([5, 2, 7, 7]);
  });
});
