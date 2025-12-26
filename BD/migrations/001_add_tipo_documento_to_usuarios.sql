-- ============================================
-- MIGRACIÓN: Agregar campos tipo_documento a Usuarios
-- ============================================
-- Fecha: 2024
-- Descripción: Agrega campos para tipo de documento (TI, CC, CE, PPT, Otro)
--              y especificación cuando es "Otro"

-- Agregar columna tipo_documento
ALTER TABLE Usuarios 
ADD COLUMN tipo_documento ENUM('TI', 'CC', 'CE', 'PPT', 'Otro') DEFAULT 'CC' 
COMMENT 'Tipo de documento de identidad' 
AFTER cedula;

-- Agregar columna tipo_documento_otro
ALTER TABLE Usuarios 
ADD COLUMN tipo_documento_otro VARCHAR(50) NULL 
COMMENT 'Especificación cuando tipo_documento es "Otro"' 
AFTER tipo_documento;

-- Agregar índice para tipo_documento
ALTER TABLE Usuarios 
ADD INDEX idx_tipo_documento (tipo_documento);

-- Actualizar registros existentes con valor por defecto
UPDATE Usuarios 
SET tipo_documento = 'CC' 
WHERE tipo_documento IS NULL;

