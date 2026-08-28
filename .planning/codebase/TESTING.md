# Testing Patterns

**Analysis Date:** 2026-08-27

## Test Framework

**Backend:**
- Runner: Jest 29.7.0
- Config: `backend/jest.config.js`
- Node VM for ES modules: `node --experimental-vm-modules`
- Test timeout: 10000ms

**Frontend:**
- Runner: Vitest 3.2.7
- Config: `frontend/vite.config.mjs` (test section)
- Environment: jsdom
- Globals enabled (no need for `describe`, `it` imports in some cases, though imports are explicit)

**Assertion Libraries:**
- Backend: Jest built-in assertions
- Frontend: `@testing-library/jest-dom` (6.9.1) + Jest/Vitest built-ins

**Run Commands:**

Backend:
```bash
npm test                    # Run all tests once
npm run test:watch         # Watch mode (re-run on file changes)
npm run test:coverage      # Run with coverage report
npm run test:smoke         # Run smoke tests only
npm run test:mysql         # Run MySQL integration tests
```

Frontend:
```bash
npm test                   # Run all tests once
npm run test:watch        # Watch mode
npm run format            # Auto-format code
```

Root (monorepo):
```bash
npm test                  # Run backend and frontend tests (excludes ambientesService)
npm run lint              # Lint both backend and frontend
npm run ci                # Full CI pipeline: lint, test, build
```

## Test File Organization

**Location:**
- Backend: `backend/tests/` mirrors `backend/src/` structure
- Frontend: Co-located with source files (same directory)

**Naming:**
- Backend: `*.test.js` (e.g., `authService.test.js`, `equipoRepository.test.js`)
- Frontend: `*.test.jsx` or `*.test.js` (e.g., `Header.test.jsx`, `useForm.test.js`)

**Structure:**
```
backend/
├── src/
│   ├── services/
│   │   ├── authService.js
│   │   └── equipoService.js
│   ├── repositories/
│   │   └── equipoRepository.js
│   └── ...
└── tests/
    ├── services/
    │   ├── authService.test.js
    │   ├── equipoService.test.js
    │   └── ...
    ├── repositories/
    │   └── equipoRepository.test.js
    ├── controllers/
    ├── middleware/
    ├── setup.js
    ├── setUpEnv.js
    └── ...

frontend/src/
├── components/
│   ├── Header.jsx
│   ├── Header.test.jsx        # Co-located
│   ├── Toast.jsx
│   ├── Toast.test.jsx         # Co-located
│   └── ...
├── hooks/
│   ├── useForm.js
│   ├── useForm.test.js        # Co-located
│   └── ...
├── utils/
│   ├── api.js
│   └── api.test.js            # Co-located
└── test/
    └── setup.js
```

## Test Structure

**Backend Pattern - Jest:**
```javascript
/**
 * Tests unitarios para AuthService
 *
 * Ejecutar con: npm test -- authService.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuthService } from '../../src/services/authService.js';
import { ValidationError, AuthenticationError } from '../../src/utils/errors.js';

// ─── Mocks de repositorios ────────────────────────────────────────────────────
const mockUserRepository = {
  findByCedula: jest.fn(),
  findByCedulaOrEmail: jest.fn(),
  create: jest.fn(),
  // ... other methods
};

const mockPasswordService = {
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
};

// ─── Datos reutilizables ─────────────────────────────────────────────────────
const baseUser = {
  id_usuario: 1,
  cedula: '1234567890',
  nombre_usuario: 'Test User',
  correo: 'test@example.com',
  // ... other fields
};

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPasswordService.hash.mockResolvedValue('hashed_password');
    authService = new AuthService(
      mockUserRepository,
      mockRoleRepository,
      mockPasswordService,
      mockJwtService,
      mockLogger
    );
  });

  it('should validate user data and throw ValidationError on invalid email', () => {
    expect(() => {
      authService.validateUserData({ correo: 'invalid', contrasena: 'pass123', cedula: '12345' });
    }).toThrow(ValidationError);
  });

  it('should register a new user with valid data', async () => {
    mockUserRepository.findByCedulaOrEmail.mockResolvedValue(null);
    mockRoleRepository.findByName.mockResolvedValue({ id_rol: 3, nombre_rol: 'Aprendiz' });

    const result = await authService.registerUser({
      nombre: 'Test User',
      cedula: '1234567890',
      correo: 'test@example.com',
      contrasena: 'pass123',
      rol: 'Aprendiz',
    });

    expect(result).toBeDefined();
    expect(mockUserRepository.create).toHaveBeenCalled();
  });
});
```

**Frontend Pattern - Vitest + React Testing Library:**
```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import Header from './Header';

// Mock modules
vi.mock('./NotificationsModal', () => ({ default: () => null }));

describe('Header', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('displays user initials from localStorage', () => {
    localStorage.setItem('user', JSON.stringify({ nombre_usuario: 'Ana Bermudez' }));
    
    render(<Header />);
    
    const perfilBtn = screen.getByRole('button', { name: 'perfil' });
    expect(perfilBtn).toHaveTextContent('AB');
  });

  it('clears user display on auth:changed event', () => {
    localStorage.setItem('user', JSON.stringify({ nombre_usuario: 'Ana Bermudez' }));
    render(<Header />);

    act(() => {
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:changed'));
    });

    const perfilBtn = screen.getByRole('button', { name: 'perfil' });
    expect(perfilBtn).toHaveTextContent('US');
  });
});

// Hook testing
describe('useForm', () => {
  it('initializes with provided values', () => {
    const { result } = renderHook(() => useForm({ nombre: '', email: '' }));
    expect(result.current.form).toEqual({ nombre: '', email: '' });
  });

  it('updates form state on handleChange', () => {
    const { result } = renderHook(() => useForm({ nombre: '' }));
    act(() => {
      result.current.handleChange({
        target: { name: 'nombre', value: 'Juan', type: 'text' },
      });
    });
    expect(result.current.form.nombre).toBe('Juan');
  });
});
```

## Mocking

**Framework:**
- Backend: Jest's `jest.fn()` for mocks
- Frontend: Vitest's `vi.fn()` and `vi.mock()` for mocks

**Backend Patterns:**

```javascript
// Mock a function
const mockUserRepository = {
  findByCedula: jest.fn(),
  create: jest.fn(),
};

// Set return values
mockUserRepository.findByCedula.mockResolvedValue({ id_usuario: 1, cedula: '123' });
mockUserRepository.create.mockResolvedValue({ id_usuario: 2, cedula: '456' });

// Mock with side effects
mockPasswordService.hash.mockImplementation((pwd) => Promise.resolve(`hashed_${pwd}`));

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
```

**Frontend Patterns:**

```javascript
// Mock entire modules
vi.mock('./NotificationsModal', () => ({
  default: () => null,
}));

// Mock global APIs
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ notifications: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
));

// Restore after test
afterEach(() => {
  vi.restoreAllMocks();
});
```

**What to Mock:**
- External services (repositories, API calls, payment processors)
- Database connections
- Authentication/authorization services
- Email/SMS providers
- Filesystem operations (for unit tests)

**What NOT to Mock:**
- Internal business logic (should test actual implementation)
- Error classes and validation logic (test the real behavior)
- Utils and helpers (test actual functions)
- React hooks (test actual hook behavior unless external API)

## Fixtures and Factories

**Test Data:**
```javascript
// Backend: Define reusable test data objects
const baseUser = {
  id_usuario: 1,
  cedula: '1234567890',
  contrasena: 'hashedPassword',
  nombre_usuario: 'Test User',
  correo: 'test@example.com',
  telefono: '3001234567',
  nombre_rol: 'Aprendiz',
  id_rol: 3,
  requiere_cambio_contrasena: false,
};

const validAprendizData = {
  nombre: 'Test User',
  cedula: '1234567890',
  tipo_documento: 'CC',
  correo: 'test@example.com',
  telefono: '3001234567',
  contrasena: 'pass123',
  rol: 'Aprendiz',
};
```

**Location:**
- Backend: Fixture data inline in test files (no separate factory files currently)
- Frontend: Data created inline in tests using object literals
- No centralized factory pattern currently in use

## Coverage

**Requirements:**
- Backend coverage thresholds enforced in `jest.config.js`:
  - Statements: 79%
  - Branches: 69%
  - Functions: 88%
  - Lines: 80%
- Frontend: No coverage thresholds enforced

**View Coverage:**
```bash
# Backend
npm run test:coverage

# Output formats: text, text-summary, lcov, html, json-summary
# HTML report: open coverage/index.html

# Frontend
npm test -- --coverage
```

**Coverage Config (Backend):**
- Source: `src/**/*.js`
- Exclude: `src/**/*.test.js`, `src/di/setup.js`
- Directory: `coverage/`
- Reporters: text, text-summary, lcov, html, json-summary

## Test Types

**Unit Tests:**
- Scope: Single function or class method
- Approach: Heavy mocking of dependencies
- Files: `*.test.js` in `tests/` directory (backend) or co-located (frontend)
- Backend example: `authService.test.js` tests `AuthService` methods with mocked repositories
- Frontend example: `useForm.test.js` tests hook state changes with `renderHook`

**Integration Tests:**
- Scope: Multiple components working together
- Approach: Real database (test DB), real service layer
- Files: `tests/integration/` directory (backend), `*.integration.test.js` suffix
- Backend examples: `backend/tests/integration/` folder
- Frontend example: `frontend/src/utils/loanRequest.integration.test.js`
- Often test full request/response cycles

**E2E Tests:**
- Framework: Playwright 1.58.2
- Config: Project root `package.json` defines `"test:e2e": "playwright test"`
- Location: E2E test files location not specified in codebase (to be defined)

## Setup and Teardown

**Global Setup (Backend):**

File: `backend/tests/setUpEnv.js` (runs as `setupFiles` before any tests)
```javascript
// Runs FIRST - before importing any modules
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test';
process.env.JWT_SECRET = 'test-secret-key';
// ... other env vars
```

File: `backend/tests/setup.js` (runs as `setupFilesAfterEnv` after test environment ready)
```javascript
import { jest } from '@jest/globals';
import { config } from '../src/config/config.js';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

afterEach(() => {
  jest.clearAllMocks();
});
```

**Per-Test Setup:**
```javascript
beforeEach(() => {
  jest.clearAllMocks();
  // Reset implementation mocks
  mockPasswordService.hash.mockResolvedValue('hashed_password');
  mockJwtService.sign.mockReturnValue('mock-jwt-token');
});

afterEach(() => {
  vi.restoreAllMocks();        // Frontend pattern
  localStorage.clear();         // Clean browser storage
});
```

**Global Setup (Frontend):**

File: `frontend/src/test/setup.js`
```javascript
import '@testing-library/jest-dom';
```

## Common Patterns

**Async Testing (Backend):**
```javascript
// Using async/await with jest.fn()
it('should hash password with bcrypt', async () => {
  mockPasswordService.hash.mockResolvedValue('hashed_value');
  
  const result = await authService.registerUser(userData);
  
  expect(mockPasswordService.hash).toHaveBeenCalledWith('pass123');
  expect(result).toBeDefined();
});

// Using expect().rejects for error testing
it('should throw ValidationError on invalid data', async () => {
  await expect(
    authService.registerUser({ /* invalid */ })
  ).rejects.toThrow(ValidationError);
});
```

**Async Testing (Frontend):**
```javascript
// Using act() for state updates
it('updates state on user action', () => {
  render(<MyComponent />);
  
  act(() => {
    localStorage.setItem('token', 'jwt-test');
    window.dispatchEvent(new Event('auth:changed'));
  });
  
  expect(screen.getByText('Logged in')).toBeInTheDocument();
});

// Using renderHook for hooks
it('updates form on handleChange', () => {
  const { result } = renderHook(() => useForm({ name: '' }));
  
  act(() => {
    result.current.handleChange({
      target: { name: 'name', value: 'John' },
    });
  });
  
  expect(result.current.form.name).toBe('John');
});
```

**Error Testing:**

Backend:
```javascript
it('should reject with ConflictError when user already exists', async () => {
  mockUserRepository.findByCedulaOrEmail.mockResolvedValue(baseUser);
  
  await expect(authService.registerUser(validData))
    .rejects.toThrow(ConflictError);
});

it('should parse API response errors with userMessage priority', async () => {
  await expect(parseApiResponse(
    new Response(JSON.stringify({
      userMessage: 'El aprendiz ya tiene este equipo.',
      error: 'ConflictError',
    }), { status: 409 })
  )).rejects.toThrow(error => {
    expect(error.message).toBe('El aprendiz ya tiene este equipo.');
    return true;
  });
});
```

Frontend:
```javascript
it('renders error message from API response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({
      userMessage: 'Invalid credentials',
    }), { status: 401 })
  ));
  
  render(<LoginForm />);
  
  // ... trigger submit
  
  expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
});
```

## Test Exclusions

**Backend:**
- Ambient-related tests skipped by default: `npm test -- --testPathIgnorePatterns=ambientesService`
- Reason: Integration with external system (not mocked)

**Frontend:**
- Utility tests excluded from main Vitest config: `exclude: ['src/utils/**/*.test.js']`
- Reason: Utilities tested separately or need special handling

---

*Testing analysis: 2026-08-27*
