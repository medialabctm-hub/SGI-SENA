#!/bin/bash
# Script para obtener la IP pública del servidor
# Verifica conectividad externa y muestra información de red

set -e

echo "=========================================="
echo "Obtención de IP Pública del Servidor"
echo "=========================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función para obtener IP pública
get_public_ip() {
    echo "🔍 Obteniendo IP pública..."
    
    # Intentar múltiples servicios
    IP1=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null)
    IP2=$(curl -s --max-time 5 https://ifconfig.me 2>/dev/null)
    IP3=$(curl -s --max-time 5 https://icanhazip.com 2>/dev/null)
    
    # Usar la primera que funcione
    if [ -n "$IP1" ] && [[ $IP1 =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$IP1"
    elif [ -n "$IP2" ] && [[ $IP2 =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$IP2"
    elif [ -n "$IP3" ] && [[ $IP3 =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$IP3"
    else
        echo ""
    fi
}

# Obtener IP pública
PUBLIC_IP=$(get_public_ip)

if [ -z "$PUBLIC_IP" ]; then
    echo "❌ Error: No se pudo obtener la IP pública"
    echo "   Verifica que el servidor tenga conexión a internet"
    exit 1
fi

# Obtener IP local
LOCAL_IP=$(hostname -I | awk '{print $1}')

# Obtener información de red
echo -e "${GREEN}✓${NC} IP Pública: ${BLUE}$PUBLIC_IP${NC}"
echo -e "${GREEN}✓${NC} IP Local: ${BLUE}$LOCAL_IP${NC}"
echo ""

# Verificar conectividad
echo "🔍 Verificando conectividad externa..."
if ping -c 1 -W 2 8.8.8.8 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Conectividad a internet: OK"
else
    echo -e "${YELLOW}⚠${NC}  Advertencia: No se pudo verificar conectividad"
fi
echo ""

# Mostrar información de puertos
echo "📋 Puertos configurados en firewall:"
if command -v ufw &> /dev/null; then
    ufw status | grep -E "80|443|22" || echo "   Firewall no configurado o sin reglas"
else
    echo "   UFW no está instalado"
fi
echo ""

# Guardar IP en archivo temporal para uso en otros scripts
IP_FILE="/tmp/sgi-sena-public-ip.txt"
echo "$PUBLIC_IP" > "$IP_FILE"
echo -e "${GREEN}✓${NC} IP pública guardada en: $IP_FILE"
echo ""

# Mostrar URLs de acceso
echo "=========================================="
echo "URLs de Acceso"
echo "=========================================="
echo -e "Frontend: ${BLUE}http://$PUBLIC_IP${NC}"
echo -e "API:      ${BLUE}http://$PUBLIC_IP/api${NC}"
echo ""
echo "⚠️  Nota: Estas URLs usarán HTTP. Para HTTPS, configura un dominio y certificado SSL."
echo ""

# Guardar en variable de entorno para este script
export PUBLIC_IP
export LOCAL_IP

echo "✅ Información de red obtenida correctamente"
echo ""
echo "Para usar esta IP en otros scripts:"
echo "  export PUBLIC_IP=$PUBLIC_IP"
echo ""
