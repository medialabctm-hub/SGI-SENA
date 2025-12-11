-- Script para agregar la columna nombre_usuario a la tabla Historial_Uso_Equipos
-- Ejecutar este script si la tabla ya existe y necesita actualizarse

ALTER TABLE Historial_Uso_Equipos 
ADD COLUMN IF NOT EXISTS nombre_usuario VARCHAR(100) NULL 
COMMENT 'Nombre del usuario en el momento del registro (por si cambia después)' 
AFTER id_usuario;

