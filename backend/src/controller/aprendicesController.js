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
          jornada ENUM('Mañana','Tarde','Noche') NULL,
          creado_por INT NULL,
          fecha_creacion DATETIME DEFAULT NOW(),
          FOREIGN KEY (creado_por) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL,
          UNIQUE KEY uk_documento (documento),
          INDEX idx_ficha (ficha),
          INDEX idx_jornada (jornada)
        ) COMMENT = 'Registro de aprendices (no habilitados para iniciar sesión)'
        `
      )
      logger.info('Tabla Aprendices creada correctamente')
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
      `SELECT id_aprendiz, ficha, nombre, documento, jornada, fecha_creacion
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
