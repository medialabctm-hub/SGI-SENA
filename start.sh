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

# Configurar la URL del backend para nginx
# Por defecto, el backend corre en localhost:3000 en el mismo contenedor
# Actualizar la variable api_backend en la configuración del servidor
sed -i "s|set \$api_backend.*|set \$api_backend http://localhost:3000;|g" /etc/nginx/conf.d/default.conf
echo "ℹ Configurado nginx para usar backend local: http://localhost:3000"

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

# Iniciar nginx en primer plano
# Nota: daemon off ya está en nginx.conf, NO lo especificamos aquí para evitar duplicación
echo "🚀 Iniciando nginx en puerto 80..."
echo "ℹ Nginx servirá el frontend en / y hará proxy de /api al backend en localhost:3000"
exec nginx

