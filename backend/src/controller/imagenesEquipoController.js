import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { getImagePath, deleteImageFile } from '../middleware/uploadMiddleware.js';

/**
 * Subir una o múltiples imágenes para un equipo
 */
export async function subirImagenesEquipo(req, res, next) {
  try {
    const { codigoEquipo } = req.params;
    const { tipo_imagen, descripcion, es_principal } = req.body;
    const files = req.files || (req.file ? [req.file] : []);
    const userId = req.user?.id_usuario ?? null;

    if (!codigoEquipo) {
      return res.status(400).json({ error: 'El código del equipo es requerido' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron archivos para subir' });
    }

    // Verificar que el equipo existe
    const [[equipo]] = await defaultDb.execute(
      'SELECT codigo_equipo FROM Elementos WHERE codigo_equipo = ?',
      [codigoEquipo]
    );

    if (!equipo) {
      // Eliminar archivos subidos si el equipo no existe
      files.forEach((file) => {
        deleteImageFile(file.filename);
      });
      throw new NotFoundError('Equipo');
    }

    const imagenesSubidas = [];
    const codigoEquipoNum = parseInt(codigoEquipo, 10);

    if (isNaN(codigoEquipoNum)) {
      return res.status(400).json({ error: 'Código de equipo inválido' });
    }

    const esPrincipal = es_principal === 'true' || es_principal === true;

    // Estrategia: Insertar primero con es_principal = 0 para evitar el conflicto del trigger
    // Luego, si se debe marcar como principal, actualizar después del INSERT
    for (const file of files) {
      if (!file || !file.filename) {
        logger.warn('Archivo inválido en la subida de imágenes', { file });
        continue;
      }

      const rutaImagen = getImagePath(file.filename);
      const tipoImagen = tipo_imagen || 'Detalle';

      // Insertar siempre con es_principal = 0 primero para evitar el conflicto del trigger
      const [result] = await defaultDb.execute(
        `INSERT INTO Imagenes_Equipo 
         (codigo_equipo, ruta_imagen, nombre_archivo, tipo_imagen, descripcion, subida_por, es_principal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          codigoEquipoNum,
          rutaImagen,
          file.filename,
          tipoImagen,
          descripcion || null,
          userId,
          0, // Siempre insertar como 0 primero
        ]
      );

      const idImagenInsertada = result.insertId;

      // Si se debe marcar como principal, hacerlo DESPUÉS del INSERT
      // Primero desmarcar todas las demás, luego marcar esta
      if (esPrincipal && idImagenInsertada) {
        // Desmarcar todas las imágenes principales del equipo
        await defaultDb.execute(
          'UPDATE Imagenes_Equipo SET es_principal = FALSE WHERE codigo_equipo = ? AND id_imagen_equipo != ?',
          [codigoEquipoNum, idImagenInsertada]
        );
        
        // Marcar esta imagen como principal
        await defaultDb.execute(
          'UPDATE Imagenes_Equipo SET es_principal = TRUE WHERE id_imagen_equipo = ?',
          [idImagenInsertada]
        );
      }

      imagenesSubidas.push({
        id_imagen_equipo: idImagenInsertada,
        codigo_equipo: codigoEquipoNum,
        ruta_imagen: rutaImagen,
        nombre_archivo: file.filename,
        tipo_imagen: tipoImagen,
        descripcion: descripcion || null,
        es_principal: esPrincipal,
      });
    }

    logger.info(`Imágenes subidas para equipo ${codigoEquipo}`, {
      cantidad: imagenesSubidas.length,
      usuario: userId,
    });

    return res.status(201).json({
      message: `${imagenesSubidas.length} imagen(es) subida(s) correctamente`,
      imagenes: imagenesSubidas,
    });
  } catch (error) {
    // Eliminar archivos subidos en caso de error
    if (req.files) {
      req.files.forEach((file) => {
        deleteImageFile(file.filename);
      });
    } else if (req.file) {
      deleteImageFile(req.file.filename);
    }

    return next(error);
  }
}

/**
 * Listar todas las imágenes de un equipo
 */
export async function listarImagenesEquipo(req, res, next) {
  try {
    const { codigoEquipo } = req.params;

    if (!codigoEquipo) {
      throw new ValidationError('El código del equipo es requerido');
    }

    const [imagenes] = await defaultDb.execute(
      `SELECT 
        id_imagen_equipo,
        codigo_equipo,
        ruta_imagen,
        nombre_archivo,
        tipo_imagen,
        descripcion,
        fecha_subida,
        subida_por,
        es_principal
      FROM Imagenes_Equipo
      WHERE codigo_equipo = ?
      ORDER BY es_principal DESC, fecha_subida DESC`,
      [codigoEquipo]
    );

    return res.json({
      codigo_equipo: parseInt(codigoEquipo, 10),
      total: imagenes.length,
      imagenes,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Obtener una imagen específica
 */
export async function obtenerImagenEquipo(req, res, next) {
  try {
    const { idImagen } = req.params;

    const [[imagen]] = await defaultDb.execute(
      `SELECT 
        id_imagen_equipo,
        codigo_equipo,
        ruta_imagen,
        nombre_archivo,
        tipo_imagen,
        descripcion,
        fecha_subida,
        subida_por,
        es_principal
      FROM Imagenes_Equipo
      WHERE id_imagen_equipo = ?`,
      [idImagen]
    );

    if (!imagen) {
      throw new NotFoundError('Imagen');
    }

    return res.json(imagen);
  } catch (error) {
    return next(error);
  }
}

/**
 * Eliminar una imagen
 */
export async function eliminarImagenEquipo(req, res, next) {
  try {
    const { idImagen } = req.params;
    const userId = req.user?.id_usuario;

    // Obtener información de la imagen
    const [[imagen]] = await defaultDb.execute(
      'SELECT nombre_archivo, codigo_equipo FROM Imagenes_Equipo WHERE id_imagen_equipo = ?',
      [idImagen]
    );

    if (!imagen) {
      throw new NotFoundError('Imagen');
    }

    // Eliminar de la base de datos
    await defaultDb.execute('DELETE FROM Imagenes_Equipo WHERE id_imagen_equipo = ?', [idImagen]);

    // Eliminar archivo físico
    deleteImageFile(imagen.nombre_archivo);

    logger.info(`Imagen eliminada`, {
      id_imagen: idImagen,
      codigo_equipo: imagen.codigo_equipo,
      usuario: userId,
    });

    return res.json({
      message: 'Imagen eliminada correctamente',
      id_imagen_equipo: parseInt(idImagen, 10),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Marcar una imagen como principal
 */
export async function marcarImagenPrincipal(req, res, next) {
  try {
    const { idImagen } = req.params;
    const userId = req.user?.id_usuario;

    // Obtener información de la imagen
    const [[imagen]] = await defaultDb.execute(
      'SELECT codigo_equipo FROM Imagenes_Equipo WHERE id_imagen_equipo = ?',
      [idImagen]
    );

    if (!imagen) {
      throw new NotFoundError('Imagen');
    }

    // Desmarcar todas las imágenes principales del equipo
    await defaultDb.execute(
      'UPDATE Imagenes_Equipo SET es_principal = FALSE WHERE codigo_equipo = ?',
      [imagen.codigo_equipo]
    );

    // Marcar la imagen seleccionada como principal
    await defaultDb.execute(
      'UPDATE Imagenes_Equipo SET es_principal = TRUE WHERE id_imagen_equipo = ?',
      [idImagen]
    );

    logger.info(`Imagen marcada como principal`, {
      id_imagen: idImagen,
      codigo_equipo: imagen.codigo_equipo,
      usuario: userId,
    });

    return res.json({
      message: 'Imagen marcada como principal correctamente',
      id_imagen_equipo: parseInt(idImagen, 10),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Actualizar información de una imagen
 */
export async function actualizarImagenEquipo(req, res, next) {
  try {
    const { idImagen } = req.params;
    const { tipo_imagen, descripcion } = req.body;

    // Verificar que la imagen existe
    const [[imagen]] = await defaultDb.execute(
      'SELECT id_imagen_equipo FROM Imagenes_Equipo WHERE id_imagen_equipo = ?',
      [idImagen]
    );

    if (!imagen) {
      throw new NotFoundError('Imagen');
    }

    // Construir query dinámicamente
    const updates = [];
    const values = [];

    if (tipo_imagen) {
      updates.push('tipo_imagen = ?');
      values.push(tipo_imagen);
    }

    if (descripcion !== undefined) {
      updates.push('descripcion = ?');
      values.push(descripcion);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }

    values.push(idImagen);

    await defaultDb.execute(
      `UPDATE Imagenes_Equipo SET ${updates.join(', ')} WHERE id_imagen_equipo = ?`,
      values
    );

    // Obtener la imagen actualizada
    const [[imagenActualizada]] = await defaultDb.execute(
      `SELECT 
        id_imagen_equipo,
        codigo_equipo,
        ruta_imagen,
        nombre_archivo,
        tipo_imagen,
        descripcion,
        fecha_subida,
        subida_por,
        es_principal
      FROM Imagenes_Equipo
      WHERE id_imagen_equipo = ?`,
      [idImagen]
    );

    return res.json({
      message: 'Imagen actualizada correctamente',
      imagen: imagenActualizada,
    });
  } catch (error) {
    return next(error);
  }
}

