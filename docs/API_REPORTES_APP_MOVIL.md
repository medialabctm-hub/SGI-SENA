# API Reportes – Guía para la app móvil (Flutter)

Indicaciones para integrar el módulo de **Reportes** en la app Flutter con el backend SGE-SENA.

---

## 1. Autenticación

Todas las rutas de reportes requieren **autenticación**. Incluir en cada petición el token del usuario:

- **Header:** `Authorization: Bearer <token>`
- **Content-Type:** `application/json` en POST y PUT.

---

## 2. Base URL

- Producción: `https://<tu-dominio>/api/reportes`
- Desarrollo: `http://<host>:<puerto>/api/reportes`

---

## 3. Valores permitidos (enums)

### Tipo de reporte (`tipo_reporte`)

Usar **exactamente** uno de estos valores (el backend acepta también `tipoReporte` en camelCase y normaliza mayúsculas):

| Valor          | Descripción   |
|----------------|----------------|
| `General`      | Reporte general |
| `Equipos`      | Relacionado a equipos |
| `Mantenimiento`| Mantenimiento |
| `Novedades`    | Novedades |
| `Uso`          | Uso de equipos |
| `Otro`         | Otro tipo |

### Prioridad (solo crear reporte, opcional)

`Baja` | `Media` | `Alta` | `Urgente`  
Por defecto: `Media`.

### Estado (solo actualizar, opcional)

`Pendiente` | `En Proceso` | `Resuelto` | `Cerrado`

---

## 4. Endpoints y JSON

### 4.1 Listar reportes

**GET** `/api/reportes`

- **Headers:** `Authorization: Bearer <token>`
- **Query:** ninguno obligatorio.
- **Permisos:** el usuario ve solo reportes que puede ver (según rol: todos o solo los propios / de sus equipos).

**Respuesta 200 – Ejemplo:**

```json
[
  {
    "id_reporte": 1,
    "tipo_reporte": "Novedades",
    "titulo": "Falla en teclado",
    "descripcion": "El teclado del equipo no responde en algunas teclas.",
    "codigo_equipo": 101,
    "fecha_generacion": "2026-02-13T10:30:00.000Z",
    "generado_por_nombre": "Juan Pérez",
    "equipo_tipo": "Portátil",
    "equipo_placa": "ABC-001",
    "equipo_modelo": "Dell XPS",
    "r_centro": "Centro 1",
    "consecutivo": 1
  }
]
```

---

### 4.2 Obtener tipos de reporte

**GET** `/api/reportes/tipos`

Devuelve la lista de tipos válidos para el combo/selector.

**Respuesta 200 – Ejemplo:**

```json
["General", "Equipos", "Mantenimiento", "Novedades", "Uso", "Otro"]
```

---

### 4.3 Obtener un reporte por ID

**GET** `/api/reportes/:id`

- **Params:** `id` = `id_reporte` (número).

**Respuesta 200 – Ejemplo:**

```json
{
  "id_reporte": 1,
  "tipo_reporte": "Novedades",
  "titulo": "Falla en teclado",
  "descripcion": "El teclado del equipo no responde en algunas teclas.",
  "codigo_equipo": 101,
  "generado_por": 5,
  "fecha_generacion": "2026-02-13T10:30:00.000Z",
  "generado_por_nombre": "Juan Pérez",
  "equipo_tipo": "Portátil",
  "equipo_placa": "ABC-001",
  "equipo_modelo": "Dell XPS",
  "r_centro": "Centro 1",
  "consecutivo": 1
}
```

**Errores:** 403 sin permiso, 404 si no existe.

---

### 4.4 Crear reporte

**POST** `/api/reportes`

**Body (JSON):**

| Campo           | Tipo   | Obligatorio | Reglas |
|-----------------|--------|-------------|--------|
| `tipo_reporte`  | string | Sí          | Uno de: General, Equipos, Mantenimiento, Novedades, Uso, Otro. Se acepta también `tipoReporte` (camelCase) y se normaliza mayúsculas. |
| `titulo`        | string | Sí          | Mín. 5, máx. 200 caracteres. |
| `descripcion`   | string | Sí          | Mín. 10, máx. 5000 caracteres. |
| `codigo_equipo` | int/string | No   | Si se envía, debe existir y el usuario debe tener permiso sobre ese equipo (Instructor/Aprendiz: solo equipos asignados). |
| `prioridad`     | string | No          | `Baja`, `Media`, `Alta`, `Urgente`. Por defecto: `Media`. |

**Ejemplo mínimo (reporte general):**

```json
{
  "tipo_reporte": "Novedades",
  "titulo": "Problema con equipo en aula 101",
  "descripcion": "El equipo no enciende. Se revisó el cable de poder y está bien conectado."
}
```

**Ejemplo con equipo y prioridad:**

```json
{
  "tipo_reporte": "Mantenimiento",
  "titulo": "Solicitud de mantenimiento preventivo",
  "descripcion": "El equipo lleva más de 6 meses sin mantenimiento. Solicito revisión.",
  "codigo_equipo": 101,
  "prioridad": "Alta"
}
```

**Respuesta 201 – Éxito:**

```json
{
  "ok": true,
  "id": 42,
  "message": "Reporte creado correctamente"
}
```

**Respuesta 400 – Validación:**

```json
{
  "success": false,
  "error": "Error de validación",
  "details": [
    {
      "path": "titulo",
      "message": "El título debe tener al menos 5 caracteres",
      "code": "too_small"
    }
  ]
}
```

**Otros códigos:** 403 (sin permiso para ese equipo), 404 (equipo no encontrado), 500 (error interno).

---

### 4.5 Actualizar reporte

**PUT** `/api/reportes/:id`

- **Permiso:** solo **Administrador**.
- **Params:** `id` = `id_reporte`.

**Body (JSON):** todos los campos son opcionales; enviar solo los que se quieran cambiar.

| Campo           | Tipo   | Reglas |
|-----------------|--------|--------|
| `tipo_reporte`  | string | Uno de: General, Equipos, Mantenimiento, Novedades, Uso, Otro. |
| `titulo`        | string | Mín. 5, máx. 200. |
| `descripcion`   | string | Mín. 10, máx. 5000. |
| `codigo_equipo` | int/null | Opcional. |
| `estado`        | string | `Pendiente`, `En Proceso`, `Resuelto`, `Cerrado`. |
| `observaciones` | string | Máx. 2000. Puede ser `null`. |
| `prioridad`     | string | `Baja`, `Media`, `Alta`, `Urgente`. |

**Ejemplo:**

```json
{
  "tipo_reporte": "Novedades",
  "titulo": "Falla en teclado - En revisión",
  "descripcion": "El teclado del equipo no responde. Se solicitó repuesto.",
  "estado": "En Proceso",
  "observaciones": "Repuesto pedido el 14/02/2026."
}
```

**Respuesta 200 – Éxito:**

```json
{
  "ok": true,
  "message": "Reporte actualizado correctamente"
}
```

**Errores:** 403 (no administrador), 404 (reporte no encontrado), 400 (validación), 500.

---

### 4.6 Eliminar reporte

**DELETE** `/api/reportes/:id`

- **Permiso:** solo **Administrador**.

**Respuesta 200 – Éxito:**

```json
{
  "ok": true,
  "message": "Reporte eliminado correctamente"
}
```

**Errores:** 403 (no administrador), 404 (reporte no encontrado), 500.

---

## 5. Resumen para Flutter

1. **Crear reporte:** siempre enviar `tipo_reporte` (o `tipoReporte`), `titulo` y `descripcion`. Opcional: `codigo_equipo`, `prioridad`. Usar valores exactos de los enums (el backend normaliza espacios y mayúsculas en `tipo_reporte`).
2. **Listar / detalle:** GET sin body; el backend filtra por rol (admin ve todos; instructor/aprendiz solo los suyos o de sus equipos).
3. **Tipos:** GET `/api/reportes/tipos` para llenar el selector de tipo.
4. **Editar / eliminar:** solo si el usuario es Administrador; en otro caso mostrar mensaje o ocultar acciones.
5. **Errores:** revisar `details` en 400 para mostrar mensajes por campo; en 403/404 usar el mensaje del body (`error`).

---

## 6. Códigos HTTP de referencia

| Código | Significado |
|--------|-------------|
| 200    | OK (GET, PUT, DELETE) |
| 201    | Creado (POST crear reporte) |
| 400    | Error de validación (revisar `details`) |
| 403    | Sin permiso (equipo, rol, etc.) |
| 404    | Recurso no encontrado (reporte o equipo) |
| 500    | Error interno del servidor |
