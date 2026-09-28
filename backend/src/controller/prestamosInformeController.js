import db from '../config/dbconfig.js';
import { buildPrestamosInformeQuery } from '../utils/prestamosInformeQuery.js';
import { logger } from '../utils/logger.js';

export async function listarPrestamosInforme(req, res) {
  if (!['Administrador', 'Cuentadante'].includes(req.user?.rol)) {
    return res.status(403).json({ error: 'No tiene acceso al informe de préstamos' });
  }
  let query;
  try {
    query = buildPrestamosInformeQuery({ rol: req.user.rol, id: req.user.id, query: req.query });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  try {
    const [[count]] = await db.execute(query.countSql, query.params);
    const [sesiones] = await db.execute(query.dataSql, query.params);
    const total = Number(count?.total) || 0;
    return res.json({ sesiones, pagination: {
      page: query.page, limit: query.limit, total,
      totalPages: Math.ceil(total / query.limit),
      hasNext: query.page * query.limit < total,
      hasPrev: query.page > 1,
    } });
  } catch (error) {
    logger.error('Error al consultar informe de préstamos', { error: error.message });
    return res.status(500).json({ error: 'No se pudo consultar el informe de préstamos' });
  }
}
