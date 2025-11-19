import defaultDb from '../config/dbconfig.js'
import { createForUsers, createForRole } from '../services/notificationService.js'

/**
 * Actualiza automáticamente el estado de mantenimientos programados a "En Proceso"
 * cuando llega la fecha/hora programada
 * Esta función se ejecuta antes de consultar mantenimientos para asegurar estados actualizados
 */
async function actualizarEstadosAutomaticos() {
  try {
    const [mantenimientosProgramados] = await defaultDb.execute(
      `SELECT id_mantenimiento, codigo_equipo, fecha_mantenimiento 
       FROM Mantenimiento 
       WHERE estado_mantenimiento = 'Programado' 
       AND fecha_mantenimiento <= NOW()`
    )

    if (mantenimientosProgramados.length > 0) {
      const ids = mantenimientosProgramados.map(m => m.id_mantenimiento)
      const placeholders = ids.map(() => '?').join(',')
      
      await defaultDb.execute(
        `UPDATE Mantenimiento 
         SET estado_mantenimiento = 'En Proceso' 
         WHERE id_mantenimiento IN (${placeholders})`,
        ids
      )

      console.log(`Actualizados ${mantenimientosProgramados.length} mantenimiento(s) a estado "En Proceso"`)
    }
  } catch (err) {
    // No fallar si hay error, solo loguear
    console.error('Error al actualizar estados automáticos de mantenimientos:', err)
  }
}

/**
 * Crear un nuevo mantenimiento
 * Admin e Instructor: pueden crear mantenimientos para cualquier equipo
 * Aprendiz: solo puede crear mantenimientos para equipos que tiene asignados
 */
export async function crearMantenimiento(req, res) {
  try {
    const {
      codigo_equipo,
      tipo_mantenimiento,
      fecha_mantenimiento,
      fecha_proximo,
      descripcion_trabajo,
      costo,
      id_usuario_tecnico,
      observaciones,
      estado_mantenimiento
    } = req.body
    const userId = req.user?.id
    const userRole = req.user?.rol

    // Validar campos obligatorios
    if (!codigo_equipo || !tipo_mantenimiento || !fecha_mantenimiento) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: codigo_equipo, tipo_mantenimiento, fecha_mantenimiento' })
    }

    // Validar que el equipo existe
    const [[equipo]] = await defaultDb.execute(
      'SELECT codigo_equipo, tipo, marca, modelo FROM Elementos WHERE codigo_equipo = ?',
      [codigo_equipo]
    )

    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' })
    }

    // Si es Instructor o Aprendiz, validar que el equipo le esté asignado
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      const [[asignacion]] = await defaultDb.execute(
        `SELECT id_responsable FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
        [codigo_equipo, userId]
      )

      if (!asignacion) {
        return res.status(403).json({
          error: 'No tienes permiso para crear mantenimientos en este equipo. Solo puedes crear mantenimientos para equipos asignados a ti.'
        })
      }
    }

    // Validar que el técnico existe si se especificó
    if (id_usuario_tecnico) {
      const [[tecnico]] = await defaultDb.execute(
        'SELECT id_usuario FROM Usuarios WHERE id_usuario = ? AND estado = "Activo"',
        [id_usuario_tecnico]
      )

      if (!tecnico) {
        return res.status(404).json({ error: 'Técnico no encontrado o inactivo' })
      }
    }

    // Formatear fecha_mantenimiento para MySQL (YYYY-MM-DD HH:MM:SS)
    let fechaMantenimientoFormatted = fecha_mantenimiento
    if (fecha_mantenimiento) {
      if (fecha_mantenimiento.includes('T')) {
        // Formato datetime-local: YYYY-MM-DDTHH:mm
        fechaMantenimientoFormatted = fecha_mantenimiento.replace('T', ' ')
        // Agregar segundos si no están presentes
        if (fechaMantenimientoFormatted.length === 16) {
          fechaMantenimientoFormatted += ':00'
        }
      } else {
        // Si viene solo la fecha, agregar hora actual
        const now = new Date()
        const timeStr = now.toTimeString().slice(0, 8) // HH:MM:SS
        fechaMantenimientoFormatted = `${fecha_mantenimiento} ${timeStr}`
      }
    }

    // Si se especifica fecha_proximo, guardarla en la tabla Elementos
    if (fecha_proximo) {
      try {
        await defaultDb.execute(
          `UPDATE Elementos 
           SET fecha_proximo_mantenimiento = ?
           WHERE codigo_equipo = ?`,
          [fecha_proximo, codigo_equipo]
        )
      } catch (err) {
        // Si la columna no existe, no fallar (se puede agregar después)
        console.warn('No se pudo actualizar fecha_proximo_mantenimiento en Elementos:', err.message)
      }
    }

    // Insertar el mantenimiento (sin fecha_proximo, ya que va en Elementos)
    const [result] = await defaultDb.execute(
      `INSERT INTO Mantenimiento 
       (codigo_equipo, tipo_mantenimiento, fecha_mantenimiento, fecha_proximo, descripcion_trabajo, costo, realizado_por, id_usuario_tecnico, observaciones, estado_mantenimiento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo_equipo,
        tipo_mantenimiento,
        fechaMantenimientoFormatted,
        null, // fecha_proximo ya no se guarda aquí, va en Elementos
        descripcion_trabajo || null,
        costo ? parseFloat(costo) : null,
        userId,
        id_usuario_tecnico || null,
        observaciones || null,
        estado_mantenimiento || 'Programado'
      ]
    )

    // Notificar a usuarios que tienen asignado este equipo
    try {
      const [responsables] = await defaultDb.execute(
        `SELECT DISTINCT id_usuario 
         FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND estado_responsabilidad = 'Activo' AND id_usuario != ?`,
        [codigo_equipo, userId]
      )

      if (responsables.length > 0) {
        const userIds = responsables.map(r => r.id_usuario)
        const equipoDesc = `${equipo.tipo} ${equipo.marca} ${equipo.modelo}`.trim()
        const fechaFormateada = new Date(fechaMantenimientoFormatted).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        
        await createForUsers({
          userIds,
          titulo: 'Mantenimiento programado en tu equipo',
          cuerpo: `Se ha programado un mantenimiento ${tipo_mantenimiento} para el equipo ${equipoDesc} el ${fechaFormateada}`,
          tipo: 'aviso',
          metadata: {
            id_mantenimiento: result.insertId,
            codigo_equipo,
            tipo_mantenimiento,
            fecha_mantenimiento: fechaMantenimientoFormatted,
            ruta: `/mantenimientos`
          },
          creadoPor: userId
        })
      }
    } catch (notifyErr) {
      console.error('Error al enviar notificaciones de mantenimiento:', notifyErr)
    }

    // Crear automáticamente un reporte sobre el mantenimiento
    const equipoDescReporte = `${equipo.tipo} ${equipo.marca} ${equipo.modelo}`.trim()
    const tituloReporte = `Mantenimiento ${tipo_mantenimiento} - ${equipoDescReporte}`
    const descripcionReporte = `Se ha registrado un mantenimiento de tipo "${tipo_mantenimiento}" para el equipo ${equipoDescReporte}.\n\n` +
      `Fecha: ${fechaMantenimientoFormatted}\n` +
      (estado_mantenimiento ? `Estado: ${estado_mantenimiento}\n` : '') +
      (descripcion_trabajo ? `Descripción: ${descripcion_trabajo}\n` : '') +
      (costo ? `Costo: $${parseFloat(costo).toLocaleString('es-CO')}\n` : '') +
      (observaciones ? `Observaciones: ${observaciones}` : '')

    try {
      await defaultDb.execute(
        `INSERT INTO Reportes (tipo_reporte, titulo, descripcion, codigo_equipo, generado_por, fecha_generacion) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        ['Mantenimiento', tituloReporte, descripcionReporte, codigo_equipo, userId]
      )
    } catch (reportErr) {
      // Si falla la creación del reporte, no fallar el mantenimiento
      console.error('Error al crear reporte automático de mantenimiento:', reportErr)
    }

    return res.status(201).json({
      ok: true,
      id: result.insertId,
      message: 'Mantenimiento registrado correctamente',
      equipo: {
        codigo: equipo.codigo_equipo,
        descripcion: equipoDescReporte
      }
    })
  } catch (err) {
    console.error('Error al crear mantenimiento:', err)
    return res.status(500).json({ error: 'Error al registrar el mantenimiento', details: err.message })
  }
}

/**
 * Listar mantenimientos
 * Admin: ve todos los mantenimientos
 * Instructor y Aprendiz: solo ven mantenimientos de equipos asignados
 */
export async function listarMantenimientos(req, res) {
  try {
    // Actualizar estados automáticamente antes de listar
    await actualizarEstadosAutomaticos()

    const userId = req.user?.id
    const userRole = req.user?.rol

    let query = `
      SELECT 
        m.id_mantenimiento,
        m.codigo_equipo,
        m.tipo_mantenimiento,
        m.fecha_mantenimiento,
        m.fecha_proximo,
        m.descripcion_trabajo,
        m.costo,
        m.estado_mantenimiento,
        m.observaciones,
        e.tipo AS equipo_tipo,
        e.marca AS equipo_marca,
        e.modelo AS equipo_modelo,
        e.numero_serie,
        u.nombre_usuario AS realizado_por_nombre,
        t.nombre_usuario AS tecnico_nombre
      FROM Mantenimiento m
      INNER JOIN Elementos e ON m.codigo_equipo = e.codigo_equipo
      LEFT JOIN Usuarios u ON m.realizado_por = u.id_usuario
      LEFT JOIN Usuarios t ON m.id_usuario_tecnico = t.id_usuario
    `

    let params = []

    // Si es Instructor o Aprendiz, filtrar solo mantenimientos de equipos asignados
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      query += `
        INNER JOIN Responsables_Equipo re 
          ON e.codigo_equipo = re.codigo_equipo
        WHERE re.id_usuario = ? AND re.estado_responsabilidad = 'Activo'
      `
      params.push(userId)
    }

    query += ` ORDER BY m.fecha_mantenimiento DESC`

    const [rows] = await defaultDb.execute(query, params)

    return res.json(rows)
  } catch (err) {
    console.error('Error al listar mantenimientos:', err)
    return res.status(500).json({ error: 'Error al obtener mantenimientos', details: err.message })
  }
}

/**
 * Obtener detalle de un mantenimiento
 */
export async function obtenerMantenimientoPorId(req, res) {
  try {
    // Actualizar estados automáticamente antes de obtener el detalle
    await actualizarEstadosAutomaticos()

    const { id } = req.params
    const userId = req.user?.id
    const userRole = req.user?.rol

    const [[mantenimiento]] = await defaultDb.execute(
      `SELECT 
        m.*,
        e.tipo AS equipo_tipo,
        e.marca AS equipo_marca,
        e.modelo AS equipo_modelo,
        e.numero_serie,
        u.nombre_usuario AS realizado_por_nombre,
        t.nombre_usuario AS tecnico_nombre
      FROM Mantenimiento m
      INNER JOIN Elementos e ON m.codigo_equipo = e.codigo_equipo
      LEFT JOIN Usuarios u ON m.realizado_por = u.id_usuario
      LEFT JOIN Usuarios t ON m.id_usuario_tecnico = t.id_usuario
      WHERE m.id_mantenimiento = ?`,
      [id]
    )

    if (!mantenimiento) {
      return res.status(404).json({ error: 'Mantenimiento no encontrado' })
    }

    // Si es Instructor o Aprendiz, validar que el equipo le esté asignado
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      const [[asignacion]] = await defaultDb.execute(
        `SELECT id_responsable FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
        [mantenimiento.codigo_equipo, userId]
      )

      if (!asignacion) {
        return res.status(403).json({ error: 'No tienes permiso para ver este mantenimiento' })
      }
    }

    return res.json(mantenimiento)
  } catch (err) {
    console.error('Error al obtener mantenimiento:', err)
    return res.status(500).json({ error: 'Error al obtener detalle del mantenimiento', details: err.message })
  }
}

/**
 * Actualizar fecha_proximo_mantenimiento de un equipo
 * Admin e Instructor: pueden actualizar cualquier equipo
 * Aprendiz: solo puede actualizar equipos asignados
 */
export async function actualizarFechaProximo(req, res) {
  try {
    const { id } = req.params
    const { fecha_proximo } = req.body
    const userId = req.user?.id
    const userRole = req.user?.rol

    if (!fecha_proximo) {
      return res.status(400).json({ error: 'La fecha del próximo mantenimiento es obligatoria' })
    }

    // Obtener el mantenimiento para obtener el codigo_equipo
    const [[mantenimiento]] = await defaultDb.execute(
      'SELECT codigo_equipo FROM Mantenimiento WHERE id_mantenimiento = ?',
      [id]
    )

    if (!mantenimiento) {
      return res.status(404).json({ error: 'Mantenimiento no encontrado' })
    }

    // Si es Instructor o Aprendiz, validar que el equipo le esté asignado
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      const [[asignacion]] = await defaultDb.execute(
        `SELECT id_responsable FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
        [mantenimiento.codigo_equipo, userId]
      )

      if (!asignacion) {
        return res.status(403).json({ error: 'No tienes permiso para actualizar este mantenimiento' })
      }
    }

    // Actualizar fecha_proximo_mantenimiento en la tabla Elementos
    try {
      await defaultDb.execute(
        `UPDATE Elementos 
         SET fecha_proximo_mantenimiento = ?
         WHERE codigo_equipo = ?`,
        [fecha_proximo, mantenimiento.codigo_equipo]
      )
    } catch (err) {
      // Si la columna no existe, intentar crearla
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('Columna fecha_proximo_mantenimiento no existe en Elementos. Ejecuta la migración SQL.')
        return res.status(400).json({ 
          error: 'La columna fecha_proximo_mantenimiento no existe. Ejecuta la migración SQL primero.' 
        })
      }
      throw err
    }

    return res.json({ 
      ok: true,
      message: 'Fecha del próximo mantenimiento actualizada correctamente',
      fecha_proximo
    })
  } catch (err) {
    console.error('Error al actualizar fecha_proximo:', err)
    return res.status(500).json({ error: 'Error al actualizar la fecha del próximo mantenimiento', details: err.message })
  }
}

/**
 * Actualizar estado de un mantenimiento
 * Admin e Instructor: pueden actualizar cualquier mantenimiento
 * Aprendiz: solo puede actualizar mantenimientos de equipos asignados
 */
export async function actualizarEstadoMantenimiento(req, res) {
  try {
    const { id } = req.params
    const { estado_mantenimiento } = req.body
    const userId = req.user?.id
    const userRole = req.user?.rol

    if (!estado_mantenimiento) {
      return res.status(400).json({ error: 'El estado es obligatorio' })
    }

    const estadosValidos = ['Programado', 'En Proceso', 'Completado', 'Cancelado']
    if (!estadosValidos.includes(estado_mantenimiento)) {
      return res.status(400).json({ error: 'Estado inválido' })
    }

    // Obtener el mantenimiento
    const [[mantenimiento]] = await defaultDb.execute(
      'SELECT codigo_equipo FROM Mantenimiento WHERE id_mantenimiento = ?',
      [id]
    )

    if (!mantenimiento) {
      return res.status(404).json({ error: 'Mantenimiento no encontrado' })
    }

    // Si es Instructor o Aprendiz, validar que el equipo le esté asignado
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      const [[asignacion]] = await defaultDb.execute(
        `SELECT id_responsable FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
        [mantenimiento.codigo_equipo, userId]
      )

      if (!asignacion) {
        return res.status(403).json({ error: 'No tienes permiso para actualizar este mantenimiento' })
      }
    }

    // Actualizar el estado
    await defaultDb.execute(
      `UPDATE Mantenimiento 
       SET estado_mantenimiento = ?
       WHERE id_mantenimiento = ?`,
      [estado_mantenimiento, id]
    )

    return res.json({ 
      ok: true,
      message: 'Estado de mantenimiento actualizado correctamente',
      estado_mantenimiento
    })
  } catch (err) {
    console.error('Error al actualizar estado de mantenimiento:', err)
    return res.status(500).json({ error: 'Error al actualizar el estado del mantenimiento', details: err.message })
  }
}

/**
 * Eliminar un mantenimiento
 * Solo Administrador puede eliminar mantenimientos
 */
export async function eliminarMantenimiento(req, res) {
  try {
    const { id } = req.params
    const userRole = req.user?.rol

    // Solo Administrador puede eliminar mantenimientos
    if (userRole !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el Administrador puede eliminar mantenimientos' })
    }

    // Verificar que el mantenimiento existe
    const [[mantenimiento]] = await defaultDb.execute(
      'SELECT id_mantenimiento FROM Mantenimiento WHERE id_mantenimiento = ?',
      [id]
    )

    if (!mantenimiento) {
      return res.status(404).json({ error: 'Mantenimiento no encontrado' })
    }

    // Eliminar el mantenimiento
    await defaultDb.execute(
      'DELETE FROM Mantenimiento WHERE id_mantenimiento = ?',
      [id]
    )

    return res.json({ 
      ok: true,
      message: 'Mantenimiento eliminado correctamente' 
    })
  } catch (err) {
    console.error('Error al eliminar mantenimiento:', err)
    return res.status(500).json({ error: 'Error al eliminar el mantenimiento', details: err.message })
  }
}

