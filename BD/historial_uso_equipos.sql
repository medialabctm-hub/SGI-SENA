-- ============================================
-- TABLA DE HISTORIAL DE USO DE EQUIPOS
-- ============================================
-- Esta tabla registra quién inició sesión en cada equipo y de qué hora a qué hora
-- La información se recibe desde la aplicación de escritorio Flutter

CREATE TABLE IF NOT EXISTS Historial_Uso_Equipos (
  id_historial INT PRIMARY KEY AUTO_INCREMENT,
  codigo_equipo INT NOT NULL,
  id_usuario INT NOT NULL,
  nombre_usuario VARCHAR(100) NULL COMMENT 'Nombre del usuario en el momento del registro (por si cambia después)',
  fecha_hora_inicio DATETIME NOT NULL COMMENT 'Fecha y hora en que el usuario inició sesión en el equipo',
  fecha_hora_fin DATETIME NULL COMMENT 'Fecha y hora en que el usuario cerró sesión. NULL si aún está en uso',
  estado ENUM('En Uso', 'Finalizado') DEFAULT 'En Uso' COMMENT 'Estado de la sesión',
  duracion_minutos INT NULL COMMENT 'Duración calculada en minutos (se calcula automáticamente)',
  observaciones TEXT NULL COMMENT 'Observaciones adicionales sobre el uso',
  fecha_registro DATETIME DEFAULT NOW() COMMENT 'Fecha en que se registró el historial',
  FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  INDEX idx_equipo (codigo_equipo),
  INDEX idx_usuario (id_usuario),
  INDEX idx_fecha_inicio (fecha_hora_inicio),
  INDEX idx_estado (estado),
  INDEX idx_equipo_fecha (codigo_equipo, fecha_hora_inicio),
  INDEX idx_usuario_fecha (id_usuario, fecha_hora_inicio)
) COMMENT = 'Historial de uso de equipos: registra quién inició sesión y de qué hora a qué hora';

-- Trigger para calcular automáticamente la duración cuando se actualiza fecha_hora_fin
DELIMITER $$

CREATE TRIGGER IF NOT EXISTS calcular_duracion_uso
BEFORE UPDATE ON Historial_Uso_Equipos
FOR EACH ROW
BEGIN
  IF NEW.fecha_hora_fin IS NOT NULL AND OLD.fecha_hora_fin IS NULL THEN
    SET NEW.duracion_minutos = TIMESTAMPDIFF(MINUTE, NEW.fecha_hora_inicio, NEW.fecha_hora_fin);
    SET NEW.estado = 'Finalizado';
  END IF;
END$$

DELIMITER ;

