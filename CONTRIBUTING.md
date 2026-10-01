# Contribución — SGI-SENA

## CI (MDL-233)

Cada PR hacia `develop` dispara el workflow GitHub Actions **backend-tests**:

| Job (nombre del check) | Qué corre |
| --- | --- |
| `backend-unit` | `npm ci` + Jest en `backend/` (suite unitaria/seguridad) |
| `backend-mysql` | Service MySQL **8.0.40** + `npm run test:mysql` |

Frontend lint/tests **no** forman parte del CI mínimo todavía (hay fallos locales); follow-up aparte.

## Migraciones de base de datos

Todo cambio de esquema va en `backend/migrations/AAAAMMDD_descripcion.sql` (idempotente y aditivo)
y **en el mismo PR** que el código que lo usa. Railway las aplica en el preDeploy y no despliega si
fallan; `backend-mysql` corre el runner contra MySQL 8 real. Detalle y reglas en
`Documentation/DEPLOY_RAILWAY.md` (sección «Migraciones SQL automáticas»). Un cambio de esquema que
no esté en esa carpeta no llega a producción: ver el incidente de `token_version` (MDL-229).

## Protección de `develop`

Solo el **dueño/admin del repo** (Presiga) puede cambiar branch protection. No se modifica desde PRs ni desde CI.

Configuración acordada (activarla en GitHub → Settings → Branches → `develop`):

1. Require a pull request before merging
2. Require approvals: **1**
3. Dismiss stale pull request approvals when new commits are pushed
4. Require status checks to pass before merging — checks requeridos: **`backend-unit`**, **`backend-mysql`**
5. Do not allow force pushes
6. Do not allow deletions

Norma de equipo: PRs con label **Security** requieren review de **SECURITY-SGI** antes del merge (proceso/checklist; el enforcement nativo label→reviewer puede no estar disponible).
