/**
 * Tests para middleware/fileValidation
 *
 * Cubre: validateImageFile(), validateExcelFile(),
 *        validateMultipleImages(), validateExcel()
 */

import { describe, it, expect, jest } from '@jest/globals';

jest.mock(
  '../../src/utils/logger.js',
  () => ({
    logger: {
      warn: jest.fn(),
      error: jest.fn(),
    },
  }),
  { virtual: true }
);

import {
  validateImageFile,
  validateExcelFile,
  validateMultipleImages,
  validateExcel,
} from '../../src/middleware/fileValidation.js';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_EXCEL_SIZE = 50 * 1024 * 1024;  // 50 MB

function makeImageFile(overrides = {}) {
  return {
    size: 1024,
    mimetype: 'image/jpeg',
    originalname: 'foto.jpg',
    ...overrides,
  };
}

function makeExcelFile(overrides = {}) {
  return {
    size: 2048,
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    originalname: 'inventario.xlsx',
    ...overrides,
  };
}

function makeReqRes(fileOrFiles = null) {
  const req = fileOrFiles === null
    ? {}
    : typeof fileOrFiles.length === 'number'
      ? { files: fileOrFiles }
      : { file: fileOrFiles };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

// ──────────────────────────────────────────────
// validateImageFile()
// ──────────────────────────────────────────────
describe('validateImageFile()', () => {
  it('debe retornar valid:true para una imagen válida', () => {
    expect(validateImageFile(makeImageFile())).toEqual({ valid: true });
  });

  it('debe retornar error si no se proporciona archivo', () => {
    const result = validateImageFile(null);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/ningún archivo/i);
  });

  it('debe retornar error si el tamaño supera 10 MB', () => {
    const result = validateImageFile(makeImageFile({ size: MAX_IMAGE_SIZE + 1 }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/tamaño máximo/i);
  });

  it('debe retornar error si el mimetype no está permitido', () => {
    const result = validateImageFile(makeImageFile({ mimetype: 'application/pdf' }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/tipo de archivo/i);
  });

  it('debe retornar error si la extensión no está permitida', () => {
    const result = validateImageFile(makeImageFile({
      mimetype: 'image/jpeg',
      originalname: 'foto.bmp',
    }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/extensión/i);
  });

  it('debe retornar error si el nombre contiene caracteres peligrosos', () => {
    const result = validateImageFile(makeImageFile({
      originalname: 'foto<script>.jpg',
    }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/caracteres no permitidos/i);
  });

  it.each(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'])(
    'debe aceptar el mimetype %s',
    (mimetype) => {
      const ext = mimetype.split('/')[1].replace('jpeg', 'jpg');
      const result = validateImageFile(makeImageFile({
        mimetype,
        originalname: `foto.${ext}`,
      }));
      expect(result.valid).toBe(true);
    }
  );
});

// ──────────────────────────────────────────────
// validateExcelFile()
// ──────────────────────────────────────────────
describe('validateExcelFile()', () => {
  it('debe retornar valid:true para un Excel válido', () => {
    expect(validateExcelFile(makeExcelFile())).toEqual({ valid: true });
  });

  it('debe retornar error si no se proporciona archivo', () => {
    const result = validateExcelFile(null);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/ningún archivo/i);
  });

  it('debe retornar error si el tamaño supera 50 MB', () => {
    const result = validateExcelFile(makeExcelFile({ size: MAX_EXCEL_SIZE + 1 }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/tamaño máximo/i);
  });

  it('debe retornar error si el mimetype no está permitido', () => {
    const result = validateExcelFile(makeExcelFile({ mimetype: 'application/pdf' }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/tipo de archivo/i);
  });

  it('debe retornar error si la extensión no está permitida (.csv)', () => {
    const result = validateExcelFile(makeExcelFile({
      mimetype: 'application/vnd.ms-excel',
      originalname: 'datos.csv',
    }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/extensión/i);
  });

  it('debe retornar error si el nombre contiene caracteres peligrosos', () => {
    const result = validateExcelFile(makeExcelFile({
      originalname: 'archi|vo.xlsx',
    }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/caracteres no permitidos/i);
  });

  it('debe aceptar archivo .xls con mimetype application/vnd.ms-excel', () => {
    const result = validateExcelFile(makeExcelFile({
      mimetype: 'application/vnd.ms-excel',
      originalname: 'datos.xls',
    }));
    expect(result.valid).toBe(true);
  });

  it('debe aceptar mimetype application/vnd.ms-excel.sheet.macroEnabled.12', () => {
    const result = validateExcelFile(makeExcelFile({
      mimetype: 'application/vnd.ms-excel.sheet.macroEnabled.12',
      originalname: 'datos.xlsx',
    }));
    expect(result.valid).toBe(true);
  });
});

// ──────────────────────────────────────────────
// validateMultipleImages() – middleware
// ──────────────────────────────────────────────
describe('validateMultipleImages()', () => {
  it('debe llamar next() si no hay archivos adjuntos', () => {
    const { req, res, next } = makeReqRes([]);
    validateMultipleImages(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe llamar next() si req.files está undefined', () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    validateMultipleImages(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('debe llamar next() si todos los archivos son válidos', () => {
    const { req, res, next } = makeReqRes([makeImageFile(), makeImageFile({ originalname: 'pic.png', mimetype: 'image/png' })]);
    validateMultipleImages(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('debe retornar 400 si algún archivo es inválido', () => {
    const files = [
      makeImageFile(),
      makeImageFile({ mimetype: 'application/pdf', originalname: 'doc.pdf' }),
    ];
    const { req, res, next } = makeReqRes(files);
    validateMultipleImages(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        details: expect.any(Array),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// validateExcel() – middleware
// ──────────────────────────────────────────────
describe('validateExcel()', () => {
  it('debe llamar next() con un archivo Excel válido', () => {
    const req = { file: makeExcelFile() };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validateExcel(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('debe retornar 400 si no hay archivo', () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();

    validateExcel(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('debe retornar 400 si el archivo Excel no es válido', () => {
    const req = { file: makeExcelFile({ mimetype: 'application/pdf', originalname: 'doc.pdf' }) };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();

    validateExcel(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.any(String) })
    );
  });
});
