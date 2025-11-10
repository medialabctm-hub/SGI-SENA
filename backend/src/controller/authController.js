import db from '../config/dbconfig.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import process from 'process';

// Registro de usuario
export const registerUser = async (req, res) => {
  try {
    const { nombre, cedula, correo, telefono, contrasena, rol } = req.body;
    if (!nombre || !cedula || !correo || !telefono || !contrasena || !rol) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Validar si el usuario ya existe
    const [[usuarioExistente]] = await db.execute(
      'SELECT id_usuario FROM Usuarios WHERE correo = ? OR cedula = ?',
      [correo, cedula]
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
      'INSERT INTO Usuarios (nombre_usuario, cedula, correo, telefono, contrasena, id_rol, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nombre, cedula, correo, telefono, hash, rolRow.id_rol, 'Activo']
    );

    return res.status(201).json({ message: 'Usuario registrado correctamente' });
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
      'SELECT * FROM Usuarios WHERE cedula = ? AND estado = "Activo"',
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
    const token = jwt.sign(
      { id: usuario.id_usuario, rol: usuario.id_rol },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    return res.json({ token, user: { id: usuario.id_usuario, nombre: usuario.nombre_usuario, rol: usuario.id_rol } });
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
