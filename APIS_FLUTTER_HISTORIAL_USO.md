# API de Historial de Uso de Equipos

Este documento describe los endpoints disponibles para registrar y consultar el historial de uso de equipos desde la aplicación Flutter de escritorio.

## Tabla de Base de Datos

Antes de usar los endpoints, asegúrate de ejecutar el script SQL para crear la tabla:

```sql
-- Ejecutar: BD/historial_uso_equipos.sql
```

## Endpoints Disponibles

### 1. Registrar Inicio de Sesión

Registra cuando un usuario inicia sesión en un equipo.

**Endpoint:** `POST /api/equipos/uso/inicio`

**Autenticación:** Requerida (Bearer Token)

**Body:**
```json
{
  "codigo_equipo": 123,  // o "PLACA123"
  "nombre_usuario": "Juan Pérez",  // REQUERIDO: Nombre del usuario que inicia sesión
  "fecha_hora_inicio": "2024-01-15T10:30:00Z",  // Opcional, si no se envía usa la fecha actual
  "observaciones": "Sesión de práctica"  // Opcional
}
```

**Respuesta Exitosa (201):**
```json
{
  "ok": true,
  "id_historial": 1,
  "message": "Inicio de sesión registrado correctamente",
  "fecha_hora_inicio": "2024-01-15T10:30:00.000Z"
}
```

**Errores:**
- `400`: Faltan campos obligatorios
- `404`: Equipo no encontrado
- `409`: Ya existe una sesión activa para este usuario en este equipo
- `500`: Error del servidor

---

### 2. Registrar Cierre de Sesión

Registra cuando un usuario cierra sesión en un equipo.

**Endpoint:** `POST /api/equipos/uso/fin`

**Autenticación:** Requerida (Bearer Token)

**Body:**
```json
{
  "codigo_equipo": 123,  // o "PLACA123"
  "fecha_hora_fin": "2024-01-15T12:45:00Z",  // Opcional, si no se envía usa la fecha actual
  "observaciones": "Sesión completada"  // Opcional
}
```

**Respuesta Exitosa (200):**
```json
{
  "ok": true,
  "message": "Cierre de sesión registrado correctamente",
  "historial": {
    "id_historial": 1,
    "codigo_equipo": 123,
    "id_usuario": 5,
    "fecha_hora_inicio": "2024-01-15T10:30:00.000Z",
    "fecha_hora_fin": "2024-01-15T12:45:00.000Z",
    "estado": "Finalizado",
    "duracion_minutos": 135,
    "observaciones": "Sesión completada"
  }
}
```

**Errores:**
- `400`: Faltan campos obligatorios o fecha de fin anterior a fecha de inicio
- `404`: No se encontró una sesión activa para este usuario en este equipo
- `500`: Error del servidor

---

### 3. Consultar Historial de Uso

Consulta el historial de uso de equipos con filtros opcionales.

**Endpoint:** `GET /api/equipos/uso/historial`

**Autenticación:** Requerida (Bearer Token)

**Query Parameters:**
- `codigo_equipo` (opcional): Filtrar por código de equipo
- `id_usuario` (opcional): Filtrar por ID de usuario (solo Admin/Instructor)
- `fecha_desde` (opcional): Fecha desde (formato: YYYY-MM-DD)
- `fecha_hasta` (opcional): Fecha hasta (formato: YYYY-MM-DD)
- `estado` (opcional): Filtrar por estado ('En Uso' o 'Finalizado')
- `limit` (opcional): Límite de resultados (default: 100)
- `offset` (opcional): Offset para paginación (default: 0)

**Ejemplo:**
```
GET /api/equipos/uso/historial?codigo_equipo=123&fecha_desde=2024-01-01&limit=50
```

**Respuesta Exitosa (200):**
```json
{
  "historial": [
    {
      "id_historial": 1,
      "codigo_equipo": 123,
      "codigo_inventario": "PLACA123",
      "equipo_tipo": "Computador",
      "equipo_modelo": "Dell Optiplex",
      "id_usuario": 5,
      "nombre_usuario": "Juan Pérez",
      "usuario_cedula": "1234567890",
      "usuario_correo": "juan@example.com",
      "fecha_hora_inicio": "2024-01-15T10:30:00.000Z",
      "fecha_hora_fin": "2024-01-15T12:45:00.000Z",
      "estado": "Finalizado",
      "duracion_minutos": 135,
      "observaciones": "Sesión completada",
      "fecha_registro": "2024-01-15T10:30:05.000Z"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

**Nota:** Los Aprendices solo pueden ver su propio historial.

---

### 4. Obtener Historial de un Equipo Específico

Obtiene el historial de uso de un equipo específico.

**Endpoint:** `GET /api/equipos/:codigo/uso/historial`

**Autenticación:** Requerida (Bearer Token)

**Query Parameters:**
- `fecha_desde` (opcional): Fecha desde (formato: YYYY-MM-DD)
- `fecha_hasta` (opcional): Fecha hasta (formato: YYYY-MM-DD)
- `limit` (opcional): Límite de resultados (default: 50)

**Ejemplo:**
```
GET /api/equipos/123/uso/historial?fecha_desde=2024-01-01
```

**Respuesta Exitosa (200):**
```json
{
  "equipo": {
    "codigo_equipo": 123,
    "codigo_inventario": "PLACA123",
    "tipo": "Computador",
    "modelo": "Dell Optiplex",
    "consecutivo": "CONS001"
  },
  "historial": [
    {
      "id_historial": 1,
      "codigo_equipo": 123,
      "codigo_inventario": "PLACA123",
      "equipo_tipo": "Computador",
      "equipo_modelo": "Dell Optiplex",
      "id_usuario": 5,
      "nombre_usuario": "Juan Pérez",
      "usuario_cedula": "1234567890",
      "usuario_correo": "juan@example.com",
      "fecha_hora_inicio": "2024-01-15T10:30:00.000Z",
      "fecha_hora_fin": "2024-01-15T12:45:00.000Z",
      "estado": "Finalizado",
      "duracion_minutos": 135,
      "observaciones": "Sesión completada",
      "fecha_registro": "2024-01-15T10:30:05.000Z"
    }
  ],
  "total": 1
}
```

---

### 5. Obtener Sesiones Activas

Obtiene todas las sesiones activas (en uso) de equipos.

**Endpoint:** `GET /api/equipos/uso/activas`

**Autenticación:** Requerida (Bearer Token)

**Query Parameters:**
- `codigo_equipo` (opcional): Filtrar por código de equipo

**Ejemplo:**
```
GET /api/equipos/uso/activas?codigo_equipo=123
```

**Respuesta Exitosa (200):**
```json
{
  "sesiones": [
    {
      "id_historial": 1,
      "codigo_equipo": 123,
      "codigo_inventario": "PLACA123",
      "equipo_tipo": "Computador",
      "equipo_modelo": "Dell Optiplex",
      "id_usuario": 5,
      "nombre_usuario": "Juan Pérez",
      "usuario_cedula": "1234567890",
      "usuario_correo": "juan@example.com",
      "fecha_hora_inicio": "2024-01-15T10:30:00.000Z",
      "estado": "En Uso",
      "minutos_transcurridos": 45,
      "observaciones": null
    }
  ],
  "total": 1
}
```

**Nota:** Los Aprendices solo pueden ver sus propias sesiones activas.

---

## Flujo de Uso Recomendado en Flutter

1. **Al iniciar sesión en el equipo:**
   - Llamar a `POST /api/equipos/uso/inicio` con el `codigo_equipo`
   - Guardar el `id_historial` retornado para referencia

2. **Durante el uso:**
   - Opcionalmente, consultar sesiones activas con `GET /api/equipos/uso/activas`

3. **Al cerrar sesión:**
   - Llamar a `POST /api/equipos/uso/fin` con el `codigo_equipo`
   - El sistema calculará automáticamente la duración

## Notas Importantes

- El `id_usuario` se obtiene automáticamente del token JWT, no es necesario enviarlo
- El `nombre_usuario` es **REQUERIDO** y debe enviarse desde Flutter
- Las fechas pueden enviarse en formato ISO 8601 o cualquier formato válido de JavaScript Date
- Si no se envía `fecha_hora_inicio` o `fecha_hora_fin`, se usa la fecha/hora actual del servidor
- La duración se calcula automáticamente cuando se registra el cierre de sesión
- No se puede tener múltiples sesiones activas para el mismo usuario en el mismo equipo
- Los Aprendices solo pueden ver y gestionar su propio historial

