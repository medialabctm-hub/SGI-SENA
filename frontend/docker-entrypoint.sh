#!/bin/sh
# Script de entrada para el contenedor frontend
# Permite configurar la URL del backend mediante variable de entorno

# Si se proporciona API_URL, actualizar nginx.conf
if [ -n "$API_URL" ]; then
  # Reemplazar la URL del backend en nginx.conf
  # Escapar caracteres especiales para sed
  API_URL_ESCAPED=$(echo "$API_URL" | sed 's/[[\.*^$()+?{|]/\\&/g')
  # Reemplazar solo el valor después del =, manteniendo la estructura
  sed -i "s|\(set \$api_backend \).*|\1$API_URL_ESCAPED;|g" /etc/nginx/nginx.conf
  echo "✓ Configurado API_URL: $API_URL"
else
  # En docker-compose, el backend está en la misma red Docker
  # Usar el nombre del servicio 'backend' por defecto
  DEFAULT_API_URL="http://backend:3000"
  # Reemplazar solo el valor después del =, manteniendo la estructura
  sed -i "s|\(set \$api_backend \).*|\1$DEFAULT_API_URL;|g" /etc/nginx/nginx.conf
  echo "ℹ Usando backend por defecto: $DEFAULT_API_URL"
fi

# Iniciar nginx
echo "🚀 Iniciando nginx..."
exec nginx -g "daemon off;"
