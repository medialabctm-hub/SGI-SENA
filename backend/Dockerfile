# Dockerfile para Backend
FROM node:18-alpine AS builder

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el resto del código
COPY . .

# Etapa de producción
FROM node:18-alpine

WORKDIR /app

# Copiar dependencias y código desde builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Crear directorio para uploads
RUN mkdir -p uploads/equipos

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando para iniciar el servidor
CMD ["node", "server.js"]

