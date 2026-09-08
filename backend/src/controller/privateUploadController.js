import defaultDb from '../config/dbconfig.js';
import { isAdmin, hasPermissionFromDB, PERMISSIONS } from '../config/permissions.js';
import { logger } from '../utils/logger.js';
import { handleControllerError } from '../utils/controllerHelpers.js';
import {
  PRIVATE_UPLOAD_DIRS,
  getSafeUploadFilename,
  resolvePrivateUploadPath,
  sendPrivateUpload,
} from '../utils/privateUpload.js';

const notFound = (res) => res.status(404).json({ error: 'Archivo no encontrado' });

/**
 * Sirve una foto de perfil solo a su propietario o a un rol con permiso de
 * detalle de usuarios. La metadata es la fuente de autorización; el nombre de
 * archivo por sí solo nunca concede acceso.
 */
export async function serveProfileImage(req, res) {
  try {
    const filename = getSafeUploadFilename(req.params.filename);
    if (!filename) return notFound(res);

    const storedPath = `/uploads/perfiles/${filename}`;
    const [[profile]] = await defaultDb.execute(
      `SELECT id_usuario
       FROM Usuarios
       WHERE estado = 'Activo' AND foto_perfil = ?
       LIMIT 1`,
      [storedPath]
    );
    if (!profile) return notFound(res);

    const requesterId = Number(req.user?.id);
    const ownsResource = Number.isInteger(requesterId) && requesterId === Number(profile.id_usuario);
    const canViewDetails = ownsResource
      || isAdmin(req.user?.rol)
      || await hasPermissionFromDB(defaultDb, req.user?.rol, PERMISSIONS.USERS.VIEW_DETAIL);
    if (!ownsResource && !canViewDetails) return notFound(res);

    const filePath = await resolvePrivateUploadPath(PRIVATE_UPLOAD_DIRS.perfiles, filename);
    if (!filePath) return notFound(res);
    return sendPrivateUpload(res, filePath);
  } catch (error) {
    logger.error('Error al servir imagen privada de perfil', { error: error.message });
    return handleControllerError(error, res, 'serveProfileImage', 'Error al obtener la imagen');
  }
}

/**
 * Sirve una imagen de ambiente después de que la ruta haya aplicado
 * authenticate + ambientes:view. La fila de metadata debe existir y apuntar
 * exactamente al path solicitado para impedir acceso a archivos huérfanos.
 */
export async function serveEnvironmentImage(req, res) {
  try {
    const filename = getSafeUploadFilename(req.params.filename);
    if (!filename) return notFound(res);

    const storedPath = `/uploads/ambientes/${filename}`;
    const [[image]] = await defaultDb.execute(
      `SELECT id_imagen_ambiente
       FROM Imagenes_Ambiente
       WHERE ruta_imagen = ?
       LIMIT 1`,
      [storedPath]
    );
    if (!image) return notFound(res);

    const filePath = await resolvePrivateUploadPath(PRIVATE_UPLOAD_DIRS.ambientes, filename);
    if (!filePath) return notFound(res);
    return sendPrivateUpload(res, filePath);
  } catch (error) {
    logger.error('Error al servir imagen privada de ambiente', { error: error.message });
    return handleControllerError(error, res, 'serveEnvironmentImage', 'Error al obtener la imagen');
  }
}
