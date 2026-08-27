import { jest } from '@jest/globals';
import path from 'path';
import { PassThrough } from 'stream';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = relativePath => path.resolve(__dirname, relativePath);

// Este archivo NO mockea pdfkit a propósito: es un test de regresión para
// bufferPages. Sin bufferPages: true, pdfkit descarta cada página del buffer
// en cuanto se llama addPage(), y el pie de página revienta con
// "switchToPage(n) out of bounds" en cualquier reporte de más de una página.
// Un mock de PDFDocument nunca habría detectado ese bug.

const mockExecute = jest.fn();
jest.unstable_mockModule(source('../../src/config/dbconfig.js'), () => ({
  default: { execute: mockExecute },
  pool: { execute: mockExecute },
}));

jest.unstable_mockModule(source('../../src/utils/logger.js'), () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.unstable_mockModule(
  source('../../src/services/notificationService.js'),
  () => ({
    createForUsers: jest.fn().mockResolvedValue(undefined),
  })
);

jest.unstable_mockModule(source('../../src/utils/sqlQueries.js'), () => ({
  obtenerEquipoPorCodigo: jest.fn(),
  verificarDisponibilidadEquipo: jest.fn(),
  verificarAmbienteEquipoAprendiz: jest.fn(),
}));

jest.unstable_mockModule(source('../../src/utils/enumSchemaUtils.js'), () => ({
  obtenerValoresEnumColumna: jest.fn(),
}));

jest.unstable_mockModule(
  source('../../src/middleware/uploadMiddleware.js'),
  () => ({
    getImageFilePath: jest.fn(filename => `/fake/uploads/equipos/${filename}`),
  })
);

const { generarReporteEquiposFotosPDF } = await import(
  source('../../src/controller/reportesController.js')
);

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 1, rol: 'Administrador' },
    ...overrides,
  };
}

// Una respuesta real basada en un stream, para que doc.pipe(res) funcione de
// verdad y podamos leer los bytes del PDF resultante.
function realRes() {
  const stream = new PassThrough();
  stream.status = () => stream;
  stream.json = () => stream;
  stream.setHeader = () => {};
  return stream;
}

describe('generarReporteEquiposFotosPDF (pdfkit real, regresión de paginación)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it('no lanza al recorrer el pie de página en un reporte de varias páginas', async () => {
    // Suficientes equipos con descripciones largas para forzar addPage() varias veces.
    const equipos = Array.from({ length: 25 }, (_, i) => ({
      codigo_equipo: i + 1,
      placa: `A${String(i).padStart(3, '0')}`,
      tipo: 'Computador de Escritorio',
      modelo: 'Dell OptiPlex 7090',
      descripcion:
        'Descripción de prueba repetida para ocupar espacio vertical. '.repeat(
          3
        ),
      estado_fisico: 'Bueno',
      nombre_ambiente: 'Lab 1',
      codigo_ambiente: 'L01',
    }));

    mockExecute
      .mockResolvedValueOnce([
        [{ id_ambiente: 1, nombre_ambiente: 'Lab 1', codigo_ambiente: 'L01' }],
      ])
      .mockResolvedValueOnce([equipos])
      .mockResolvedValueOnce([[]]); // sin fotos para ningún equipo

    const req = mockReq({ query: { modo: 'ambiente', id_ambiente: '1' } });
    const res = realRes();

    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    const finished = new Promise((resolve, reject) => {
      res.on('end', resolve);
      res.on('error', reject);
    });

    await generarReporteEquiposFotosPDF(req, res);
    await finished;

    const pdfBuffer = Buffer.concat(chunks);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(pdfBuffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
