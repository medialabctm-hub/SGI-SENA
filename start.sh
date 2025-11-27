#!/bin/sh
# Script de inicio para ejecutar backend y nginx en la misma instancia

# Configurar la URL del backend para nginx
# Por defecto, el backend corre en localhost:3000 en el mismo contenedor
sed -i "s|set \$api_backend.*|set \$api_backend http://localhost:3000;|g" /etc/nginx/conf.d/default.conf
echo "ℹ Configurado nginx para usar backend local: http://localhost:3000"

# Iniciar backend en segundo plano pero redirigir logs a stdout
echo "🚀 Iniciando backend..."
cd /app/backend
node server.js > /proc/1/fd/1 2>&1 &
BACKEND_PID=$!

# Esperar un momento para que el backend inicie
sleep 5

# Verificar que el backend esté corriendo
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "❌ Error: El backend no pudo iniciar"
  exit 1
fi

echo "✓ Backend iniciado (PID: $BACKEND_PID)"

# Función para manejar señales y cerrar ambos procesos
cleanup() {
  echo "🛑 Deteniendo servicios..."
  kill $BACKEND_PID 2>/dev/null
  nginx -s quit
  exit 0
}

trap cleanup SIGTERM SIGINT

# Iniciar nginx en primer plano
echo "🚀 Iniciando nginx..."
exec nginx -g "daemon off;"

