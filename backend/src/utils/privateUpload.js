import fs from 'fs/promises';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const backendRoot = join(dirname(__filename), '..', '..');

export const PRIVATE_UPLOAD_DIRS = Object.freeze({
  perfiles: join(backendRoot, 'uploads', 'perfiles'),
  ambientes: join(backendRoot, 'uploads', 'ambientes'),
});

const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Valida un nombre de archivo que llega desde un parámetro de ruta.
 * Las rutas privadas solo aceptan el basename generado por los middlewares de
 * upload; nunca aceptan separadores, rutas absolutas ni segmentos relativos.
 */
export function getSafeUploadFilename(filename) {
  if (typeof filename !== 'string' || filename.length === 0) return null;
  if (filename !== path.basename(filename) || path.isAbsolute(filename)) return null;
  if (filename.includes('..') || !SAFE_FILENAME.test(filename)) return null;
  return filename;
}

function isWithinRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

/**
 * Resuelve un upload privado sin seguir symlinks ni permitir escapar de su
 * raíz. Devuelve null tanto para un archivo inexistente como para un nombre no
 * seguro, evitando distinguir esos casos desde un handler HTTP.
 */
export async function resolvePrivateUploadPath(rootDir, filename) {
  const safeFilename = getSafeUploadFilename(filename);
  if (!safeFilename) return null;

  const root = path.resolve(rootDir);
  const candidate = path.resolve(root, safeFilename);
  if (!isWithinRoot(root, candidate)) return null;

  try {
    const entry = await fs.lstat(candidate);
    if (!entry.isFile() || entry.isSymbolicLink()) return null;

    const [realRoot, realCandidate] = await Promise.all([
      fs.realpath(root),
      fs.realpath(candidate),
    ]);
    if (!isWithinRoot(realRoot, realCandidate)) return null;

    const resolvedEntry = await fs.stat(realCandidate);
    return resolvedEntry.isFile() ? realCandidate : null;
  } catch {
    return null;
  }
}

/**
 * Envía un archivo ya confinado con cache privado. El callback evita que un
 * error de sendFile termine exponiendo rutas internas o el stack al cliente.
 */
export function sendPrivateUpload(res, filePath) {
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(filePath, { dotfiles: 'deny' }, err => {
    if (err && !res.headersSent) {
      res.status(err.statusCode === 404 ? 404 : 500).json({ error: 'Archivo no encontrado' });
    }
  });
}
