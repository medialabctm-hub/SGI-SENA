import defaultDb from '../config/dbconfig.js'
import { createForUsers, createForRole } from '../services/notificationService.js'
import { logger } from '../utils/logger.js'
import { obtenerEquipoPorCodigo, obtenerUsuarioActivo } from '../utils/sqlQueries.js'
import emailService from '../services/emailService.js'
import { config } from '../config/config.js'

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
        // Actualizar estado del equipo según el tipo de novedad crítica
        try {
          let nuevoEstadoOperativo = null
          let nuevoEstadoFisico = null

          if (tipoLower.includes('daño') || tipoLower.includes('dano')) {
            nuevoEstadoOperativo = 'Dañado'
            nuevoEstadoFisico = 'Dañado'
          } else if (tipoLower.includes('pérdida') || tipoLower.includes('perdida') || tipoLower.includes('robo')) {
            nuevoEstadoOperativo = 'Dado de Baja'
            // Para pérdida/robo no cambiamos estado_fisico, solo estado_operativo
          }

          if (nuevoEstadoOperativo) {
            // Actualizar o insertar en Estado_Equipo
            await defaultDb.execute(
              `INSERT INTO Estado_Equipo (codigo_equipo, estado_operativo, fecha_actualizacion, actualizado_por, detalles)
               VALUES (?, ?, NOW(), ?, ?)
               ON DUPLICATE KEY UPDATE
                 estado_operativo = VALUES(estado_operativo),
                 fecha_actualizacion = NOW(),
                 actualizado_por = VALUES(actualizado_por),
                 detalles = VALUES(detalles)`,
              [
                codigo_equipo,
                nuevoEstadoOperativo,
                userId,
                `Equipo deshabilitado por novedad: ${tipoNovedadNormalizado}. ${descripcion.trim().substring(0, 200)}`
              ]
            )

            // Actualizar estado_fisico en Elementos si es daño
            if (nuevoEstadoFisico) {
              await defaultDb.execute(
                `UPDATE Elementos 
                 SET estado_fisico = ?
                 WHERE codigo_equipo = ?`,
                [nuevoEstadoFisico, codigo_equipo]
              )
            }

            logger.info('Estado del equipo actualizado por novedad crítica', {
              codigo_equipo,
              tipo_novedad: tipoNovedadNormalizado,
              nuevo_estado_operativo: nuevoEstadoOperativo,
              nuevo_estado_fisico: nuevoEstadoFisico || 'sin cambio'
            })
          }
        } catch (estadoErr) {
          // No fallar el registro de la novedad si falla la actualización de estado
          logger.error('Error al actualizar estado del equipo por novedad crítica', {
            error: estadoErr.message,
            stack: estadoErr.stack,
            codigo_equipo
          })
        }

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

          // Formatear fecha de adquisición (formato corto en español)
          const fechaAdq = equipo.fecha_adquisicion
            ? new Date(equipo.fecha_adquisicion).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })
            : 'No registrada'

          // Formatear valor con resalte
          const valorFormateado = equipo.valor_ingreso || equipo.costo
            ? new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP'
              }).format(equipo.valor_ingreso || equipo.costo)
            : 'No registrado'

          // Resumen inmediato para el header
          const resumenInmediato = equipo.modelo && equipo.placa
            ? `Se ha reportado ${tipoNovedadNormalizado.toLowerCase()} de un equipo ${equipo.modelo} (Placa: ${equipo.placa.substring(0, 8)}...)`
            : `Se ha reportado ${tipoNovedadNormalizado.toLowerCase()} del equipo ${equipoDesc}`

          // Formatear fecha de registro
          const fechaRegistro = new Date().toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })

          // Parsear especificaciones si existen
          const specsArray = []
          if (equipo.specs_completas) {
            specsArray.push(...equipo.specs_completas.split(/[,\n]/).map(s => s.trim()).filter(Boolean))
          }
          if (equipo.atributos && !equipo.specs_completas) {
            specsArray.push(...equipo.atributos.split(/[,\n]/).map(s => s.trim()).filter(Boolean))
          }

          for (const usuario of usuariosDestino) {
            const subject = `⚠️ Novedad crítica: ${tipoNovedadNormalizado} - ${equipoDesc}`

            const htmlContent = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  * { box-sizing: border-box; }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                    line-height: 1.6;
                    color: #1a2a3a;
                    max-width: 720px;
                    margin: 0 auto;
                    padding: 20px;
                    background: #f5f5f5;
                  }
                  .container {
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                  }
                  .header {
                    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                    color: white;
                    padding: 32px 28px;
                    text-align: center;
                    position: relative;
                  }
                  .header-icon {
                    font-size: 48px;
                    margin-bottom: 12px;
                    display: block;
                  }
                  .header h1 {
                    margin: 0 0 8px 0;
                    font-size: 28px;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                  }
                  .header-subtitle {
                    margin: 0;
                    font-size: 15px;
                    opacity: 0.95;
                    font-weight: 400;
                  }
                  .header-id {
                    position: absolute;
                    top: 16px;
                    right: 20px;
                    background: rgba(255,255,255,0.2);
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 600;
                  }
                  .alert-badge {
                    background: #fee2e2;
                    border: 2px solid #dc2626;
                    padding: 16px 20px;
                    margin: 24px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 12px;
                  }
                  .badge-label {
                    font-weight: 600;
                    color: #6b7280;
                    font-size: 0.9rem;
                  }
                  .badge-critical {
                    background: #dc2626;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 0.95rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                  }
                  .card {
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    padding: 24px;
                    margin: 0 24px 24px 24px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                  }
                  .card-title {
                    margin: 0 0 20px 0;
                    color: #1a2a3a;
                    font-size: 18px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding-bottom: 12px;
                    border-bottom: 2px solid #e5e7eb;
                  }
                  .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px 24px;
                    margin-top: 8px;
                  }
                  .info-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                  }
                  .info-group-full {
                    grid-column: 1 / -1;
                  }
                  .info-label {
                    font-weight: 600;
                    color: #6b7280;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                  }
                  .info-value {
                    color: #1a2a3a;
                    font-size: 1rem;
                    font-weight: 500;
                  }
                  .info-value-highlight {
                    color: #dc2626;
                    font-size: 1.15rem;
                    font-weight: 700;
                  }
                  .info-value-large {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #1a2a3a;
                  }
                  .specs-box {
                    background: #f8f9fa;
                    border-left: 3px solid #6b7280;
                    padding: 14px 16px;
                    border-radius: 6px;
                    margin-top: 12px;
                  }
                  .specs-list {
                    margin: 8px 0 0 0;
                    padding-left: 20px;
                    color: #4b5563;
                    font-size: 0.95rem;
                  }
                  .specs-list li {
                    margin-bottom: 6px;
                  }
                  .description-box {
                    background: #f8f9fa;
                    border: 1px solid #e5e7eb;
                    padding: 16px;
                    border-radius: 8px;
                    margin-top: 12px;
                    white-space: pre-wrap;
                    color: #374151;
                    line-height: 1.7;
                    font-size: 0.95rem;
                  }
                  .cta-button {
                    display: inline-block;
                    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                    color: white;
                    padding: 14px 28px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 1rem;
                    margin: 24px 0;
                    text-align: center;
                    box-shadow: 0 2px 4px rgba(220,38,38,0.3);
                    transition: transform 0.2s;
                  }
                  .cta-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px rgba(220,38,38,0.4);
                  }
                  .footer {
                    background: #f8f9fa;
                    padding: 24px;
                    text-align: center;
                    border-top: 1px solid #e5e7eb;
                    color: #6b7280;
                    font-size: 0.875rem;
                    line-height: 1.6;
                  }
                  .footer-contact {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid #e5e7eb;
                    color: #9ca3af;
                    font-size: 0.8rem;
                  }
                  @media (max-width: 600px) {
                    .info-grid {
                      grid-template-columns: 1fr;
                    }
                    .header {
                      padding: 24px 20px;
                    }
                    .card {
                      margin: 0 16px 16px 16px;
                      padding: 20px;
                    }
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <span class="header-id">ID: ${result.insertId}</span>
                    <span class="header-icon">⚠️</span>
                    <h1>Novedad Crítica Registrada</h1>
                    <p class="header-subtitle">${resumenInmediato}</p>
                  </div>

                  <div class="alert-badge">
                    <span class="badge-label">Tipo de Novedad:</span>
                    <span class="badge-critical">${tipoNovedadNormalizado}</span>
                  </div>

                  <div class="card">
                    <h2 class="card-title">📋 Información del Equipo</h2>
                    <div class="info-grid">
                      <div class="info-group">
                        <span class="info-label">Identificación del Activo</span>
                        <div style="margin-top: 4px;">
                          ${equipo.placa ? `<div class="info-value-large">Placa: ${equipo.placa}</div>` : ''}
                          ${equipo.codigo_equipo ? `<div class="info-value" style="margin-top: 4px;">Código: ${equipo.codigo_equipo}</div>` : ''}
                        </div>
                      </div>
                      <div class="info-group">
                        <span class="info-label">Modelo y Tipo</span>
                        <div style="margin-top: 4px;">
                          ${equipo.modelo ? `<div class="info-value-large">${equipo.modelo}</div>` : ''}
                          ${equipo.tipo ? `<div class="info-value" style="margin-top: 4px;">${equipo.tipo}</div>` : ''}
                        </div>
                      </div>
                      ${equipo.consecutivo ? `
                      <div class="info-group">
                        <span class="info-label">Consecutivo</span>
                        <span class="info-value">${equipo.consecutivo}</span>
                      </div>
                      ` : ''}
                      ${equipo.nombre_ambiente ? `
                      <div class="info-group">
                        <span class="info-label">Ambiente</span>
                        <span class="info-value">${equipo.codigo_ambiente || ''} - ${equipo.nombre_ambiente}</span>
                      </div>
                      ` : ''}
                      ${equipo.estado_fisico ? `
                      <div class="info-group">
                        <span class="info-label">Estado Físico</span>
                        <span class="info-value">${equipo.estado_fisico}</span>
                      </div>
                      ` : ''}
                      ${equipo.r_centro ? `
                      <div class="info-group">
                        <span class="info-label">Centro</span>
                        <span class="info-value">${equipo.r_centro}</span>
                      </div>
                      ` : ''}
                      ${equipo.fecha_adquisicion ? `
                      <div class="info-group">
                        <span class="info-label">Adquisición</span>
                        <span class="info-value">${fechaAdq}</span>
                      </div>
                      ` : ''}
                      ${(equipo.valor_ingreso || equipo.costo) ? `
                      <div class="info-group">
                        <span class="info-label">Valor de Ingreso</span>
                        <span class="info-value-highlight">${valorFormateado}</span>
                      </div>
                      ` : ''}
                      ${equipo.vida_util_meses ? `
                      <div class="info-group">
                        <span class="info-label">Vida Útil</span>
                        <span class="info-value">${equipo.vida_util_meses} meses</span>
                      </div>
                      ` : ''}
                    </div>
                    ${equipo.descripcion ? `
                    <div style="margin-top: 20px;">
                      <span class="info-label">Descripción del Equipo</span>
                      <div class="description-box">${equipo.descripcion}</div>
                    </div>
                    ` : ''}
                    ${specsArray.length > 0 ? `
                    <div class="specs-box">
                      <span class="info-label">Especificaciones Rápidas</span>
                      <ul class="specs-list">
                        ${specsArray.map(spec => `<li>${spec}</li>`).join('')}
                      </ul>
                    </div>
                    ` : ''}
                  </div>

                  <div class="card">
                    <h2 class="card-title">📝 Detalle de la Novedad</h2>
                    <div class="info-grid">
                      <div class="info-group-full">
                        <span class="info-label">Descripción</span>
                        <div class="description-box">${descripcion.trim().replace(/\n/g, '<br>')}</div>
                      </div>
                      <div class="info-group">
                        <span class="info-label">Reportado por</span>
                        <span class="info-value">${nombreReportador}</span>
                      </div>
                      <div class="info-group">
                        <span class="info-label">Fecha de registro</span>
                        <span class="info-value">${fechaRegistro}</span>
                      </div>
                    </div>
                  </div>

                  <div style="text-align: center; padding: 0 24px 24px 24px;">
                    <a href="${config.frontendUrl || 'https://sgi-sena.up.railway.app'}/novedades" class="cta-button" style="display: inline-block;">Ver Reporte Completo en el Sistema</a>
                  </div>

                  <div class="footer">
                    <p><strong>Sistema de Gestión de Inventarios SENA</strong></p>
                    <p>Este correo fue enviado automáticamente a los responsables del equipo afectado.</p>
                    <p style="margin-top: 12px;">Puedes revisar el detalle completo y gestionar esta incidencia en el módulo de Novedades del sistema.</p>
                    <div class="footer-contact">
                      <p style="margin: 0;">Este correo es de solo lectura. No respondas a este mensaje.</p>
                      <p style="margin: 8px 0 0 0;">Para más información, contacta al administrador o al área de soporte técnico.</p>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `

            const textContent =
              `⚠️ NOVEDAD CRÍTICA REGISTRADA - ID: ${result.insertId}\n` +
              `${'='.repeat(50)}\n\n` +
              `${resumenInmediato}\n\n` +
              `TIPO DE NOVEDAD: ${tipoNovedadNormalizado.toUpperCase()}\n\n` +
              `INFORMACIÓN DEL EQUIPO\n` +
              `${'-'.repeat(50)}\n` +
              `IDENTIFICACIÓN DEL ACTIVO:\n` +
              (equipo.placa ? `  Placa: ${equipo.placa}\n` : '') +
              (equipo.codigo_equipo ? `  Código: ${equipo.codigo_equipo}\n` : '') +
              (equipo.consecutivo ? `  Consecutivo: ${equipo.consecutivo}\n` : '') +
              `\nMODELO Y TIPO:\n` +
              (equipo.modelo ? `  Modelo: ${equipo.modelo}\n` : '') +
              (equipo.tipo ? `  Tipo: ${equipo.tipo}\n` : '') +
              `\nDATOS FINANCIEROS:\n` +
              ((equipo.valor_ingreso || equipo.costo) ? `  Valor de Ingreso: ${valorFormateado}\n` : '') +
              (equipo.fecha_adquisicion ? `  Adquisición: ${fechaAdq}\n` : '') +
              (equipo.vida_util_meses ? `  Vida Útil: ${equipo.vida_util_meses} meses\n` : '') +
              `\nUBICACIÓN Y ESTADO:\n` +
              (equipo.nombre_ambiente ? `  Ambiente: ${equipo.codigo_ambiente || ''} - ${equipo.nombre_ambiente}\n` : '') +
              (equipo.r_centro ? `  Centro: ${equipo.r_centro}\n` : '') +
              (equipo.estado_fisico ? `  Estado Físico: ${equipo.estado_fisico}\n` : '') +
              (equipo.descripcion ? `\nDescripción del Equipo:\n${equipo.descripcion}\n` : '') +
              (specsArray.length > 0 ? `\nEspecificaciones Rápidas:\n${specsArray.map(spec => `  • ${spec}`).join('\n')}\n` : '') +
              `\nDETALLE DE LA NOVEDAD\n` +
              `${'-'.repeat(50)}\n` +
              `Descripción:\n${descripcion.trim()}\n\n` +
              `Reportado por: ${nombreReportador}\n` +
              `Fecha de registro: ${fechaRegistro}\n\n` +
              `${'='.repeat(50)}\n` +
              `Sistema de Gestión de Inventarios SENA\n\n` +
              `Este correo fue enviado automáticamente a los responsables del equipo afectado.\n` +
              `Puedes revisar el detalle completo y gestionar esta incidencia en el módulo de Novedades del sistema.\n\n` +
              `Este correo es de solo lectura. No respondas a este mensaje.\n` +
              `Para más información, contacta al administrador del sistema o al área de soporte técnico.`

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

