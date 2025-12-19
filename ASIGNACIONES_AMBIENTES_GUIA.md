# Instrucciones de Migración - Asignaciones de Ambientes con Rango de Fechas

## Descripción

Se ha actualizado el sistema de asignación de ambientes a instructores para incluir:
- Rango de fechas (fecha inicio y fecha fin)
- Selección de días específicos de la semana
- Rango de horas (hora inicio y hora fin)

El sistema ahora expande automáticamente las asignaciones para todos los días seleccionados dentro del rango de fechas especificado.

## Cambios en la Base de Datos

### Nuevas Columnas en `Responsabilidades_Ambiente`

Se agregaron dos nuevos campos para almacenar horarios:

```sql
ALTER TABLE Responsabilidades_Ambiente 
ADD COLUMN hora_inicio TIME NULL COMMENT 'Hora de inicio de la asignación';

ALTER TABLE Responsabilidades_Ambiente 
ADD COLUMN hora_fin TIME NULL COMMENT 'Hora de fin de la asignación';

ALTER TABLE Responsabilidades_Ambiente 
ADD COLUMN dia_semana INT NULL COMMENT 'Día de la semana (0=domingo, 1=lunes, etc.)';
```

### Nuevos Índices para Optimización

```sql
ALTER TABLE Responsabilidades_Ambiente 
ADD INDEX idx_fecha_horas (fecha_inicio, hora_inicio, hora_fin);

ALTER TABLE Responsabilidades_Ambiente 
ADD INDEX idx_dia_semana (dia_semana);
```

### Columna `asignacion_automatica` (ya existente)

Esta columna se utiliza para marcar asignaciones generadas automáticamente por rango de fechas:
- `TRUE` = Asignación generada automáticamente por rango de fechas
- `FALSE` = Asignación manual o de clase

## Cambios en el Backend

### Nuevo Servicio: `ambientesService.js`

Ubicación: `backend/src/services/ambientesService.js`

Funciones principales:
- `expandirAsignacionesPorFechas()` - Genera todas las asignaciones para días específicos dentro de un rango
- `convertirNombresDiasANumeros()` - Convierte nombres de días a números ISO
- `validarRangoHoras()` - Valida rangos de horas válidos
- `validarRangoFechas()` - Valida rangos de fechas válidos
- `calcularCantidadAsignaciones()` - Calcula cuántas asignaciones se generarán

### Cambios en el Controlador: `ambientesController.js`

La función `asignarAmbienteInstructor()` ahora:
1. Recibe rango de fechas, días de la semana y horas
2. Valida todos los campos de entrada
3. Expande automáticamente las asignaciones
4. Verifica conflictos de asignaciones
5. Crea todas las asignaciones en una transacción

Parámetros esperados en el request:

```json
{
  "id_ambiente": 1,
  "id_instructor": 5,
  "fecha_inicio": "2024-12-19",
  "fecha_fin": "2025-01-09",
  "dias_semana": ["Viernes"],
  "hora_inicio": "08:00",
  "hora_fin": "12:00",
  "observaciones": "Observaciones opcionales"
}
```

Respuesta exitosa:

```json
{
  "ok": true,
  "message": "Ambiente \"Laboratorio 1\" asignado correctamente a Juan Perez para 4 fechas",
  "cantidad_asignaciones": 4,
  "fecha_inicio": "2024-12-19",
  "fecha_fin": "2025-01-09",
  "dias_semana": ["Viernes"],
  "hora_inicio": "08:00",
  "hora_fin": "12:00",
  "asignaciones": [
    {
      "id": 1001,
      "fecha": "2024-12-27",
      "dia": "Viernes",
      "hora_inicio": "08:00",
      "hora_fin": "12:00"
    },
    ...
  ]
}
```

## Cambios en el Frontend

### Componente: `AsignarAmbientes.jsx`

Nuevos campos en el formulario:
- **Fecha Inicio** (input date) - Seleccionar fecha de inicio
- **Fecha Fin** (input date) - Seleccionar fecha de fin
- **Días de la Semana** (checkboxes) - Seleccionar múltiples días
- **Hora Inicio** (input time) - Seleccionar hora de inicio
- **Hora Fin** (input time) - Seleccionar hora de fin

Características:
- Validación en tiempo real de rangos de fechas
- Cálculo en vivo del número de asignaciones que se generarán
- Vista previa informativa antes de confirmar
- Mejor presentación de datos con horas

Columnas de la tabla actualizada:
- Instructor
- Fecha (de la asignación específica)
- Hora Inicio
- Hora Fin
- Estado
- Observaciones
- Acciones

## Procedimiento de Migración

### Paso 1: Ejecutar el Script SQL

```bash
# Conectar a la base de datos
mysql -h DB_HOST -u DB_USER -p DB_NAME < BD/migrations/001_add_hora_to_responsabilidades_ambiente.sql
```

O ejecutar manualmente en MySQL:

```sql
ALTER TABLE Responsabilidades_Ambiente 
ADD COLUMN hora_inicio TIME NULL COMMENT 'Hora de inicio de la asignación' AFTER fecha_inicio,
ADD COLUMN hora_fin TIME NULL COMMENT 'Hora de fin de la asignación' AFTER hora_inicio,
ADD COLUMN dia_semana INT NULL COMMENT 'Día de la semana' AFTER hora_fin;

ALTER TABLE Responsabilidades_Ambiente 
ADD INDEX idx_fecha_horas (fecha_inicio, hora_inicio, hora_fin);

ALTER TABLE Responsabilidades_Ambiente 
ADD INDEX idx_dia_semana (dia_semana);
```

### Paso 2: Actualizar el Backend

1. Copiar nuevo archivo: `src/services/ambientesService.js`
2. Actualizar: `src/controller/ambientesController.js`
3. Reiniciar el servidor

```bash
cd backend
npm install  # Si hay nuevas dependencias
npm run dev
```

### Paso 3: Actualizar el Frontend

1. Actualizar: `frontend/src/pages/AsignarAmbientes.jsx`
2. Reconstruir el frontend

```bash
cd frontend
npm install  # Si hay nuevas dependencias
npm run build
```

## Ejemplos de Uso

### Ejemplo 1: Asignar Laboratorio todos los viernes en diciembre

```javascript
const asignacion = {
  id_ambiente: 1,
  id_instructor: 5,
  fecha_inicio: "2024-12-01",
  fecha_fin: "2024-12-31",
  dias_semana: ["Viernes"],
  hora_inicio: "08:00",
  hora_fin: "12:00",
  observaciones: "Laboratorio de Sistemas 1"
};
```

**Resultado:** Se crearán 4 asignaciones (viernes del mes)

### Ejemplo 2: Asignar Aula lunes y miércoles (6 semanas)

```javascript
const asignacion = {
  id_ambiente: 2,
  id_instructor: 10,
  fecha_inicio: "2025-01-13",
  fecha_fin: "2025-02-28",
  dias_semana: ["Lunes", "Miércoles"],
  hora_inicio: "14:00",
  hora_fin: "16:00",
  observaciones: "Clases de Programación"
};
```

**Resultado:** Se crearán 12 asignaciones (2 días × 6 semanas)

### Ejemplo 3: Asignar Taller todos los días laborales

```javascript
const asignacion = {
  id_ambiente: 3,
  id_instructor: 15,
  fecha_inicio: "2025-01-01",
  fecha_fin: "2025-01-31",
  dias_semana: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
  hora_inicio: "09:00",
  hora_fin: "17:00",
  observaciones: "Disponibilidad completa"
};
```

**Resultado:** Se crearán 21 asignaciones (5 días × 4 semanas + 1)

## Compatibilidad hacia Atrás

⚠️ **Nota Importante:**

Las asignaciones antiguas (sin fechas y horas específicas) seguirán funcionando, pero:
- Los campos `hora_inicio` y `hora_fin` serán `NULL`
- No se mostrarán horas en la tabla
- Se recomienda migrar asignaciones antiguas a las nuevas

Para migrar asignaciones antiguas:
1. Registrar los horarios en los campos nuevos
2. O eliminar y recrear con el nuevo sistema

## Validaciones

El sistema valida automáticamente:

✅ **Campos Obligatorios**
- Ambiente
- Instructor (debe ser activo)
- Rango de fechas válido
- Al menos un día seleccionado
- Horas válidas (HH:mm)

✅ **Rangos de Fechas**
- Fecha fin ≥ fecha inicio
- Formatos válidos (YYYY-MM-DD)

✅ **Rangos de Horas**
- Formato válido (HH:mm)
- Hora fin > hora inicio

✅ **Conflictos**
- No permite asignaciones solapadas del mismo instructor en el mismo día
- Verifica disponibilidad antes de confirmar

## Generación de Asignaciones

El algoritmo de expansión:

```javascript
for cada día en rango_fechas:
  if día_de_semana en días_seleccionados:
    crear_asignacion(
      fecha: día,
      hora_inicio: usuario_hora_inicio,
      hora_fin: usuario_hora_fin,
      asignacion_automatica: true
    )
```

## Beneficios

✨ **Ventajas del nuevo sistema:**

1. **Flexibilidad** - Asignar por día de semana, no solo por jornada
2. **Escalabilidad** - Crear múltiples asignaciones de una sola vez
3. **Precisión** - Especificar horarios exactos
4. **Automatización** - Reduce entrada manual de datos
5. **Conflicto** - Detecta automáticamente conflictos de horarios
6. **Transacciones** - Todas las asignaciones se crean o ninguna (atómico)

## Troubleshooting

### Error: "Conflicto de asignaciones"
**Causa:** El instructor ya tiene asignaciones en una de las fechas seleccionadas.
**Solución:** 
- Verificar fechas disponibles
- O desasignar las fechas en conflicto primero

### Error: "Sin asignaciones generadas"
**Causa:** No hay fechas en el rango que coincidan con los días seleccionados.
**Solución:**
- Verificar el rango de fechas
- Asegurarse de seleccionar al menos un día de la semana

### Horas no se muestran
**Causa:** Los campos fueron añadidos después, asignaciones antiguas no tienen valores.
**Solución:**
- Actualizar asignaciones antiguas
- O crear nuevas asignaciones con el nuevo sistema

## Soporte

Para reportar problemas o sugerencias:
- Abrir issue en el repositorio
- Contactar al equipo de desarrollo
