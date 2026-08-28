import fs from 'fs';
import path from 'path';
import defaultDb from '../config/dbconfig.js';
import { createForUsers } from '../services/notificationService.js';
import { logger } from '../utils/logger.js';
import { obtenerEquipoPorCodigo } from '../utils/sqlQueries.js';
import { obtenerValoresEnumColumna } from '../utils/enumSchemaUtils.js';
import PDFDocument from 'pdfkit';
import { handleControllerError } from '../utils/controllerHelpers.js';
import { getImageFilePath } from '../middleware/uploadMiddleware.js';

// Roles habilitados para generar el documento de equipos con fotos (por cuentadante o por ambiente)
const ROLES_REPORTE_EQUIPOS_FOTOS = ['Administrador', 'Cuentadante'];

// Extensiones de imagen que pdfkit puede incrustar de forma nativa
const EXTENSIONES_IMAGEN_INCRUSTABLES = ['.jpg', '.jpeg', '.png'];

/**
 * Convierte un parámetro de consulta a entero positivo solo si representa
 * exactamente un número entero (ej. "7"). parseInt por sí solo aceptaría
 * "7foo" o "1.9" como 7, filtrando silenciosamente un valor no intencionado.
 * @param {unknown} value
 * @returns {number} el entero parseado, o NaN si no es válido
 */
function parseStrictPositiveInt(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    return NaN;
  }
  return parseInt(value, 10);
}

/**
 * Crear un nuevo reporte
 * Todos los roles pueden crear reportes
 */
export async function crearReporte(req, res) {
  try {
    // Los datos ya están validados por el middleware de validación Zod
    const { tipo_reporte, titulo, descripcion, codigo_equipo } = req.body;
    const userId = req.user?.id;

    // Si se especifica un equipo, validar que existe usando utilidad SQL
    if (codigo_equipo) {
      const equipo = await obtenerEquipoPorCodigo(defaultDb, codigo_equipo);

      if (!equipo) {
        return res.status(404).json({ error: 'Equipo no encontrado' });
      }

      // Si es Instructor o Aprendiz y especifica equipo, validar que le esté asignado
      if (req.user?.rol === 'Instructor' || req.user?.rol === 'Aprendiz') {
        const [[asignacion]] = await defaultDb.execute(
          `SELECT id_responsable FROM Responsables_Equipo 
           WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
          [codigo_equipo, userId]
        );

        if (!asignacion) {
          return res.status(403).json({
            error:
              'No tienes permiso para crear reportes sobre este equipo. Solo puedes crear reportes sobre equipos asignados a ti.',
          });
        }
      }
    }

    // Verificar que la tabla Reportes existe, si no, usar una tabla genérica o retornar error
    // Por ahora, creo el registro en una tabla simplificada
    const [result] = await defaultDb
      .execute(
        `INSERT INTO Reportes (tipo_reporte, titulo, descripcion, codigo_equipo, generado_por, fecha_generacion) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
        [tipo_reporte, titulo, descripcion, codigo_equipo || null, userId]
      )
      .catch(async err => {
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
        `);
          // Reintentar la inserción
          return await defaultDb.execute(
            `INSERT INTO Reportes (tipo_reporte, titulo, descripcion, codigo_equipo, generado_por, fecha_generacion) 
           VALUES (?, ?, ?, ?, ?, NOW())`,
            [tipo_reporte, titulo, descripcion, codigo_equipo || null, userId]
          );
        }
        throw err;
      });

    // Si se especificó un equipo, notificar a los responsables
    if (codigo_equipo) {
      const equipoInfo = await obtenerEquipoPorCodigo(defaultDb, codigo_equipo);

      if (equipoInfo) {
        const [responsables] = await defaultDb.execute(
          `SELECT DISTINCT id_usuario 
           FROM Responsables_Equipo 
           WHERE codigo_equipo = ? AND estado_responsabilidad = 'Activo' AND id_usuario != ?`,
          [codigo_equipo, userId]
        );

        if (responsables.length > 0) {
          const userIds = responsables.map(r => r.id_usuario);
          const equipoDesc =
            `${equipoInfo.tipo} ${equipoInfo.placa || ''} ${equipoInfo.modelo}`.trim();
          await createForUsers({
            userIds,
            titulo: {
              key: 'nuevo_reporte_equipo',
              params: {},
            },
            cuerpo: {
              key: 'nuevo_reporte_equipo_cuerpo',
              params: {
                tipo_reporte,
                equipo: equipoDesc,
                titulo,
              },
            },
            tipo: 'info',
            metadata: {
              id_reporte: result.insertId,
              codigo_equipo,
              tipo_reporte,
              ruta: `/reportes`,
            },
            creadoPor: userId,
          });
        }
      }
    }

    return res.status(201).json({
      ok: true,
      id: result.insertId,
      message: 'Reporte creado correctamente',
    });
  } catch (err) {
    logger.error('Error al crear reporte', {
      error: err.message,
      stack: err.stack,
    });
    return handleControllerError(
      err,
      res,
      'crearReporte',
      'Error al crear el reporte'
    );
  }
}

/**
 * Listar reportes
 * Admin: ve todos los reportes
 * Instructor y Aprendiz: solo ven reportes de equipos asignados o que hayan creado
 */
export async function listarReportes(req, res) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.rol;

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
    `;

    let params = [];

    // Si es Instructor o Aprendiz, filtrar reportes de equipos asignados o que hayan creado
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      query += `
        WHERE (r.generado_por = ? OR EXISTS (
          SELECT 1 FROM Responsables_Equipo re 
          WHERE re.codigo_equipo = r.codigo_equipo 
          AND re.id_usuario = ? 
          AND re.estado_responsabilidad = 'Activo'
        ))
      `;
      params.push(userId, userId);
    }

    query += ` ORDER BY r.fecha_generacion DESC`;

    const [rows] = await defaultDb.execute(query, params).catch(err => {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return [[], []];
      }
      throw err;
    });

    return res.json(rows);
  } catch (err) {
    logger.error('Error al listar reportes', {
      error: err.message,
      stack: err.stack,
    });
    return handleControllerError(
      err,
      res,
      'listarReportes',
      'Error al obtener reportes'
    );
  }
}

/**
 * Obtener detalle de un reporte
 */
export async function obtenerReportePorId(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.rol;

    const [[reporte]] = await defaultDb
      .execute(
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
      )
      .catch(err => {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          return [[null], []];
        }
        throw err;
      });

    if (!reporte) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    // Si es Instructor o Aprendiz, validar que el equipo le esté asignado o que lo haya creado
    if (userRole === 'Instructor' || userRole === 'Aprendiz') {
      // Si lo creó, puede verlo
      if (reporte.generado_por === userId) {
        return res.json(reporte);
      }

      // Si tiene un equipo asociado, validar que le esté asignado
      if (reporte.codigo_equipo) {
        const [[asignacion]] = await defaultDb.execute(
          `SELECT id_responsable FROM Responsables_Equipo 
           WHERE codigo_equipo = ? AND id_usuario = ? AND estado_responsabilidad = 'Activo'`,
          [reporte.codigo_equipo, userId]
        );

        if (!asignacion) {
          return res
            .status(403)
            .json({ error: 'No tienes permiso para ver este reporte' });
        }
      } else {
        // Reporte general sin equipo, solo puede verlo si lo creó
        return res
          .status(403)
          .json({ error: 'No tienes permiso para ver este reporte' });
      }
    }

    return res.json(reporte);
  } catch (err) {
    logger.error('Error al obtener reporte', {
      error: err.message,
      stack: err.stack,
    });
    return handleControllerError(
      err,
      res,
      'obtenerReportePorId',
      'Error al obtener detalle del reporte'
    );
  }
}

/**
 * Actualizar un reporte
 * Solo Administrador puede actualizar reportes
 */
export async function actualizarReporte(req, res) {
  try {
    const { id } = req.params;
    const {
      tipo_reporte,
      titulo,
      descripcion,
      codigo_equipo,
      estado,
      observaciones,
    } = req.body;
    const userRole = req.user?.rol;

    // Solo Administrador puede actualizar reportes
    if (userRole !== 'Administrador') {
      return res
        .status(403)
        .json({ error: 'Solo el Administrador puede editar reportes' });
    }

    if (!tipo_reporte || !titulo || !descripcion) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios (tipo_reporte, titulo, descripcion)',
      });
    }

    // Verificar que el reporte existe
    const [[reporte]] = await defaultDb
      .execute('SELECT id_reporte FROM Reportes WHERE id_reporte = ?', [id])
      .catch(err => {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          return [[null], []];
        }
        throw err;
      });

    if (!reporte) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    // Si se especifica un equipo, validar que existe usando utilidad SQL
    if (codigo_equipo) {
      const equipo = await obtenerEquipoPorCodigo(defaultDb, codigo_equipo);

      if (!equipo) {
        return res.status(404).json({ error: 'Equipo no encontrado' });
      }
    }

    // Actualizar el reporte
    const updateFields = [
      'tipo_reporte = ?',
      'titulo = ?',
      'descripcion = ?',
      'codigo_equipo = ?',
    ];
    const updateValues = [
      tipo_reporte,
      titulo,
      descripcion,
      codigo_equipo || null,
    ];

    // Agregar estado si se proporciona
    if (estado) {
      updateFields.push('estado = ?');
      updateValues.push(estado);
    }

    // Agregar observaciones si se proporcionan
    if (observaciones !== undefined) {
      updateFields.push('observaciones = ?');
      updateValues.push(observaciones || null);
    }

    updateValues.push(id);

    await defaultDb
      .execute(
        `UPDATE Reportes 
       SET ${updateFields.join(', ')}
       WHERE id_reporte = ?`,
        updateValues
      )
      .catch(err => {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          return res
            .status(404)
            .json({ error: 'Tabla de reportes no encontrada' });
        }
        throw err;
      });

    return res.json({
      ok: true,
      message: 'Reporte actualizado correctamente',
    });
  } catch (err) {
    logger.error('Error al actualizar reporte', {
      error: err.message,
      stack: err.stack,
    });
    return handleControllerError(
      err,
      res,
      'actualizarReporte',
      'Error al actualizar el reporte'
    );
  }
}

/**
 * Eliminar un reporte
 * Solo Administrador puede eliminar reportes
 */
export async function eliminarReporte(req, res) {
  try {
    const { id } = req.params;
    const userRole = req.user?.rol;

    // Solo Administrador puede eliminar reportes
    if (userRole !== 'Administrador') {
      return res
        .status(403)
        .json({ error: 'Solo el Administrador puede eliminar reportes' });
    }

    // Verificar que el reporte existe
    const [[reporte]] = await defaultDb
      .execute('SELECT id_reporte FROM Reportes WHERE id_reporte = ?', [id])
      .catch(err => {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          return [[null], []];
        }
        throw err;
      });

    if (!reporte) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    // Eliminar el reporte
    await defaultDb
      .execute('DELETE FROM Reportes WHERE id_reporte = ?', [id])
      .catch(err => {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          return res
            .status(404)
            .json({ error: 'Tabla de reportes no encontrada' });
        }
        throw err;
      });

    return res.json({
      ok: true,
      message: 'Reporte eliminado correctamente',
    });
  } catch (err) {
    logger.error('Error al eliminar reporte', {
      error: err.message,
      stack: err.stack,
    });
    return handleControllerError(
      err,
      res,
      'eliminarReporte',
      'Error al eliminar el reporte'
    );
  }
}

/**
 * Obtener tipos de reporte disponibles desde la base de datos
 * Consulta los valores ENUM de la columna tipo_reporte
 */
export async function obtenerTiposReporte(req, res) {
  const valores = await obtenerValoresEnumColumna(
    defaultDb,
    'Reportes',
    'tipo_reporte',
    ['General', 'Equipos', 'Mantenimiento', 'Novedades', 'Uso', 'Otro'],
    { logger, logLabel: 'tipo_reporte' }
  );
  return res.json(valores);
}

/**
 * Generar reporte en PDF con equipos, instructores y cuentadantes secundarios
 * Identifica instructores como cuentadantes secundarios cuando tienen uno o más ambientes asignados
 */
export async function generarReportePDF(req, res) {
  try {
    const { id_ambiente, fecha_inicio, fecha_fin } = req.query;

    // Los permisos ya fueron validados por el middleware requireAnyPermission
    // Solo Administradores y Cuentadantes tienen PERMISSIONS.REPORTES.VIEW según permissions.js

    // Crear documento PDF
    // bufferPages: true es obligatorio porque el pie de página recorre todas las
    // páginas con switchToPage() al final; sin esta opción, pdfkit descarta cada
    // página del buffer en cuanto se llama addPage(), y switchToPage() revienta
    // con "out of bounds" en cualquier reporte de más de una página.
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
    });

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Reporte_Equipos_${Date.now()}.pdf"`
    );

    // Pipe del PDF a la respuesta
    doc.pipe(res);

    // Encabezado del documento
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('REPORTE DE EQUIPOS E INSTRUCTORES', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font('Helvetica')
      .text('Sistema de Gestión de Inventarios SENA', { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .text(`Fecha de generación: ${new Date().toLocaleString('es-ES')}`, {
        align: 'center',
      });
    doc.moveDown(1);

    // Línea separadora
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // Obtener equipos con sus ambientes
    let queryEquipos = `
      SELECT 
        e.codigo_equipo,
        e.placa,
        e.tipo,
        e.modelo,
        e.consecutivo,
        e.descripcion,
        e.r_centro,
        e.estado_fisico,
        a.id_ambiente,
        a.nombre_ambiente,
        a.codigo_ambiente,
        c.nombre_categoria,
        u_cuentadante.nombre_usuario AS cuentadante_principal,
        u_cuentadante.cedula AS cuentadante_cedula
      FROM Elementos e
      LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
      LEFT JOIN Categorias_Equipo c ON e.id_categoria = c.id_categoria
      LEFT JOIN Usuarios u_cuentadante ON e.id_cuentadante = u_cuentadante.id_usuario
      WHERE 1=1
    `;
    const paramsEquipos = [];

    if (id_ambiente) {
      queryEquipos += ' AND e.id_ambiente = ?';
      paramsEquipos.push(id_ambiente);
    }

    queryEquipos += ' ORDER BY a.nombre_ambiente, e.tipo, e.placa';

    const [equipos] = await defaultDb.execute(queryEquipos, paramsEquipos);

    if (equipos.length === 0) {
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('No se encontraron equipos para el reporte.', {
          align: 'center',
        });
      doc.end();
      return;
    }

    // Agrupar equipos por ambiente
    const equiposPorAmbiente = {};
    equipos.forEach(equipo => {
      const ambienteKey = equipo.id_ambiente || 'sin_ambiente';
      if (!equiposPorAmbiente[ambienteKey]) {
        equiposPorAmbiente[ambienteKey] = {
          ambiente: equipo.nombre_ambiente || 'Sin ambiente asignado',
          codigo_ambiente: equipo.codigo_ambiente || 'N/A',
          equipos: [],
        };
      }
      equiposPorAmbiente[ambienteKey].equipos.push(equipo);
    });

    // Procesar cada ambiente
    for (const [ambienteKey, datosAmbiente] of Object.entries(
      equiposPorAmbiente
    )) {
      // Verificar si necesitamos nueva página
      if (doc.y > 700) {
        doc.addPage();
      }

      // Título del ambiente
      doc.fontSize(16).font('Helvetica-Bold').fillColor('black');
      doc.text(`AMBIENTE: ${datosAmbiente.ambiente}`, { underline: true });
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Código: ${datosAmbiente.codigo_ambiente}`);
      doc.moveDown(0.5);

      // Obtener ID del ambiente (puede venir de diferentes fuentes)
      const ambienteId =
        ambienteKey !== 'sin_ambiente' ? parseInt(ambienteKey, 10) : null;

      if (!ambienteId) {
        // Si no hay ambiente válido, continuar con el siguiente
        continue;
      }

      // Obtener instructores asignados a este ambiente
      let queryInstructores = `
        SELECT DISTINCT
          u.id_usuario,
          u.nombre_usuario,
          u.cedula,
          r.nombre_rol,
          ra.tipo_responsabilidad,
          COUNT(DISTINCT ra.id_responsabilidad_ambiente) AS total_ambientes_asignados
        FROM Responsabilidades_Ambiente ra
        INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
        INNER JOIN Roles r ON u.id_rol = r.id_rol
        WHERE ra.id_ambiente = ?
          AND ra.estado_responsabilidad = 'Activa'
          AND r.nombre_rol = 'Instructor'
          -- SISTEMA 100% MANUAL: Eliminada comparación con NOW()
          -- AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())
      `;
      const paramsInstructores = [ambienteId];

      if (fecha_inicio && fecha_fin) {
        queryInstructores +=
          ' AND ra.fecha_inicio <= ? AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= ?)';
        paramsInstructores.push(fecha_fin, fecha_inicio);
      }

      queryInstructores +=
        ' GROUP BY u.id_usuario, u.nombre_usuario, u.cedula, r.nombre_rol, ra.tipo_responsabilidad';

      const [instructores] = await defaultDb.execute(
        queryInstructores,
        paramsInstructores
      );

      // Obtener cuentadantes secundarios (instructores con ambientes asignados)
      const cuentadantesSecundarios = [];
      for (const instructor of instructores) {
        // Verificar si el instructor tiene uno o más ambientes asignados
        const [ambientesAsignados] = await defaultDb.execute(
          `SELECT COUNT(DISTINCT ra.id_ambiente) AS total
           FROM Responsabilidades_Ambiente ra
           WHERE ra.id_usuario = ?
             AND ra.estado_responsabilidad = 'Activa'
             AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())`,
          [instructor.id_usuario]
        );

        if (ambientesAsignados[0]?.total >= 1) {
          cuentadantesSecundarios.push({
            ...instructor,
            es_cuentadante_secundario: true,
            total_ambientes: ambientesAsignados[0].total,
          });
        }
      }

      // Mostrar instructores a cargo
      if (instructores.length > 0) {
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Instructores a cargo:', { continued: false });
        doc.moveDown(0.3);

        instructores.forEach((instructor, index) => {
          const esSecundario = cuentadantesSecundarios.some(
            cs => cs.id_usuario === instructor.id_usuario
          );
          doc.fontSize(10).font('Helvetica');
          let textoInstructor = `${index + 1}. ${instructor.nombre_usuario} (${instructor.cedula})`;
          if (esSecundario) {
            textoInstructor += ' - Cuentadante Secundario';
            doc.fillColor('blue');
          } else {
            doc.fillColor('black');
          }
          doc.text(textoInstructor);
          doc.fillColor('black');
        });
        doc.moveDown(0.5);
      } else {
        doc
          .fontSize(10)
          .font('Helvetica')
          .text('No hay instructores asignados a este ambiente.', {
            continued: false,
          });
        doc.moveDown(0.5);
      }

      // Tabla de equipos
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Equipos del ambiente:', { continued: false });
      doc.moveDown(0.3);

      // Encabezados de tabla
      const startY = doc.y;
      const colWidths = {
        placa: 80,
        tipo: 100,
        modelo: 100,
        estado: 80,
        cuentadante: 120,
      };
      let currentX = 50;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Placa', currentX, startY);
      currentX += colWidths.placa;
      doc.text('Tipo', currentX, startY);
      currentX += colWidths.tipo;
      doc.text('Modelo', currentX, startY);
      currentX += colWidths.modelo;
      doc.text('Estado', currentX, startY);
      currentX += colWidths.estado;
      doc.text('Cuentadante', currentX, startY);

      // Línea bajo encabezados
      doc
        .moveTo(50, startY + 15)
        .lineTo(550, startY + 15)
        .stroke();
      doc.y = startY + 20;

      // Filas de equipos
      doc.fontSize(8).font('Helvetica');
      datosAmbiente.equipos.forEach((equipo, index) => {
        if (doc.y > 700) {
          doc.addPage();
          doc.y = 50;
        }

        currentX = 50;
        doc.text(equipo.placa || 'N/A', currentX, doc.y, {
          width: colWidths.placa,
          ellipsis: true,
        });
        currentX += colWidths.placa;
        doc.text(equipo.tipo || 'N/A', currentX, doc.y, {
          width: colWidths.tipo,
          ellipsis: true,
        });
        currentX += colWidths.tipo;
        doc.text(equipo.modelo || 'N/A', currentX, doc.y, {
          width: colWidths.modelo,
          ellipsis: true,
        });
        currentX += colWidths.modelo;
        doc.text(equipo.estado_fisico || 'N/A', currentX, doc.y, {
          width: colWidths.estado,
          ellipsis: true,
        });
        currentX += colWidths.estado;
        doc.text(
          equipo.cuentadante_principal || 'Sin asignar',
          currentX,
          doc.y,
          { width: colWidths.cuentadante, ellipsis: true }
        );

        doc.y += 15;

        // Línea separadora cada 5 filas
        if ((index + 1) % 5 === 0) {
          doc
            .moveTo(50, doc.y - 5)
            .lineTo(550, doc.y - 5)
            .stroke();
          doc.y += 5;
        }
      });

      doc.moveDown(1);
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(
          `Total equipos en este ambiente: ${datosAmbiente.equipos.length}`,
          { align: 'right' }
        );
      doc.moveDown(1.5);
    }

    // Resumen final
    if (doc.y > 650) {
      doc.addPage();
    }

    // Calcular totales de instructores y cuentadantes secundarios
    let totalInstructores = 0;
    let totalCuentadantesSecundarios = 0;
    const instructoresUnicos = new Set();

    for (const [ambienteKey] of Object.entries(equiposPorAmbiente)) {
      const ambienteId =
        ambienteKey !== 'sin_ambiente' ? parseInt(ambienteKey, 10) : null;
      if (!ambienteId) continue;

      const [instructoresAmb] = await defaultDb.execute(
        `SELECT DISTINCT u.id_usuario
         FROM Responsabilidades_Ambiente ra
         INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
         INNER JOIN Roles r ON u.id_rol = r.id_rol
         WHERE ra.id_ambiente = ?
           AND ra.estado_responsabilidad = 'Activa'
           AND r.nombre_rol = 'Instructor'
           -- SISTEMA 100% MANUAL: Eliminada comparación con NOW()
           -- AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())`,
        [ambienteId]
      );

      instructoresAmb.forEach(inst => instructoresUnicos.add(inst.id_usuario));

      for (const instructor of instructoresAmb) {
        const [ambientesAsignados] = await defaultDb.execute(
          `SELECT COUNT(DISTINCT ra.id_ambiente) AS total
           FROM Responsabilidades_Ambiente ra
           WHERE ra.id_usuario = ?
             AND ra.estado_responsabilidad = 'Activa'
             -- SISTEMA 100% MANUAL: Eliminada comparación con NOW()
             -- AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())`,
          [instructor.id_usuario]
        );

        if (ambientesAsignados[0]?.total >= 1) {
          totalCuentadantesSecundarios++;
        }
      }
    }

    totalInstructores = instructoresUnicos.size;

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('RESUMEN', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Total de ambientes: ${Object.keys(equiposPorAmbiente).length}`);
    doc.text(`Total de equipos: ${equipos.length}`);
    doc.text(`Total de instructores únicos: ${totalInstructores}`);
    doc.text(
      `Total de cuentadantes secundarios: ${totalCuentadantesSecundarios}`
    );

    // Pie de página
    // IMPORTANTE: se escribe cerca del borde inferior físico de la página, dentro
    // del margen inferior del documento. Sin anular ese margen, pdfkit interpreta
    // que el texto se desborda y agrega automáticamente una página nueva (casi
    // vacía) por cada página real, duplicando el número de páginas del PDF.
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const margenInferiorOriginal = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('gray');
      doc.text(
        `Página ${i + 1} de ${totalPages} - Generado el ${new Date().toLocaleDateString('es-ES')}`,
        50,
        doc.page.height - 30,
        { align: 'center', width: 500 }
      );
    }

    doc.end();
  } catch (err) {
    logger.error('Error al generar reporte PDF', {
      error: err.message,
      stack: err.stack,
    });
    if (!res.headersSent) {
      return handleControllerError(
        err,
        res,
        'generarReportePDF',
        'No se pudo generar el reporte en PDF'
      );
    }
  }
}

/**
 * Genera un reporte en PDF de equipos con placa, nombre, descripción y fotos.
 * Dos modos de filtro, mutuamente excluyentes:
 * - modo=cuentadante: equipos a cargo de un cuentadante (el propio si el usuario es Cuentadante,
 *   o cualquiera indicado por id_cuentadante si el usuario es Administrador)
 * - modo=ambiente: equipos de un ambiente/salón (id_ambiente)
 *
 * Solo Administrador y Cuentadante pueden generar este reporte.
 */
export async function generarReporteEquiposFotosPDF(req, res) {
  try {
    const userRole = req.user?.rol;
    const userId = req.user?.id;

    if (!ROLES_REPORTE_EQUIPOS_FOTOS.includes(userRole)) {
      return res.status(403).json({
        error:
          'Solo el Administrador o el Cuentadante pueden generar el documento de equipos con fotos',
      });
    }

    const { modo } = req.query;
    if (modo !== 'cuentadante' && modo !== 'ambiente') {
      return res.status(400).json({
        error:
          'El parámetro "modo" es obligatorio y debe ser "cuentadante" o "ambiente"',
      });
    }

    let equipos;
    let encabezado;

    if (modo === 'cuentadante') {
      let idCuentadante;

      if (userRole === 'Cuentadante') {
        // Un cuentadante solo puede generar el reporte de su propio inventario
        idCuentadante = userId;
      } else {
        idCuentadante = parseStrictPositiveInt(req.query.id_cuentadante);
        if (!Number.isInteger(idCuentadante)) {
          return res.status(400).json({
            error:
              'El parámetro "id_cuentadante" es obligatorio y debe ser numérico',
          });
        }
      }

      const [[cuentadante]] = await defaultDb.execute(
        `SELECT u.id_usuario, u.nombre_usuario, u.cedula
         FROM Usuarios u
         INNER JOIN Roles r ON r.id_rol = u.id_rol
         WHERE u.id_usuario = ? AND r.nombre_rol = 'Cuentadante'`,
        [idCuentadante]
      );

      if (!cuentadante) {
        return res.status(404).json({ error: 'Cuentadante no encontrado' });
      }

      const [rows] = await defaultDb.execute(
        `SELECT
          e.codigo_equipo, e.placa, e.tipo, e.modelo, e.descripcion, e.estado_fisico,
          a.nombre_ambiente, a.codigo_ambiente,
          u.nombre_usuario AS cuentadante_nombre, u.cedula AS cuentadante_cedula
        FROM Elementos e
        LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
        LEFT JOIN Usuarios u ON u.id_usuario = e.id_cuentadante
        WHERE e.id_cuentadante = ?
        ORDER BY e.tipo ASC, e.placa ASC`,
        [idCuentadante]
      );
      equipos = rows;

      encabezado = {
        titulo: 'DOCUMENTO DE EQUIPOS POR CUENTADANTE',
        subtitulo: `Cuentadante: ${cuentadante.nombre_usuario} (${cuentadante.cedula})`,
      };
    } else {
      const idAmbiente = parseStrictPositiveInt(req.query.id_ambiente);
      if (!Number.isInteger(idAmbiente)) {
        return res.status(400).json({
          error:
            'El parámetro "id_ambiente" es obligatorio y debe ser numérico',
        });
      }

      // Un Cuentadante solo puede generar el reporte de ambientes que tiene asignados como responsable
      if (userRole === 'Cuentadante') {
        const [[responsabilidad]] = await defaultDb.execute(
          `SELECT 1 FROM Responsabilidades_Ambiente
           WHERE id_ambiente = ? AND id_usuario = ? AND estado_responsabilidad = 'Activa'
           LIMIT 1`,
          [idAmbiente, userId]
        );

        if (!responsabilidad) {
          return res.status(403).json({
            error: 'No tienes permiso para generar el documento de este ambiente',
          });
        }
      }

      const [[ambiente]] = await defaultDb.execute(
        'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE id_ambiente = ?',
        [idAmbiente]
      );

      if (!ambiente) {
        return res.status(404).json({ error: 'Ambiente no encontrado' });
      }

      const [rows] = await defaultDb.execute(
        `SELECT
          e.codigo_equipo, e.placa, e.tipo, e.modelo, e.descripcion, e.estado_fisico,
          a.nombre_ambiente, a.codigo_ambiente,
          u.nombre_usuario AS cuentadante_nombre, u.cedula AS cuentadante_cedula
        FROM Elementos e
        LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
        LEFT JOIN Usuarios u ON u.id_usuario = e.id_cuentadante
        WHERE e.id_ambiente = ?
        ORDER BY e.tipo ASC, e.placa ASC`,
        [idAmbiente]
      );
      equipos = rows;

      encabezado = {
        titulo: 'DOCUMENTO DE EQUIPOS POR AMBIENTE',
        subtitulo: `Ambiente: ${ambiente.nombre_ambiente} (${ambiente.codigo_ambiente})`,
      };
    }

    // Fotos de todos los equipos en una sola consulta (evita N+1), máximo 3 por equipo
    // para no disparar el peso del PDF (recortado en memoria tras traerlas agrupadas)
    const fotosPorEquipo = new Map(
      equipos.map(equipo => [equipo.codigo_equipo, []])
    );
    if (equipos.length > 0) {
      const codigosEquipo = equipos.map(equipo => equipo.codigo_equipo);
      const placeholders = codigosEquipo.map(() => '?').join(',');
      const [todasLasFotos] = await defaultDb.execute(
        `SELECT codigo_equipo, nombre_archivo, es_principal
         FROM Imagenes_Equipo
         WHERE codigo_equipo IN (${placeholders})
         ORDER BY codigo_equipo ASC, es_principal DESC, fecha_subida DESC`,
        codigosEquipo
      );

      for (const foto of todasLasFotos) {
        const fotos = fotosPorEquipo.get(foto.codigo_equipo);
        if (fotos.length < 3) {
          fotos.push(foto);
        }
      }
    }

    // bufferPages: true evita que switchToPage() falle al recorrer todas las
    // páginas en el pie de página (ver comentario equivalente en generarReportePDF).
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Documento_Equipos_${Date.now()}.pdf"`
    );
    doc.pipe(res);

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(encabezado.titulo, { align: 'center' });
    doc.moveDown(0.3);
    doc
      .fontSize(11)
      .font('Helvetica')
      .text('Sistema de Gestión de Inventarios SENA', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).text(encabezado.subtitulo, { align: 'center' });
    doc
      .fontSize(9)
      .fillColor('gray')
      .text(`Fecha de generación: ${new Date().toLocaleString('es-ES')}`, {
        align: 'center',
      });
    doc.fillColor('black');
    doc.moveDown(0.8);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    if (equipos.length === 0) {
      doc
        .fontSize(12)
        .font('Helvetica')
        .text('No se encontraron equipos para los filtros seleccionados.', {
          align: 'center',
        });
      doc.end();
      return;
    }

    const PHOTO_SIZE = 100;
    const PHOTO_GAP = 10;

    equipos.forEach((equipo, index) => {
      const fotos = fotosPorEquipo.get(equipo.codigo_equipo) || [];
      const bloqueAlto = fotos.length > 0 ? 140 : 70;

      if (doc.y + bloqueAlto > 720) {
        doc.addPage();
      }

      doc.fontSize(12).font('Helvetica-Bold').fillColor('black');
      doc.text(
        `${index + 1}. ${equipo.tipo}${equipo.modelo ? ` - ${equipo.modelo}` : ''}`
      );

      doc.fontSize(9).font('Helvetica');
      doc.text(
        `Placa: ${equipo.placa || 'N/A'}    Estado físico: ${equipo.estado_fisico || 'N/A'}`
      );

      if (modo === 'cuentadante') {
        doc.text(`Ambiente: ${equipo.nombre_ambiente || 'Sin asignar'}`);
      } else {
        doc.text(`Cuentadante: ${equipo.cuentadante_nombre || 'Sin asignar'}`);
      }

      doc.text(
        `Descripción: ${equipo.descripcion || 'Sin descripción registrada'}`,
        { width: 500 }
      );
      doc.moveDown(0.4);

      if (fotos.length === 0) {
        doc
          .fontSize(9)
          .font('Helvetica-Oblique')
          .fillColor('gray')
          .text('Sin fotos registradas');
        doc.fillColor('black');
        doc.moveDown(0.6);
      } else {
        const photoY = doc.y;
        let photoX = 50;

        for (const foto of fotos) {
          let embebida = false;
          try {
            const extension = path
              .extname(foto.nombre_archivo || '')
              .toLowerCase();
            const filePath = getImageFilePath(foto.nombre_archivo);

            if (
              EXTENSIONES_IMAGEN_INCRUSTABLES.includes(extension) &&
              fs.existsSync(filePath)
            ) {
              doc.image(filePath, photoX, photoY, {
                fit: [PHOTO_SIZE, PHOTO_SIZE],
              });
              embebida = true;
            }
          } catch (imgErr) {
            logger.warn('No se pudo incrustar imagen en documento de equipos', {
              error: imgErr.message,
              codigo_equipo: equipo.codigo_equipo,
              archivo: foto.nombre_archivo,
            });
          }

          // Cualquier motivo por el que no se incrustó (formato no soportado, archivo
          // faltante o nombre inválido) debe mostrar el mismo aviso visual, nunca dejar
          // el espacio en blanco.
          if (!embebida) {
            doc.rect(photoX, photoY, PHOTO_SIZE, PHOTO_SIZE).stroke();
            doc
              .fontSize(7)
              .font('Helvetica-Oblique')
              .fillColor('gray')
              .text(
                'Vista previa no disponible',
                photoX + 5,
                photoY + PHOTO_SIZE / 2 - 5,
                { width: PHOTO_SIZE - 10, align: 'center' }
              );
            doc.fillColor('black');
          }

          photoX += PHOTO_SIZE + PHOTO_GAP;
        }

        doc.y = photoY + PHOTO_SIZE + 10;
      }

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.8);
    });

    if (doc.y > 700) {
      doc.addPage();
    }
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`Total de equipos: ${equipos.length}`, { align: 'right' });

    // IMPORTANTE: se escribe cerca del borde inferior físico de la página, dentro
    // del margen inferior del documento. Sin anular ese margen, pdfkit interpreta
    // que el texto se desborda y agrega automáticamente una página nueva (casi
    // vacía) por cada página real, duplicando el número de páginas del PDF.
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const margenInferiorOriginal = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fontSize(8).font('Helvetica-Oblique').fillColor('gray');
      doc.text(
        `Página ${i + 1} de ${totalPages} - Generado el ${new Date().toLocaleDateString('es-ES')}`,
        50,
        doc.page.height - 30,
        { align: 'center', width: 500 }
      );
    }

    doc.end();
  } catch (err) {
    logger.error('Error al generar documento de equipos con fotos', {
      error: err.message,
      stack: err.stack,
    });
    if (!res.headersSent) {
      return handleControllerError(
        err,
        res,
        'generarReporteEquiposFotosPDF',
        'No se pudo generar el documento de equipos'
      );
    }
    // Las cabeceras ya se enviaron (el PDF empezó a transmitirse): no se puede
    // responder con un JSON de error, pero sí evitar dejar la conexión colgada
    // a medias.
    if (!res.writableEnded) {
      res.end();
    }
  }
}
