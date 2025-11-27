# Configuración de Railway - SGE-SENA

## Dominio del Proyecto

**Backend API**: `https://sgi-sena.up.railway.app`

Este dominio está configurado en:
- ✅ `frontend/nginx.conf` - Configuración del proxy de nginx
- ✅ `frontend/docker-entrypoint.sh` - Script de inicio del frontend
- ✅ `backend/env.example` - Variables de entorno de ejemplo
- ✅ `docker-compose.yml` - Configuración de desarrollo local
- ✅ Documentación de despliegue

## Variables de Entorno Requeridas

### Backend

Configura estas variables en Railway para el servicio backend:

```env
NODE_ENV=production
PORT=3000
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
JWT_SECRET=<genera-un-secreto-seguro>
COOKIE_SECRET=<genera-otro-secreto-seguro>
EMAIL_USER=tu_email@gmail.com
EMAIL_PASSWORD=tu_contraseña_de_aplicacion
CORS_ORIGIN=https://sgi-sena.up.railway.app
FRONTEND_URL=https://sgi-sena.up.railway.app
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=gse-app
JWT_AUDIENCE=gse-users
LOG_LEVEL=info
```

### Frontend (si está en servicio separado)

```env
API_URL=https://sgi-sena.up.railway.app
```

## Verificación

Una vez desplegado, verifica:

1. **Health Check del Backend**:
   ```
   https://sgi-sena.up.railway.app/health
   ```

2. **API Endpoints**:
   ```
   https://sgi-sena.up.railway.app/api/auth/login
   ```

3. **Frontend** (si está desplegado):
   - Debe poder comunicarse con el backend
   - Verifica que las peticiones `/api/*` funcionen correctamente

## Notas Importantes

- El dominio `sgi-sena.up.railway.app` está configurado como valor por defecto en todos los archivos de configuración
- Si cambias el dominio en Railway, actualiza las variables de entorno `CORS_ORIGIN` y `FRONTEND_URL` en el backend
- Si el frontend está en un servicio separado, actualiza `API_URL` en el frontend con el nuevo dominio del backend

