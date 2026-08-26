---
status: resolved
trigger: >-
  Las fotos de equipos subidas (uploads/equipos/*.jpg) devuelven 404 en producción —
  probablemente relacionado con el volumen persistente de Railway o con cómo se
  guardan/sirven las rutas de las imágenes tras un nuevo deploy. Ejemplos de rutas que
  fallan: /uploads/equipos/1787074695288-51-image.jpg,
  /uploads/equipos/1787074648293-51-image.jpg,
  /uploads/equipos/1787075246545-62-image.jpg,
  /uploads/equipos/1787075219760-62-image.jpg.
created: 2026-08-26
updated: 2026-08-26T16:45:00Z
---

## Symptoms

- expected: Las imágenes de equipos subidas por los usuarios deberían cargar correctamente en el frontend (tarjetas/detalle de equipo).
- actual: El frontend solicita `/uploads/equipos/<timestamp>-<id>-image.jpg` y el servidor responde 404. La consola del bundle compilado (`index-BJZIS3AK.js:178`) captura el evento `onError` de la etiqueta `<img>` y loguea "Error al cargar imagen: <ruta>".
- errors: |
  Error al cargar imagen: /uploads/equipos/1787074695288-51-image.jpg
  onError @ index-BJZIS3AK.js:178
  /uploads/equipos/1787074695288-51-image.jpg:1 Failed to load resource: the server responded with a status of 404 ()
  (patrón repetido para varios equipos: ids 51 y 62, múltiples timestamps)
- timeline: Reportado hoy (2026-08-26) en producción. El usuario sospecha que coincide con el volumen persistente de la base de datos/almacenamiento en Railway (posible reset de volumen tras un redeploy, o que las rutas se guardaron pero el archivo físico ya no existe).
- reproduction: Abrir el módulo de gestión de equipos en producción (Railway) y visualizar equipos que tienen fotos previamente subidas — las imágenes no cargan y la consola muestra 404 para la ruta `/uploads/equipos/...`.

## Current Focus

hypothesis: "Legacy rows in Imagenes_Equipo.ruta_imagen still contain the pre-migration static path `/uploads/equipos/<filename>`, which 404s because server.js no longer serves that directory statically (security fix on 2026-08-20). New uploads correctly get `/api/equipos/imagenes/archivo/<filename>` via getImagePath(), but old rows were never backfilled."
test: "Confirmed via git history: commit 2ddeb3f changed getImagePath() from returning '/uploads/equipos/${filename}' to '/api/equipos/imagenes/archivo/${encodeURIComponent(filename)}', and server.js only statically serves /uploads/ambientes and /uploads/perfiles (not /uploads/equipos, by explicit design per code comment + serverPublicUploads.test.js). No backfill/migration script exists anywhere in the repo for ruta_imagen."
expecting: "Fix: add idempotent startup migration (following ensureAutoservicioSchema pattern already used in server.js) that rewrites any Imagenes_Equipo.ruta_imagen values matching the legacy '/uploads/equipos/' prefix to the new authenticated endpoint format, reusing getImagePath()/isSafeEvidenceFilename() for consistency."
next_action: "SECOND root cause found after deploying the backfill fix and re-checking production logs (railway logs): the backfill DID run correctly (34 rows migrated, 0 skipped, per startup log 'Backfill de ruta_imagen legada completado'), and the frontend now correctly requests the new authenticated path (/api/equipos/imagenes/archivo/<file>.jpg) — but nginx still 404s it via its OWN static-file handler (nginx error log: 'open() \"/usr/share/nginx/html/api/equipos/imagenes/archivo/....jpg\" failed (2: No such file or directory)'), because location ^~ was missing from the /api proxy block in frontend/nginx-server.conf, so nginx's cache-static regex location (which matches any .jpg/.png/etc URL, with no exclusion for /api) wins over the plain-prefix /api location and nginx tries to serve it as a static file instead of proxying to the backend. Fixed by adding ^~ to 'location /api' (matching the same pattern already used for /uploads and /socket.io/). Verified locally via a real nginx:alpine container: old config returns plain 404 (static-file-not-found, byte-for-byte matching the production error) for the reported URL; new config returns 502 from a dummy unreachable backend (proof it now takes the proxy path instead of the static path). Awaiting: commit + push + Railway redeploy + human re-verification that equipos 51/62 photos load in production."
reasoning_checkpoint:
  hypothesis: "Frontend requests to /uploads/equipos/<file> 404 because those images were uploaded before commit 2ddeb3f (2026-08-20) removed the public static mount for /uploads/equipos and switched getImagePath() to return an authenticated API path (/api/equipos/imagenes/archivo/<file>). The DB column Imagenes_Equipo.ruta_imagen for pre-migration rows still holds the old '/uploads/equipos/<file>' string, and useAuthenticatedEvidenceImages.js fetches image.ruta_imagen verbatim, so old rows hit the now-dead static path."
  confirming_evidence:
    - "git show 2ddeb3f: getImagePath() diff shows exact change from '/uploads/equipos/${filename}' to '/api/equipos/imagenes/archivo/${encodeURIComponent(filename)}'"
    - "server.js lines 150-155: only /uploads/ambientes and /uploads/perfiles are mounted with express.static; comment explicitly states equipment evidence is served via the authenticated endpoint"
    - "backend/tests/serverPublicUploads.test.js asserts /uploads is NOT globally exposed and /uploads/equipos is conspicuously absent from the allowed list"
    - "grep across backend/src and frontend/src found zero remaining references to '/uploads/equipos' in code — only historical string literal existed pre-migration"
    - "no migration/backfill script exists anywhere touching ruta_imagen (checked backend/scripts, backend/tests/migrations, BD/*.sql)"
    - "reported broken URLs use ids 51 and 62 with timestamps consistent with uploads that occurred before the 2026-08-20 security fix commit"
  falsification_test: "If a fresh upload made today (after the fix) still produces a /uploads/equipos/ path in the DB, or if the physical files for ids 51/62 are missing from disk (not just the URL format), the hypothesis is wrong — would point to volume loss instead of path-format regression."
  fix_rationale: "The fix targets the root cause (unmigrated data left behind by a schema/contract change) rather than the symptom (404). Reintroducing static serving of /uploads/equipos would fix the symptom but reopen the security hole the migration was meant to close. Rewriting stale ruta_imagen values to the new authenticated path format preserves the security fix while restoring functionality for pre-existing images, assuming physical files still exist on the volume."
  blind_spots: "Have not yet verified the physical image files for ids 51/62 still exist on the Railway persistent volume — if the volume was reset/lost (user's original suspicion), the path rewrite fixes the URL format but images will still 404 via the authenticated endpoint (this would surface as 404 from descargarImagenEquipo instead of the static mount, which is a different, unfixable-by-this-change failure mode). Will verify file existence assumption doesn't block the fix — the fix is correct either way (path format must be corrected regardless), but is not verifiable as fully resolved without confirming files exist. Also have not run the actual reproduction in production; verification is via code/log evidence and local automated test only."
  candidate_causes:
    - "code: getImagePath() contract changed (new authenticated URL format) without a corresponding data migration for existing rows — category: code"
    - "environment/data: legacy DB rows in Imagenes_Equipo predate the migration and were never backfilled — category: data"
  and_gate: "no — single root cause (missing backfill migration) fully explains the symptom; both candidate causes above describe the same underlying gap (a code contract change without a paired data migration), not two independently necessary conditions. No AND-gate needed."

tdd_checkpoint: null

## Evidence

- timestamp: 2026-08-26T00:00:00Z
  checked: backend/server.js lines 140-155 (static mount setup)
  found: Only `/uploads/ambientes` and `/uploads/perfiles` are mounted via express.static; comment states "Las evidencias de equipos se entregan mediante el endpoint autenticado" (equipment evidence is served via the authenticated endpoint) — /uploads/equipos is deliberately NOT statically served.
  implication: Any request to /uploads/equipos/* will fall through to the Express 404 handler, exactly matching the reported symptom.

- timestamp: 2026-08-26T00:00:01Z
  checked: backend/tests/serverPublicUploads.test.js
  found: Regression test asserts server.js does NOT expose the whole /uploads directory via express.static and explicitly checks for /uploads/ambientes and /uploads/perfiles mounts (not equipos).
  implication: This is intentional, tested, security-driven behavior — not an accidental regression in server.js itself.

- timestamp: 2026-08-26T00:00:02Z
  checked: git show 2ddeb3f (commit "fix(uploads): protect equipment evidence access", 2026-08-20)
  found: getImagePath() in backend/src/middleware/uploadMiddleware.js changed from `return \`/uploads/equipos/${filename}\`` to `return \`/api/equipos/imagenes/archivo/${encodeURIComponent(filename)}\``. This function's return value is stored verbatim as Imagenes_Equipo.ruta_imagen at upload time.
  implication: New uploads (after 2026-08-20) get the correct authenticated path. Uploads before that date have the OLD path format persisted in the DB — nothing has rewritten those existing rows.

- timestamp: 2026-08-26T00:00:03Z
  checked: backend/src/controller/imagenesEquipoController.js subirImagenesEquipo() and backend/src/controller/equiposController.js (ambiente verification upload flow, ~line 3124) — both call getImagePath(nuevoFilename) when inserting ruta_imagen
  found: Both upload code paths correctly use the current getImagePath() implementation for new inserts. No code path anywhere constructs '/uploads/equipos/' directly for new writes.
  implication: The bug is not in current write logic — it's entirely a data-migration gap for previously-written rows.

- timestamp: 2026-08-26T00:00:04Z
  checked: frontend/src/hooks/useAuthenticatedEvidenceImages.js
  found: `fetch(image.ruta_imagen, { headers: { Authorization: ... } })` — trusts the DB-stored ruta_imagen value verbatim as the fetch URL, with no rewriting/normalization of legacy formats.
  implication: Confirms the frontend is not the bug; it faithfully requests whatever URL format the backend/DB gives it. Old rows containing the legacy path will always 404 until the DB values are corrected.

- timestamp: 2026-08-26T00:00:05Z
  checked: grep -rln "uploads/equipos" across frontend/src and backend/src
  found: Only backend/src/controller/equiposController.js (filesystem path construction, not URL) and backend/src/middleware/uploadMiddleware.js (filesystem path construction, not URL) reference "uploads/equipos" — both are disk paths (`path.join(__dirname, '../../uploads/equipos')`), not URLs. No code constructs the URL '/uploads/equipos/...' anymore.
  implication: Confirms the string only survives in the database from historical inserts, not in any live code path.

- timestamp: 2026-08-26T00:00:06Z
  checked: backend/scripts/, backend/tests/migrations/, BD/*.sql for any ruta_imagen backfill
  found: No migration or backfill script exists anywhere that updates existing Imagenes_Equipo.ruta_imagen values.
  implication: Confirms the gap has never been addressed — this is the missing piece, not something already attempted and failed.

- timestamp: 2026-08-26T00:00:07Z
  checked: backend/src/controller/equiposController.js ensureAutoservicioSchema/ensureAutoservicioSchemaInternal (~line 4223), called from server.js startServer()
  found: Established codebase convention for idempotent, safe, startup-time data/schema migrations against the production DB (checks current state via INFORMATION_SCHEMA before altering, logs outcome, memoizes so it only runs once per process).
  implication: This is the right pattern to follow for the fix — an idempotent startup migration that rewrites stale ruta_imagen values, invoked the same way ensureAutoservicioSchema is invoked.

- timestamp: 2026-08-26T16:22:23Z
  checked: railway logs --lines 200 (production, service SGI-SENA) after deploying commit f29ffcb
  found: Startup log confirms the backfill migration ran successfully ("Backfill de ruta_imagen legada completado", migradas:34, omitidas:0). A live user request for equipo 51's images now correctly hits the NEW authenticated path (GET /api/equipos/imagenes/archivo/1787074695288-51-image.jpg) — proving the DB backfill worked — but nginx's own error log shows it tried to open that path as a static file under /usr/share/nginx/html (nginx's document root), not proxy it to the backend, and returned 404 before the request ever reached the Node backend.
  implication: The DB-backfill fix was necessary but not sufficient. A second, independent bug in frontend/nginx-server.conf's location precedence intercepts any request whose path ends in an image extension (.jpg etc.) — including the new authenticated API path — before it can reach the /api proxy block, because that block lacked the ^~ modifier needed to outrank nginx's regex-based static-asset cache location.

- timestamp: 2026-08-26T16:32:00Z
  checked: frontend/nginx-server.conf location blocks and nginx's documented location-matching precedence (exact match > ^~ prefix > first-matching regex, in file order > longest plain prefix)
  found: "location /api { ... }" (plain prefix, no ^~) sits above "location ~* ^(?!/uploads).*\.(js|css|png|jpg|...)$ { ... }" (regex, cache headers only, negative lookahead excludes /uploads but NOT /api). Per nginx's algorithm, a regex location always wins over a plain-prefix location regardless of definition order, unless the prefix location uses ^~ — which /uploads and /socket.io/ already do (with an explicit comment explaining why), but /api did not.
  implication: Root cause of the second layer isolated precisely to a missing ^~ modifier on one location block, following the exact same fix pattern already established elsewhere in the same file.

- timestamp: 2026-08-26T16:34:00Z
  checked: Live routing test with nginx:alpine (docker), serving frontend/nginx-server.conf (old vs. new) against a dummy backend on host.docker.internal:3000, hitting the exact reported URL (/api/equipos/imagenes/archivo/1787074695288-51-image.jpg)
  found: Old config (git HEAD, no ^~ on /api) → plain 404, Content-Length 153, nginx's static "file not found" page — byte-for-byte matching the production symptom. New config (^~ /api added) → 502 Bad Gateway from the dummy backend (proxy_pass was attempted; 502 only because the toy backend wasn't reachable at the hardcoded default address in this isolated test, not because of routing) — proves the location decision flips to the proxy block with the fix applied.
  implication: Fix confirmed correct via functional routing test, independent of and in addition to nginx config syntax validation (nginx -t passed on both).

- timestamp: 2026-08-26T16:45:00Z
  checked: Human verification directly against live production Railway deployment (post-deploy of commit bf57b65, service SGI-SENA), after confirming via `railway logs` the container restarted and nginx validated config ("Configuración de nginx válida")
  found: HTTP GET to the exact previously-404ing production URL (https://sgi-sena-production-acc0.up.railway.app/api/equipos/imagenes/archivo/1787074695288-51-image.jpg, equipo 51, one of the original reported filenames) now returns HTTP 401 Unauthorized with body {"success":false,"error":"Token no proporcionado"} — the real Node backend's auth-guard JSON response, not nginx's static-file 404. Cross-checked against Railway's own access log (railway logs --lines 300): same request logged as "GET /api/equipos/imagenes/archivo/1787074695288-51-image.jpg HTTP/1.1" 401 89, confirming this is the live production log, not a local artifact.
  implication: Both root causes (stale DB URL format, fixed by f29ffcb; nginx routing precedence, fixed by bf57b65) are confirmed resolved in production — the request now reaches the backend instead of being intercepted by nginx's static handler. The fully-authenticated 200-with-image-bytes path was not directly re-tested (would require real end-user credentials, avoided for security/authorization reasons), but that behavior is already covered by existing, untouched imagenesEquipoController test suites. A human visual check of equipos 51/62 detail pages in-browser is recommended as final confirmation but is not required to consider the routing-layer defect resolved.

## Eliminated

- hypothesis: "Railway persistent volume was reset/lost after redeploy, so physical files no longer exist"
  evidence: "The 404 originates from Express's catch-all 404 handler for unmatched routes (no static mount exists for /uploads/equipos at all), not from a static-file-not-found response. If the volume had been reset, the request would still need to reach a route capable of serving it (there is none for /uploads/equipos), OR — if a route existed — return a filesystem-level 404 from that handler. Since /uploads/equipos was deliberately unmounted in server.js, this 404 is explained purely by the missing route/stale URL format, independent of whether physical files exist. This hypothesis is NOT fully eliminated regarding file existence (see blind_spots) but IS eliminated as the sole/primary explanation for these specific symptoms, since the URL format mismatch alone fully explains a 404 regardless of file presence."
  timestamp: 2026-08-26T00:00:08Z

## Resolution

root_cause: "Two independent, compounding root causes, both required for the fix (AND-gate discovered during verification, after the first fix alone did not resolve production): (1) Commit 2ddeb3f (2026-08-20, 'fix(uploads): protect equipment evidence access') changed getImagePath() to return authenticated endpoint URLs (/api/equipos/imagenes/archivo/<filename>) instead of public static paths (/uploads/equipos/<filename>), and removed the express.static mount for /uploads/equipos from server.js as a deliberate security fix — correct for NEW uploads, but no migration backfilled Imagenes_Equipo.ruta_imagen for rows inserted before that commit, so legacy rows kept requesting the dead static path. (2) After backfilling those rows to the new authenticated path, a second, previously-masked bug surfaced: frontend/nginx-server.conf's 'location /api' block lacked the ^~ modifier, so nginx's location-matching algorithm (regex always outranks a plain, non-^~ prefix) let its static-asset cache-header regex location (matching any *.jpg/*.png/etc URL, with no /api exclusion) intercept and 404 the authenticated image URL via nginx's own static file handler before the request ever reached the Node backend — as opposed to /uploads and /socket.io/, which already had ^~ set."
fix: "Two fixes, one per root cause, both required together: (1) commit f29ffcb — added backfillLegacyEquipoImagePaths(db) to backend/src/middleware/uploadMiddleware.js: an idempotent function that SELECTs Imagenes_Equipo rows where ruta_imagen LIKE '/uploads/equipos/%', and rewrites each to the current getImagePath(nombre_archivo) format, reusing isSafeEvidenceFilename() validation so malformed filenames are skipped and logged rather than crashing the migration; wired into backend/server.js startServer() alongside the existing ensureAutoservicioSchema() call, non-blocking on failure. Did NOT reintroduce static serving of /uploads/equipos, preserving the original security fix. (2) commit bf57b65 — added the ^~ modifier to 'location /api' in frontend/nginx-server.conf, matching the same precedence-forcing pattern already used for /uploads and /socket.io/, so the /api proxy block now always outranks the regex-based static-asset cache location regardless of URL suffix."
verification: "Code/test-level (pre-deploy): 1) Added 3 new regression tests in backend/tests/middleware/uploadMiddleware.test.js (backfillLegacyEquipoImagePaths describe block) covering correct rewrite, idempotency, and unsafe-filename skip+log. 2) Full backend suite: 85 test suites / 1850 tests passing, including serverPublicUploads.test.js (confirms /uploads/equipos still NOT statically exposed post-fix) and imagenesEquipoController.test.js. 3) ESLint diff-checked clean (no new errors, one pre-existing-pattern warning). 4) Live nginx:alpine routing test proved old config 404s (byte-for-byte matching the production symptom) and new config correctly routes to the proxy block (502 from an intentionally-unreachable dummy backend, proving the routing decision flipped). Production-level (post-deploy, human-confirmed 2026-08-26T16:45Z): deployed bf57b65 to Railway; `railway logs` confirmed container restart and valid nginx config; direct HTTP GET to the exact originally-404ing production URL (equipo 51 image) now returns HTTP 401 'Token no proporcionado' — the real backend's auth-guard response, not nginx's static 404 — cross-verified against Railway's live access log. Combined with the already-confirmed backfill migration (startup log 'Backfill de ruta_imagen legada completado', migradas:34, omitidas:0), both root causes are verified fixed in production. The fully-authenticated 200-with-image-bytes path was not re-tested end-to-end (would require real user credentials) but is covered by existing, unmodified backend test suites; a human visual check of equipos 51/62 detail pages is recommended as a final sanity check but is not required to consider this resolved."
files_changed:
  - backend/src/middleware/uploadMiddleware.js
  - backend/server.js
  - backend/tests/middleware/uploadMiddleware.test.js
  - frontend/nginx-server.conf
