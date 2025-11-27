#!/bin/sh
# Script de entrada para el contenedor frontend
# Permite configurar la URL del backend mediante variable de entorno

# Si se proporciona API_URL, actualizar nginx.conf
if [ -n "$API_URL" ]; then
  # Reemplazar la URL del backend en nginx.conf
  # Escapar caracteres especiales para sed
  API_URL_ESCAPED=$(echo "$API_URL" | sed 's/[[\.*^$()+?{|]/\\&/g')
  sed -i "s|set \$api_backend.*|set \$api_backend $API_URL_ESCAPED;|g" /etc/nginx/conf.d/default.conf
  echo "✓ Configurado API_URL: $API_URL"
else
  # Usar el dominio de Railway por defecto
  DEFAULT_API_URL="https://sgi-sena.up.railway.app"
  sed -i "s|set \$api_backend.*|set \$api_backend $DEFAULT_API_URL;|g" /etc/nginx/conf.d/default.conf
  echo "ℹ Usando dominio por defecto de Railway: $DEFAULT_API_URL"
fi

# Iniciar nginx
echo "🚀 Iniciando nginx..."
exec nginx -g "daemon off;"

