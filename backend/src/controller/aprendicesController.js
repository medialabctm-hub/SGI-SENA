import defaultDb from '../config/dbconfig.js'
import { logger } from '../utils/logger.js'
import { handleControllerError } from '../utils/controllerHelpers.js';
import { TIPOS_DOCUMENTO } from '../config/documentTypes.js';
import { normalizarYValidarAprendiz } from '../utils/aprendices.js';

const COLUMNAS_APRENDIZ = [
  {
    nombre: 'tipo_aprendiz',
    definicion: "VARCHAR(20) NOT NULL DEFAULT 'Regular' AFTER tipo_documento_otro",
  },
  { nombre: 'dias_semana', definicion: 'VARCHAR(255) NULL AFTER tipo_aprendiz' },
  { nombre: 'hora_inicio', definicion: 'TIME NULL AFTER dias_semana' },
  { nombre: 'hora_fin', definicion: 'TIME NULL AFTER hora_inicio' },
];

const CAMPOS_APRENDIZ_SELECT = `id_aprendiz, ficha, nombre, documento, tipo_documento,
  tipo_documento_otro, tipo_aprendiz, jornada, dias_semana, hora_inicio, hora_fin, fecha_creacion`;

export async function ensureAprendicesTable() {
  try {
    const [[tablaExiste]] = await defaultDb.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'Aprendices'`
    )

    if (tablaExiste.cnt === 0) {
      await defaultDb.execute(
        `CREATE TABLE Aprendices (
          id_aprendiz INT PRIMARY KEY AUTO_INCREMENT,
          ficha VARCHAR(100) NULL,
          nombre VARCHAR(200) NOT NULL,
          documento VARCHAR(50) NOT NULL,
          tipo_documento ENUM('TI', 'CC', 'CE', 'PPT', 'Otro') DEFAULT 'CC' COMMENT 'Tipo de documento de identidad',
          tipo_documento_otro VARCHAR(50) NULL COMMENT 'Especificación cuando tipo_documento es "Otro"',
          tipo_aprendiz VARCHAR(20) NOT NULL DEFAULT 'Regular',
          jornada VARCHAR(30) CHARACTER SET utf8mb4 NULL,
          dias_semana VARCHAR(255) NULL,
          hora_inicio TIME NULL,
          hora_fin TIME NULL,
          creado_por INT NULL,
          fecha_creacion DATETIME DEFAULT NOW(),
          FOREIGN KEY (creado_por) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL,
          UNIQUE KEY uk_documento (documento),
          INDEX idx_ficha (ficha),
          INDEX idx_jornada (jornada),
          INDEX idx_tipo_documento (tipo_documento)
        ) COMMENT = 'Registro de aprendices (no habilitados para iniciar sesión)'
        `
      )
      logger.info('Tabla Aprendices creada correctamente')
    } else {
      const [[tipoDocumentoExiste]] = await defaultDb.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'Aprendices'
         AND COLUMN_NAME = 'tipo_documento'`
      );

      if (tipoDocumentoExiste.cnt === 0) {
        await defaultDb.execute(
          `ALTER TABLE Aprendices
           ADD COLUMN tipo_documento ENUM('TI', 'CC', 'CE', 'PPT', 'Otro') DEFAULT 'CC'
           COMMENT 'Tipo de documento de identidad' AFTER documento`
        );
      }

      const [[tipoDocumentoOtroExiste]] = await defaultDb.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'Aprendices'
         AND COLUMN_NAME = 'tipo_documento_otro'`
      );

      if (tipoDocumentoOtroExiste.cnt === 0) {
        await defaultDb.execute(
          `ALTER TABLE Aprendices
           ADD COLUMN tipo_documento_otro VARCHAR(50) NULL
           COMMENT 'Especificación cuando tipo_documento es "Otro"' AFTER tipo_documento`
        );
      }

      const [[indiceTipoDocumentoExiste]] = await defaultDb.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'Aprendices'
         AND INDEX_NAME = 'idx_tipo_documento'`
      );

      if (indiceTipoDocumentoExiste.cnt === 0) {
        await defaultDb.execute('ALTER TABLE Aprendices ADD INDEX idx_tipo_documento (tipo_documento)');
      }

      const [[jornadaActual]] = await defaultDb.execute(
        `SELECT DATA_TYPE, CHARACTER_SET_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'Aprendices'
         AND COLUMN_NAME = 'jornada'`
      );
      const jornadaRequiereMigracion = jornadaActual?.DATA_TYPE?.toLowerCase() !== 'varchar'
        || jornadaActual?.CHARACTER_SET_NAME?.toLowerCase() !== 'utf8mb4';
      if (jornadaRequiereMigracion) {
        await defaultDb.execute('ALTER TABLE Aprendices MODIFY jornada VARCHAR(30) CHARACTER SET utf8mb4 NULL');
      }

      for (const columna of COLUMNAS_APRENDIZ) {
        // Las columnas se agregan en orden porque cada definición usa AFTER.
        // eslint-disable-next-line no-await-in-loop
        const [[columnaExiste]] = await defaultDb.execute(
          `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'Aprendices'
           AND COLUMN_NAME = ?`,
          [columna.nombre]
        );

        if (columnaExiste.cnt === 0) {
          // eslint-disable-next-line no-await-in-loop
          await defaultDb.execute(`ALTER TABLE Aprendices ADD COLUMN ${columna.nombre} ${columna.definicion}`);
        }
      }

      const [[backfillPendiente]] = await defaultDb.execute(
        `SELECT EXISTS(
           SELECT 1 FROM Aprendices
           WHERE tipo_documento IS NULL
             OR tipo_aprendiz IS NULL
             OR TRIM(tipo_aprendiz) = ''
             OR jornada = CONVERT(0x4D61C383C2B1616E61 USING utf8mb4)
         ) AS hay_pendientes`
      );

      if (backfillPendiente.hay_pendientes) {
        await defaultDb.execute("UPDATE Aprendices SET tipo_documento = 'CC' WHERE tipo_documento IS NULL");
        await defaultDb.execute("UPDATE Aprendices SET tipo_aprendiz = 'Regular' WHERE tipo_aprendiz IS NULL OR TRIM(tipo_aprendiz) = ''");
        await defaultDb.execute(
          `UPDATE Aprendices
           SET jornada = CONVERT(0x4D61C3B1616E61 USING utf8mb4)
           WHERE jornada = CONVERT(0x4D61C383C2B1616E61 USING utf8mb4)`
        );
      }
    }
  } catch (error) {
    logger.error('Error al asegurar la tabla Aprendices', { error: error.message })
    throw error
  }
}

/**
 * Verificar si un documento existe en el roster de Aprendices (público, sin autenticación).
 * Usado por el autoservicio: el aprendiz solo confirma su documento antes de pedir un equipo.
 * No expone PII (nombre, ficha, ids): la respuesta solo indica existencia.
 * No ejecuta ensureAprendicesTable() en esta ruta: la migración de la tabla corre
 * en las rutas autenticadas de escritura (crearAprendiz, importAprendices, etc.),
 * nunca en un endpoint público sin autenticación.
 */
export async function verificarAprendizPorDocumento(req, res) {
  const { documento } = req.params
  const documentoNormalizado = typeof documento === 'string' ? documento.trim() : ''

  if (!documentoNormalizado) {
    return res.status(400).json({ existe: false, error: 'El documento es obligatorio' })
  }

  try {
    const [[aprendiz]] = await defaultDb.execute(
      'SELECT 1 FROM Aprendices WHERE TRIM(documento) = ? LIMIT 1',
      [documentoNormalizado]
    )

    return res.status(aprendiz ? 200 : 404).json({ existe: Boolean(aprendiz) })
  } catch (error) {
    logger.error('Error al verificar aprendiz por documento', { error: error.message, stack: error.stack })
    return handleControllerError(error, res, 'verificarAprendizPorDocumento', 'Error al verificar el documento');
  }
}

export async function listarAprendices(req, res) {
  try {
    await ensureAprendicesTable()

    const [rows] = await defaultDb.execute(
      `SELECT ${CAMPOS_APRENDIZ_SELECT}
       FROM Aprendices
       ORDER BY fecha_creacion DESC`
    )

    return res.json({
      ok: true,
      aprendices: rows,
    })
  } catch (error) {
    logger.error('Error al listar aprendices', { error: error.message, stack: error.stack })
    return handleControllerError(error, res, 'listarAprendices', 'Error al obtener aprendices');
  }
}

function validarDatosAprendiz(body = {}) {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const documento = typeof body.documento === 'string' ? body.documento.trim() : '';
  const tipoDocumento = typeof body.tipo_documento === 'string' ? body.tipo_documento.trim() : 'CC';
  const tipoDocumentoOtro = tipoDocumento === 'Otro' && typeof body.tipo_documento_otro === 'string'
    ? body.tipo_documento_otro.trim()
    : null;

  if (!nombre || !documento) {
    return { error: 'Nombre y documento son obligatorios' };
  }

  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) {
    return { error: 'Tipo de documento inválido', detalle: `Los tipos permitidos son: ${TIPOS_DOCUMENTO.join(', ')}` };
  }

  if (tipoDocumento === 'Otro' && !tipoDocumentoOtro) {
    return { error: 'Debe especificar el tipo de documento cuando selecciona "Otro"' };
  }

  const validacion = normalizarYValidarAprendiz(body);
  if (validacion.error) {
    return { error: validacion.error };
  }

  const datos = {
    ...validacion.datos,
    nombre,
    documento,
    tipo_documento: tipoDocumento,
    tipo_documento_otro: tipoDocumento === 'Otro' ? tipoDocumentoOtro : null,
  };

  if (datos.tipo_aprendiz === 'Regular') {
    datos.dias_semana = null;
    datos.hora_inicio = null;
    datos.hora_fin = null;
  }

  return { datos, error: null };
}

export async function crearAprendiz(req, res) {
  const validacion = validarDatosAprendiz(req.body);
  if (validacion.error) {
    return res.status(400).json({ error: validacion.error, ...(validacion.detalle ? { detalle: validacion.detalle } : {}) });
  }

  const { datos } = validacion;

  try {
    await ensureAprendicesTable();

    const [[duplicado]] = await defaultDb.execute(
      'SELECT id_aprendiz, ficha, nombre, documento, tipo_documento, tipo_documento_otro, tipo_aprendiz, jornada, dias_semana, hora_inicio, hora_fin, fecha_creacion FROM Aprendices WHERE documento = ? LIMIT 1',
      [datos.documento]
    );
    if (duplicado) {
      return res.status(409).json({ error: 'El documento ya está registrado en otro aprendiz' });
    }

    const [resultado] = await defaultDb.execute(
      `INSERT INTO Aprendices
       (ficha, nombre, documento, tipo_documento, tipo_documento_otro, tipo_aprendiz, jornada, dias_semana, hora_inicio, hora_fin, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.ficha || null, datos.nombre, datos.documento, datos.tipo_documento,
        datos.tipo_documento_otro, datos.tipo_aprendiz, datos.jornada,
        datos.dias_semana, datos.hora_inicio, datos.hora_fin, req.user?.id || null,
      ]
    );

    const [[aprendiz]] = await defaultDb.execute(
      `SELECT ${CAMPOS_APRENDIZ_SELECT} FROM Aprendices WHERE id_aprendiz = ?`,
      [resultado.insertId]
    );

    return res.status(201).json({ ok: true, aprendiz });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El documento ya está registrado en otro aprendiz' });
    }
    logger.error('Error al crear aprendiz', { error: error.message, stack: error.stack });
    return handleControllerError(error, res, 'crearAprendiz', 'Error al crear aprendiz');
  }
}

export async function actualizarAprendiz(req, res) {
  const { id } = req.params
  const idAprendiz = Number.parseInt(id, 10)
  if (!Number.isFinite(idAprendiz) || idAprendiz <= 0) {
    return res.status(400).json({ error: 'ID de aprendiz inválido' })
  }

  const validacion = validarDatosAprendiz(req.body);
  if (validacion.error) {
    return res.status(400).json({ error: validacion.error, ...(validacion.detalle ? { detalle: validacion.detalle } : {}) });
  }
  const { datos } = validacion;

  try {
    await ensureAprendicesTable()

    const [[existe]] = await defaultDb.execute(
      `SELECT ${CAMPOS_APRENDIZ_SELECT} FROM Aprendices WHERE id_aprendiz = ? LIMIT 1`,
      [idAprendiz]
    )

    if (!existe) {
      return res.status(404).json({ error: 'El aprendiz no existe' })
    }

    const [[duplicado]] = await defaultDb.execute(
      `SELECT ${CAMPOS_APRENDIZ_SELECT}
       FROM Aprendices WHERE documento = ? AND id_aprendiz <> ? LIMIT 1`,
      [datos.documento, idAprendiz]
    )

    if (duplicado) {
      return res.status(409).json({ error: 'El documento ya está registrado en otro aprendiz' })
    }

    await defaultDb.execute(
      `UPDATE Aprendices
       SET ficha = ?, nombre = ?, documento = ?, tipo_documento = ?, tipo_documento_otro = ?,
           tipo_aprendiz = ?, jornada = ?, dias_semana = ?, hora_inicio = ?, hora_fin = ?
       WHERE id_aprendiz = ?`,
      [
        datos.ficha || null, datos.nombre, datos.documento, datos.tipo_documento,
        datos.tipo_documento_otro, datos.tipo_aprendiz, datos.jornada, datos.dias_semana,
        datos.hora_inicio, datos.hora_fin, idAprendiz,
      ]
    )

    const [[actualizado]] = await defaultDb.execute(
      `SELECT ${CAMPOS_APRENDIZ_SELECT}
       FROM Aprendices WHERE id_aprendiz = ?`,
      [idAprendiz]
    )

    // Emitir evento WebSocket para actualización en tiempo real
    try {
      const socketService = (await import('../services/socketService.js')).default;
      socketService.emitToAll('aprendiz:updated', {
        id_aprendiz: idAprendiz,
        timestamp: new Date().toISOString(),
      });
    } catch (socketErr) {
      logger.warn('Error al emitir evento Socket.io', { error: socketErr.message });
    }

    return res.json({ ok: true, aprendiz: actualizado })
  } catch (error) {
    logger.error('Error al actualizar aprendiz', { error: error.message, stack: error.stack })
    return handleControllerError(error, res, 'actualizarAprendiz', 'Error al actualizar aprendiz');
  }
}

export async function eliminarAprendiz(req, res) {
  const { id } = req.params
  const idAprendiz = Number.parseInt(id, 10)

  if (!Number.isFinite(idAprendiz) || idAprendiz <= 0) {
    return res.status(400).json({ error: 'ID de aprendiz inválido' })
  }

  try {
    await ensureAprendicesTable()

    const [resultado] = await defaultDb.execute(
      'DELETE FROM Aprendices WHERE id_aprendiz = ? LIMIT 1',
      [idAprendiz]
    )

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'El aprendiz no existe' })
    }

    // Emitir evento WebSocket para actualización en tiempo real
    try {
      const socketService = (await import('../services/socketService.js')).default;
      socketService.emitToAll('aprendiz:deleted', {
        id_aprendiz: idAprendiz,
        timestamp: new Date().toISOString(),
      });
    } catch (socketErr) {
      logger.warn('Error al emitir evento Socket.io', { error: socketErr.message });
    }

    return res.json({ ok: true })
  } catch (error) {
    logger.error('Error al eliminar aprendiz', { error: error.message, stack: error.stack })
    return handleControllerError(error, res, 'eliminarAprendiz', 'Error al eliminar aprendiz');
  }
}
