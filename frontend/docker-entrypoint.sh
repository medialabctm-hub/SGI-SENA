#!/bin/sh
# Script de entrada para el contenedor frontend
# Permite configurar la URL del backend mediante variable de entorno

# proxy_pass usa una variable ($api_backend), así que nginx necesita un "resolver" explícito
# para resolver el host en cada request (Docker Compose usa 127.0.0.11; otras plataformas
# pueden usar otro). Se detecta dinámicamente del propio /etc/resolv.conf del contenedor
# para no depender de una IP fija que solo es válida en un entorno.
RESOLVER_IP=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)
if [ -n "$RESOLVER_IP" ]; then
  sed -i "s|resolver .*;|resolver $RESOLVER_IP valid=10s ipv6=off;|g" /etc/nginx/conf.d/default.conf
  echo "✓ Configurado resolver de nginx: $RESOLVER_IP"
else
  echo "⚠ No se pudo detectar un nameserver en /etc/resolv.conf; se mantiene el resolver por defecto"
fi

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

