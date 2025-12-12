-- Migración: Agregar campos de días de la semana y horarios a Responsabilidades_Ambiente
ALTER TABLE Responsabilidades_Ambiente
ADD COLUMN dias_semana JSON NULL COMMENT 'Array de días de la semana: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]',
ADD COLUMN hora_inicio TIME NULL COMMENT 'Hora de inicio del horario (formato HH:MM:SS)',
ADD COLUMN hora_fin TIME NULL COMMENT 'Hora de fin del horario (formato HH:MM:SS)';

-- Crear índices en campos indexables (no se puede indexar JSON directamente)
ALTER TABLE Responsabilidades_Ambiente
ADD INDEX idx_ambiente_horas (id_ambiente, hora_inicio, hora_fin, estado_responsabilidad),
ADD INDEX idx_usuario_horas (id_usuario, hora_inicio, hora_fin, estado_responsabilidad);

