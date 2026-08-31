# Despliegue en Railway

Guía para desplegar SGI-SENA (backend + frontend web) en Railway. El repo ya
trae todo lo necesario: `railway.json`/`railway.toml` (build por Dockerfile),
`Dockerfile` raíz (nginx sirve el frontend y hace proxy de `/api` al backend
Node interno) y `start.sh` (arranque de ambos procesos y manejo del puerto
dinámico de Railway).

## Gate de reproducibilidad del release

El release se construye únicamente desde archivos versionados. Estos son los
artefactos intencionales del despliegue y deben existir en el commit que se
entrega:

- `Dockerfile`, `.dockerignore` y `start.sh`.
- `railway.json` y `railway.toml`.
- `frontend/nginx-main.conf` y `frontend/nginx-server.conf`.
- `backend/package-lock.json`, `frontend/package-lock.json` y
  `package-lock.json` raíz.
- `backend/scripts/smoke-test.js` y `frontend/src/utils/loanRequest.js`.
- `Documentation/DEPLOY_RAILWAY.md` y el esquema versionado
  `BD/SGI_SENA.sql`.

`node_modules/`, `dist/`, `coverage/`, `.env*` y los logs están excluidos por
`.gitignore` y `.dockerignore`; no se deben agregar con `git add -f`. La
documentación general bajo `Documentation/` permanece ignorada, pero este
runbook tiene una excepción explícita porque forma parte del gate de release.

Antes de desplegar, comprobar el árbol y guardar la salida junto con la
revisión:

```bash
git status --short --untracked-files=all
git ls-files --error-unmatch Dockerfile railway.json railway.toml start.sh \
  frontend/src/utils/loanRequest.js backend/scripts/smoke-test.js \
  Documentation/DEPLOY_RAILWAY.md
git ls-files | grep -E '(^|/)(node_modules|dist|coverage)(/|$)'
```

La última consulta debe no devolver resultados. Un archivo funcional nuevo,
como `frontend/src/utils/loanRequest.js`, se valida por `git ls-files`; no se
considera suficiente que exista solo en el disco local.

> ⚠️ **Antes de empezar — seguridad**: NO reutilizar la base de datos MySQL del
> despliegue anterior. Sus credenciales root están commiteadas en
> `backend/env.local.example` de este repo (y en el historial de git), por lo
> que deben considerarse comprometidas. Crear BD nueva y, aparte, eliminar ese
> proyecto/BD viejo en Railway y limpiar las credenciales del repo.

## Requisitos

- Cuenta en [railway.com](https://railway.com) (login con GitHub recomendado),
  plan Hobby.
- Acceso al repo `medialabctm-hub/SGI-SENA` desde esa cuenta.
- Cliente `mysql` o Docker en tu máquina para importar el esquema.

## 1. Crear el proyecto

1. Railway → **New Project** → **Deploy from GitHub repo** → `SGI-SENA` (rama `main`).
2. Railway detecta `railway.json` y construye con el `Dockerfile` raíz.
   El primer deploy fallará o quedará inestable hasta configurar las variables — normal.

## 2. Base de datos MySQL

1. En el mismo proyecto: **Create → Database → MySQL**.
2. La BD por defecto de Railway se llama `railway` — coincide con la que crea
   el script `BD/SGI_SENA.sql` (¡que hace `DROP DATABASE IF EXISTS railway`!).
3. Importar el esquema usando la conexión pública del servicio MySQL
   (pestaña **Connect** → valores `MYSQLHOST` público, `MYSQLPORT`, `MYSQLPASSWORD`):

```bash
mysql -h <host-publico>.proxy.rlwy.net -P <puerto> -u root -p < BD/SGI_SENA.sql
```

## 3. Variables de entorno del servicio de la app

En el servicio de la app → **Variables**. Las de BD se referencian al servicio
MySQL con la sintaxis `${{MySQL.VARIABLE}}` (conexión por red privada interna):

```env
NODE_ENV=production
LOG_LEVEL=info

DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}

# Generar valores fuertes: openssl rand -base64 48
JWT_SECRET=<secreto-fuerte-1>
COOKIE_SECRET=<secreto-fuerte-2>
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=gse-app
JWT_AUDIENCE=gse-users

# API key real de https://app.brevo.com/settings/keys/api
# (sin ella el servidor NO arranca; con placeholder arranca pero no envía correos)
BREVO_API_KEY=<api-key-brevo>
BREVO_SENDER_EMAIL=<remitente-verificado-en-brevo>

# Se completan con el dominio generado en el paso 5
CORS_ORIGIN=https://<dominio>.up.railway.app
FRONTEND_URL=https://<dominio>.up.railway.app
```

Nota: NO definir `PORT` manualmente — Railway lo inyecta y `start.sh` lo usa
para nginx (el backend interno siempre corre en 3000).

## 4. Volumen para uploads

Las fotos de equipos/perfiles/ambientes se guardan en disco. Sin volumen se
pierden en cada deploy:

Servicio de la app → clic derecho → **Attach Volume** → mount path:

```
/app/backend/uploads
```

## 5. Dominio público

Servicio de la app → **Settings → Networking → Generate Domain**. Copiar la
URL (p. ej. `https://sgi-sena-production.up.railway.app`), actualizar
`CORS_ORIGIN` y `FRONTEND_URL` con ella y redesplegar.

## 6. Usuario administrador inicial

El esquema siembra un admin (cédula `1000000000`) con contraseña no
documentada. Establecer una contraseña propia:

```bash
# Generar hash (requiere node + bcrypt; en backend/ tras npm install):
cd backend
node -e "import('bcrypt').then(b => b.default.hash('<TuContrasenaFuerte>', 12).then(h => console.log(h)))"

# Aplicarlo en la BD de Railway:
mysql -h <host-publico>.proxy.rlwy.net -P <puerto> -u root -p \
  -e "USE railway; UPDATE Usuarios SET contrasena='<hash>' WHERE cedula='1000000000';"
```

## 7. Verificación

```bash
curl https://<dominio>.up.railway.app/health
# → {"status":"ok","env":"production",...}

curl -X POST https://<dominio>.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"cedula":"1000000000","contrasena":"<TuContrasenaFuerte>"}'
# → {"token":"...","user":{...}}
```

El frontend web queda en `https://<dominio>.up.railway.app/`.

### Smoke reproducible

El smoke apunta al servicio completo (nginx), no al puerto interno del
backend. `BASE_URL` es obligatorio para probar Railway y, si se omite,
`npm run test:smoke` usa `http://localhost:5173` para el frontend de Vite.
Por defecto comprueba `/health`, el HTML del frontend y el proxy `/api` con un
payload inválido de préstamo que debe devolver `400` sin tocar la base de
datos:

```bash
BASE_URL=https://<dominio>.up.railway.app npm run test:smoke
```

El flujo completo de préstamo es mutante y está opt-in. Solo ejecutarlo contra
un aprendiz, equipo y clase de prueba dedicados, con la clase activa y el
schema de autoservicio listo:

```bash
BASE_URL=https://<dominio>.up.railway.app \
SMOKE_LOAN=1 \
SMOKE_DOCUMENTO=<documento-fixture> \
SMOKE_PLACA=<placa-fixture> \
SMOKE_IDEMPOTENCY_KEY=smoke-mdl-73-fixture \
npm run test:smoke
```

La identidad idempotente permite repetir la comprobación sin crear otro
registro para la misma solicitud. Después de una ejecución nueva, cerrar el
préstamo de la fixture según el procedimiento operativo antes de reutilizar el
equipo. Sin un servicio local/desplegado accesible, el smoke de red no puede
ejecutarse: los tests Jest del script cubren el contrato con `fetch` mockeado,
pero no sustituyen esta verificación del entorno.

## 8. Rollback y evidencia del artefacto

### Criterios de rollback

Iniciar rollback si ocurre cualquiera de estas condiciones después del deploy:

- `GET /health` no devuelve `200` con `status: "ok"`.
- `/` no devuelve el HTML de la SPA, o el proxy `/api` devuelve la SPA en vez
  de una respuesta de API.
- El smoke controlado falla, devuelve un envelope de préstamo incompleto o
  crea duplicados para la misma `Idempotency-Key`.
- Hay errores 5xx sostenidos, reinicios del contenedor o pérdida de acceso al
  volumen de `uploads`.

En Railway, abrir **Deployments**, seleccionar el último despliegue saludable
anterior y usar **Redeploy**. Confirmar luego `/health`, `/`, `/api` y los logs.
Este cambio no incorpora una migración destructiva de BD; si un release futuro
incluye migraciones, respaldar MySQL antes y no restaurar el esquema de forma
automática al hacer rollback de la aplicación.

### Registro de evidencia

Guardar estos datos en el ticket o nota del release, sin incluir secretos:

```text
Commit desplegado: <git rev-parse --verify HEAD>
Deployment ID de Railway: <id visible en Deployments>
Digest de imagen: sha256:<digest visible en Railway>
URL verificada: https://<dominio>.up.railway.app
Fecha/hora UTC del smoke: <timestamp>
Resultado: health / frontend / proxy / préstamo controlado
```

Para el artefacto local previo al deploy, registrar también el identificador
producido por `docker image inspect`:

```bash
git rev-parse --verify HEAD
docker build --pull -t sgi-sena:<commit-corto> .
docker image inspect --format='{{.Id}}' sgi-sena:<commit-corto>
```

El digest de Railway y el commit desplegado son la evidencia de producción;
el identificador local solo demuestra qué imagen se construyó antes de
publicarla.

## 9. Conectar la app móvil

En el repo SGI-SENA-MOBILE:

```bash
flutter build apk --release --dart-define=API_HOST=https://<dominio>.up.railway.app
```

Detalles del build por plataforma y pendientes de tiendas: README del repo móvil.

## Costos y operación

- Hobby plan: USD $5/mes de crédito incluido; este stack (app + MySQL) suele
  quedar cerca de ese rango con uso de piloto.
- Los deploys se disparan automáticamente con cada push a `main` del repo.
- Logs: servicio → pestaña **Logs**. Métricas de CPU/RAM en **Metrics**.
- Backups de BD: Railway hace snapshots del volumen; para respaldos manuales
  usar `mysqldump` contra la conexión pública.
