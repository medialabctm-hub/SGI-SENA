USE GestionEquipo;

-- Verificar si la columna ya existe antes de agregarla
SET @dbname = DATABASE();
SET @tablename = "Elementos";
SET @columnname = "fecha_proximo_mantenimiento";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE 
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 'La columna fecha_proximo_mantenimiento ya existe en Elementos' AS mensaje;",
  "ALTER TABLE Elementos ADD COLUMN fecha_proximo_mantenimiento DATE NULL COMMENT 'Fecha programada para el próximo mantenimiento del equipo' AFTER vida_util_meses;"
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Verificación final
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✓ Columna fecha_proximo_mantenimiento existe en la tabla Elementos'
    ELSE '✗ Error: La columna no se pudo agregar'
  END AS resultado
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = DATABASE()
  AND table_name = 'Elementos'
  AND column_name = 'fecha_proximo_mantenimiento';
