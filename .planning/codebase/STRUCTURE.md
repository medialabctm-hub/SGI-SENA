<!-- refreshed: 2026-08-27 -->
# Codebase Structure

**Analysis Date:** 2026-08-27

## Directory Layout

```
project-root/
├── backend/                              # Node.js + Express backend
│   ├── server.js                        # Express app, middleware, route mounting, startup
│   ├── package.json                     # Backend dependencies, scripts
│   ├── src/
│   │   ├── app.js                       # Placeholder (main logic in server.js)
│   │   ├── config/                      # Configuration & constants
│   │   │   ├── config.js               # Environment-based settings (server, db, cors)
│   │   │   ├── dbconfig.js             # MySQL connection pool setup & db wrapper
│   │   │   ├── documentTypes.js        # Enum: TIPOS_DOCUMENTO (TI, CC, CE, PPT, Otro)
│   │   │   └── permissions.js          # Role-based permissions config
│   │   ├── controller/                  # HTTP request handlers (orchestration layer)
│   │   │   ├── authController.js       # Register, login, password recovery
│   │   │   ├── equiposController.js    # Equipment CRUD, filtering, assignment
│   │   │   ├── ambientesController.js  # Environment CRUD
│   │   │   ├── clasesController.js     # Class scheduling, status transitions
│   │   │   ├── aprendicesController.js # Apprentice CRUD
│   │   │   ├── notificationsController.js
│   │   │   ├── reportesController.js
│   │   │   ├── mantenimientoController.js
│   │   │   ├── estadisticasController.js
│   │   │   └── [other entity controllers]
│   │   ├── routes/                      # Express route definitions
│   │   │   ├── authRoutes.js           # POST /api/auth/register, /login, /recuperar-contrasena, etc.
│   │   │   ├── equiposRoutes.js        # GET/POST/PUT /api/equipos*, equipment management
│   │   │   ├── ambientesRoutes.js      # Environment routes
│   │   │   ├── clasesRoutes.js         # Class management
│   │   │   ├── aprendicesRoutes.js     # Apprentice management (public & protected)
│   │   │   ├── notificationsRoutes.js
│   │   │   ├── reportesRoutes.js
│   │   │   └── [other route files]
│   │   ├── services/                    # Business logic layer
│   │   │   ├── authService.js          # User registration, login, password recovery
│   │   │   ├── equipoService.js        # Equipment operations (list, filter, assign)
│   │   │   ├── ambientesService.js     # Environment operations
│   │   │   ├── emailService.js         # Email sending via Brevo SMTP
│   │   │   ├── JwtService.js           # JWT token generation & verification
│   │   │   ├── PasswordService.js      # Bcrypt password hashing
│   │   │   ├── socketService.js        # Socket.io server initialization
│   │   │   ├── schedulerService.js     # Class automation (start/end/notifications)
│   │   │   ├── notificationService.js  # Emit Socket.io events, send emails
│   │   │   └── preferencesService.js   # User preferences (UI settings)
│   │   ├── repositories/                # Data access abstraction layer
│   │   │   ├── BaseRepository.js       # Abstract base with execute(), findOne(), transaction()
│   │   │   ├── UserRepository.js       # User queries (SELECT, INSERT, UPDATE, DELETE)
│   │   │   ├── RoleRepository.js       # Role queries
│   │   │   ├── EquipoRepository.js     # Equipment queries
│   │   │   ├── AmbienteRepository.js   # Environment queries
│   │   │   └── InvitationCodeRepository.js
│   │   ├── middleware/                  # Express middleware
│   │   │   ├── authMiddleware.js       # JWT verification, attach user to request
│   │   │   ├── authorization.js        # Role/permission checks (requirePermission, requireAdminForRoleChange)
│   │   │   ├── rateLimiter.js          # Express-rate-limit (authLimiter, registerLimiter)
│   │   │   ├── uploadMiddleware.js     # Multer for equipment images, serve handler
│   │   │   ├── uploadProfileMiddleware.js  # Multer for profile photos
│   │   │   ├── uploadAmbienteMiddleware.js # Multer for environment images
│   │   │   ├── fileValidation.js       # File type/size validation
│   │   │   ├── corsPublicMiddleware.js # CORS for public endpoints
│   │   │   ├── validate.js             # Zod schema validation wrapper
│   │   │   └── parseFormData.js        # FormData parsing
│   │   ├── validators/                  # Zod schema definitions
│   │   │   ├── authValidator.js        # registerSchema, loginSchema, updateUserSchema
│   │   │   ├── equiposValidator.js
│   │   │   ├── clasesValidator.js
│   │   │   ├── mantenimientoValidator.js
│   │   │   └── [other entity validators]
│   │   ├── di/                          # Dependency Injection
│   │   │   ├── Container.js            # Service registry & resolver (register, resolve)
│   │   │   └── setup.js                # Bootstrap: register db, repos, services as singletons
│   │   ├── factories/                   # Factory pattern for service creation
│   │   │   └── ServiceFactory.js       # ServiceFactory.create('authService') → container.resolve()
│   │   ├── builders/                    # Builder pattern for complex objects
│   │   │   └── UserBuilder.js          # Construct user objects with defaults
│   │   ├── strategies/                  # Strategy pattern for pluggable logic
│   │   │   └── ValidationStrategy.js   # EmailValidationStrategy, PasswordValidationStrategy, CedulaValidationStrategy
│   │   ├── facades/                     # Facade pattern (simplified interface over complex subsystems)
│   │   │   └── AuthFacade.js           # Public facade for auth operations
│   │   ├── observers/                   # Observer pattern for event handling
│   │   │   └── (example: class status change listener)
│   │   └── utils/                       # Shared utilities
│   │       ├── errors.js               # Custom error classes (AppError, ValidationError, AuthenticationError, etc.)
│   │       ├── logger.js               # Centralized logging (Winston or custom)
│   │       ├── sqlQueries.js           # Reusable SQL query building & utilities
│   │       ├── equipmentClaim.js       # Equipment locking mechanism (concurrency control)
│   │       ├── autoservicioHealth.js   # Health check status builder
│   │       ├── controllerHelpers.js    # Response formatting helpers
│   │       ├── translations.js         # Message translations
│   │       ├── timezone.js             # Timezone conversions
│   │       └── aprendices.js           # Apprentice utility functions
│   ├── tests/                           # Jest test suite
│   │   ├── builders/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── di/
│   │   ├── facades/
│   │   ├── factories/
│   │   ├── integration/
│   │   ├── middleware/
│   │   ├── observers/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── strategies/
│   │   ├── utils/
│   │   ├── validators/
│   │   └── server/
│   ├── uploads/                         # Static file storage (served via authenticated endpoints)
│   │   ├── equipos/                    # Equipment images (NOT publicly accessible)
│   │   ├── ambientes/                  # Environment images (publicly accessible via static middleware)
│   │   └── perfiles/                   # Profile photos (publicly accessible via static middleware)
│   ├── scripts/                         # Utility scripts
│   │   ├── check-env.js                # Verify required environment variables
│   │   ├── smoke-test.js               # Basic connectivity tests
│   │   ├── run-mysql-integration.js    # Run MySQL-based integration tests
│   │   └── print-coverage.mjs          # Format coverage report
│   ├── examples/                        # Example files, usage patterns
│   └── BD/                              # Database migrations & schema
│       └── (SQL schema files)
│
├── frontend/                            # React + Vite frontend
│   ├── package.json                     # Frontend dependencies, scripts
│   ├── vite.config.js                  # Vite build config (API proxy setup)
│   ├── vitest.config.js                # Vitest test configuration
│   ├── playwright.config.js            # Playwright E2E config
│   ├── public/                          # Static assets (served as-is)
│   │   └── images/                     # Favicon, logos, etc.
│   ├── src/
│   │   ├── main.jsx                    # Entry point (render App, init providers)
│   │   ├── App.jsx                     # Route definitions via React Router
│   │   ├── pages/                       # Route-specific page components
│   │   │   ├── Login.jsx               # User login form
│   │   │   ├── Register.jsx            # User registration form
│   │   │   ├── Dashboard.jsx           # Main dashboard with statistics
│   │   │   ├── Equipos.jsx             # Equipment list & filter
│   │   │   ├── ConsultarEquipo.jsx     # Equipment detail view
│   │   │   ├── AsignarEquipo.jsx       # Assign equipment to apprentice
│   │   │   ├── MisEquipos.jsx          # My equipment (role-specific)
│   │   │   ├── Usuarios.jsx            # User management (admin only)
│   │   │   ├── Aprendices.jsx          # Apprentice management
│   │   │   ├── Ambientes.jsx           # Environment list
│   │   │   ├── DetalleAmbiente.jsx     # Environment detail
│   │   │   ├── Horarios.jsx            # Class schedule/timetable
│   │   │   ├── Mantenimientos.jsx      # Maintenance records
│   │   │   ├── Novedades.jsx           # Equipment incidents
│   │   │   ├── CrearNovedad.jsx        # Report incident
│   │   │   ├── Reportes.jsx            # Generate reports
│   │   │   ├── Config.jsx              # Administration panel
│   │   │   ├── Perfil.jsx              # User profile & password change
│   │   │   ├── OlvidarContrasena.jsx   # Password recovery request
│   │   │   ├── RestablecerContrasena.jsx  # Password reset with token
│   │   │   ├── AutorizacionesMovimiento.jsx  # Approve equipment loans
│   │   │   ├── EquiposPrestados.jsx    # View loaned equipment
│   │   │   ├── HistorialVerificaciones.jsx  # Inventory verification logs
│   │   │   ├── HistorialMovimientos.jsx # Equipment movement history
│   │   │   ├── VerificarInventario.jsx # Inventory audit
│   │   │   ├── SolicitarEquipo.jsx     # Public equipment request (autoservicio)
│   │   │   ├── TerminosCondiciones.jsx # Terms & conditions
│   │   │   ├── BuscarCuentadante.jsx   # Find accounting personnel
│   │   │   ├── PaginaNoEncontrada.jsx  # 404 page
│   │   │   ├── LoadingDemo.jsx         # Loading screen component
│   │   │   └── config/                 # Configuration sub-pages
│   │   │       ├── UsersManagement.jsx
│   │   │       ├── InvitationCodes.jsx
│   │   │       ├── Security.jsx
│   │   │       ├── Notifications.jsx
│   │   │       ├── RolesAreas.jsx
│   │   │       └── TiposEquipo.jsx
│   │   ├── components/                  # Reusable UI components
│   │   │   ├── AppLayout.jsx           # Main app shell (header + sidebar + content)
│   │   │   ├── Header.jsx              # Top navigation bar
│   │   │   ├── Sidebar.jsx             # Left sidebar navigation
│   │   │   ├── Card.jsx                # Generic card container
│   │   │   ├── Toast.jsx               # Notifications/alerts
│   │   │   ├── ConfirmModal.jsx        # Yes/No confirmation dialog
│   │   │   ├── DestructiveConfirmModal.jsx  # Delete confirmation with styling
│   │   │   ├── InfoModal.jsx           # Read-only info dialog
│   │   │   ├── BloqueoModal.jsx        # Lock/block status modal
│   │   │   ├── ProtectedRoute.jsx      # Route guard wrapper (requires auth)
│   │   │   ├── RedirectIfAuth.jsx      # Redirect authenticated users away from login
│   │   │   ├── ErrorBoundary.jsx       # React error boundary
│   │   │   ├── NavigationBlocker.jsx   # Warn user before navigation with unsaved changes
│   │   │   ├── CustomSelect.jsx        # Dropdown/select component
│   │   │   ├── AutocompleteInput.jsx   # Autocomplete/searchable input
│   │   │   ├── ImageViewer.jsx         # Display/zoom images
│   │   │   ├── ClassNotificationModal.jsx  # Real-time class notifications
│   │   │   ├── NotificationsModal.jsx  # Notification center
│   │   │   ├── ImportarEquipos.jsx     # Bulk equipment import form
│   │   │   ├── ImportarUsuarios.jsx    # Bulk user import form
│   │   │   ├── ImportarAprendices.jsx  # Bulk apprentice import form
│   │   │   ├── RevisarDuplicados.jsx   # Duplicate detection/merge UI
│   │   │   ├── AnimatedBackground.jsx  # Visual effect
│   │   │   ├── InteractiveBackground.jsx  # Visual effect
│   │   │   ├── HashRouteWrapper.jsx    # URL hash-based routing helper
│   │   │   └── Header.test.jsx         # Component tests
│   │   ├── hooks/                       # Custom React hooks
│   │   │   ├── useForm.js              # Form state management (field values, errors)
│   │   │   ├── useLocalStorage.js      # Persistent state via localStorage
│   │   │   ├── useBlockedNavigate.js   # Warn on navigation with unsaved changes
│   │   │   ├── useAuthenticatedEvidenceImages.js  # Fetch equipment photos with auth
│   │   │   └── [test files]
│   │   ├── contexts/                    # React Context providers
│   │   │   └── SocketContext.jsx       # WebSocket connection provider & useSocket() hook
│   │   ├── config/                      # Configuration
│   │   │   └── api.js                  # API base URL, apiFetch() helper with auth header injection
│   │   ├── utils/                       # Shared utilities
│   │   │   ├── api.js                  # ApiError class, parseApiResponse(), buildErrorMessage(), handleError()
│   │   │   └── (other utility modules)
│   │   ├── styles/                      # CSS stylesheets
│   │   │   ├── layout/
│   │   │   │   ├── dashboard.css
│   │   │   │   └── (component styles)
│   │   │   └── (other stylesheets)
│   │   └── test/                        # Test setup & utilities
│   │       └── setup.js                # Vitest setup (DOM matchers, mocks)
│   └── nginx-server.conf;C             # Nginx config for production deployment (incomplete path)
│
├── .planning/                           # GSD planning documents
│   ├── codebase/                       # Architecture & structure analysis
│   │   ├── ARCHITECTURE.md             # System patterns, layers, data flow
│   │   ├── STRUCTURE.md                # Directory layout, file purposes (this file)
│   │   ├── CONVENTIONS.md              # Coding standards & patterns
│   │   ├── TESTING.md                  # Test organization & patterns
│   │   ├── STACK.md                    # Tech stack & dependencies
│   │   ├── INTEGRATIONS.md             # External APIs & services
│   │   └── CONCERNS.md                 # Technical debt & issues
│   └── debug/                          # Debugging & issue resolution logs
│
├── docs/                                # Manual documentation
│   └── superpowers/
│       └── plans/                      # Phase execution plans
│
├── Documentation/                       # Legacy documentation (rarely updated)
│
├── BD/                                  # Database schema & migrations
│
├── .git/                                # Version control
├── .gitignore                           # Git exclusions
├── docker-compose.yml                  # Docker Compose for local dev (MySQL, etc.)
├── Dockerfile                           # Container build for backend
├── package.json                         # Monorepo root (if any shared scripts)
├── railway.json                         # Railway.app deployment config
└── playwright.config.js                # E2E testing config
```

## Directory Purposes

**`backend/src/`:**
- Purpose: All backend Node.js source code
- Contains: Express app, DI, controllers, services, repos, middleware, validators
- Key files: `server.js` (entry point), `config/dbconfig.js` (DB connection), `di/setup.js` (dependency bootstrap)

**`backend/src/controller/`:**
- Purpose: HTTP request handlers; parse input, call services, return JSON responses
- Contains: One file per entity (authController, equiposController, etc.)
- Key pattern: Delegate all logic to services; controllers only orchestrate

**`backend/src/services/`:**
- Purpose: Business logic, data validation, multi-step operations
- Contains: One service per domain concept (AuthService, EquipoService, etc.)
- Key pattern: Injected repositories, never direct DB access

**`backend/src/repositories/`:**
- Purpose: Abstract database access
- Contains: SQL queries, transaction management, result mapping
- Key pattern: Services depend on repos; repos depend on db pool only

**`backend/src/middleware/`:**
- Purpose: Express middleware (guards, transformers, error handlers)
- Contains: Auth verification, rate limiting, file upload, validation, error handling
- Key files: `authMiddleware.js` (JWT verification), `authorization.js` (role checks), `rateLimiter.js` (per-endpoint rate limits)

**`backend/src/validators/`:**
- Purpose: Input validation schemas using Zod
- Contains: One file per entity; exported schemas used by route-level `validate()` middleware
- Key pattern: All routes apply validation before passing to controller

**`backend/src/config/`:**
- Purpose: Configuration & constants (environment-specific, never secrets)
- Contains: Server settings, database config, enums, permissions matrix
- Key files: `dbconfig.js` (pooled connection), `permissions.js` (role capabilities)

**`backend/src/di/`:**
- Purpose: Dependency Injection container setup
- Contains: DI Container class, setup script registering all singletons
- Key pattern: Services resolved via ServiceFactory; no hardcoded `new` operators

**`frontend/src/pages/`:**
- Purpose: Route-specific page components; data fetching, form handling
- Contains: One file per route (Login, Dashboard, Equipos, etc.)
- Key pattern: Pages compose reusable components; use hooks for state

**`frontend/src/components/`:**
- Purpose: Reusable UI elements (modals, forms, headers, footers)
- Contains: Stateless or lightly-stateful components; no page-specific logic
- Key pattern: Accept data/callbacks as props; use hooks if needed

**`frontend/src/hooks/`:**
- Purpose: Extract stateful logic into reusable functions
- Contains: useForm (field state + errors), useLocalStorage (persist state), useSocket (subscribe to events)
- Key pattern: React hooks library; composable, shareable

**`frontend/src/contexts/`:**
- Purpose: Global state providers (Socket.io connection, auth events)
- Contains: Context + Provider component + custom hook to access context
- Key pattern: Wrap App with provider; consume via useSocket()

**`frontend/src/utils/`:**
- Purpose: Shared utilities (API helpers, error formatting, translations)
- Contains: `api.js` (ApiError, parseApiResponse, buildErrorMessage), other helpers
- Key pattern: Pure functions; no React hooks; safe to import anywhere

**`backend/uploads/`:**
- Purpose: Persistent file storage for user uploads
- Contains: Equipment images (`equipos/`), environment images (`ambientes/`), profile photos (`perfiles/`)
- Key pattern: Equipment photos (equipos/) are NOT publicly accessible; served only via authenticated endpoint. Ambiente & profile images are publicly accessible via static middleware.

**`backend/tests/`:**
- Purpose: Jest test suite (unit + integration)
- Contains: Mirrored directory structure matching src/; one test file per source file
- Key pattern: Test each layer independently (mocked dependencies)

**`frontend/src/test/`:**
- Purpose: Vitest test setup & utilities
- Contains: setup.js (DOM/matchers), test configuration
- Key pattern: Components tested with React Testing Library; hooks tested with @testing-library/react

## Key File Locations

**Entry Points:**
- Backend server: `D:/sgi/SGI-SENA/backend/server.js`
- Frontend app: `D:/sgi/SGI-SENA/frontend/src/main.jsx`
- Routes: `D:/sgi/SGI-SENA/backend/src/routes/*.js` (mounted in server.js)

**Configuration:**
- Backend: `D:/sgi/SGI-SENA/backend/src/config/config.js` (env-based), `D:/sgi/SGI-SENA/backend/src/config/dbconfig.js` (MySQL pool)
- Frontend: `D:/sgi/SGI-SENA/frontend/src/config/api.js` (API base URL, apiFetch helper)

**Core Logic:**
- Auth: `D:/sgi/SGI-SENA/backend/src/services/authService.js` (registration, login, password recovery)
- Equipment: `D:/sgi/SGI-SENA/backend/src/services/equipoService.js` (equipment operations), `D:/sgi/SGI-SENA/backend/src/controller/equiposController.js` (HTTP handlers)
- Database: `D:/sgi/SGI-SENA/backend/src/repositories/UserRepository.js`, `D:/sgi/SGI-SENA/backend/src/repositories/EquipoRepository.js`
- DI: `D:/sgi/SGI-SENA/backend/src/di/setup.js` (service registration), `D:/sgi/SGI-SENA/backend/src/di/Container.js` (resolver)

**Testing:**
- Backend tests: `D:/sgi/SGI-SENA/backend/tests/` (mirrored structure)
- Frontend tests: `D:/sgi/SGI-SENA/frontend/src/components/*.test.jsx`, `D:/sgi/SGI-SENA/frontend/src/hooks/*.test.js`

## Naming Conventions

**Files:**
- Controllers: `[Entity]Controller.js` (e.g., `authController.js`, `equiposController.js`)
- Services: `[Entity]Service.js` or `[Entity]Service.js` (e.g., `authService.js`, `EquipoService.js`)
- Repositories: `[Entity]Repository.js` (e.g., `UserRepository.js`, `EquipoRepository.js`)
- Routes: `[Entity]Routes.js` (e.g., `authRoutes.js`, `equiposRoutes.js`)
- Validators: `[Entity]Validator.js` (e.g., `authValidator.js`, `equiposValidator.js`)
- Middleware: `[purpose]Middleware.js` or `[purpose].js` (e.g., `authMiddleware.js`, `rateLimiter.js`)
- Frontend Pages: PascalCase, `[EntityOrFunction].jsx` (e.g., `Login.jsx`, `Dashboard.jsx`, `MisEquipos.jsx`)
- Frontend Components: PascalCase, `[ComponentName].jsx` (e.g., `Header.jsx`, `ProtectedRoute.jsx`, `Toast.jsx`)
- Hooks: camelCase, `use[HookName].js` (e.g., `useForm.js`, `useLocalStorage.js`)

**Directories:**
- Plural entity names: `controllers/`, `services/`, `repositories/`, `routes/`, `validators/`
- Feature directories (no plural): `config/`, `middleware/`, `utils/`, `di/`, `strategies/`, `builders/`, `facades/`
- Frontend: `pages/`, `components/`, `hooks/`, `contexts/`, `utils/`, `config/`, `styles/`, `test/`

## Where to Add New Code

**New Feature (e.g., Equipment Maintenance):**
1. Create database schema/migration in `backend/BD/` (if not already present)
2. Controller: `backend/src/controller/mantenimientoController.js`
3. Routes: Add to `backend/src/routes/mantenimientoRoutes.js` or create new file
4. Service: `backend/src/services/mantenimientoService.js`
5. Repository: `backend/src/repositories/MantenimientoRepository.js` (if new entity)
6. Validators: `backend/src/validators/mantenimientoValidator.js`
7. Middleware: Add to `backend/src/middleware/` if special handling needed
8. Tests: Mirror structure in `backend/tests/`
9. Frontend Pages: `frontend/src/pages/Mantenimientos.jsx`
10. Frontend Components: Reusable components in `frontend/src/components/`
11. Register service in `backend/src/di/setup.js`

**New Component/Module (Reusable):**
- Backend service: Add to `backend/src/services/[name].js`; register in `backend/src/di/setup.js`
- Frontend component: `frontend/src/components/[ComponentName].jsx`; use from pages/other components via imports

**Utilities & Helpers:**
- Backend: `backend/src/utils/[purpose].js` (e.g., `sqlQueries.js`, `logger.js`)
- Frontend: `frontend/src/utils/[purpose].js` (e.g., `api.js`, translations)

**Hooks:**
- Always in `frontend/src/hooks/[hookName].js`
- Export single default or named export matching file name
- Include tests alongside: `frontend/src/hooks/[hookName].test.js`

**Contexts:**
- Always in `frontend/src/contexts/[ContextName].jsx`
- Export both Context and Provider and custom hook (e.g., useSocket)

**Styled Components & CSS:**
- Keep per-feature: `frontend/src/styles/[feature].css` (e.g., `dashboard.css`, `forms.css`)
- Or co-locate with component (if small)

## Special Directories

**`backend/uploads/`:**
- Purpose: Persistent file storage for user-uploaded files
- Generated: Yes (created at runtime when files uploaded)
- Committed: No (gitignored; only structure managed in git)
- Note: Subdirectories (equipos/, ambientes/, perfiles/) must exist before file uploads
- Access control: ambientes/ and perfiles/ are publicly accessible via static middleware; equipos/ is served only via authenticated endpoint

**`backend/tests/`:**
- Purpose: Jest test suite
- Generated: No (source code)
- Committed: Yes (tests are versioned)

**`frontend/src/test/`:**
- Purpose: Vitest setup files
- Generated: No (source code)
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: Architecture & structure documentation (generated by gsd-map-codebase)
- Generated: Yes (overwritten on each run)
- Committed: Yes (versioned for team reference)

**`BD/`:**
- Purpose: Database schema and migrations
- Generated: No (source code)
- Committed: Yes

---

*Structure analysis: 2026-08-27*
