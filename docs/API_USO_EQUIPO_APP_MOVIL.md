# API Registro de uso de equipo – Web, app móvil y registro externo

Web y app móvil usan el **mismo endpoint** que el registro externo: `POST /api/equipos/uso/registro-externo`.  
- **Sin token:** comportamiento actual de la página externa (público).  
- **Con token:** se exige permiso (ASSIGN o ASSIGN_TO_APRENDIZ) y se registra quién asignó (`asignado_por`).

---

## 1. Autenticación (web / app móvil)

- **Header:** `Authorization: Bearer <token>`
- **Content-Type:** `application/json`

**Permisos (cuando hay token):** Administrador, Instructor o Cuentadante (ASSIGN o ASSIGN_TO_APRENDIZ).

---

## 2. Base URL y endpoint

- Base: `https://<dominio>/api/equipos`
- **POST** `/api/equipos/uso/registro-externo`

---

## 3. Registrar uso (web / app móvil)

**POST** `/api/equipos/uso/registro-externo`

Mismo contrato que el registro externo: `placa` y `usuarios` (array). Para web/app no es obligatorio enviar `ambiente`; con token se valida permiso y se guarda `asignado_por`.

### Cuerpo (JSON)

| Campo      | Tipo   | Obligatorio | Descripción |
|-----------|--------|-------------|-------------|
| `placa`   | string | Sí          | Placa del equipo. |
| `ambiente`| string | No          | Código del ambiente (opcional en web/app). |
| `usuarios`| array  | Sí          | Lista de usuarios; cada uno: `documento`, opcionalmente `ficha`, `dias_semana`, `hora_inicio`, `hora_fin`. |

Cada elemento de `usuarios`:

| Campo         | Tipo   | Obligatorio | Descripción |
|---------------|--------|-------------|-------------|
| `documento`   | string | Sí          | Cédula/documento del aprendiz o usuario. |
| `ficha`       | string | No          | Ficha (opcional). |
| `dias_semana` | array  | No          | Ej.: `["Lunes", "Martes"]`. |
| `hora_inicio` | string | No          | Formato HH:MM o HH:MM:SS. Si se envía horario, también `hora_fin`. |
| `hora_fin`    | string | No          | Formato HH:MM o HH:MM:SS. |

### Ejemplo (un aprendiz, con horario)

```json
{
  "placa": "ABC-001",
  "usuarios": [
    {
      "documento": "1234567890",
      "dias_semana": ["Lunes", "Miércoles"],
      "hora_inicio": "08:00",
      "hora_fin": "10:00"
    }
  ]
}
```

### Respuesta 201 – Éxito

Estructura típica (puede incluir más campos):

```json
{
  "success": true,
  "message": "Verificación de ambiente y asignación de aprendices completada",
  "data": {
    "usuarios": [
      {
        "origen": "aprendiz",
        "id_aprendiz": 5,
        "id_responsable": 80,
        "id_historial": 150,
        "nombre": "María García",
        "documento": "1234567890",
        "ficha": "123456"
      }
    ],
    "errores": []
  }
}
```

Si algún usuario falla, viene en `data.errores` (ej.: `{ "documento": "123", "error": "El aprendiz no existe..." }`). La app debe mostrar éxito si hay al menos un elemento en `data.usuarios`, y errores concretos desde `data.errores`.

### Errores

| Código | Descripción |
|--------|-------------|
| 400 | Validación (placa vacía, usuarios vacío o inválido, etc.). |
| 404 | Equipo no encontrado por placa, o ambiente no encontrado (si se envió ambiente). |
| 409 | Equipo no disponible para uso. |
| 403 | Con token: sin permiso (ASSIGN o ASSIGN_TO_APRENDIZ). |
| 500 | Error interno. |

**Mensajes en `data.errores` (por usuario):**

- Si el aprendiz no está en BD: `"El aprendiz no existe, por favor comunicate con el Administrador"`.
- Si la persona ya está asignada al equipo: `"Esta persona ya está asignada a este equipo"`.
- Si el documento no existe en Usuarios ni Aprendices: `"Usuario no encontrado con documento \"...\". Debe registrarse primero en SGI-SENA."`

**Disponibilidad:** Si el equipo tiene estado físico "Bueno" pero el estado operativo indica "Dañado", el registro se permite (no se bloquea) para evitar bloqueos por estados desactualizados.

---

## 4. Uso desde la app móvil / web

1. Usuario autenticado (Instructor, Cuentadante o Administrador).
2. Recoger: **placa** del equipo y **documento** del aprendiz (y opcionalmente días/horario).
3. Enviar **POST** a `/api/equipos/uso/registro-externo` con header `Authorization: Bearer <token>` y body `{ "placa": "...", "usuarios": [{ "documento": "..." }] }`.
4. Mostrar mensaje de éxito o errores según `data.usuarios` y `data.errores`.

**Nota (web):** El endpoint GET de detalle de equipo devuelve la placa en el campo `codigo_inventario`. Al armar el body usar `placa: equipo.placa ?? equipo.codigo_inventario` para compatibilidad.

---

## 5. Relación con otros endpoints

- **Registro externo (público):** mismo `POST /api/equipos/uso/registro-externo` **sin** header Authorization; típicamente con `placa`, `ambiente` y `usuarios[]` (p. ej. formulario externo).
- **Inicio/fin de uso (usuario logueado):** `POST /api/equipos/uso/inicio` y `POST /api/equipos/uso/fin` para el usuario autenticado (por `codigo_equipo`).
