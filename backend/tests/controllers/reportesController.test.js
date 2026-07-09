import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockExecute = jest.fn();
jest.unstable_mockModule(path.resolve(__dirname, '../../src/config/dbconfig.js'), () => ({
  default: { execute: mockExecute },
  pool: { execute: mockExecute }
}));

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/logger.js'), () => ({
  logger: mockLogger
}));

const mockCreateForUsers = jest.fn().mockResolvedValue(undefined);
jest.unstable_mockModule(path.resolve(__dirname, '../../src/services/notificationService.js'), () => ({
  createForUsers: mockCreateForUsers
}));

const mockObtenerEquipoPorCodigo = jest.fn();
jest.unstable_mockModule(path.resolve(__dirname, '../../src/utils/sqlQueries.js'), () => ({
  obtenerEquipoPorCodigo: mockObtenerEquipoPorCodigo,
  verificarDisponibilidadEquipo: jest.fn(),
  verificarAmbienteEquipoAprendiz: jest.fn()
}));

// Mock PDFDocument - returns a fake doc that mimics the real API
const mockPdfDoc = {
  fontSize: jest.fn().mockReturnThis(),
  font: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  moveDown: jest.fn().mockReturnThis(),
  moveTo: jest.fn().mockReturnThis(),
  lineTo: jest.fn().mockReturnThis(),
  stroke: jest.fn().mockReturnThis(),
  fillColor: jest.fn().mockReturnThis(),
  addPage: jest.fn().mockReturnThis(),
  switchToPage: jest.fn().mockReturnThis(),
  pipe: jest.fn(),
  end: jest.fn(),
  y: 100,
  page: { height: 792 },
  bufferedPageRange: jest.fn().mockReturnValue({ count: 1 }),
  setHeader: jest.fn()
};
jest.unstable_mockModule('pdfkit', () => ({
  default: jest.fn(() => mockPdfDoc)
}));

// ── Dynamic import ─────────────────────────────────────────────────────────
const {
  crearReporte,
  listarReportes,
  obtenerReportePorId,
  actualizarReporte,
  eliminarReporte,
  obtenerTiposReporte,
  generarReportePDF
} = await import(path.resolve(__dirname, '../../src/controller/reportesController.js'));

// ── Helpers ────────────────────────────────────────────────────────────────
function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 1, rol: 'Administrador' },
    ...overrides
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
}

// ── crearReporte ───────────────────────────────────────────────────────────

describe('crearReporte', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
    mockCreateForUsers.mockResolvedValue(undefined);
  });

  it('creates reporte without equipo successfully', async () => {
    mockExecute.mockResolvedValueOnce([{ insertId: 10 }]); // INSERT
    const req = mockReq({
      body: { tipo_reporte: 'General', titulo: 'Test', descripcion: 'Descripcion' }
    });
    const res = mockRes();
    await crearReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, id: 10 }));
  });

  it('returns 404 when equipo not found', async () => {
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce(null);
    const req = mockReq({
      body: { tipo_reporte: 'Equipos', titulo: 'Test', descripcion: 'Desc', codigo_equipo: 999 }
    });
    const res = mockRes();
    await crearReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Equipo no encontrado' }));
  });

  it('returns 403 when Instructor does not own the equipo', async () => {
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 5, tipo: 'PC', placa: 'AAA', modelo: 'Dell' });
    mockExecute.mockResolvedValueOnce([[undefined]]); // no asignacion
    const req = mockReq({
      user: { id: 2, rol: 'Instructor' },
      body: { tipo_reporte: 'Equipos', titulo: 'Test', descripcion: 'Desc', codigo_equipo: 5 }
    });
    const res = mockRes();
    await crearReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('creates reporte with equipo for Admin (no ownership check)', async () => {
    mockObtenerEquipoPorCodigo
      .mockResolvedValueOnce({ codigo_equipo: 5, tipo: 'PC', placa: 'AAA', modelo: 'Dell' }) // first check
      .mockResolvedValueOnce({ codigo_equipo: 5, tipo: 'PC', placa: 'AAA', modelo: 'Dell' }); // notification check
    mockExecute
      .mockResolvedValueOnce([{ insertId: 11 }])              // INSERT
      .mockResolvedValueOnce([[{ id_usuario: 3 }]]);          // responsables notification
    const req = mockReq({
      body: { tipo_reporte: 'Equipos', titulo: 'Test', descripcion: 'Desc', codigo_equipo: 5 }
    });
    const res = mockRes();
    await crearReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({
      body: { tipo_reporte: 'General', titulo: 'T', descripcion: 'D' }
    });
    const res = mockRes();
    await crearReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('allows Aprendiz to create reporte for assigned equipo', async () => {
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce({ codigo_equipo: 7, tipo: 'PC', placa: 'BBB', modelo: 'HP' });
    mockExecute
      .mockResolvedValueOnce([[{ id_responsable: 1 }]])  // asignacion exists
      .mockResolvedValueOnce([{ insertId: 12 }]);          // INSERT
    const req = mockReq({
      user: { id: 3, rol: 'Aprendiz' },
      body: { tipo_reporte: 'Equipos', titulo: 'Aprendiz report', descripcion: 'Desc', codigo_equipo: 7 }
    });
    const res = mockRes();
    await crearReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// ── listarReportes ─────────────────────────────────────────────────────────

describe('listarReportes', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns all reportes for Admin', async () => {
    const rows = [{ id_reporte: 1, titulo: 'R1' }, { id_reporte: 2, titulo: 'R2' }];
    mockExecute.mockResolvedValueOnce([rows]);
    const req = mockReq();
    const res = mockRes();
    await listarReportes(req, res);
    expect(res.json).toHaveBeenCalledWith(rows);
  });

  it('filters reportes for Instructor role', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_reporte: 1, titulo: 'R1' }]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' } });
    const res = mockRes();
    await listarReportes(req, res);
    expect(res.json).toHaveBeenCalled();
  });

  it('returns empty array when table does not exist', async () => {
    const err = new Error('Table not found');
    err.code = 'ER_NO_SUCH_TABLE';
    mockExecute.mockRejectedValueOnce(err);
    const req = mockReq();
    const res = mockRes();
    await listarReportes(req, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB crash'));
    const req = mockReq();
    const res = mockRes();
    await listarReportes(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── obtenerReportePorId ────────────────────────────────────────────────────

describe('obtenerReportePorId', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 404 when reporte not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await obtenerReportePorId(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns reporte for Admin', async () => {
    const reporte = { id_reporte: 1, titulo: 'R1', generado_por: 99 };
    mockExecute.mockResolvedValueOnce([[reporte]]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await obtenerReportePorId(req, res);
    expect(res.json).toHaveBeenCalledWith(reporte);
  });

  it('returns reporte for Instructor who created it', async () => {
    const reporte = { id_reporte: 1, titulo: 'R1', generado_por: 5 };
    mockExecute.mockResolvedValueOnce([[reporte]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, params: { id: '1' } });
    const res = mockRes();
    await obtenerReportePorId(req, res);
    expect(res.json).toHaveBeenCalledWith(reporte);
  });

  it('returns 403 when Instructor does not own equipo', async () => {
    const reporte = { id_reporte: 1, titulo: 'R1', generado_por: 99, codigo_equipo: 5 };
    mockExecute
      .mockResolvedValueOnce([[reporte]])   // reporte found
      .mockResolvedValueOnce([[undefined]]); // no asignacion
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, params: { id: '1' } });
    const res = mockRes();
    await obtenerReportePorId(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 403 for Instructor on reporte without equipo (and not creator)', async () => {
    const reporte = { id_reporte: 1, titulo: 'R1', generado_por: 99, codigo_equipo: null };
    mockExecute.mockResolvedValueOnce([[reporte]]);
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, params: { id: '1' } });
    const res = mockRes();
    await obtenerReportePorId(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns reporte for Instructor with assigned equipo', async () => {
    const reporte = { id_reporte: 1, titulo: 'R1', generado_por: 99, codigo_equipo: 5 };
    mockExecute
      .mockResolvedValueOnce([[reporte]])
      .mockResolvedValueOnce([[{ id_responsable: 1 }]]); // asignacion found
    const req = mockReq({ user: { id: 5, rol: 'Instructor' }, params: { id: '1' } });
    const res = mockRes();
    await obtenerReportePorId(req, res);
    expect(res.json).toHaveBeenCalledWith(reporte);
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await obtenerReportePorId(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── actualizarReporte ──────────────────────────────────────────────────────

describe('actualizarReporte', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 403 when non-Admin tries to update', async () => {
    const req = mockReq({
      user: { id: 2, rol: 'Instructor' },
      params: { id: '1' },
      body: { tipo_reporte: 'General', titulo: 'T', descripcion: 'D' }
    });
    const res = mockRes();
    await actualizarReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when required fields missing', async () => {
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();
    await actualizarReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when reporte not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({
      params: { id: '99' },
      body: { tipo_reporte: 'General', titulo: 'T', descripcion: 'D' }
    });
    const res = mockRes();
    await actualizarReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 404 when equipo not found', async () => {
    mockExecute.mockResolvedValueOnce([[{ id_reporte: 1 }]]); // reporte exists
    mockObtenerEquipoPorCodigo.mockResolvedValueOnce(null);
    const req = mockReq({
      params: { id: '1' },
      body: { tipo_reporte: 'Equipos', titulo: 'T', descripcion: 'D', codigo_equipo: 999 }
    });
    const res = mockRes();
    await actualizarReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Equipo no encontrado' }));
  });

  it('updates reporte successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_reporte: 1 }]])  // reporte found
      .mockResolvedValueOnce([{ affectedRows: 1 }]);  // UPDATE
    const req = mockReq({
      params: { id: '1' },
      body: { tipo_reporte: 'General', titulo: 'Updated', descripcion: 'Desc updated' }
    });
    const res = mockRes();
    await actualizarReporte(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('updates reporte with optional fields', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_reporte: 1 }]])  // reporte found
      .mockResolvedValueOnce([{ affectedRows: 1 }]);  // UPDATE
    const req = mockReq({
      params: { id: '1' },
      body: { tipo_reporte: 'General', titulo: 'Updated', descripcion: 'Desc', estado: 'Cerrado', observaciones: 'Obs' }
    });
    const res = mockRes();
    await actualizarReporte(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({
      params: { id: '1' },
      body: { tipo_reporte: 'General', titulo: 'T', descripcion: 'D' }
    });
    const res = mockRes();
    await actualizarReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── eliminarReporte ────────────────────────────────────────────────────────

describe('eliminarReporte', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns 403 when non-Admin tries to delete', async () => {
    const req = mockReq({ user: { id: 2, rol: 'Aprendiz' }, params: { id: '1' } });
    const res = mockRes();
    await eliminarReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when reporte not found', async () => {
    mockExecute.mockResolvedValueOnce([[undefined]]);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await eliminarReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes reporte successfully', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id_reporte: 1 }]])  // found
      .mockResolvedValueOnce([{ affectedRows: 1 }]);  // DELETE
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await eliminarReporte(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('returns 500 on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await eliminarReporte(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── obtenerTiposReporte ────────────────────────────────────────────────────

describe('obtenerTiposReporte', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
  });

  it('returns types from ENUM', async () => {
    mockExecute.mockResolvedValueOnce([[{ COLUMN_TYPE: "enum('General','Equipos','Mantenimiento')" }]]);
    const req = mockReq();
    const res = mockRes();
    await obtenerTiposReporte(req, res);
    expect(res.json).toHaveBeenCalledWith(['General', 'Equipos', 'Mantenimiento']);
  });

  it('returns default types when no rows', async () => {
    mockExecute.mockResolvedValueOnce([[]]);
    const req = mockReq();
    const res = mockRes();
    await obtenerTiposReporte(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['General', 'Equipos']));
  });

  it('returns default types when COLUMN_TYPE is not enum', async () => {
    mockExecute.mockResolvedValueOnce([[{ COLUMN_TYPE: 'varchar(100)' }]]);
    const req = mockReq();
    const res = mockRes();
    await obtenerTiposReporte(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['General', 'Equipos']));
  });

  it('returns default types on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB fail'));
    const req = mockReq();
    const res = mockRes();
    await obtenerTiposReporte(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.arrayContaining(['General', 'Equipos']));
  });
});

// ── generarReportePDF ──────────────────────────────────────────────────────

describe('generarReportePDF', () => {
  beforeEach(() => {
    mockExecute.mockReset();
    jest.clearAllMocks();
    // Reset PDF doc mock
    Object.keys(mockPdfDoc).forEach(key => {
      if (jest.isMockFunction(mockPdfDoc[key])) {
        mockPdfDoc[key].mockClear();
        if (key !== 'end' && key !== 'pipe' && key !== 'bufferedPageRange' && key !== 'setHeader') {
          mockPdfDoc[key].mockReturnThis();
        }
      }
    });
    mockPdfDoc.y = 100;
    mockPdfDoc.bufferedPageRange.mockReturnValue({ count: 1 });
  });

  it('generates PDF with no equipos', async () => {
    mockExecute.mockResolvedValueOnce([[]]); // no equipos
    const req = mockReq({ query: {} });
    const res = mockRes();
    await generarReportePDF(req, res);
    expect(mockPdfDoc.end).toHaveBeenCalled();
  });

  it('generates PDF with equipos', async () => {
    const equipos = [
      { codigo_equipo: 1, placa: 'A001', tipo: 'PC', modelo: 'Dell', consecutivo: '001', descripcion: 'Desc',
        r_centro: 'Centro', estado_fisico: 'Bueno', id_ambiente: 1, nombre_ambiente: 'Lab', codigo_ambiente: 'L01',
        nombre_categoria: 'Computadores', cuentadante_principal: 'Juan', cuentadante_cedula: '123456' }
    ];
    mockExecute
      .mockResolvedValueOnce([equipos])          // equipos query
      .mockResolvedValueOnce([[]])               // instructores for ambiente 1
      .mockResolvedValueOnce([[{ id_usuario: 1 }]])  // instructores summary
      .mockResolvedValueOnce([[{ total: 2 }]]);    // ambientes asignados
    const req = mockReq({ query: {} });
    const res = mockRes();
    await generarReportePDF(req, res);
    expect(mockPdfDoc.end).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB crash'));
    const req = mockReq({ query: {} });
    const res = mockRes();
    await generarReportePDF(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
