# External Integrations

**Analysis Date:** 2026-08-27

## APIs & External Services

**Email/SMTP:**
- Brevo (formerly Sendinblue) - Transactional email service
  - SDK/Client: `@getbrevo/brevo` 1.0.0
  - Auth: `BREVO_API_KEY` (for API) and `BREVO_SMTP_KEY` (for SMTP fallback)
  - Usage: `backend/src/services/emailService.js` - password resets, account creation, bulk user emails
  - Endpoints: Sends emails via `TransactionalEmailsApi.sendTransacEmail()`
  - Implementation: Dynamic SDK loading with async initialization and reinit on startup (`backend/server.js` line 241-244)

**Real-time Communication:**
- Socket.io 4.8.1 - WebSocket server for live notifications
  - Backend: `backend/src/services/socketService.js`
  - Frontend: `socket.io-client` 4.8.3 in `frontend/src/utils/api.js`
  - Usage: Real-time updates for equipment status, maintenance alerts, class notifications
  - Configuration: Proxy via Vite dev server to `http://localhost:3000` with `ws: true`

## Data Storage

**Databases:**
- MySQL 8.0 (Railway-hosted or local)
  - Connection: Environment variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - Alternative Railway vars: `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`
  - Client: `mysql2/promise` 3.15.3 with connection pooling
  - Pool Config: `backend/src/config/dbconfig.js` - 20 connections (prod), 10 (dev)
  - SSL: Auto-enabled for Railway deployments (rejectUnauthorized: false)
  - Schema: `BD/SGI_SENA.sql` initialized on Docker Compose startup
  - Timezone: Forced to Colombia timezone (`-05:00`) on every connection

**File Storage:**
- Local Filesystem only
  - Equipment photos: `backend/uploads/equipos/` (secured behind authenticated endpoint)
  - Environment photos: `backend/uploads/ambientes/` (served as public static via Nginx)
  - User profiles: `backend/uploads/perfiles/` (served as public static via Nginx)
  - Upload handling: Multer 2.0.2 in `backend/src/middleware/uploadMiddleware.js`
  - Legacypath backfill: `backend/src/middleware/uploadMiddleware.js` - backfillLegacyEquipoImagePaths()
  - Volume mount in production: `/app/backend/uploads` persists across restarts

**Caching:**
- Not detected - Session storage via JWT tokens only

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based
  - Implementation: `backend/src/services/authService.js`
  - Credentials: Cedula (ID) + password with bcrypt hashing
  - Token claims: User ID, role, permissions
  - Tokens: Access token (24h default, configurable via `JWT_EXPIRES_IN`) + Refresh token (7d default via `JWT_REFRESH_EXPIRES_IN`)
  - Verification: `backend/src/middleware/authMiddleware.js` extracts from Authorization header or cookies
  - Cookie storage: Also stored via `cookie-parser` with `COOKIE_SECRET`

**Authorization:**
- Role-based access control (RBAC)
  - Middleware: `backend/src/middleware/authorization.js`
  - Roles: Defined in `backend/src/config/permissions.js`
  - Scoped access: Equipment evidence scope in `backend/src/middleware/equipmentEvidenceScope.js`

**Password Reset:**
- Email link with time-limited token
  - Flow: User requests reset → Brevo sends link with encoded token → Token verified in `backend/src/controller/authController.js`
  - Link format: `FRONTEND_URL/restablecercontrasena?token={encryptedToken}`
  - Token TTL: 1 hour hardcoded in email template (`backend/src/services/emailService.js` line 583)

## Monitoring & Observability

**Error Tracking:**
- Not detected - Server errors logged to console only

**Logs:**
- Console-based logging via custom logger
  - Module: `backend/src/utils/logger.js`
  - Level: Configurable via `LOG_LEVEL` env var (default: `info`)
  - Transport: stdout, with structured JSON in production
  - Morgan 1.10.1 also logs HTTP requests:
    - Dev: `morgan('dev')` (short format)
    - Prod: `morgan('common')` (combined format, skip 2xx responses)

**Health Checks:**
- Endpoint: `GET /health` in `backend/server.js` line 175-181
  - Returns: JSON with status, environment, and autoservicio readiness
  - Docker healthcheck: `wget --spider http://localhost/health` (Dockerfile line 76, docker-compose line 65-69)
  - Check interval: 30s, timeout: 3s, 3 retries

## CI/CD & Deployment

**Hosting:**
- Railway.app - Primary cloud platform
  - Branch: Automatic deploys from GitHub (repo: https://github.com/gabriel-durango/SGI-SENA.git)
  - Build command: `Dockerfile` specified in `railway.json`
  - Start command: `/start.sh` (Docker entrypoint wrapper)
  - Restart policy: ON_FAILURE with max 10 retries

**CI Pipeline:**
- GitHub Actions (implicit, no workflow file in repo)
- Local CI command: `npm run ci` (runs linting, testing, frontend build)

**Containerization:**
- Multi-stage Dockerfile: `Dockerfile` (root)
  - Stage 1: Frontend build with Vite
  - Stage 2: Backend build (production npm modules only)
  - Stage 3: Final runtime (Nginx Alpine + Node.js)
  - Port exposed: 80 (Nginx), port 3000 (Node backend)
  - Volumes: `/app/backend/uploads` for persisted uploads

**Local Docker Compose:**
- File: `docker-compose.yml`
- Services: MySQL (port 3306), Backend (port 3000), Frontend (port 80)
- Network: `sge-network` (bridge)
- Data persistence: `mysql_data` volume

## Environment Configuration

**Required env vars (Backend):**
- Database: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- JWT: `JWT_SECRET`, `JWT_EXPIRES_IN` (default: 24h), `JWT_REFRESH_EXPIRES_IN` (default: 7d), `JWT_ISSUER`, `JWT_AUDIENCE`
- Cookies: `COOKIE_SECRET`
- Email: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`
- CORS: `CORS_ORIGIN` (comma-separated list), `FRONTEND_URL`
- Logging: `LOG_LEVEL` (default: info)
- Deployment: `NODE_ENV` (default: production)

**Optional env vars:**
- `BREVO_SMTP_KEY` - SMTP-based email fallback (legacy)
- `BREVO_SMTP_LOGIN` - SMTP login override
- `BREVO_SMTP_HOST`, `BREVO_SMTP_PORT` - SMTP server overrides
- `DB_CONNECTION_LIMIT` - Custom pool size (default: 20 prod, 10 dev)
- `WEBHOOK_SECRET` - For webhook verification (if used)

**Secrets location:**
- Production (Railway): Injected via platform environment UI → `process.env`
- Development: `.env` file (loaded via `dotenv` in `backend/src/config/config.js`)
- Docker Compose: `.env` file at root (via `environment:` in `docker-compose.yml`)
- NOTE: `.env*` files are NOT committed (listed in `.gitignore`)

**Frontend runtime config:**
- `VITE_API_URL`: Set in `vite.config.mjs` (build-time only)
- Dev proxy: Automatically proxies `/api` and `/socket.io` to localhost:3000

## Webhooks & Callbacks

**Incoming:**
- Not detected - No webhook receiver implemented

**Outgoing:**
- Scheduler triggers: `backend/src/services/schedulerService.js` has webhook infrastructure (`WEBHOOK_SECRET` env var)
  - Purpose: Notify external systems when classes start/end
  - Mechanism: Not fully implemented in current codebase (placeholder exists)

**Notification Events (Socket.io):**
- Class started/ended
- Equipment status changed
- Maintenance alerts
- User notifications (real-time via WebSocket)

## Data Import/Export

**Import:**
- Excel (XLSX): Bulk user/equipment/apprentice import
  - Frontend: `frontend/src/components/ImportarUsuarios.jsx`, `ImportarEquipos.jsx`, `ImportarAprendices.jsx`
  - Backend: `backend/src/services/**` handle parsing and DB insertion
  - Library: `xlsx` 0.18.5

**Export:**
- Excel: Equipment and apprentice reports via XLSX
- PDF: Reports via `jsPDF` 4.1.0 + `jspdf-autotable` 5.0.2

---

*Integration audit: 2026-08-27*
