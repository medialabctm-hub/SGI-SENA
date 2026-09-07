import { describe, it, expect } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getSafeUploadFilename, resolvePrivateUploadPath } from '../../src/utils/privateUpload.js';

describe('privateUpload path safety', () => {
  it.each(['../secret.jpg', '..\\secret.jpg', '/etc/passwd', 'C:\\secret.jpg', 'room/secret.jpg', ''])(
    'rechaza el nombre inseguro %s', name => {
      expect(getSafeUploadFilename(name)).toBeNull();
    }
  );

  it('acepta nombres generados por los middlewares', () => {
    expect(getSafeUploadFilename('1730000000000-7-foto_perfil.jpg')).toBe('1730000000000-7-foto_perfil.jpg');
  });

  it('resuelve solo archivos regulares dentro de la raíz', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sgi-private-upload-'));
    const filename = 'safe.jpg';
    const expected = path.join(root, filename);
    await fs.writeFile(expected, 'fixture');

    await expect(resolvePrivateUploadPath(root, filename)).resolves.toBe(expected);
    await expect(resolvePrivateUploadPath(root, '../safe.jpg')).resolves.toBeNull();
    await fs.rm(root, { recursive: true, force: true });
  });

});
