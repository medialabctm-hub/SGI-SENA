# Technology Stack

**Analysis Date:** 2026-08-27

## Languages

**Primary:**
- JavaScript (Node.js + ES Modules) - Backend API server (`backend/server.js`, `backend/src/**/*.js`)
- JavaScript + JSX (React 18.2.0) - Frontend SPA (`frontend/src/**/*.jsx`)

**Secondary:**
- SQL - Database initialization scripts (`BD/SGI_SENA.sql`)

## Runtime

**Environment:**
- Node.js 20 (Alpine) - Containerized via `Dockerfile`, referenced in multi-stage build
- Browser (Modern ES2022+) - React 18.2.0 requires no IE11 support

**Package Manager:**
- npm - Workspace root manages both backend and frontend
- Lockfiles: `package-lock.json` present in backend/, frontend/, and root

## Frameworks

**Core:**
- Express.js 4.21.2 - REST API framework in `backend/src/**`
- React 18.2.0 - Frontend UI framework in `frontend/src/**`
- React Router 6.30.3 - Client-side routing (`frontend/src/pages/**`, `frontend/src/App.jsx`)

**Build & Dev:**
- Vite 7.2.2 - Frontend bundler and dev server (`frontend/vite.config.mjs`)
- Vitest 3.2.7 - Unit tests for React components (`frontend/src/**/*.test.js`)
- Jest 29.7.0 - Unit/integration tests for backend (`backend/jest.config.js`, `backend/tests/**`)
- Playwright 1.58.2 - E2E tests at root level (`playwright.config.js`, `npm run test:e2e`)

**Security & Middleware:**
- Helmet 8.1.0 - HTTP headers hardening in `backend/server.js`
- CORS 2.8.5 - Cross-origin resource sharing in `backend/server.js`
- Express Rate Limit 8.2.1 - Rate limiting via `backend/src/middleware/rateLimiter.js`
- Cookie Parser 1.4.7 - Cookie handling in `backend/server.js`
- Morgan 1.10.1 - HTTP request logging in `backend/server.js`
- XSS Clean 0.1.4 - XSS protection in `backend/server.js`
- HPP 0.2.3 - HTTP Parameter Pollution protection in `backend/server.js`

## Key Dependencies

**Critical:**
- mysql2 3.15.3 - MySQL connection pooling in `backend/src/config/dbconfig.js`
- jsonwebtoken 9.0.2 - JWT token generation/verification in `backend/src/services/authService.js`
- bcrypt 6.0.0 - Password hashing in `backend/src/services/authService.js`
- socket.io 4.8.1 - Real-time notifications in `backend/src/services/socketService.js`
- socket.io-client 4.8.3 - WebSocket client in `frontend/src/utils/api.js`

**Infrastructure:**
- Multer 2.0.2 - File upload handling in `backend/src/middleware/uploadMiddleware.js`
- Axios 1.13.2 - HTTP client for API requests in `frontend/src/utils/api.js`
- Validator 13.15.22 - Input validation in `backend/src/**`
- Zod 4.1.12 - Schema validation in `backend/src/**`
- crypto-js 4.2.0 - Encryption utilities in `backend/src/**`

**Document Generation:**
- jsPDF 4.1.0 - PDF generation in `frontend/src/pages/Reportes.jsx`
- jsPDF-autotable 5.0.2 - PDF table formatting
- XLSX 0.18.5 - Excel import/export in `backend/src/services/**` and `frontend/src/**`

**Email:**
- @getbrevo/brevo 1.0.0 - Brevo transactional email API in `backend/src/services/emailService.js`
- Nodemailer 7.0.10 - SMTP email fallback (legacy support)

**Utilities:**
- React Icons 4.10.1 - Icon library for frontend components
- Dotenv 17.2.3 - Environment variable loading in `backend/src/config/config.js`

## Configuration

**Environment:**
- Backend: Loads from `.env` (development) or Railway-injected `process.env` (production) via `backend/src/config/config.js`
- Frontend: Vite env variables via `VITE_API_URL` in `frontend/vite.config.mjs`
- Docker: Compose file at `docker-compose.yml` defines all service environment variables
- Railway: `railway.json` specifies build and deployment configuration

**Build:**
- Backend: ESLint configuration in `backend/eslint.config.js` (flat config v9)
- Frontend: ESLint configuration in `frontend/eslint.config.js` with React plugin
- Backend: Jest configuration in `backend/jest.config.js` (coverage thresholds: 79% statements, 69% branches, 88% functions)
- Frontend: Vitest configuration in `frontend/vite.config.mjs` (jsdom environment)
- Prettier: Configuration in `.prettierrc` or eslint-config-prettier integration

## Platform Requirements

**Development:**
- Node.js 20 or higher
- MySQL 8.0 or compatible (for local testing)
- npm 10+ (workspace support)
- Optional: Docker & Docker Compose for containerized development

**Production:**
- Railway.app - Primary deployment platform
- Environment: Containerized via `Dockerfile` using Node.js 20 Alpine + Nginx
- Database: Railway-hosted MySQL or compatible
- Port: Dynamically assigned by Railway (default 80 for Nginx)
- SSL: Required for Railway deployments (auto-configured by platform)

## Key Networking

**Frontend Dev Proxy:**
- `/api/*` → `http://localhost:3000` (backend API)
- `/uploads/*` → `http://localhost:3000` (uploaded assets)
- `/socket.io/*` → `http://localhost:3000` with WebSocket enabled

**Production Routing:**
- Nginx reverse proxy in single container
- Frontend served as static assets from `/usr/share/nginx/html`
- Backend API at port 3000 within container, proxied by Nginx

---

*Stack analysis: 2026-08-27*
