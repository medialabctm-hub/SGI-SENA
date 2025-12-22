import defaultDb from '../config/dbconfig.js'
import { PERMISSIONS } from '../config/permissions.js'

/**
 * Obtener todos los roles con sus permisos
 */
export async function listarRoles(req, res) {
  try {
    const [roles] = await defaultDb.execute(
      'SELECT id_rol, nombre_rol, descripcion, estado, fecha_creacion FROM Roles ORDER BY nombre_rol'
    )

    const rolesConPermisos = await Promise.all(
      roles.map(async (rol) => {
        // Obtener todos los permisos disponibles
        const [todosPermisos] = await defaultDb.execute(
          `SELECT p.id_permiso, p.codigo_permiso, p.modulo, p.accion, p.descripcion
           FROM Permisos p
           ORDER BY p.modulo, p.accion`
        )

        // Obtener permisos activos del rol desde la BD
        const [permisosActivos] = await defaultDb.execute(
          `SELECT p.codigo_permiso, rp.activo
           FROM Permisos p
           INNER JOIN Rol_Permisos rp ON p.id_permiso = rp.id_permiso
           WHERE rp.id_rol = ? AND rp.activo = 1`,
          [rol.id_rol]
        )

        const permisosActivosSet = new Set(permisosActivos.map(p => p.codigo_permiso))

        // Mapear todos los permisos con su estado
        const permisosConEstado = todosPermisos.map(p => ({
          ...p,
          activo: permisosActivosSet.has(p.codigo_permiso) ? 1 : 0
        }))

        // Para el Administrador, todos los permisos están activos
        const permisosFinales = rol.nombre_rol === 'Administrador' 
          ? permisosConEstado.map(p => ({ ...p, activo: 1 }))
          : permisosConEstado

        const permisosActivosList = permisosFinales.filter(p => p.activo === 1)

        return {
          id_rol: rol.id_rol,
          rol: rol.nombre_rol,
          descripcion: rol.descripcion,
          estado: rol.estado,
          fecha_creacion: rol.fecha_creacion,
          totalPermisos: permisosActivosList.length,
          permisos: permisosActivosList.map(p => p.codigo_permiso),
          permisosDetalle: permisosFinales // Incluir todos los permisos con su estado
        }
      })
    )

    return res.json({
      total: rolesConPermisos.length,
      roles: rolesConPermisos
    })
  } catch (error) {
    console.error('Error al listar roles:', error)
    return res.status(500).json({
      error: 'Error al obtener roles',
      details: error.message
    })
  }
}

/**
 * Obtener un rol específico con sus permisos
 */
export async function obtenerRol(req, res) {
  try {
    const { roleName } = req.params

    const [roles] = await defaultDb.execute(
      'SELECT id_rol, nombre_rol, descripcion, estado, fecha_creacion FROM Roles WHERE nombre_rol = ?',
      [roleName]
    )

    if (roles.length === 0) {
      return res.status(404).json({
        error: 'Rol no encontrado',
        message: `El rol "${roleName}" no existe en el sistema`
      })
    }

    const rol = roles[0]

    const [permisos] = await defaultDb.execute(
      `SELECT p.id_permiso, p.codigo_permiso, p.modulo, p.accion, p.descripcion, rp.activo
       FROM Permisos p
       INNER JOIN Rol_Permisos rp ON p.id_permiso = rp.id_permiso
       WHERE rp.id_rol = ? AND rp.activo = 1
       ORDER BY p.modulo, p.accion`,
      [rol.id_rol]
    )

    return res.json({
      id_rol: rol.id_rol,
      rol: rol.nombre_rol,
      descripcion: rol.descripcion,
      estado: rol.estado,
      fecha_creacion: rol.fecha_creacion,
      totalPermisos: permisos.length,
      permisos: permisos.map(p => p.codigo_permiso),
      permisosDetalle: permisos
    })
  } catch (error) {
    console.error('Error al obtener rol:', error)
    return res.status(500).json({
      error: 'Error al obtener el rol',
      details: error.message
    })
  }
}

/**
 * Crear un nuevo rol
 */
export async function crearRol(req, res) {
  try {
    const { nombre_rol, descripcion, permisos } = req.body

    if (!nombre_rol || !nombre_rol.trim()) {
      return res.status(400).json({
        error: 'Nombre de rol requerido',
        message: 'El nombre del rol es obligatorio'
      })
    }

    // Verificar si el rol ya existe
    const [rolesExistentes] = await defaultDb.execute(
      'SELECT id_rol FROM Roles WHERE nombre_rol = ?',
      [nombre_rol.trim()]
    )

    if (rolesExistentes.length > 0) {
      return res.status(400).json({
        error: 'Rol duplicado',
        message: `Ya existe un rol con el nombre "${nombre_rol}"`
      })
    }

    // Crear el rol
    const [result] = await defaultDb.execute(
      'INSERT INTO Roles (nombre_rol, descripcion, estado) VALUES (?, ?, ?)',
      [nombre_rol.trim(), descripcion || null, 'Activo']
    )

    const idRol = result.insertId

    // Asignar permisos si se proporcionaron
    if (permisos && Array.isArray(permisos) && permisos.length > 0) {
      // Obtener IDs de permisos
      const placeholders = permisos.map(() => '?').join(',')
      const [permisosEncontrados] = await defaultDb.execute(
        `SELECT id_permiso FROM Permisos WHERE codigo_permiso IN (${placeholders})`,
        permisos
      )

      if (permisosEncontrados.length > 0) {
        const valores = permisosEncontrados.map(p => [idRol, p.id_permiso, 1, req.user?.id || null])
        const valoresPlaceholders = valores.map(() => '(?, ?, ?, ?)').join(',')
        const valoresFlat = valores.flat()

        await defaultDb.execute(
          `INSERT INTO Rol_Permisos (id_rol, id_permiso, activo, asignado_por) VALUES ${valoresPlaceholders}`,
          valoresFlat
        )
      }
    }

    return res.status(201).json({
      message: 'Rol creado exitosamente',
      rol: {
        id_rol: idRol,
        nombre_rol: nombre_rol.trim(),
        descripcion: descripcion || null,
        estado: 'Activo'
      }
    })
  } catch (error) {
    console.error('Error al crear rol:', error)
    return res.status(500).json({
      error: 'Error al crear el rol',
      details: error.message
    })
  }
}

/**
 * Actualizar un rol
 */
export async function actualizarRol(req, res) {
  try {
    const { roleName } = req.params
    const { nombre_rol, descripcion, estado } = req.body

    // Verificar que el rol existe
    const [roles] = await defaultDb.execute(
      'SELECT id_rol FROM Roles WHERE nombre_rol = ?',
      [roleName]
    )

    if (roles.length === 0) {
      return res.status(404).json({
        error: 'Rol no encontrado',
        message: `El rol "${roleName}" no existe`
      })
    }

    const idRol = roles[0].id_rol

    // Actualizar campos
    const updates = []
    const valores = []

    if (nombre_rol !== undefined && nombre_rol !== roles[0].nombre_rol) {
      // Verificar que el nuevo nombre no esté en uso
      const [rolesDuplicados] = await defaultDb.execute(
        'SELECT id_rol FROM Roles WHERE nombre_rol = ? AND id_rol != ?',
        [nombre_rol.trim(), idRol]
      )

      if (rolesDuplicados.length > 0) {
        return res.status(400).json({
          error: 'Nombre duplicado',
          message: `Ya existe otro rol con el nombre "${nombre_rol}"`
        })
      }

      updates.push('nombre_rol = ?')
      valores.push(nombre_rol.trim())
    }

    if (descripcion !== undefined) {
      updates.push('descripcion = ?')
      valores.push(descripcion || null)
    }

    if (estado !== undefined) {
      if (!['Activo', 'Inactivo'].includes(estado)) {
        return res.status(400).json({
          error: 'Estado inválido',
          message: 'El estado debe ser "Activo" o "Inactivo"'
        })
      }
      updates.push('estado = ?')
      valores.push(estado)
    }

    if (updates.length > 0) {
      valores.push(idRol)
      await defaultDb.execute(
        `UPDATE Roles SET ${updates.join(', ')} WHERE id_rol = ?`,
        valores
      )
    }

    return res.json({
      message: 'Rol actualizado exitosamente'
    })
  } catch (error) {
    console.error('Error al actualizar rol:', error)
    return res.status(500).json({
      error: 'Error al actualizar el rol',
      details: error.message
    })
  }
}

/**
 * Eliminar un rol
 */
export async function eliminarRol(req, res) {
  try {
    const { roleName } = req.params

    // Verificar que el rol existe
    const [roles] = await defaultDb.execute(
      'SELECT id_rol FROM Roles WHERE nombre_rol = ?',
      [roleName]
    )

    if (roles.length === 0) {
      return res.status(404).json({
        error: 'Rol no encontrado',
        message: `El rol "${roleName}" no existe`
      })
    }

    const idRol = roles[0].id_rol

    // Verificar si hay usuarios con este rol
    const [usuarios] = await defaultDb.execute(
      'SELECT COUNT(*) as total FROM Usuarios WHERE id_rol = ?',
      [idRol]
    )

    if (usuarios[0].total > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar el rol',
        message: `Hay ${usuarios[0].total} usuario(s) asignado(s) a este rol. Primero debe cambiar sus roles.`
      })
    }

    // Eliminar relaciones de permisos (CASCADE lo hará automáticamente)
    await defaultDb.execute(
      'DELETE FROM Rol_Permisos WHERE id_rol = ?',
      [idRol]
    )

    // Eliminar el rol
    await defaultDb.execute(
      'DELETE FROM Roles WHERE id_rol = ?',
      [idRol]
    )

    return res.json({
      message: 'Rol eliminado exitosamente'
    })
  } catch (error) {
    console.error('Error al eliminar rol:', error)
    return res.status(500).json({
      error: 'Error al eliminar el rol',
      details: error.message
    })
  }
}

/**
 * Actualizar permisos de un rol
 */
export async function actualizarPermisosRol(req, res) {
  try {
    const { roleName } = req.params
    const { permisos } = req.body

    if (!Array.isArray(permisos)) {
      return res.status(400).json({
        error: 'Formato inválido',
        message: 'Los permisos deben ser un array'
      })
    }

    // Verificar que el rol existe
    const [roles] = await defaultDb.execute(
      'SELECT id_rol FROM Roles WHERE nombre_rol = ?',
      [roleName]
    )

    if (roles.length === 0) {
      return res.status(404).json({
        error: 'Rol no encontrado',
        message: `El rol "${roleName}" no existe`
      })
    }

    const idRol = roles[0].id_rol

    // Obtener todos los permisos disponibles
    const [todosPermisos] = await defaultDb.execute(
      'SELECT id_permiso, codigo_permiso FROM Permisos'
    )

    const permisosMap = new Map(todosPermisos.map(p => [p.codigo_permiso, p.id_permiso]))

    // Validar que todos los permisos proporcionados existen
    const permisosInvalidos = permisos.filter(p => !permisosMap.has(p))
    if (permisosInvalidos.length > 0) {
      return res.status(400).json({
        error: 'Permisos inválidos',
        message: `Los siguientes permisos no existen: ${permisosInvalidos.join(', ')}`
      })
    }

    // Obtener permisos actuales del rol
    const [permisosActuales] = await defaultDb.execute(
      'SELECT id_permiso, activo FROM Rol_Permisos WHERE id_rol = ?',
      [idRol]
    )

    const permisosActualesIds = new Set(permisosActuales.map(p => p.id_permiso))
    const permisosNuevosIds = new Set(permisos.map(p => permisosMap.get(p)))

    // Identificar permisos a agregar y eliminar
    const permisosAAgregar = Array.from(permisosNuevosIds).filter(id => !permisosActualesIds.has(id))
    const permisosAEliminar = Array.from(permisosActualesIds).filter(id => !permisosNuevosIds.has(id))

    // Agregar nuevos permisos
    if (permisosAAgregar.length > 0) {
      const valores = permisosAAgregar.map(id => [idRol, id, 1, req.user?.id || null])
      const placeholders = valores.map(() => '(?, ?, ?, ?)').join(',')
      const valoresFlat = valores.flat()

      await defaultDb.execute(
        `INSERT INTO Rol_Permisos (id_rol, id_permiso, activo, asignado_por) VALUES ${placeholders}`,
        valoresFlat
      )
    }

    // Desactivar permisos eliminados (en lugar de borrarlos, los marcamos como inactivos)
    if (permisosAEliminar.length > 0) {
      const placeholders = permisosAEliminar.map(() => '?').join(',')
      await defaultDb.execute(
        `UPDATE Rol_Permisos SET activo = 0 WHERE id_rol = ? AND id_permiso IN (${placeholders})`,
        [idRol, ...permisosAEliminar]
      )
    }

    // Reactivar permisos que estaban inactivos pero ahora están en la lista
    const permisosAReactivar = Array.from(permisosNuevosIds).filter(id => {
      const permisoActual = permisosActuales.find(p => p.id_permiso === id)
      return permisoActual && permisoActual.activo === 0
    })

    if (permisosAReactivar.length > 0) {
      const placeholders = permisosAReactivar.map(() => '?').join(',')
      await defaultDb.execute(
        `UPDATE Rol_Permisos SET activo = 1 WHERE id_rol = ? AND id_permiso IN (${placeholders})`,
        [idRol, ...permisosAReactivar]
      )
    }

    return res.json({
      message: 'Permisos actualizados exitosamente',
      agregados: permisosAAgregar.length,
      eliminados: permisosAEliminar.length,
      reactivados: permisosAReactivar.length
    })
  } catch (error) {
    console.error('Error al actualizar permisos:', error)
    return res.status(500).json({
      error: 'Error al actualizar permisos',
      details: error.message
    })
  }
}

/**
 * Activar/desactivar un permiso específico de un rol
 */
export async function togglePermisoRol(req, res) {
  try {
    const { roleName, permissionCode } = req.params
    const { activo } = req.body

    if (typeof activo !== 'boolean') {
      return res.status(400).json({
        error: 'Formato inválido',
        message: 'El campo "activo" debe ser true o false'
      })
    }

    // Verificar que el rol existe
    const [roles] = await defaultDb.execute(
      'SELECT id_rol FROM Roles WHERE nombre_rol = ?',
      [roleName]
    )

    if (roles.length === 0) {
      return res.status(404).json({
        error: 'Rol no encontrado',
        message: `El rol "${roleName}" no existe`
      })
    }

    const idRol = roles[0].id_rol

    // Verificar que el permiso existe
    const [permisos] = await defaultDb.execute(
      'SELECT id_permiso FROM Permisos WHERE codigo_permiso = ?',
      [permissionCode]
    )

    if (permisos.length === 0) {
      return res.status(404).json({
        error: 'Permiso no encontrado',
        message: `El permiso "${permissionCode}" no existe`
      })
    }

    const idPermiso = permisos[0].id_permiso

    // Verificar si la relación existe
    const [relaciones] = await defaultDb.execute(
      'SELECT activo FROM Rol_Permisos WHERE id_rol = ? AND id_permiso = ?',
      [idRol, idPermiso]
    )

    if (relaciones.length === 0) {
      // Crear la relación si no existe
      await defaultDb.execute(
        'INSERT INTO Rol_Permisos (id_rol, id_permiso, activo, asignado_por) VALUES (?, ?, ?, ?)',
        [idRol, idPermiso, activo ? 1 : 0, req.user?.id || null]
      )
    } else {
      // Actualizar el estado
      await defaultDb.execute(
        'UPDATE Rol_Permisos SET activo = ? WHERE id_rol = ? AND id_permiso = ?',
        [activo ? 1 : 0, idRol, idPermiso]
      )
    }

    return res.json({
      message: `Permiso ${activo ? 'activado' : 'desactivado'} exitosamente`,
      rol: roleName,
      permiso: permissionCode,
      activo: activo
    })
  } catch (error) {
    console.error('Error al toggle permiso:', error)
    return res.status(500).json({
      error: 'Error al actualizar el permiso',
      details: error.message
    })
  }
}

/**
 * Obtener todos los permisos disponibles
 */
export async function listarPermisos(req, res) {
  try {
    const [permisos] = await defaultDb.execute(
      'SELECT id_permiso, codigo_permiso, modulo, accion, descripcion FROM Permisos ORDER BY modulo, accion'
    )

    // Agrupar por módulo
    const permisosPorModulo = {}
    permisos.forEach(permiso => {
      if (!permisosPorModulo[permiso.modulo]) {
        permisosPorModulo[permiso.modulo] = []
      }
      permisosPorModulo[permiso.modulo].push(permiso)
    })

    return res.json({
      total: permisos.length,
      permisos: permisos,
      permisosPorModulo: permisosPorModulo
    })
  } catch (error) {
    console.error('Error al listar permisos:', error)
    return res.status(500).json({
      error: 'Error al obtener permisos',
      details: error.message
    })
  }
}

