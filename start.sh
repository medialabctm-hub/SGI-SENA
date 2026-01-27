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
# Railway asigna un puerto dinámico (ej: 8080) en la variable PORT
# Nginx debe escuchar en ese puerto (el que Railway expone)
# El backend debe usar siempre el puerto 3000 (interno, no expuesto)
NGINX_PORT=${PORT:-80}
BACKEND_PORT=3000

echo "🔧 Configurando puertos:"
echo "  - Nginx escuchará en puerto $NGINX_PORT (asignado por Railway)"
echo "  - Backend correrá en puerto $BACKEND_PORT (interno)"

# Forzar que el backend use el puerto 3000 (no el PORT de Railway)
# Railway asigna PORT para el servicio principal (nginx), no para el backend interno
export BACKEND_PORT=$BACKEND_PORT
export PORT=$BACKEND_PORT

# Configurar nginx para escuchar en el puerto que Railway asigna
echo "🔧 Configurando nginx para escuchar en puerto $NGINX_PORT"
sed -i "s|listen 80;|listen $NGINX_PORT;|g" /etc/nginx/conf.d/default.conf

# Configurar la URL del backend para nginx
# El backend corre en 127.0.0.1:3000 en el mismo contenedor
# Usar 127.0.0.1 en lugar de localhost para evitar problemas de resolución DNS
sed -i "s|set \$api_backend.*|set \$api_backend http://127.0.0.1:$BACKEND_PORT;|g" /etc/nginx/conf.d/default.conf
echo "ℹ Configurado nginx para usar backend local: http://127.0.0.1:$BACKEND_PORT"

# Iniciar backend en segundo plano pero redirigir logs a stdout
echo "🚀 Iniciando backend..."
cd /app/backend
node server.js > /proc/1/fd/1 2>&1 &
BACKEND_PID=$!

# Esperar un momento para que el backend inicie (reducido de 5 a 2 segundos)
sleep 2

# Verificar que el backend esté corriendo
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "❌ Error: El backend no pudo iniciar"
  exit 1
fi

echo "✓ Backend iniciado (PID: $BACKEND_PID)"

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
  kill $BACKEND_PID 2>/dev/null
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

