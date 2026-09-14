# 03-02 — Readiness y DDL fuera del request path (SUMMARY)

## Alcance

Corte incremental de MDL-130 sobre `iniciarUsoAutoservicio`:
`ensureAutoservicioSchema` permanece exclusivamente en el boot
(`backend/server.js`, sin cambios); la petición pública ya no ejecuta
migración, `ALTER TABLE`, `CREATE TABLE` ni `INFORMATION_SCHEMA` — falla
cerrada con `503` accionable leyendo un estado de readiness cacheado en
memoria. No se tocaron contratos `404/409`, claim, idempotencia ni rollback.
No se extrajo el controlador ni se inventó identidad de kiosko.

## Cambios

- `backend/src/controller/equiposController.js`: dentro de
  `iniciarUsoAutoservicio`, se reemplazó `await ensureAutoservicioSchema(defaultDb)`
  (que disparaba `SELECT ... FROM INFORMATION_SCHEMA.*` y, si el boot había
  fallado antes, podía reintentar `ALTER TABLE` en el request path) por
  `assertAutoservicioReady(getAutoservicioReadiness())`, una lectura síncrona
  del estado de módulo ya poblado por el `ensureAutoservicioSchema` de
  `server.js`. Ambas funciones ya existían (soporte de `/health`); el cambio
  fue dejar de invocar la ruta que hace I/O de esquema desde el handler
  público. `server.js` no cambió: sigue siendo el único invocador de
  `ensureAutoservicioSchema`.
- `backend/tests/controllers/equiposAssignmentAutoservicio.test.js`:
  - El test de "503 sin conexión" ya no simula un `ensure` en curso; verifica
    el guard en su estado inicial (antes de cualquier boot), afirmando además
    que ni `mockGetConnection` ni `mockExecute` (proxy de `defaultDb`) se
    invocan.
  - Se agregó un segundo caso: el `ensure` de boot corre explícitamente,
    encuentra el schema incompleto (falta el marcador
    `AUTOSERVICIO_CIERRE_V2`), y el request path sigue fallando cerrado sin
    abrir conexión ni volver a consultar metadatos — la migración fallida no
    se reintenta en la petición pública.
  - Se limpiaron ramas `INFORMATION_SCHEMA` que quedaban muertas en los tests
    del camino "listo" (ya no las ejercita ningún código) y se añadió una
    aserción explícita de que el camino 201 no toca `defaultDb`/metadatos.
  - El test "no recrea el procedimiento de cierre desde una petición pública"
    se mantiene: sigue llamando `ensureAutoservicioSchema` explícitamente
    (cobertura de migración conservada) y deja el estado en "listo" para el
    resto de la suite.
- `backend/tests/controllers/equiposAutoservicioAmbiente.integration.test.js`:
  se agregó un `beforeAll` que llama explícitamente a
  `ensureAutoservicioSchema` (simulando el boot) antes de ejercitar
  `iniciarUsoAutoservicio`, y una aserción de que el camino "listo" no ejecuta
  `INFORMATION_SCHEMA`/`ALTER TABLE`/`CREATE TABLE`.

## Brecha de MySQL/Railway

No cubierta por este plan (mocks únicamente). El estado real de
`ensureAutoservicioSchema` contra MySQL/Railway concurrente sigue
reportándose por separado (ver 03-01). El guard de readiness añadido aquí
asume que `server.js` corrió el `ensure` de boot; si el proceso arranca sin
haber podido asegurar el schema (por ejemplo, MySQL no disponible al boot),
`iniciarUsoAutoservicio` fallará cerrado con `503` hasta que se reinicie el
proceso o se ejecute el script administrativo
`node scripts/migrate-autoservicio-cierre-clase.js` — no hay reintento
automático de la migración desde el request path (ese es justamente el
comportamiento buscado por este plan).

## Archivos

- `backend/src/controller/equiposController.js`
- `backend/tests/controllers/equiposAssignmentAutoservicio.test.js`
- `backend/tests/controllers/equiposAutoservicioAmbiente.integration.test.js`

## Requisitos

MDL-130, MDL-129
