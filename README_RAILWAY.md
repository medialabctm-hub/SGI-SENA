# Despliegue Rápido en Railway

Esta es una guía rápida para desplegar SGE-SENA en Railway.

## Pasos Rápidos

### 1. Preparar el Repositorio

Asegúrate de que todos los archivos Docker estén en el repositorio:
- ✅ `backend/Dockerfile`
- ✅ `frontend/Dockerfile`
- ✅ `docker-compose.yml` (para desarrollo local)
- ✅ `railway.toml` (opcional, para configuración avanzada)

### 2. Desplegar Backend

1. Ve a [Railway](https://railway.app) y crea un nuevo proyecto
2. Selecciona "Deploy from GitHub repo"
3. Conecta tu repositorio
4. Crea un nuevo servicio:
   - **Name**: `backend`
   - **Root Directory**: `backend`
   - **Dockerfile Path**: `Dockerfile`
5. Agrega un servicio MySQL (Railway → New → Database → MySQL)
6. Configura las variables de entorno (ver abajo)
7. Railway desplegará automáticamente

### 3. Desplegar Frontend

1. En el mismo proyecto Railway, crea otro servicio:
   - **Name**: `frontend`
   - **Root Directory**: `frontend`
   - **Dockerfile Path**: `Dockerfile`
2. Configura la variable de entorno:
   - `API_URL`: La URL pública de tu backend (ej: `https://backend-production-xxxx.up.railway.app`)
3. Railway desplegará automáticamente

### 4. Variables de Entorno

#### Backend

Configura estas en Railway (Settings → Variables):

```
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
CORS_ORIGIN=https://tu-frontend.railway.app
FRONTEND_URL=https://tu-frontend.railway.app
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=gse-app
JWT_AUDIENCE=gse-users
LOG_LEVEL=info
```

**Nota**: Si usas el plugin MySQL de Railway, las variables `${{MySQL.*}}` se rellenan automáticamente.

#### Frontend

```
API_URL=https://tu-backend.railway.app
```

### 5. Inicializar Base de Datos

1. Obtén las credenciales de MySQL desde Railway
2. Conecta usando un cliente MySQL (ej: MySQL Workbench, DBeaver)
3. Ejecuta el script `BD/GestionEquipo.sql`

### 6. Verificar Despliegue

- Backend: `https://tu-backend.railway.app/health`
- Frontend: `https://tu-frontend.railway.app`

## Dominios Personalizados

Railway permite agregar dominios personalizados:

1. Ve a Settings → Domains
2. Agrega tu dominio
3. Configura los registros DNS según las instrucciones de Railway

## Monitoreo

Railway proporciona:
- Logs en tiempo real
- Métricas de uso
- Alertas de errores

Accede desde el dashboard de Railway.

## Troubleshooting

### El backend no inicia

- Verifica que todas las variables de entorno estén configuradas
- Revisa los logs en Railway
- Asegúrate de que la base de datos esté accesible

### El frontend no puede comunicarse con el backend

- Verifica que `API_URL` en el frontend apunte a la URL correcta del backend
- Verifica que `CORS_ORIGIN` en el backend incluya la URL del frontend
- Revisa los logs de nginx en el frontend

### Errores de base de datos

- Verifica que el script SQL se haya ejecutado correctamente
- Verifica las credenciales de la base de datos
- Asegúrate de que el servicio MySQL esté corriendo

## Recursos Adicionales

- [Documentación completa de Railway](https://docs.railway.app)
- [Guía de despliegue detallada](./DEPLOYMENT.md)

