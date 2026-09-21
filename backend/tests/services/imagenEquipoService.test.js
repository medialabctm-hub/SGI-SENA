import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  resolveEvidenceImagePath,
  sendEvidenceImage,
} from '../../src/services/imagenEquipoService.js';
import { ValidationError, NotFoundError } from '../../src/utils/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../uploads/equipos');

describe('imagenEquipoService', () => {
  const safeName = '999001-test-evidence.png';
  const safePath = path.join(uploadsDir, safeName);

  beforeEach(() => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(safePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  afterEach(() => {
    try { fs.unlinkSync(safePath); } catch { /* ignore */ }
  });

  it('resuelve una evidencia existente con nombre seguro', () => {
    expect(resolveEvidenceImagePath(safeName)).toBe(safePath);
  });

  it('lanza ValidationError ante traversal o no-imagen', () => {
    expect(() => resolveEvidenceImagePath('../secret.png')).toThrow(ValidationError);
    expect(() => resolveEvidenceImagePath('malware.exe')).toThrow(ValidationError);
  });

  it('lanza NotFoundError si el archivo no existe', () => {
    expect(() => resolveEvidenceImagePath('no-existe-123.png')).toThrow(NotFoundError);
  });

  it('sendEvidenceImage responde JSON controlado si sendFile falla', () => {
    const res = {
      headersSent: false,
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      sendFile: jest.fn((_p, _opts, cb) => cb(Object.assign(new Error('ENOENT'), { statusCode: 404 }))),
    };

    sendEvidenceImage(res, safePath);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
