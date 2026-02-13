# API Novedades – Guía para la app móvil (Flutter)

Indicaciones para integrar el módulo de **Novedades** en la app Flutter con el backend SGE-SENA.

---

## 1. Autenticación

Todas las rutas de novedades requieren **autenticación**. Incluir en cada petición el token del usuario:

- **Header:** `Authorization: Bearer <token>`
- **Content-Type:** `application/json` en POST y PUT.

---

## 2. Base URL

- Producción: `https://<tu-dominio>/api/novedades`
- Desarrollo: `http://<host>:<puerto>/api/novedades`

---

## 3. Valores permitidos (enums)

### Tipo de novedad (`tipo_novedad`)

Usar **exactamente** uno de estos valores (el backend valida contra el validador Zod y, si aplica, contra el ENUM de la BD):

| Valor                 | Descripción           |
|-----------------------|------------------------|
| `Daño`                | Daño general          |
| `Pérdida`             | Pérdida del equipo    |
| `Robo`                | Robo                  |
| `Mal Funcionamiento`  | Mal funcionamiento    |
| `Daño Físico`         | Daño físico           |
| `Falta de Componente` | Falta de componente   |
| `Otro`                | Otro tipo             |

### Estado de resolución (`estado_resolucion`)

Solo aplica al **actualizar estado** (PUT). Valores:

`Pendiente` | `En Proceso` | `Resuelto` | `No Resuelto`

---

## 4. Endpoints y JSON

### 4.1 Listar novedades

**GET** `/api/novedades`

- **Headers:** `Authorization: Bearer <token>`
- **Query:** ninguno obligatorio.
- **Permisos:** Administrador ve todas; Instructor y Aprendiz solo las de equipos que tienen asignados.

**Respuesta 200 – Ejemplo:**

```json
[
  {
    "id_novedad": 1,
    "codigo_equipo": 101,
    "tipo_novedad": "Mal Funcionamiento",
    "descripcion": "El teclado no responde en algunas teclas.",
    "fecha_novedad": "2026-02-13T10:30:00.000Z",
    "estado_resolucion": "Pendiente",
    "fecha_resolucion": null,
    "observaciones_resolucion": null,
    "equipo_tipo": "Portátil",
    "equipo_modelo": "Dell XPS",
    "equipo_placa": "ABC-001",
    "codigo_inventario": "ABC-001",
    "consecutivo": 1,
    "r_centro": "Centro 1",
    "reportado_por_nombre": "Juan Pérez",
    "resuelto_por_nombre": null
  }
]
```

---

### 4.2 Obtener tipos de novedad

**GET** `/api/novedades/tipos`

Devuelve la lista de tipos válidos para el combo/selector al crear una novedad.

**Respuesta 200 – Ejemplo:**

```json
["Daño", "Pérdida", "Robo", "Mal Funcionamiento", "Daño Físico", "Falta de Componente", "Otro"]
```

---

### 4.3 Obtener estados de novedad

**GET** `/api/novedades/estados`

Devuelve la lista de estados de resolución para el selector al actualizar estado.

**Respuesta 200 – Ejemplo:**

```json
["Pendiente", "En Proceso", "Resuelto", "No Resuelto"]
```

---

### 4.4 Obtener una novedad por ID

**GET** `/api/novedades/:id`

- **Params:** `id` = `id_novedad` (número).
- **Permisos:** Administrador ve cualquiera; Instructor/Aprendiz solo si el equipo está asignado a ellos.

**Respuesta 200 – Ejemplo:**

```json
{
  "id_novedad": 1,
  "codigo_equipo": 101,
  "tipo_novedad": "Mal Funcionamiento",
  "descripcion": "El teclado no responde en algunas teclas.",
  "fecha_novedad": "2026-02-13T10:30:00.000Z",
  "estado_resolucion": "Pendiente",
  "fecha_resolucion": null,
  "observaciones_resolucion": null,
  "reportado_por": 5,
  "resuelto_por": null,
  "equipo_tipo": "Portátil",
  "equipo_modelo": "Dell XPS",
  "equipo_placa": "ABC-001",
  "codigo_inventario": "ABC-001",
  "consecutivo": 1,
  "r_centro": "Centro 1",
  "reportado_por_nombre": "Juan Pérez",
  "resuelto_por_nombre": null
}
```

**Errores:** 403 sin permiso (equipo no asignado), 404 si no existe.

---

### 4.5 Crear novedad

**POST** `/api/novedades`

- **Permisos:** Cualquier rol con permiso de crear novedades. **Aprendiz** solo puede crear novedades para equipos que tiene asignados; Admin e Instructor para cualquier equipo.

**Body (JSON):**

| Campo           | Tipo        | Obligatorio | Reglas |
|-----------------|-------------|-------------|--------|
| `codigo_equipo` | number/string | Sí        | Debe existir. Aprendiz: solo equipos asignados. |
| `tipo_novedad`  | string      | Sí          | Uno de: Daño, Pérdida, Robo, Mal Funcionamiento, Daño Físico, Falta de Componente, Otro. |
| `descripcion`   | string      | Sí          | Mín. 10, máx. 2000 caracteres. |

**Ejemplo:**

```json
{
  "codigo_equipo": 101,
  "tipo_novedad": "Mal Funcionamiento",
  "descripcion": "El equipo no enciende. Se revisó el cable de poder y está bien conectado."
}
```

**Respuesta 201 – Éxito:**

```json
{
  "ok": true,
  "id": 42,
  "message": "Novedad registrada correctamente",
  "equipo": {
    "codigo": 101,
    "descripcion": "Portátil ABC-001 Dell XPS"
  }
}
```

**Respuesta 400 – Validación:**

```json
{
  "success": false,
  "error": "Error de validación",
  "details": [
    {
      "path": "descripcion",
      "message": "La descripción debe tener al menos 10 caracteres",
      "code": "too_small"
    }
  ]
}
```

**Otros códigos:** 403 (sin permiso para ese equipo), 404 (equipo no encontrado), 500 (error interno).

---

### 4.6 Actualizar estado de novedad

**PUT** `/api/novedades/:id/estado`

- **Permiso:** solo **Administrador**.
- **Params:** `id` = `id_novedad`.

**Body (JSON):**

| Campo                    | Tipo   | Obligatorio | Reglas |
|--------------------------|--------|-------------|--------|
| `estado_resolucion`      | string | Sí          | Uno de: Pendiente, En Proceso, Resuelto, No Resuelto. |
| `observaciones_resolucion` | string | No        | Máx. 1000 caracteres. Opcional o `null`. |

**Ejemplo:**

```json
{
  "estado_resolucion": "En Proceso",
  "observaciones_resolucion": "Se solicitó repuesto de teclado."
}
```

**Respuesta 200 – Éxito:**

```json
{
  "message": "Estado de novedad actualizado correctamente",
  "estado_resolucion": "En Proceso",
  "fecha_resolucion": null
}
```

Cuando el estado es `Resuelto` o `No Resuelto`, el backend asigna `fecha_resolucion` y `resuelto_por`; en la respuesta 200, `fecha_resolucion` puede ser una fecha ISO o `null` si sigue en proceso.

**Errores:** 403 (no administrador), 404 (novedad no encontrada), 400 (validación), 500.

---

## 5. Resumen para Flutter

1. **Crear novedad:** enviar `codigo_equipo`, `tipo_novedad` y `descripcion`. Obtener tipos con GET `/api/novedades/tipos`. Aprendiz solo puede usar equipos asignados.
2. **Listar / detalle:** GET sin body; el backend filtra por rol (admin ve todas; instructor/aprendiz solo de sus equipos).
3. **Tipos y estados:** GET `/api/novedades/tipos` y GET `/api/novedades/estados` para selectores.
4. **Actualizar estado:** solo si el usuario es **Administrador**; en otro caso no mostrar la acción o mostrar mensaje de permiso.
5. **Errores:** revisar `details` en 400 para mensajes por campo; en 403/404 usar el mensaje del body (`error`).

---

## 6. Códigos HTTP de referencia

| Código | Significado |
|--------|-------------|
| 200    | OK (GET, PUT estado) |
| 201    | Creado (POST crear novedad) |
| 400    | Error de validación (revisar `details`) |
| 403    | Sin permiso (equipo no asignado, no administrador para PUT estado) |
| 404    | Recurso no encontrado (novedad o equipo) |
| 500    | Error interno del servidor |

---

## 7. Notas de negocio

- **Novedades críticas (Daño, Pérdida, Robo):** el backend puede actualizar automáticamente el estado del equipo y deshabilitar asignaciones activas; no cambia la respuesta de la API de creación.
- No existe endpoint para **eliminar** una novedad en la API actual.
- No existe endpoint para **editar** descripción o tipo una vez creada la novedad; solo se puede actualizar el estado (Administrador).
