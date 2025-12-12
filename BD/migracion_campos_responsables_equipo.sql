-- Migración: Agregar campos adicionales a Responsables_Equipo
-- Para almacenar información de registros externos (ficha, nombre, documento)
-- Fecha: 2024-01-15

-- Verificar y agregar columna 'ficha' si no existe
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Responsables_Equipo' 
    AND COLUMN_NAME = 'ficha'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE Responsables_Equipo ADD COLUMN ficha VARCHAR(50) NULL COMMENT ''Número de ficha del aprendiz (registro externo)'' AFTER observaciones',
    'SELECT ''Columna ficha ya existe'' AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar y agregar columna 'nombre_externo' si no existe
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Responsables_Equipo' 
    AND COLUMN_NAME = 'nombre_externo'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE Responsables_Equipo ADD COLUMN nombre_externo VARCHAR(200) NULL COMMENT ''Nombre completo del usuario (registro externo)'' AFTER ficha',
    'SELECT ''Columna nombre_externo ya existe'' AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar y agregar columna 'documento_externo' si no existe
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Responsables_Equipo' 
    AND COLUMN_NAME = 'documento_externo'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE Responsables_Equipo ADD COLUMN documento_externo VARCHAR(20) NULL COMMENT ''Documento de identificación (registro externo)'' AFTER nombre_externo',
    'SELECT ''Columna documento_externo ya existe'' AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar índices para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_ficha ON Responsables_Equipo(ficha);
CREATE INDEX IF NOT EXISTS idx_documento_externo ON Responsables_Equipo(documento_externo);

