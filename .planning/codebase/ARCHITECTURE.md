<!-- refreshed: 2026-08-27 -->
# Architecture

**Analysis Date:** 2026-08-27

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│  Pages | Components | Hooks | Contexts | Styles             │
│  `frontend/src/`                                            │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTP/WebSocket
                    │ JWT Bearer Token Auth
                    │ apiFetch() helper with auto-inject token
                    ▼
┌─────────────────────────────────────────────────────────────┐
│               HTTP/WebSocket - Express Server                │
│              `backend/server.js` (port 3000)                │
│  Middleware Layer                                           │
│  - Security: Helmet, CORS, XSS-clean, HPP, Rate-limit      │
│  - Auth: JWT middleware, Role/Permission gates              │
│  - Upload: Multer for equipment/environment images          │
│  - Validation: Zod schema validation                        │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│        Route Layer (Express Router + Controllers)           │
│  `backend/src/routes/*.js`                                 │
│  - authRoutes, equiposRoutes, ambientesRoutes, etc.        │
│  - Delegates to controllers without business logic         │
│  - Rate limiting, auth guards, input validation            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Controller Layer (Request Orchestration)                   │
│  `backend/src/controller/*.js`                              │
│  - Parse request data                                       │
│  - Call services via ServiceFactory                         │
│  - Format and send HTTP responses                           │
│  - Delegate error handling to middleware                    │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│     Service Layer (Business Logic & Orchestration)          │
│  `backend/src/services/*.js`                                │
│  - AuthService, EquipoService, AmbienteService, etc.       │
│  - Validates data using strategies                          │
│  - Coordinates repos and utils                              │
│  - Single Responsibility Principle enforced                 │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│   Repository Layer (Data Access Abstraction)                │
│  `backend/src/repositories/*.js` extends BaseRepository     │
│  - UserRepository, EquipoRepository, AmbienteRepository     │
│  - SQL query execution (mysql2 pool)                        │
│  - Transaction support                                      │
│  - Dependency Inversion: services never touch db directly   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│            MySQL Database (Railway-hosted)                  │
│  Connection pool via `backend/src/config/dbconfig.js`       │
│  Tables: Usuarios, Roles, Elementos, Ambientes, Clases, etc.│
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Server Bootstrap | Initialize Express, apply middleware, mount routes, error handler | `backend/server.js` |
| Routes | Define HTTP endpoints, request guards (auth/rate-limit), input validation | `backend/src/routes/*.js` |
| Controllers | Parse HTTP requests, call services, format responses | `backend/src/controller/*.js` |
| Services | Business logic, data validation, service coordination | `backend/src/services/*.js` |
| Repositories | Database queries via prepared statements, transaction support | `backend/src/repositories/*.js` |
| Validators | Schema-based input validation using Zod | `backend/src/validators/*.js` |
| Middleware | Authentication, authorization, rate limiting, file upload, error handling | `backend/src/middleware/*.js` |
| DI Container | Service registration and dependency resolution | `backend/src/di/Container.js` + `setup.js` |
| Frontend Pages | Route-specific UI, data fetching, form submission | `frontend/src/pages/*.jsx` |
| Components | Reusable UI elements (modals, forms, tables, notifications) | `frontend/src/components/*.jsx` |
| Hooks | Custom React logic extraction (forms, localStorage, WebSocket) | `frontend/src/hooks/*.js` |
| Contexts | Global state (Socket.io connection, auth events) | `frontend/src/contexts/*.jsx` |

## Pattern Overview

**Overall:** Layered Architecture with Dependency Injection

**Key Characteristics:**
- **Clear separation of concerns:** Each layer has one responsibility
- **Dependency Injection:** Services resolved via DI Container, never instantiated inline
- **Repository Pattern:** Data access abstracted; services depend on interfaces, not implementations
- **Error Handling:** Custom error classes with HTTP status codes; centralized error handler middleware
- **Validation:** Input validated at route/controller level using Zod schemas
- **Single Responsibility Principle (SRP):** Controllers only orchestrate; services contain business logic
- **Factory Pattern:** ServiceFactory resolves services from container
- **Strategy Pattern:** Validation strategies (EmailValidationStrategy, PasswordValidationStrategy, CedulaValidationStrategy) applied in AuthService

## Layers

**Route Layer:**
- Purpose: Expose HTTP endpoints, apply guards (authenticate, rate-limit), validate input
- Location: `backend/src/routes/*.js`
- Contains: Router configuration, endpoint definitions, middleware chain
- Depends on: Controllers, validators, middleware
- Used by: Express application server

**Controller Layer:**
- Purpose: Bridge between HTTP requests and business logic; orchestrate without implementing business logic
- Location: `backend/src/controller/*.js`
- Contains: Request parsing, service calls via ServiceFactory, response formatting
- Depends on: Services, error utilities, request helpers
- Used by: Route handlers

**Service Layer:**
- Purpose: Implement business logic, validate data, coordinate repositories and utilities
- Location: `backend/src/services/*.js`
- Contains: Business rule enforcement, data transformation, multi-step orchestration
- Depends on: Repositories, validation strategies, utilities
- Used by: Controllers

**Repository Layer:**
- Purpose: Abstract database access; provide a data-centric interface independent of SQL
- Location: `backend/src/repositories/*.js`
- Contains: SQL queries, transaction execution, result mapping
- Depends on: Database connection pool
- Used by: Services

**Data Layer:**
- Purpose: Persistent storage
- Location: MySQL database (Railway)
- Depends on: Schema migrations (not shown; stored in `backend/BD/`)

**Frontend - Pages Layer:**
- Purpose: Route-specific page layouts; fetch data, handle navigation
- Location: `frontend/src/pages/*.jsx`
- Contains: Page components, data fetching, form handlers
- Depends on: Components, hooks, API utilities, contexts
- Used by: React Router

**Frontend - Components Layer:**
- Purpose: Reusable UI elements with isolated concerns
- Location: `frontend/src/components/*.jsx`
- Contains: Modals, forms, tables, headers, navigation, notifications
- Depends on: Hooks, contexts, API utilities
- Used by: Pages, other components

**Frontend - Contexts Layer:**
- Purpose: Manage global state (Socket.io connection, real-time notifications)
- Location: `frontend/src/contexts/*.jsx`
- Contains: Context providers, connection lifecycle
- Depends on: Socket.io client
- Used by: Pages, components

**Frontend - Hooks Layer:**
- Purpose: Extract reusable stateful logic into shareable functions
- Location: `frontend/src/hooks/*.js`
- Contains: Form state (useForm), localStorage binding (useLocalStorage), WebSocket events (useSocket)
- Depends on: React hooks (useState, useEffect, useCallback)
- Used by: Pages, components

## Data Flow

### Primary Request Path: Login

1. User submits login form → `frontend/src/pages/Login.jsx` calls `apiFetch('/api/auth/login')`
2. Frontend sends POST with `cedula` and `contrasena`; token auto-injected in header if exists
3. Express receives request → `backend/src/routes/authRoutes.js` → validate with `loginSchema`
4. Route handler calls `loginUser()` controller (`backend/src/controller/authController.js`)
5. Controller calls `ServiceFactory.create('authService').loginUser(cedula, contrasena)`
6. Service (`backend/src/services/authService.js`) validates password, retrieves user via `userRepository`
7. Repository executes `SELECT * FROM Usuarios WHERE cedula = ?` via mysql2 pool
8. Service generates JWT token via `JwtService`, returns `{ success: true, user, token }`
9. Controller formats response, sends HTTP 200 with JSON
10. Frontend receives, stores token + user in localStorage, dispatches `auth:changed` event
11. Global auth state updates; SocketProvider reconnects with new token via `io({ auth: { token } })`

**State Management (Frontend):**
- Authentication state: `localStorage.getItem('token')` and `localStorage.getItem('user')`
- Global event: `window.dispatchEvent(new Event('auth:changed'))` triggers re-render across tabs
- Real-time updates: Socket.io emits events (e.g., `clasesUpdated`, `nuevoEquipo`); `SocketProvider` broadcasts via context
- Form validation: `useForm()` hook manages field state and error messages

### Equipment Assignment Flow

1. Instructor navigates to `frontend/src/pages/AsignarEquipo.jsx`
2. Page fetches available equipment: `apiFetch('/api/equipos?estado_operativo=Disponible')`
3. Controller `listarEquipos()` → Service `EquipoService.list()` → Repository queries DB filtered by user role
4. User selects equipment and apprentice, submits assignment form
5. Frontend POST to `/api/equipos/asignar` with `{ codigo_equipo, id_aprendiz, tipo_responsabilidad }`
6. Route handler applies `authenticate` middleware, calls `asignarEquipo()` controller
7. Controller calls service → Service validates availability, checks permission constraints
8. If valid, repository executes INSERT into `Responsables_Equipo` with transaction
9. On success, Socket.io broadcasts `equipoAsignado` event to all connected clients
10. Listeners in `ClassNotificationModal.jsx` and `MisEquipos.jsx` re-fetch data and update UI

### Error Handling Path

1. Any layer throws error (e.g., `NotFoundError('Equipo')`, `ValidationError('Email inválido')`)
2. Express error handler middleware (`errorHandler` in `backend/src/utils/errors.js`) catches it
3. Error is categorized by HTTP status (400, 401, 404, 500, etc.)
4. For database constraint violations, `translateDbError()` maps MySQL error to user-friendly message
5. Response sent with `{ success: false, error: message, userMessage: ... }`
6. Frontend `parseApiResponse()` extracts message, throws `ApiError(message, status, payload)`
7. Component catches error, `buildErrorMessage()` sanitizes technical details
8. `handleError()` displays Toast with user-friendly message (never shows SQL, stack traces, etc.)
9. If 401 and not login screen, `handleSessionExpiration()` clears token, redirects to login

## Key Abstractions

**Service Layer Abstraction:**
- Purpose: Hide business complexity behind a clean API
- Examples: `AuthService`, `EquipoService`, `AmbienteService` in `backend/src/services/`
- Pattern: Injected dependencies (repos, utils); methods public, implementation private

**Repository Pattern:**
- Purpose: Database queries don't leak into service logic
- Examples: `UserRepository`, `EquipoRepository` extend `BaseRepository` in `backend/src/repositories/`
- Pattern: Services call `repo.findById()`, not raw SQL

**Dependency Injection Container:**
- Purpose: Centralize service instantiation; decouple component creation from usage
- Examples: `ServiceFactory.create('authService')` resolves via `Container` in `backend/src/di/`
- Pattern: Register in setup.js, resolve in controllers/middleware

**Validation Strategies:**
- Purpose: Encapsulate validation rules; reuse across contexts
- Examples: `EmailValidationStrategy`, `PasswordValidationStrategy` in `backend/src/strategies/ValidationStrategy.js`
- Pattern: Strategy pattern; `ValidationContext` delegates to strategy

**Custom Error Classes:**
- Purpose: Return precise HTTP status codes and user-facing messages
- Examples: `AuthenticationError(401)`, `ValidationError(400)`, `NotFoundError(404)` in `backend/src/utils/errors.js`
- Pattern: Extend `AppError`; error handler reads `statusCode` and `details`

**Frontend Context + Provider:**
- Purpose: Provide WebSocket connection and socket events to entire component tree without prop drilling
- Examples: `SocketContext`, `SocketProvider` in `frontend/src/contexts/SocketContext.jsx`
- Pattern: React Context API; `useSocket()` hook extracts socket instance

## Entry Points

**Backend Server Startup:**
- Location: `backend/server.js`
- Triggers: `npm start` (production) or `npm run dev` (nodemon in development)
- Responsibilities: Load config, initialize DI container, mount middleware, mount routes, start HTTP/WebSocket listeners

**Frontend Application Bootstrap:**
- Location: `frontend/src/main.jsx`
- Triggers: `npm run dev` (Vite dev server) or `npm run build` (production build)
- Responsibilities: Render `<App>`, initialize React Router, mount global providers (ErrorBoundary, SocketProvider, NavigationBlocker)

**API Endpoints (Examples):**
- `POST /api/auth/login` → `backend/src/controller/authController.js:loginUser()`
- `GET /api/equipos` → `backend/src/controller/equiposController.js:listarEquipos()`
- `PUT /api/equipos/:id` → `backend/src/controller/equiposController.js:actualizarEquipo()`
- `GET /health` → Health check; used by Railway to verify deployment

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop; async/await for I/O operations (database, file uploads)
- **Global state:** DI Container (singleton), dbWrapper pool (singleton), services registered as singletons
- **Circular imports:** None detected; layers strictly ordered (routes → controllers → services → repositories → db)
- **Database connections:** Pooled via mysql2; 10 active connections by default (configurable)
- **Authentication:** JWT tokens stored in localStorage (frontend); Bearer token in Authorization header
- **Session**: Stateless; token verified on every request; no server-side session storage
- **Real-time updates:** Socket.io for class notifications and equipment status changes; reconnects with exponential backoff
- **File uploads:** Multer handles multipart/form-data; images stored locally in `/uploads/`; served via authenticated endpoint for equipment photos
- **CORS:** Configured in server.js; allows localhost (dev) and production domain (Railway)
- **Rate limiting:** Express-rate-limit on auth endpoints (register, login, password recovery); per IP
- **Environment isolation:** NODE_ENV switches between dev (morgan + helmet in debug mode), test (no scheduler), production (optimized logging)

## Anti-Patterns

### N+1 Query Problem in Equipment Listing

**What happens:** `listarEquipos()` fetches equipment list, then for each equipment, fetches associated images in a loop.

**Why it's wrong:** Database hit is O(n) instead of O(1); scales poorly with large inventories.

**Do this instead:** Refactor to use a single JOIN query or batch fetch. Example location: `backend/src/controller/equiposController.js:listarEquipos()` (lines 19–90); replace with a query that joins `Elementos` and `Imagenes_Equipo` in one call and group results.

### Inline SQL in Controllers

**What happens:** Some controllers execute raw `defaultDb.execute()` instead of delegating to repositories.

**Why it's wrong:** Violates separation of concerns; business logic leaks into HTTP layer; hard to test.

**Do this instead:** Extract to repository methods. Example: `backend/src/controller/equiposController.js` line 50 does inline queries; move to `EquipoRepository.findByCodigoOrName()`.

### Missing Input Validation at Route Level

**What happens:** Some routes do not apply validator middleware; controllers rely on implicit type coercion.

**Why it's wrong:** Garbage in, garbage out; invalid requests reach services.

**Do this instead:** All routes must apply `.use(validate(schema))` before handler. Check routes like `mantenimientoRoutes`, `novedadesRoutes` for missing validators.

### Async Error Handling Gaps

**What happens:** Async operations in route handlers that are not wrapped in try-catch; if they throw, the error handler doesn't catch them.

**Why it's wrong:** Unhandled promise rejections crash the server or leak details.

**Do this instead:** Wrap all async handlers or use an error-catching wrapper middleware. Example pattern in `authController.js`: all exports wrap logic in try-catch + `next(error)`.

## Error Handling

**Strategy:** Centralized error handler middleware

**Patterns:**
- Custom error classes inherit from `AppError` with `statusCode` and optional `details`
- Controllers throw errors; middleware catches and formats response
- Database constraint violations are translated to user-friendly messages via `translateDbError()`
- Validation errors return 400 with `details` array listing each field error
- Authentication/authorization errors return 401/403
- 500 errors logged but never expose stack trace to client
- Frontend `parseApiResponse()` intercepts and formats error messages safely (no SQL, no stack traces)

## Cross-Cutting Concerns

**Logging:** 
- Backend: Morgan for HTTP access logs + custom logger in `backend/src/utils/logger.js`
- Production: Only errors logged (via morgan's skip function); development: all requests logged
- Frontend: Console errors only in development; production uses `import.meta.env.DEV` guard

**Validation:** 
- Backend: Zod schemas in `backend/src/validators/` applied at route level
- Frontend: Form state validated by components before submission; server response validated by `parseApiResponse()`

**Authentication:** 
- Backend: JWT middleware in `backend/src/middleware/authMiddleware.js` verifies token and attaches user to request
- Authorization: Permission middleware in `backend/src/middleware/authorization.js` checks role-based access
- Frontend: Token stored in localStorage; auto-injected by `apiFetch()` helper; cleared on 401

---

*Architecture analysis: 2026-08-27*
