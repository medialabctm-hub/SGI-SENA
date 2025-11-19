-- ============================================
-- TABLA DE PREFERENCIAS DE USUARIO
-- ============================================
-- Almacena las preferencias de configuración de cada usuario
-- como notificaciones, idioma, zona horaria, etc.

CREATE TABLE IF NOT EXISTS Preferencias_Usuario (
  id_preferencia INT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL UNIQUE,
  
  -- Preferencias de notificaciones
  notificaciones_email TINYINT(1) DEFAULT 1 COMMENT 'Recibir notificaciones por correo electrónico',
  notificaciones_sms TINYINT(1) DEFAULT 0 COMMENT 'Recibir notificaciones por SMS',
  notificaciones_app TINYINT(1) DEFAULT 1 COMMENT 'Recibir notificaciones en la aplicación',
  
  -- Preferencias de aplicación
  idioma VARCHAR(10) DEFAULT 'es' COMMENT 'Idioma de la interfaz (es, en, etc.)',
  zona_horaria VARCHAR(50) DEFAULT 'America/Bogota' COMMENT 'Zona horaria del usuario',
  
  -- Metadatos
  fecha_creacion DATETIME DEFAULT NOW(),
  fecha_actualizacion DATETIME DEFAULT NOW() ON UPDATE NOW(),
  
  FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  INDEX idx_usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE Preferencias_Usuario COMMENT = 'Preferencias de configuración de usuario (notificaciones, idioma, zona horaria)';

