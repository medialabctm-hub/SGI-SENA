-- Migración: Agregar columna area_usuarios a la tabla Usuarios
-- Este script agrega la columna area_usuarios si no existe

USE GestionEquipo;

-- Agregar la columna area_usuarios
-- Si la columna ya existe, este comando dará un error pero no afectará la base de datos
ALTER TABLE Usuarios 
ADD COLUMN area_usuarios VARCHAR(150) NULL 
AFTER correo;

