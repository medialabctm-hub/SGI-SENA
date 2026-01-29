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

# Preferir Docker Compose V2 (plugin); V1 falla en Python 3.12 por distutils
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null && docker-compose --version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
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

# Restaurar COMPOSE_CMD por si .env definió C u otra variable que rompa $COMPOSE_CMD
if docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

# Generar config Nginx del proxy (HTTP) si existe DOMAIN o usar _ por defecto
NGINX_CONF="$SCRIPT_DIR/nginx/conf/default.conf"
NGINX_HTTP_TEMPLATE="$SCRIPT_DIR/nginx/default-http.conf.template"
if [ -f "$NGINX_HTTP_TEMPLATE" ]; then
  mkdir -p "$(dirname "$NGINX_CONF")"
  export DOMAIN="${DOMAIN:-_}"
  TMP_CONF=$(mktemp)
  if envsubst '$DOMAIN' < "$NGINX_HTTP_TEMPLATE" > "$TMP_CONF" 2>/dev/null; then
    mv "$TMP_CONF" "$NGINX_CONF"
  else
    sed "s/\$DOMAIN/${DOMAIN}/g" < "$NGINX_HTTP_TEMPLATE" > "$TMP_CONF"
    mv "$TMP_CONF" "$NGINX_CONF"
  fi
  print_success "Config Nginx proxy generada (dominio: ${DOMAIN})"
fi

# Obtener IP pública para mostrar
if [ -f "/tmp/sgi-sena-public-ip.txt" ]; then
    PUBLIC_IP=$(cat /tmp/sgi-sena-public-ip.txt)
else
    PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || echo "NO_DETECTADA")
fi

# Detener contenedores existentes si hay
print_info "Deteniendo contenedores existentes (si hay)..."
$COMPOSE_CMD down 2>/dev/null || true

# Workaround: crear cadena iptables si no existe (Docker con nftables en algunos sistemas)
if ! sudo iptables -t filter -L DOCKER-ISOLATION-STAGE-2 &>/dev/null; then
  print_info "Creando cadena iptables DOCKER-ISOLATION-STAGE-2 (workaround para nftables)..."
  sudo iptables -t filter -N DOCKER-ISOLATION-STAGE-2 2>/dev/null || true
fi

# Construir imágenes
print_header "Construyendo imágenes Docker"
$COMPOSE_CMD build --no-cache

print_success "Imágenes construidas"

# Levantar servicios
print_header "Iniciando servicios"
$COMPOSE_CMD up -d

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
        # Usar filtros de Docker; grep falla porque en "docker ps" STATUS va antes que NAMES
        if [ -n "$(docker ps -q --filter "name=^${service}$" --filter "status=running")" ]; then
            local health
            health=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "none")
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

if check_service "sge-sena-proxy"; then
    print_success "Proxy Nginx está corriendo"
else
    print_error "Proxy no está respondiendo correctamente"
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

if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "_" ]; then
  echo -e "HTTPS:    ${BLUE}https://$DOMAIN${NC}"
  echo -e "HTTP:     ${BLUE}http://$DOMAIN${NC}"
  echo ""
  echo "Si aún no tienes SSL: ./deployment/setup-ssl.sh"
  echo ""
  print_info "Si pruebas desde esta misma máquina y el dominio no carga (página en blanco), el router puede no hacer NAT loopback. Añade en /etc/hosts:"
  echo -e "  ${BLUE}127.0.0.1 $DOMAIN${NC}"
else
  echo -e "Frontend: ${BLUE}http://$PUBLIC_IP${NC}"
  echo -e "API:      ${BLUE}http://$PUBLIC_IP/api${NC}"
fi
echo -e "Health:   ${BLUE}http://localhost/health${NC}"
echo ""

# Mostrar estado de contenedores
print_header "Estado de Contenedores"
$COMPOSE_CMD ps

echo ""
print_success "Despliegue completado"
echo ""
print_info "Para ver logs: $COMPOSE_CMD logs -f"
print_info "Para detener: $COMPOSE_CMD down"
print_info "Para reiniciar: $COMPOSE_CMD restart"
echo ""
