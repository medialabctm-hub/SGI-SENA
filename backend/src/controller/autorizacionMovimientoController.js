import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';
import { handleControllerError } from '../utils/controllerHelpers.js';

/**
 * Resuelve a quién debe dirigirse la autorización de movimiento de un equipo.
 *
 * La autorización NO es global: la recibe quien responde por el equipo. Cascada:
 *   1. Cuentadante asignado al equipo (Elementos.id_cuentadante), si sigue activo.
 *   2. Responsable Principal activo del ambiente de origen (Responsabilidades_Ambiente).
 *   3. Administrador activo (respaldo, cuando el equipo no tiene cuentadante).
 *
 * @param {number} codigoEquipo
 * @param {number} [idAmbienteOrigen] Ambiente actual del equipo, para el paso 2
 * @returns {Promise<{id_usuario:number, nombre_usuario:string, nombre_rol:string, motivo:string}|null>}
 */
export async function resolverAutorizador(codigoEquipo, idAmbienteOrigen = null) {
  // 1. Cuentadante asignado al equipo
  const [[cuentadante]] = await defaultDb.execute(
    `SELECT u.id_usuario, u.nombre_usuario, r.nombre_rol
     FROM Elementos e
     INNER JOIN Usuarios u ON u.id_usuario = e.id_cuentadante
     INNER JOIN Roles r ON r.id_rol = u.id_rol
     WHERE e.codigo_equipo = ? AND u.estado = 'Activo'`,
    [codigoEquipo]
  );
  if (cuentadante) {
    return { ...cuentadante, motivo: 'Cuentadante asignado al equipo' };
  }

  // 2. Responsable Principal activo del ambiente de origen
  if (idAmbienteOrigen) {
    const [[responsableAmbiente]] = await defaultDb.execute(
      `SELECT u.id_usuario, u.nombre_usuario, r.nombre_rol
       FROM Responsabilidades_Ambiente ra
       INNER JOIN Usuarios u ON u.id_usuario = ra.id_usuario
       INNER JOIN Roles r ON r.id_rol = u.id_rol
       WHERE ra.id_ambiente = ?
         AND ra.tipo_responsabilidad = 'Principal'
         AND ra.estado_responsabilidad = 'Activa'
         AND u.estado = 'Activo'
         AND r.nombre_rol IN ('Administrador', 'Cuentadante')
       ORDER BY ra.fecha_inicio DESC
       LIMIT 1`,
      [idAmbienteOrigen]
    );
    if (responsableAmbiente) {
      return { ...responsableAmbiente, motivo: 'Responsable principal del ambiente' };
    }
  }

  // 3. Respaldo: administrador activo
  const [[administrador]] = await defaultDb.execute(
    `SELECT u.id_usuario, u.nombre_usuario, r.nombre_rol
     FROM Usuarios u
     INNER JOIN Roles r ON r.id_rol = u.id_rol
     WHERE r.nombre_rol = 'Administrador' AND u.estado = 'Activo'
     ORDER BY u.id_usuario
     LIMIT 1`
  );
  if (administrador) {
    return { ...administrador, motivo: 'Administrador (el equipo no tiene cuentadante asignado)' };
  }

  return null;
}

/**
 * Consultar a quién se enviará la autorización de un equipo, sin crearla.
 * Permite mostrar el destinatario en el formulario en modo lectura.
 */
export async function obtenerAutorizadorParaEquipo(req, res) {
  try {
    const codigoEquipo = Number(req.query.codigo_equipo);
    if (!codigoEquipo) {
      return res.status(400).json({ error: 'Se requiere codigo_equipo' });
    }

    const [[equipo]] = await defaultDb.execute(
      'SELECT codigo_equipo, id_ambiente FROM Elementos WHERE codigo_equipo = ?',
      [codigoEquipo]
    );
    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const autorizador = await resolverAutorizador(codigoEquipo, equipo.id_ambiente);
    if (!autorizador) {
      return res.status(409).json({
        error: 'No hay ningún usuario disponible para autorizar el movimiento de este equipo',
        detalle: 'El equipo no tiene cuentadante asignado y no hay administradores activos.'
      });
    }

    return res.json({ autorizador });
  } catch (err) {
    logger.error('Error al resolver autorizador', { error: err.message, stack: err.stack });
    return handleControllerError(err, res, 'obtenerAutorizadorParaEquipo', 'Error al resolver el autorizador');
  }
}

/**
 * Crear solicitud de autorización para mover equipo verificado.
 * Body: codigo_equipo, id_ambiente_destino, motivo (obligatorio)
 *
 * El destinatario NO lo elige el solicitante: se deriva del equipo con
 * resolverAutorizador(). Un `id_autorizador` en el body se ignora.
 */
export async function crearSolicitud(req, res) {
  try {
    const userId = req.user?.id;
    const { codigo_equipo, id_ambiente_destino, motivo } = req.body;

    if (!codigo_equipo || !id_ambiente_destino || !motivo) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios',
        detalle: 'Se requieren: codigo_equipo, id_ambiente_destino, motivo'
      });
    }

    const motivoTrim = String(motivo).trim();
    if (!motivoTrim) {
      return res.status(400).json({ error: 'El motivo es obligatorio' });
    }

    const codigoEq = Number(codigo_equipo);
    const idDestino = Number(id_ambiente_destino);

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

    // El destinatario se deriva del equipo, no lo elige el solicitante
    const autorizador = await resolverAutorizador(codigoEq, equipo.id_ambiente);
    if (!autorizador) {
      return res.status(409).json({
        error: 'No hay ningún usuario disponible para autorizar el movimiento de este equipo',
        detalle: 'El equipo no tiene cuentadante asignado y no hay administradores activos.'
      });
    }

    if (Number(autorizador.id_usuario) === Number(userId)) {
      return res.status(409).json({
        error: 'Ya eres la persona responsable de autorizar este equipo, no necesitas solicitar permiso',
        detalle: 'Puedes cambiar el ambiente del equipo directamente desde Consultar Inventario.'
      });
    }

    const [result] = await defaultDb.execute(
      `INSERT INTO Solicitudes_Autorizacion_Movimiento
       (codigo_equipo, id_ambiente_origen, id_ambiente_destino, motivo, id_solicitante, id_autorizador, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')`,
      [codigoEq, equipo.id_ambiente, idDestino, motivoTrim, userId, autorizador.id_usuario]
    );

    const idSolicitud = result.insertId;
    return res.status(201).json({
      ok: true,
      id_solicitud: idSolicitud,
      autorizador: {
        id_usuario: autorizador.id_usuario,
        nombre_usuario: autorizador.nombre_usuario,
        motivo: autorizador.motivo
      },
      message: `Solicitud enviada a ${autorizador.nombre_usuario}, responsable de este equipo. Deberá aprobarla o rechazarla.`
    });
  } catch (err) {
    logger.error('Error al crear solicitud de autorización', { error: err.message, stack: err.stack });
    return handleControllerError(err, res, 'crearSolicitud', 'Error al crear solicitud');
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
    return handleControllerError(err, res, 'listarPendientesParaAutorizador', 'Error al listar solicitudes');
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
    return handleControllerError(err, res, 'listarMisSolicitudes', 'Error al listar solicitudes');
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
    return handleControllerError(err, res, 'aprobarSolicitud', 'Error al aprobar');
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
    return handleControllerError(err, res, 'rechazarSolicitud', 'Error al rechazar');
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
    return handleControllerError(err, res, 'contarPendientesParaAutorizador', 'Error al contar');
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
    return handleControllerError(err, res, 'listarHistorialAutorizador', 'Error al listar historial');
  }
}

/**
 * Listar autorizaciones aprobadas y no usadas para un equipo y ambiente destino.
 * Se usa en el formulario de edición al cambiar ambiente (elegir qué autorización usar).
 */
export async function listarDisponiblesParaMovimiento(req, res) {
  try {
    const userId = req.user?.id;
    const codigo_equipo = Number(req.query.codigo_equipo);
    const id_ambiente_destino = Number(req.query.id_ambiente_destino);
    if (!codigo_equipo || !id_ambiente_destino) {
      return res.status(400).json({
        error: 'Se requieren codigo_equipo e id_ambiente_destino'
      });
    }

    // Solo se exponen las autorizaciones en las que el usuario participa:
    // las que solicitó o las que le corresponde autorizar.
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
         AND (s.id_solicitante = ? OR s.id_autorizador = ?)
       ORDER BY s.fecha_resolucion DESC`,
      [codigo_equipo, id_ambiente_destino, userId, userId]
    );

    return res.json({ autorizaciones: lista });
  } catch (err) {
    logger.error('Error al listar autorizaciones disponibles', { error: err.message, stack: err.stack });
    return handleControllerError(err, res, 'listarDisponiblesParaMovimiento', 'Error al listar autorizaciones');
  }
}
