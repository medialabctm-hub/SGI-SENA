import defaultDb from '../config/dbconfig.js';

// Listar ambientes para el formulario
export async function listarAmbientes(req, res) {
  try {
    const [rows] = await defaultDb.execute(
      'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE estado_ambiente = "Activo"'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ambientes', detalle: err.message });
  }
}

// Controlador para registrar un nuevo equipo
export async function registrarEquipo(req, res) {
  try {
    const {
      tipo,
      marca,
      modelo,
      numero_serie,
      descripcion,
      fecha_adquisicion,
      costo,
      vida_util_meses,
      estado_fisico,
      incluye_mouse,
      incluye_teclado,
      incluye_monitor,
      incluye_torre,
      specs_completas,
      id_ambiente,
      ambiente
    } = req.body;

    // Validación básica
    if (!tipo || !marca || !modelo || !numero_serie || !estado_fisico || !fecha_adquisicion) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Resolver id_categoria a partir del nombre de categoria (tipo)
    const [[categoria]] = await defaultDb.execute(
      'SELECT id_categoria, es_componente FROM Categorias_Equipo WHERE nombre_categoria = ? LIMIT 1',
      [tipo]
    );
    if (!categoria?.id_categoria) {
      return res.status(400).json({ error: 'Categoría inválida', detalle: 'El campo tipo no coincide con una categoría registrada' });
    }

    // Verificar si la columna id_tipo existe en Elementos (compatibilidad con esquemas antiguos)
    const [[col]] = await defaultDb.execute(
      "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Elementos' AND COLUMN_NAME = 'id_tipo'"
    );
    const usaIdTipo = col?.cnt > 0;
    let idTipo = null;
    if (usaIdTipo) {
      const nombreTipo = categoria.es_componente ? 'Componente Individual' : 'Equipo Completo';
      const [[rowTipo]] = await defaultDb.execute(
        'SELECT id_tipo FROM Tipos_Equipo WHERE nombre_tipo = ? LIMIT 1',
        [nombreTipo]
      );
      if (!rowTipo?.id_tipo) {
        return res.status(400).json({ error: 'Tipo de equipo no configurado', detalle: `No existe registro en Tipos_Equipo para ${nombreTipo}` });
      }
      idTipo = rowTipo.id_tipo;
    }

    // Resolver id_ambiente: aceptar id_ambiente directamente o mapear por codigo/nombre
    let ambienteId = id_ambiente || null;
    if (!ambienteId && ambiente) {
      const [[amb]] = await defaultDb.execute(
        'SELECT id_ambiente FROM Ambientes WHERE id_ambiente = ? OR codigo_ambiente = ? OR nombre_ambiente = ? LIMIT 1',
        [ambiente, ambiente, ambiente]
      );
      ambienteId = amb?.id_ambiente || null;
    }
    if (!ambienteId) {
      return res.status(400).json({ error: 'Ambiente inválido', detalle: 'Se requiere id_ambiente válido' });
    }

    // Insertar en la tabla Elementos (con o sin id_tipo)
    let query;
    let params;
    if (usaIdTipo) {
      query = `INSERT INTO Elementos
        (id_categoria, id_tipo, id_ambiente, tipo, marca, modelo, numero_serie, descripcion, fecha_adquisicion, costo, vida_util_meses, estado_fisico, incluye_mouse, incluye_teclado, incluye_monitor, incluye_torre, specs_completas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [
        categoria.id_categoria,
        idTipo,
        ambienteId,
        tipo,
        marca,
        modelo,
        numero_serie,
        descripcion || null,
        fecha_adquisicion,
        costo || null,
        vida_util_meses || null,
        estado_fisico,
        !!incluye_mouse,
        !!incluye_teclado,
        !!incluye_monitor,
        !!incluye_torre,
        specs_completas || null
      ];
    } else {
      query = `INSERT INTO Elementos
        (id_categoria, id_ambiente, tipo, marca, modelo, numero_serie, descripcion, fecha_adquisicion, costo, vida_util_meses, estado_fisico, incluye_mouse, incluye_teclado, incluye_monitor, incluye_torre, specs_completas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [
        categoria.id_categoria,
        ambienteId,
        tipo,
        marca,
        modelo,
        numero_serie,
        descripcion || null,
        fecha_adquisicion,
        costo || null,
        vida_util_meses || null,
        estado_fisico,
        !!incluye_mouse,
        !!incluye_teclado,
        !!incluye_monitor,
        !!incluye_torre,
        specs_completas || null
      ];
    }
    const [result] = await defaultDb.execute(query, params);
    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'El número de serie ya existe' });
    } else {
      res.status(500).json({ error: 'Error al registrar equipo', detalle: err.message });
    }
  }
}

// Consultar equipo por código
export async function obtenerEquipoPorCodigo(req, res) {
  try {
    const { codigo } = req.params;
    if (!codigo) return res.status(400).json({ error: 'codigo requerido' });

    const query = `
      SELECT e.codigo_equipo, e.tipo, e.marca, e.modelo, e.numero_serie, e.descripcion,
             e.fecha_adquisicion, e.costo, e.vida_util_meses, e.estado_fisico,
             e.incluye_mouse, e.incluye_teclado, e.incluye_monitor, e.incluye_torre,
             e.specs_completas,
             a.id_ambiente, a.nombre_ambiente, a.codigo_ambiente
      FROM Elementos e
      LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
      WHERE e.codigo_equipo = ?
    `;
    const [[row]] = await defaultDb.execute(query, [codigo]);
    if (!row) return res.status(404).json({ error: 'Equipo no encontrado' });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar equipo', detalle: err.message });
  }
}
