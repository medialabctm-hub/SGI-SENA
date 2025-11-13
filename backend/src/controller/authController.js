import db from '../config/dbconfig.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import process from 'process';

// Registro de usuario
export const registerUser = async (req, res) => {
  try {
    const { nombre, cedula, correo, telefono, contrasena, rol } = req.body;
    const area = (req.body.area ?? req.body.area_usuarios ?? '').toString().trim();
    const correoNorm = (correo || '').toString().trim().toLowerCase();
    if (!nombre || !cedula || !correoNorm || !telefono || !contrasena || !rol) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Validar si el usuario ya existe
    const [[usuarioExistente]] = await db.execute(
      'SELECT id_usuario FROM Usuarios WHERE LOWER(TRIM(correo)) = ? OR cedula = ?',
      [correoNorm, cedula]
    );
    if (usuarioExistente) {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }

    // Buscar id_rol
    const [[rolRow]] = await db.execute(
      'SELECT id_rol FROM Roles WHERE nombre_rol = ?',
      [rol]
    );
    if (!rolRow) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Encriptar contraseña
    const hash = await bcrypt.hash(contrasena, 10);

    // Insertar usuario
    await db.execute(
      'INSERT INTO Usuarios (nombre_usuario, cedula, correo, telefono, area_usuarios, contrasena, id_rol, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nombre, cedula, correoNorm, telefono, area || null, hash, rolRow.id_rol, 'Activo']
    );

    return res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (err) {
    return res.status(500).json({ error: 'Error en el servidor', details: err.message });
  }
};

// Perfil del usuario autenticado
// NOTA: Esta función usa req.user que ya está disponible gracias al middleware authenticate
// La verificación del token ya se hace en authMiddleware.js, no es necesario duplicarla aquí
export const me = async (req, res) => {
  try {
    // req.user ya está disponible gracias al middleware authenticate
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const [[user]] = await db.execute(
      `SELECT u.id_usuario, u.nombre_usuario, u.correo, u.telefono, u.cedula, u.area_usuarios AS area, r.nombre_rol
       FROM Usuarios u
       LEFT JOIN Roles r ON r.id_rol = u.id_rol
       WHERE u.id_usuario = ? AND u.estado = "Activo"`,
      [req.user.id]
    );

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.json({
      user: {
        id_usuario: user.id_usuario,
        nombre_usuario: user.nombre_usuario,
        correo: user.correo,
        telefono: user.telefono,
        cedula: user.cedula,
        area: user.area,
        nombre_rol: user.nombre_rol,
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error en el servidor', details: err.message });
  }
};

// Login de usuario (por cédula y contraseña)
export const loginUser = async (req, res) => {
  try {
    const { cedula, contrasena } = req.body;
    if (!cedula || !contrasena) {
      return res.status(400).json({ error: 'Cédula y contraseña requeridas' });
    }

    const [[usuario]] = await db.execute(
      `SELECT u.*, u.area_usuarios AS area, r.nombre_rol
       FROM Usuarios u
       LEFT JOIN Roles r ON r.id_rol = u.id_rol
       WHERE u.cedula = ? AND u.estado = "Activo"`,
      [cedula]
    );
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'JWT_SECRET no configurado' });
    const token = jwt.sign(
      { id: usuario.id_usuario, rol: usuario.id_rol },
      secret,
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id_usuario: usuario.id_usuario,
        nombre_usuario: usuario.nombre_usuario,
        correo: usuario.correo,
        telefono: usuario.telefono,
        cedula: usuario.cedula,
        nombre_rol: usuario.nombre_rol,
        area: usuario.area,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error en el servidor', details: err.message });
  }
};

// Eliminar usuario (borrado lógico)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    const [result] = await db.execute(
      'UPDATE Usuarios SET estado = "Inactivo" WHERE id_usuario = ?',
      [id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.json({ message: 'Usuario eliminado correctamente' });
  } catch (err) {
    return res.status(500).json({ error: 'Error en el servidor', details: err.message });
  }
};

// Actualizar usuario
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, cedula, correo, telefono, rol } = req.body;

    if (!id) return res.status(400).json({ error: 'ID requerido' });
    if (!nombre || !cedula || !correo || !telefono || !rol) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Buscar id_rol
    const [[rolRow]] = await db.execute(
      'SELECT id_rol FROM Roles WHERE nombre_rol = ?',
      [rol]
    );
    if (!rolRow) return res.status(400).json({ error: 'Rol inválido' });

    // Actualizar usuario
    const [result] = await db.execute(
      'UPDATE Usuarios SET nombre_usuario=?, cedula=?, correo=?, telefono=?, id_rol=? WHERE id_usuario=?',
      [nombre, cedula, correo, telefono, rolRow.id_rol, id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.json({ message: 'Usuario actualizado correctamente' });
  } catch (err) {
    return res.status(500).json({ error: 'Error en el servidor', details: err.message });
  }
};

// Listar usuarios activos con número de equipos asignados
export const listUsers = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.correo, u.telefono,
              u.area_usuarios AS area, r.nombre_rol,
              (SELECT COUNT(*) FROM Responsables_Equipo re WHERE re.id_usuario = u.id_usuario AND re.estado_responsabilidad = 'Activo') AS equipos_asignados
       FROM Usuarios u
       LEFT JOIN Roles r ON r.id_rol = u.id_rol
       WHERE u.estado = 'Activo'
       ORDER BY u.nombre_usuario`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Error al listar usuarios', details: err.message });
  }
};

// Obtener detalle de un usuario y los equipos asignados activos
export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    const [[user]] = await db.execute(
      `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.correo, u.telefono, u.area_usuarios AS area, r.nombre_rol
       FROM Usuarios u
       LEFT JOIN Roles r ON r.id_rol = u.id_rol
       WHERE u.id_usuario = ? AND u.estado = 'Activo'`,
      [id]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const [equipos] = await db.execute(
      `SELECT e.codigo_equipo, e.numero_serie, e.tipo, e.marca, e.modelo, ee.estado_operativo,
              a.nombre_ambiente, a.codigo_ambiente, re.fecha_asignacion,
              re.tipo_responsabilidad, DATEDIFF(NOW(), re.fecha_asignacion) AS dias_asignado
       FROM Responsables_Equipo re
       INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
       LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
       LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
       WHERE re.id_usuario = ? AND re.estado_responsabilidad = 'Activo'
       ORDER BY re.fecha_asignacion DESC`,
      [id]
    );

    return res.json({ user, equipos });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener detalle', details: err.message });
  }
};

// Buscar usuario por cédula
export const getUserByCedula = async (req, res) => {
  try {
    const { cedula } = req.params;
    if (!cedula) return res.status(400).json({ error: 'Cédula requerida' });

    const [[user]] = await db.execute(
      `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.correo, u.telefono,
              u.area_usuarios AS area, r.nombre_rol,
              (SELECT COUNT(*) FROM Responsables_Equipo re WHERE re.id_usuario = u.id_usuario AND re.estado_responsabilidad = 'Activo') AS equipos_asignados
       FROM Usuarios u
       LEFT JOIN Roles r ON r.id_rol = u.id_rol
       WHERE u.cedula = ? AND u.estado = 'Activo'`,
      [cedula]
    );

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Error al buscar usuario', details: err.message });
  }
};