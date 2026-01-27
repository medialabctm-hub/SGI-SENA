#!/bin/bash
# Script para realizar backup de la base de datos MySQL
# Puede ejecutarse manualmente o programarse con cron

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
BACKUP_DIR="$PROJECT_ROOT/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Verificar Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado"
    exit 1
fi

# Verificar archivo .env
if [ ! -f "$ENV_FILE" ]; then
    print_error "No se encontró archivo .env"
    exit 1
fi

# Cargar variables de entorno
source "$ENV_FILE" 2>/dev/null || true

# Valores por defecto
DB_HOST=${DB_HOST:-db}
DB_USER=${DB_USER:-sge_user}
DB_PASSWORD=${DB_PASSWORD:-}
DB_NAME=${DB_NAME:-GestionEquipo}
CONTAINER_NAME=${CONTAINER_NAME:-sge-sena-db}

# Crear directorio de backups
mkdir -p "$BACKUP_DIR"
print_success "Directorio de backups: $BACKUP_DIR"

# Nombre del archivo de backup
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_${DATE}.sql"
BACKUP_FILE_COMPRESSED="${BACKUP_FILE}.gz"

echo ""
echo "=========================================="
echo "Backup de Base de Datos"
echo "=========================================="
echo ""
print_info "Base de datos: $DB_NAME"
print_info "Contenedor: $CONTAINER_NAME"
print_info "Archivo: $BACKUP_FILE_COMPRESSED"
echo ""

# Verificar que el contenedor esté corriendo
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    print_error "El contenedor $CONTAINER_NAME no está corriendo"
    exit 1
fi

# Realizar backup
print_info "Realizando backup..."
if docker exec "$CONTAINER_NAME" mysqldump \
    -u"$DB_USER" \
    -p"$DB_PASSWORD" \
    "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null; then
    print_success "Backup SQL creado"
else
    print_error "Error al crear backup"
    exit 1
fi

# Comprimir backup
print_info "Comprimiendo backup..."
if gzip "$BACKUP_FILE"; then
    print_success "Backup comprimido: $BACKUP_FILE_COMPRESSED"
else
    print_error "Error al comprimir backup"
    exit 1
fi

# Obtener tamaño del archivo
BACKUP_SIZE=$(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)
print_info "Tamaño del backup: $BACKUP_SIZE"

# Limpiar backups antiguos (mantener solo los últimos 30 días)
print_info "Limpiando backups antiguos (más de 30 días)..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete 2>/dev/null || true
print_success "Backups antiguos eliminados"

# Mostrar backups disponibles
echo ""
echo "Backups disponibles:"
ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -5 || echo "  (ninguno)"

echo ""
print_success "Backup completado: $BACKUP_FILE_COMPRESSED"
echo ""

# Opción para restaurar
echo "Para restaurar este backup:"
echo "  gunzip < $BACKUP_FILE_COMPRESSED | docker exec -i $CONTAINER_NAME mysql -u$DB_USER -p$DB_PASSWORD $DB_NAME"
echo ""
