# API - Registro de Inventario (Equipos)

## Endpoint

```
POST /api/equipos
```

## Autenticación

**Requerida**: Sí (Bearer Token)

**Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

## Permisos

- **Rol requerido**: Administrador
- **Permiso**: `EQUIPOS.CREATE`

## Request Body (JSON)

### Campos Obligatorios

| Campo | Tipo | Descripción | Validación |
|-------|------|-------------|------------|
| `tipo` | string | Tipo de equipo (valor fijo: "4") | Requerido, min: 1, max: 100 |
| `categoria` | string | Nombre de la categoría del equipo | Requerido, min: 1, max: 100 |
| `modelo` | string | Modelo del equipo | Requerido, max: 100 |
| `consecutivo` | string | Consecutivo del equipo | Requerido |
| `placa` | string | Placa/código de inventario | Requerido, max: 100 |
| `estado_fisico` | string | Estado físico del equipo | Requerido, enum: 'Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado' |
| `fecha_adquisicion` | string | Fecha de adquisición | Requerido, formato: 'YYYY-MM-DD' |
| `ambiente` | string | Código o ID del ambiente | Requerido (puede ser ID numérico o código string) |

### Campos Opcionales

| Campo | Tipo | Descripción | Validación |
|-------|------|-------------|------------|
| `codigo_inventario` | string | Alias de `placa` (si no se envía `placa`) | Opcional |
| `descripcion` | string | Descripción libre del equipo | Opcional, texto libre |
| `valor_ingreso` | number/string | Valor de ingreso del equipo | Opcional, número >= 0 |
| `costo` | number/string | Alias de `valor_ingreso` | Opcional, número >= 0 |
| `atributos` | string | Atributos adicionales del equipo | Opcional |
| `specs_completas` | string | Especificaciones completas | Opcional |
| `comentarios` | string | Comentarios adicionales | Opcional, max: 1000 |
| `id_ambiente` | number/string | ID numérico del ambiente | Opcional (alternativa a `ambiente`) |
| `id_cuentadante` | number/string | ID del cuentadante responsable | Opcional, requerido para Administradores |
| `r_centro` | string | Código del centro | Opcional, default: "00000" |
| `centro` | string | Alias de `r_centro` | Opcional |

### Notas Importantes

1. **Campo `tipo`**: Siempre debe ser el valor fijo `"4"` (string)
2. **Campo `categoria`**: Debe ser el **nombre** de la categoría (ej: "ADAPTADOR DE RED", "ACCES POINT", "PORTATIL"). El sistema busca o crea automáticamente la categoría.
3. **Campo `placa`**: Es obligatorio y debe ser único. Si no se envía `placa`, se puede usar `codigo_inventario` como alternativa.
4. **Campo `ambiente`**: Puede ser:
   - ID numérico del ambiente (ej: `1`, `2`)
   - Código del ambiente (ej: `"101"`, `"Neutral"`)
   - Nombre del ambiente (ej: `"Ambiente 101"`)
5. **Campo `id_cuentadante`**: 
   - Para **Administradores**: Es obligatorio. Debe ser el ID numérico del cuentadante.
   - Para **Cuentadantes**: Se asigna automáticamente al usuario autenticado.
6. **Campo `descripcion`**: Es un campo de texto libre. Si se envían `comentarios`, se combinan con la descripción.
7. **Campos eliminados**: Los siguientes campos ya NO existen:
   - `marca` ❌
   - `numero_serie` ❌
   - `vida_util_meses` ❌

## Ejemplo de Request

### Ejemplo 1: Registro completo (Administrador)

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

### Ejemplo 2: Registro mínimo (Cuentadante)

```json
{
  "tipo": "4",
  "categoria": "ACCES POINT",
  "modelo": "TL-WA80IN",
  "consecutivo": "232938",
  "placa": "92041025707",
  "estado_fisico": "Bueno",
  "fecha_adquisicion": "2021-12-22",
  "ambiente": "101"
}
```

### Ejemplo 3: Con ID de ambiente numérico

```json
{
  "tipo": "4",
  "categoria": "PORTATIL",
  "modelo": "HP ProBook 450",
  "consecutivo": "789012",
  "placa": "92051012143",
  "estado_fisico": "Nuevo",
  "fecha_adquisicion": "2026-01-08",
  "id_ambiente": 15,
  "valor_ingreso": 3000000,
  "descripcion": "Laptop para instructores",
  "id_cuentadante": 10
}
```

## Response

### Success Response (201 Created)

```json
{
  "ok": true,
  "id": 123
}
```

**Campos**:
- `ok`: boolean - Indica éxito de la operación
- `id`: number - Código del equipo creado (`codigo_equipo`)

### Error Responses

#### 400 Bad Request - Validación fallida

```json
{
  "error": "Faltan campos obligatorios: tipo, modelo, estado_fisico o fecha_adquisicion"
}
```

```json
{
  "error": "La categoría es obligatoria"
}
```

```json
{
  "error": "El ambiente es obligatorio"
}
```

```json
{
  "error": "El ID del cuentadante es inválido o faltante para un Administrador"
}
```

#### 409 Conflict - Placa duplicada

```json
{
  "error": "La placa ya está registrada"
}
```

#### 401 Unauthorized - No autenticado

```json
{
  "error": "Token inválido"
}
```

#### 403 Forbidden - Sin permisos

```json
{
  "error": "No tienes permisos para realizar esta acción"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Error al registrar equipo",
  "detalle": "Mensaje de error detallado"
}
```

## Endpoint Adicional: Obtener Categorías

Para obtener la lista de categorías disponibles antes de registrar:

```
GET /api/equipos/categorias
```

**Headers**:
```
Authorization: Bearer {token}
```

**Response (200 OK)**:
```json
[
  {
    "id_categoria": 1,
    "nombre_categoria": "ADAPTADOR DE RED",
    "descripcion": "Adaptadores de red",
    "es_componente": false
  },
  {
    "id_categoria": 2,
    "nombre_categoria": "ACCES POINT",
    "descripcion": "Puntos de acceso inalámbricos",
    "es_componente": false
  },
  ...
]
```

## Endpoint Adicional: Buscar Cuentadante

Para buscar un cuentadante por documento (solo Administradores):

```
GET /api/equipos/cuentadantes/buscar/{documento}
```

**Headers**:
```
Authorization: Bearer {token}
```

**Response (200 OK)**:
```json
{
  "id_usuario": 5,
  "nombre_usuario": "Gabriel Durango Morales",
  "cedula": "1065843799",
  "nombre_rol": "Cuentadante",
  "equipos_asignados": 10
}
```

## Cambios Importantes desde la Versión Anterior

### ✅ Campos Agregados
- `categoria` (obligatorio) - Nombre de la categoría
- `id_cuentadante` (obligatorio para Administradores) - ID del cuentadante

### ❌ Campos Eliminados
- `marca` - Ya no existe
- `numero_serie` - Ya no existe
- `vida_util_meses` - Ya no existe

### 🔄 Campos Modificados
- `tipo`: Ahora es un valor fijo `"4"` (antes era un dropdown de categorías)
- `descripcion`: Ahora es un campo de texto libre (antes contenía la categoría)
- `placa`: Ahora es obligatorio (antes era opcional)
- `ambiente`: Puede ser ID numérico, código o nombre (más flexible)

### 📝 Notas de Migración

1. **Categorías**: El campo `categoria` debe contener el **nombre** de la categoría, no el ID. Usar el endpoint `/api/equipos/categorias` para obtener la lista.

2. **Cuentadante**: Para Administradores, es obligatorio buscar el cuentadante primero usando `/api/equipos/cuentadantes/buscar/{documento}` y luego enviar el `id_cuentadante` en el request.

3. **Tipo**: Siempre enviar `"4"` como string.

4. **Descripción**: Ahora es un campo de texto libre opcional. La categoría va en el campo `categoria`.

## Flujo Recomendado para la App Flutter

1. **Obtener categorías disponibles**:
   ```
   GET /api/equipos/categorias
   ```

2. **Obtener ambientes disponibles** (si aplica):
   ```
   GET /api/ambientes
   ```

3. **Si es Administrador, buscar cuentadante** (si aplica):
   ```
   GET /api/equipos/cuentadantes/buscar/{documento}
   ```

4. **Registrar equipo**:
   ```
   POST /api/equipos
   Body: { ... }
   ```

5. **Manejar respuesta**:
   - Success: Mostrar mensaje de éxito con el ID del equipo
   - Error: Mostrar mensaje de error al usuario

## Ejemplo de Código Flutter (Dart)

```dart
// Modelo de datos
class EquipoRegistro {
  final String tipo = "4";
  final String categoria;
  final String modelo;
  final String consecutivo;
  final String placa;
  final String estadoFisico;
  final String fechaAdquisicion;
  final String ambiente;
  final String? descripcion;
  final double? valorIngreso;
  final String? atributos;
  final String? comentarios;
  final int? idCuentadante;
  
  Map<String, dynamic> toJson() {
    return {
      'tipo': tipo,
      'categoria': categoria,
      'modelo': modelo,
      'consecutivo': consecutivo,
      'placa': placa,
      'estado_fisico': estadoFisico,
      'fecha_adquisicion': fechaAdquisicion,
      'ambiente': ambiente,
      'descripcion': descripcion,
      'valor_ingreso': valorIngreso,
      'atributos': atributos,
      'comentarios': comentarios,
      'id_cuentadante': idCuentadante,
      'r_centro': '00000',
    };
  }
}

// Servicio
Future<Map<String, dynamic>> registrarEquipo(EquipoRegistro equipo) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/equipos'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode(equipo.toJson()),
  );
  
  if (response.statusCode == 201) {
    return jsonDecode(response.body);
  } else {
    final error = jsonDecode(response.body);
    throw Exception(error['error'] ?? 'Error al registrar equipo');
  }
}
```

