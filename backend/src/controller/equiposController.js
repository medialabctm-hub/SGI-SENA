// Listar ambientes para el formulario
export async function listarAmbientes(req, res) {
  try {
    const [rows] = await defaultDb.execute('SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE estado_ambiente = "Activo"');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ambientes', detalle: err.message });
  }
}
import defaultDb from '../config/dbconfig.js';

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
      specs_completas
    } = req.body;

    // Validación básica
    if (!tipo || !marca || !modelo || !numero_serie || !estado_fisico || !fecha_adquisicion) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Insertar en la tabla Elementos
    const query = `INSERT INTO Elementos
      (tipo, marca, modelo, numero_serie, descripcion, fecha_adquisicion, costo, vida_util_meses, estado_fisico, incluye_mouse, incluye_teclado, incluye_monitor, incluye_torre, specs_completas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
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
