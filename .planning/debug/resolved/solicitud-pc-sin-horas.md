---
status: resolved
trigger: >-
  En las rutas/endpoints donde se solicita el préstamo de un PC no se están definiendo
  las horas (solo la fecha). El usuario reporta esto junto con el bug de fotos 404,
  en el mismo repaso de producción.
created: 2026-08-26
updated: 2026-08-26
---

## Symptoms

- expected: Cuando un aprendiz/usuario solicita el préstamo de un equipo (PC), el registro y/o la visualización de la solicitud debería incluir la hora exacta (fecha + hora), no solo la fecha.
- actual: En el flujo de solicitud de equipo (`frontend/src/pages/SolicitarEquipo.jsx` -> `POST /api/equipos/autoservicio/iniciar-uso` -> `iniciarUsoAutoservicio` en `backend/src/controller/equiposController.js`), no hay ningún input de hora en el formulario del usuario. El backend inserta `fecha_hora_inicio` con `NOW()` (sí incluye hora a nivel de BD), pero el usuario reporta que "no se definen las horas" — posible causa: la hora no se muestra/formatea en el frontend (historial, reportes, confirmación), o hay otra ruta relacionada (horarios/clases) donde el campo hora no se está registrando o validando correctamente.
- errors: Ninguno reportado explícitamente (no hay stacktrace); es un reporte de comportamiento incorrecto/faltante, no una excepción.
- timeline: Reportado hoy (2026-08-26) junto con el bug de fotos 404, en producción.
- reproduction: Pendiente de confirmar el flujo exacto (solicitud de autoservicio de equipo, programación de clases/horarios, o visualización en historial/reportes) — investigar cuál "ruta de solicitud del PC" no está definiendo/mostrando la hora.

## Current Focus

hypothesis: "La respuesta del backend de iniciarUsoAutoservicio (POST /api/equipos/autoservicio/iniciar-uso) nunca incluye fecha_hora_inicio en su payload `data`, por lo que la pantalla de confirmación en SolicitarEquipo.jsx (paso PASO_CONFIRMACION) no puede mostrar la hora de la solicitud aunque la BD sí la registre correctamente vía NOW()."
test: "Leer los 3 constructores de respuesta de iniciarUsoAutoservicio (success, idempotente-cache, idempotente-recuperación) y confirmar que ninguno selecciona/devuelve fecha_hora_inicio; leer SolicitarEquipo.jsx confirmación (líneas 142-174) y confirmar que no hay ningún render de hora."
expecting: "Si la hipótesis es correcta, ninguno de los 3 objetos `data` de respuesta contendrá fecha_hora_inicio, y la confirmación en frontend no mostrará ninguna hora."
next_action: "Verificación humana confirmada: prueba end-to-end local (MySQL real + backend real, sin mocks) contra los 3 caminos de respuesta de iniciarUsoAutoservicio y el formateo/render en frontend. Sesión resuelta y archivada."
reasoning_checkpoint:
  hypothesis: "El endpoint POST /api/equipos/autoservicio/iniciar-uso (iniciarUsoAutoservicio en equiposController.js) omite fecha_hora_inicio del payload data en sus 3 rutas de respuesta (INSERT exitoso línea 4548-4557, idempotente-mismo-uso-activo línea 4489-4499, y recuperación por idempotency key línea 4316-4335), por lo que la UI de confirmación (SolicitarEquipo.jsx líneas 142-174) no tiene ningún dato de hora para mostrar al aprendiz, aunque la columna fecha_hora_inicio (DATETIME NOT NULL) sí se llena correctamente con NOW() en el INSERT (línea 4512-4526)."
  confirming_evidence:
    - "Lectura directa de equiposController.js líneas 4548-4557: el objeto data devuelto solo contiene id_historial, equipo{}, aprendiz{}, clase{} — sin fecha_hora_inicio."
    - "Lectura directa de la ruta idempotente en uso activo, líneas 4489-4499: mismo patrón, sin fecha_hora_inicio."
    - "Lectura de respuestaSolicitudAutoservicio (línea 4316+) y buscarSolicitudAutoservicioPorClave (línea 4297-4309): el SELECT no incluye hu.fecha_hora_inicio en las columnas consultadas."
    - "Lectura de SolicitarEquipo.jsx líneas 142-174 (paso PASO_CONFIRMACION): el JSX solo interpola prestamo?.equipo?.placa, tipo, modelo, aprendiz?.nombre y clase?.nombre_clase — ningún campo de hora."
    - "Confirmado que la tabla Historial_Uso_Equipos.fecha_hora_inicio es DATETIME NOT NULL (BD/SGI_SENA.sql línea 696) y se llena con NOW() en el INSERT — la hora SÍ se guarda en BD, solo no se expone en la respuesta ni se muestra en UI."
  falsification_test: "Si el objeto `data` devuelto por cualquiera de las 3 rutas de iniciarUsoAutoservicio SÍ incluyera fecha_hora_inicio (o un campo equivalente de hora), la hipótesis quedaría refutada y habría que buscar el problema en otro punto (p.ej. HistorialUso*.jsx o EquiposPrestados.jsx)."
  fix_rationale: "Agregar fecha_hora_inicio (ya existente en BD) a las 3 queries/respuestas del controlador y mostrarla formateada en la pantalla de confirmación ataca la causa raíz (el dato nunca llega al frontend) en vez de un síntoma. No requiere cambios de esquema ni migraciones — el dato ya existe, solo falta seleccionarlo/exponerlo/renderizarlo."
  blind_spots: "No se ha verificado en un entorno real/producción qué ve exactamente el usuario (solo análisis estático de código); no se ha revisado si existe otra pantalla de confirmación o notificación (correo, PDF) que también deba mostrar la hora; no se ha probado si hay un componente de historial que el aprendiz consulta después y que sí muestra hora correctamente (lo cual reforzaría que el problema es específico de la confirmación inmediata)."
  candidate_causes:
    - "code: el controlador iniciarUsoAutoservicio omite fecha_hora_inicio en las 3 rutas de respuesta (SELECT/objeto data incompleto)"
    - "code: el componente SolicitarEquipo.jsx no renderiza ningún campo de hora en la confirmación (aunque llegara del backend, no se mostraría)"
  and_gate: "yes — ambas causas deben corregirse en conjunto: si solo se agrega fecha_hora_inicio al backend pero el frontend no la renderiza, el usuario seguirá sin ver la hora; si solo se agrega el render en frontend sin que el backend la envíe, se mostraría undefined/vacío. Son dos condiciones necesarias y suficientes en conjunto (AND), no alternativas independientes."

tdd_checkpoint: null

## Evidence

- timestamp: 2026-08-26T00:00:00Z
  checked: frontend/src/pages/SolicitarEquipo.jsx (completo)
  found: No existe ningún input de hora en el formulario (solo documento y placa). La pantalla de confirmación (PASO_CONFIRMACION, líneas 142-174) solo muestra placa, tipo, modelo, nombre del aprendiz y nombre de la clase — ningún campo de hora.
  implication: Confirma que el frontend no tiene forma de mostrar hora aunque quisiera, salvo que se le agregue el campo y el render.

- timestamp: 2026-08-26T00:05:00Z
  checked: backend/src/controller/equiposController.js función iniciarUsoAutoservicio (líneas 4353-4585)
  found: El INSERT a Historial_Uso_Equipos (línea 4512-4526) sí guarda fecha_hora_inicio con NOW() correctamente. Pero las 3 rutas de respuesta JSON (éxito línea 4548-4557, idempotente-uso-activo línea 4489-4499, e idempotente-por-clave vía respuestaSolicitudAutoservicio línea 4316+) NUNCA incluyen fecha_hora_inicio en el objeto `data` devuelto al frontend.
  implication: La hora se pierde en el camino API -> frontend, no en el guardado en BD. Root cause aislado al contrato de la respuesta del endpoint, no al INSERT ni al schema.

- timestamp: 2026-08-26T00:08:00Z
  checked: backend/src/controller/equiposController.js función buscarSolicitudAutoservicioPorClave (líneas 4297-4309) y BD/SGI_SENA.sql definición de Historial_Uso_Equipos (línea 687-717)
  found: buscarSolicitudAutoservicioPorClave hace SELECT explícito de columnas y NO incluye hu.fecha_hora_inicio. La columna fecha_hora_inicio es DATETIME NOT NULL en el schema (no DATE), confirmando que el tipo de columna no es la causa — es puramente una omisión en el SELECT/response mapping.
  implication: Refuerza que el fix debe tocar el SELECT de buscarSolicitudAutoservicioPorClave, el INSERT...RETURNING-style de la ruta de éxito (usar NOW() capturado o volver a consultar), la query de usoActivo (línea 4481-4486, que tampoco selecciona fecha_hora_inicio), y respuestaSolicitudAutoservicio/data de las 3 rutas.

- timestamp: 2026-08-26T00:10:00Z
  checked: frontend/src/pages/EquiposPrestados.jsx (ScheduleDetails, líneas 81-110) y backend obtenerSesionesActivas (líneas 2931-2925)
  found: A diferencia de la confirmación inmediata, la pantalla "Equipos prestados" (vista de instructor/admin) SÍ selecciona y muestra fecha_hora_inicio (columna "En préstamo desde", línea 298) y también intenta mostrar hora_inicio/hora_fin de la clase asociada (clase_hora_inicio/clase_hora_fin, líneas 2961-2962, usados en ScheduleDetails línea 83-86). Este flujo secundario no parece ser la fuente principal del reporte, ya que sí expone hora.
  implication: El defecto está acotado al flujo de autoservicio (solicitud + confirmación inmediata que ve el aprendiz), no a las vistas administrativas de historial/equipos prestados, que ya manejan hora correctamente.

## Eliminated

- hypothesis: "El problema es de formateo en frontend (formatDateTime elimina la hora en las pantallas de historial)"
  evidence: "Las 3 implementaciones de formatDateTime encontradas (HistorialUsoEquipo.jsx, HistorialUsoEquipos.jsx, EquiposPrestados.jsx) incluyen explícitamente las opciones hour:'2-digit', minute:'2-digit' en toLocaleString/Intl.DateTimeFormat — si reciben un valor datetime válido, sí muestran la hora."
  timestamp: 2026-08-26T00:03:00Z

- hypothesis: "La columna fecha_hora_inicio en BD es tipo DATE (sin hora), truncando la hora al guardar"
  evidence: "BD/SGI_SENA.sql línea 696 confirma fecha_hora_inicio DATETIME NOT NULL, no DATE. El INSERT usa NOW() que preserva hora completa."
  timestamp: 2026-08-26T00:07:00Z

## Resolution

root_cause: "El endpoint POST /api/equipos/autoservicio/iniciar-uso (iniciarUsoAutoservicio) guarda correctamente fecha_hora_inicio en BD (DATETIME NOT NULL, vía NOW()), pero ninguna de sus 3 rutas de respuesta JSON (éxito, idempotente-uso-activo, idempotente-por-clave) selecciona ni devuelve ese campo al frontend; y la pantalla de confirmación en SolicitarEquipo.jsx no tiene ningún elemento para renderizar hora aunque llegara. Ambas causas (backend no expone + frontend no renderiza) deben corregirse en conjunto (AND-gate) para que el aprendiz vea la hora de su solicitud de PC."
fix: >-
  Backend (backend/src/controller/equiposController.js, función iniciarUsoAutoservicio y helpers):
  (1) buscarSolicitudAutoservicioPorClave ahora selecciona hu.fecha_hora_inicio; (2) respuestaSolicitudAutoservicio
  ahora incluye fecha_hora_inicio en el objeto data; (3) la query de usoActivo (ruta idempotente por uso activo)
  ahora selecciona fecha_hora_inicio y la respuesta 200 la incluye en data; (4) la ruta de éxito (INSERT) ahora
  captura `const fechaHoraInicio = new Date()` en JS antes del INSERT, la pasa como parámetro (en vez de NOW() en SQL)
  para poder devolverla, y la respuesta 201 la incluye en data.
  Frontend: (1) frontend/src/utils/loanRequest.js agrega la función formatLoanStartTime(fechaHoraInicio) que formatea
  a HH:MM en locale es-CO, devolviendo null si no hay valor o es inválido; (2) frontend/src/pages/SolicitarEquipo.jsx
  importa formatLoanStartTime y en la pantalla de confirmación (PASO_CONFIRMACION) ahora renderiza "a las HH:MM"
  junto al nombre del aprendiz, cuando prestamo.fecha_hora_inicio está presente.
verification: >-
  Guardrail multi-señal aplicado antes de aceptar el fix:
  (1) Tests dirigidos: backend/tests/controllers/equiposAssignmentAutoservicio.test.js (11/11 passed) y
  equiposController.test.js (122/122 passed conjunto) cubren las 3 rutas de respuesta de iniciarUsoAutoservicio
  sin romperse con los cambios de SELECT/params.
  (2) Regresión nueva (oracle_type: specified — el contrato esperado es explícito: "confirmación debe mostrar hora
  cuando el backend la envía, y omitirla gracefully cuando no"): 3 tests nuevos en loanRequest.test.js para
  formatLoanStartTime (formatea ISO válido a HH:MM; devuelve null sin fecha_hora_inicio; devuelve null con fecha
  inválida) + 1 test de integración nuevo en SolicitarEquipo.test.jsx que dirige el flujo completo
  (documento -> placa -> confirmación) con fetch mockeado devolviendo fecha_hora_inicio, y afirma que el texto
  "a las" aparece en la confirmación.
  (3) Ciclo red-green verificado manualmente: se revirtió temporalmente solo la línea de render en SolicitarEquipo.jsx
  y se confirmó que el nuevo test de integración FALLA (red) exactamente como se espera antes de re-aplicar el fix
  (green) — descarta que el test sea un placebo.
  (4) Suite completa backend: 85 test suites / 1850 tests passed (npm test), sin regresiones.
  (5) Suite completa frontend: 5 test files / 19 tests passed (npx vitest run), sin regresiones. Además
  node --test src/utils/loanRequest.test.js (9/9) y loanRequest.integration.test.js (1/1) passed por separado.
  guardrail_verdict: accepted
files_changed:
  - backend/src/controller/equiposController.js
  - frontend/src/pages/SolicitarEquipo.jsx
  - frontend/src/utils/loanRequest.js
  - frontend/src/utils/loanRequest.test.js
  - frontend/src/pages/SolicitarEquipo.test.jsx

## Human Verification

result: CONFIRMED FIXED
method: >-
  Verificación end-to-end local, no mockeada: se levantó MySQL 8.0 en Docker con el schema
  real (BD/SGI_SENA.sql), se sembraron un Aprendiz, Usuario, Ambiente, Clase ("En Curso") y
  Elemento (equipo) reales que satisfacen todas las validaciones (coincidencia de ambiente,
  coincidencia de ficha, clase activa). Se levantó el backend real (node server.js) contra
  esa BD local. Se invocó POST /api/equipos/autoservicio/iniciar-uso vía curl cubriendo los
  3 caminos de respuesta:
    - INSERT/éxito: data incluyó fecha_hora_inicio ("2026-08-26T15:38:12.718Z").
    - Replay idempotente (mismo header Idempotency-Key): misma fecha_hora_inicio devuelta.
    - Uso activo idempotente (repetición sin idempotency key, mismo aprendiz): también
      incluyó fecha_hora_inicio.
  Se verificó frontend/src/utils/loanRequest.js formatLoanStartTime() directamente contra
  la respuesta real de la API vía node: formateó correctamente el timestamp UTC a
  "10:38 a. m." (hora local Colombia, locale es-CO), y se confirmó que el mensaje de
  confirmación exacto ("Placa QA-TEST-01 asignada a Aprendiz QA Local a las 10:38 a. m.")
  coincide con lo que renderiza SolicitarEquipo.jsx.
verified_by: human (orchestrator-mediated local E2E test, per explicit user request)
timestamp: 2026-08-26T00:00:00Z
