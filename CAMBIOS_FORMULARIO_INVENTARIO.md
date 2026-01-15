# Cambios en el Formulario de Registro de Inventario

## 📋 Resumen de Cambios para Flutter

Este documento detalla todos los cambios realizados en el formulario de registro de inventario que deben implementarse en la app móvil Flutter.

---

## ❌ Campos Eliminados

Los siguientes campos **YA NO EXISTEN** y deben ser removidos de la app:

1. **`marca`** ❌
   - Antes: Campo de texto para la marca del equipo
   - Ahora: Eliminado completamente

2. **`numero_serie`** ❌
   - Antes: Campo de texto para el número de serie
   - Ahora: Eliminado completamente

3. **`vida_util_meses`** ❌
   - Antes: Campo numérico para la vida útil en meses
   - Ahora: Eliminado completamente

---

## ✅ Campos Nuevos

Los siguientes campos son **NUEVOS** y deben agregarse a la app:

1. **`categoria`** ⭐ **OBLIGATORIO**
   - Tipo: `String`
   - Descripción: Nombre de la categoría del equipo
   - Validación: Requerido, min: 1, max: 100 caracteres
   - Ejemplos: `"ADAPTADOR DE RED"`, `"ACCES POINT"`, `"PORTATIL"`, `"CPU"`
   - **IMPORTANTE**: Es el **nombre** de la categoría, no el ID
   - **Obtener lista**: Usar endpoint `GET /api/equipos/categorias`

2. **`id_cuentadante`** ⭐ **OBLIGATORIO para Administradores**
   - Tipo: `int?` (nullable)
   - Descripción: ID del cuentadante responsable del equipo
   - Validación: 
     - Para Administradores: **Obligatorio**
     - Para Cuentadantes: Se asigna automáticamente (no enviar)
   - **Obtener ID**: Usar endpoint `GET /api/equipos/cuentadantes/buscar/{documento}`

---

## 🔄 Campos Modificados

Los siguientes campos cambiaron su comportamiento o validación:

### 1. **`tipo`** - Cambio Mayor

**ANTES:**
- Tipo: Dropdown/Select con opciones de categorías
- Usuario seleccionaba una categoría del dropdown
- Se guardaba el nombre de la categoría

**AHORA:**
- Tipo: Campo de texto **READONLY** (solo lectura)
- Valor: Siempre `"4"` (string fijo)
- **Acción requerida**: 
  - Mostrar como campo deshabilitado/readonly
  - Valor fijo: `"4"`
  - No permitir edición

### 2. **`descripcion`** - Cambio de Propósito

**ANTES:**
- Contenía el nombre de la categoría seleccionada
- Se usaba como dropdown con las categorías

**AHORA:**
- Campo de texto libre (textarea)
- Descripción opcional del equipo
- **Acción requerida**:
  - Cambiar de dropdown a textarea
  - Permitir texto libre
  - Hacer opcional

### 3. **`placa`** - Cambio de Validación

**ANTES:**
- Campo opcional
- Podía estar vacío

**AHORA:**
- Campo **OBLIGATORIO**
- Validación: Requerido, max: 100 caracteres
- Debe ser único en el sistema
- **Acción requerida**: Agregar validación de campo obligatorio

### 4. **`ambiente`** - Más Flexible

**ANTES:**
- Solo aceptaba ID numérico

**AHORA:**
- Acepta múltiples formatos:
  - ID numérico: `15`
  - Código del ambiente: `"101"`, `"Neutral"`
  - Nombre del ambiente: `"Ambiente 101"`
- **Acción requerida**: Aceptar cualquiera de estos formatos

---

## 📊 Estructura del Formulario

### Organización por Secciones

El formulario ahora está organizado en secciones lógicas:

1. **Información Básica**
   - Tipo (readonly: "4")
   - Categoría* (dropdown - NUEVO)
   - Modelo*
   - Consecutivo*
   - Placa*

2. **Ubicación y Estado**
   - Centro (readonly: "00000")
   - Ambiente* (dropdown)
   - Estado Físico* (dropdown)

3. **Información Financiera**
   - Fecha Adquisición*
   - Valor Ingreso (opcional)

4. **Información Adicional**
   - Descripción (textarea - opcional)
   - Atributos (textarea - opcional)
   - Comentarios (textarea - opcional)

5. **Asignar Cuentadante** (Solo para Administradores)
   - Campo de búsqueda por documento
   - Botón "Buscar"
   - Mostrar información del cuentadante encontrado
   - Campo oculto: `id_cuentadante`

---

## 🔍 Endpoints Adicionales Necesarios

### 1. Obtener Categorías

```
GET /api/equipos/categorias
Headers: Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id_categoria": 1,
    "nombre_categoria": "ADAPTADOR DE RED",
    "descripcion": "Adaptadores de red",
    "es_componente": false
  },
  ...
]
```

**Uso**: Poblar el dropdown de `categoria` con `nombre_categoria`

### 2. Buscar Cuentadante (Solo Administradores)

```
GET /api/equipos/cuentadantes/buscar/{documento}
Headers: Authorization: Bearer {token}
```

**Ejemplo**: `GET /api/equipos/cuentadantes/buscar/1065843799`

**Response:**
```json
{
  "id_usuario": 5,
  "nombre_usuario": "Gabriel Durango Morales",
  "cedula": "1065843799",
  "nombre_rol": "Cuentadante",
  "equipos_asignados": 10
}
```

**Uso**: 
- Mostrar nombre y documento del cuentadante
- Guardar `id_usuario` en el campo `id_cuentadante` del request

---

## 📝 Ejemplo de Request Actualizado

### Request Body Completo

```json
{
  "tipo": "4",
  "categoria": "ADAPTADOR DE RED",
  "modelo": "TP-LINK TL-WA850RE",
  "consecutivo": "123456",
  "placa": "92041025706",
  "estado_fisico": "Bueno",
  "fecha_adquisicion": "2024-01-15",
  "ambiente": "Neutral",
  "descripcion": "Adaptador de red inalámbrico",
  "valor_ingreso": 150000,
  "atributos": "WiFi 802.11n, 300Mbps",
  "comentarios": "Equipo nuevo en caja",
  "id_cuentadante": 5,
  "r_centro": "00000"
}
```

### Comparación: Antes vs Ahora

| Campo | Antes | Ahora |
|-------|-------|-------|
| `tipo` | Dropdown con categorías | Fijo: `"4"` (readonly) |
| `categoria` | ❌ No existía | ✅ Obligatorio (nombre) |
| `marca` | ✅ Existía | ❌ Eliminado |
| `numero_serie` | ✅ Existía | ❌ Eliminado |
| `vida_util_meses` | ✅ Existía | ❌ Eliminado |
| `descripcion` | Dropdown (categorías) | Textarea (texto libre) |
| `placa` | Opcional | Obligatorio |
| `id_cuentadante` | ❌ No existía | ✅ Obligatorio (Admin) |

---

## 🎯 Checklist de Implementación Flutter

### Campos a Eliminar
- [ ] Remover campo `marca`
- [ ] Remover campo `numero_serie`
- [ ] Remover campo `vida_util_meses`

### Campos a Agregar
- [ ] Agregar campo `categoria` (dropdown, obligatorio)
- [ ] Agregar campo `id_cuentadante` (oculto, obligatorio para Admin)
- [ ] Implementar búsqueda de cuentadante por documento

### Campos a Modificar
- [ ] Cambiar `tipo` a readonly con valor fijo "4"
- [ ] Cambiar `descripcion` de dropdown a textarea
- [ ] Hacer `placa` obligatorio
- [ ] Actualizar validación de `ambiente` (aceptar ID, código o nombre)

### Endpoints a Implementar
- [ ] `GET /api/equipos/categorias` - Obtener categorías
- [ ] `GET /api/equipos/cuentadantes/buscar/{documento}` - Buscar cuentadante

### Validaciones a Actualizar
- [ ] Validar que `tipo` sea siempre "4"
- [ ] Validar que `categoria` esté presente
- [ ] Validar que `placa` esté presente y sea único
- [ ] Validar que `id_cuentadante` esté presente (solo Admin)
- [ ] Remover validaciones de campos eliminados

### UI/UX a Actualizar
- [ ] Reorganizar formulario en secciones
- [ ] Mostrar campo `tipo` como readonly/disabled
- [ ] Cambiar `descripcion` a textarea
- [ ] Agregar búsqueda de cuentadante (solo Admin)
- [ ] Mostrar información del cuentadante encontrado

---

## ⚠️ Errores Comunes a Evitar

1. **NO enviar campos eliminados**: No incluir `marca`, `numero_serie`, `vida_util_meses` en el request
2. **NO usar ID para categoria**: Enviar el **nombre** de la categoría, no el ID
3. **NO permitir editar tipo**: El campo `tipo` debe ser readonly con valor "4"
4. **NO olvidar id_cuentadante**: Para Administradores es obligatorio
5. **NO usar descripcion como categoria**: `descripcion` ahora es texto libre, `categoria` es el dropdown

---

## 🔗 Referencias

- Documentación completa de la API: `API_REGISTRO_INVENTARIO.md`
- Endpoint principal: `POST /api/equipos`
- Endpoint categorías: `GET /api/equipos/categorias`
- Endpoint buscar cuentadante: `GET /api/equipos/cuentadantes/buscar/{documento}`

---

## 📞 Soporte

Si hay dudas sobre la implementación, consultar:
- La documentación completa en `API_REGISTRO_INVENTARIO.md`
- Los ejemplos de request/response en la documentación
- El código del frontend web en `frontend/src/pages/Equipos.jsx`

