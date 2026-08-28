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

const { generarReportePDF, generarReporteEquiposFotosPDF } = await import(
  source('../../src/controller/reportesController.js')
);

// Cuenta páginas reales del PDF contando objetos con /Type /Page (sin la 's' de
// /Type /Pages, que es el nodo raíz del árbol de páginas, no una página en sí).
function contarPaginasPDF(buffer) {
  const matches = buffer.toString('latin1').match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : 0;
}

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

    // Regresión: el pie de página no debe insertar páginas adicionales casi
    // vacías. Con 25 equipos de descripción larga el contenido real ya ocupa
    // más de una página, así que el conteo debe quedarse en un número pequeño
    // (2-3 páginas reales), no duplicarse por cada página existente.
    const totalPaginas = contarPaginasPDF(pdfBuffer);
    expect(totalPaginas).toBeGreaterThan(1);
    expect(totalPaginas).toBeLessThan(6);
  });
});

describe('generarReportePDF (pdfkit real, regresión de paginación)', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it('no agrega páginas casi vacías al escribir el pie de página en un reporte de varios ambientes', async () => {
    const ambientes = [
      { id: 1, nombre: 'Lab 1', codigo: 'L01' },
      { id: 2, nombre: 'Lab 2', codigo: 'L02' },
    ];
    const equipos = ambientes.flatMap(amb =>
      Array.from({ length: 20 }, (_, i) => ({
        codigo_equipo: amb.id * 100 + i,
        placa: `A${amb.id}${String(i).padStart(3, '0')}`,
        tipo: 'Computador de Escritorio',
        modelo: 'Dell OptiPlex 7090',
        consecutivo: `C${i}`,
        descripcion: 'Descripción de prueba',
        r_centro: '123',
        estado_fisico: 'Bueno',
        id_ambiente: amb.id,
        nombre_ambiente: amb.nombre,
        codigo_ambiente: amb.codigo,
        nombre_categoria: 'Computadores',
        cuentadante_principal: 'Juan Pérez',
        cuentadante_cedula: '123456',
      }))
    );

    mockExecute
      .mockResolvedValueOnce([equipos]) // consulta principal de equipos
      .mockResolvedValueOnce([[]]) // instructores del ambiente 1 (vacío para simplificar)
      .mockResolvedValueOnce([[]]) // instructores del ambiente 2
      .mockResolvedValueOnce([[]]) // resumen: instructores únicos del ambiente 1
      .mockResolvedValueOnce([[]]); // resumen: instructores únicos del ambiente 2

    const req = mockReq({ query: {} });
    const res = realRes();

    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    const finished = new Promise((resolve, reject) => {
      res.on('end', resolve);
      res.on('error', reject);
    });

    await generarReportePDF(req, res);
    await finished;

    const pdfBuffer = Buffer.concat(chunks);
    expect(pdfBuffer.length).toBeGreaterThan(0);

    const totalPaginas = contarPaginasPDF(pdfBuffer);
    expect(totalPaginas).toBeGreaterThan(1);
    expect(totalPaginas).toBeLessThan(8);
  });
});
