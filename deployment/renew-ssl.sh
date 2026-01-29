#!/bin/bash
# Renueva certificado Let's Encrypt (webroot) y recarga Nginx
# Para renovación automática: crontab -e → 0 3 * * * cd /ruta/SGI-SENA && ./deployment/renew-ssl.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

[ -f "$ENV_FILE" ] && source "$ENV_FILE" 2>/dev/null || true

if [ -z "$DOMAIN" ]; then
    echo "DOMAIN no definido en .env"
    exit 1
fi

cd "$PROJECT_ROOT"

if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

PROJECT_NAME=$(basename "$(realpath "$PROJECT_ROOT")" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-]//g')
VOLUME_CONF="${PROJECT_NAME}_certbot_conf"
VOLUME_WWW="${PROJECT_NAME}_certbot_www"

# Renovar con webroot (proxy debe estar corriendo y sirviendo /.well-known)
docker run --rm \
  -v "${VOLUME_CONF}:/etc/letsencrypt" \
  -v "${VOLUME_WWW}:/var/www/certbot" \
  certbot/certbot renew --webroot -w /var/www/certbot --quiet

# Recargar Nginx para usar el certificado renovado
$COMPOSE_CMD exec -T proxy nginx -s reload 2>/dev/null || true
