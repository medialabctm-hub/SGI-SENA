<!-- refreshed: 2026-08-27 -->
# Codebase Concerns

**Analysis Date:** 2026-08-27

## Tech Debt

**Inadequate Query Column Specification:**
- Issue: Several queries use `SELECT *` instead of explicitly listing required columns, increasing data transfer overhead and creating brittle dependencies on schema changes
- Files: 
  - `backend/src/controller/importController.js` (Importaciones_Duplicados queries)
  - `backend/src/repositories/AmbienteRepository.js` (multiple ambientes queries)
- Impact: Performance degradation with large datasets; hidden schema coupling; harder to refactor
- Fix approach: Replace all `SELECT *` with explicit column lists; update repository queries to be column-specific

**Empty Catch Blocks:**
- Issue: Silent error suppression in critical paths without logging
- Files:
  - `backend/src/controller/equiposController.js` line ~4300 (`catch (e) {}`)
  - `backend/src/controller/novedadesController.js` (`catch (_) {}`)
- Impact: Failures go unnoticed in production; makes debugging impossible; masks data integrity issues
- Fix approach: Log all caught errors with context; never swallow errors silently; consider if the error should fail the operation instead

**Promise.catch() with Fallback Objects:**
- Issue: JSON parsing failures silently return empty objects, masking API contract violations
- Files:
  - `frontend/src/components/ImportarEquipos.jsx` (multiple `.json().catch(() => ({}))`)
  - `frontend/src/pages/AsignarEquipo.jsx` 
  - `frontend/src/pages/CrearMantenimiento.jsx`
  - `frontend/src/pages/config/Security.jsx`
- Impact: Failed API responses treated as valid empty data; user sees no error message; silent data loss
- Fix approach: Log parse failures; distinguish between "no data" and "parse error"; propagate parse failures to UI error handling

**Inconsistent Error Handling Patterns:**
- Issue: Mix of direct catch blocks, handleControllerError wrapper, and silent failures across backend controllers
- Files: All controller files in `backend/src/controller/`
- Impact: Inconsistent HTTP status codes; some errors return detailed info, others generic messages; testing and monitoring complexity
- Fix approach: Establish single error handling pattern; ensure all errors go through `handleControllerError` or equivalent; standardize response shapes

## Known Bugs

**Equipment Image Upload/Serving Pipeline - Recently Fixed (2026-08-26):**
- Symptoms: Legacy equipment photos (uploaded before 2026-08-20) return 404; newer uploads fail to display visually
- Root causes: 
  1. Commit 2ddeb3f changed image path format from `/uploads/equipos/<file>` to authenticated endpoint but left old DB rows unmigrated
  2. nginx location block precedence (regex outranking plain `/api` prefix) routed authenticated image requests to static handler
  3. Frontend mounted `<img src="">` transitively before async auth-fetch completed, triggering onError that imperatively hid images permanently
- Files affected:
  - `backend/src/middleware/uploadMiddleware.js` (migration logic added)
  - `backend/server.js` (backfill startup call added)
  - `frontend/nginx-server.conf` (^~ modifier added to /api block)
  - `frontend/src/pages/DetalleEquipo.jsx` (guard mounting + broken image tracking)
  - `frontend/src/hooks/useAuthenticatedEvidenceImages.js`
- Status: **RESOLVED** (commits f29ffcb, bf57b65, 9373ce8) - verified in production 2026-08-26T16:45Z
- Fragility: This pipeline remains fragile due to:
  - Multiple independent integration points (nginx routing, backend authentication, frontend blob URL handling)
  - Async/blob URL pattern is prone to timing bugs (as evidenced by src="" transitivity issue)
  - No end-to-end test covering the full authenticated-image flow in browser

**Equipment PC Loan Request Missing Time Display - Recently Fixed (2026-08-26):**
- Symptoms: Confirmation screen after PC loan request shows date but not time, though time is saved in DB
- Root cause: Backend endpoint `POST /api/equipos/autoservicio/iniciar-uso` returns 3 response paths (success/idempotent-active/idempotent-by-key) but none included `fecha_hora_inicio` in the JSON payload; frontend confirmation screen had no time render logic
- Files affected:
  - `backend/src/controller/equiposController.js` (fecha_hora_inicio added to 3 response paths)
  - `frontend/src/pages/SolicitarEquipo.jsx` (time render added)
  - `frontend/src/utils/loanRequest.js` (formatLoanStartTime added)
- Status: **RESOLVED** (backend/frontend fixes applied) - verified via local E2E test 2026-08-26
- Fragility: Demonstrates a pattern of incomplete API contracts (data saved but not returned), indicating other endpoints may have the same gap

## Security Considerations

**Authentication Not Enforced on Image Download Endpoint:**
- Risk: Equipment images served at `/api/equipos/imagenes/archivo/<filename>` require Bearer token, but if a user obtains a valid blob URL, they can share/forward it without checking authorization for that specific image
- Files: `backend/src/controller/imagenesEquipoController.js` (descargarImagenEquipo endpoint)
- Current mitigation: Token required; session/role validation per request; blob URLs expire with session
- Recommendations: 
  - Audit that descargarImagenEquipo re-validates ownership (equipo belongs to user's ambiente)
  - Consider time-limited, single-use presigned URLs for shared access instead of long-lived blob URLs
  - Log all image downloads for audit trail

**File Upload Validation Relies on Single MIME Type Check:**
- Risk: `validateImageFile()` in `backend/src/middleware/fileValidation.js` may be bypassable via MIME spoofing
- Files: `backend/src/middleware/uploadMiddleware.js` (fileFilter uses validateImageFile)
- Current mitigation: Content-based validation via `validateImageContent()` re-checks magic bytes on upload
- Recommendations: 
  - Ensure `validateImageContent()` is called on ALL upload paths, not just some
  - Add file size sanity check per image dimension (detect zipbombs)
  - Verify magic byte checks are done server-side before storing

**LocalStorage Usage for Auth Token:**
- Risk: Frontend stores JWT in localStorage, vulnerable to XSS; if JS is injected, attacker can read/steal token
- Files: `frontend/src/pages/Config.jsx` and other components (reads/writes localStorage for user/token)
- Current mitigation: Helmet CSP in backend; no data: URIs; xss-clean middleware
- Recommendations: 
  - Migrate to httpOnly cookies (requires backend session middleware)
  - If staying with localStorage, add Content-Security-Policy stricter than current (no 'unsafe-inline')
  - Audit frontend for inline script tags or eval-like patterns

**No Rate Limiting on Image Upload Endpoint:**
- Risk: User can upload unlimited equipment images, exhausting disk/bandwidth
- Files: `backend/src/controller/imagenesEquipoController.js` (subirImagenesEquipo)
- Current mitigation: Multer fileSize limit 10MB per file; maxFiles 10 per request; but no per-user rate limit
- Recommendations: 
  - Add express-rate-limit on image upload routes (e.g., 50 files/hour per user)
  - Enforce disk quota per ambiente/equipo
  - Delete old images when quota exceeded (with audit log)

## Performance Bottlenecks

**Large Equipment Controller File (4653 lines):**
- Problem: `backend/src/controller/equiposController.js` has become a monolithic God Object; any change touches multiple responsibilities; high risk of unintended side effects
- Files: `backend/src/controller/equiposController.js`
- Cause: All equipment-related operations (CRUD, image handling, assignment, autoservice, history) merged into one file
- Improvement path: 
  - Extract image operations to `imagenesEquipoController.js` (already exists but incomplete)
  - Extract assignment logic to `asignacionesEquipoController.js`
  - Extract autoservice/loan logic to `autoservicioEquipoController.js`
  - Use facade pattern in equiposController to delegate to specialization controllers
  - Expected benefit: 25-30% reduction in context switching; easier testing; clearer responsibility boundaries

**Synchronous File System Operations in Request Handlers:**
- Problem: `fs.existsSync()`, `fs.unlinkSync()` in `backend/src/middleware/uploadMiddleware.js` block the event loop
- Files: 
  - `backend/src/middleware/uploadMiddleware.js` lines 169-177 (deleteImageFile)
  - Implicit in multer disk storage destination callback
- Cause: Convenience; small files; insufficient load testing
- Improvement path: 
  - Replace fs.unlinkSync with fs.promises.unlink (non-blocking)
  - Use async error handling (wrap in try-catch in async context)
  - Add queue/worker thread for batch deletions during cleanup

**No Query Pagination on Large Datasets:**
- Problem: Several list endpoints return ALL matching records without pagination, causing memory/network bloat
- Files:
  - `backend/src/repositories/AmbienteRepository.js` (listarAmbientesActivos no limit)
  - `backend/src/controller/equiposController.js` (some queries fetch all equipment for user)
- Cause: Small test datasets; pagination not added as feature grew
- Improvement path: Enforce pagination on all list endpoints (limit default 50, max 500); cursor-based for large result sets

**N+1 Query Problem in Equipment Detail View:**
- Problem: `backend/src/controller/equiposController.js` obtenerDetalleEquipo fetches equipo, then loops querying images, responsables, history per call
- Files: `backend/src/controller/equiposController.js` (obtenerDetalleEquipo method)
- Cause: Incremental development; missing JOIN optimization
- Improvement path: 
  - Rewrite to fetch all related data in 2-3 queries using JOINs
  - Expected improvement: 50-80% latency reduction for high-detail requests

## Fragile Areas

**Autoservice Loan Request Flow:**
- Files: 
  - Backend: `backend/src/controller/equiposController.js` (iniciarUsoAutoservicio ~4353-4585)
  - Frontend: `frontend/src/pages/SolicitarEquipo.jsx` (form + confirmation)
  - API contract: Must include fecha_hora_inicio, equipo, aprendiz, clase objects
- Why fragile: 
  - 3 different response paths (success/idempotent/cached) must all return identical shape; inconsistency causes frontend to not render fields
  - Relies on implicit assumptions about when fecha_hora_inicio is captured (new Date() in JS vs NOW() in SQL)
  - No TypeScript/schema validation on response shape — frontend discovers missing fields at runtime
- Safe modification: 
  - Run backend/tests/controllers/equiposController.test.js before any change to response structure (122 tests cover all 3 paths)
  - If adding/removing fields from response, update loanRequest.js formatting function + SolicitarEquipo.jsx render
  - Add response schema test validating all 3 paths return identical field set

**Image Upload/Serving Endpoint Interactions:**
- Files:
  - `backend/src/controller/imagenesEquipoController.js` (subirImagenesEquipo, descargarImagenEquipo)
  - `backend/src/middleware/uploadMiddleware.js` (getImagePath, isSafeEvidenceFilename)
  - `frontend/src/hooks/useAuthenticatedEvidenceImages.js` (fetch authenticated URLs)
  - `frontend/src/pages/DetalleEquipo.jsx` (render images with onError handling)
  - `frontend/nginx-server.conf` (routing to backend API)
- Why fragile:
  - Compounded by recent fixes (legacy path backfill, nginx routing, frontend guard mounting, blob URL broken-image tracking)
  - Changes to filename validation affect both upload acceptance AND download path construction — easy to create files uploadable but not downloadable
  - Nginx and backend auth are separate concerns; misconfiguration in one hides bugs in the other
  - Blob URL lifecycle not explicitly documented (tied to session, not refreshed)
- Safe modification:
  - ALL changes to isSafeEvidenceFilename must be tested on both upload (accept) and download (reject) paths
  - Any nginx config change needs live routing test (docker nginx container + test URLs)
  - If modifying blob URL generation, test that refetch (e.g., marking image as principal) invalidates old blob URLs in frontend state

**Equipment Claim & Transaction Locking:**
- Files:
  - `backend/src/utils/equipmentClaim.js` (beginEquipmentClaim, lockEquipmentRow)
  - `backend/src/controller/equiposController.js` (uses beginEquipmentClaim in multiple endpoints: ~429, ~716, ~2505)
- Why fragile:
  - Manual transaction lifecycle management (transactionStarted boolean flags); easy to forget rollback on error
  - Nested transaction calls must be coordinated (already open vs open new)
  - Lock held across I/O (file deletion, notification sends) increases deadlock risk
  - No timeout/deadlock recovery besides MySQL default (50 seconds)
- Safe modification:
  - Wrap all transactionStarted flows in try/finally to ensure cleanup
  - Use BaseRepository.transaction() helper pattern where possible instead of manual begin/rollback
  - Log lock acquisition/release for audit trail of contested equipment

**Database Schema Constraints & Foreign Keys:**
- Files: `BD/SGI_SENA.sql` (all table definitions)
- Why fragile:
  - Multiple cascade/set null behaviors on Usuarios (creado_por) — deleting a user can cascade-delete their created records or set to NULL depending on table
  - No soft-delete pattern — physical deletions trigger cascades; accidental delete unrecoverable
  - Unique constraints (cedula, correo, documento) are case-sensitive in MySQL utf8mb4; collation inconsistencies can cause "already exists" bugs
- Safe modification:
  - Before any migration/alter table, back up production data
  - Test cascade behavior explicitly (what gets orphaned vs deleted when)
  - Consider adding soft-delete (deleted_at timestamp) column to critical tables before expanding user base

## Scaling Limits

**Database Connection Pool:**
- Current capacity: Default mysql2 pool (10 connections)
- Limit: Under load (>50 concurrent users), connection timeouts and "too many connections" errors
- Files: `backend/src/config/dbconfig.js` (pool config)
- Scaling path: 
  - Increase pool size to 20-30 for 100 concurrent users (monitor with `SHOW PROCESSLIST`)
  - Add connection pooling proxy (PgBouncer or similar) if moving beyond 200 concurrent users
  - Implement query result streaming for large reports

**File Storage (Uploads Directory):**
- Current capacity: Unlimited filesystem growth; Railway persistent volume not monitored
- Limit: If all users upload 5MB equipment images for 5 years, could exhaust volume
- Files: `backend/src/middleware/uploadMiddleware.js` (stores in ./uploads/equipos)
- Scaling path: 
  - Implement disk quota enforcement per ambiente/user
  - Add cleanup job (delete images >6 months old)
  - Migrate to cloud storage (S3, Azure Blob) as volume grows
  - Add metrics: "disk used by equipment images" to monitoring

**Session/Token Lifetime:**
- Current capacity: No token expiry configured; logout only clears localStorage
- Limit: Stale tokens remain valid indefinitely; security risk if token leaked
- Files: `backend/src/middleware/authMiddleware.js`, `frontend/src/pages/Config.jsx`
- Scaling path: 
  - Add JWT expiry (30 min access, 7 day refresh)
  - Implement token refresh endpoint (refresh_token cookie)
  - Log out all user sessions on password change
  - Add session revocation list (Redis) for immediate logout

## Dependencies at Risk

**Socket.io (^4.8.1):**
- Risk: Real-time notifications feature introduced but no usage pattern established; potential for resource leaks (orphaned connections, memory pressure)
- Impact: If notifications scale heavily without proper room/namespace design, could consume unbounded memory
- Files: 
  - `backend/server.js` (socket.io setup)
  - `backend/src/services/notificationService.js` (emit calls)
  - Multiple frontend pages subscribe to socket events
- Migration plan: 
  - Audit socket event subscribers (find all .on() calls)
  - Add connection limits per user
  - Implement heartbeat/ping to detect dead connections
  - Consider moving to Server-Sent Events (SSE) for simpler push notifications

**Express (^4.21.2) with Node 18+ deprecations:**
- Risk: Express 4.x is in maintenance mode; some plugins may drop support soon
- Impact: Security patches may lag; new Node versions may break compatibility
- Files: All backend server code
- Migration plan: 
  - Monitor for security advisories (npm audit)
  - Start internal migration planning to Express 5 or Fastify (long-term)
  - Keep Node to LTS versions (18, 20); avoid odd minor versions

**Multer (^2.0.2):**
- Risk: File upload handling is critical path; older multer versions had race conditions on disk
- Impact: Concurrent uploads could corrupt/overwrite files
- Files: `backend/src/middleware/uploadMiddleware.js`
- Migration plan: Keep updated; monitor for CVEs; consider alternative (busboy) if issues arise

**JWT Library (^9.0.2):**
- Risk: jsonwebtoken is unmaintained by original author; community takeover ongoing
- Impact: May have security lag; verify signing algorithm is HS256 or RS256 (not 'none')
- Files: `backend/src/middleware/authMiddleware.js`, `backend/src/utils/tokenService.js`
- Migration plan: 
  - Audit current JWT implementation for 'none' algorithm vulnerability
  - Consider jose (modern JOSE library) as longer-term replacement
  - Set algorithm explicitly in verify/sign calls (don't let client choose)

## Missing Critical Features

**No User Activity Audit Trail:**
- Problem: No log of who did what and when; critical for compliance/debugging
- Blocks: Equipment accountability, investigating unauthorized changes, user behavior analysis
- Files: No audit implementation found in controllers
- Effort: Add middleware to log all API calls (user, method, endpoint, status) to Auditoria table

**No Bulk Export/Import Validation:**
- Problem: `backend/src/controller/importController.js` imports Excel files but no dry-run mode; easy to corrupt database with bad import
- Blocks: Safe mass data updates, rollback capability
- Effort: Add transaction-based import with validation report before commit

**No Soft Delete Pattern:**
- Problem: All deletes are hard; cascade rules can orphan/delete unintended records
- Blocks: Audit trail, undeleting mistakes, compliance with data retention policies
- Effort: Add deleted_at timestamp to critical tables; filter all queries to exclude soft-deleted rows

**No Real-time Notifications for Critical Events:**
- Problem: Equipment breakage, maintenance overdue, user access revoked — no immediate alert mechanism
- Blocks: Timely response to equipment issues, security incident response
- Effort: Socket.io is wired but needs comprehensive event emission strategy

## Test Coverage Gaps

**Autoservice Loan Request Edge Cases:**
- What's not tested: 
  - Concurrent requests from same user for same equipment (race condition)
  - Loan request after equipment marked as maintenance
  - Idempotency replay after network error (does frontend retry correctly?)
- Files: `backend/tests/controllers/equiposController.test.js` (equiposAssignmentAutoservicio.test.js covers 3 response paths but not concurrency)
- Risk: Race conditions go unnoticed until production; user confusion if duplicate loans created
- Priority: HIGH — autoservice is primary user-facing feature

**Image Upload Content Validation:**
- What's not tested: 
  - Malformed image files (truncated PNG, corrupted JPEG)
  - MIME spoofing (file named .jpg but actually ZIP)
  - Very large dimensions (10000x10000px; could cause browser to hang)
- Files: No dedicated test file for `validateImageContent()` in fileValidation.js
- Risk: Malicious uploads crash frontend viewer; corrupt database with invalid paths
- Priority: MEDIUM — requires attacker effort but impacts data integrity

**Permission/Role Cascade on User Deletion:**
- What's not tested: 
  - Deleting user with multiple roles assigned
  - Deleting user with custom equipment permissions
  - Verify all orphaned records are handled correctly
- Files: `backend/tests/controllers/authController.test.js` (minimal deletion tests)
- Risk: Orphaned permission records; unclear cascade behavior
- Priority: MEDIUM — rare but catastrophic if triggered

**Frontend State Inconsistency Under Network Errors:**
- What's not tested: 
  - Partial upload success (5 of 10 images uploaded, then timeout)
  - Response received but not JSON-parseable
  - Server error after optimistic UI update
- Files: `frontend/src/components/ImportarEquipos.jsx`, `frontend/src/pages/DetalleEquipo.jsx` (show .catch(() => ({})) but no test)
- Risk: UI state diverges from server; user thinks operation succeeded when it failed
- Priority: MEDIUM — affects data consistency

---

*Concerns audit: 2026-08-27*
