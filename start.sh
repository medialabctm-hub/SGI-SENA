#!/bin/sh
# Script de inicio para ejecutar backend y nginx en la misma instancia

# Verificar que los archivos del frontend existan
echo "📁 Verificando archivos del frontend..."
if [ ! -f /usr/share/nginx/html/index.html ]; then
  echo "❌ ERROR: No se encontró index.html en /usr/share/nginx/html"
  echo "📂 Contenido de /usr/share/nginx/html:"
  ls -la /usr/share/nginx/html/ || echo "Directorio no existe"
  exit 1
fi
echo "✓ Archivos del frontend encontrados"
echo "📂 Archivos en /usr/share/nginx/html:"
ls -la /usr/share/nginx/html/ | head -10

# Configurar puertos
# Railway asigna un puerto dinámico (ej: 8080) en PORT para el proceso público.
# NGINX_PORT permite una sobreescritura explícita en entornos locales; si no está
# definido, usa el PORT que Railway inyectó. BACKEND_PORT queda separado para
# que Node nunca tenga que apropiarse del puerto público.
NGINX_PORT=${NGINX_PORT:-${PORT:-80}}
BACKEND_PORT=${BACKEND_PORT:-3000}

is_valid_port() {
  case "$1" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$1" -ge 1 ] 2>/dev/null && [ "$1" -le 65535 ] 2>/dev/null
}

if ! is_valid_port "$NGINX_PORT" || ! is_valid_port "$BACKEND_PORT"; then
  echo "❌ ERROR: NGINX_PORT y BACKEND_PORT deben ser puertos numéricos entre 1 y 65535"
  exit 1
fi

if [ "$NGINX_PORT" = "$BACKEND_PORT" ]; then
  echo "❌ ERROR: NGINX_PORT y BACKEND_PORT deben ser distintos"
  exit 1
fi

echo "🔧 Configurando puertos:"
echo "  - Nginx escuchará en puerto $NGINX_PORT (asignado por Railway)"
echo "  - Backend correrá en puerto $BACKEND_PORT (interno)"

# Exportar solo los nombres internos que consumen nginx y Node. PORT se deja
# intacto para que Railway y cualquier healthcheck externo sigan usando el
# puerto público asignado.
export NGINX_PORT BACKEND_PORT

# Configurar nginx para escuchar en el puerto que Railway asigna
echo "🔧 Configurando nginx para escuchar en puerto $NGINX_PORT"
sed -i -E "s|^[[:space:]]*listen[[:space:]]+[0-9]+;|    listen $NGINX_PORT;|" /etc/nginx/conf.d/default.conf

# Configurar la URL del backend para nginx
# El backend corre en 127.0.0.1:$BACKEND_PORT en el mismo contenedor
# Usar 127.0.0.1 en lugar de localhost para evitar problemas de resolución DNS
sed -i -E "s|^[[:space:]]*set[[:space:]]+[^[:space:]]*api_backend[[:space:]]+.*;|    set \$api_backend http://127.0.0.1:$BACKEND_PORT;|" /etc/nginx/conf.d/default.conf
echo "ℹ Configurado nginx para usar backend local: http://127.0.0.1:$BACKEND_PORT"

# Iniciar backend con watchdog de reinicio (MDL-190 / H-02).
# Si Node muere por una excepción no capturada, nginx seguiría vivo vía `exec`
# y Railway no reiniciaría el contenedor → 502 sostenido. Este bucle relanza
# el backend sin tocar PORT (contrato MDL-134: PORT se deja intacto).
echo "🚀 Iniciando backend (watchdog ON_FAILURE)..."
cd /app/backend

(
  BACKEND_RESTARTS=0
  while true; do
    node server.js > /proc/1/fd/1 2>&1
    EXIT_CODE=$?
    BACKEND_RESTARTS=$((BACKEND_RESTARTS + 1))
    echo "⚠️  Backend terminó con código $EXIT_CODE (reinicio #$BACKEND_RESTARTS en 2s)"
    sleep 2
  done
) &
BACKEND_WATCHDOG_PID=$!
BACKEND_PID=$BACKEND_WATCHDOG_PID

# Esperar un momento para que el backend inicie (reducido de 5 a 2 segundos)
sleep 2

# Verificar que el watchdog (y por tanto el intento de arranque) siga vivo
if ! kill -0 $BACKEND_WATCHDOG_PID 2>/dev/null; then
  echo "❌ Error: El backend no pudo iniciar"
  exit 1
fi

echo "✓ Backend watchdog iniciado (PID: $BACKEND_WATCHDOG_PID)"

# Verificar que el backend responda antes de iniciar nginx
echo "🔍 Verificando que el backend responda en 127.0.0.1:$BACKEND_PORT..."
for i in 1 2 3 4 5; do
  if wget --quiet --tries=1 --spider http://127.0.0.1:$BACKEND_PORT/health 2>/dev/null; then
    echo "✓ Backend respondiendo correctamente en puerto $BACKEND_PORT"
    break
  fi
  if [ $i -eq 5 ]; then
    echo "⚠️  Advertencia: Backend no responde aún, pero continuando..."
  else
    echo "⏳ Esperando respuesta del backend... (intento $i/5)"
    sleep 1
  fi
done

# Función para manejar señales y cerrar ambos procesos
cleanup() {
  echo "🛑 Deteniendo servicios..."
  # Matar el grupo del watchdog y cualquier node hijo
  if [ -n "${BACKEND_WATCHDOG_PID:-}" ]; then
    kill "$BACKEND_WATCHDOG_PID" 2>/dev/null
    pkill -P "$BACKEND_WATCHDOG_PID" 2>/dev/null || true
  fi
  kill ${BACKEND_PID:-} 2>/dev/null || true
  pkill -f "node server.js" 2>/dev/null || true
  nginx -s quit
  exit 0
}

trap cleanup SIGTERM SIGINT

# Verificar configuración de nginx antes de iniciar
echo "🔍 Verificando configuración de nginx..."
nginx -t
if [ $? -ne 0 ]; then
  echo "❌ ERROR: Configuración de nginx inválida"
  exit 1
fi
echo "✓ Configuración de nginx válida"

# Verificar que el puerto de nginx esté disponible
echo "🔍 Verificando puerto $NGINX_PORT..."
if netstat -tuln 2>/dev/null | grep -q ":$NGINX_PORT "; then
  echo "⚠️  Advertencia: Puerto $NGINX_PORT ya está en uso"
  echo "📋 Procesos usando el puerto:"
  netstat -tulnp 2>/dev/null | grep ":$NGINX_PORT " || echo "No se pudo obtener información"
else
  echo "✓ Puerto $NGINX_PORT disponible"
fi

# Iniciar nginx en primer plano
# Nota: daemon off ya está en nginx.conf, NO lo especificamos aquí para evitar duplicación
echo "🚀 Iniciando nginx en puerto $NGINX_PORT..."
echo "ℹ Nginx servirá el frontend en / y hará proxy de /api al backend en 127.0.0.1:$BACKEND_PORT"
echo "ℹ Si nginx falla, los logs estarán en /var/log/nginx/error.log"

# Iniciar nginx en primer plano
# Usar exec para que nginx reemplace este proceso y Railway pueda monitorearlo
# Con daemon off en nginx.conf, nginx se quedará en primer plano
exec nginx
