import defaultDb from '../config/dbconfig.js'
import { createForUsers, createForRole } from '../services/notificationService.js'
import { logger } from '../utils/logger.js'
import { 
  obtenerEquipoPorCodigo, 
  obtenerUsuarioActivo,
  deshabilitarAsignacionesActivas
} from '../utils/sqlQueries.js'
import emailService from '../services/emailService.js'
import { config } from '../config/config.js'
import PDFDocument from 'pdfkit'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

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

            // Deshabilitar asignaciones activas solo para Daño (no para Pérdida/Robo: se conserva el registro de uso)
            const esPerdidaORobo = tipoLower.includes('pérdida') || tipoLower.includes('perdida') || tipoLower.includes('robo')
            if (!esPerdidaORobo) {
              try {
                const razonDeshabilitacion = `Equipo deshabilitado automáticamente por novedad: ${tipoNovedadNormalizado}`
                const resultadoDeshabilitacion = await deshabilitarAsignacionesActivas(
                  defaultDb,
                  codigo_equipo,
                  userId,
                  razonDeshabilitacion
                )

                if (resultadoDeshabilitacion.deshabilitadas > 0) {
                  logger.info('Asignaciones deshabilitadas automáticamente por cambio de estado crítico', {
                    codigo_equipo,
                    asignaciones_deshabilitadas: resultadoDeshabilitacion.deshabilitadas,
                    usuarios_afectados: resultadoDeshabilitacion.usuarios_afectados,
                    nuevo_estado: nuevoEstadoOperativo
                  })

                  resultadoDeshabilitacion.usuarios_afectados.forEach(userIdAfectado => {
                    destinatariosIds.add(userIdAfectado)
                  })
                }
              } catch (deshabErr) {
                logger.error('Error al deshabilitar asignaciones activas por cambio de estado', {
                  error: deshabErr.message,
                  stack: deshabErr.stack,
                  codigo_equipo
                })
              }
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
               -- SISTEMA 100% MANUAL: Eliminadas comparaciones con NOW()
               -- El estado_responsabilidad = 'Activa' es suficiente
               -- AND ra.fecha_inicio <= NOW()
               -- AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())
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
                    background: #dc2626;
                    color: white;
                    padding: 28px 24px 32px;
                    text-align: center;
                    position: relative;
                  }
                  .header::after {
                    content: "";
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 6px;
                    width: 100%;
                    background: #dc2626;
                  }
                  .header-icon {
                    font-size: 42px;
                    margin-bottom: 10px;
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
                    margin: 20px 24px;
                    padding: 14px 18px;
                    border-radius: 10px;
                    background: #fff5f5;

                    display: flex;
                    justify-content: space-between;
                    align-items: center;
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
                    padding: 8px 0;
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
                  .info-value-large {
                    font-size: 1.4rem;
                    font-weight: 800;
                    letter-spacing: 0.3px;
                  }

                  .info-value-highlight {
                    color: #b91c1c;
                    font-size: 1.3rem;
                    font-weight: 800;
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
                    background: #f9fafb;
                    border-left: 4px solid #dc2626;
                    padding: 16px 18px;
                    border-radius: 8px;
                    font-size: 0.95rem;
                  }
                  .cta-button {
                    background: #dc2626;
                    padding: 16px 36px;
                    border-radius: 10px;
                    font-size: 1.05rem;
                    letter-spacing: 0.4px;
                    text-decoration: none;
                    color: white;
                  }
                  .cta-button:hover {
                    transform: translateY(2px);
                    box-shadow: 0 4px 6px rgba(220,38,38,0.4);
                  }
                  .footer {
                    background: #f8f9fa;
                    padding: 24px;
                    text-align: center;
                    border-top: 1px solid #e5e7eb;
                    color: #9ca3af;
                    font-size: 0.8rem;
                    line-height: 1.6;
                  }
                  .section-divider {
                    height: 1px;
                    background: linear-gradient(to right, transparent, #e5e7eb, transparent);
                    margin: 28px 0;
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
                    <span class="header-icon">⚠️</span>
                    <h1>Novedad Crítica Registrada</h1>
                    <p class="header-subtitle">${resumenInmediato}</p>
                  </div>

                  <div class="alert-badge">
                    <span class="badge-label">Tipo de Novedad:</span>
                    <span class="badge-critical">${tipoNovedadNormalizado}</span>
                  </div>

                  <div class="section-divider"></div>

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

                    <p style="font-size:0.8rem;color:#6b7280;margin-top:8px;text-align:center;">
                      Accede al sistema para gestionar esta incidencia
                    </p>

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
        e.modelo AS equipo_modelo,
        e.placa AS equipo_placa,
        e.placa AS codigo_inventario,
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
        e.modelo AS equipo_modelo,
        e.placa AS equipo_placa,
        e.placa AS codigo_inventario,
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
 * Generar PDF de acta de novedad por robo o pérdida.
 * Incluye: datos técnicos del elemento, ambiente, responsables de uso,
 * último instructor en el ambiente, cuentadante principal, instructor que reportó.
 * Solo aplica a novedades de tipo Pérdida o Robo.
 */
export async function generarPDFNovedadRoboPerdida(req, res) {
  try {
    const { id } = req.params
    const userId = req.user?.id
    const userRole = req.user?.rol

    const [[novedad]] = await defaultDb.execute(
      `SELECT n.id_novedad, n.codigo_equipo, n.tipo_novedad, n.descripcion, n.fecha_novedad, n.reportado_por
       FROM Novedades n
       INNER JOIN Elementos e ON n.codigo_equipo = e.codigo_equipo
       WHERE n.id_novedad = ?`,
      [id]
    )

    if (!novedad) {
      return res.status(404).json({ error: 'Novedad no encontrada' })
    }

    const tipoLower = (novedad.tipo_novedad || '').toLowerCase()
    const esRoboOPerdida = tipoLower.includes('robo') || tipoLower.includes('pérdida') || tipoLower.includes('perdida')
    if (!esRoboOPerdida) {
      return res.status(400).json({
        error: 'El PDF de acta solo está disponible para novedades de tipo Pérdida o Robo'
      })
    }

    // Mismo criterio de permiso que ver detalle: Instructor/Aprendiz solo si tienen asignación del equipo
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      const [[asignacion]] = await defaultDb.execute(
        `SELECT id_responsable FROM Responsables_Equipo 
         WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
        [novedad.codigo_equipo, userId]
      )
      if (!asignacion) {
        return res.status(403).json({ error: 'No tienes permiso para descargar este documento' })
      }
    }

    // Equipo completo con ambiente, categoría y cuentadante
    const [[equipo]] = await defaultDb.execute(
      `SELECT e.codigo_equipo, e.tipo, e.modelo, e.placa, e.consecutivo, e.r_centro, e.descripcion,
              e.specs_completas, e.atributos, e.estado_fisico, e.fecha_adquisicion, e.costo, e.valor_ingreso,
              e.id_cuentadante, e.cuentadante_principal AS cuentadante_principal_text,
              a.id_ambiente, a.nombre_ambiente, a.codigo_ambiente, a.tipo_ambiente,
              c.nombre_categoria,
              u_cuent.nombre_usuario AS cuentadante_nombre, u_cuent.cedula AS cuentadante_cedula, u_cuent.correo AS cuentadante_correo
       FROM Elementos e
       LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
       LEFT JOIN Categorias_Equipo c ON e.id_categoria = c.id_categoria
       LEFT JOIN Usuarios u_cuent ON e.id_cuentadante = u_cuent.id_usuario
       WHERE e.codigo_equipo = ?`,
      [novedad.codigo_equipo]
    )

    if (!equipo) {
      return res.status(404).json({ error: 'Equipo no encontrado' })
    }

    // Solo responsables activos del equipo (registro de uso se conserva al reportar robo/pérdida)
    const [responsablesRaw] = await defaultDb.execute(
      `SELECT re.tipo_responsabilidad,
              re.ficha,
              re.nombre_externo,
              re.documento_externo,
              COALESCE(u.nombre_usuario, re.nombre_externo) AS nombre,
              COALESCE(u.cedula, re.documento_externo) AS documento,
              r.nombre_rol
       FROM Responsables_Equipo re
       LEFT JOIN Usuarios u ON re.id_usuario = u.id_usuario
       LEFT JOIN Roles r ON u.id_rol = r.id_rol
       WHERE re.codigo_equipo = ? AND re.estado_responsabilidad = 'Activo'
       ORDER BY re.tipo_responsabilidad = 'Principal' DESC, re.fecha_asignacion`,
      [novedad.codigo_equipo]
    )
    // Una línea por persona (evitar duplicados por mismo documento)
    const vistosDoc = new Set()
    const responsables = (responsablesRaw || []).filter((r) => {
      const doc = (r.documento || r.documento_externo || '').toString().trim() || `id-${r.nombre}-${r.ficha}`
      if (vistosDoc.has(doc)) return false
      vistosDoc.add(doc)
      return true
    })

    // Último instructor en el ambiente: última clase en ese ambiente, o última responsabilidad activa
    let ultimoInstructor = null
    const idAmbiente = equipo.id_ambiente
    if (idAmbiente) {
      const [clase] = await defaultDb.execute(
        `SELECT c.id_instructor, u.nombre_usuario, u.cedula, u.correo
         FROM Clases c
         INNER JOIN Usuarios u ON c.id_instructor = u.id_usuario
         WHERE c.id_ambiente = ?
         ORDER BY c.fecha_clase DESC, c.hora_fin DESC
         LIMIT 1`,
        [idAmbiente]
      )
      if (clase && clase.length > 0) {
        ultimoInstructor = clase[0]
      }
      if (!ultimoInstructor) {
        const [ra] = await defaultDb.execute(
          `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.correo
           FROM Responsabilidades_Ambiente ra
           INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
           INNER JOIN Roles r ON u.id_rol = r.id_rol
           WHERE ra.id_ambiente = ? AND ra.estado_responsabilidad = 'Activa' AND r.nombre_rol = 'Instructor'
           ORDER BY ra.fecha_inicio DESC
           LIMIT 1`,
          [idAmbiente]
        )
        if (ra && ra.length > 0) ultimoInstructor = ra[0]
      }
    }

    // Usuario que reportó la novedad
    const [[reportador]] = await defaultDb.execute(
      `SELECT u.nombre_usuario, u.cedula, u.correo, r.nombre_rol
       FROM Usuarios u
       LEFT JOIN Roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ?`,
      [novedad.reportado_por]
    )

    const fechaReporte = novedad.fecha_novedad
      ? new Date(novedad.fecha_novedad).toLocaleString('es-ES', {
          dateStyle: 'long',
          timeStyle: 'short'
        })
      : 'No registrada'

    // Generar PDF. Margen inferior grande en la primera página para reservar espacio del pie y que no pase a otra hoja.
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 40, bottom: 72, left: 50, right: 50 }
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Acta_Novedad_${novedad.tipo_novedad}_${novedad.codigo_equipo}_${id}.pdf"`
    )
    doc.pipe(res)

    const grisTexto = '#444444'
    const grisClaro = '#888888'
    const grisLinea = '#cccccc'
    const verdeIcono = '#00a650'
    const margen = 50
    const anchoPagina = 612
    const altoPagina = 792
    const topInicio = 28
    const pieY = altoPagina - 38

    // Fondo blanco del acta
    doc.fillColor('#ffffff').rect(0, 0, anchoPagina, altoPagina).fill()
    doc.fillColor(grisTexto)

    const sep = (opciones = {}) => {
      const { omitirLinea = false } = opciones
      if (!omitirLinea) {
        doc.strokeColor(grisLinea).lineWidth(0.4)
        doc.moveTo(margen, doc.y).lineTo(anchoPagina - margen, doc.y).stroke()
        doc.strokeColor('black')
      }
      doc.moveDown(0.85)
    }

    const seccionTitulo = (num, titulo) => {
      doc.moveDown(0.25)
      doc.fillColor(verdeIcono)
      doc.circle(margen + 6, doc.y + 7, 5).fill()
      doc.fontSize(12).font('Helvetica-Bold').fillColor(grisTexto)
      doc.text(`${num}. ${titulo}`, margen + 18, doc.y, { continued: false })
      doc.moveDown(0.4)
      doc.fontSize(10).font('Helvetica').fillColor(grisTexto)
    }

    doc.y = topInicio
    doc.fillColor(grisTexto)

    doc.moveDown(0.35)

    doc.fontSize(18).font('Helvetica-Bold').fillColor(grisTexto)
    doc.text('ACTA DE NOVEDAD POR ROBO O PÉRDIDA', { align: 'center' })
    doc.moveDown(0.3)
    doc.fontSize(11).font('Helvetica').fillColor(grisTexto).text('Sistema de Gestión de Inventarios SENA', { align: 'center' })
    doc.moveDown(0.25)
    doc.fontSize(10).fillColor(grisClaro).text(`Fecha y hora del reporte: ${fechaReporte}`, { align: 'center' })
    doc.moveDown(1)
    sep()

    // 1. Información técnica del elemento (dos columnas)
    seccionTitulo('1', 'Información técnica del elemento')
    const filasIzq = []
    const filasDer = []
    const add = (eti, val) => {
      if (val == null || val === '') return
      const texto = `${eti}: ${String(val).trim()}`
      if (filasIzq.length <= filasDer.length) filasIzq.push(texto)
      else filasDer.push(texto)
    }
    add('Código', equipo.codigo_equipo)
    add('Tipo', equipo.tipo)
    add('Modelo', equipo.modelo)
    add('Placa', equipo.placa)
    add('Consecutivo', equipo.consecutivo)
    add('R. Centro', equipo.r_centro)
    add('Categoría', equipo.nombre_categoria)
    add('Estado físico', equipo.estado_fisico)
    add('Descripción', equipo.descripcion)
    add('Fecha adquisición', equipo.fecha_adquisicion ? new Date(equipo.fecha_adquisicion).toLocaleDateString('es-ES') : null)
    const valorEq = equipo.valor_ingreso ?? equipo.costo
    if (valorEq != null) {
      const v = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(valorEq))
      if (filasIzq.length <= filasDer.length) filasIzq.push(`Valor: ${v}`)
      else filasDer.push(`Valor: ${v}`)
    }
    if (equipo.specs_completas) {
      const t = String(equipo.specs_completas).trim().substring(0, 120)
      if (filasDer.length <= filasIzq.length) filasDer.push(`Especificaciones: ${t}`)
      else filasIzq.push(`Especificaciones: ${t}`)
    } else if (equipo.atributos) {
      const t = String(equipo.atributos).trim().substring(0, 120)
      if (filasDer.length <= filasIzq.length) filasDer.push(`Atributos: ${t}`)
      else filasIzq.push(`Atributos: ${t}`)
    }

    const colWidth = (anchoPagina - 2 * margen - 20) / 2
    const startY = doc.y
    doc.text(filasIzq.join('\n'), margen, startY, { width: colWidth, lineGap: 2 })
    const yDespuesIzq = doc.y
    doc.y = startY
    doc.text(filasDer.join('\n'), margen + colWidth + 20, startY, { width: colWidth, lineGap: 2 })
    doc.y = Math.max(yDespuesIzq, doc.y) + 10
    doc.moveDown(0.6)
    sep()

    // 2. Ambiente donde estaba el elemento
    seccionTitulo('2', 'Ambiente donde estaba el elemento por última vez')
    doc.text(equipo.nombre_ambiente || 'Sin asignar', { continued: false })
    doc.text(`Código: ${equipo.codigo_ambiente || 'N/A'} | Tipo: ${equipo.tipo_ambiente || 'N/A'}`, { continued: false })
    doc.moveDown(0.55)
    sep()

    // 3. Responsables de uso del elemento
    seccionTitulo('3', 'Responsables de uso del elemento')
    if (responsables.length === 0) {
      doc.text('No hay responsables activos registrados para este equipo.', { continued: false })
    } else {
      responsables.forEach((r, i) => {
        const nombre = (r.nombre || r.nombre_externo || 'N/A').trim()
        const docum = (r.documento || r.documento_externo || 'N/A').trim()
        const ficha = (r.ficha || '').trim()
        const rol = (r.nombre_rol || (r.documento_externo || r.nombre_externo ? 'Externo/Aprendiz' : '')).trim()
        const tipo = (r.tipo_responsabilidad || 'Principal').trim()
        let linea = `${i + 1}. ${nombre} | Doc: ${docum}`
        if (ficha) linea += ` | Ficha: ${ficha}`
        if (rol) linea += ` | Rol: ${rol}`
        linea += ` | ${tipo}`
        doc.text(linea, { continued: false })
      })
    }
    doc.moveDown(0.55)
    sep()

    // 4. Último instructor presente en el ambiente
    seccionTitulo('4', 'Último instructor presente en el ambiente')
    if (!ultimoInstructor) {
      doc.text('No hay registro de instructor asignado a este ambiente.', { continued: false })
    } else {
      doc.text(`Nombre: ${ultimoInstructor.nombre_usuario || 'N/A'}`, { continued: false })
      doc.text(`Cédula: ${ultimoInstructor.cedula || 'N/A'}`, { continued: false })
      if (ultimoInstructor.correo) doc.text(`Correo: ${ultimoInstructor.correo}`, { continued: false })
    }
    doc.moveDown(0.55)
    sep()

    // 5. Cuentadante principal del elemento
    seccionTitulo('5', 'Cuentadante principal del elemento')
    const nombreCuent = equipo.cuentadante_nombre || equipo.cuentadante_principal_text
    if (!nombreCuent) {
      doc.text('No asignado.', { continued: false })
    } else {
      doc.text(`Nombre: ${nombreCuent}`, { continued: false })
      if (equipo.cuentadante_cedula) doc.text(`Cédula: ${equipo.cuentadante_cedula}`, { continued: false })
      if (equipo.cuentadante_correo) doc.text(`Correo: ${equipo.cuentadante_correo}`, { continued: false })
    }
    doc.moveDown(0.55)
    sep()

    // 6. Quien reportó la novedad
    seccionTitulo('6', 'Quien reportó la novedad')
    if (reportador) {
      doc.text(`Nombre: ${reportador.nombre_usuario || 'N/A'}`, { continued: false })
      doc.text(`Cédula: ${reportador.cedula || 'N/A'}`, { continued: false })
      doc.text(`Rol: ${reportador.nombre_rol || 'N/A'}`, { continued: false })
      if (reportador.correo) doc.text(`Correo: ${reportador.correo}`, { continued: false })
    } else {
      doc.text('No disponible.', { continued: false })
    }
    doc.moveDown(0.55)
    sep({ omitirLinea: true })

    doc.moveDown(0.35)
    doc.fontSize(10).font('Helvetica').fillColor(grisTexto)
    doc.text(`Descripción de la novedad: ${novedad.descripcion || 'Sin descripción.'}`, { continued: false })

    // Pie de página fijo en la primera hoja: volver a página 0 y dibujar en la zona del margen inferior
    try {
      doc.switchToPage(0)
    } catch (_) {}
    doc.y = pieY
    doc.fontSize(9).font('Helvetica').fillColor(grisClaro).text(`Novedad #${id} | Equipo ${equipo.placa || novedad.codigo_equipo} | SGI SENA`, { align: 'center' })
    doc.end()
  } catch (err) {
    logger.error('Error al generar PDF novedad robo/pérdida', { error: err.message, stack: err.stack })
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error al generar el PDF', details: err.message })
    }
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

    // Emitir evento WebSocket para actualización en tiempo real
    try {
      const socketService = (await import('../services/socketService.js')).default;
      const eventType = estado_resolucion === 'Resuelto' || estado_resolucion === 'No Resuelto' 
        ? 'novedad:resolved' 
        : 'novedad:updated';
      socketService.emitToAll(eventType, {
        id_novedad: id,
        codigo_equipo: novedad.codigo_equipo,
        estado_resolucion,
        timestamp: new Date().toISOString(),
      });
    } catch (socketErr) {
      logger.warn('Error al emitir evento Socket.io', { error: socketErr.message });
    }

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

/**
 * Obtener tipos de novedad disponibles desde la base de datos
 * Consulta los valores ENUM de la columna tipo_novedad
 */
export async function obtenerTiposNovedad(req, res) {
  try {
    const [rows] = await defaultDb.execute(
      `SELECT COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Novedades' 
       AND COLUMN_NAME = 'tipo_novedad'`
    )

    if (!rows || rows.length === 0) {
      logger.warn('No se encontró información del ENUM tipo_novedad en INFORMATION_SCHEMA')
      return res.json(['Daño', 'Pérdida', 'Robo', 'Mal Funcionamiento', 'Daño Físico', 'Falta de Componente', 'Otro'])
    }

    const enumString = rows[0].COLUMN_TYPE
    if (!enumString || !enumString.toLowerCase().startsWith('enum')) {
      logger.warn('El tipo de columna no es un ENUM:', enumString)
      return res.json(['Daño', 'Pérdida', 'Robo', 'Mal Funcionamiento', 'Daño Físico', 'Falta de Componente', 'Otro'])
    }

    const valores = enumString
      .replace(/^enum\(/i, '')
      .replace(/\)$/i, '')
      .split(',')
      .map(val => val.trim().replace(/^'|'$/g, ''))
      .filter(val => val.length > 0)

    if (valores.length === 0) {
      logger.warn('No se pudieron extraer valores del ENUM')
      return res.json(['Daño', 'Pérdida', 'Robo', 'Mal Funcionamiento', 'Daño Físico', 'Falta de Componente', 'Otro'])
    }

    logger.info('Tipos de novedad cargados desde BD', { tipos: valores })
    return res.json(valores)
  } catch (err) {
    logger.error('Error al obtener tipos de novedad', { error: err.message, stack: err.stack })
    return res.json(['Daño', 'Pérdida', 'Robo', 'Mal Funcionamiento', 'Daño Físico', 'Falta de Componente', 'Otro'])
  }
}

/**
 * Obtener estados de resolución disponibles desde la base de datos
 * Consulta los valores ENUM de la columna estado_resolucion
 */
export async function obtenerEstadosNovedad(req, res) {
  try {
    const [rows] = await defaultDb.execute(
      `SELECT COLUMN_TYPE 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'Novedades' 
       AND COLUMN_NAME = 'estado_resolucion'`
    )

    if (!rows || rows.length === 0) {
      logger.warn('No se encontró información del ENUM estado_resolucion en INFORMATION_SCHEMA')
      return res.json(['Pendiente', 'En Proceso', 'Resuelto', 'No Resuelto'])
    }

    const enumString = rows[0].COLUMN_TYPE
    if (!enumString || !enumString.toLowerCase().startsWith('enum')) {
      logger.warn('El tipo de columna no es un ENUM:', enumString)
      return res.json(['Pendiente', 'En Proceso', 'Resuelto', 'No Resuelto'])
    }

    const valores = enumString
      .replace(/^enum\(/i, '')
      .replace(/\)$/i, '')
      .split(',')
      .map(val => val.trim().replace(/^'|'$/g, ''))
      .filter(val => val.length > 0)

    if (valores.length === 0) {
      logger.warn('No se pudieron extraer valores del ENUM')
      return res.json(['Pendiente', 'En Proceso', 'Resuelto', 'No Resuelto'])
    }

    logger.info('Estados de novedad cargados desde BD', { estados: valores })
    return res.json(valores)
  } catch (err) {
    logger.error('Error al obtener estados de novedad', { error: err.message, stack: err.stack })
    return res.json(['Pendiente', 'En Proceso', 'Resuelto', 'No Resuelto'])
  }
}

