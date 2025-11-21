# Sistema Completo de Gestión de Horarios - Documentación

## Resumen del Sistema Implementado

Se ha implementado un sistema completo de gestión de horarios de clases con asignación automática de responsabilidades de inventario.

## Estructura de Base de Datos

### Tabla Clases (Mejorada)
- `codigo_ficha`: Código de la ficha/grupo de aprendices
- Campos existentes: `id_ambiente`, `id_instructor`, `fecha_clase`, `hora_inicio`, `hora_fin`, etc.

### Tabla Responsabilidades_Ambiente (Mejorada)
- `asignacion_automatica`: Indica si fue asignada automáticamente por horario
- `jornada`: Para asignaciones permanentes (Mañana, Tarde, Noche)

### Vista Vista_Responsables_Actuales
- Consulta optimizada para obtener responsables actuales de un ambiente

## Funcionalidades Backend

### 1. Gestión de Horarios (`clasesController.js`)

#### `crearClase()`
- Crea una nueva clase con validación de conflictos de horario
- Valida que no haya dos instructores en el mismo ambiente al mismo tiempo
- Incluye campo `codigo_ficha` para identificar el grupo

#### `actualizarClase()`
- Actualiza clases programadas
- Valida conflictos al cambiar fecha, hora o ambiente
- Solo permite actualizar clases en estado "Programada"

#### `consultarResponsablesTiempoReal()`
- Consulta responsables de un ambiente en una fecha y hora específicas
- Retorna:
  - Responsable principal (instructor)
  - Responsables secundarios (aprendices)
  - Información de la clase activa (si existe)
  - Responsables permanentes (si no hay clase activa)

#### `sincronizarResponsabilidadesHorarios()`
- Asigna automáticamente responsabilidades basándose en horarios
- Finaliza responsabilidades de clases que ya terminaron
- Actualiza estado de clases a "En Curso" cuando corresponde
- Se puede ejecutar manualmente o automáticamente (cron job)

### 2. Importación Excel (`horariosController.js`)

#### `importarHorariosExcel()`
- Importa horarios desde archivo Excel/CSV
- Formato esperado:
  - Código Ambiente
  - Instructor (Nombre o Cédula)
  - Código Ficha
  - Nombre Clase
  - Fecha (YYYY-MM-DD)
  - Hora Inicio (HH:MM)
  - Hora Fin (HH:MM)
  - Descripción (opcional)
- Valida conflictos y datos antes de insertar
- Retorna reporte de éxitos y errores

#### `descargarPlantillaHorarios()`
- Genera plantilla Excel para importación
- Incluye ejemplos y formato correcto

## Rutas API

### Clases
- `POST /api/clases` - Crear clase
- `GET /api/clases` - Listar clases
- `GET /api/clases/:id` - Obtener clase
- `PUT /api/clases/:id` - Actualizar clase
- `POST /api/clases/:id/iniciar` - Iniciar clase
- `POST /api/clases/:id/finalizar` - Finalizar clase
- `POST /api/clases/:id/cancelar` - Cancelar clase
- `POST /api/clases/:id/participantes` - Agregar participantes
- `GET /api/ambientes/:id_ambiente/responsables` - Responsables actuales
- `GET /api/ambientes/:id_ambiente/responsables-tiempo-real?fecha=YYYY-MM-DD&hora=HH:MM` - Consulta tiempo real
- `POST /api/clases/sincronizar-responsabilidades` - Sincronizar responsabilidades

### Horarios
- `POST /api/horarios/importar` - Importar desde Excel
- `GET /api/horarios/plantilla` - Descargar plantilla

## Validaciones Implementadas

1. **Conflictos de Horario**: No permite dos clases en el mismo ambiente al mismo tiempo
2. **Formato de Fechas**: Valida formato YYYY-MM-DD
3. **Formato de Horas**: Valida formato HH:MM o HH:MM:SS
4. **Hora Fin > Hora Inicio**: Valida que la hora de fin sea mayor
5. **Ambiente Activo**: Solo permite ambientes activos
6. **Instructor Válido**: Valida que el instructor exista y esté activo
7. **Estado de Clase**: Solo permite actualizar clases programadas

## Lógica de Asignación Automática

1. **Al Iniciar Clase**:
   - Asigna responsabilidad principal al instructor
   - Asigna responsabilidades secundarias a aprendices presentes
   - Finaliza responsabilidades anteriores que se solapen

2. **Al Finalizar Clase**:
   - Finaliza todas las responsabilidades de la clase
   - Cambia estado de clase a "Finalizada"

3. **Sincronización Automática**:
   - Busca clases que deberían estar activas
   - Asigna responsabilidades automáticamente
   - Finaliza responsabilidades de clases terminadas

## Consulta de Responsables en Tiempo Real

El sistema permite consultar quién es responsable de un ambiente en cualquier fecha y hora:

1. **Si hay clase activa**:
   - Retorna instructor como responsable principal
   - Retorna aprendices como responsables secundarios

2. **Si no hay clase activa**:
   - Busca responsabilidades permanentes por jornada
   - Retorna responsables permanentes del ambiente

## Importación Masiva

El sistema permite importar horarios desde Excel:

1. **Formato Flexible**: Detecta columnas por nombre (no requiere orden específico)
2. **Validación Completa**: Valida todos los datos antes de insertar
3. **Reporte Detallado**: Retorna lista de éxitos y errores con detalles
4. **Plantilla Disponible**: Proporciona plantilla con formato correcto

## Próximos Pasos (Frontend)

1. Crear página `GestionarHorarios.jsx` con:
   - Lista de horarios con filtros
   - Formulario para crear/editar horarios
   - Importación desde Excel
   - Consulta de responsables en tiempo real
   - Vista de calendario (opcional)

2. Agregar ruta en `App.jsx`
3. Agregar enlace en `Sidebar.jsx`

## Scripts SQL a Ejecutar

1. `BD/mejorar_sistema_horarios.sql` - Mejoras a la estructura
2. `BD/agregar_jornada_ambientes.sql` - Campo jornada (si no se ejecutó antes)

## Notas Importantes

- El sistema valida conflictos de horario automáticamente
- Las responsabilidades se asignan automáticamente al iniciar clases
- Se puede sincronizar responsabilidades manualmente o con cron job
- La importación Excel es flexible y valida todos los datos
- El sistema soporta múltiples instructores en el mismo ambiente en diferentes horarios

