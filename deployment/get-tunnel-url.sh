#!/bin/bash

# Script para obtener la URL actual del túnel de Cloudflare
# Uso: ./deployment/get-tunnel-url.sh [--capture]
#   --capture, -c: reinicia el túnel y espera a que se escriba la URL en el log

LOG_FILE="/home/medialab/cloudflared.log"

# Opción --capture: reiniciar túnel para que la URL se imprima en el log
if [ "$1" = "--capture" ] || [ "$1" = "-c" ]; then
    echo "Reiniciando túnel para capturar la URL (requiere sudo)..."
    sudo systemctl restart cloudflared.service
    echo "Esperando a que el túnel arranque y escriba la URL en el log..."
    for i in 1 2 3 4 5 6 7 8 9 10; do
        sleep 1
        if grep -qE 'https://[a-zA-Z0-9][a-zA-Z0-9.-]*\.trycloudflare\.com' "$LOG_FILE" 2>/dev/null; then
            break
        fi
    done
    sleep 2
    echo ""
fi

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

# Patrón para URL trycloudflare (subdominio puede tener letras, números, guiones, punto)
URL_PATTERN='https://[a-zA-Z0-9][a-zA-Z0-9.-]*\.trycloudflare\.com'

# 1) Buscar en el archivo de log
TUNNEL_URL=$(
    grep -A 2 "quick Tunnel has been created" "$LOG_FILE" 2>/dev/null | grep -oE "$URL_PATTERN" | tail -1
)
if [ -z "$TUNNEL_URL" ]; then
    TUNNEL_URL=$(grep -oE "$URL_PATTERN" "$LOG_FILE" 2>/dev/null | tail -1)
fi

# 2) Si no está en el log, intentar endpoint de métricas (cloudflared expone la URL en algunos puertos)
if [ -z "$TUNNEL_URL" ]; then
    for port in 20241 20242 20243 20244 20245; do
        METRICS=$(curl -s --connect-timeout 1 "http://127.0.0.1:$port/metrics" 2>/dev/null)
        if [ -n "$METRICS" ]; then
            TUNNEL_URL=$(echo "$METRICS" | grep -oE "$URL_PATTERN" | head -1)
            [ -n "$TUNNEL_URL" ] && break
            # Algunas versiones exponen solo el hostname (sin https://)
            HOST=$(echo "$METRICS" | grep -oE '[a-zA-Z0-9][a-zA-Z0-9.-]*\.trycloudflare\.com' | head -1)
            if [ -n "$HOST" ]; then
                TUNNEL_URL="https://$HOST"
                break
            fi
        fi
    done
fi

# 3) Intentar journalctl (por si systemd capturó la salida)
if [ -z "$TUNNEL_URL" ]; then
    TUNNEL_URL=$(journalctl -u cloudflared.service -n 500 --no-pager -o cat 2>/dev/null | grep -oE "$URL_PATTERN" | tail -1)
fi

if [ -n "$TUNNEL_URL" ]; then
    echo "🌐 URL del Túnel:"
    echo "   $TUNNEL_URL"
    echo ""
    echo "⚠️  NOTA: Esta URL cambia cada vez que reinicias el servicio."
    echo "   Para una URL permanente, configura un túnel nombrado."
else
    echo "⚠️  No se encontró URL del túnel (ni en log, ni en métricas, ni en journalctl)."
    echo ""
    echo "   Opciones:"
    echo "   1. Reiniciar y capturar: ./deployment/get-tunnel-url.sh --capture"
    echo "   2. Obtener la URL manualmente (el túnel se detiene unos segundos):"
    echo "      sudo systemctl stop cloudflared.service"
    echo "      /usr/local/bin/cloudflared tunnel --url http://localhost:80"
    echo "      (espera a que aparezca la URL en pantalla, luego Ctrl+C)"
    echo "      sudo systemctl start cloudflared.service"
    echo "   3. Revisar log: grep -E 'https://|trycloudflare' $LOG_FILE"
fi

echo ""
echo "=== Comandos Útiles ==="
echo "  Ver logs en tiempo real: tail -f $LOG_FILE"
echo "  Reiniciar túnel: sudo systemctl restart cloudflared.service"
echo "  Estado del servicio: systemctl status cloudflared.service"
