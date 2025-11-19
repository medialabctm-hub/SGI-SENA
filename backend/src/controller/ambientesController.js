import defaultDb from '../config/dbconfig.js';

/**
 * Listar todos los ambientes con filtros opcionales
 */
export async function listarAmbientes(req, res) {
  try {
    const { estado_ambiente, tipo_ambiente, edificio, piso } = req.query;

    let query = `
      SELECT 
        a.id_ambiente,
        a.codigo_ambiente,
        a.nombre_ambiente,
        a.tipo_ambiente,
        a.capacidad_personas,
        a.piso,
        a.edificio,
        a.descripcion,
        a.estado_ambiente,
        a.fecha_creacion,
        COUNT(DISTINCT e.codigo_equipo) AS total_equipos,
        COUNT(DISTINCT CASE WHEN ee.estado_operativo = 'Disponible' THEN e.codigo_equipo END) AS equipos_disponibles
      FROM Ambientes a
      LEFT JOIN Elementos e ON a.id_ambiente = e.id_ambiente
      LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
      WHERE 1=1
    `;

    const params = [];

    if (estado_ambiente) {
      query += ' AND a.estado_ambiente = ?';
      params.push(estado_ambiente);
    }

    if (tipo_ambiente) {
      query += ' AND a.tipo_ambiente = ?';
      params.push(tipo_ambiente);
    }

    if (edificio) {
      query += ' AND a.edificio = ?';
      params.push(edificio);
    }

    if (piso) {
      query += ' AND a.piso = ?';
      params.push(piso);
    }

    query += ' GROUP BY a.id_ambiente ORDER BY a.codigo_ambiente ASC';

    const [rows] = await defaultDb.execute(query, params);
    return res.json(rows);
  } catch (err) {
    console.error('Error al listar ambientes:', err);
    return res.status(500).json({ error: 'Error al listar ambientes', detalle: err.message });
  }
}

/**
 * Obtener un ambiente específico por ID
 */
export async function obtenerAmbiente(req, res) {
  try {
    const { id } = req.params;

    const [[ambiente]] = await defaultDb.execute(
      `SELECT 
        a.*,
        COUNT(DISTINCT e.codigo_equipo) AS total_equipos,
        COUNT(DISTINCT CASE WHEN ee.estado_operativo = 'Disponible' THEN e.codigo_equipo END) AS equipos_disponibles,
        COUNT(DISTINCT CASE WHEN ee.estado_operativo = 'En Uso' THEN e.codigo_equipo END) AS equipos_en_uso,
        COUNT(DISTINCT CASE WHEN ee.estado_operativo = 'En Mantenimiento' THEN e.codigo_equipo END) AS equipos_en_mantenimiento
       FROM Ambientes a
       LEFT JOIN Elementos e ON a.id_ambiente = e.id_ambiente
       LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
       WHERE a.id_ambiente = ?
       GROUP BY a.id_ambiente`,
      [id]
    );

    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    // Obtener equipos del ambiente
    const [equipos] = await defaultDb.execute(
      `SELECT 
        e.codigo_equipo,
        e.codigo_inventario,
        e.tipo,
        e.marca,
        e.modelo,
        e.numero_serie,
        ee.estado_operativo,
        e.estado_fisico
       FROM Elementos e
       LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
       WHERE e.id_ambiente = ?
       ORDER BY e.tipo, e.marca, e.modelo`,
      [id]
    );

    // Obtener responsables actuales del ambiente (si hay clases activas)
    const [responsables] = await defaultDb.execute(
      `SELECT 
        ra.id_responsabilidad_ambiente,
        ra.id_usuario,
        u.nombre_usuario,
        r.nombre_rol,
        ra.tipo_responsabilidad,
        ra.fecha_inicio,
        ra.fecha_fin,
        c.nombre_clase,
        c.id_clase
       FROM Responsabilidades_Ambiente ra
       INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
       LEFT JOIN Roles r ON u.id_rol = r.id_rol
       LEFT JOIN Clases c ON ra.id_clase = c.id_clase
       WHERE ra.id_ambiente = ?
       AND ra.estado_responsabilidad = 'Activa'
       AND ra.fecha_inicio <= NOW()
       AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW())
       ORDER BY ra.tipo_responsabilidad DESC, ra.fecha_inicio DESC`,
      [id]
    );

    return res.json({
      ...ambiente,
      equipos,
      responsables_actuales: responsables
    });
  } catch (err) {
    console.error('Error al obtener ambiente:', err);
    return res.status(500).json({ error: 'Error al obtener el ambiente', detalle: err.message });
  }
}

/**
 * Crear un nuevo ambiente
 */
export async function crearAmbiente(req, res) {
  try {
    const {
      codigo_ambiente,
      nombre_ambiente,
      tipo_ambiente,
      capacidad_personas,
      piso,
      edificio,
      descripcion,
      estado_ambiente = 'Activo'
    } = req.body;

    // Validaciones
    if (!codigo_ambiente || !nombre_ambiente || !tipo_ambiente) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios',
        detalle: 'Se requieren: codigo_ambiente, nombre_ambiente, tipo_ambiente'
      });
    }

    // Validar que el código de ambiente sea único
    const [[codigoExistente]] = await defaultDb.execute(
      'SELECT id_ambiente FROM Ambientes WHERE codigo_ambiente = ? LIMIT 1',
      [codigo_ambiente]
    );

    if (codigoExistente) {
      return res.status(409).json({ error: 'El código de ambiente ya existe' });
    }

    // Validar tipo_ambiente
    const tiposValidos = ['Laboratorio', 'Aula', 'Taller', 'Oficina', 'Bodega'];
    if (!tiposValidos.includes(tipo_ambiente)) {
      return res.status(400).json({
        error: 'Tipo de ambiente inválido',
        detalle: `Los tipos válidos son: ${tiposValidos.join(', ')}`
      });
    }

    // Validar estado_ambiente
    const estadosValidos = ['Activo', 'Inactivo', 'En Mantenimiento'];
    if (!estadosValidos.includes(estado_ambiente)) {
      return res.status(400).json({
        error: 'Estado de ambiente inválido',
        detalle: `Los estados válidos son: ${estadosValidos.join(', ')}`
      });
    }

    // Insertar el ambiente
    const [result] = await defaultDb.execute(
      `INSERT INTO Ambientes 
       (codigo_ambiente, nombre_ambiente, tipo_ambiente, capacidad_personas, piso, edificio, descripcion, estado_ambiente)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo_ambiente,
        nombre_ambiente,
        tipo_ambiente,
        capacidad_personas || null,
        piso || null,
        edificio || null,
        descripcion || null,
        estado_ambiente
      ]
    );

    return res.status(201).json({
      ok: true,
      id_ambiente: result.insertId,
      message: 'Ambiente creado correctamente',
      ambiente: {
        id_ambiente: result.insertId,
        codigo_ambiente,
        nombre_ambiente,
        tipo_ambiente,
        estado_ambiente
      }
    });
  } catch (err) {
    console.error('Error al crear ambiente:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El código de ambiente ya existe' });
    }
    return res.status(500).json({ error: 'Error al crear el ambiente', detalle: err.message });
  }
}

/**
 * Actualizar un ambiente existente
 */
export async function actualizarAmbiente(req, res) {
  try {
    const { id } = req.params;
    const {
      codigo_ambiente,
      nombre_ambiente,
      tipo_ambiente,
      capacidad_personas,
      piso,
      edificio,
      descripcion,
      estado_ambiente
    } = req.body;

    // Validar que el ambiente existe
    const [[ambiente]] = await defaultDb.execute(
      'SELECT id_ambiente FROM Ambientes WHERE id_ambiente = ?',
      [id]
    );

    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    // Validar código único si se está cambiando
    if (codigo_ambiente) {
      const [[codigoExistente]] = await defaultDb.execute(
        'SELECT id_ambiente FROM Ambientes WHERE codigo_ambiente = ? AND id_ambiente != ? LIMIT 1',
        [codigo_ambiente, id]
      );

      if (codigoExistente) {
        return res.status(409).json({ error: 'El código de ambiente ya está en uso' });
      }
    }

    // Validar tipo_ambiente si se proporciona
    if (tipo_ambiente) {
      const tiposValidos = ['Laboratorio', 'Aula', 'Taller', 'Oficina', 'Bodega'];
      if (!tiposValidos.includes(tipo_ambiente)) {
        return res.status(400).json({
          error: 'Tipo de ambiente inválido',
          detalle: `Los tipos válidos son: ${tiposValidos.join(', ')}`
        });
      }
    }

    // Validar estado_ambiente si se proporciona
    if (estado_ambiente) {
      const estadosValidos = ['Activo', 'Inactivo', 'En Mantenimiento'];
      if (!estadosValidos.includes(estado_ambiente)) {
        return res.status(400).json({
          error: 'Estado de ambiente inválido',
          detalle: `Los estados válidos son: ${estadosValidos.join(', ')}`
        });
      }
    }

    // Construir query de actualización
    const allowed = [
      'codigo_ambiente',
      'nombre_ambiente',
      'tipo_ambiente',
      'capacidad_personas',
      'piso',
      'edificio',
      'descripcion',
      'estado_ambiente'
    ];

    const sets = [];
    const params = [];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        sets.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Sin cambios para actualizar' });
    }

    params.push(id);
    const query = `UPDATE Ambientes SET ${sets.join(', ')} WHERE id_ambiente = ?`;
    const [result] = await defaultDb.execute(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    return res.json({ ok: true, message: 'Ambiente actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar ambiente:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El código de ambiente ya está en uso' });
    }
    return res.status(500).json({ error: 'Error al actualizar el ambiente', detalle: err.message });
  }
}

/**
 * Eliminar un ambiente (solo si no tiene equipos asignados)
 */
export async function eliminarAmbiente(req, res) {
  try {
    const { id } = req.params;

    // Validar que el ambiente existe
    const [[ambiente]] = await defaultDb.execute(
      'SELECT id_ambiente, codigo_ambiente, nombre_ambiente FROM Ambientes WHERE id_ambiente = ?',
      [id]
    );

    if (!ambiente) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    // Verificar si tiene equipos asignados
    const [[equiposCount]] = await defaultDb.execute(
      'SELECT COUNT(*) AS total FROM Elementos WHERE id_ambiente = ?',
      [id]
    );

    if (equiposCount.total > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar el ambiente',
        detalle: `El ambiente tiene ${equiposCount.total} equipo(s) asignado(s). Debe mover o eliminar los equipos primero.`
      });
    }

    // Verificar si tiene clases programadas o en curso
    const [[clasesCount]] = await defaultDb.execute(
      `SELECT COUNT(*) AS total FROM Clases 
       WHERE id_ambiente = ? 
       AND estado_clase IN ('Programada', 'En Curso')`,
      [id]
    );

    if (clasesCount.total > 0) {
      return res.status(409).json({
        error: 'No se puede eliminar el ambiente',
        detalle: `El ambiente tiene ${clasesCount.total} clase(s) programada(s) o en curso. Debe cancelar o finalizar las clases primero.`
      });
    }

    // Eliminar el ambiente
    const [result] = await defaultDb.execute(
      'DELETE FROM Ambientes WHERE id_ambiente = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    return res.json({
      ok: true,
      message: 'Ambiente eliminado correctamente'
    });
  } catch (err) {
    console.error('Error al eliminar ambiente:', err);
    return res.status(500).json({ error: 'Error al eliminar el ambiente', detalle: err.message });
  }
}

/**
 * Listar ambientes activos (versión simplificada para formularios)
 */
export async function listarAmbientesActivos(req, res) {
  try {
    const [rows] = await defaultDb.execute(
      'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE estado_ambiente = "Activo" ORDER BY codigo_ambiente ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ambientes', detalle: err.message });
  }
}

