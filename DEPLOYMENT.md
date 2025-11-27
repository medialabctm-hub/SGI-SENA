# Guía de Despliegue en Railway

Esta guía explica cómo desplegar el proyecto SGE-SENA en Railway usando Docker.

## Estructura del Proyecto

El proyecto está dividido en dos servicios principales:
- **Backend**: API Node.js/Express (puerto 3000)
- **Frontend**: Aplicación React/Vite servida con Nginx (puerto 80)

## Opciones de Despliegue

### Opción 1: Despliegue Separado (Recomendado)

Despliega el backend y frontend como servicios separados en Railway. Esto permite escalar cada servicio independientemente.

#### Backend

1. En Railway, crea un nuevo proyecto
2. Conecta tu repositorio
3. Configura el servicio:
   - **Root Directory**: `backend`
   - **Dockerfile Path**: `Dockerfile`
   - **Start Command**: `node server.js`

4. Configura las variables de entorno (ver sección Variables de Entorno)

5. Agrega un servicio MySQL de Railway o configura una base de datos externa

#### Frontend

1. En Railway, crea un nuevo servicio en el mismo proyecto
2. Conecta el mismo repositorio
3. Configura el servicio:
   - **Root Directory**: `frontend`
   - **Dockerfile Path**: `Dockerfile`
   - **Start Command**: (automático, nginx se inicia automáticamente)

4. Configura las variables de entorno:
   - `API_URL`: URL del backend desplegado (ej: `https://tu-backend.railway.app`)
   - Nota: Esta variable se usa para configurar el proxy de nginx automáticamente

5. El script `docker-entrypoint.sh` configurará automáticamente nginx para usar la URL del backend

### Opción 2: Despliegue Monorepo

Despliega todo desde la raíz del proyecto usando docker-compose (solo para desarrollo local).

## Variables de Entorno

### Backend

Configura estas variables en Railway:

```env
NODE_ENV=production
PORT=3000
DB_HOST=tu-host-mysql
DB_PORT=3306
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=GestionEquipo
JWT_SECRET=tu-secreto-jwt-super-seguro
COOKIE_SECRET=tu-secreto-cookie-super-seguro
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

### Frontend

```env
API_URL=https://tu-backend.railway.app
```

**Nota**: `API_URL` se usa para configurar el proxy de nginx. Si no se proporciona, se usará la configuración por defecto (`http://backend:3000`) que funciona con docker-compose.

## Base de Datos

Railway ofrece servicios MySQL gestionados. Alternativamente, puedes usar:

- Railway MySQL Plugin
- PlanetScale
- AWS RDS
- Otra base de datos MySQL externa

### Inicialización de la Base de Datos

1. Conecta a tu base de datos MySQL
2. Ejecuta el script SQL ubicado en `BD/GestionEquipo.sql`

## Configuración de Nginx (Frontend)

El archivo `frontend/nginx.conf` está configurado para:
- Servir la aplicación React
- Hacer proxy de `/api` y `/uploads` al backend
- Configurar cache para archivos estáticos
- Habilitar compresión gzip

**Configuración automática**: El script `docker-entrypoint.sh` actualiza automáticamente la URL del backend en nginx.conf usando la variable de entorno `API_URL`. Si no se proporciona `API_URL`, se usa la configuración por defecto (`http://backend:3000`) que funciona con docker-compose.

Si necesitas configurar manualmente, puedes editar `nginx.conf` y cambiar la línea:
```nginx
set $api_backend http://backend:3000;
```

## Despliegue Local con Docker Compose

Para probar localmente antes de desplegar:

```bash
# Copia el archivo de ejemplo de variables de entorno
cp backend/env.example .env

# Edita .env con tus valores

# Inicia los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down
```

## Verificación Post-Despliegue

1. **Backend Health Check**: `https://tu-backend.railway.app/health`
2. **Frontend**: `https://tu-frontend.railway.app`
3. Verifica que las peticiones API funcionen desde el frontend

## Troubleshooting

### Backend no se conecta a la base de datos

- Verifica que `DB_HOST` apunte al servicio MySQL correcto
- En Railway, si usas el plugin MySQL, el host suele ser algo como `containers-us-west-xxx.railway.app`
- Verifica que el puerto sea `3306` o el puerto correcto

### Frontend no puede comunicarse con el backend

- Verifica que `CORS_ORIGIN` en el backend incluya la URL del frontend
- Verifica que `VITE_API_URL` en el frontend apunte al backend correcto
- Si usas nginx como proxy, verifica la configuración de `proxy_pass`

### Errores de permisos en uploads

- Asegúrate de que el directorio `uploads` tenga permisos de escritura
- En Docker, el volumen debe estar montado correctamente

## Comandos Útiles

```bash
# Construir imagen localmente
docker build -t sge-backend ./backend
docker build -t sge-frontend ./frontend

# Ejecutar contenedor localmente
docker run -p 3000:3000 --env-file .env sge-backend
docker run -p 80:80 sge-frontend

# Ver logs de Railway
railway logs
```

## Notas Importantes

- **Seguridad**: Nunca commitees archivos `.env` con valores reales
- **Secrets**: Usa Railway Secrets para variables sensibles
- **SSL**: Railway proporciona SSL automático para tus dominios
- **Escalado**: Railway puede escalar automáticamente según la carga

