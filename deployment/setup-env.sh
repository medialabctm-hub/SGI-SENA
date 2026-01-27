#!/bin/bash
# Script para configurar variables de entorno desde template
# Genera .env desde .env.production con valores personalizados

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/.env.production"
OUTPUT_FILE="$PROJECT_ROOT/.env"

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

print_question() {
    echo -e "${BLUE}?${NC} $1"
}

# Verificar que existe el template
if [ ! -f "$TEMPLATE_FILE" ]; then
    print_error "No se encontró el archivo template: $TEMPLATE_FILE"
    exit 1
fi

echo "=========================================="
echo "Configuración de Variables de Entorno"
echo "=========================================="
echo ""

# Obtener IP pública
print_info "Obteniendo IP pública del servidor..."
if [ -f "/tmp/sgi-sena-public-ip.txt" ]; then
    PUBLIC_IP=$(cat /tmp/sgi-sena-public-ip.txt)
    print_success "IP pública encontrada: $PUBLIC_IP"
else
    print_question "Ingresa la IP pública del servidor (o presiona Enter para detectarla automáticamente):"
    read -r USER_IP
    
    if [ -z "$USER_IP" ]; then
        # Intentar obtener automáticamente
        PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || echo "")
        if [ -z "$PUBLIC_IP" ]; then
            print_error "No se pudo obtener la IP pública automáticamente"
            print_question "Ingresa la IP pública manualmente:"
            read -r PUBLIC_IP
        else
            print_success "IP pública detectada: $PUBLIC_IP"
        fi
    else
        PUBLIC_IP="$USER_IP"
        print_success "IP pública configurada: $PUBLIC_IP"
    fi
fi

# Validar formato de IP
if ! [[ $PUBLIC_IP =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    print_error "Formato de IP inválido: $PUBLIC_IP"
    exit 1
fi

# Copiar template
cp "$TEMPLATE_FILE" "$OUTPUT_FILE"
print_success "Template copiado a .env"

# Reemplazar IP pública
sed -i "s|TU_IP_PUBLICA|$PUBLIC_IP|g" "$OUTPUT_FILE"
print_success "IP pública configurada: http://$PUBLIC_IP"

# Generar secrets si no están configurados
generate_secret() {
    openssl rand -base64 32 | tr -d '\n'
}

echo ""
print_info "Configurando secrets de seguridad..."

# JWT Secret
if grep -q "CHANGE_THIS_JWT_SECRET_IN_PRODUCTION" "$OUTPUT_FILE"; then
    JWT_SECRET=$(generate_secret)
    sed -i "s|CHANGE_THIS_JWT_SECRET_IN_PRODUCTION|$JWT_SECRET|g" "$OUTPUT_FILE"
    print_success "JWT_SECRET generado"
fi

# Cookie Secret
if grep -q "CHANGE_THIS_COOKIE_SECRET_IN_PRODUCTION" "$OUTPUT_FILE"; then
    COOKIE_SECRET=$(generate_secret)
    sed -i "s|CHANGE_THIS_COOKIE_SECRET_IN_PRODUCTION|$COOKIE_SECRET|g" "$OUTPUT_FILE"
    print_success "COOKIE_SECRET generado"
fi

# DB Password
if grep -q "CHANGE_THIS_PASSWORD_IN_PRODUCTION" "$OUTPUT_FILE"; then
    DB_PASSWORD=$(generate_secret | cut -c1-20)
    sed -i "s|CHANGE_THIS_PASSWORD_IN_PRODUCTION|$DB_PASSWORD|g" "$OUTPUT_FILE"
    print_success "DB_PASSWORD generado"
fi

# DB Root Password
if grep -q "CHANGE_THIS_ROOT_PASSWORD_IN_PRODUCTION" "$OUTPUT_FILE"; then
    DB_ROOT_PASSWORD=$(generate_secret | cut -c1-20)
    sed -i "s|CHANGE_THIS_ROOT_PASSWORD_IN_PRODUCTION|$DB_ROOT_PASSWORD|g" "$OUTPUT_FILE"
    print_success "DB_ROOT_PASSWORD generado"
fi

echo ""
print_info "Variables que DEBES configurar manualmente:"
echo ""
echo "  1. BREVO_API_KEY - Obtén en https://app.brevo.com/settings/keys/api"
echo "  2. BREVO_SENDER_EMAIL - Email verificado en Brevo"
echo ""

# Preguntar si quiere configurar Brevo ahora
print_question "¿Deseas configurar Brevo ahora? (s/n):"
read -r CONFIGURE_BREVO

if [[ "$CONFIGURE_BREVO" =~ ^[Ss]$ ]]; then
    print_question "Ingresa BREVO_API_KEY:"
    read -r BREVO_API_KEY
    if [ -n "$BREVO_API_KEY" ]; then
        sed -i "s|CHANGE_THIS_BREVO_API_KEY|$BREVO_API_KEY|g" "$OUTPUT_FILE"
        print_success "BREVO_API_KEY configurado"
    fi
    
    print_question "Ingresa BREVO_SENDER_EMAIL:"
    read -r BREVO_SENDER_EMAIL
    if [ -n "$BREVO_SENDER_EMAIL" ]; then
        sed -i "s|noreply@tudominio.com|$BREVO_SENDER_EMAIL|g" "$OUTPUT_FILE"
        print_success "BREVO_SENDER_EMAIL configurado"
    fi
fi

# Validar variables requeridas
echo ""
print_info "Validando variables requeridas..."

MISSING_VARS=()

if grep -q "CHANGE_THIS_BREVO_API_KEY" "$OUTPUT_FILE"; then
    MISSING_VARS+=("BREVO_API_KEY")
fi

if grep -q "noreply@tudominio.com" "$OUTPUT_FILE" && ! grep -q "BREVO_SENDER_EMAIL=noreply@tudominio.com" "$OUTPUT_FILE"; then
    # Verificar si el email fue cambiado
    if grep -q "BREVO_SENDER_EMAIL=noreply@tudominio.com" "$OUTPUT_FILE"; then
        MISSING_VARS+=("BREVO_SENDER_EMAIL")
    fi
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    print_error "Faltan las siguientes variables requeridas:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    print_info "Puedes editarlas manualmente en: $OUTPUT_FILE"
    echo ""
else
    print_success "Todas las variables requeridas están configuradas"
fi

# Proteger archivo .env
chmod 600 "$OUTPUT_FILE"
print_success "Permisos de .env configurados (solo lectura para propietario)"

echo ""
echo "=========================================="
echo "✅ Configuración completada"
echo "=========================================="
echo ""
echo "Archivo generado: $OUTPUT_FILE"
echo ""
echo "Próximos pasos:"
echo "1. Revisa y ajusta las variables en: $OUTPUT_FILE"
echo "2. Asegúrate de configurar BREVO_API_KEY y BREVO_SENDER_EMAIL"
echo "3. Ejecuta: ./deployment/deploy.sh"
echo ""
