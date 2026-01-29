#!/bin/bash
# Obtiene certificado Let's Encrypt para el dominio y activa HTTPS en el proxy Nginx
# Requiere: DOMAIN y CERTBOT_EMAIL en .env; DNS A del dominio apuntando a este servidor

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error()   { echo -e "${RED}❌${NC} $1"; }
print_info()    { echo -e "${YELLOW}ℹ${NC} $1"; }

if [ ! -f "$ENV_FILE" ]; then
    print_error "No se encontró .env. Ejecuta: ./deployment/setup-env.sh"
    exit 1
fi

source "$ENV_FILE" 2>/dev/null || true

if [ -z "$DOMAIN" ]; then
    print_error "Define DOMAIN en .env (ej: inventariosctm.medialab-sena.com)"
    exit 1
fi

CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
if [ -z "$CERTBOT_EMAIL" ]; then
    print_error "Define CERTBOT_EMAIL en .env (correo para Let's Encrypt)"
    exit 1
fi

cd "$PROJECT_ROOT"

if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

CONF_DIR="$SCRIPT_DIR/nginx/conf"
HTTP_TEMPLATE="$SCRIPT_DIR/nginx/default-http.conf.template"
SSL_TEMPLATE="$SCRIPT_DIR/nginx/default-ssl.conf.template"

mkdir -p "$CONF_DIR"

# Nombre del volumen de certificados (Docker Compose: <proyecto>_certbot_conf)
PROJECT_NAME=$(basename "$(realpath "$PROJECT_ROOT")" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]//g')
VOLUME_NAME="${PROJECT_NAME}_certbot_conf"

# 1) Config HTTP inicial para que el proxy pueda arrancar (si no existe)
if [ ! -f "$CONF_DIR/default.conf" ]; then
    print_info "Generando config Nginx (solo HTTP)..."
    export DOMAIN
    envsubst '$DOMAIN' < "$HTTP_TEMPLATE" > "$CONF_DIR/default.conf"
    print_success "Config generada"
fi

# 2) Detener solo el proxy para liberar puerto 80
print_info "Deteniendo proxy para liberar puerto 80..."
$COMPOSE_CMD stop proxy 2>/dev/null || true

# 3) Obtener certificado con Certbot (standalone)
print_info "Obteniendo certificado Let's Encrypt para $DOMAIN..."
docker run --rm \
  -v "${VOLUME_NAME}:/etc/letsencrypt" \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  -d "$DOMAIN" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  --preferred-challenges http

print_success "Certificado obtenido"

# 4) Generar config Nginx con SSL
print_info "Generando config Nginx (HTTP + HTTPS)..."
export DOMAIN
envsubst '$DOMAIN' < "$SSL_TEMPLATE" > "$CONF_DIR/default.conf"
print_success "Config SSL generada"

# 5) Levantar proxy de nuevo
print_info "Iniciando proxy con HTTPS..."
$COMPOSE_CMD up -d proxy

print_success "HTTPS configurado correctamente"
echo ""
echo -e "Acceso: ${BLUE}https://$DOMAIN${NC}"
echo ""
print_info "Renovación automática: añade a crontab -e:"
echo "  0 3 * * * cd $PROJECT_ROOT && ./deployment/renew-ssl.sh"
echo ""
