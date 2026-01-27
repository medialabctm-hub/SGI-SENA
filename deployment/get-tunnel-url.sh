#!/bin/bash

# Script para obtener la URL actual del túnel de Cloudflare
# Uso: ./deployment/get-tunnel-url.sh

LOG_FILE="/home/medialab/cloudflared.log"

echo "=== Estado del Túnel Cloudflare ==="
echo ""

# Verificar si el servicio está corriendo
if systemctl is-active --quiet cloudflared.service; then
    echo "✓ Servicio cloudflared: ACTIVO"
else
    echo "✗ Servicio cloudflared: INACTIVO"
    echo "  Ejecuta: sudo systemctl start cloudflared.service"
    exit 1
fi

echo ""

# Obtener la URL del túnel desde los logs
TUNNEL_URL=$(grep -A 2 "quick Tunnel has been created" "$LOG_FILE" 2>/dev/null | grep "https://" | tail -1 | sed 's/.*|  //' | sed 's/  *|$//' | xargs)

if [ -n "$TUNNEL_URL" ]; then
    echo "🌐 URL del Túnel:"
    echo "   $TUNNEL_URL"
    echo ""
    echo "⚠️  NOTA: Esta URL cambia cada vez que reinicias el servicio."
    echo "   Para una URL permanente, configura un túnel nombrado."
else
    echo "⚠️  No se encontró URL del túnel en los logs."
    echo "   Revisa los logs: tail -f $LOG_FILE"
fi

echo ""
echo "=== Comandos Útiles ==="
echo "  Ver logs en tiempo real: tail -f $LOG_FILE"
echo "  Reiniciar túnel: sudo systemctl restart cloudflared.service"
echo "  Estado del servicio: systemctl status cloudflared.service"
