import { jest } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.resolve(__dirname, '../../src/config/dbconfig.js');
const loggerPath = path.resolve(__dirname, '../../src/utils/logger.js');
const clasesPath = path.resolve(__dirname, '../../src/controller/clasesController.js');

const mockExecute = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
const mockCrearClase = jest.fn();

await jest.unstable_mockModule(dbPath, () => ({ default: { execute: mockExecute } }));
await jest.unstable_mockModule(loggerPath, () => ({ logger: mockLogger }));
await jest.unstable_mockModule(clasesPath, () => ({ crearClase: mockCrearClase }));

const { obtenerFechasPorRangoYDias, descargarPlantillaHorarios, importarHorariosExcel } = await import('../../src/controller/horariosController.js');

// import xlsx dynamically for creating test workbooks
const xlsxModule = await import('xlsx');
const xlsx = xlsxModule.default || xlsxModule;

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.send = jest.fn();
  return res;
}

beforeEach(() => { jest.clearAllMocks(); });

// ─────────────────────────── obtenerFechasPorRangoYDias (exported util) ───────────────────────────
describe('obtenerFechasPorRangoYDias', () => {
  it('returns empty array when inputs are null', () => {
    expect(obtenerFechasPorRangoYDias(null, null, null)).toEqual([]);
  });

  it('returns empty array when dias_semana is empty', () => {
    expect(obtenerFechasPorRangoYDias('2025-01-06', '2025-01-10', [])).toEqual([]);
  });

  it('returns empty array when fecha_inicio > fecha_fin', () => {
    expect(obtenerFechasPorRangoYDias('2025-01-10', '2025-01-06', [1])).toEqual([]);
  });

  it('returns dates matching specified days in range', () => {
    // Monday=1, range from Mon Jan 6 to Sun Jan 12 2025
    const result = obtenerFechasPorRangoYDias('2025-01-06', '2025-01-12', [1]); // only Mondays
    expect(result.length).toBe(1); // only Jan 6 is Monday
    expect(result[0].getDay()).toBe(1);
  });

  it('returns multiple dates for multiple days', () => {
    // Jan 6-10: Mon-Fri
    const result = obtenerFechasPorRangoYDias('2025-01-06', '2025-01-10', [1, 2, 3, 4, 5]);
    expect(result.length).toBe(5);
  });

  it('returns single date when range is one day and matches', () => {
    // 2025-01-06 is Monday (day 1)
    const result = obtenerFechasPorRangoYDias('2025-01-06', '2025-01-06', [1]);
    expect(result.length).toBe(1);
  });

  it('returns empty when no days in range match', () => {
    // Jan 6 is Monday, ask for Sundays only
    const result = obtenerFechasPorRangoYDias('2025-01-06', '2025-01-06', [0]);
    expect(result.length).toBe(0);
  });
});

// ─────────────────────────── descargarPlantillaHorarios ───────────────────────────
describe('descargarPlantillaHorarios', () => {
  it('sends Excel buffer with correct headers', async () => {
    const req = {};
    const res = mockRes();
    await descargarPlantillaHorarios(req, res);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', expect.stringContaining('spreadsheetml'));
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('plantilla_horarios.xlsx'));
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it('returns 500 on error', async () => {
    const req = {};
    const res = mockRes();
    // Override res.setHeader to throw
    res.setHeader.mockImplementationOnce(() => { throw new Error('fail'); });
    await descargarPlantillaHorarios(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─────────────────────────── importarHorariosExcel ───────────────────────────
function buildExcelBuffer(rows) {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(rows);
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('importarHorariosExcel', () => {
  it('returns 400 when no file provided', async () => {
    const req = { file: null };
    const res = mockRes();
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when file has less than 2 rows', async () => {
    const buffer = buildExcelBuffer([['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)']]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when required columns are missing', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Hora Inicio'],
      ['LAB-1', '08:00'],
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Columnas requeridas faltantes') }));
  });

  it('returns 400 when neither Fecha nor (Fecha Inicio + Fecha Fin + Dias) columns present', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)'],
      ['LAB-1', 'Juan', '08:00', '10:00'],
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates classes from valid Excel with Fecha column - success', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Fecha'],
      ['LAB-1', 'Juan Pérez', '08:00', '10:00', '2025-06-15'],
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    // Ambiente found
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])   // SELECT ambiente
      .mockResolvedValueOnce([[{ id_usuario: 2 }]])     // SELECT instructor
      .mockResolvedValueOnce([[]])                       // SELECT conflictos (none)
      .mockResolvedValueOnce([{ insertId: 100 }]);       // INSERT Clase
    await importarHorariosExcel(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, creadas: 1 }));
  });

  it('creates classes with partial errors returns 207', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Fecha'],
      ['LAB-1', 'Juan', '08:00', '10:00', '2025-06-15'],  // will succeed
      ['NOEXISTE', 'Juan', '08:00', '10:00', '2025-06-16'], // will fail - no ambiente
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])   // Row 1: ambiente found
      .mockResolvedValueOnce([[{ id_usuario: 2 }]])     // Row 1: instructor found
      .mockResolvedValueOnce([[]])                       // Row 1: no conflicts
      .mockResolvedValueOnce([{ insertId: 101 }])        // Row 1: INSERT OK
      .mockResolvedValueOnce([[]])                       // Row 2: ambiente not found
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(207);
  });

  it('returns 400 when all rows fail', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Fecha'],
      ['NOEXISTE', 'NoUser', '08:00', '10:00', '2025-06-15'],
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    mockExecute.mockResolvedValueOnce([[]]); // ambiente not found
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });

  it('skips empty rows gracefully', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Fecha'],
      [null, null, null, null, null],  // empty row - skipped
      ['LAB-1', 'Juan', '08:00', '10:00', '2025-06-15'],
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ id_usuario: 2 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 102 }]);
    await importarHorariosExcel(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, creadas: 1 }));
  });

  it('records error when hora_fin <= hora_inicio', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Fecha'],
      ['LAB-1', 'Juan', '10:00', '08:00', '2025-06-15'],
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ id_usuario: 2 }]]);
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('records error for invalid date format', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Fecha'],
      ['LAB-1', 'Juan', '08:00', '10:00', 'not-a-date'],
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ id_usuario: 2 }]]);
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('records conflicto error when clase already exists', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Fecha'],
      ['LAB-1', 'Juan', '08:00', '10:00', '2025-06-15'],
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ id_usuario: 2 }]])
      .mockResolvedValueOnce([[{ id_clase: 9 }]]); // conflict found
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 on empty/invalid excel file', async () => {
    const req = { file: { buffer: Buffer.from('not excel') }, user: { id: 1 } };
    const res = mockRes();
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('processes dias_semana recurrent format', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Días de Semana', 'Fecha Inicio', 'Fecha Fin'],
      ['LAB-1', 'Juan', '08:00', '10:00', 'Lunes,Martes', '2025-01-06', '2025-01-07'],
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])   // ambiente found
      .mockResolvedValueOnce([[{ id_usuario: 2 }]])     // instructor found
      .mockResolvedValueOnce([[]])                       // no conflicts Mon
      .mockResolvedValueOnce([{ insertId: 103 }])        // INSERT Mon
      .mockResolvedValueOnce([[]])                       // no conflicts Tue
      .mockResolvedValueOnce([{ insertId: 104 }]);       // INSERT Tue
    await importarHorariosExcel(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, creadas: 2 }));
  });

  it('records error for invalid dias_semana values', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Días de Semana', 'Fecha Inicio', 'Fecha Fin'],
      ['LAB-1', 'Juan', '08:00', '10:00', 'Mondayyyy,Tuesday', '2025-01-06', '2025-01-07'],
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    mockExecute
      .mockResolvedValueOnce([[{ id_ambiente: 1 }]])
      .mockResolvedValueOnce([[{ id_usuario: 2 }]]);
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('records error when missing required row fields', async () => {
    const buffer = buildExcelBuffer([
      ['Código Ambiente', 'Instructor', 'Hora Inicio (HH:MM)', 'Hora Fin (HH:MM)', 'Fecha'],
      ['', '', '', '', '2025-06-15'],
    ]);
    const req = { file: { buffer }, user: { id: 1 } };
    const res = mockRes();
    await importarHorariosExcel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
