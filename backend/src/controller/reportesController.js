import defaultDb from '../config/dbconfig.js'
import { createForUsers } from '../services/notificationService.js'
import { logger } from '../utils/logger.js'
import { obtenerEquipoPorCodigo } from '../utils/sqlQueries.js'

/**
 * Crear un nuevo reporte
 * Todos los roles pueden crear reportes
 */
export async function crearReporte(req, res) {
  try {
    // Los datos ya están validados por el middleware de validación Zod
    const { tipo_reporte, titulo, descripcion, codigo_equipo } = req.body
    const userId = req.user?.id

    // Si se especifica un equipo, validar que existe usando utilidad SQL
    if (codigo_equipo) {
      const equipo = await obtenerEquipoPorCodigo(defaultDb, codigo_equipo)

      if (!equipo) {
        return res.status(404).json({ error: 'Equipo no encontrado' })
      }

      // Si es Instructor o Aprendiz y especifica equipo, validar que le esté asignado
      if (req.user?.rol === 'Instructor' || req.user?.rol === 'Aprendiz') {
        const [[asignacion]] = await defaultDb.execute(
          `SELECT id_responsable FROM Responsables_Equipo 
           WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
          [codigo_equipo, userId]
        )

        if (!asignacion) {
          return res.status(403).json({ 
            error: 'No tienes permiso para crear reportes sobre este equipo. Solo puedes crear reportes sobre equipos asignados a ti.' 
          })
        }
      }
    }

    // Verificar que la tabla Reportes existe, si no, usar una tabla genérica o retornar error
    // Por ahora, creo el registro en una tabla simplificada
    const [result] = await defaultDb.execute(
      `INSERT INTO Reportes (tipo_reporte, titulo, descripcion, codigo_equipo, generado_por, fecha_generacion) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [tipo_reporte, titulo, descripcion, codigo_equipo || null, userId]
    ).catch(async (err) => {
      // Si la tabla no existe, intentar crearla temporalmente (solo para desarrollo)
      if (err.code === 'ER_NO_SUCH_TABLE') {
        await defaultDb.execute(`
          CREATE TABLE IF NOT EXISTS Reportes (
            id_reporte INT PRIMARY KEY AUTO_INCREMENT,
            tipo_reporte ENUM('General', 'Equipos', 'Mantenimiento', 'Novedades', 'Uso', 'Otro') NOT NULL,
            titulo VARCHAR(200) NOT NULL,
            descripcion TEXT,
            codigo_equipo INT,
            generado_por INT,
            fecha_generacion DATETIME DEFAULT NOW(),
            FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE SET NULL,
            FOREIGN KEY (generado_por) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL
          )
        `)
        // Reintentar la inserción
        return await defaultDb.execute(
          `INSERT INTO Reportes (tipo_reporte, titulo, descripcion, codigo_equipo, generado_por, fecha_generacion) 
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [tipo_reporte, titulo, descripcion, codigo_equipo || null, userId]
        )
      }
      throw err
    })

    // Si se especificó un equipo, notificar a los responsables
    if (codigo_equipo) {
      const equipoInfo = await obtenerEquipoPorCodigo(defaultDb, codigo_equipo)

      if (equipoInfo) {
        const [responsables] = await defaultDb.execute(
          `SELECT DISTINCT id_usuario 
           FROM Responsables_Equipo 
           WHERE codigo_equipo = ? AND estado_responsabilidad = 'Activo' AND id_usuario != ?`,
          [codigo_equipo, userId]
        )

        if (responsables.length > 0) {
          const userIds = responsables.map(r => r.id_usuario)
          const equipoDesc = `${equipoInfo.tipo} ${equipoInfo.placa || ''} ${equipoInfo.modelo}`.trim()
          await createForUsers({
            userIds,
            titulo: {
              key: 'nuevo_reporte_equipo',
              params: {}
            },
            cuerpo: {
              key: 'nuevo_reporte_equipo_cuerpo',
              params: {
                tipo_reporte,
                equipo: equipoDesc,
                titulo
              }
            },
            tipo: 'info',
            metadata: {
              id_reporte: result.insertId,
              codigo_equipo,
              tipo_reporte,
              ruta: `/reportes`
            },
            creadoPor: userId
          })
        }
      }
    }

    return res.status(201).json({ 
      ok: true, 
      id: result.insertId,
      message: 'Reporte creado correctamente'
    })
  } catch (err) {
    logger.error('Error al crear reporte', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al crear el reporte', details: err.message })
  }
}

/**
 * Listar reportes
 * Admin: ve todos los reportes
 * Instructor y Aprendiz: solo ven reportes de equipos asignados o que hayan creado
 */
export async function listarReportes(req, res) {
  try {
    const userId = req.user?.id
    const userRole = req.user?.rol

    let query = `
      SELECT 
        r.id_reporte,
        r.tipo_reporte,
        r.titulo,
        r.descripcion,
        r.codigo_equipo,
        r.fecha_generacion,
        u.nombre_usuario AS generado_por_nombre,
        e.tipo AS equipo_tipo,
        e.placa AS equipo_placa,
        e.modelo AS equipo_modelo,
        e.r_centro,
        e.consecutivo
      FROM Reportes r
      INNER JOIN Usuarios u ON r.generado_por = u.id_usuario
      LEFT JOIN Elementos e ON r.codigo_equipo = e.codigo_equipo
    `

    let params = []

    // Si es Instructor o Aprendiz, filtrar reportes de equipos asignados o que hayan creado
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      query += `
        WHERE (r.generado_por = ? OR EXISTS (
          SELECT 1 FROM Responsables_Equipo re 
          WHERE re.codigo_equipo = r.codigo_equipo 
          AND re.id_usuario = ? 
          AND re.estado_responsabilidad = 'Activo'
        ))
      `
      params.push(userId, userId)
    }

    query += ` ORDER BY r.fecha_generacion DESC`

    const [rows] = await defaultDb.execute(query, params).catch((err) => {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return [[], []]
      }
      throw err
    })

    return res.json(rows)
  } catch (err) {
    logger.error('Error al listar reportes', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al obtener reportes', details: err.message })
  }
}

/**
 * Obtener detalle de un reporte
 */
export async function obtenerReportePorId(req, res) {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const userRole = req.user?.rol

    const [[reporte]] = await defaultDb.execute(
      `SELECT 
        r.*,
        u.nombre_usuario AS generado_por_nombre,
        e.tipo AS equipo_tipo,
        e.placa AS equipo_placa,
        e.modelo AS equipo_modelo,
        e.r_centro,
        e.consecutivo
      FROM Reportes r
      INNER JOIN Usuarios u ON r.generado_por = u.id_usuario
      LEFT JOIN Elementos e ON r.codigo_equipo = e.codigo_equipo
      WHERE r.id_reporte = ?`,
      [id]
    ).catch((err) => {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return [[null], []]
      }
      throw err
    })

    if (!reporte) {
      return res.status(404).json({ error: 'Reporte no encontrado' })
    }

    // Si es Instructor o Aprendiz, validar que el equipo le esté asignado o que lo haya creado
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      // Si lo creó, puede verlo
      if (reporte.generado_por === userId) {
        return res.json(reporte)
      }
      
      // Si tiene un equipo asociado, validar que le esté asignado
      if (reporte.codigo_equipo) {
        const [[asignacion]] = await defaultDb.execute(
          `SELECT id_responsable FROM Responsables_Equipo 
           WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
          [reporte.codigo_equipo, userId]
        )

        if (!asignacion) {
          return res.status(403).json({ error: 'No tienes permiso para ver este reporte' })
        }
      } else {
        // Reporte general sin equipo, solo puede verlo si lo creó
      return res.status(403).json({ error: 'No tienes permiso para ver este reporte' })
      }
    }

    return res.json(reporte)
  } catch (err) {
    logger.error('Error al obtener reporte', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al obtener detalle del reporte', details: err.message })
  }
}

/**
 * Actualizar un reporte
 * Solo Administrador puede actualizar reportes
 */
export async function actualizarReporte(req, res) {
  try {
    const { id } = req.params
    const { tipo_reporte, titulo, descripcion, codigo_equipo, estado, observaciones } = req.body
    const userRole = req.user?.rol

    // Solo Administrador puede actualizar reportes
    if (userRole !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el Administrador puede editar reportes' })
    }

    if (!tipo_reporte || !titulo || !descripcion) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (tipo_reporte, titulo, descripcion)' })
    }

    // Verificar que el reporte existe
    const [[reporte]] = await defaultDb.execute(
      'SELECT id_reporte FROM Reportes WHERE id_reporte = ?',
      [id]
    ).catch((err) => {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return [[null], []]
      }
      throw err
    })

    if (!reporte) {
      return res.status(404).json({ error: 'Reporte no encontrado' })
    }

    // Si se especifica un equipo, validar que existe usando utilidad SQL
    if (codigo_equipo) {
      const equipo = await obtenerEquipoPorCodigo(defaultDb, codigo_equipo)

      if (!equipo) {
        return res.status(404).json({ error: 'Equipo no encontrado' })
      }
    }

    // Actualizar el reporte
    const updateFields = ['tipo_reporte = ?', 'titulo = ?', 'descripcion = ?', 'codigo_equipo = ?']
    const updateValues = [tipo_reporte, titulo, descripcion, codigo_equipo || null]
    
    // Agregar estado si se proporciona
    if (estado) {
      updateFields.push('estado = ?')
      updateValues.push(estado)
    }
    
    // Agregar observaciones si se proporcionan
    if (observaciones !== undefined) {
      updateFields.push('observaciones = ?')
      updateValues.push(observaciones || null)
    }
    
    updateValues.push(id)
    
    await defaultDb.execute(
      `UPDATE Reportes 
       SET ${updateFields.join(', ')}
       WHERE id_reporte = ?`,
      updateValues
    ).catch((err) => {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.status(404).json({ error: 'Tabla de reportes no encontrada' })
      }
      throw err
    })

    return res.json({ 
      ok: true,
      message: 'Reporte actualizado correctamente' 
    })
  } catch (err) {
    logger.error('Error al actualizar reporte', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al actualizar el reporte', details: err.message })
  }
}

/**
 * Eliminar un reporte
 * Solo Administrador puede eliminar reportes
 */
export async function eliminarReporte(req, res) {
  try {
    const { id } = req.params
    const userRole = req.user?.rol

    // Solo Administrador puede eliminar reportes
    if (userRole !== 'Administrador') {
      return res.status(403).json({ error: 'Solo el Administrador puede eliminar reportes' })
    }

    // Verificar que el reporte existe
    const [[reporte]] = await defaultDb.execute(
      'SELECT id_reporte FROM Reportes WHERE id_reporte = ?',
      [id]
    ).catch((err) => {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return [[null], []]
      }
      throw err
    })

    if (!reporte) {
      return res.status(404).json({ error: 'Reporte no encontrado' })
    }

    // Eliminar el reporte
    await defaultDb.execute(
      'DELETE FROM Reportes WHERE id_reporte = ?',
      [id]
    ).catch((err) => {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.status(404).json({ error: 'Tabla de reportes no encontrada' })
      }
      throw err
    })

    return res.json({ 
      ok: true,
      message: 'Reporte eliminado correctamente' 
    })
  } catch (err) {
    logger.error('Error al eliminar reporte', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al eliminar el reporte', details: err.message })
  }
}

/**
 * Obtener tipos de reporte disponibles desde la base de datos
 * Consulta los valores ENUM de la columna tipo_reporte
 */
export async function obtenerTiposReporte(req, res) {
  try {
    const [rows] = await defaultDb.execute(
      `SELECT COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Reportes' 
       AND COLUMN_NAME = 'tipo_reporte'`
    )

    if (!rows || rows.length === 0) {
      logger.warn('No se encontró información del ENUM tipo_reporte en INFORMATION_SCHEMA')
      return res.json(['General', 'Equipos', 'Mantenimiento', 'Novedades', 'Uso', 'Otro'])
    }

    const enumString = rows[0].COLUMN_TYPE
    if (!enumString || !enumString.toLowerCase().startsWith('enum')) {
      logger.warn('El tipo de columna no es un ENUM:', enumString)
      return res.json(['General', 'Equipos', 'Mantenimiento', 'Novedades', 'Uso', 'Otro'])
    }

    const valores = enumString
      .replace(/^enum\(/i, '')
      .replace(/\)$/i, '')
      .split(',')
      .map(val => val.trim().replace(/^'|'$/g, ''))
      .filter(val => val.length > 0)

    if (valores.length === 0) {
      logger.warn('No se pudieron extraer valores del ENUM')
      return res.json(['General', 'Equipos', 'Mantenimiento', 'Novedades', 'Uso', 'Otro'])
    }

    logger.info('Tipos de reporte cargados desde BD', { tipos: valores })
    return res.json(valores)
  } catch (err) {
    logger.error('Error al obtener tipos de reporte', { error: err.message, stack: err.stack })
    return res.json(['General', 'Equipos', 'Mantenimiento', 'Novedades', 'Uso', 'Otro'])
  }
}

