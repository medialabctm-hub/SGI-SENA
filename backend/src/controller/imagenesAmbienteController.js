import defaultDb from '../config/dbconfig.js';
import { logger } from '../utils/logger.js';
import { getImagePath, deleteImageFile } from '../middleware/uploadAmbienteMiddleware.js';

/**
 * Subir una o más imágenes para un ambiente
 */
export async function subirImagenesAmbiente(req, res) {
  try {
    const { idAmbiente } = req.params;
    const files = req.files || (req.file ? [req.file] : []);

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron imágenes' });
    }

    // Verificar que el ambiente existe
    const [[ambiente]] = await defaultDb.execute(
      'SELECT id_ambiente, nombre_ambiente FROM Ambientes WHERE id_ambiente = ?',
      [idAmbiente]
    );

    if (!ambiente) {
      // Eliminar archivos subidos si el ambiente no existe
      files.forEach(file => {
        deleteImageFile(file.filename);
      });
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    const userId = req.user?.id_usuario || req.user?.id;
    const imagenesSubidas = [];

    for (const file of files) {
      const rutaImagen = getImagePath(file.filename);
      const tipoImagen = req.body.tipo_imagen || 'Detalle';
      const descripcion = req.body.descripcion || null;
      const esPrincipal = req.body.es_principal === 'true' || req.body.es_principal === true;

      // Si se marca como principal, desmarcar las demás
      if (esPrincipal) {
        await defaultDb.execute(
          'UPDATE Imagenes_Ambiente SET es_principal = FALSE WHERE id_ambiente = ?',
          [idAmbiente]
        );
      }

      // Insertar en la base de datos
      const [result] = await defaultDb.execute(
        `INSERT INTO Imagenes_Ambiente 
         (id_ambiente, ruta_imagen, nombre_archivo, tipo_imagen, descripcion, es_principal, subida_por)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          idAmbiente,
          rutaImagen,
          file.originalname,
          tipoImagen,
          descripcion,
          esPrincipal,
          userId
        ]
      );

      imagenesSubidas.push({
        id_imagen_ambiente: result.insertId,
        ruta_imagen: rutaImagen,
        nombre_archivo: file.originalname,
        tipo_imagen: tipoImagen,
        es_principal: esPrincipal
      });
    }

    return res.status(201).json({
      message: `${imagenesSubidas.length} imagen(es) subida(s) correctamente`,
      imagenes: imagenesSubidas
    });
  } catch (err) {
    logger.error('Error al subir imágenes de ambiente', { error: err.message, stack: err.stack });
    
    // Eliminar archivos subidos en caso de error
    if (req.files) {
      req.files.forEach(file => {
        deleteImageFile(file.filename);
      });
    } else if (req.file) {
      deleteImageFile(req.file.filename);
    }

    return res.status(500).json({ error: 'Error al subir las imágenes', detalle: err.message });
  }
}

/**
 * Listar todas las imágenes de un ambiente
 */
export async function listarImagenesAmbiente(req, res) {
  try {
    const { idAmbiente } = req.params;

    const [imagenes] = await defaultDb.execute(
      `SELECT 
        id_imagen_ambiente,
        ruta_imagen,
        nombre_archivo,
        tipo_imagen,
        descripcion,
        es_principal,
        fecha_subida,
        subida_por,
        u.nombre_usuario AS subido_por_nombre
       FROM Imagenes_Ambiente
       LEFT JOIN Usuarios u ON subida_por = u.id_usuario
       WHERE id_ambiente = ?
       ORDER BY es_principal DESC, fecha_subida DESC`,
      [idAmbiente]
    );

    return res.json(imagenes);
  } catch (err) {
    logger.error('Error al listar imágenes de ambiente', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al listar las imágenes', detalle: err.message });
  }
}

/**
 * Obtener una imagen específica
 */
export async function obtenerImagenAmbiente(req, res) {
  try {
    const { idImagen } = req.params;

    const [[imagen]] = await defaultDb.execute(
      `SELECT 
        id_imagen_ambiente,
        id_ambiente,
        ruta_imagen,
        nombre_archivo,
        tipo_imagen,
        descripcion,
        es_principal,
        fecha_subida,
        subida_por,
        u.nombre_usuario AS subido_por_nombre
       FROM Imagenes_Ambiente
       LEFT JOIN Usuarios u ON subida_por = u.id_usuario
       WHERE id_imagen_ambiente = ?`,
      [idImagen]
    );

    if (!imagen) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    return res.json(imagen);
  } catch (err) {
    logger.error('Error al obtener imagen de ambiente', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al obtener la imagen', detalle: err.message });
  }
}

/**
 * Actualizar información de una imagen
 */
export async function actualizarImagenAmbiente(req, res) {
  try {
    const { idImagen } = req.params;
    const { tipo_imagen, descripcion, es_principal } = req.body;

    // Verificar que la imagen existe
    const [[imagen]] = await defaultDb.execute(
      'SELECT id_imagen_ambiente, id_ambiente, es_principal FROM Imagenes_Ambiente WHERE id_imagen_ambiente = ?',
      [idImagen]
    );

    if (!imagen) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    const updates = [];
    const params = [];

    if (tipo_imagen) {
      updates.push('tipo_imagen = ?');
      params.push(tipo_imagen);
    }

    if (descripcion !== undefined) {
      updates.push('descripcion = ?');
      params.push(descripcion || null);
    }

    if (es_principal !== undefined) {
      const esPrincipal = es_principal === 'true' || es_principal === true;
      
      // Si se marca como principal, desmarcar las demás del mismo ambiente
      if (esPrincipal) {
        await defaultDb.execute(
          'UPDATE Imagenes_Ambiente SET es_principal = FALSE WHERE id_ambiente = ? AND id_imagen_ambiente != ?',
          [imagen.id_ambiente, idImagen]
        );
      }

      updates.push('es_principal = ?');
      params.push(esPrincipal);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(idImagen);
    await defaultDb.execute(
      `UPDATE Imagenes_Ambiente SET ${updates.join(', ')} WHERE id_imagen_ambiente = ?`,
      params
    );

    return res.json({ message: 'Imagen actualizada correctamente' });
  } catch (err) {
    logger.error('Error al actualizar imagen de ambiente', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al actualizar la imagen', detalle: err.message });
  }
}

/**
 * Marcar una imagen como principal
 */
export async function marcarImagenPrincipal(req, res) {
  try {
    const { idImagen } = req.params;

    // Verificar que la imagen existe
    const [[imagen]] = await defaultDb.execute(
      'SELECT id_imagen_ambiente, id_ambiente FROM Imagenes_Ambiente WHERE id_imagen_ambiente = ?',
      [idImagen]
    );

    if (!imagen) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    // Desmarcar las demás imágenes del mismo ambiente
    await defaultDb.execute(
      'UPDATE Imagenes_Ambiente SET es_principal = FALSE WHERE id_ambiente = ?',
      [imagen.id_ambiente]
    );

    // Marcar esta imagen como principal
    await defaultDb.execute(
      'UPDATE Imagenes_Ambiente SET es_principal = TRUE WHERE id_imagen_ambiente = ?',
      [idImagen]
    );

    return res.json({ message: 'Imagen marcada como principal correctamente' });
  } catch (err) {
    logger.error('Error al marcar imagen como principal', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al marcar la imagen como principal', detalle: err.message });
  }
}

/**
 * Eliminar una imagen
 */
export async function eliminarImagenAmbiente(req, res) {
  try {
    const { idImagen } = req.params;

    // Obtener información de la imagen
    const [[imagen]] = await defaultDb.execute(
      'SELECT id_imagen_ambiente, ruta_imagen, nombre_archivo FROM Imagenes_Ambiente WHERE id_imagen_ambiente = ?',
      [idImagen]
    );

    if (!imagen) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    // Extraer el nombre del archivo de la ruta
    const filename = imagen.ruta_imagen.split('/').pop();

    // Eliminar de la base de datos
    await defaultDb.execute(
      'DELETE FROM Imagenes_Ambiente WHERE id_imagen_ambiente = ?',
      [idImagen]
    );

    // Eliminar archivo físico
    deleteImageFile(filename);

    return res.json({ message: 'Imagen eliminada correctamente' });
  } catch (err) {
    logger.error('Error al eliminar imagen de ambiente', { error: err.message, stack: err.stack });
    return res.status(500).json({ error: 'Error al eliminar la imagen', detalle: err.message });
  }
}

