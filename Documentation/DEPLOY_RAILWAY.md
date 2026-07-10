# Despliegue en Railway

Guía para desplegar SGI-SENA (backend + frontend web) en Railway. El repo ya
trae todo lo necesario: `railway.json`/`railway.toml` (build por Dockerfile),
`Dockerfile` raíz (nginx sirve el frontend y hace proxy de `/api` al backend
Node interno) y `start.sh` (arranque de ambos procesos y manejo del puerto
dinámico de Railway).

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

## 8. Conectar la app móvil

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