# 01-01-SUMMARY — MDL-127: migración de JWT a cookies httpOnly

## Estado

**PASS (implementación + validación estática y backend automatizada). Frontend: tests automatizados NO ejecutados en esta sesión (bloqueo de herramientas), gap explícito abajo.**

## Contrato de sesión elegido

- Cookie: `sgi_session`, httpOnly, `secure` = `NODE_ENV==='production'`, `sameSite: 'lax'`, `path: '/'`, `maxAge` derivado de `JWT_EXPIRES_IN` (default 24h).
- Arquitectura confirmada antes de tocar código: en producción y desarrollo, frontend y backend se sirven bajo el **mismo origen** (`frontend/nginx-server.conf` hace proxy de `/api`, `/uploads` y `/socket.io` al backend; Vite hace lo mismo en dev). Esto permite `sameSite: 'lax'` sin necesitar `SameSite=None` cross-site.
- `authenticate`/`optionalAuthenticate` (backend) priorizan la cookie httpOnly; solo caen al header `Authorization: Bearer` si no hay cookie (compatibilidad con `/login-placa`, la app de escritorio, que queda **fuera de alcance** y sigue devolviendo el JWT en el body porque no es un navegador).
- Socket.IO: el handshake se autentica primero con la cookie httpOnly (`socket.handshake.headers.cookie`), con fallback a `auth.token`/`query.token` para no romper otros clientes.
- El navegador ya no persiste el JWT bajo ninguna clave. El único estado local restante es `localStorage.user` (perfil no sensible, ya existía antes de este cambio) usado como indicador rápido de "hubo login" y para render de UI (iniciales, rol). La autorización real siempre se verifica contra el servidor (`/api/auth/me` con `credentials: 'include'`).

## Cambios de implementación

**Backend**
- `backend/src/utils/sessionCookie.js` (nuevo): nombre de cookie, opciones, parser de duración, `extractSessionToken` (cookie→header) y `extractTokenFromCookieHeader` (para el handshake de socket.io, sin agregar la dependencia `cookie` — parser manual mínimo).
- `backend/src/controller/authController.js`: `loginUser` ya no devuelve `token` en el body; lo emite vía `res.cookie(...)`. Nuevo `logoutUser` (`res.clearCookie`). `loginUserWithPlaca` sin cambios (fuera de alcance).
- `backend/src/middleware/authMiddleware.js`: `authenticate`/`optionalAuthenticate` usan `extractSessionToken` (cookie prioritaria, header de fallback).
- `backend/src/routes/authRoutes.js`: nueva ruta pública `POST /api/auth/logout`.
- `backend/src/services/socketService.js`: el middleware de socket.io también acepta la cookie httpOnly.

**Frontend**
- `frontend/src/config/api.js` (`apiFetch`): ya no lee `localStorage.token`; agrega `credentials: 'include'` explícito.
- `frontend/src/components/ProtectedRoute.jsx`: ya no depende de ningún indicador local; siempre verifica `/api/auth/me` con `credentials: 'include'` (sin `Authorization`).
- `frontend/src/pages/Login.jsx`: ya no guarda `token`; solo cachea `user` (perfil).
- `frontend/src/components/Header.jsx`: `confirmLogout` llama a `POST /api/auth/logout`; el resto de handlers (`fetchNotifications`, `handleOpenPerfil`, `markNotificationAsRead`, `markAllNotificationsAsRead`) migrados a `credentials: 'include'` sin `Authorization`.
- `frontend/src/contexts/SocketContext.jsx`: el handshake usa `withCredentials: true` (cookie); ya no envía ningún token leído del navegador.
- `frontend/src/utils/api.js`: `getAuthHeaders()` ya no construye `Authorization` desde `localStorage`; `handleSessionExpiration` usa la presencia de `user` (no `token`) como gate, y sigue limpiando ambas claves de forma defensiva.
- `frontend/src/components/RedirectIfAuth.jsx`: guarda basada en `user`, no en `token`.
- `frontend/src/hooks/useLocalStorage.js`: se eliminó `useAuthToken` (hook muerto, sin consumidores, que leía `localStorage.token`).
- **Migración masiva (codemod verificado + revisión manual):** 35 archivos adicionales (`pages/*.jsx`, `components/*.jsx`, `hooks/useAuthenticatedEvidenceImages.js`, `contexts/LanguageContext.jsx`) que construían `Authorization: Bearer ${token}` desde `localStorage.getItem('token')` fueron migrados a `credentials: 'include'`; las declaraciones `const token = localStorage.getItem('token')` se eliminaron (109 casos, sin otro uso) o se renombraron a `user`/`localStorage.getItem('user')` cuando servían de guard de "hay sesión" (18 casos). Un caso adicional con `Authorization` inline (`pages/DetalleAmbiente.jsx`) se corrigió a mano.
  - **Bug encontrado y corregido durante la revisión:** en `pages/Dashboard.jsx` y `components/Sidebar.jsx` el renombrado automático a `user` colisionaba (TDZ) con el `user` de estado del componente ya referenciado antes en el mismo bloque (`if (user?.nombre_rol !== ...)`). Se renombró la variable local a `hasSession` en ambos archivos para eliminar la colisión.

## Validación realizada

**Backend — PASS**
- `cd backend && npm test -- --testPathPattern="sessionCookie|authMiddleware|authController|authRoutes|socketService"` → **69/69 tests PASS** (incluye tests nuevos de cookie-first auth, logout, y auth de socket.io por cookie).
- `cd backend && npm test -- --testPathIgnorePatterns=ambientesService` (suite completa) → **89 suites (1 omitida por convención del repo), 1888/1894 tests PASS, 6 skipped, 0 failed.**
- `cd backend && npm run lint` → **0 errores** (375 warnings, todos preexistentes; verificado que ninguno corresponde a los archivos tocados salvo 2 warnings preexistentes ya presentes antes del cambio).

**Frontend — validación estática PASS, tests automatizados NO ejecutados (gap)**
- `cd frontend && npx eslint src` (corrida completa, una sola vez, exitosa) → **0 errores**, 101 warnings (estilo preexistente; 1 warning nuevo de "unused eslint-disable" en `pages/config/Notifications.jsx`, no bloqueante).
- Búsquedas estáticas (`rg`) sobre `frontend/src`, excluyendo tests:
  - `Bearer \$\{` → **0 coincidencias**.
  - `localStorage\.getItem\('token'\)` → **0 coincidencias**.
  - `localStorage\.setItem\('token'` → **0 coincidencias**.
  - `localStorage\.removeItem\('token'\)` → **2 coincidencias** (`Header.jsx` confirmLogout, `utils/api.js` handleSessionExpiration) — limpieza defensiva intencional de una clave que ya no se escribe nunca, no una lectura/escritura funcional.
- `git diff --check` → limpio (solo avisos informativos de conversión LF→CRLF de Git en Windows, sin errores de whitespace; se corrigieron 2 archivos con finales de línea mixtos introducidos por el propio cambio).
- **Gap explícito:** la suite de Vitest del frontend (`cd frontend && npm test`) no pudo ejecutarse hasta el final en esta sesión por bloqueos repetidos de la herramienta de comandos (timeouts/hangs con `npx vitest`/`npx eslint` en ejecuciones posteriores a la primera). Se actualizaron y/o crearon los tests focalizados de sesión (`ProtectedRoute.test.jsx`, `Header.test.jsx`, `Login.test.jsx` nuevo, `config/api.test.js` nuevo, `useLocalStorage.test.js`), y se verificó por lectura que su lógica es coherente con la implementación final, pero **no hay evidencia de ejecución real de Vitest en esta sesión**. Recomendación: correr `cd frontend && npm test` antes de mergear.

## No incluido en este commit (fuera de alcance MDL-127)

- `package-lock.json`: no se tocó en ningún workspace.
- MDL-131 / MDL-134: sin cambios relacionados.
- `/api/auth/login-placa` (app de escritorio): sin cambios; sigue devolviendo el JWT en el body a propósito (no es un flujo de navegador).
- Ejecución de Vitest en frontend (ver gap arriba).

## Reproducibilidad

Rama base: HEAD de este checkout (`PR3S1G4zZ/mdl-127-gsd-wave-v2`, commit `56295b3`). El commit de este plan es atómico y contiene backend + frontend + tests + este SUMMARY.
