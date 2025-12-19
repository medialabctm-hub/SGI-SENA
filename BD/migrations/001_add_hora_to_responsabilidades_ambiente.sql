-- Migración: Agregar campos de hora a Responsabilidades_Ambiente
-- Descripción: Agrega campos para almacenar hora_inicio y hora_fin en las asignaciones de ambientes

-- Verificar si las columnas ya existen antes de agregarlas
ALTER TABLE Responsabilidades_Ambiente 
ADD COLUMN hora_inicio TIME NULL COMMENT 'Hora de inicio de la asignación' AFTER fecha_inicio,
ADD COLUMN hora_fin TIME NULL COMMENT 'Hora de fin de la asignación' AFTER hora_inicio;

-- Crear índice para búsquedas eficientes por fecha y horas
ALTER TABLE Responsabilidades_Ambiente 
ADD INDEX idx_fecha_horas (fecha_inicio, hora_inicio, hora_fin);

-- Crear índice para búsquedas por día de la semana
ALTER TABLE Responsabilidades_Ambiente 
ADD INDEX idx_dia_semana (dia_semana) IF NOT EXISTS;
