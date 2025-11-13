-- Migración: Agregar columnas faltantes a la tabla Usuarios
-- Este script agrega las columnas que faltan según el esquema definido en GestionEquipo.sql
-- Si alguna columna ya existe, el comando dará un error pero no afectará la base de datos

USE GestionEquipo;

-- Agregar columna area_usuarios
-- Si la columna ya existe, este comando dará un error pero no afectará la base de datos
ALTER TABLE Usuarios 
ADD COLUMN area_usuarios VARCHAR(150) NULL 
AFTER correo;

-- Agregar columna contrasena
-- NOTA: Si ya tienes usuarios, necesitarás actualizar sus contraseñas después de agregar esta columna
-- Si la columna ya existe, este comando dará un error pero no afectará la base de datos
ALTER TABLE Usuarios 
ADD COLUMN contrasena VARCHAR(255) NULL 
AFTER area_usuarios;

-- Si necesitas que contrasena sea NOT NULL después de agregarla,
-- primero actualiza los valores NULL y luego modifica la columna:
-- UPDATE Usuarios SET contrasena = '' WHERE contrasena IS NULL;
-- ALTER TABLE Usuarios MODIFY COLUMN contrasena VARCHAR(255) NOT NULL;

