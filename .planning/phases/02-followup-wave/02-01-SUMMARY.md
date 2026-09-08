---
phase: 02-followup-wave
plan: 01
status: completed
issues:
  - MDL-133
  - MDL-132
---

# 02-01 — Resumen de ejecución

## Alcance seleccionado

Se seleccionaron MDL-133 y MDL-132 porque permiten cerrar unidades verticales
de seguridad con cambios pequeños, contratos existentes y pruebas locales:

- **MDL-133:** las fotos de perfiles y ambientes dejaron de exponerse mediante
  `express.static`; se conservaron las URLs históricas con handlers autenticados,
  metadata parametrizada, autorización y resolución confinada.
- **MDL-132:** se fijó el contrato JWT de HS256/expiración/issuer/audience y se
  añadió validación Zod al login de escritorio, sin inventar una identidad de
  kiosko. `cookie-parser` continúa sin firma porque la cookie transporta el JWT;
  se eliminó la exigencia muerta de `COOKIE_SECRET`.

No se seleccionaron MDL-126 (requiere decisión de identidad/capacidad del
kiosko), MDL-130 (refactor grande de controlador/DDL) ni MDL-135 (gate amplio
con staging, Excel, smoke y UAT). MDL-9, MDL-11 y MDL-15 permanecen como
dependencias o validaciones de infraestructura que no se pueden cerrar aquí.

## Entrega por issue

### MDL-133

- `backend/src/app.js`: reemplaza los dos montajes estáticos por rutas GET
  autenticadas en `/uploads/perfiles/:filename` y
  `/uploads/ambientes/:filename`.
- `backend/src/controller/privateUploadController.js`: exige metadata exacta;
  perfiles permite propietario, Administrador o `users:view_detail`, y ambientes
  usa `ambientes:view` aplicado por la ruta. Los casos no autorizados responden
  404 genérico.
- `backend/src/utils/privateUpload.js`: rechaza nombres inseguros, traversal,
  rutas absolutas, symlinks y archivos no regulares; verifica confinamiento
  físico y envía con `Cache-Control: private, no-store`.
- Pruebas focalizadas cubren ruta estática ausente, propietario, permiso,
  recurso huérfano, traversal y rechazo de symlink mediante `lstat` mockeado.

### MDL-132

- `backend/src/services/JwtService.js` y `backend/src/di/setup.js`: fijan
  HS256, expiración, issuer y audience desde `config.jwt`; las opciones del
  caller no pueden sobrescribir algoritmo, issuer o audience.
- `backend/src/validators/authValidator.js` y `backend/src/routes/authRoutes.js`:
  `loginPlacaSchema` valida `cedula`, `contrasena` y `placa` después del
  rate limiter y antes del controlador.
- `backend/src/config/config.js`, `backend/scripts/check-env.js`, ejemplos,
  Docker Compose y documentación ya no requieren `COOKIE_SECRET`; queda
  documentada la separación entre JWT firmado y cookie parseada.
- Las pruebas negativas cubren issuer, audience, algoritmo, expiración, límites
  de body, campos vacíos y registro de la cadena de middlewares.

## Commits

- `8323226e6b80756d6805ef1eeb4fce021bc8133b`
  — `fix(MDL-133): protect profile and environment uploads`
- `66ff2fa82c1e8884f0dec08162989a119b38d08d`
  — `fix(MDL-133): align private upload migration comment`
- `96b6b3ab5e2340e5ce8ca15ef8c190dfea62a13e`
  — `fix(MDL-132): harden JWT and placa login contracts`

## Verificación y límites

- PASS: 8 suites focalizadas, 98 tests (`npm test --prefix backend --
  --runInBand ...`); ver detalle en `02-01-VERIFICATION.md`.
- PASS: `node --check` de los módulos JavaScript tocados.
- PASS: ESLint focalizado, 0 errores; quedaron tres warnings existentes de
  `console`/orden de imports en archivos no afectados semánticamente.
- PASS: `git diff --check`.
- BLOCKED/humano: no se ejecutaron MySQL real, Docker, Railway, CI remoto,
  navegador, staging ni UAT. Tampoco se pudo crear un symlink real en Windows
  por permisos; la rama de rechazo se cubre con mock de `lstat`.
- Riesgo de despliegue: fijar issuer/audience invalida tokens emitidos antes del
  cambio; el login normal y `login-placa` deben emitir tokens nuevos tras el
  despliegue. La autorización de ambientes es de rol (`ambientes:view`) y la
  validación de staging/UAT sigue pendiente.
