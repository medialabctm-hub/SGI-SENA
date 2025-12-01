# Dockerfile principal para desplegar backend y frontend en la misma instancia
# Este Dockerfile construye ambos servicios y los ejecuta juntos

# ============================================
# ETAPA 1: Construir Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copiar y instalar dependencias del frontend
COPY frontend/package*.json ./
RUN npm ci

# Copiar código del frontend y construir
COPY frontend/ ./
RUN npm run build

# ============================================
# ETAPA 2: Construir Backend
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Copiar y instalar dependencias del backend
COPY backend/package*.json ./
RUN npm ci --only=production

# Copiar código del backend
COPY backend/ ./

# ============================================
# ETAPA 3: Imagen final con Nginx y Node
# ============================================
FROM nginx:alpine

# Instalar Node.js para ejecutar el backend
RUN apk add --no-cache nodejs npm gettext

# Crear directorios necesarios
RUN mkdir -p /app/backend /app/frontend/dist /app/uploads/equipos

# Copiar frontend construido
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copiar backend
COPY --from=backend-builder /app/backend /app/backend

# Copiar configuración principal de nginx (reemplaza /etc/nginx/nginx.conf)
COPY frontend/nginx-main.conf /etc/nginx/nginx.conf

# Copiar configuración del servidor virtual
COPY frontend/nginx-server.conf /etc/nginx/conf.d/default.conf

# Copiar script de inicio
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Crear directorio para uploads
RUN mkdir -p /app/backend/uploads/equipos

# Exponer puerto (Railway asignará un puerto dinámico via variable PORT)
EXPOSE 80
# Nota: Railway asignará un puerto (ej: 8080) y lo pasará como variable PORT
# El script start.sh configurará nginx para escuchar en ese puerto

# Health check - verifica que nginx esté sirviendo y el backend responda
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Usar script de inicio
CMD ["/start.sh"]

