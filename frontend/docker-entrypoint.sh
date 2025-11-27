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
  echo "ℹ Usando configuración por defecto de nginx.conf (http://backend:3000)"
fi

# Iniciar nginx
echo "🚀 Iniciando nginx..."
exec nginx -g "daemon off;"

