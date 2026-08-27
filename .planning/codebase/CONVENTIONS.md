# Coding Conventions

**Analysis Date:** 2026-08-27

## Naming Patterns

**Files:**
- Backend: camelCase for services, repositories, controllers (e.g., `authService.js`, `equipoRepository.js`, `equiposController.js`)
- Frontend: PascalCase for components (e.g., `Header.jsx`, `Toast.jsx`, `ProtectedRoute.jsx`), camelCase for utilities (e.g., `useForm.js`, `api.js`)
- Tests: matching module name with `.test.js` or `.test.jsx` suffix (e.g., `authService.test.js`, `Header.test.jsx`)

**Functions:**
- camelCase for all function names
- Descriptive verb-first naming: `getUserById`, `validateUserData`, `handleChange`, `resetForm`, `listarEquipos`
- Private functions often prefixed with underscore (optional): `_validateCredentials`
- React hook functions use `use` prefix: `useForm`, `useLocalStorage`, `useAuthenticatedEvidenceImages`

**Variables:**
- camelCase for local variables and constants (e.g., `userData`, `mockUserRepository`, `formData`)
- snake_case for database column names/field names from API responses (e.g., `nombre_usuario`, `id_usuario`, `cedula`, `correo`)
- Unused parameters/variables prefix with underscore: `_next`, `_meta` (allowed by ESLint config)

**Types:**
- PascalCase for class names: `AuthService`, `EquipoRepository`, `ValidationError`, `UserBuilder`
- PascalCase for error classes: `ValidationError`, `AuthenticationError`, `NotFoundError`, `ConflictError`
- camelCase for interface/schema objects: `mockUserRepository`, `baseUser`, `validAprendizData`

## Code Style

**Formatting:**
- Tool: Prettier
- Config file: `.prettierrc.json` (identical in backend and frontend)
- Key settings:
  - `semi: true` - Always add semicolons
  - `singleQuote: true` - Use single quotes
  - `printWidth: 80` - Line length limit
  - `tabWidth: 2` - 2-space indentation
  - `trailingComma: "es5"` - Trailing commas where valid in ES5
  - `arrowParens: "avoid"` - Omit parens for single arrow function params
  - `endOfLine: "lf"` - Unix line endings

**Linting:**
- Tool: ESLint with Flat Config
- Backend: `eslint.config.js` extends airbnb-base with custom rules
- Frontend: `eslint.config.js` extends ESLint recommended with React/React Hooks plugins

**Backend ESLint Rules (Custom):**
- `no-unused-vars: warn` - Allow leading underscore for intentionally unused parameters
- `prefer-const: warn` - Style quality, not blocking
- `no-console: ['warn', { allow: ['warn', 'error'] }]` - Allow console.warn and console.error only
- `import/extensions: ['error', ...]` - Require `.js` extensions for ES modules (enforced)
- `camelcase: ['error', { ignoreDestructuring: true, properties: 'never }]` - Allow snake_case for DB fields
- `no-param-reassign: ['error', { props: false }]` - Allow property mutation on params (Express middleware pattern)
- Most style issues are warnings to allow build in CI while catching real bugs as errors

**Frontend ESLint Rules (Custom):**
- `react/prop-types: off` - No prop-types validation
- `react/react-in-jsx-scope: off` - React 17+ doesn't require React import
- `react-hooks/rules-of-hooks: error` - Enforce hook rules (blocking)
- `react-hooks/exhaustive-deps: warn` - Warn on missing dependencies
- `react/jsx-filename-extension: ['error', { extensions: ['.js', '.jsx'] }]` - Allow both `.js` and `.jsx`

## Import Organization

**Order:**
1. External modules (Node.js builtins, npm packages): `import express from 'express'`, `import { z } from 'zod'`
2. Internal utilities and helpers: `import { logger } from '../utils/logger.js'`, `import { ValidationError } from '../utils/errors.js'`
3. Relative imports (services, repositories, models): `import { AuthService } from '../services/authService.js'`
4. Side effects (last if any): `import './styles.css'`

**Path Aliases:**
- Not configured; relative paths used throughout
- Backend uses `../` navigation consistently (e.g., `import { userRepository } from '../../repositories/userRepository.js'`)
- Frontend uses same relative path pattern

**Module Extensions:**
- Backend: `.js` extensions **required** in all imports (ESLint enforced)
- Frontend: `.js` and `.jsx` extensions optional in JSX imports (Vite handles resolution)

## Error Handling

**Patterns:**
- Custom error hierarchy defined in `backend/src/utils/errors.js`:
  - `AppError` - Base class with `statusCode` and `isOperational` flags
  - `ValidationError` (400) - Input validation failures
  - `AuthenticationError` (401) - Auth/token issues
  - `AuthorizationError` (403) - Permission denied
  - `NotFoundError` (404) - Resource not found
  - `ConflictError` (409) - Constraint violations, state conflicts
  - `DatabaseError` (500) - DB operation failures

- Controller error handling via `handleControllerError()` wrapper in `backend/src/utils/controllerHelpers.js`
- Database errors automatically translated via `translateDbError()` to user-friendly messages in Spanish
- Global error middleware `errorHandler` in `backend/src/utils/errors.js` catches all errors and returns JSON response with:
  - `success: false`
  - `error: string` (technical error message)
  - `userMessage: string` (only if operational error)
  - `details: array` (validation details if present)
  - `stack: string` (only in development)

**Frontend Error Handling:**
- `ApiError` class in `frontend/src/utils/api.js` wraps fetch responses
- Priority message parsing: `userMessage` > `message` > first `details[0].message` > generic `error`
- `buildErrorMessage()` utility extracts user-safe text without SQL/technical noise
- Error boundaries in components via `ErrorBoundary` component

## Logging

**Framework:** Custom logger class in `backend/src/utils/logger.js`

**Levels (in order of verbosity):**
- `ERROR` - Fatal/operational failures
- `WARN` - Degraded behavior or deprecated patterns
- `INFO` - Notable events (default level)
- `DEBUG` - Detailed tracing

**Configuration:**
- `LOG_LEVEL` environment variable controls output (defaults to `INFO`)
- In tests: `LOG_LEVEL=error` suppresses noise
- Format: `[ISO_TIMESTAMP] [LEVEL] message JSON_METADATA`

**Patterns:**
- Log full error objects with context: `logger.error('Error message', { error: err.message, code: err.code })`
- Log at request entry/exit points for tracking
- Controller operations log failures: `logger.error('Error al listar equipos', { error: err.message })`
- Frontend uses browser console directly; no centralized logging

## Comments

**When to Comment:**
- JSDoc/TSDoc on public functions and classes (required for service layer)
- Inline comments explaining non-obvious logic (e.g., why a database workaround exists)
- Comments in test files explaining test scenarios (e.g., `// ─── Mock de repositorios ────`)
- Comments on complex validation rules (e.g., in Zod validators)

**JSDoc/TSDoc:**
```javascript
/**
 * AuthService - Servicio de autenticación refactorizado
 * 
 * Patrón: Service Layer
 * Principio: Dependency Inversion Principle (DIP), Single Responsibility Principle (SRP)
 * 
 * Contiene la lógica de negocio de autenticación, usando repositorios
 * y servicios inyectados en lugar de acceder directamente a la base de datos.
 */
export class AuthService {
  /**
   * Valida los datos del usuario usando estrategias de validación
   * @param {Object} userData - Datos del usuario a validar
   * @throws {ValidationError} Si la validación falla
   */
  validateUserData(userData) { }

  /**
   * Registra un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} Resultado del registro
   */
  async registerUser(userData) { }
}
```

## Function Design

**Size:** Keep functions focused and under 50 lines when possible
- Complex operations broken into smaller helpers
- Controllers delegate to service layer; services coordinate business logic
- Repositories handle data access only

**Parameters:**
- Prefer object parameter for multiple arguments: `function register({ nombre, cedula, correo, contrasena, rol })`
- Dependency injection in constructors (common in services, repositories)
- Destructure in function signature when beneficial

**Return Values:**
- Explicit return types in JSDoc comments
- Always return values consistently (avoid implicit `undefined` in some branches)
- Use `null` for "no data found"; throw errors for actual failures
- Async functions always return Promises

## Module Design

**Exports:**
- Both default and named exports used depending on context
- Services typically use named class exports: `export class AuthService { }`
- Utilities sometimes use default: `export default { ... }`
- Controllers use named exports for each route handler: `export async function listarEquipos(...) { }`

**Barrel Files:**
- Not heavily used; imports tend to be direct to source files
- Some utility files re-export: `export { validate } from '../middleware/validate.js'`

## Structural Patterns

**Dependency Injection:**
- Constructor injection pattern used in services and repositories
- Example: `constructor(userRepository, roleRepository, passwordService, jwtService, logger) { }`
- ServiceFactory in `backend/src/factories/ServiceFactory.js` creates instances with dependencies pre-wired

**Builder Pattern:**
- Used for complex object construction: `backend/src/builders/UserBuilder.js`
- Allows flexible, readable object creation

**Strategy Pattern:**
- Validation strategies in `backend/src/strategies/ValidationStrategy.js`
- Context class applies strategy: `this.emailValidator = new ValidationContext(new EmailValidationStrategy())`

**Repository Pattern:**
- Base class `BaseRepository` in `backend/src/repositories/BaseRepository.js`
- Concrete repositories extend and specialize (e.g., `EquipoRepository`, `UserRepository`)
- Single method for each data operation: `findByCodigo()`, `findAll()`, `create()`, etc.

---

*Convention analysis: 2026-08-27*
