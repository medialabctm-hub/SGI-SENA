#!/bin/bash
# Script principal de despliegue para producción
# Valida configuración, construye y levanta contenedores

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
    echo ""
}

# Verificar que se ejecute desde el directorio del proyecto
if [ ! -f "$PROJECT_ROOT/docker-compose.yml" ]; then
    print_error "No se encontró docker-compose.yml en $PROJECT_ROOT"
    exit 1
fi

cd "$PROJECT_ROOT"

print_header "Despliegue de SGI-SENA en Producción"

# Verificar Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado. Ejecuta primero: ./deployment/setup-server.sh"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose no está instalado. Ejecuta primero: ./deployment/setup-server.sh"
    exit 1
fi

print_success "Docker y Docker Compose disponibles"

# Verificar archivo .env
if [ ! -f "$ENV_FILE" ]; then
    print_error "No se encontró archivo .env"
    print_info "Ejecuta primero: ./deployment/setup-env.sh"
    exit 1
fi

print_success "Archivo .env encontrado"

# Validar variables críticas
print_info "Validando variables de entorno críticas..."

source "$ENV_FILE" 2>/dev/null || true

MISSING_VARS=()

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "CHANGE_THIS_PASSWORD_IN_PRODUCTION" ]; then
    MISSING_VARS+=("DB_PASSWORD")
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "CHANGE_THIS_JWT_SECRET_IN_PRODUCTION" ]; then
    MISSING_VARS+=("JWT_SECRET")
fi

if [ -z "$COOKIE_SECRET" ] || [ "$COOKIE_SECRET" = "CHANGE_THIS_COOKIE_SECRET_IN_PRODUCTION" ]; then
    MISSING_VARS+=("COOKIE_SECRET")
fi

if [ -z "$BREVO_API_KEY" ] || [ "$BREVO_API_KEY" = "CHANGE_THIS_BREVO_API_KEY" ]; then
    MISSING_VARS+=("BREVO_API_KEY")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    print_error "Faltan las siguientes variables críticas:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    print_info "Ejecuta: ./deployment/setup-env.sh para configurarlas"
    exit 1
fi

print_success "Variables de entorno validadas"

# Obtener IP pública para mostrar
if [ -f "/tmp/sgi-sena-public-ip.txt" ]; then
    PUBLIC_IP=$(cat /tmp/sgi-sena-public-ip.txt)
else
    PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || echo "NO_DETECTADA")
fi

# Detener contenedores existentes si hay
print_info "Deteniendo contenedores existentes (si hay)..."
docker-compose down 2>/dev/null || docker compose down 2>/dev/null || true

# Construir imágenes
print_header "Construyendo imágenes Docker"
if command -v docker-compose &> /dev/null; then
    docker-compose build --no-cache
else
    docker compose build --no-cache
fi

print_success "Imágenes construidas"

# Levantar servicios
print_header "Iniciando servicios"
if command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    docker compose up -d
fi

print_success "Servicios iniciados"

# Esperar a que los servicios estén saludables
print_info "Esperando a que los servicios estén listos..."
sleep 10

# Verificar salud de servicios
print_header "Verificando salud de servicios"

check_service() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker ps | grep -q "$service.*Up"; then
            # Verificar health check
            local health=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "none")
            if [ "$health" = "healthy" ] || [ "$health" = "none" ]; then
                return 0
            fi
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    return 1
}

if check_service "sge-sena-db"; then
    print_success "MySQL está corriendo"
else
    print_error "MySQL no está respondiendo correctamente"
fi

if check_service "sge-sena-backend"; then
    print_success "Backend está corriendo"
else
    print_error "Backend no está respondiendo correctamente"
fi

if check_service "sge-sena-frontend"; then
    print_success "Frontend está corriendo"
else
    print_error "Frontend no está respondiendo correctamente"
fi

# Verificar conectividad HTTP
print_info "Verificando conectividad HTTP..."
sleep 5

if curl -f -s http://localhost/health > /dev/null 2>&1; then
    print_success "Frontend responde correctamente"
else
    print_error "Frontend no responde en http://localhost"
fi

# Mostrar información de acceso
print_header "Información de Acceso"

echo -e "Frontend: ${BLUE}http://$PUBLIC_IP${NC}"
echo -e "API:      ${BLUE}http://$PUBLIC_IP/api${NC}"
echo -e "Health:   ${BLUE}http://$PUBLIC_IP/health${NC}"
echo ""

# Mostrar estado de contenedores
print_header "Estado de Contenedores"
if command -v docker-compose &> /dev/null; then
    docker-compose ps
else
    docker compose ps
fi

echo ""
print_success "Despliegue completado"
echo ""
print_info "Para ver logs: docker-compose logs -f"
print_info "Para detener: docker-compose down"
print_info "Para reiniciar: docker-compose restart"
echo ""
