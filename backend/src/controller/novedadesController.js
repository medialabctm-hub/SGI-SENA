import defaultDb from '../config/dbconfig.js'
import { createForUsers, createForRole } from '../services/notificationService.js'
import { logger } from '../utils/logger.js'
import { obtenerEquipoPorCodigo, obtenerUsuarioActivo } from '../utils/sqlQueries.js'
import emailService from '../services/emailService.js'

/**
 * Crear una nueva novedad
 * Admin e Instructor: pueden crear novedades para cualquier equipo
 * Aprendiz: solo puede crear novedades para equipos que tiene asignados
 */
export async function crearNovedad(req, res) {
  try {
    // Los datos ya están validados por el middleware de validación Zod
    const { codigo_equipo, tipo_novedad, descripcion } = req.body
    const userId = req.user?.id

    logger.debug('Crear novedad - Datos recibidos', { codigo_equipo, tipo_novedad, descripcion: descripcion?.substring(0, 50), userId })

    // Normalizar tipo_novedad (ya validado por Zod)
    const tipoNovedadNormalizado = tipo_novedad.trim()

    // Validar que el equipo existe usando utilidad SQL
    const equipo = await obtenerEquipoPorCodigo(defaultDb, codigo_equipo)

    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' })
    }

    // Si es Aprendiz, validar que el equipo le esté asignado
    if (req.user?.rol === 'Aprendiz') {
      const [[asignacion]] = await defaultDb.execute(
        `SELECT id_responsable FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
        [codigo_equipo, userId]
      )

      if (!asignacion) {
        return res.status(403).json({ 
          error: 'No tienes permiso para reportar novedades en este equipo. Solo puedes reportar novedades en equipos asignados a ti.' 
        })
      }
    }

    // Insertar la novedad
    let result
    try {
      [result] = await defaultDb.execute(
        `INSERT INTO Novedades (codigo_equipo, tipo_novedad, descripcion, reportado_por) 
         VALUES (?, ?, ?, ?)`,
        [codigo_equipo, tipoNovedadNormalizado, descripcion.trim(), userId]
      )
      logger.info('Novedad insertada correctamente', { id: result.insertId })
    } catch (insertErr) {
      logger.error('Error al insertar novedad en BD', { error: insertErr.message, stack: insertErr.stack })
      // Si el error es por tipo_novedad, dar un mensaje más claro
      if (insertErr.message && insertErr.message.includes('tipo_novedad')) {
        return res.status(400).json({
          error: 'Tipo de novedad no válido para la base de datos',
          details: 'Ejecuta el script BD/actualizar_tipo_novedad.sql para actualizar los tipos permitidos',
          tipo_intentado: tipoNovedadNormalizado
        })
      }
      throw insertErr
    }

    const equipoDesc = `${equipo.tipo} ${equipo.placa || ''} ${equipo.modelo}`.trim()
    const userRole = req.user?.rol

    // Si es Instructor o Aprendiz, notificar al Administrador
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      try {
        await createForRole({
          rolNombre: 'Administrador',
          titulo: {
            key: 'nueva_novedad_reportada',
            params: {}
          },
          cuerpo: {
            key: 'nueva_novedad_reportada_cuerpo',
            params: {
              rol: userRole,
              nombre: req.user?.nombre || 'usuario',
              tipo_novedad,
              equipo: equipoDesc
            }
          },
          tipo: 'alerta',
          metadata: {
            id_novedad: result.insertId,
            codigo_equipo,
            tipo_novedad,
            reportado_por: userId,
            ruta: `/novedades`
          },
          creadoPor: userId
        })
      } catch (notifyErr) {
        logger.error('Error al notificar a administradores', { error: notifyErr.message })
      }
    }

    // Notificar a los responsables del equipo (excluyendo al que reportó)
    try {
      const [responsables] = await defaultDb.execute(
        `SELECT DISTINCT id_usuario 
         FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND estado_responsabilidad = 'Activo' AND id_usuario != ?`,
        [codigo_equipo, userId]
      )

      if (responsables.length > 0) {
        const userIds = responsables.map(r => r.id_usuario)
        await createForUsers({
          userIds,
          titulo: {
            key: 'nueva_novedad_en_tu_equipo',
            params: {}
          },
          cuerpo: {
            key: 'nueva_novedad_en_tu_equipo_cuerpo',
            params: {
              tipo_novedad,
              equipo: equipoDesc
            }
          },
          tipo: 'aviso',
          metadata: {
            id_novedad: result.insertId,
            codigo_equipo,
            tipo_novedad,
            ruta: `/novedades`
          },
          creadoPor: userId
        })
      }
    } catch (notifyErr) {
      logger.error('Error al notificar a responsables', { error: notifyErr.message })
    }

    /**
     * Notificaciones críticas a cuentadante + instructores del ambiente
     * solo para tipos de novedad de alto impacto (daño, pérdida, robo)
     */
    try {
      const tipoLower = tipoNovedadNormalizado.toLowerCase()
      const esCritica =
        tipoLower.includes('daño') ||
        tipoLower.includes('dano') ||
        tipoLower.includes('pérdida') ||
        tipoLower.includes('perdida') ||
        tipoLower.includes('robo')

      if (esCritica) {
        const destinatariosIds = new Set()

        // 1. Cuentadante principal del equipo (columna id_cuentadante en Elementos)
        if (equipo.id_cuentadante) {
          destinatariosIds.add(equipo.id_cuentadante)
        }

        // 2. Instructores que tengan responsabilidades activas en el ambiente del equipo
        if (equipo.id_ambiente) {
          const [instructores] = await defaultDb.execute(
            `SELECT DISTINCT ra.id_usuario
             FROM Responsabilidades_Ambiente ra
             INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
             INNER JOIN Roles r ON u.id_rol = r.id_rol
             WHERE ra.id_ambiente = ?
               AND ra.estado_responsabilidad = 'Activa'
               AND ra.fecha_inicio <= NOW()
               AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())
               AND r.nombre_rol = 'Instructor'`,
            [equipo.id_ambiente]
          )
          instructores.forEach(i => destinatariosIds.add(i.id_usuario))
        }

        // No notificar al mismo usuario que reporta
        destinatariosIds.delete(userId)

        const destinatariosArray = Array.from(destinatariosIds).filter(id => Number.isFinite(id))

        if (destinatariosArray.length > 0) {
          // Notificación en la campana
          await createForUsers({
            userIds: destinatariosArray,
            titulo: {
              key: 'nueva_novedad_en_tu_equipo',
              params: {}
            },
            cuerpo: {
              key: 'nueva_novedad_en_tu_equipo_cuerpo',
              params: {
                tipo_novedad,
                equipo: equipoDesc
              }
            },
            tipo: 'alerta',
            metadata: {
              id_novedad: result.insertId,
              codigo_equipo,
              tipo_novedad,
              ruta: `/novedades`
            },
            creadoPor: userId
          })

          // Correos electrónicos a cuentadante e instructores
          const placeholders = destinatariosArray.map(() => '?').join(',')
          const [usuariosDestino] = await defaultDb.execute(
            `SELECT id_usuario, nombre_usuario, correo
             FROM Usuarios
             WHERE id_usuario IN (${placeholders})
               AND correo IS NOT NULL
               AND correo <> ''`,
            destinatariosArray
          )

          // Obtener información del usuario que reportó
          const [[usuarioReportador]] = await defaultDb.execute(
            'SELECT nombre_usuario FROM Usuarios WHERE id_usuario = ?',
            [userId]
          )
          const nombreReportador = usuarioReportador?.nombre_usuario || 'Usuario del sistema'

          // Formatear fecha de adquisición
          const fechaAdq = equipo.fecha_adquisicion
            ? new Date(equipo.fecha_adquisicion).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : 'No registrada'

          // Formatear valor
          const valorFormateado = equipo.valor_ingreso || equipo.costo
            ? new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP'
              }).format(equipo.valor_ingreso || equipo.costo)
            : 'No registrado'

          for (const usuario of usuariosDestino) {
            const subject = `⚠️ Novedad crítica: ${tipoNovedadNormalizado} - ${equipoDesc}`

            const htmlContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <style>
                  body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 700px;
                    margin: 0 auto;
                    padding: 20px;
                    background: #f5f5f5;
                  }
                  .container {
                    background: white;
                    border-radius: 8px;
                    padding: 30px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  }
                  .header {
                    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 8px 8px 0 0;
                    margin: -30px -30px 20px -30px;
                    text-align: center;
                  }
                  .header h1 {
                    margin: 0;
                    font-size: 24px;
                  }
                  .alert-box {
                    background: #fef2f2;
                    border-left: 4px solid #dc2626;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                  }
                  .info-section {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                  }
                  .info-section h2 {
                    margin-top: 0;
                    color: #1a2a3a;
                    font-size: 18px;
                    border-bottom: 2px solid #e5e7eb;
                    padding-bottom: 10px;
                  }
                  .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-top: 15px;
                  }
                  .info-item {
                    display: flex;
                    flex-direction: column;
                  }
                  .info-label {
                    font-weight: 600;
                    color: #6b7280;
                    font-size: 0.9rem;
                    margin-bottom: 4px;
                  }
                  .info-value {
                    color: #1a2a3a;
                    font-size: 1rem;
                  }
                  .description-box {
                    background: #fff;
                    border: 1px solid #e5e7eb;
                    padding: 15px;
                    border-radius: 6px;
                    margin: 15px 0;
                    white-space: pre-wrap;
                  }
                  .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    color: #6b7280;
                    font-size: 0.9rem;
                  }
                  .badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    margin-left: 8px;
                  }
                  .badge-critical {
                    background: #fee2e2;
                    color: #991b1b;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>⚠️ Novedad Crítica Registrada</h1>
                  </div>

                  <div class="alert-box">
                    <strong>Tipo de Novedad:</strong> <span class="badge badge-critical">${tipoNovedadNormalizado}</span>
                    <p style="margin: 10px 0 0 0;">Se ha registrado una novedad crítica que requiere tu atención inmediata.</p>
                  </div>

                  <div class="info-section">
                    <h2>📋 Información del Equipo</h2>
                    <div class="info-grid">
                      <div class="info-item">
                        <span class="info-label">Código de Equipo:</span>
                        <span class="info-value">${equipo.codigo_equipo || 'N/A'}</span>
                      </div>
                      <div class="info-item">
                        <span class="info-label">Tipo:</span>
                        <span class="info-value">${equipo.tipo || 'N/A'}</span>
                      </div>
                      ${equipo.placa ? `
                      <div class="info-item">
                        <span class="info-label">Placa / Código Inventario:</span>
                        <span class="info-value">${equipo.placa}</span>
                      </div>
                      ` : ''}
                      ${equipo.consecutivo ? `
                      <div class="info-item">
                        <span class="info-label">Consecutivo:</span>
                        <span class="info-value">${equipo.consecutivo}</span>
                      </div>
                      ` : ''}
                      ${equipo.modelo ? `
                      <div class="info-item">
                        <span class="info-label">Modelo:</span>
                        <span class="info-value">${equipo.modelo}</span>
                      </div>
                      ` : ''}
                      ${equipo.r_centro ? `
                      <div class="info-item">
                        <span class="info-label">Centro:</span>
                        <span class="info-value">${equipo.r_centro}</span>
                      </div>
                      ` : ''}
                      ${equipo.nombre_ambiente ? `
                      <div class="info-item">
                        <span class="info-label">Ambiente:</span>
                        <span class="info-value">${equipo.codigo_ambiente || ''} - ${equipo.nombre_ambiente}</span>
                      </div>
                      ` : ''}
                      ${equipo.estado_fisico ? `
                      <div class="info-item">
                        <span class="info-label">Estado Físico:</span>
                        <span class="info-value">${equipo.estado_fisico}</span>
                      </div>
                      ` : ''}
                      ${equipo.fecha_adquisicion ? `
                      <div class="info-item">
                        <span class="info-label">Fecha de Adquisición:</span>
                        <span class="info-value">${fechaAdq}</span>
                      </div>
                      ` : ''}
                      ${(equipo.valor_ingreso || equipo.costo) ? `
                      <div class="info-item">
                        <span class="info-label">Valor de Ingreso:</span>
                        <span class="info-value">${valorFormateado}</span>
                      </div>
                      ` : ''}
                      ${equipo.vida_util_meses ? `
                      <div class="info-item">
                        <span class="info-label">Vida Útil:</span>
                        <span class="info-value">${equipo.vida_util_meses} meses</span>
                      </div>
                      ` : ''}
                    </div>
                    ${equipo.descripcion ? `
                    <div style="margin-top: 15px;">
                      <span class="info-label">Descripción del Equipo:</span>
                      <div style="margin-top: 8px; padding: 10px; background: #fff; border-radius: 4px; border: 1px solid #e5e7eb;">
                        ${equipo.descripcion}
                      </div>
                    </div>
                    ` : ''}
                    ${equipo.specs_completas || equipo.atributos ? `
                    <div style="margin-top: 15px;">
                      <span class="info-label">Especificaciones / Atributos:</span>
                      <div style="margin-top: 8px; padding: 10px; background: #fff; border-radius: 4px; border: 1px solid #e5e7eb; white-space: pre-wrap; font-family: monospace; font-size: 0.9rem;">
                        ${equipo.specs_completas || equipo.atributos}
                      </div>
                    </div>
                    ` : ''}
                  </div>

                  <div class="info-section">
                    <h2>📝 Detalle de la Novedad</h2>
                    <div style="margin-top: 15px;">
                      <span class="info-label">Descripción:</span>
                      <div class="description-box">${descripcion.trim().replace(/\n/g, '<br>')}</div>
                    </div>
                    <div style="margin-top: 15px;">
                      <span class="info-label">Reportado por:</span>
                      <span class="info-value">${nombreReportador}</span>
                    </div>
                    <div style="margin-top: 15px;">
                      <span class="info-label">Fecha de registro:</span>
                      <span class="info-value">${new Date().toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                  </div>

                  <div class="footer">
                    <p>Este es un correo automático del Sistema de Gestión de Equipos SENA.</p>
                    <p>Puedes revisar el detalle completo en el módulo de Novedades del sistema.</p>
                    <p style="margin-top: 15px; color: #9ca3af; font-size: 0.85rem;">
                      Por favor, no respondas a este correo. Si necesitas más información, contacta al administrador del sistema.
                    </p>
                  </div>
                </div>
              </body>
              </html>
            `

            const textContent =
              `⚠️ NOVEDAD CRÍTICA REGISTRADA\n` +
              `================================\n\n` +
              `Tipo de Novedad: ${tipoNovedadNormalizado}\n\n` +
              `INFORMACIÓN DEL EQUIPO\n` +
              `----------------------\n` +
              `Código de Equipo: ${equipo.codigo_equipo || 'N/A'}\n` +
              `Tipo: ${equipo.tipo || 'N/A'}\n` +
              (equipo.placa ? `Placa / Código Inventario: ${equipo.placa}\n` : '') +
              (equipo.consecutivo ? `Consecutivo: ${equipo.consecutivo}\n` : '') +
              (equipo.modelo ? `Modelo: ${equipo.modelo}\n` : '') +
              (equipo.r_centro ? `Centro: ${equipo.r_centro}\n` : '') +
              (equipo.nombre_ambiente ? `Ambiente: ${equipo.codigo_ambiente || ''} - ${equipo.nombre_ambiente}\n` : '') +
              (equipo.estado_fisico ? `Estado Físico: ${equipo.estado_fisico}\n` : '') +
              (equipo.fecha_adquisicion ? `Fecha de Adquisición: ${fechaAdq}\n` : '') +
              ((equipo.valor_ingreso || equipo.costo) ? `Valor de Ingreso: ${valorFormateado}\n` : '') +
              (equipo.vida_util_meses ? `Vida Útil: ${equipo.vida_util_meses} meses\n` : '') +
              (equipo.descripcion ? `\nDescripción del Equipo:\n${equipo.descripcion}\n` : '') +
              ((equipo.specs_completas || equipo.atributos) ? `\nEspecificaciones / Atributos:\n${equipo.specs_completas || equipo.atributos}\n` : '') +
              `\nDETALLE DE LA NOVEDAD\n` +
              `----------------------\n` +
              `Descripción: ${descripcion.trim()}\n` +
              `Reportado por: ${nombreReportador}\n` +
              `Fecha de registro: ${new Date().toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}\n\n` +
              `Este es un correo automático del Sistema de Gestión de Equipos SENA.\n` +
              `Puedes revisar el detalle completo en el módulo de Novedades del sistema.\n\n` +
              `Por favor, no respondas a este correo. Si necesitas más información, contacta al administrador del sistema.`

            try {
              await emailService.sendEmail(usuario.correo, subject, htmlContent, textContent)
              logger.info('Correo de novedad crítica enviado', {
                destinatario: usuario.correo,
                tipo_novedad: tipoNovedadNormalizado,
                codigo_equipo
              })
            } catch (emailErr) {
              logger.error('Error al enviar correo de novedad crítica', {
                error: emailErr.message,
                destinatario: usuario.correo,
                stack: emailErr.stack
              })
            }
          }
        }
      }
    } catch (criticalNotifyErr) {
      // No romper el flujo principal si falla el envío de correos / notificaciones críticas
      logger.error('Error al enviar notificaciones críticas de novedad', {
        error: criticalNotifyErr.message,
        stack: criticalNotifyErr.stack
      })
    }

    return res.status(201).json({ 
      ok: true, 
      id: result.insertId,
      message: 'Novedad registrada correctamente',
      equipo: {
        codigo: equipo.codigo_equipo,
        descripcion: `${equipo.tipo} ${equipo.placa || ''} ${equipo.modelo}`.trim()
      }
    })
  } catch (err) {
    logger.error('Error al crear novedad', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al registrar la novedad', details: err.message })
  }
}

/**
 * Listar novedades
 * Admin: ve todas las novedades
 * Instructor y Aprendiz: solo ven novedades de equipos asignados
 */
export async function listarNovedades(req, res) {
  try {
    const userId = req.user?.id
    const userRole = req.user?.rol

    let query = `
      SELECT 
        n.id_novedad,
        n.codigo_equipo,
        n.tipo_novedad,
        n.descripcion,
        n.fecha_novedad,
        n.estado_resolucion,
        n.fecha_resolucion,
        n.observaciones_resolucion,
        e.tipo AS equipo_tipo,
        e.placa AS equipo_placa,
        e.modelo AS equipo_modelo,
        e.consecutivo,
        e.r_centro,
        u.nombre_usuario AS reportado_por_nombre,
        r.nombre_usuario AS resuelto_por_nombre
      FROM Novedades n
      INNER JOIN Elementos e ON n.codigo_equipo = e.codigo_equipo
      INNER JOIN Usuarios u ON n.reportado_por = u.id_usuario
      LEFT JOIN Usuarios r ON n.resuelto_por = r.id_usuario
    `

    let params = []

    // Si es Instructor o Aprendiz, filtrar solo novedades de equipos asignados
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      query += `
        INNER JOIN Responsables_Equipo re 
          ON e.codigo_equipo = re.codigo_equipo
        WHERE re.id_usuario = ? AND re.estado_responsabilidad = 'Activo'
      `
      params.push(userId)
    }

    query += ` ORDER BY n.fecha_novedad DESC`

    const [rows] = await defaultDb.execute(query, params)

    return res.json(rows)
  } catch (err) {
    logger.error('Error al listar novedades', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al obtener novedades', details: err.message })
  }
}

/**
 * Obtener detalle de una novedad
 */
export async function obtenerNovedadPorId(req, res) {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const userRole = req.user?.rol

    const [[novedad]] = await defaultDb.execute(
      `SELECT 
        n.*,
        e.tipo AS equipo_tipo,
        e.placa AS equipo_placa,
        e.modelo AS equipo_modelo,
        e.consecutivo,
        e.r_centro,
        u.nombre_usuario AS reportado_por_nombre,
        r.nombre_usuario AS resuelto_por_nombre
      FROM Novedades n
      INNER JOIN Elementos e ON n.codigo_equipo = e.codigo_equipo
      INNER JOIN Usuarios u ON n.reportado_por = u.id_usuario
      LEFT JOIN Usuarios r ON n.resuelto_por = r.id_usuario
      WHERE n.id_novedad = ?`,
      [id]
    )

    if (!novedad) {
      return res.status(404).json({ error: 'Novedad no encontrada' })
    }

    // Si es Instructor o Aprendiz, validar que el equipo le esté asignado
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      const [[asignacion]] = await defaultDb.execute(
        `SELECT id_responsable FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
        [novedad.codigo_equipo, userId]
      )

      if (!asignacion) {
        return res.status(403).json({ error: 'No tienes permiso para ver esta novedad' })
      }
    }

    return res.json(novedad)
  } catch (err) {
    logger.error('Error al obtener novedad', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al obtener detalle de la novedad', details: err.message })
  }
}

/**
 * Actualizar estado de una novedad
 * Admin e Instructor: pueden actualizar cualquier novedad
 * Aprendiz: solo puede actualizar novedades de equipos asignados
 */
export async function actualizarEstadoNovedad(req, res) {
  try {
    const { id } = req.params
    const { estado_resolucion, observaciones_resolucion } = req.body
    const userId = req.user?.id
    const userRole = req.user?.rol

    if (!estado_resolucion) {
      return res.status(400).json({ error: 'El estado de resolución es obligatorio' })
    }

    const estadosValidos = ['Pendiente', 'En Proceso', 'Resuelto', 'No Resuelto']
    if (!estadosValidos.includes(estado_resolucion)) {
      return res.status(400).json({ error: 'Estado de resolución inválido' })
    }

    // Solo Administrador puede actualizar el estado de las novedades
    if (userRole !== 'Administrador') {
      return res.status(403).json({ 
        error: 'Solo el Administrador puede actualizar el estado de las novedades' 
      })
    }

    // Obtener la novedad
    const [[novedad]] = await defaultDb.execute(
      'SELECT codigo_equipo, estado_resolucion FROM Novedades WHERE id_novedad = ?',
      [id]
    )

    if (!novedad) {
      return res.status(404).json({ error: 'Novedad no encontrada' })
    }

    // Actualizar el estado
    const fechaResolucion = (estado_resolucion === 'Resuelto' || estado_resolucion === 'No Resuelto') 
      ? new Date() 
      : null
    const resueltoPor = (estado_resolucion === 'Resuelto' || estado_resolucion === 'No Resuelto') 
      ? userId 
      : null

    await defaultDb.execute(
      `UPDATE Novedades 
       SET estado_resolucion = ?, 
           fecha_resolucion = ?, 
           resuelto_por = ?, 
           observaciones_resolucion = ?
       WHERE id_novedad = ?`,
      [estado_resolucion, fechaResolucion, resueltoPor, observaciones_resolucion || null, id]
    )

    return res.json({ 
      message: 'Estado de novedad actualizado correctamente',
      estado_resolucion,
      fecha_resolucion: fechaResolucion
    })
  } catch (err) {
    logger.error('Error al actualizar estado de novedad', { error: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Error al actualizar el estado de la novedad', details: err.message })
  }
}

