# Módulo de Utilidades SQL Compartidas

**Ubicación:** `backend/src/utils/sqlQueries.js`  
**Última actualización:** Enero 2026

## ¿Qué es y por qué existe?

Este módulo (`backend/src/utils/sqlQueries.js`) centraliza queries SQL comunes que se repiten en múltiples controladores del proyecto. 

### Problema que resuelve:

**ANTES** (código duplicado):
```javascript
// En authController.js
const [[user]] = await db.execute(
  `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.correo, u.telefono, 
          u.area_usuarios AS area, r.nombre_rol
   FROM Usuarios u
   LEFT JOIN Roles r ON r.id_rol = u.id_rol
   WHERE u.id_usuario = ? AND u.estado = 'Activo'`,
  [userId]
);

// En equiposController.js (código similar)
const [[usuario]] = await db.execute(
  `SELECT u.id_usuario, u.nombre_usuario, r.nombre_rol
   FROM Usuarios u
   LEFT JOIN Roles r ON r.id_rol = u.id_rol
   WHERE u.id_usuario = ? AND u.estado = 'Activo'`,
  [userId]
);
```

**DESPUÉS** (código reutilizable):
```javascript
// En cualquier controlador
import { obtenerUsuarioActivo } from '../utils/sqlQueries.js';

const user = await obtenerUsuarioActivo(db, userId);
```

## Beneficios

1. **Evita duplicación**: El mismo query no se escribe múltiples veces
2. **Mantenibilidad**: Si cambia la estructura de la tabla, solo se actualiza en un lugar
3. **Consistencia**: Todos los controladores obtienen los mismos datos de la misma forma
4. **Legibilidad**: El código es más claro y fácil de entender
5. **Testing**: Es más fácil probar funciones aisladas

## Funciones disponibles

### `obtenerUsuarioActivo(db, userId)`
Obtiene un usuario activo por su ID.

**Parámetros:**
- `db`: Instancia de la base de datos
- `userId`: ID del usuario (número)

**Retorna:** Objeto con datos del usuario (id_usuario, nombre_usuario, cedula, tipo_documento, tipo_documento_otro, correo, telefono, nombre_rol, id_rol, foto_perfil) o `null` si no existe

**Ejemplo:**
```javascript
import defaultDb from '../config/dbconfig.js';
import { obtenerUsuarioActivo } from '../utils/sqlQueries.js';

const user = await obtenerUsuarioActivo(defaultDb, 123);
if (user) {
  console.log(user.nombre_usuario); // "Juan Pérez"
  console.log(user.nombre_rol);     // "Administrador"
}
```

### `obtenerUsuarioPorCedula(db, cedula)`
Obtiene un usuario activo por su cédula.

**Parámetros:**
- `db`: Instancia de la base de datos
- `cedula`: Cédula del usuario (string)

**Retorna:** Objeto con datos del usuario o `null` si no existe

### `obtenerEquiposAsignados(db, userId)`
Obtiene todos los equipos asignados a un usuario.

**Parámetros:**
- `db`: Instancia de la base de datos
- `userId`: ID del usuario

**Retorna:** Array de equipos asignados

### `obtenerEquipoPorCodigo(db, codigo)`
Obtiene un equipo por código de inventario o ID.

**Parámetros:**
- `db`: Instancia de la base de datos
- `codigo`: Código de inventario (string) o ID (número)

**Retorna:** Objeto con datos del equipo o `null` si no existe

### `verificarAsignacionEquipo(db, codigoEquipo, userId)`
Verifica si un equipo está asignado a un usuario.

**Parámetros:**
- `db`: Instancia de la base de datos
- `codigoEquipo`: Código del equipo
- `userId`: ID del usuario

**Retorna:** `true` si está asignado, `false` en caso contrario

### `obtenerRolUsuario(db, userId)`
Obtiene el rol de un usuario.

**Parámetros:**
- `db`: Instancia de la base de datos
- `userId`: ID del usuario

**Retorna:** Nombre del rol (string) o `null`

### `contarUsuariosActivos(db)`
Cuenta el número de usuarios activos.

**Retorna:** Número de usuarios activos

### `contarEquipos(db)`
Cuenta el número total de equipos.

**Retorna:** Número total de equipos

### `verificarDisponibilidadEquipo(db, codigoEquipo)`
Verifica si un equipo está disponible para asignación (estado operativo y físico).

**Parámetros:**
- `db`: Instancia de la base de datos
- `codigoEquipo`: Código del equipo

**Retorna:** Objeto `{ disponible, razon, estado_operativo, estado_fisico }`. Bloquea si está Dañado, En Mantenimiento o Dado de Baja.

### `deshabilitarAsignacionesActivas(db, codigoEquipo, deshabilitadoPor, razon?)`
Deshabilita todas las asignaciones activas de un equipo (p. ej. cuando el equipo pasa a estado crítico).

**Parámetros:**
- `db`: Instancia de la base de datos
- `codigoEquipo`: Código del equipo
- `deshabilitadoPor`: ID del usuario que realiza la acción
- `razon`: Opcional; mensaje de deshabilitación (default: 'Equipo deshabilitado por cambio de estado')

**Retorna:** Objeto `{ deshabilitadas, usuarios_afectados }`

### `obtenerAmbientesValidosAprendiz(db, idAprendiz)`
Obtiene los IDs de ambientes válidos para un aprendiz según sus clases activas y ficha.

**Parámetros:**
- `db`: Instancia de la base de datos
- `idAprendiz`: ID del usuario aprendiz

**Retorna:** Array de IDs de ambientes

### `verificarAmbienteEquipoAprendiz(db, codigoEquipo, idAprendiz)`
Verifica si un equipo puede ser asignado a un aprendiz (que el ambiente del equipo esté entre los ambientes válidos del aprendiz).

**Parámetros:**
- `db`: Instancia de la base de datos
- `codigoEquipo`: Código del equipo
- `idAprendiz`: ID del usuario aprendiz

**Retorna:** Objeto `{ valido, razon, ambiente_equipo, ambientes_validos, nombre_ambiente_equipo? }`

## Ejemplo de refactorización

### Antes (código duplicado):
```javascript
// authController.js
export const getUserDetails = async (req, res) => {
  const [[user]] = await db.execute(
    `SELECT u.id_usuario, u.nombre_usuario, u.cedula, u.correo, u.telefono, 
            u.area_usuarios AS area, r.nombre_rol
     FROM Usuarios u
     LEFT JOIN Roles r ON r.id_rol = u.id_rol
     WHERE u.id_usuario = ? AND u.estado = 'Activo'`,
    [req.params.id]
  );
  
  const [equipos] = await db.execute(
    `SELECT e.codigo_equipo, e.numero_serie, e.tipo, e.marca, e.modelo, 
            ee.estado_operativo, a.nombre_ambiente, a.codigo_ambiente, 
            re.fecha_asignacion, re.tipo_responsabilidad, 
            DATEDIFF(NOW(), re.fecha_asignacion) AS dias_asignado
     FROM Responsables_Equipo re
     INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
     LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
     LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
     WHERE re.id_usuario = ? AND re.estado_responsabilidad = 'Activo'
     ORDER BY re.fecha_asignacion DESC`,
    [req.params.id]
  );
  
  return res.json({ user, equipos });
};
```

### Después (usando utilidades):
```javascript
import { obtenerUsuarioActivo, obtenerEquiposAsignados } from '../utils/sqlQueries.js';

export const getUserDetails = async (req, res) => {
  const user = await obtenerUsuarioActivo(db, req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  
  const equipos = await obtenerEquiposAsignados(db, req.params.id);
  
  return res.json({ user, equipos });
};
```

## Cómo agregar nuevas funciones

1. Identifica queries que se repiten en múltiples controladores
2. Crea una función reutilizable en `sqlQueries.js`
3. Documenta la función con JSDoc
4. Refactoriza los controladores para usar la nueva función
5. Actualiza este README

**Ejemplo de nueva función:**
```javascript
/**
 * Obtener todas las novedades pendientes de un usuario
 * @param {Object} db - Instancia de la base de datos
 * @param {number} userId - ID del usuario
 * @returns {Promise<Array>} Lista de novedades pendientes
 */
export async function obtenerNovedadesPendientes(db, userId) {
  const [novedades] = await db.execute(
    `SELECT id_novedad, titulo, descripcion, fecha_reporte, estado_resolucion
     FROM Novedades
     WHERE reportado_por = ? AND estado_resolucion = 'Pendiente'
     ORDER BY fecha_reporte DESC`,
    [userId]
  );
  return novedades || [];
}
```

## Notas importantes

- Todas las funciones son `async` y retornan `Promise`
- Las funciones manejan errores de forma silenciosa (retornan `null` o arrays vacíos)
- Siempre valida los resultados antes de usarlos
- Las funciones no incluyen validación de permisos (eso se hace en los controladores)

