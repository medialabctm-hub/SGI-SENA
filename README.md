# Guía de Despliegue en Producción - Servidor Ubuntu

Esta guía te ayudará a configurar y desplegar el Sistema de Gestión de Inventario SENA en un servidor Ubuntu para producción.

## Tabla de Contenidos

- [Requisitos Previos](#requisitos-previos)
- [Arquitectura](#arquitectura)
- [Instalación Paso a Paso](#instalación-paso-a-paso)
- [Configuración](#configuración)
- [Despliegue](#despliegue)
- [Gestión y Mantenimiento](#gestión-y-mantenimiento)
- [Preparación para Dominio](#preparación-para-dominio)
- [Troubleshooting](#troubleshooting)

## Requisitos Previos

- Servidor Ubuntu 20.04 o superior
- Acceso root o sudo al servidor
- Mínimo 2GB RAM (recomendado 4GB)
- Mínimo 20GB espacio en disco
- Conexión a internet estable
- IP pública estática (o dinámica con DNS)

## Arquitectura

```
Internet
   ↓
Firewall (UFW) - Puertos: 80 (HTTP), 443 (HTTPS), 22 (SSH)
   ↓
Docker Network (sge-network)
   ↓
┌─────────────────────────────────────────┐
│  Frontend (Nginx) - Puerto 80          │
│  Backend (Node.js) - Puerto 3000       │
│  MySQL - Puerto 3306 (solo interno)    │
└─────────────────────────────────────────┘
```

### Servicios

- **Frontend**: Nginx sirve la aplicación React en el puerto 80
- **Backend**: API Node.js/Express en el puerto 3000 (solo acceso interno)
- **MySQL**: Base de datos en el puerto 3306 (solo acceso interno)
- **Volúmenes**: Datos persistentes para MySQL y uploads

## Instalación Paso a Paso

### 1. Preparación del Servidor

Conecta al servidor Ubuntu y ejecuta el script de configuración inicial:

```bash
# Clonar o copiar el proyecto al servidor
cd /ruta/del/proyecto

# Dar permisos de ejecución
chmod +x deployment/*.sh

# Ejecutar configuración inicial (requiere sudo)
sudo ./deployment/setup-server.sh
```

Este script:
- Actualiza el sistema
- Instala Docker y Docker Compose
- Configura firewall (UFW)
- Optimiza parámetros del sistema
- Configura usuario para Docker

**Nota**: Si agregaste un usuario al grupo docker, cierra sesión y vuelve a entrar.

### 2. Obtener IP Pública

```bash
./deployment/get-ip.sh
```

Este script muestra:
- IP pública del servidor
- IP local
- Estado de conectividad
- URLs de acceso

Guarda la IP pública, la necesitarás para configurar CORS.

### 3. Configurar Variables de Entorno

```bash
./deployment/setup-env.sh
```

Este script:
- Detecta o solicita la IP pública
- Genera secrets seguros (JWT, cookies, DB passwords)
- Crea el archivo `.env` desde el template
- Solicita configuración de Brevo (email)

**Variables importantes a configurar manualmente**:

1. **BREVO_API_KEY**: Obtén en https://app.brevo.com/settings/keys/api
2. **BREVO_SENDER_EMAIL**: Email verificado en Brevo

Puedes editar el archivo `.env` manualmente después:

```bash
nano .env
```

### 4. Verificar Archivo de Base de Datos

Asegúrate de que existe el archivo SQL de inicialización:

```bash
ls -lh BD/SGI_SENA.sql
```

Si no existe, cópialo o créalo según tu esquema de base de datos.

## Configuración

### Archivo .env

El archivo `.env` contiene todas las variables de configuración. **NUNCA** lo subas a git.

Variables críticas:

```env
# Base de datos
DB_HOST=db
DB_USER=sge_user
DB_PASSWORD=tu_password_seguro
DB_NAME=GestionEquipo

# Seguridad
JWT_SECRET=tu_jwt_secret_seguro
COOKIE_SECRET=tu_cookie_secret_seguro

# CORS (usar IP pública por ahora)
CORS_ORIGIN=http://TU_IP_PUBLICA
FRONTEND_URL=http://TU_IP_PUBLICA

# Email
BREVO_API_KEY=tu_api_key
BREVO_SENDER_EMAIL=noreply@tudominio.com
```

### Firewall

El firewall está configurado para:
- Permitir puerto 80 (HTTP)
- Permitir puerto 443 (HTTPS - para futuro)
- Permitir puerto 22 (SSH)
- **NO** permitir puerto 3306 externamente (MySQL solo interno)

Ver estado del firewall:

```bash
sudo ufw status verbose
```

## Despliegue

### Despliegue Inicial

```bash
./deployment/deploy.sh
```

Este script:
- Valida la configuración
- Construye las imágenes Docker
- Levanta los servicios
- Verifica la salud de los servicios
- Muestra información de acceso

### Verificar Despliegue

1. **Verificar contenedores**:

```bash
docker ps
```

Debes ver 3 contenedores corriendo:
- `sge-sena-frontend`
- `sge-sena-backend`
- `sge-sena-db`

2. **Verificar logs**:

```bash
# Todos los servicios
docker-compose logs -f

# Servicio específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

3. **Verificar acceso**:

```bash
# Health check
curl http://TU_IP_PUBLICA/health

# Frontend
curl http://TU_IP_PUBLICA
```

4. **Acceder desde navegador**:

Abre en tu navegador: `http://TU_IP_PUBLICA`

## Gestión y Mantenimiento

### Comandos Útiles

```bash
# Ver estado de servicios
docker-compose ps

# Iniciar servicios
docker-compose up -d

# Detener servicios
docker-compose down

# Reiniciar servicios
docker-compose restart

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f backend

# Acceder a contenedor
docker exec -it sge-sena-backend sh
docker exec -it sge-sena-db mysql -u sge_user -p
```

### Backup de Base de Datos

#### Backup Manual

```bash
./deployment/backup-db.sh
```

Los backups se guardan en `backups/` con formato:
- `backup_GestionEquipo_YYYYMMDD_HHMMSS.sql.gz`

#### Backup Automático (Cron)

Para programar backups diarios a las 2 AM:

```bash
# Editar crontab
crontab -e

# Agregar línea (ajusta la ruta)
0 2 * * * /ruta/completa/al/proyecto/deployment/backup-db.sh >> /var/log/sgi-sena-backup.log 2>&1
```

#### Restaurar Backup

```bash
# Descomprimir y restaurar
gunzip < backups/backup_GestionEquipo_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i sge-sena-db mysql -u sge_user -pGestionEquipo
```

### Actualizar Aplicación

```bash
./deployment/update.sh
```

Este script:
- Realiza backup automático
- Detiene servicios
- Construye nuevas imágenes
- Levanta servicios actualizados
- Verifica salud

### Monitoreo

#### Ver uso de recursos

```bash
# Uso de CPU y memoria
docker stats

# Espacio en disco
df -h
docker system df
```

#### Logs del sistema

```bash
# Logs de Docker
journalctl -u docker

# Logs de nginx (dentro del contenedor)
docker exec sge-sena-frontend tail -f /var/log/nginx/access.log
docker exec sge-sena-frontend tail -f /var/log/nginx/error.log
```

## Preparación para Dominio

Cuando tengas un dominio, sigue estos pasos:

### 1. Actualizar Variables de Entorno

Edita `.env`:

```env
# Cambiar de IP a dominio
CORS_ORIGIN=https://tudominio.com,https://www.tudominio.com
FRONTEND_URL=https://tudominio.com
```

### 2. Configurar DNS

En tu proveedor de DNS, crea registros A apuntando a tu IP pública:
- `tudominio.com` → `TU_IP_PUBLICA`
- `www.tudominio.com` → `TU_IP_PUBLICA`

### 3. Instalar Certificado SSL (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado (si usas nginx en el host)
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# O usar certbot con Docker (recomendado)
# Ver: https://certbot.eff.org/instructions
```

### 4. Configurar Nginx para SSL

Si usas nginx en el host (no en Docker), configura SSL. Si usas Docker, considera usar un proxy reverso como Traefik o Nginx Proxy Manager.

### 5. Actualizar Firewall

El puerto 443 ya está abierto. Verifica:

```bash
sudo ufw status
```

### 6. Reiniciar Servicios

```bash
docker-compose down
docker-compose up -d
```

## Troubleshooting

### Los servicios no inician

1. **Verificar logs**:

```bash
docker-compose logs
```

2. **Verificar variables de entorno**:

```bash
cat .env | grep -v PASSWORD
```

3. **Verificar puertos**:

```bash
sudo netstat -tulpn | grep -E '80|3000|3306'
```

### Error de conexión a base de datos

1. **Verificar que MySQL esté corriendo**:

```bash
docker ps | grep db
docker-compose logs db
```

### Error 1033 del Túnel Cloudflare

El error 1033 generalmente ocurre cuando:

1. **El túnel se reinició y cambió de URL** (quick tunnels temporales):
   ```bash
   # Obtener la URL actual del túnel
   ./deployment/get-tunnel-url.sh
   ```
   
   Los "quick tunnels" de Cloudflare generan una nueva URL cada vez que se reinicia el servicio. Usa la nueva URL mostrada por el script.

2. **El servicio cloudflared no está corriendo**:
   ```bash
   # Verificar estado
   systemctl status cloudflared.service
   
   # Iniciar si está detenido
   sudo systemctl start cloudflared.service
   
   # Habilitar inicio automático (si no está habilitado)
   sudo systemctl enable cloudflared.service
   ```

3. **La aplicación no está respondiendo en localhost:80**:
   ```bash
   # Verificar que la aplicación esté corriendo
   curl -I http://localhost:80
   
   # Verificar contenedores Docker
   docker ps
   
   # Si no están corriendo, iniciarlos
   docker-compose up -d
   ```

4. **Ver logs del túnel**:
   ```bash
   # Ver logs en tiempo real
   tail -f /home/medialab/cloudflared.log
   
   # Ver últimos 50 líneas
   tail -50 /home/medialab/cloudflared.log
   ```

**Solución Permanente**: Para evitar que la URL cambie, configura un túnel nombrado permanente con Cloudflare. Esto requiere:
- Una cuenta de Cloudflare
- Configurar el túnel con un nombre fijo
- Actualizar el servicio systemd para usar el túnel nombrado

Consulta la documentación oficial: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps

2. **Verificar credenciales en .env**:

```bash
grep DB_ .env
```

3. **Probar conexión manual**:

```bash
docker exec -it sge-sena-db mysql -u sge_user -p
```

### Frontend no carga

1. **Verificar que frontend esté corriendo**:

```bash
docker ps | grep frontend
curl http://localhost
```

2. **Verificar logs de nginx**:

```bash
docker-compose logs frontend
```

3. **Verificar firewall**:

```bash
sudo ufw status
```

### Error de CORS

1. **Verificar CORS_ORIGIN en .env**:

```bash
grep CORS_ORIGIN .env
```

2. **Asegúrate de usar la IP pública correcta o el dominio**

3. **Reiniciar backend**:

```bash
docker-compose restart backend
```

### Problemas de permisos

```bash
# Verificar permisos de uploads
ls -la backend/uploads/

# Corregir permisos si es necesario
sudo chown -R $USER:$USER backend/uploads
chmod -R 755 backend/uploads
```

### Limpiar y empezar de nuevo

```bash
# Detener y eliminar contenedores
docker-compose down

# Eliminar volúmenes (¡CUIDADO! Esto borra la BD)
docker-compose down -v

# Limpiar imágenes
docker system prune -a

# Volver a desplegar
./deployment/deploy.sh
```

## Seguridad

### Buenas Prácticas

1. **Cambiar passwords por defecto**: Asegúrate de cambiar todos los passwords en `.env`
2. **No exponer puertos innecesarios**: MySQL y Backend solo deben ser accesibles internamente
3. **Mantener actualizado**: Actualiza el sistema y Docker regularmente
4. **Backups regulares**: Programa backups automáticos
5. **Monitoreo**: Revisa logs regularmente
6. **Firewall**: Mantén el firewall activo y configurado
7. **SSL**: Usa HTTPS cuando tengas dominio

### Rotación de Secrets

Para rotar JWT_SECRET o COOKIE_SECRET:

1. Genera nuevos secrets:

```bash
openssl rand -base64 32
```

2. Actualiza `.env`
3. Reinicia servicios:

```bash
docker-compose restart backend
```

**Nota**: Los usuarios tendrán que iniciar sesión nuevamente.

## Soporte

Para problemas o preguntas:

1. Revisa los logs: `docker-compose logs`
2. Verifica la documentación del proyecto
3. Consulta los issues en el repositorio

## Resumen de Comandos Rápidos

```bash
# Configuración inicial
sudo ./deployment/setup-server.sh
./deployment/get-ip.sh
./deployment/setup-env.sh

# Despliegue
./deployment/deploy.sh

# Gestión
docker-compose ps                    # Estado
docker-compose logs -f               # Logs
docker-compose restart               # Reiniciar
./deployment/backup-db.sh            # Backup
./deployment/update.sh               # Actualizar
```

---

**Última actualización**: Enero 2026
