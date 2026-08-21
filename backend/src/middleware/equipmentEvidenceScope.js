import defaultDb from '../config/dbconfig.js';
import { deleteImageFile } from './uploadMiddleware.js';

const scopeQuery = `
  SELECT e.codigo_equipo
  FROM Elementos e
  WHERE e.codigo_equipo = ?
    AND (
      e.id_cuentadante = ?
      OR EXISTS (
        SELECT 1 FROM Responsabilidades_Ambiente ra
        WHERE ra.id_ambiente = e.id_ambiente
          AND ra.id_usuario = ?
          AND ra.estado_responsabilidad = 'Activa'
      )
      OR EXISTS (
        SELECT 1 FROM Responsables_Equipo re
        WHERE re.codigo_equipo = e.codigo_equipo
          AND re.id_usuario = ?
          AND re.estado_responsabilidad = 'Activo'
      )
    )
  LIMIT 1`;

function deny(req, res, files = []) {
  req.evidenceScope = { canAccess: false };
  for (const file of files) {
    // The upload middleware runs after this guard, but preserve the invariant
    // if the middleware is reused in a different route ordering.
    if (file?.filename) deleteImageFile(file.filename);
  }
  return res.status(403).json({ error: 'Acceso denegado al ambiente del equipo' });
}

export function requireEquipmentEvidenceScope({ resolveCodigoEquipo } = {}) {
  return async (req, res, next) => {
    const userId = req.user?.id ?? req.user?.id_usuario;
    const role = req.user?.rol;
    const codigoEquipo = resolveCodigoEquipo ? await resolveCodigoEquipo(req) : req.params.codigoEquipo;

    if (!userId || !role) return deny(req, res, req.files || []);
    if (role === 'Administrador') {
      req.evidenceScope = { canAccess: true };
      return next();
    }

    const [rows] = await defaultDb.execute(scopeQuery, [codigoEquipo, userId, userId, userId]);
    if (!rows?.length) return deny(req, res, req.files || []);

    req.evidenceScope = { canAccess: true, codigoEquipo: rows[0].codigo_equipo };
    return next();
  };
}

export function requireEquipmentEvidenceScopeWhenFiles(options) {
  const requireScope = requireEquipmentEvidenceScope(options);
  return (req, res, next) => {
    const files = req.files || (req.file ? [req.file] : []);
    return files.length > 0 ? requireScope(req, res, next) : next();
  };
}

export async function resolveCodigoEquipoFromImage(req) {
  const [[image]] = await defaultDb.execute(
    'SELECT codigo_equipo FROM Imagenes_Equipo WHERE id_imagen_equipo = ? LIMIT 1',
    [req.params.idImagen]
  );
  return image?.codigo_equipo;
}
