#!/bin/bash
# Script de configuración inicial del servidor Ubuntu para producción
# Este script instala Docker, Docker Compose, configura firewall y optimiza el sistema

set -e

echo "=========================================="
echo "Configuración de Servidor Ubuntu"
echo "Sistema de Gestión de Inventario SENA"
echo "=========================================="
echo ""

# Verificar que se ejecute como root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Error: Este script debe ejecutarse como root (usa sudo)"
    exit 1
fi

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Actualizar sistema
echo "📦 Actualizando sistema..."
apt-get update -qq
apt-get upgrade -y -qq
print_success "Sistema actualizado"

# Instalar dependencias básicas
echo "📦 Instalando dependencias básicas..."
apt-get install -y -qq \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ufw \
    git \
    wget \
    htop \
    net-tools \
    software-properties-common
print_success "Dependencias básicas instaladas"

# Instalar Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker..."
    
    # Agregar repositorio oficial de Docker
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    print_success "Docker instalado"
else
    print_info "Docker ya está instalado"
fi

# Instalar Docker Compose (standalone)
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "🐳 Instalando Docker Compose..."
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose instalado"
else
    print_info "Docker Compose ya está instalado"
fi

# Configurar usuario no-root para Docker (opcional pero recomendado)
echo "👤 Configurando acceso Docker para usuarios..."
if [ -n "$SUDO_USER" ]; then
    usermod -aG docker "$SUDO_USER"
    print_success "Usuario $SUDO_USER agregado al grupo docker"
    print_info "El usuario debe cerrar sesión y volver a entrar para aplicar cambios"
fi

# Configurar swap si no existe
echo "💾 Verificando configuración de swap..."
if [ -z "$(swapon --show)" ]; then
    print_info "No se detectó swap. Considera crear swap si el servidor tiene menos de 2GB RAM"
    print_info "Para crear swap de 2GB:"
    print_info "  sudo fallocate -l 2G /swapfile"
    print_info "  sudo chmod 600 /swapfile"
    print_info "  sudo mkswap /swapfile"
    print_info "  sudo swapon /swapfile"
    print_info "  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab"
else
    print_success "Swap configurado"
fi

# Configurar firewall UFW
echo "🔥 Configurando firewall (UFW)..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Permitir SSH (importante hacerlo primero)
ufw allow 22/tcp comment 'SSH'
print_success "Puerto 22 (SSH) abierto"

# Permitir HTTP
ufw allow 80/tcp comment 'HTTP'
print_success "Puerto 80 (HTTP) abierto"

# Permitir HTTPS (preparado para futuro)
ufw allow 443/tcp comment 'HTTPS'
print_success "Puerto 443 (HTTPS) abierto"

# NO abrir puerto 3306 externamente (solo acceso interno)
print_info "Puerto 3306 (MySQL) NO se abrirá externamente (solo acceso interno)"

# Habilitar firewall
ufw --force enable
print_success "Firewall habilitado"

# Mostrar estado del firewall
echo ""
echo "Estado del firewall:"
ufw status verbose

# Optimizaciones del sistema
echo ""
echo "⚙️  Aplicando optimizaciones del sistema..."

# Aumentar límites de archivos abiertos
cat >> /etc/security/limits.conf << EOF

# Límites para Docker y aplicaciones
* soft nofile 65536
* hard nofile 65536
EOF
print_success "Límites de archivos aumentados"

# Optimizar parámetros de red
cat >> /etc/sysctl.conf << EOF

# Optimizaciones de red para producción
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.ip_local_port_range = 10000 65535
vm.overcommit_memory = 1
EOF
sysctl -p > /dev/null 2>&1
print_success "Parámetros de red optimizados"

# Configurar Docker para iniciar al arrancar
systemctl enable docker
systemctl start docker
print_success "Docker configurado para iniciar al arrancar"

# Verificar instalación
echo ""
echo "=========================================="
echo "Verificación de instalación"
echo "=========================================="

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_success "Docker: $DOCKER_VERSION"
else
    print_error "Docker no está instalado correctamente"
fi

if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_success "Docker Compose: $COMPOSE_VERSION"
elif docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    print_success "Docker Compose: $COMPOSE_VERSION"
else
    print_error "Docker Compose no está instalado correctamente"
fi

echo ""
echo "=========================================="
echo "✅ Configuración del servidor completada"
echo "=========================================="
echo ""
echo "Próximos pasos:"
echo "1. Obtener IP pública: ./deployment/get-ip.sh"
echo "2. Configurar variables de entorno: ./deployment/setup-env.sh"
echo "3. Desplegar aplicación: ./deployment/deploy.sh"
echo ""
