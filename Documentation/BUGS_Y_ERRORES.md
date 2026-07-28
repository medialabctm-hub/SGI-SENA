# Registro de Bugs y Errores — Diagnóstico y Plan de Resolución

**Fecha:** 2026-07-27
**Rama:** `develop`
**Alcance:** 2 bugs funcionales + 2 errores de diseño/UX detectados en producción.

---

## Índice

| ID | Título | Severidad | Área | Fase |
|----|--------|-----------|------|------|
| BUG-01 | Equipo asignado no aparece en "Mis Equipos" | Alta | Backend + Frontend | 1 |
| BUG-02 | El sidebar se rompe en "Gestión de Horarios" | Media | Frontend (layout) | 2 |
| ERR-01 | Autorizaciones de movimiento son globales | Alta | Backend + Frontend | 3 |
| ERR-02 | "Error del servidor" en lugar de mensajes útiles | Alta | Backend + Frontend | 4 |

---

## BUG-01 — Equipo asignado a un usuario no aparece en "Mis Equipos"

### Síntoma reportado
Al asignar un equipo a un usuario la operación reporta éxito, pero ese usuario
entra a **Mis Equipos** y la pantalla muestra *"No tienes equipos asignados"*.

### Alcance acordado
*Mis Equipos* muestra **únicamente las habilitaciones de uso personal**
(`Responsables_Equipo`). El **inventario a cargo** de un cuentadante
(`Elementos.id_cuentadante`) **no** pertenece a esta pantalla: se consulta en
*Inventario*. Este bug se resuelve por tanto dentro del flujo de habilitación.

### Diagnóstico

Se trazaron **todas** las rutas de escritura y lectura de la tabla
`Responsables_Equipo`:

| Ruta | Ubicación | Estado |
|------|-----------|--------|
| Escritura — habilitación manual | `equiposController.js:782` (`asignarEquipo`) | ⚠️ ver causa raíz |
| Escritura — verificación de inventario | `equiposController.js:3723` | Correcta (`id_usuario` y estado activos) |
| Escritura — inicio de clase | `sp_iniciar_clase` (`BD/SGI_SENA.sql:1207`) | Correcta (marca la fila como temporal) |
| Lectura — Mis Equipos | `equiposController.js:821` (`obtenerMisEquipos`) | ⚠️ ver causa raíz |
| Ruta HTTP | `equiposRoutes.js:98` — declarada antes de `/:codigo` | Correcta, sin colisión |
| Autenticación | `authMiddleware.js:33` expone `req.user.id` | Correcta |
| Validación | `asignarEquipoSchema` exige `id_usuario` entero positivo | Correcta |

La lectura solo devuelve filas que cumplan **las tres** condiciones:

```sql
WHERE re.id_usuario = ?
  AND re.estado_responsabilidad = 'Activo'
  AND (re.observaciones IS NULL OR re.observaciones NOT LIKE '%inicio de clase #%')
```

### Causa raíz

**El INSERT de la habilitación nunca escribe `estado_responsabilidad`**
(`equiposController.js:782-787`):

```sql
INSERT INTO Responsables_Equipo
  (codigo_equipo, id_usuario, tipo_responsabilidad, observaciones, asignado_por,
   fecha_asignacion, fecha_desvinculacion)
VALUES (?, ?, ?, ?, ?, NOW(), NULL)
```

La fila queda con el valor **por defecto de la columna en la base de datos**. El
esquema versionado (`BD/SGI_SENA.sql:308`) declara `DEFAULT 'Activo'`, pero la
lectura exige exactamente `'Activo'`: **si la base de datos desplegada no tiene
ese default** —porque la tabla se creó desde otro script, se alteró en caliente
o se restauró un volcado sin el `DEFAULT`— la fila nace con otro valor y la
habilitación se vuelve invisible, exactamente con el síntoma reportado: la
operación responde `201 Created` y *Mis Equipos* sale vacío.

Esta es la **única dependencia implícita** de todo el flujo: es el único dato
que decide la visibilidad y el único que el código no controla. Todo lo demás
(id de usuario, ruta, permisos, validación, filtros) se verificó correcto.

El segundo filtro, `NOT LIKE '%inicio de clase #%'`, es un acoplamiento frágil:
depende de que el texto libre de `observaciones` —campo que el usuario puede
editar desde *Ver Habilitaciones*— conserve una frase exacta escrita por un
procedimiento almacenado. Cualquier edición de esa observación reactiva un
equipo de clase, y cualquier cambio de redacción en el procedimiento lo oculta.

> **Verificación pendiente de entorno.** La confirmación definitiva requiere
> consultar la base de datos desplegada (no accesible desde el repositorio: no
> hay `.env`, solo `backend/env.example`). Se incluye el script de diagnóstico
> `backend/scripts/diagnostico-mis-equipos.sql`, de solo lectura, que responde
> en una consulta qué valor real están tomando las filas recién insertadas.

### Defectos secundarios confirmados en la misma pantalla

1. **Columna "Marca" siempre vacía.** `frontend/src/pages/MisEquipos.jsx:141`
   renderiza `eq.marca`, pero **la columna `marca` no existe en la tabla
   `Elementos`** (`BD/SGI_SENA.sql:203-222`). Se eliminó de la consulta en el
   commit `3614e79` junto con `numero_serie`, **sin actualizar el frontend**.
   Mismo defecto en `AsignarEquipo.jsx:621` con `asig.equipo_marca`.
2. **Sin manejo de errores unificado.** `MisEquipos.jsx:58-81` usa `fetch` +
   `res.json()` directo en vez de `parseApiResponse` / `buildErrorMessage`; es
   una de las 6 pantallas que no siguen el contrato de errores del proyecto.

### Solución

1. **Escribir `estado_responsabilidad = 'Activo'` de forma explícita** en el
   INSERT de `asignarEquipo`, eliminando la dependencia del default de la base
   de datos. Es la corrección de la causa raíz.
2. **Sustituir el filtro por texto libre** por un criterio estructural: una
   asignación temporal de clase es la que tiene `fecha_desvinculacion` futura
   registrada por el procedimiento de inicio de clase. Se conserva el filtro por
   texto como respaldo para las filas históricas ya existentes.
3. Eliminar la columna **Marca** de `MisEquipos.jsx` y `AsignarEquipo.jsx`.
4. Migrar `MisEquipos.jsx` a `parseApiResponse` + `buildErrorMessage`.
5. Entregar el script de diagnóstico de solo lectura para confirmar el estado
   real de los datos en el entorno desplegado.

---

## BUG-02 — El sidebar se rompe en "Gestión de Horarios"

### Síntoma reportado
En la mayoría de pantallas el `Header` ocupa el ancho completo y el sidebar
queda debajo, dentro del layout. En **Horarios** (tanto *Mis Horarios* como
*Gestión de Horarios*) el sidebar se dibuja pegado al borde superior de la
página y el `Header` aparece desplazado dentro del área de contenido.

### Diagnóstico

Todas las páginas del sistema comparten esta estructura:

```jsx
<div className="page simple-page">
  <Header />
  <div className="dashboard-layout">
    <Sidebar user={user} />
    <main className="dashboard-main"> ... </main>
  </div>
</div>
```

`Horarios.jsx:797-801` es **la única excepción del proyecto**: invierte el orden
y omite el contenedor `.page`.

```jsx
<div className="dashboard-layout">     {/* falta el wrapper .page */}
  <Sidebar user={user} />
  <main className="dashboard-main">
    <Header user={user} />             {/* Header DENTRO del main */}
```

Esto rompe el cálculo de alturas del CSS, que asume que el header está *fuera*
del layout (`frontend/src/styles/layout/sidebar.css:2-40`):

```css
.dashboard-layout { height: calc(100vh - 140px); }
.app-sidebar      { height: calc(100vh - 140px); }
```

Sin el header por encima, esos `140px` reservados no existen y el sidebar sube
al borde superior; y al quedar el `Header` dentro de `.dashboard-main` (que
tiene `padding: 18px` y `overflow-y: auto`) el header se desplaza a la derecha
y hace scroll con el contenido.

### Causa raíz
Estructura de layout divergente en `Horarios.jsx`. Se verificaron las 26 páginas
que montan `<Sidebar>`: **solo `Horarios.jsx` tiene el problema**. Se percibe en
"varias secciones" porque esa misma página se sirve en dos entradas de menú
(*Mis Horarios* para Instructor/Cuentadante y *Gestión de Horarios* para
Administrador), ambas apuntando a `/horarios`
(`frontend/src/components/Sidebar.jsx:150-154`).

### Solución
Alinear `Horarios.jsx` con la estructura canónica del proyecto y, para evitar
que la divergencia se repita, extraer un componente de layout reutilizable
`AppLayout` que encapsule `.page > Header + .dashboard-layout > Sidebar + main`.
`Horarios.jsx` se migra a ese componente.

---

## ERR-01 — Las autorizaciones de movimiento son globales

### Síntoma reportado
Las solicitudes de autorización para mover un equipo se muestran a todos los
administradores/cuentadantes por igual. Lo correcto es que la solicitud llegue
**al cuentadante que tiene asignado ese equipo**, y que solo él la vea.

### Diagnóstico

El backend **sí** filtra por destinatario
(`autorizacionMovimientoController.js:107`):

```sql
WHERE s.id_autorizador = ? AND s.estado = 'Pendiente'
```

El problema está en **quién queda como `id_autorizador`**: lo elige libremente
el solicitante en un desplegable que carga **todos** los usuarios con rol
Administrador o Cuentadante, sin relación alguna con el equipo
(`frontend/src/pages/AutorizacionesMovimiento.jsx:94-98`):

```js
fetch('/api/auth/users', ...)
  .then(users => users.filter(u => u.nombre_rol === 'Administrador' || u.nombre_rol === 'Cuentadante'))
```

Y el backend acepta cualquiera de ellos
(`autorizacionMovimientoController.js:63`):

```js
if (!autorizador || !['Administrador','Cuentadante'].includes(autorizador.nombre_rol)) { ... }
```

Nunca se consulta `Elementos.id_cuentadante`, que es justamente el dueño del
equipo. Resultado: la autorización se comporta como global — cualquier
administrador puede recibirla y aprobarla, y quien realmente responde por el
equipo puede no enterarse.

**Fuga adicional:** `listarDisponiblesParaMovimiento`
(`autorizacionMovimientoController.js:297-326`) devuelve las autorizaciones
aprobadas de **cualquier** equipo a **cualquier** usuario autenticado con
permiso de lectura, sin verificar que sea el solicitante o el autorizador.

### Solución

1. **Derivar el autorizador en el backend, no en el formulario.** Nueva función
   `resolverAutorizador(codigo_equipo)` con esta cascada:
   1. `Elementos.id_cuentadante` del equipo (si está activo) → **cuentadante asignado**.
   2. Cuentadante/Instructor con responsabilidad **Principal activa** sobre el
      ambiente de origen (`Responsabilidades_Ambiente`).
   3. Administrador activo (respaldo, cuando el equipo no tiene cuentadante).
2. **`POST /autorizacion-movimiento` ignora el `id_autorizador` del body** y usa
   el resuelto. Si el solicitante *es* el autorizador resuelto, se rechaza con
   409 y mensaje explicativo (no tiene sentido autorizarse a sí mismo; puede
   mover el equipo directamente).
3. **Nuevo endpoint `GET /autorizacion-movimiento/autorizador?codigo_equipo=`**
   que devuelve el autorizador resuelto, para que el formulario lo muestre en
   modo lectura ("Esta solicitud será enviada a: *Nombre (Cuentadante del
   equipo)*") en vez de un desplegable.
4. **Cerrar la fuga de `disponibles`**: filtrar por
   `(s.id_solicitante = :userId OR s.id_autorizador = :userId)`.
5. Mantener `id_autorizador` en el esquema del validador como campo **opcional**
   para no romper clientes existentes, pero documentado como ignorado.

---

## ERR-02 — "Error del servidor" en vez de mensajes útiles al usuario

### Síntoma reportado
Al crear/editar/eliminar en varias secciones aparece una alerta genérica de
error de servidor, aunque en los logs del backend sí está la razón real. Ejemplo
citado: eliminar un usuario que tiene solicitudes o equipos asignados falla por
una restricción de clave foránea, pero el usuario solo ve "Error del servidor".

### Diagnóstico

Es una cadena de tres eslabones, todos contribuyen:

**1. El backend no traduce los errores de MySQL.**
`errorHandler` (`backend/src/utils/errors.js:58-102`) solo mapea `ZodError`,
errores de JWT y `ER_DUP_ENTRY`. Un error de clave foránea
(`ER_ROW_IS_REFERENCED_2`) cae al `else` implícito y sale como **500** con el
mensaje crudo de MySQL:

```
Cannot delete or update a parent row: a foreign key constraint fails
(`sgi_sena`.`Clases`, CONSTRAINT `clases_ibfk_2` FOREIGN KEY (`id_instructor`) ...)
```

**2. No hay validación previa de dependencias.**
`authService.deleteUser` (`backend/src/services/authService.js:439-448`) hace un
`DELETE` directo y deja que la base de datos falle. Las tablas que **bloquean**
el borrado de un usuario (FK sin `ON DELETE CASCADE/SET NULL`, ver
`BD/SGI_SENA.sql`) son:

| Tabla | Columna | Significado para el usuario |
|-------|---------|-----------------------------|
| `Elementos` | `registrado_por` | Equipos que registró |
| `Clases` | `id_instructor`, `creado_por` | Clases donde es instructor |
| `Responsables_Equipo` | `asignado_por` | Habilitaciones que otorgó |
| `Responsabilidades_Ambiente` | `creado_por` | Asignaciones de ambiente que creó |
| `Mantenimiento` | `realizado_por`, `id_usuario_tecnico` | Mantenimientos a su nombre |
| `Novedades` | `reportado_por`, `resuelto_por` | Novedades reportadas/resueltas |
| `Historial_Equipos` | `registrado_por` | Movimientos que registró |
| `Estado_Equipo` | `actualizado_por` | Cambios de estado que hizo |
| `Imagenes_Equipo` / `Imagenes_Ambiente` | `subida_por` | Imágenes que subió |
| `Auditoria` | `usuario_accion` | Registros de auditoría |
| `Nombres_Clases` | `creado_por` | Nombres de clase que creó |

**3. El frontend descarta cualquier mensaje de un 500.**
`getUserFriendlyError` (`frontend/src/utils/api.js:31-33`):

```js
if (status >= 500) {
  return 'Ocurrió un problema en el servidor. Por favor intenta de nuevo más tarde';
}
```

Correcto como política de seguridad (no filtrar SQL al navegador), pero
significa que **mientras el backend responda 500, ningún mensaje llegará al
usuario**. Además, el filtro de mensajes 400 (`api.js:79-95`) es demasiado
agresivo: los patrones `/error/i`, `/null/i` y `/\d{3}/` descartan mensajes de
negocio perfectamente válidos.

**4. 127 respuestas `res.status(500)` codificadas a mano** en los controladores,
la mayoría con la forma `{ error: 'Error al ...', details: err.message }`, sin
distinguir un fallo real del servidor de una regla de negocio incumplida.

### Causa raíz
No existe una capa de traducción entre los errores de la base de datos y el
contrato de la API. Cualquier restricción de integridad se presenta como fallo
del servidor, y el frontend —correctamente— se niega a mostrar detalles de un 500.

### Solución

1. **Traductor de errores de base de datos** (`backend/src/utils/errors.js`):
   `translateDbError(err)` que convierte códigos de MySQL en errores de dominio
   con `statusCode` y mensaje para el usuario:

   | Código MySQL | Se convierte en | Mensaje al usuario |
   |--------------|-----------------|--------------------|
   | `ER_ROW_IS_REFERENCED_2` | `ConflictError` (409) | "No se puede eliminar porque tiene *&lt;entidad&gt;* asociado(s)…" |
   | `ER_NO_REFERENCED_ROW_2` | `ValidationError` (400) | "El *&lt;entidad&gt;* seleccionado ya no existe." |
   | `ER_DUP_ENTRY` | `ConflictError` (409) | "Ya existe un registro con ese *&lt;campo&gt;*." |
   | `ER_DATA_TOO_LONG` | `ValidationError` (400) | "El valor de *&lt;campo&gt;* es demasiado largo." |
   | `ER_BAD_NULL_ERROR` | `ValidationError` (400) | "El campo *&lt;campo&gt;* es obligatorio." |
   | `ER_LOCK_WAIT_TIMEOUT` / `ECONNREFUSED` | `AppError` (503) | "El sistema está ocupado. Intenta de nuevo en unos segundos." |

   La entidad se obtiene del nombre de la tabla presente en el mensaje de MySQL,
   traducida con un diccionario tabla → nombre en español.

2. **Campo `userMessage` en el contrato de error.** Todo error operativo
   responde `{ error, userMessage, code }`. El frontend **muestra `userMessage`
   verbatim** cuando viene presente (el backend garantiza que no contiene SQL ni
   trazas); si no viene, aplica la heurística actual. Esto elimina la pérdida de
   mensajes sin reintroducir fuga de detalles técnicos.

3. **Validación previa en los borrados críticos**, para dar el motivo exacto
   *antes* de que falle la base de datos:
   - `authService.deleteUser`: cuenta dependencias en las tablas de la lista de
     arriba y responde 409 con el detalle
     ("No se puede eliminar a *Juan Pérez* porque tiene 3 equipos registrados y
     2 clases asignadas. Reasigna o elimina esos registros primero.").
   - Mismo patrón para eliminar equipo, ambiente, categoría, rol y clase.

4. **Unificar los catch de los controladores**: `handleControllerError` pasa a
   usar `translateDbError` y a devolver el `statusCode` correcto en vez de un
   500 fijo; los `res.status(500).json(...)` escritos a mano se reemplazan por
   esa función.

5. **Frontend** (`frontend/src/utils/api.js`):
   - `parseApiResponse` propaga `userMessage` y `code` en el `ApiError`.
   - `getUserFriendlyError` prioriza `userMessage`; para 409/422 muestra el
     mensaje del backend; el filtro de patrones técnicos se reduce a lo que
     realmente delata implementación (`sql`, `stack`, `trace`, `exception`,
     `undefined`, `cannot read`, nombres de tabla).
   - Se retira `/error/i`, `/null/i` y `/\d{3}/` del filtro de 400.

---

## Hallazgos adicionales (fuera del alcance reportado)

Se documentan por trazabilidad; **no** se corrigen en este plan salvo indicación
contraria.

| # | Hallazgo | Ubicación | Riesgo |
|---|----------|-----------|--------|
| A-01 | Instrumentación de depuración olvidada: 8 llamadas `fetch('http://127.0.0.1:7242/ingest/...')` en código de producción — **eliminada en la Fase 1** | `equiposController.js`, `reportesValidator.js`, `DetalleEquipo.jsx` | Ruido en logs, latencia y fuga de datos internos si el host existiera |
| A-02 | Migraciones de esquema ejecutadas dentro de un handler HTTP (`ALTER TABLE` en `actualizarCuentadantePrincipal`) | `equiposController.js:1874-1899` | DDL en caliente durante una petición de usuario |
| A-03 | Inconsistencia de valores de estado: `'Activo'` en `Responsables_Equipo` vs `'Activa'` en `Responsabilidades_Ambiente` | Esquema y consultas | Consultas silenciosamente vacías si se copia/pega el filtro |

Se recomienda eliminar A-01 en la Fase 1 (es una línea por archivo y no tiene
efectos colaterales).

---

## Estado de la implementación

Rama: `fix/bugs-y-errores-ux`

| Fase | Estado | Verificación |
|------|--------|--------------|
| 1 — BUG-01 | Implementada | 103 pruebas de `equiposController` en verde, incluidas 2 nuevas |
| 2 — BUG-02 | Implementada | `npm run build` del frontend correcto |
| 3 — ERR-01 | Implementada | 13 pruebas nuevas de `autorizacionMovimientoController` en verde |
| 4 — ERR-02 | Implementada | 1781 pruebas en verde; 8 pruebas nuevas del traductor de errores |

**Resultado de `npm test` (backend):** 1781 pasan, 5 fallan.
Los 5 fallos son **anteriores a este trabajo**: se comprobó ejecutando la misma
suite sobre `develop` sin los cambios y fallan exactamente igual.

| Suite | Prueba que falla | ¿Preexistente? |
|-------|------------------|----------------|
| `webhookController` | guarda datos y retorna 201 | Sí |
| `webhookController` | loguea info en development | Sí |
| `notificationService` | `createBroadcast` sin título | Sí |
| `permissionsRoutes` | fallback `ROLE_PERMISSIONS` | Sí |
| `permissionsRoutes` | 404 en fallback | Sí |

**Lint del backend:** 379 problemas frente a los 380 de la línea base (un
problema menos: desapareció un `no-empty` al retirar la instrumentación).

### Pruebas actualizadas por el cambio de contrato de errores

El campo `userMessage` y la traducción de errores cambian a propósito la forma de
las respuestas. Se actualizaron las pruebas que verificaban la forma anterior:
`tests/utils/controllerHelpers.test.js` (4), `tests/utils/errors.test.js` (1) y
`tests/services/authService.test.js` (2, más una nueva para el caso de
dependencias). Ninguna comprobación de comportamiento se debilitó.

### Limitaciones del entorno encontradas al verificar

| # | Limitación | Efecto |
|---|-----------|--------|
| L-01 | El frontend no tiene *runner* de pruebas: hay archivos `.test.js` pero no `vitest` ni script `test` en `frontend/package.json`, aunque la raíz ejecuta `npm test --prefix frontend` | `npm run ci` falla en la etapa de frontend. No se añadió prueba de regresión de layout porque no habría forma de ejecutarla; la estructura se garantiza con el componente `AppLayout` |
| L-02 | `npm run lint` del backend usa `--ext`, opción retirada en ESLint 9 | Hay que invocar `npx eslint src` |
| L-03 | El lint del frontend extiende de `airbnb`, que no está instalado | `npm run lint --prefix frontend` no ejecuta |
| L-04 | Las pruebas requieren variables de entorno (`BREVO_API_KEY`, `JWT_SECRET`, base de datos…) porque `config.js` valida al importarse | Hay que exportarlas antes de `npm test` |
| L-05 | `Documentation/` está en `.gitignore` (línea 40), pero sus archivos actuales sí están versionados | Este documento requiere `git add -f` para incluirse |

---

## Plan de ejecución por fases

Cada fase es independiente y verificable; se puede detener entre fases sin
dejar el sistema en estado inconsistente.

### Fase 0 — Preparación
- Rama `fix/bugs-y-errores-ux` desde `develop`.
- Línea base: `npm run lint` y `npm test` para conocer el estado previo.

### Fase 1 — BUG-01: Mis Equipos (Alta)
1. `equiposController.js` → reescribir `obtenerMisEquipos` con la unión de
   habilitaciones + inventario por cuentadante y la columna `origen`.
2. `MisEquipos.jsx` → quitar columna *Marca*, añadir *Origen*, migrar a
   `parseApiResponse`/`buildErrorMessage`.
3. `AsignarEquipo.jsx` → quitar columna *Marca*.
4. Eliminar la instrumentación de depuración (A-01).
5. Pruebas: unitaria del controlador (usuario con solo habilitación, solo
   inventario, ambas, ninguna).

**Verificación:** asignar un equipo a un usuario por cada una de las dos vías y
confirmar que aparece en *Mis Equipos* con el origen correcto.

### Fase 2 — BUG-02: Layout del sidebar (Media)
1. Crear `frontend/src/components/AppLayout.jsx` con la estructura canónica.
2. Migrar `Horarios.jsx` a `AppLayout` (corrige el bug).
3. Prueba de regresión que verifica el orden del DOM (`.page > header` seguido
   de `.dashboard-layout`) en la página de horarios.

**Verificación:** `/horarios` como Administrador y como Instructor; comparar con
`/dashboard`.

### Fase 3 — ERR-01: Autorizaciones dirigidas al cuentadante (Alta)
1. `autorizacionMovimientoController.js` → `resolverAutorizador()` + uso en
   `crearSolicitud`; filtro de propiedad en `listarDisponiblesParaMovimiento`.
2. `equiposRoutes.js` → nueva ruta `GET /autorizacion-movimiento/autorizador`.
3. `equiposValidator.js` → `id_autorizador` pasa a opcional.
4. `AutorizacionesMovimiento.jsx` → sustituir el desplegable de autorizadores
   por el destinatario resuelto en modo lectura.
5. Pruebas de la cascada de resolución (con cuentadante, sin cuentadante pero
   con responsable de ambiente, y sin ninguno de los dos).

**Verificación:** solicitar el movimiento de un equipo con cuentadante asignado
y confirmar que la solicitud llega solo a ese cuentadante (badge del sidebar y
lista de pendientes), no a los demás administradores.

### Fase 4 — ERR-02: Errores comprensibles (Alta)
1. `backend/src/utils/errors.js` → `translateDbError` + diccionario de tablas +
   `userMessage` en la respuesta del `errorHandler`.
2. `backend/src/utils/controllerHelpers.js` → `handleControllerError` usa el
   traductor y respeta el `statusCode`.
3. `authService.deleteUser` → verificación previa de dependencias con mensaje
   detallado (caso citado por el usuario).
4. Mismo patrón de verificación previa en los borrados de equipo, ambiente,
   categoría, rol y clase.
5. Reemplazo de los `res.status(500).json(...)` manuales por
   `handleControllerError` en los controladores (por orden de impacto:
   `equiposController`, `ambientesController`, `clasesController`,
   `rolesController`, el resto).
6. `frontend/src/utils/api.js` → propagar y priorizar `userMessage`; relajar el
   filtro de patrones técnicos.
7. Pruebas: traductor por cada código MySQL; e2e del borrado de usuario con
   dependencias.

**Verificación:** intentar eliminar un usuario con equipos y solicitudes; debe
mostrarse el motivo concreto y qué hacer, nunca un error de servidor.

### Fase 5 — Cierre
- `npm run ci` completo (lint + tests backend + tests frontend + build).
- Actualizar este documento con el resultado de cada verificación.
- Commits separados por fase para permitir revertir de forma granular.

---

## Matriz de archivos afectados

| Archivo | BUG-01 | BUG-02 | ERR-01 | ERR-02 |
|---------|:------:|:------:|:------:|:------:|
| `backend/src/controller/equiposController.js` | ✔ | | | ✔ |
| `backend/src/controller/autorizacionMovimientoController.js` | | | ✔ | ✔ |
| `backend/src/routes/equiposRoutes.js` | | | ✔ | |
| `backend/src/validators/equiposValidator.js` | | | ✔ | |
| `backend/src/services/authService.js` | | | | ✔ |
| `backend/src/utils/errors.js` | | | | ✔ |
| `backend/src/utils/controllerHelpers.js` | | | | ✔ |
| `frontend/src/pages/MisEquipos.jsx` | ✔ | | | |
| `frontend/src/pages/AsignarEquipo.jsx` | ✔ | | | |
| `frontend/src/pages/Horarios.jsx` | | ✔ | | |
| `frontend/src/components/AppLayout.jsx` (nuevo) | | ✔ | | |
| `frontend/src/pages/AutorizacionesMovimiento.jsx` | | | ✔ | |
| `frontend/src/utils/api.js` | | | | ✔ |
| 14 controladores del backend (109 `catch`) | | | | ✔ |
| `backend/scripts/diagnostico-mis-equipos.sql` (nuevo) | ✔ | | | |

## Deuda registrada, no corregida

- **Doble registro en los logs.** Los `catch` que ya llamaban a `logger.error`
  antes del `return` ahora vuelven a registrar dentro de `handleControllerError`.
  No afecta la respuesta al usuario; conviene limpiarlo en una pasada aparte.
- **3 respuestas `res.status(500)` conservadas a propósito:** el error de
  configuración del webhook externo (`webhookController.js`), el desajuste de
  parámetros de `consultarHistorialUso` y el fallo de importación de Excel; las
  tres ya devuelven un mensaje redactado para el usuario.
