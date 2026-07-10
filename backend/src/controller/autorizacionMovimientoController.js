import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';

/**
 * Crear solicitud de autorización para mover equipo verificado.
 * Body: codigo_equipo, id_ambiente_destino, motivo (obligatorio), id_autorizador
 */
export async function crearSolicitud(req, res) {
  try {
    const userId = req.user?.id;
    const { codigo_equipo, id_ambiente_destino, motivo, id_autorizador } = req.body;

    if (!codigo_equipo || !id_ambiente_destino || !motivo || !id_autorizador) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios',
        detalle: 'Se requieren: codigo_equipo, id_ambiente_destino, motivo, id_autorizador'
      });
    }

    const motivoTrim = String(motivo).trim();
    if (!motivoTrim) {
      return res.status(400).json({ error: 'El motivo es obligatorio' });
    }

    const codigoEq = Number(codigo_equipo);
    const idDestino = Number(id_ambiente_destino);
    const idAut = Number(id_autorizador);

    const [[equipo]] = await defaultDb.execute(
      `SELECT e.codigo_equipo, e.id_ambiente, COALESCE(e.verificado_ambiente, 0) AS verificado_ambiente
       FROM Elementos e WHERE e.codigo_equipo = ?`,
      [codigoEq]
    );
    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    if (equipo.verificado_ambiente !== 1) {
      return res.status(400).json({
        error: 'Solo se requiere autorización para equipos verificados',
        detalle: 'Este equipo no está verificado; puede cambiar el ambiente directamente.'
      });
    }
    if (Number(equipo.id_ambiente) === idDestino) {
      return res.status(400).json({
        error: 'El ambiente destino debe ser distinto al actual'
      });
    }

    const [[ambienteDestino]] = await defaultDb.execute(
      'SELECT id_ambiente FROM Ambientes WHERE id_ambiente = ?',
      [idDestino]
    );
    if (!ambienteDestino) {
      return res.status(400).json({ error: 'Ambiente destino no válido' });
    }

    const [[autorizador]] = await defaultDb.execute(
      `SELECT u.id_usuario, r.nombre_rol FROM Usuarios u
       INNER JOIN Roles r ON r.id_rol = u.id_rol
       WHERE u.id_usuario = ? AND u.estado = 'Activo'`,
      [idAut]
    );
    if (!autorizador || !['Administrador', 'Cuentadante'].includes(autorizador.nombre_rol)) {
      return res.status(400).json({
        error: 'El autorizador debe ser un Administrador o Cuentadante activo'
      });
    }

    const [result] = await defaultDb.execute(
      `INSERT INTO Solicitudes_Autorizacion_Movimiento
       (codigo_equipo, id_ambiente_origen, id_ambiente_destino, motivo, id_solicitante, id_autorizador, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')`,
      [codigoEq, equipo.id_ambiente, idDestino, motivoTrim, userId, idAut]
    );

    const idSolicitud = result.insertId;
    return res.status(201).json({
      ok: true,
      id_solicitud: idSolicitud,
      message: 'Solicitud de autorización creada. El autorizador deberá aprobarla o rechazarla.'
    });
  } catch (err) {
    logger.error('Error al crear solicitud de autorización', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al crear solicitud', detalle: err.message });
  }
}

/**
 * Listar solicitudes pendientes para el usuario actual (como autorizador)
 */
export async function listarPendientesParaAutorizador(req, res) {
  try {
    const userId = req.user?.id;

    const [solicitudes] = await defaultDb.execute(
      `SELECT
        s.id_solicitud, s.codigo_equipo, s.id_ambiente_origen, s.id_ambiente_destino, s.motivo,
        s.id_solicitante, s.id_autorizador, s.estado, s.fecha_solicitud,
        e.placa AS codigo_inventario, e.tipo, e.modelo,
        a1.nombre_ambiente AS ambiente_origen, a2.nombre_ambiente AS ambiente_destino,
        u_sol.nombre_usuario AS solicitante_nombre
       FROM Solicitudes_Autorizacion_Movimiento s
       INNER JOIN Elementos e ON s.codigo_equipo = e.codigo_equipo
       INNER JOIN Ambientes a1 ON s.id_ambiente_origen = a1.id_ambiente
       INNER JOIN Ambientes a2 ON s.id_ambiente_destino = a2.id_ambiente
       INNER JOIN Usuarios u_sol ON s.id_solicitante = u_sol.id_usuario
       WHERE s.id_autorizador = ? AND s.estado = 'Pendiente'
       ORDER BY s.fecha_solicitud DESC`,
      [userId]
    );

    return res.json({ solicitudes });
  } catch (err) {
    logger.error('Error al listar solicitudes pendientes', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al listar solicitudes', detalle: err.message });
  }
}

/**
 * Listar solicitudes del usuario actual (como solicitante)
 */
export async function listarMisSolicitudes(req, res) {
  try {
    const userId = req.user?.id;
    const estado = req.query.estado || null;

    let query = `
      SELECT
        s.id_solicitud, s.codigo_equipo, s.id_ambiente_origen, s.id_ambiente_destino, s.motivo,
        s.estado, s.fecha_solicitud, s.fecha_resolucion, s.observacion_rechazo, s.fecha_uso,
        e.placa AS codigo_inventario, e.tipo, e.modelo,
        a1.nombre_ambiente AS ambiente_origen, a2.nombre_ambiente AS ambiente_destino,
        u_aut.nombre_usuario AS autorizador_nombre
       FROM Solicitudes_Autorizacion_Movimiento s
       INNER JOIN Elementos e ON s.codigo_equipo = e.codigo_equipo
       INNER JOIN Ambientes a1 ON s.id_ambiente_origen = a1.id_ambiente
       INNER JOIN Ambientes a2 ON s.id_ambiente_destino = a2.id_ambiente
       LEFT JOIN Usuarios u_aut ON s.id_autorizador = u_aut.id_usuario
       WHERE s.id_solicitante = ?
    `;
    const params = [userId];
    if (estado) {
      query += ' AND s.estado = ?';
      params.push(estado);
    }
    query += ' ORDER BY s.fecha_solicitud DESC';

    const [solicitudes] = await defaultDb.execute(query, params);
    return res.json({ solicitudes });
  } catch (err) {
    logger.error('Error al listar mis solicitudes', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al listar solicitudes', detalle: err.message });
  }
}

/**
 * Aprobar solicitud (solo el usuario designado como autorizador)
 */
export async function aprobarSolicitud(req, res) {
  try {
    const userId = req.user?.id;
    const idSolicitud = Number(req.params.id);
    if (!idSolicitud) {
      return res.status(400).json({ error: 'ID de solicitud requerido' });
    }

    const [[solicitud]] = await defaultDb.execute(
      'SELECT id_solicitud, id_autorizador, estado FROM Solicitudes_Autorizacion_Movimiento WHERE id_solicitud = ?',
      [idSolicitud]
    );
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    if (solicitud.estado !== 'Pendiente') {
      return res.status(400).json({ error: 'La solicitud ya fue resuelta' });
    }
    if (Number(solicitud.id_autorizador) !== userId) {
      return res.status(403).json({ error: 'Solo el autorizador designado puede aprobar esta solicitud' });
    }

    await defaultDb.execute(
      `UPDATE Solicitudes_Autorizacion_Movimiento
       SET estado = 'Aprobada', fecha_resolucion = NOW(), id_resolucion_por = ?
       WHERE id_solicitud = ?`,
      [userId, idSolicitud]
    );

    return res.json({ ok: true, message: 'Solicitud aprobada. El solicitante puede ejecutar el movimiento.' });
  } catch (err) {
    logger.error('Error al aprobar solicitud', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al aprobar', detalle: err.message });
  }
}

/**
 * Rechazar solicitud (solo el autorizador designado)
 */
export async function rechazarSolicitud(req, res) {
  try {
    const userId = req.user?.id;
    const idSolicitud = Number(req.params.id);
    const observacion_rechazo = req.body?.observacion_rechazo != null ? String(req.body.observacion_rechazo).trim() || null : null;

    if (!idSolicitud) {
      return res.status(400).json({ error: 'ID de solicitud requerido' });
    }

    const [[solicitud]] = await defaultDb.execute(
      'SELECT id_solicitud, id_autorizador, estado FROM Solicitudes_Autorizacion_Movimiento WHERE id_solicitud = ?',
      [idSolicitud]
    );
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    if (solicitud.estado !== 'Pendiente') {
      return res.status(400).json({ error: 'La solicitud ya fue resuelta' });
    }
    if (Number(solicitud.id_autorizador) !== userId) {
      return res.status(403).json({ error: 'Solo el autorizador designado puede rechazar esta solicitud' });
    }

    await defaultDb.execute(
      `UPDATE Solicitudes_Autorizacion_Movimiento
       SET estado = 'Rechazada', fecha_resolucion = NOW(), id_resolucion_por = ?, observacion_rechazo = ?
       WHERE id_solicitud = ?`,
      [userId, observacion_rechazo, idSolicitud]
    );

    return res.json({ ok: true, message: 'Solicitud rechazada' });
  } catch (err) {
    logger.error('Error al rechazar solicitud', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al rechazar', detalle: err.message });
  }
}

/**
 * Contar solicitudes pendientes para el usuario actual (como autorizador).
 * Sirve para mostrar badge en menú o dashboard.
 */
export async function contarPendientesParaAutorizador(req, res) {
  try {
    const userId = req.user?.id;
    const [[row]] = await defaultDb.execute(
      `SELECT COUNT(*) AS total FROM Solicitudes_Autorizacion_Movimiento
       WHERE id_autorizador = ? AND estado = 'Pendiente'`,
      [userId]
    );
    return res.json({ count: row?.total ?? 0 });
  } catch (err) {
    logger.error('Error al contar pendientes', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al contar', detalle: err.message });
  }
}

/**
 * Historial de autorizaciones resueltas por el usuario actual (como autorizador).
 * Solo estados Aprobada y Rechazada.
 */
export async function listarHistorialAutorizador(req, res) {
  try {
    const userId = req.user?.id;
    const estado = req.query.estado || null;

    let query = `
      SELECT
        s.id_solicitud, s.codigo_equipo, s.id_ambiente_origen, s.id_ambiente_destino, s.motivo,
        s.estado, s.fecha_solicitud, s.fecha_resolucion, s.observacion_rechazo, s.fecha_uso,
        e.placa AS codigo_inventario, e.tipo, e.modelo,
        a1.nombre_ambiente AS ambiente_origen, a2.nombre_ambiente AS ambiente_destino,
        u_sol.nombre_usuario AS solicitante_nombre
       FROM Solicitudes_Autorizacion_Movimiento s
       INNER JOIN Elementos e ON s.codigo_equipo = e.codigo_equipo
       INNER JOIN Ambientes a1 ON s.id_ambiente_origen = a1.id_ambiente
       INNER JOIN Ambientes a2 ON s.id_ambiente_destino = a2.id_ambiente
       LEFT JOIN Usuarios u_sol ON s.id_solicitante = u_sol.id_usuario
       WHERE s.id_autorizador = ? AND s.estado IN ('Aprobada', 'Rechazada')
    `;
    const params = [userId];
    if (estado && ['Aprobada', 'Rechazada'].includes(estado)) {
      query += ' AND s.estado = ?';
      params.push(estado);
    }
    query += ' ORDER BY s.fecha_resolucion DESC, s.fecha_solicitud DESC';

    const [solicitudes] = await defaultDb.execute(query, params);
    return res.json({ solicitudes });
  } catch (err) {
    logger.error('Error al listar historial de autorizaciones', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al listar historial', detalle: err.message });
  }
}

/**
 * Listar autorizaciones aprobadas y no usadas para un equipo y ambiente destino.
 * Se usa en el formulario de edición al cambiar ambiente (elegir qué autorización usar).
 */
export async function listarDisponiblesParaMovimiento(req, res) {
  try {
    const codigo_equipo = Number(req.query.codigo_equipo);
    const id_ambiente_destino = Number(req.query.id_ambiente_destino);
    if (!codigo_equipo || !id_ambiente_destino) {
      return res.status(400).json({
        error: 'Se requieren codigo_equipo e id_ambiente_destino'
      });
    }

    const [lista] = await defaultDb.execute(
      `SELECT
        s.id_solicitud, s.motivo, s.fecha_solicitud, s.fecha_resolucion,
        a1.nombre_ambiente AS ambiente_origen, a2.nombre_ambiente AS ambiente_destino,
        u_aut.nombre_usuario AS autorizador_nombre
       FROM Solicitudes_Autorizacion_Movimiento s
       INNER JOIN Ambientes a1 ON s.id_ambiente_origen = a1.id_ambiente
       INNER JOIN Ambientes a2 ON s.id_ambiente_destino = a2.id_ambiente
       LEFT JOIN Usuarios u_aut ON s.id_autorizador = u_aut.id_usuario
       WHERE s.codigo_equipo = ? AND s.id_ambiente_destino = ? AND s.estado = 'Aprobada' AND s.fecha_uso IS NULL
       ORDER BY s.fecha_resolucion DESC`,
      [codigo_equipo, id_ambiente_destino]
    );

    return res.json({ autorizaciones: lista });
  } catch (err) {
    logger.error('Error al listar autorizaciones disponibles', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al listar autorizaciones', detalle: err.message });
  }
}
