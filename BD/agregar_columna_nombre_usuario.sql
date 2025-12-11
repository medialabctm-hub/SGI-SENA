-- Script para agregar la columna nombre_usuario a la tabla Historial_Uso_Equipos
-- Ejecutar este script en la base de datos de producción

-- Verificar si la columna ya existe antes de agregarla
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'Historial_Uso_Equipos' 
  AND COLUMN_NAME = 'nombre_usuario'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE Historial_Uso_Equipos 
   ADD COLUMN nombre_usuario VARCHAR(100) NULL 
   COMMENT ''Nombre del usuario en el momento del registro (por si cambia después)'' 
   AFTER id_usuario',
  'SELECT ''La columna nombre_usuario ya existe'' AS mensaje'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

