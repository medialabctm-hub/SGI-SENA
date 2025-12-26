import defaultDb from '../config/dbconfig.js'
import { logger } from '../utils/logger.js'

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
          jornada ENUM('Mañana','Tarde','Noche') NULL,
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
      // Verificar si las columnas tipo_documento existen, si no, agregarlas
      try {
        const [[colExists]] = await defaultDb.execute(
          `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'Aprendices'
           AND COLUMN_NAME = 'tipo_documento'`
        )
        
        if (colExists.cnt === 0) {
          await defaultDb.execute(
            `ALTER TABLE Aprendices
             ADD COLUMN tipo_documento ENUM('TI', 'CC', 'CE', 'PPT', 'Otro') DEFAULT 'CC' 
             COMMENT 'Tipo de documento de identidad'
             AFTER documento`
          )
          await defaultDb.execute(
            `ALTER TABLE Aprendices
             ADD COLUMN tipo_documento_otro VARCHAR(50) NULL 
             COMMENT 'Especificación cuando tipo_documento es "Otro"'
             AFTER tipo_documento`
          )
          await defaultDb.execute(
            `ALTER TABLE Aprendices
             ADD INDEX idx_tipo_documento (tipo_documento)`
          )
          await defaultDb.execute(
            `UPDATE Aprendices SET tipo_documento = 'CC' WHERE tipo_documento IS NULL`
          )
          logger.info('Columnas tipo_documento agregadas a tabla Aprendices existente')
        }
      } catch (migError) {
        logger.warn('Error al verificar/agregar columnas tipo_documento en Aprendices', { error: migError.message })
      }
    }
  } catch (error) {
    logger.error('Error al asegurar la tabla Aprendices', { error: error.message })
    throw error
  }
}

export async function listarAprendices(req, res) {
  try {
    await ensureAprendicesTable()

    const [rows] = await defaultDb.execute(
      `SELECT id_aprendiz, ficha, nombre, documento, tipo_documento, tipo_documento_otro, jornada, fecha_creacion
       FROM Aprendices
       ORDER BY fecha_creacion DESC`
    )

    return res.json({
      ok: true,
      aprendices: rows,
    })
  } catch (error) {
    logger.error('Error al listar aprendices', { error: error.message, stack: error.stack })
    return res.status(500).json({
      error: 'Error al obtener aprendices',
      detalle: error.message,
    })
  }
}

const JORNADAS_VALIDAS = ['Mañana', 'Tarde', 'Noche']

export async function actualizarAprendiz(req, res) {
  const { id } = req.params
  const idAprendiz = Number.parseInt(id, 10)
  const { ficha = null, nombre, documento, tipo_documento = 'CC', tipo_documento_otro = null, jornada = null } = req.body || {}

  if (!Number.isFinite(idAprendiz) || idAprendiz <= 0) {
    return res.status(400).json({ error: 'ID de aprendiz inválido' })
  }

  const nombreNormalizado = typeof nombre === 'string' ? nombre.trim() : ''
  const documentoNormalizado = typeof documento === 'string' ? documento.trim() : ''
  const fichaNormalizada = typeof ficha === 'string' ? ficha.trim() : null
  const jornadaNormalizada = typeof jornada === 'string' && jornada.trim() ? jornada.trim() : null
  const tipoDocumentoNormalizado = typeof tipo_documento === 'string' ? tipo_documento.trim() : 'CC'
  const tipoDocumentoOtroNormalizado = tipo_documento === 'Otro' && tipo_documento_otro 
    ? (typeof tipo_documento_otro === 'string' ? tipo_documento_otro.trim() : null)
    : null

  const TIPOS_DOCUMENTO_VALIDOS = ['TI', 'CC', 'CE', 'PPT', 'Otro']
  if (!TIPOS_DOCUMENTO_VALIDOS.includes(tipoDocumentoNormalizado)) {
    return res.status(400).json({
      error: 'Tipo de documento inválido',
      detalle: `Los tipos permitidos son: ${TIPOS_DOCUMENTO_VALIDOS.join(', ')}`,
    })
  }

  if (tipoDocumentoNormalizado === 'Otro' && (!tipoDocumentoOtroNormalizado || tipoDocumentoOtroNormalizado.length === 0)) {
    return res.status(400).json({
      error: 'Debe especificar el tipo de documento cuando selecciona "Otro"',
    })
  }

  if (!nombreNormalizado || !documentoNormalizado) {
    return res.status(400).json({ error: 'Nombre y documento son obligatorios' })
  }

  if (jornadaNormalizada && !JORNADAS_VALIDAS.includes(jornadaNormalizada)) {
    return res.status(400).json({
      error: 'Jornada inválida',
      detalle: `Las jornadas permitidas son: ${JORNADAS_VALIDAS.join(', ')}`,
    })
  }

  try {
    await ensureAprendicesTable()

    const [[existe]] = await defaultDb.execute(
      'SELECT id_aprendiz FROM Aprendices WHERE id_aprendiz = ? LIMIT 1',
      [idAprendiz]
    )

    if (!existe) {
      return res.status(404).json({ error: 'El aprendiz no existe' })
    }

    const [[duplicado]] = await defaultDb.execute(
      'SELECT id_aprendiz FROM Aprendices WHERE documento = ? AND id_aprendiz <> ? LIMIT 1',
      [documentoNormalizado, idAprendiz]
    )

    if (duplicado) {
      return res.status(409).json({ error: 'El documento ya está registrado en otro aprendiz' })
    }

    await defaultDb.execute(
      `UPDATE Aprendices
       SET ficha = ?, nombre = ?, documento = ?, tipo_documento = ?, tipo_documento_otro = ?, jornada = ?
       WHERE id_aprendiz = ?`,
      [fichaNormalizada || null, nombreNormalizado, documentoNormalizado, tipoDocumentoNormalizado, tipoDocumentoOtroNormalizado, jornadaNormalizada, idAprendiz]
    )

    const [[actualizado]] = await defaultDb.execute(
      `SELECT id_aprendiz, ficha, nombre, documento, tipo_documento, tipo_documento_otro, jornada, fecha_creacion
       FROM Aprendices WHERE id_aprendiz = ?`,
      [idAprendiz]
    )

    return res.json({ ok: true, aprendiz: actualizado })
  } catch (error) {
    logger.error('Error al actualizar aprendiz', { error: error.message, stack: error.stack })
    return res.status(500).json({ error: 'Error al actualizar aprendiz', detalle: error.message })
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

    return res.json({ ok: true })
  } catch (error) {
    logger.error('Error al eliminar aprendiz', { error: error.message, stack: error.stack })
    return res.status(500).json({ error: 'Error al eliminar aprendiz', detalle: error.message })
  }
}
