# Especificación API: Clases y Ambientes

Documento de referencia para endpoints de clases, horarios y ambientes en el backend SGE-SENA, con detalle de request/response, campos y uso en el frontend.

---

## 1. Listados y detalle

### 1.1 GET /api/clases

**Método y ruta:** `GET /api/clases`

**Query params (todos opcionales):**
| Parámetro      | Tipo   | Descripción                                      |
|----------------|--------|--------------------------------------------------|
| id_ambiente    | number | Filtrar por ID de ambiente                       |
| id_instructor  | number | Filtrar por ID de instructor                     |
| fecha          | string | Fecha en YYYY-MM-DD                              |
| estado_clase   | string | Programada \| En Curso \| Finalizada \| Cancelada |
| page           | number | Página (default 1)                               |
| limit          | number | Registros por página (default 50, máx 100)      |

**Response 200 – Ejemplo:**
```json
{
  "clases": [
    {
      "id_clase": 1,
      "id_ambiente": 2,
      "nombre_ambiente": "Lab Informática 1",
      "codigo_ambiente": "LAB-01",
      "id_instructor": 5,
      "instructor_nombre": "Juan Pérez",
      "nombre_clase": "PROGRAMACIÓN BÁSICA",
      "codigo_ficha": "FIC-123",
      "descripcion": null,
      "fecha_clase": "2025-02-20",
      "hora_inicio": "08:00:00",
      "hora_fin": "10:00:00",
      "estado_clase": "Programada",
      "fecha_inicio_real": null,
      "fecha_fin_real": null,
      "observaciones": null,
      "fecha_creacion": "2025-02-01T12:00:00.000Z",
      "total_participantes": 0
    }
  ],
  "paginacion": {
    "pagina": 1,
    "limite": 50,
    "total": 120,
    "totalPaginas": 3
  }
}
```

**Campos de cada elemento en `clases`:**

| Key                 | Tipo    | Null/omitido | Notas                                                |
|---------------------|---------|---------------|------------------------------------------------------|
| id_clase            | number  | No            | Siempre presente                                    |
| id_ambiente         | number  | No            |                                                      |
| nombre_ambiente     | string  | No            | Join con Ambientes                                  |
| codigo_ambiente     | string  | No            | Join con Ambientes                                  |
| id_instructor       | number  | No            |                                                      |
| instructor_nombre   | string  | No            | Alias: nombre del instructor (Join Usuarios)        |
| nombre_clase        | string  | Sí (null)     |                                                      |
| codigo_ficha        | string  | Sí (null)     | Ficha/grupo                                         |
| descripcion         | string  | Sí (null)     |                                                      |
| fecha_clase         | string  | No            | YYYY-MM-DD (puede venir como Date en algunos clients) |
| hora_inicio         | string  | No            | HH:MM:SS (a veces truncado a HH:MM en front)         |
| hora_fin            | string  | No            | HH:MM:SS                                             |
| estado_clase        | string  | No            | Programada \| En Curso \| Finalizada \| Cancelada   |
| fecha_inicio_real   | string  | Sí (null)     | Cuando se inició la clase                           |
| fecha_fin_real      | string  | Sí (null)     | Cuando se finalizó                                  |
| observaciones       | string  | Sí (null)     |                                                      |
| fecha_creacion      | string  | Sí            | ISO date                                             |
| total_participantes | number  | No            | COUNT de participantes presentes                    |

**Alias / variantes:** El backend no devuelve alias como `ambiente`, `clase`, `ficha`, `estado`, `horario`. El frontend usa:
- **Ambiente:** `nombre_ambiente` (título) y `codigo_ambiente` (subtítulo).
- **Clase:** `nombre_clase`.
- **Ficha:** `codigo_ficha`.
- **Estado:** `estado_clase`.
- **Horario:** construido en front como `clase.hora_inicio + " - " + clase.hora_fin` (a veces recortando a HH:MM).

**Frontend (Horarios.jsx):** Usa `data.clases` o array directo si la respuesta es solo un array. Renderiza: `nombre_ambiente`, `codigo_ambiente`, `instructor_nombre`, `codigo_ficha`, `nombre_clase`, `fecha_clase`, `hora_inicio`, `hora_fin`, `estado_clase`, `total_participantes`, `observaciones` (para “Consentimiento Rechazado”).

---

### 1.2 GET /api/clases/:id

**Método y ruta:** `GET /api/clases/:id`  
**Parámetro:** `id` = id_clase (número).

**Response 200 – Ejemplo:**
```json
{
  "id_clase": 1,
  "id_ambiente": 2,
  "id_instructor": 5,
  "nombre_clase": "PROGRAMACIÓN BÁSICA",
  "codigo_ficha": "FIC-123",
  "descripcion": null,
  "fecha_clase": "2025-02-20",
  "hora_inicio": "08:00:00",
  "hora_fin": "10:00:00",
  "estado_clase": "Programada",
  "fecha_inicio_real": null,
  "fecha_fin_real": null,
  "observaciones": null,
  "creado_por": null,
  "nombre_ambiente": "Lab Informática 1",
  "codigo_ambiente": "LAB-01",
  "instructor_nombre": "Juan Pérez",
  "instructor_cedula": "123456",
  "participantes": [
    {
      "id_participante": 1,
      "id_aprendiz": 10,
      "aprendiz_nombre": "María García",
      "aprendiz_cedula": "789",
      "presente": true,
      "fecha_registro": "2025-02-20T08:05:00.000Z"
    }
  ],
  "responsabilidades": [
    {
      "id_responsabilidad_ambiente": 1,
      "id_usuario": 5,
      "nombre_usuario": "Juan Pérez",
      "nombre_rol": "Instructor",
      "tipo_responsabilidad": "Principal",
      "fecha_inicio": "2025-02-20 08:00:00",
      "fecha_fin": null,
      "estado_responsabilidad": "Activa"
    }
  ]
}
```

**Campos raíz (clase):** Incluye todas las columnas de la tabla Clases más `nombre_ambiente`, `codigo_ambiente`, `instructor_nombre`, `instructor_cedula`.  
**participantes:** Array de objetos con `id_participante`, `id_aprendiz`, `aprendiz_nombre`, `aprendiz_cedula`, `presente`, `fecha_registro`.  
**responsabilidades:** Array de responsabilidades activas del ambiente para esta clase.

**Response 404:** `{ "error": "Clase no encontrada" }`

---

### 1.3 GET /api/horarios (no existe)

No hay `GET /api/horarios` para listar horarios. Las rutas de horarios son:
- `POST /api/horarios/importar` – importar Excel.
- `GET /api/horarios/plantilla` – descargar plantilla Excel.

El listado de “horarios” en la UI viene de **GET /api/clases** (con filtros opcionales).

---

### 1.4 GET /api/ambientes

**Método y ruta:** `GET /api/ambientes`

**Query params (opcionales):**
| Parámetro       | Tipo   | Descripción                    |
|----------------|--------|--------------------------------|
| estado_ambiente| string | Activo \| Inactivo \| En Mantenimiento |
| tipo_ambiente  | string | Laboratorio \| Aula \| Taller \| Oficina \| Bodega |
| edificio       | string |                                |
| piso           | string |                                |

**Response 200 – Ejemplo:** Array directo (no envuelto en objeto):
```json
[
  {
    "id_ambiente": 1,
    "codigo_ambiente": "LAB-01",
    "nombre_ambiente": "Lab Informática 1",
    "tipo_ambiente": "Laboratorio",
    "capacidad_personas": 25,
    "piso": "1",
    "edificio": "Principal",
    "descripcion": null,
    "estado_ambiente": "Activo",
    "fecha_creacion": "2025-01-15T00:00:00.000Z",
    "total_equipos": 20,
    "equipos_disponibles": 18
  }
]
```

**Campos por elemento:**

| Key                 | Tipo    | Null/omitido | Notas                    |
|---------------------|---------|---------------|--------------------------|
| id_ambiente         | number  | No            |                          |
| codigo_ambiente     | string  | No            |                          |
| nombre_ambiente     | string  | No            |                          |
| tipo_ambiente       | string  | No            | Valores ver tabla arriba |
| capacidad_personas  | number  | Sí (null)     |                          |
| piso                | string  | Sí (null)     |                          |
| edificio            | string  | Sí (null)     |                          |
| descripcion         | string  | Sí (null)     |                          |
| estado_ambiente     | string  | No            | Activo \| Inactivo \| En Mantenimiento |
| fecha_creacion      | string  | Sí            |                          |
| total_equipos       | number  | No            | COUNT                    |
| equipos_disponibles | number  | No            | COUNT con estado Disponible |

**Frontend (Ambientes.jsx):** Espera array directo. Filtros: `estado_ambiente`, `tipo_ambiente`. Renderiza: `id_ambiente`, `codigo_ambiente`, `nombre_ambiente`, `estado_ambiente` (y formulario con todos los campos anteriores para crear/editar).

---

### 1.5 GET /api/ambientes/:id

**Método y ruta:** `GET /api/ambientes/:id`  
**Parámetro:** `id` = id_ambiente.

**Response 200 – Ejemplo:**
```json
{
  "id_ambiente": 1,
  "codigo_ambiente": "LAB-01",
  "nombre_ambiente": "Lab Informática 1",
  "tipo_ambiente": "Laboratorio",
  "capacidad_personas": 25,
  "piso": "1",
  "edificio": "Principal",
  "descripcion": null,
  "estado_ambiente": "Activo",
  "fecha_creacion": "2025-01-15T00:00:00.000Z",
  "total_equipos": 20,
  "equipos_disponibles": 18,
  "equipos_en_uso": 1,
  "equipos_en_mantenimiento": 1,
  "equipos": [
    {
      "codigo_equipo": "EQ-001",
      "r_centro": "RC-1",
      "tipo": "Computador",
      "placa": "PL-001",
      "modelo": "Dell",
      "consecutivo": 1,
      "estado_operativo": "Disponible",
      "estado_fisico": "Bueno"
    }
  ],
  "responsables_actuales": [],
  "imagenes": [],
  "uso_consecutivo_instructores": []
}
```

**Campos adicionales respecto al listado:** `equipos`, `equipos_en_uso`, `equipos_en_mantenimiento`, `responsables_actuales`, `imagenes`, `uso_consecutivo_instructores`.

**Response 404:** `{ "error": "Ambiente no encontrado" }`

---

### 1.6 Otras rutas usadas por el front (clases/ambientes)

| Método | Ruta | Uso |
|--------|------|-----|
| GET | /api/clases/nombres | Autocompletado nombres de clase (query `busqueda` opcional). Devuelve `{ ok, nombres: string[], total }`. |
| POST | /api/clases/sincronizar-responsabilidades | Sincronización manual de responsabilidades (Horarios). |
| GET | /api/ambientes/activos | Listado reducido: `id_ambiente`, `nombre_ambiente`, `codigo_ambiente` (estado = Activo). |
| GET | /api/ambientes/asignaciones | Asignaciones permanentes (query `id_ambiente`, `id_instructor` opcionales). |
| GET | /api/ambientes/:id/instructores | Instructores asignados al ambiente. |
| GET | /api/ambientes/:id_ambiente/responsables | Responsables actuales (query `fecha_consulta` opcional). |
| GET | /api/ambientes/:id_ambiente/responsables-tiempo-real | Responsables en fecha/hora (query `fecha`, `hora` obligatorios). |

---

## 2. Creación / edición / eliminación de clases

### 2.1 POST /api/clases

**Método y ruta:** `POST /api/clases`

**Request body – Clase única (ejemplo):**
```json
{
  "id_ambiente": 2,
  "id_instructor": 5,
  "nombre_clase": "Programación Básica",
  "codigo_ficha": "FIC-123",
  "descripcion": null,
  "fecha_clase": "2025-03-01",
  "hora_inicio": "08:00",
  "hora_fin": "10:00",
  "observaciones": null,
  "participantes": []
}
```

**Request body – Clases recurrentes (ejemplo):**
```json
{
  "id_ambiente": 2,
  "id_instructor": 5,
  "nombre_clase": "Programación Básica",
  "codigo_ficha": "FIC-123",
  "fecha_inicio": "2025-03-01",
  "fecha_fin": "2025-03-31",
  "dias_semana": [1, 3, 5],
  "hora_inicio": "08:00:00",
  "hora_fin": "10:00:00",
  "participantes": []
}
```

**Campos:**

| Campo          | Obligatorio | Tipo   | Validación / formato |
|----------------|------------|--------|----------------------|
| id_ambiente    | Sí         | number | Entero > 0 (o string numérico; se transforma). Ambiente debe existir y estar Activo. |
| id_instructor  | Condicional| number | Requerido si el usuario no es Instructor ni Cuentadante. Entero > 0. Usuario debe ser Instructor o Cuentadante activo. |
| nombre_clase   | No         | string | 3–200 caracteres (opcional en schema). Se normaliza a mayúsculas. |
| codigo_ficha   | No         | string | 1–50 caracteres. |
| descripcion    | No         | string | Máx 1000, nullable. |
| fecha_clase    | Condicional| string | YYYY-MM-DD. Obligatorio si no hay recurrentes (ver abajo). |
| fecha_inicio   | Condicional| string | YYYY-MM-DD. Obligatorio si hay dias_semana. |
| fecha_fin      | Condicional| string | YYYY-MM-DD. Obligatorio si hay dias_semana; debe ser >= fecha_inicio. |
| dias_semana    | Condicional| number[] | 0–6 (0=Domingo, 1=Lunes, …). Opcional. Acepta también strings en español (lunes, martes, etc.) y se mapean a número. |
| hora_inicio   | Sí         | string | HH:MM o HH:MM:SS (si HH:MM se agrega :00). |
| hora_fin       | Sí         | string | HH:MM o HH:MM:SS. Debe ser posterior a hora_inicio. |
| observaciones  | No         | string | Máx 2000, nullable. |
| participantes  | No         | number[] | IDs de aprendices; default []. |

Reglas de combinación:
- **Clase única:** enviar `fecha_clase` (y no usar dias_semana para crear varias).
- **Recurrentes:** enviar `fecha_inicio`, `fecha_fin` y `dias_semana` (array no vacío). No se usa `fecha_clase` para generar fechas.

**Alias aceptados en validación (Zod):**
- Hora: `HH:MM` se convierte a `HH:MM:00`.
- `id_ambiente` / `id_instructor`: string numérico se convierte a number.
- `dias_semana`: strings en español (lunes, martes, miércoles, etc.) se convierten a números.

**Alias no aceptados:** El backend no acepta `fecha` en lugar de `fecha_clase`, ni un único campo `horario` en lugar de `hora_inicio`/`hora_fin`, ni `clase` en lugar de `nombre_clase`. Solo los nombres indicados arriba.

**Response 201 – Una clase creada:**
```json
{
  "ok": true,
  "id_clase": 42,
  "message": "Clase creada correctamente",
  "clase": {
    "id_clase": 42,
    "id_ambiente": 2,
    "ambiente": "Lab Informática 1",
    "id_instructor": 5,
    "instructor": "Juan Pérez",
    "nombre_clase": "Programación Básica",
    "codigo_ficha": "FIC-123",
    "fecha_clase": "2025-03-01",
    "hora_inicio": "08:00",
    "hora_fin": "10:00",
    "estado_clase": "Programada"
  }
}
```

**Response 201 – Varias clases (recurrentes):**
```json
{
  "ok": true,
  "creadas": 12,
  "message": "Se crearon 12 clases correctamente dentro del rango",
  "clases": [
    { "id_clase": 42, "fecha_clase": "2025-03-01" },
    { "id_clase": 43, "fecha_clase": "2025-03-03" }
  ]
}
```

**Response 207 – Éxito parcial (algunas fechas con conflicto):**
```json
{
  "ok": true,
  "creadas": 8,
  "message": "Se crearon 8 clases, 2 fallaron",
  "clases": [...],
  "errores": [
    { "fecha": "2025-03-05", "error": "Conflicto de horario existente", "clases_conflictivas": [...] }
  ]
}
```

**Errores frecuentes:** 400 (validación, conflicto de horario, fecha/hora pasada), 404 (ambiente/instructor no encontrado o inactivo).

**Reglas de negocio:**
- No se puede crear clase en fecha/hora ya pasada (zona Colombia).
- Se valida conflicto de horario en el mismo ambiente y fecha (estados Programada, En Curso).
- Clases creadas con `estado_clase = 'Programada'`.

---

### 2.2 PUT /api/clases/:id

**Método y ruta:** `PUT /api/clases/:id`

**Request body (todos los campos opcionales; solo se actualizan los enviados):**
```json
{
  "nombre_clase": "Nuevo nombre",
  "codigo_ficha": "FIC-456",
  "descripcion": null,
  "fecha_clase": "2025-03-02",
  "hora_inicio": "09:00:00",
  "hora_fin": "11:00:00",
  "observaciones": "Cambio de horario"
}
```

**Campos que el controller realmente actualiza (allowed):**  
`nombre_clase`, `codigo_ficha`, `descripcion`, `fecha_clase`, `hora_inicio`, `hora_fin`, `observaciones`.  
El validador acepta también `id_ambiente`, `id_instructor`, `estado_clase`, pero **el controller no los aplica**: no se puede cambiar ambiente, instructor ni estado por PUT.

**Validaciones (Zod):**
- `nombre_clase`: min 3, max 200.
- `codigo_ficha`: min 1, max 50.
- `fecha_clase`: YYYY-MM-DD.
- `hora_inicio` / `hora_fin`: HH:MM o HH:MM:SS.
- `estado_clase`: si se envía, el backend rechaza con 400 (“El estado solo puede cambiarse mediante Iniciar/Finalizar/Cancelar”).

**Response 200:**
```json
{
  "ok": true,
  "message": "Clase actualizada correctamente"
}
```

No se devuelve el objeto clase actualizado.

**Reglas de negocio:**
- Solo se puede actualizar si `estado_clase === 'Programada'`.
- Si se cambia fecha, hora o ambiente, se valida conflicto con otras clases (mismo ambiente, fecha, estados Programada/En Curso).
- Instructor/Cuentadante solo puede actualizar sus propias clases.

---

### 2.3 DELETE /api/clases/:id (no existe)

No hay `DELETE /api/clases/:id`. La baja lógica se hace con:

**POST /api/clases/:id/cancelar**

**Método y ruta:** `POST /api/clases/:id/cancelar`  
**Body opcional:** `{ "descripcion_adicional": "Motivo" }`

**Response 200:** `{ "ok": true, "message": "Clase cancelada correctamente" }`

**Reglas:** No se puede cancelar si estado es Finalizada. Si está En Curso, primero se finalizan responsabilidades y luego se marca Cancelada.

---

### 2.4 Otras acciones de clases

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/clases/:id/iniciar | Pasa a "En Curso", asigna responsabilidades. Body opcional: `fecha_inicio_real`. |
| POST | /api/clases/:id/finalizar | Pasa a "Finalizada", cierra responsabilidades. Body opcional: `fecha_fin_real`. |
| POST | /api/clases/:id/participantes | Body: `{ "participantes": [id_aprendiz, ...] }` (1–50). |
| POST | /api/clases/:id/consentimiento/aceptar | Aceptar consentimiento e iniciar clase. |
| POST | /api/clases/:id/consentimiento/rechazar | Rechazar y cancelar clase. |

---

## 3. Creación / edición / eliminación de ambientes

### 3.1 POST /api/ambientes

**Método y ruta:** `POST /api/ambientes`

**Request body – Ejemplo:**
```json
{
  "codigo_ambiente": "LAB-02",
  "nombre_ambiente": "Laboratorio de Redes",
  "tipo_ambiente": "Laboratorio",
  "capacidad_personas": 30,
  "piso": "2",
  "edificio": "Bloque A",
  "descripcion": null,
  "estado_ambiente": "Activo"
}
```

**Campos:**

| Campo             | Obligatorio | Tipo   | Validación |
|-------------------|------------|--------|------------|
| codigo_ambiente   | Sí         | string | No duplicado. |
| nombre_ambiente   | Sí         | string | |
| tipo_ambiente     | Sí         | string | Laboratorio \| Aula \| Taller \| Oficina \| Bodega |
| capacidad_personas| No         | number | null si se omite o vacío. |
| piso              | No         | string | |
| edificio          | No         | string | |
| descripcion       | No         | string | |
| estado_ambiente   | No         | string | Default "Activo". Activo \| Inactivo \| En Mantenimiento |

**Response 201:**
```json
{
  "ok": true,
  "id_ambiente": 3,
  "message": "Ambiente creado correctamente",
  "ambiente": {
    "id_ambiente": 3,
    "codigo_ambiente": "LAB-02",
    "nombre_ambiente": "Laboratorio de Redes",
    "tipo_ambiente": "Laboratorio",
    "estado_ambiente": "Activo"
  }
}
```

**Errores:** 400 (faltan obligatorios o tipo/estado inválido), 409 (código ya existe).

---

### 3.2 PUT /api/ambientes/:id

**Método y ruta:** `PUT /api/ambientes/:id`

**Request body:** Cualquier subconjunto de:  
`codigo_ambiente`, `nombre_ambiente`, `tipo_ambiente`, `capacidad_personas`, `piso`, `edificio`, `descripcion`, `estado_ambiente`.  
Mismos valores permitidos que en POST.

**Response 200:** `{ "ok": true, "message": "Ambiente actualizado correctamente" }`  
No devuelve el objeto ambiente actualizado.

**Errores:** 404 (no existe), 400 (sin cambios o validación), 409 (código duplicado).

---

### 3.3 DELETE /api/ambientes/:id

**Método y ruta:** `DELETE /api/ambientes/:id`

**Request:** Sin body.

**Response 200:** `{ "ok": true, "message": "Ambiente eliminado correctamente" }`

**Reglas de negocio:**
- No se puede eliminar si tiene equipos asignados (Elementos).
- No se puede eliminar si tiene clases en estado Programada o En Curso.

**Errores:** 404 (no existe), 409 (tiene equipos o clases activas).

---

### 3.4 Campos que devuelve el backend y usa el front para ambientes

**Listado (GET /api/ambientes):**  
`id_ambiente`, `codigo_ambiente`, `nombre_ambiente`, `tipo_ambiente`, `capacidad_personas`, `piso`, `edificio`, `descripcion`, `estado_ambiente`, `fecha_creacion`, `total_equipos`, `equipos_disponibles`.

**Detalle (GET /api/ambientes/:id):** Lo anterior más `equipos`, `equipos_en_uso`, `equipos_en_mantenimiento`, `responsables_actuales`, `imagenes`, `uso_consecutivo_instructores`.

**Formulario crear/editar (Ambientes.jsx):** Se rellenan con `codigo_ambiente`, `nombre_ambiente`, `tipo_ambiente`, `capacidad_personas`, `piso`, `edificio`, `descripcion`, `estado_ambiente`; el id para editar es `id_ambiente`.

---

## 4. Campos visibles en UI y origen en backend

### 4.1 Clases (página Horarios)

| Vista        | Campo mostrado | Key(s) en backend |
|-------------|----------------|--------------------|
| Tabla       | Ambiente       | `nombre_ambiente` (título), `codigo_ambiente` (subtítulo) |
| Tabla       | Instructor     | `instructor_nombre` |
| Tabla       | Ficha          | `codigo_ficha` |
| Tabla       | Clase          | `nombre_clase` |
| Tabla       | Fecha          | `fecha_clase` (formateada en front) |
| Tabla       | Horario        | Derivado: `hora_inicio` + " - " + `hora_fin` (a veces recortado a HH:MM) |
| Tabla       | Participantes  | `total_participantes` |
| Tabla       | Estado         | `estado_clase` (Programada, En Curso, Finalizada, Cancelada) |
| Formulario  | Todos los de creación/edición | id_ambiente, id_instructor, nombre_clase, codigo_ficha, descripcion, fecha_clase o fecha_inicio/fecha_fin, dias_semana, hora_inicio, hora_fin, observaciones |

No hay otro campo “horario” en la respuesta; el texto del horario se arma en el front con `hora_inicio` y `hora_fin`.

---

### 4.2 Ambientes (página Ambientes)

| Vista   | Campo mostrado | Key(s) en backend     |
|---------|----------------|------------------------|
| Tabla   | Código         | `codigo_ambiente`      |
| Tabla   | Nombre        | `nombre_ambiente`      |
| Tabla   | Tipo          | `tipo_ambiente`        |
| Tabla   | Estado        | `estado_ambiente`      |
| Formulario | Todos       | codigo_ambiente, nombre_ambiente, tipo_ambiente, capacidad_personas, piso, edificio, descripcion, estado_ambiente |

El detalle (DetalleAmbiente) usa además los campos de GET /api/ambientes/:id (equipos, responsables, imagenes, etc.).

---

## 5. Horarios: importar y plantilla

### 5.1 POST /api/horarios/importar

**Método y ruta:** `POST /api/horarios/importar`  
**Content-Type:** `multipart/form-data`  
**Body:** campo `archivo` (Excel .xlsx/.xls o CSV, máx 5MB).

Columnas esperadas (por nombre o alias):
- Ambiente/código → codigo_ambiente  
- Instructor/docente → instructor  
- Ficha/grupo → codigo_ficha  
- Clase/nombre → nombre_clase  
- Fecha (o fecha inicio/fin + días semana)  
- Hora inicio / Hora fin  
- Descripción/observación (opcional)

**Response 200/207:** Estructura con `resultados.exitosos`, `resultados.errores`, `resultados.warnings` (o propiedades análogas `exitosos`, `errores`, `warnings`). El front usa esto para mostrar resumen de importación.

### 5.2 GET /api/horarios/plantilla

**Método y ruta:** `GET /api/horarios/plantilla`  
**Response:** Archivo binario (plantilla Excel) para descarga. Nombre sugerido en front: `plantilla_horarios.xlsx`.

---

## Resumen de rutas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | /api/clases | Listar clases (paginado, filtros) |
| GET    | /api/clases/nombres | Nombres para autocompletado |
| GET    | /api/clases/:id | Detalle de una clase |
| POST   | /api/clases | Crear clase(s) (única o recurrentes) |
| PUT    | /api/clases/:id | Actualizar clase (solo Programada) |
| POST   | /api/clases/:id/iniciar | Iniciar clase |
| POST   | /api/clases/:id/finalizar | Finalizar clase |
| POST   | /api/clases/:id/cancelar | Cancelar clase (no DELETE) |
| POST   | /api/clases/:id/participantes | Agregar participantes |
| POST   | /api/clases/:id/consentimiento/aceptar | Aceptar consentimiento e iniciar |
| POST   | /api/clases/:id/consentimiento/rechazar | Rechazar y cancelar |
| POST   | /api/clases/sincronizar-responsabilidades | Sincronizar responsabilidades |
| POST   | /api/clases/nombres | Crear nombre de clase (autocompletado) |
| GET    | /api/ambientes | Listar ambientes |
| GET    | /api/ambientes/activos | Listar ambientes activos (reducido) |
| GET    | /api/ambientes/asignaciones | Listar asignaciones |
| GET    | /api/ambientes/:id | Detalle ambiente |
| GET    | /api/ambientes/:id/instructores | Instructores del ambiente |
| POST   | /api/ambientes | Crear ambiente |
| PUT    | /api/ambientes/:id | Actualizar ambiente |
| DELETE | /api/ambientes/:id | Eliminar ambiente |
| POST   | /api/horarios/importar | Importar Excel |
| GET    | /api/horarios/plantilla | Descargar plantilla Excel |

Todas las rutas requieren autenticación (Bearer token) y permisos según `PERMISSIONS.CLASES.*` / `PERMISSIONS.AMBIENTES.*`.
