import jwt from 'jsonwebtoken'
import process from 'process'
import defaultDb from '../config/dbconfig.js'

/**
 * Middleware de autenticación JWT
 * Valida el token y adjunta información completa del usuario al request
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'No autorizado' })
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado' })
    }

    try {
      const payload = jwt.verify(token, secret)
      
      // Obtener información completa del usuario desde la BD
      // Esto incluye el nombre del rol para las validaciones RBAC
      const [[user]] = await defaultDb.execute(
        `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.correo, 
                u.id_rol, r.nombre_rol
         FROM Usuarios u
         LEFT JOIN Roles r ON r.id_rol = u.id_rol
         WHERE u.id_usuario = ? AND u.estado = 'Activo'`,
        [payload.id]
      )

      if (!user) {
        return res.status(401).json({ error: 'Usuario no encontrado o inactivo' })
      }

      // Adjuntar información completa al request
      req.user = {
        id: user.id_usuario,
        nombre: user.nombre_usuario,
        cedula: user.cedula,
        correo: user.correo,
        id_rol: user.id_rol,
        rol: user.nombre_rol, // 'Administrador', 'Instructor', 'Aprendiz'
      }

      return next()
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido' })
    }
  } catch (err) {
    return res.status(500).json({ error: 'Error al validar credenciales', details: err.message })
  }
}

export default authenticate