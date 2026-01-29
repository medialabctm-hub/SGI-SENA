#!/bin/bash
# Script para actualizar la aplicación en producción
# Realiza backup antes de actualizar y despliega nueva versión

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
    echo ""
}

cd "$PROJECT_ROOT"

# Preferir Docker Compose V2 (plugin); V1 falla en Python 3.12 por distutils
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null && docker-compose --version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    print_error "Docker Compose no está instalado."
    exit 1
fi

print_header "Actualización de SGI-SENA"

# Verificar que hay cambios en git (opcional)
if [ -d ".git" ]; then
    print_info "Verificando cambios en el repositorio..."
    if git diff --quiet && git diff --cached --quiet; then
        print_info "No hay cambios pendientes en git"
    else
        print_info "Hay cambios pendientes en git"
    fi
fi

# Confirmar actualización
echo "¿Deseas continuar con la actualización? (s/n)"
read -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[Ss]$ ]]; then
    print_info "Actualización cancelada"
    exit 0
fi

# Realizar backup de base de datos
print_header "Realizando backup de base de datos"
if [ -f "$SCRIPT_DIR/backup-db.sh" ]; then
    bash "$SCRIPT_DIR/backup-db.sh"
    print_success "Backup completado"
else
    print_error "Script de backup no encontrado"
    echo "¿Deseas continuar sin backup? (s/n)"
    read -r CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

# Detener servicios
print_header "Deteniendo servicios"
$COMPOSE_CMD down
print_success "Servicios detenidos"

# Limpiar imágenes antiguas (opcional)
print_info "¿Deseas limpiar imágenes Docker antiguas? (s/n)"
read -r CLEAN
if [[ "$CLEAN" =~ ^[Ss]$ ]]; then
    print_info "Limpiando imágenes no utilizadas..."
    docker image prune -f
    print_success "Imágenes limpiadas"
fi

# Construir nuevas imágenes
print_header "Construyendo nuevas imágenes"
$COMPOSE_CMD build --no-cache
print_success "Imágenes construidas"

# Levantar servicios
print_header "Iniciando servicios actualizados"
$COMPOSE_CMD up -d
print_success "Servicios iniciados"

# Esperar a que los servicios estén listos
print_info "Esperando a que los servicios estén listos..."
sleep 15

# Verificar salud
print_header "Verificando salud de servicios"
if curl -f -s http://localhost/health > /dev/null 2>&1; then
    print_success "Servicios respondiendo correctamente"
else
    print_error "Los servicios no están respondiendo"
    print_info "Revisa los logs: $COMPOSE_CMD logs"
    exit 1
fi

# Mostrar estado
print_header "Estado de Contenedores"
$COMPOSE_CMD ps

echo ""
print_success "Actualización completada"
echo ""
print_info "Para ver logs: $COMPOSE_CMD logs -f"
echo ""
