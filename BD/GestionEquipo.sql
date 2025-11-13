DROP DATABASE IF EXISTS GestionEquipo;
CREATE DATABASE GestionEquipo;
USE GestionEquipo;

-- ===============
-- TABLA DE ROLES
-- ===============
CREATE TABLE Roles (
  id_rol INT PRIMARY KEY AUTO_INCREMENT,
  nombre_rol ENUM('Administrador', 'Instructor', 'Aprendiz') UNIQUE NOT NULL,
  descripcion VARCHAR(200),
  fecha_creacion DATETIME DEFAULT NOW()
);

-- =================
-- TABLA DE USUARIOS
-- =================
CREATE TABLE Usuarios (
  id_usuario INT PRIMARY KEY AUTO_INCREMENT,
  nombre_usuario VARCHAR(100) NOT NULL,
  cedula VARCHAR(20) UNIQUE NOT NULL,
  telefono VARCHAR(20),
  correo VARCHAR(100) UNIQUE,
  area_usuarios VARCHAR(150),
  contrasena VARCHAR(255) NOT NULL,
  id_rol INT NOT NULL,
  estado ENUM('Activo', 'Inactivo') DEFAULT 'Activo',
  fecha_registro DATETIME DEFAULT NOW(),
  ultimo_acceso DATETIME,
  creado_por INT,
  FOREIGN KEY (id_rol) REFERENCES Roles(id_rol),
  FOREIGN KEY (creado_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_cedula (cedula),
  INDEX idx_estado (estado),
  INDEX idx_rol (id_rol)
);

-- ========================
-- TABLA DE NOTIFICACIONES
-- ========================
CREATE TABLE Notificaciones (
  id_notificacion INT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  titulo VARCHAR(140) NOT NULL,
  cuerpo TEXT,
  tipo ENUM('info', 'aviso', 'alerta', 'critica') DEFAULT 'info',
  leida TINYINT(1) DEFAULT 0,
  fecha_creacion DATETIME DEFAULT NOW(),
  fecha_lectura DATETIME,
  metadata JSON,
  creado_por INT,
  FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (creado_por) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL,
  INDEX idx_usuario_leida (id_usuario, leida),
  INDEX idx_fecha_notificacion (fecha_creacion)
);

-- =================
-- TABLA DE AMBIENTES
-- =================
CREATE TABLE Ambientes (
  id_ambiente INT PRIMARY KEY AUTO_INCREMENT,
  codigo_ambiente VARCHAR(20) UNIQUE NOT NULL,
  nombre_ambiente VARCHAR(100) NOT NULL,
  tipo_ambiente ENUM('Laboratorio', 'Aula', 'Taller', 'Oficina', 'Bodega') NOT NULL,
  capacidad_personas INT,
  piso VARCHAR(10),
  edificio VARCHAR(50),
  descripcion TEXT,
  estado_ambiente ENUM('Activo', 'Inactivo', 'En Mantenimiento') DEFAULT 'Activo',
  fecha_creacion DATETIME DEFAULT NOW(),
  INDEX idx_codigo (codigo_ambiente),
  INDEX idx_tipo (tipo_ambiente)
);

-- ============================
-- TABLA DE IMÁGENES AMBIENTES
-- ============================
CREATE TABLE Imagenes_Ambiente (
  id_imagen_ambiente INT PRIMARY KEY AUTO_INCREMENT,
  id_ambiente INT NOT NULL,
  ruta_imagen VARCHAR(500) NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  tipo_imagen ENUM('Principal', 'Panorámica', 'Detalle', 'Plano') DEFAULT 'Detalle',
  descripcion VARCHAR(300),
  fecha_subida DATETIME DEFAULT NOW(),
  subida_por INT,
  es_principal BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (id_ambiente) REFERENCES Ambientes(id_ambiente) ON DELETE CASCADE,
  FOREIGN KEY (subida_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_ambiente (id_ambiente),
  INDEX idx_principal (id_ambiente, es_principal)
);

-- ====================
-- TABLA DE CATEGORÍAS
-- ====================
CREATE TABLE Categorias_Equipo (
  id_categoria INT PRIMARY KEY AUTO_INCREMENT,
  nombre_categoria VARCHAR(50) UNIQUE NOT NULL,
  descripcion VARCHAR(200),
  es_componente BOOLEAN DEFAULT FALSE
);

-- =========================
-- TABLA DE TIPOS DE EQUIPO
-- =========================
-- Eliminado: Tipos_Equipo (redundante). El tipo se deriva de Categorias_Equipo.es_componente

-- ===================
-- TABLA DE ELEMENTOS
-- ===================
CREATE TABLE Elementos (
  codigo_equipo INT PRIMARY KEY AUTO_INCREMENT,
  codigo_inventario VARCHAR(50) NOT NULL UNIQUE,
  id_categoria INT NOT NULL,
  id_ambiente INT NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  marca VARCHAR(100),
  modelo VARCHAR(100),
  numero_serie VARCHAR(100) UNIQUE,
  descripcion TEXT,
  fecha_adquisicion DATE,
  costo DECIMAL(10,2),
  vida_util_meses INT,
  estado_fisico ENUM('Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado') DEFAULT 'Bueno',
  fecha_registro DATETIME DEFAULT NOW(),
  registrado_por INT,
  incluye_mouse BOOLEAN DEFAULT FALSE,
  incluye_teclado BOOLEAN DEFAULT FALSE,
  incluye_monitor BOOLEAN DEFAULT FALSE,
  incluye_torre BOOLEAN DEFAULT FALSE,
  specs_completas TEXT,
  FOREIGN KEY (id_categoria) REFERENCES Categorias_Equipo(id_categoria),
  FOREIGN KEY (id_ambiente) REFERENCES Ambientes(id_ambiente) ON DELETE RESTRICT,
  FOREIGN KEY (registrado_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_tipo (tipo),
  INDEX idx_numero_serie (numero_serie),
  INDEX idx_ambiente (id_ambiente)
);

-- ==========================
-- TABLA DE IMÁGENES EQUIPOS
-- ==========================
CREATE TABLE Imagenes_Equipo (
  id_imagen_equipo INT PRIMARY KEY AUTO_INCREMENT,
  codigo_equipo INT NOT NULL,
  ruta_imagen VARCHAR(500) NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  tipo_imagen ENUM('Principal', 'Lateral', 'Detalle', 'Serie', 'Daño') DEFAULT 'Detalle',
  descripcion VARCHAR(300),
  fecha_subida DATETIME DEFAULT NOW(),
  subida_por INT,
  es_principal BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (subida_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_equipo (codigo_equipo),
  INDEX idx_principal (codigo_equipo, es_principal)
);

-- ===============================
-- TABLA DE COMPONENTES ASOCIADOS
-- ===============================
CREATE TABLE Componentes_Asociados (
  id_asociacion INT PRIMARY KEY AUTO_INCREMENT,
  codigo_equipo_completo INT NOT NULL,
  codigo_componente INT NOT NULL,
  tipo_componente ENUM('Mouse', 'Teclado', 'Monitor', 'Torre', 'Otro') NOT NULL,
  fecha_asociacion DATETIME DEFAULT NOW(),
  fecha_desvinculacion DATETIME,
  estado_asociacion ENUM('Activo', 'Desvinculado') DEFAULT 'Activo',
  observaciones VARCHAR(500),
  FOREIGN KEY (codigo_equipo_completo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (codigo_componente) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  INDEX idx_equipo_completo (codigo_equipo_completo),
  INDEX idx_componente (codigo_componente),
  UNIQUE KEY uk_componente_activo (codigo_componente, estado_asociacion)
);

-- =======================
-- TABLA DE ESTADO ACTUAL
-- =======================
CREATE TABLE Estado_Equipo (
  codigo_equipo INT PRIMARY KEY,
  estado_operativo ENUM('Disponible', 'En Uso', 'En Mantenimiento', 'Dañado', 'Dado de Baja') DEFAULT 'Disponible',
  detalles TEXT,
  fecha_actualizacion DATETIME DEFAULT NOW(),
  actualizado_por INT,
  FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (actualizado_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_estado (estado_operativo)
);

-- ================================
-- TABLA DE RESPONSABLES DE EQUIPO
-- ================================
CREATE TABLE Responsables_Equipo (
  id_responsable INT PRIMARY KEY AUTO_INCREMENT,
  codigo_equipo INT NOT NULL,
  id_usuario INT NOT NULL,
  fecha_asignacion DATETIME DEFAULT NOW(),
  fecha_desvinculacion DATETIME,
  estado_responsabilidad ENUM('Activo', 'Finalizado') DEFAULT 'Activo',
  tipo_responsabilidad ENUM('Principal', 'Secundario') DEFAULT 'Principal',
  observaciones TEXT,
  asignado_por INT,
  FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (asignado_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_equipo (codigo_equipo),
  INDEX idx_usuario (id_usuario),
  INDEX idx_estado (estado_responsabilidad),
  INDEX idx_equipo_activo (codigo_equipo, estado_responsabilidad)
);

-- =======================
-- TABLA DE MANTENIMIENTO
-- =======================
CREATE TABLE Mantenimiento (
  id_mantenimiento INT PRIMARY KEY AUTO_INCREMENT,
  codigo_equipo INT NOT NULL,
  tipo_mantenimiento ENUM('Preventivo', 'Correctivo', 'Actualización') NOT NULL,
  fecha_mantenimiento DATETIME NOT NULL,
  fecha_proximo DATE,
  descripcion_trabajo TEXT,
  costo DECIMAL(10,2),
  realizado_por INT,
  id_usuario_tecnico INT,
  observaciones TEXT,
  estado_mantenimiento ENUM('Programado', 'En Proceso', 'Completado', 'Cancelado') DEFAULT 'Completado',
  FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (realizado_por) REFERENCES Usuarios(id_usuario),
  FOREIGN KEY (id_usuario_tecnico) REFERENCES Usuarios(id_usuario),
  INDEX idx_fecha (fecha_mantenimiento),
  INDEX idx_proximo (fecha_proximo),
  INDEX idx_equipo (codigo_equipo),
  INDEX idx_estado (estado_mantenimiento)
);

-- ===================
-- TABLA DE NOVEDADES
-- ===================
CREATE TABLE Novedades (
  id_novedad INT PRIMARY KEY AUTO_INCREMENT,
  codigo_equipo INT NOT NULL,
  tipo_novedad ENUM('Daño', 'Pérdida', 'Robo', 'Mal Funcionamiento', 'Otro') NOT NULL,
  descripcion TEXT NOT NULL,
  fecha_novedad DATETIME DEFAULT NOW(),
  reportado_por INT NOT NULL,
  estado_resolucion ENUM('Pendiente', 'En Proceso', 'Resuelto', 'No Resuelto') DEFAULT 'Pendiente',
  fecha_resolucion DATETIME,
  resuelto_por INT,
  observaciones_resolucion TEXT,
  FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (reportado_por) REFERENCES Usuarios(id_usuario),
  FOREIGN KEY (resuelto_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_estado (estado_resolucion),
  INDEX idx_fecha (fecha_novedad)
);

-- =======================================
-- TABLA DE HISTORIAL (Reemplazo Rastreo)
-- =======================================
CREATE TABLE Historial_Equipos (
  id_historial INT PRIMARY KEY AUTO_INCREMENT,
  codigo_equipo INT NOT NULL,
  tipo_evento ENUM('Asignación', 'Devolución', 'Mantenimiento', 'Cambio Estado', 'Movimiento Ambiente', 'Otro') NOT NULL,
  descripcion TEXT,
  id_ambiente_anterior INT,
  id_ambiente_nuevo INT,
  estado_anterior VARCHAR(50),
  estado_nuevo VARCHAR(50),
  fecha_evento DATETIME DEFAULT NOW(),
  registrado_por INT,
  FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (id_ambiente_anterior) REFERENCES Ambientes(id_ambiente) ON DELETE SET NULL,
  FOREIGN KEY (id_ambiente_nuevo) REFERENCES Ambientes(id_ambiente) ON DELETE SET NULL,
  FOREIGN KEY (registrado_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_equipo (codigo_equipo),
  INDEX idx_fecha (fecha_evento),
  INDEX idx_tipo (tipo_evento)
);

-- ===================
-- TABLA DE AUDITORÍA
-- ===================
CREATE TABLE Auditoria (
  id_auditoria INT PRIMARY KEY AUTO_INCREMENT,
  tabla_afectada VARCHAR(50) NOT NULL,
  operacion ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  id_registro INT,
  usuario_accion INT,
  fecha_accion DATETIME DEFAULT NOW(),
  ip_address VARCHAR(45),
  datos_anteriores JSON,
  datos_nuevos JSON,
  FOREIGN KEY (usuario_accion) REFERENCES Usuarios(id_usuario),
  INDEX idx_tabla (tabla_afectada),
  INDEX idx_fecha (fecha_accion)
);

-- ==========================================
-- TABLA DE CRITERIOS ASIGNACIÓN AUTOMÁTICA
-- ==========================================
CREATE TABLE Criterios_Asignacion (
  id_criterio INT PRIMARY KEY AUTO_INCREMENT,
  nombre_criterio VARCHAR(100) NOT NULL,
  prioridad INT DEFAULT 1,
  activo BOOLEAN DEFAULT TRUE,
  descripcion TEXT,
  parametros JSON,
  fecha_creacion DATETIME DEFAULT NOW()
);

-- =========
-- TRIGGERS
-- =========

DELIMITER //

-- Trigger para registrar cambios en historial al crear estado
CREATE TRIGGER trg_historial_estado_inicial
AFTER INSERT ON Estado_Equipo
FOR EACH ROW
BEGIN
    INSERT INTO Historial_Equipos (
        codigo_equipo,
        tipo_evento,
        descripcion,
        estado_nuevo,
        fecha_evento,
        registrado_por
    )
    VALUES (
        NEW.codigo_equipo,
        'Cambio Estado',
        'Registro inicial del equipo',
        NEW.estado_operativo,
        NOW(),
        NEW.actualizado_por
    );
END;
//

-- Trigger para registrar cambios de estado
CREATE TRIGGER trg_historial_cambio_estado
AFTER UPDATE ON Estado_Equipo
FOR EACH ROW
BEGIN
    IF OLD.estado_operativo <> NEW.estado_operativo THEN
        INSERT INTO Historial_Equipos (
            codigo_equipo,
            tipo_evento,
            descripcion,
            estado_anterior,
            estado_nuevo,
            fecha_evento,
            registrado_por
        )
        VALUES (
            NEW.codigo_equipo,
            'Cambio Estado',
            CONCAT('Estado cambiado de ', OLD.estado_operativo, ' a ', NEW.estado_operativo),
            OLD.estado_operativo,
            NEW.estado_operativo,
            NOW(),
            NEW.actualizado_por
        );
    END IF;
END;
//

-- Trigger para registrar cambios de ambiente
CREATE TRIGGER trg_historial_cambio_ambiente
AFTER UPDATE ON Elementos
FOR EACH ROW
BEGIN
    IF IFNULL(OLD.id_ambiente, 0) <> IFNULL(NEW.id_ambiente, 0) THEN
        INSERT INTO Historial_Equipos (
            codigo_equipo,
            tipo_evento,
            descripcion,
            id_ambiente_anterior,
            id_ambiente_nuevo,
            fecha_evento,
            registrado_por
        )
        VALUES (
            NEW.codigo_equipo,
            'Movimiento Ambiente',
            CONCAT('Equipo movido de ambiente ', 
                   IFNULL((SELECT nombre_ambiente FROM Ambientes WHERE id_ambiente = OLD.id_ambiente), 'Sin ambiente'),
                   ' a ',
                   IFNULL((SELECT nombre_ambiente FROM Ambientes WHERE id_ambiente = NEW.id_ambiente), 'Sin ambiente')),
            OLD.id_ambiente,
            NEW.id_ambiente,
            NOW(),
            NEW.registrado_por
        );
    END IF;
END;
//

-- Trigger para cambiar estado cuando entra en mantenimiento
CREATE TRIGGER trg_estado_mantenimiento
AFTER INSERT ON Mantenimiento
FOR EACH ROW
BEGIN
    IF NEW.estado_mantenimiento = 'En Proceso' THEN
        UPDATE Estado_Equipo
        SET estado_operativo = 'En Mantenimiento',
            fecha_actualizacion = NOW()
        WHERE codigo_equipo = NEW.codigo_equipo;
    END IF;
END;
//

-- Trigger para finalizar responsabilidades al desvincular equipo
CREATE TRIGGER trg_finalizar_responsabilidades
BEFORE DELETE ON Elementos
FOR EACH ROW
BEGIN
    UPDATE Responsables_Equipo
    SET estado_responsabilidad = 'Finalizado',
        fecha_desvinculacion = NOW()
    WHERE codigo_equipo = OLD.codigo_equipo
    AND estado_responsabilidad = 'Activo';
END;
//

-- Trigger para validar solo una imagen principal por equipo
CREATE TRIGGER trg_validar_imagen_principal_equipo
BEFORE INSERT ON Imagenes_Equipo
FOR EACH ROW
BEGIN
    IF NEW.es_principal = TRUE THEN
        UPDATE Imagenes_Equipo
        SET es_principal = FALSE
        WHERE codigo_equipo = NEW.codigo_equipo;
    END IF;
END;
//

-- Trigger para validar solo una imagen principal por ambiente
CREATE TRIGGER trg_validar_imagen_principal_ambiente
BEFORE INSERT ON Imagenes_Ambiente
FOR EACH ROW
BEGIN
    IF NEW.es_principal = TRUE THEN
        UPDATE Imagenes_Ambiente
        SET es_principal = FALSE
        WHERE id_ambiente = NEW.id_ambiente;
    END IF;
END;
//

DELIMITER ;

-- ========
--  VISTAS
-- ========

CREATE VIEW Vista_Equipos_Con_Responsables AS
SELECT 
    e.codigo_equipo,
    e.numero_serie,
    e.tipo,
    e.marca,
    e.modelo,
    a.nombre_ambiente,
    a.codigo_ambiente,
    ee.estado_operativo,
    e.estado_fisico,
    GROUP_CONCAT(
        CONCAT(u.nombre_usuario, ' (', r.nombre_rol, ')')
        ORDER BY re.tipo_responsabilidad, u.nombre_usuario
        SEPARATOR ', '
    ) AS responsables,
    COUNT(re.id_responsable) AS total_responsables
FROM Elementos e
LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
LEFT JOIN Responsables_Equipo re ON e.codigo_equipo = re.codigo_equipo 
    AND re.estado_responsabilidad = 'Activo'
LEFT JOIN Usuarios u ON re.id_usuario = u.id_usuario
LEFT JOIN Roles r ON u.id_rol = r.id_rol
GROUP BY e.codigo_equipo, e.numero_serie, e.tipo, e.marca, e.modelo, 
         a.nombre_ambiente, a.codigo_ambiente, ee.estado_operativo, e.estado_fisico;

CREATE VIEW Vista_Equipos_Disponibles AS
SELECT 
    e.codigo_equipo,
    e.numero_serie,
    e.tipo,
    e.marca,
    e.modelo,
    CASE WHEN c.es_componente = TRUE THEN 'Componente Individual' ELSE 'Equipo Completo' END AS nombre_tipo,
    a.nombre_ambiente,
    a.codigo_ambiente,
    a.tipo_ambiente,
    e.estado_fisico,
    e.fecha_adquisicion
FROM Elementos e
INNER JOIN Categorias_Equipo c ON e.id_categoria = c.id_categoria
LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
WHERE ee.estado_operativo = 'Disponible'
AND e.estado_fisico IN ('Nuevo', 'Bueno', 'Regular');

CREATE VIEW Vista_Mantenimientos_Proximos AS
SELECT 
    m.id_mantenimiento,
    e.codigo_equipo,
    e.numero_serie,
    e.tipo,
    m.tipo_mantenimiento,
    m.fecha_proximo,
    DATEDIFF(m.fecha_proximo, CURDATE()) AS dias_restantes,
    a.nombre_ambiente,
    a.codigo_ambiente,
    CASE 
        WHEN DATEDIFF(m.fecha_proximo, CURDATE()) <= 7 THEN 'Urgente'
        WHEN DATEDIFF(m.fecha_proximo, CURDATE()) <= 30 THEN 'Próximo'
        ELSE 'Programado'
    END AS prioridad
FROM Mantenimiento m
INNER JOIN Elementos e ON m.codigo_equipo = e.codigo_equipo
LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
WHERE m.fecha_proximo IS NOT NULL
AND m.fecha_proximo >= CURDATE()
AND m.estado_mantenimiento IN ('Programado', 'En Proceso')
ORDER BY m.fecha_proximo;

CREATE VIEW Vista_Ambientes_Con_Equipos AS
SELECT 
    a.id_ambiente,
    a.codigo_ambiente,
    a.nombre_ambiente,
    a.tipo_ambiente,
    a.capacidad_personas,
    a.estado_ambiente,
    COUNT(DISTINCT e.codigo_equipo) AS total_equipos,
    COUNT(DISTINCT CASE WHEN ee.estado_operativo = 'Disponible' THEN e.codigo_equipo END) AS equipos_disponibles,
    COUNT(DISTINCT CASE WHEN ee.estado_operativo = 'En Uso' THEN e.codigo_equipo END) AS equipos_en_uso,
    COUNT(DISTINCT ia.id_imagen_ambiente) AS total_imagenes
FROM Ambientes a
LEFT JOIN Elementos e ON a.id_ambiente = e.id_ambiente
LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
LEFT JOIN Imagenes_Ambiente ia ON a.id_ambiente = ia.id_ambiente
GROUP BY a.id_ambiente, a.codigo_ambiente, a.nombre_ambiente, 
         a.tipo_ambiente, a.capacidad_personas, a.estado_ambiente;

CREATE VIEW Vista_Equipos_Por_Usuario AS
SELECT 
    u.id_usuario,
    u.nombre_usuario,
    u.cedula,
    r.nombre_rol,
    u.area_usuarios,
    COUNT(DISTINCT re.codigo_equipo) AS equipos_asignados,
    GROUP_CONCAT(
        CONCAT(e.tipo, ' - ', e.numero_serie)
        ORDER BY re.fecha_asignacion DESC
        SEPARATOR ' | '
    ) AS detalle_equipos
FROM Usuarios u
INNER JOIN Roles r ON u.id_rol = r.id_rol
LEFT JOIN Responsables_Equipo re ON u.id_usuario = re.id_usuario 
    AND re.estado_responsabilidad = 'Activo'
LEFT JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
WHERE u.estado = 'Activo'
GROUP BY u.id_usuario, u.nombre_usuario, u.cedula, r.nombre_rol, u.area_usuarios;

-- ===========================
-- PROCEDIMIENTOS ALMACENADOS
-- ===========================

DELIMITER //

-- Procedimiento para asignar múltiples responsables a un equipo
CREATE PROCEDURE sp_asignar_responsables(
    IN p_codigo_equipo INT,
    IN p_usuarios_json JSON,
    IN p_asignado_por INT
)
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE total INT;
    DECLARE id_usuario_actual INT;
    DECLARE tipo_resp VARCHAR(20);
    
    SET total = JSON_LENGTH(p_usuarios_json);
    
    -- Actualizar estado del equipo a "En Uso"
    UPDATE Estado_Equipo
    SET estado_operativo = 'En Uso',
        fecha_actualizacion = NOW(),
        actualizado_por = p_asignado_por
    WHERE codigo_equipo = p_codigo_equipo;
    
    -- Insertar responsables
    WHILE i < total DO
        SET id_usuario_actual = JSON_EXTRACT(p_usuarios_json, CONCAT('$[', i, '].id_usuario'));
        SET tipo_resp = JSON_UNQUOTE(JSON_EXTRACT(p_usuarios_json, CONCAT('$[', i, '].tipo')));
        
        INSERT INTO Responsables_Equipo (
            codigo_equipo,
            id_usuario,
            tipo_responsabilidad,
            asignado_por
        ) VALUES (
            p_codigo_equipo,
            id_usuario_actual,
            IFNULL(tipo_resp, 'Principal'),
            p_asignado_por
        );
        
        SET i = i + 1;
    END WHILE;
    
    -- Registrar en historial
    INSERT INTO Historial_Equipos (
        codigo_equipo,
        tipo_evento,
        descripcion,
        estado_nuevo,
        registrado_por
    ) VALUES (
        p_codigo_equipo,
        'Asignación',
        CONCAT('Equipo asignado a ', total, ' responsable(s)'),
        'En Uso',
        p_asignado_por
    );
    
END;
//

-- Procedimiento para devolver equipo y finalizar responsabilidades
CREATE PROCEDURE sp_devolver_equipo(
    IN p_codigo_equipo INT,
    IN p_actualizado_por INT
)
BEGIN
    -- Finalizar todas las responsabilidades activas
    UPDATE Responsables_Equipo
    SET estado_responsabilidad = 'Finalizado',
        fecha_desvinculacion = NOW()
    WHERE codigo_equipo = p_codigo_equipo
    AND estado_responsabilidad = 'Activo';
    
    -- Actualizar estado del equipo
    UPDATE Estado_Equipo
    SET estado_operativo = 'Disponible',
        fecha_actualizacion = NOW(),
        actualizado_por = p_actualizado_por
    WHERE codigo_equipo = p_codigo_equipo;
    
    -- Registrar en historial
    INSERT INTO Historial_Equipos (
        codigo_equipo,
        tipo_evento,
        descripcion,
        estado_nuevo,
        registrado_por
    ) VALUES (
        p_codigo_equipo,
        'Devolución',
        'Equipo devuelto y disponible',
        'Disponible',
        p_actualizado_por
    );
END;
//

-- Procedimiento para asignación automática de equipos
CREATE PROCEDURE sp_asignar_automatico(
    IN p_id_usuario INT,
    IN p_id_ambiente INT,
    IN p_tipo_equipo VARCHAR(100),
    IN p_asignado_por INT
)
BEGIN
    DECLARE v_codigo_equipo INT;
    
    -- Buscar equipo disponible que cumpla criterios
    SELECT e.codigo_equipo INTO v_codigo_equipo
    FROM Elementos e
    INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
    WHERE ee.estado_operativo = 'Disponible'
    AND e.estado_fisico IN ('Nuevo', 'Bueno')
    AND (p_id_ambiente IS NULL OR e.id_ambiente = p_id_ambiente)
    AND (p_tipo_equipo IS NULL OR e.tipo = p_tipo_equipo)
    ORDER BY 
        CASE e.estado_fisico
            WHEN 'Nuevo' THEN 1
            WHEN 'Bueno' THEN 2
            ELSE 3
        END,
        e.fecha_adquisicion DESC
    LIMIT 1;
    
    -- Si se encontró equipo disponible, asignarlo
    IF v_codigo_equipo IS NOT NULL THEN
        -- Asignar equipo
        UPDATE Estado_Equipo
        SET estado_operativo = 'En Uso',
            fecha_actualizacion = NOW(),
            actualizado_por = p_asignado_por
        WHERE codigo_equipo = v_codigo_equipo;
        
        -- Crear responsable
        INSERT INTO Responsables_Equipo (
            codigo_equipo,
            id_usuario,
            tipo_responsabilidad,
            asignado_por
        ) VALUES (
            v_codigo_equipo,
            p_id_usuario,
            'Principal',
            p_asignado_por
        );
        
        -- Registrar en historial
        INSERT INTO Historial_Equipos (
            codigo_equipo,
            tipo_evento,
            descripcion,
            estado_nuevo,
            registrado_por
        ) VALUES (
            v_codigo_equipo,
            'Asignación',
            'Asignación automática de equipo',
            'En Uso',
            p_asignado_por
        );
        
        SELECT v_codigo_equipo AS codigo_equipo_asignado, 'Asignación exitosa' AS mensaje;
    ELSE
        SELECT NULL AS codigo_equipo_asignado, 'No hay equipos disponibles' AS mensaje;
    END IF;
END;
//

-- Procedimiento para obtener historial completo de un equipo
CREATE PROCEDURE sp_historial_equipo(
    IN p_codigo_equipo INT
)
BEGIN
    SELECT 
        h.tipo_evento,
        h.descripcion,
        h.fecha_evento,
        a1.nombre_ambiente AS ambiente_anterior,
        a2.nombre_ambiente AS ambiente_nuevo,
        h.estado_anterior,
        h.estado_nuevo,
        u.nombre_usuario AS registrado_por
    FROM Historial_Equipos h
    LEFT JOIN Ambientes a1 ON h.id_ambiente_anterior = a1.id_ambiente
    LEFT JOIN Ambientes a2 ON h.id_ambiente_nuevo = a2.id_ambiente
    LEFT JOIN Usuarios u ON h.registrado_por = u.id_usuario
    WHERE h.codigo_equipo = p_codigo_equipo
    ORDER BY h.fecha_evento DESC;
END;
//

-- Procedimiento para obtener equipos por usuario
CREATE PROCEDURE sp_equipos_por_usuario(
    IN p_id_usuario INT
)
BEGIN
    SELECT 
        e.codigo_equipo,
        e.numero_serie,
        e.tipo,
        e.marca,
        e.modelo,
        ee.estado_operativo,
        a.nombre_ambiente,
        a.codigo_ambiente,
        re.fecha_asignacion,
        re.tipo_responsabilidad,
        DATEDIFF(NOW(), re.fecha_asignacion) AS dias_asignado
    FROM Responsables_Equipo re
    INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
    LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
    LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
    WHERE re.id_usuario = p_id_usuario
    AND re.estado_responsabilidad = 'Activo'
    ORDER BY re.fecha_asignacion DESC;
END;
//

-- Procedimiento para mover equipo a otro ambiente
CREATE PROCEDURE sp_mover_equipo_ambiente(
    IN p_codigo_equipo INT,
    IN p_id_ambiente_nuevo INT,
    IN p_observaciones TEXT,
    IN p_actualizado_por INT
)
BEGIN
    DECLARE v_id_ambiente_anterior INT;
    
    -- Obtener ambiente anterior
    SELECT id_ambiente INTO v_id_ambiente_anterior
    FROM Elementos
    WHERE codigo_equipo = p_codigo_equipo;
    
    -- Actualizar ambiente del equipo
    UPDATE Elementos
    SET id_ambiente = p_id_ambiente_nuevo
    WHERE codigo_equipo = p_codigo_equipo;
    
    -- Registrar en historial (el trigger ya lo hace, pero agregamos observaciones)
    INSERT INTO Historial_Equipos (
        codigo_equipo,
        tipo_evento,
        descripcion,
        id_ambiente_anterior,
        id_ambiente_nuevo,
        registrado_por
    ) VALUES (
        p_codigo_equipo,
        'Movimiento Ambiente',
        CONCAT('Equipo movido de ambiente. ', IFNULL(p_observaciones, '')),
        v_id_ambiente_anterior,
        p_id_ambiente_nuevo,
        p_actualizado_por
    );
END;
//

-- Procedimiento para reportar novedad con actualización de estado
CREATE PROCEDURE sp_reportar_novedad(
    IN p_codigo_equipo INT,
    IN p_tipo_novedad ENUM('Daño', 'Pérdida', 'Robo', 'Mal Funcionamiento', 'Otro'),
    IN p_descripcion TEXT,
    IN p_reportado_por INT,
    IN p_actualizar_estado BOOLEAN
)
BEGIN
    -- Insertar novedad
    INSERT INTO Novedades (
        codigo_equipo,
        tipo_novedad,
        descripcion,
        reportado_por
    ) VALUES (
        p_codigo_equipo,
        p_tipo_novedad,
        p_descripcion,
        p_reportado_por
    );
    
    -- Si se debe actualizar el estado, cambiar a "Dañado"
    IF p_actualizar_estado = TRUE THEN
        UPDATE Estado_Equipo
        SET estado_operativo = 'Dañado',
            fecha_actualizacion = NOW(),
            actualizado_por = p_reportado_por
        WHERE codigo_equipo = p_codigo_equipo;
        
        -- Registrar en historial
        INSERT INTO Historial_Equipos (
            codigo_equipo,
            tipo_evento,
            descripcion,
            estado_nuevo,
            registrado_por
        ) VALUES (
            p_codigo_equipo,
            'Cambio Estado',
            CONCAT('Estado cambiado por novedad: ', p_tipo_novedad),
            'Dañado',
            p_reportado_por
        );
    END IF;
END;
//

-- Procedimiento para obtener estadísticas del sistema
CREATE PROCEDURE sp_estadisticas_sistema()
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM Elementos) AS total_equipos,
        (SELECT COUNT(*) FROM Elementos e 
         INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo 
         WHERE ee.estado_operativo = 'Disponible') AS equipos_disponibles,
        (SELECT COUNT(*) FROM Elementos e 
         INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo 
         WHERE ee.estado_operativo = 'En Uso') AS equipos_en_uso,
        (SELECT COUNT(*) FROM Elementos e 
         INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo 
         WHERE ee.estado_operativo = 'En Mantenimiento') AS equipos_en_mantenimiento,
        (SELECT COUNT(*) FROM Elementos e 
         INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo 
         WHERE ee.estado_operativo = 'Dañado') AS equipos_danados,
        (SELECT COUNT(*) FROM Usuarios WHERE estado = 'Activo') AS usuarios_activos,
        (SELECT COUNT(*) FROM Ambientes WHERE estado_ambiente = 'Activo') AS ambientes_activos,
        (SELECT COUNT(*) FROM Novedades WHERE estado_resolucion = 'Pendiente') AS novedades_pendientes,
        (SELECT COUNT(*) FROM Mantenimiento 
         WHERE fecha_proximo IS NOT NULL 
         AND fecha_proximo >= CURDATE()
         AND DATEDIFF(fecha_proximo, CURDATE()) <= 30) AS mantenimientos_proximos_30dias;
END;
//

DELIMITER ;

-- ======================
-- DATOS INICIALES
-- ======================

-- Insertar roles
INSERT INTO Roles (nombre_rol, descripcion) VALUES
('Administrador', 'Acceso total al sistema'),
('Instructor', 'Gestión de equipos y asignaciones'),
('Aprendiz', 'Consulta y uso de equipos asignados');

-- Insertar categorías de ejemplo
INSERT INTO Categorias_Equipo (nombre_categoria, descripcion, es_componente) VALUES
('Computador de Escritorio', 'Equipos de escritorio completos', FALSE),
('Portátil', 'Computadores portátiles', FALSE),
('Monitor', 'Pantallas y monitores', TRUE),
('Mouse', 'Dispositivos de entrada - Mouse', TRUE),
('Teclado', 'Dispositivos de entrada - Teclado', TRUE),
('Impresora', 'Equipos de impresión', FALSE),
('Proyector', 'Equipos de proyección', FALSE),
('Router', 'Equipos de red', FALSE);

-- Insertar ambientes de ejemplo
INSERT INTO Ambientes (codigo_ambiente, nombre_ambiente, tipo_ambiente) VALUES
('101','Ambiente 101','Aula'),
('102','Ambiente 102','Aula'),
('103','Ambiente 103','Aula'),
('104','Ambiente 104','Aula'),
('105','Ambiente 105','Aula'),
('106','Ambiente 106','Aula'),
('107','Ambiente 107','Aula'),
('201','Ambiente 201','Aula'),
('202','Ambiente 202','Aula'),
('203','Ambiente 203','Aula'),
('204','Ambiente 204','Aula'),
('205','Ambiente 205','Aula'),
('301','Ambiente 301','Aula'),
('302','Ambiente 302','Aula'),
('401','Ambiente 401','Aula'),
('402','Ambiente 402','Aula'),
('403','Ambiente 403','Aula'),
('501','Ambiente 501','Aula'),
('502','Ambiente 502','Aula'),
('503','Ambiente 503','Aula'),
('504','Ambiente 504','Aula'),
('505','Ambiente 505','Aula'),
('506','Ambiente 506','Aula');

-- Insertar criterios de asignación automática
INSERT INTO Criterios_Asignacion (nombre_criterio, prioridad, descripcion, parametros) VALUES
('Estado Físico', 1, 'Prioriza equipos en mejor estado físico', '{"orden": ["Nuevo", "Bueno", "Regular"]}'),
('Fecha Adquisición', 2, 'Prioriza equipos más recientes', '{"orden": "DESC"}'),
('Mismo Ambiente', 3, 'Prioriza equipos del mismo ambiente solicitado', '{"peso": 0.8}');

-- Crear usuario administrador inicial (contraseña: Admin123!)
INSERT INTO Usuarios (
    nombre_usuario, 
    cedula, 
    telefono, 
    correo, 
    area_usuarios, 
    contrasena, 
    id_rol,
    estado
) VALUES (
    'Administrador Sistema',
    '1000000000',
    '3001234567',
    'admin@sena.edu.co',
    'Sistemas',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    1,
    'Activo'
);

-- ========
-- ÍNDICES ADICIONALES PARA OPTIMIZACIÓN
-- ========

CREATE INDEX idx_responsables_activos ON Responsables_Equipo(estado_responsabilidad, fecha_asignacion);
CREATE INDEX idx_mantenimiento_pendiente ON Mantenimiento(estado_mantenimiento, fecha_proximo);
CREATE INDEX idx_novedades_pendientes ON Novedades(estado_resolucion, fecha_novedad);
CREATE INDEX idx_historial_fecha ON Historial_Equipos(codigo_equipo, fecha_evento);

-- Comentarios de documentación
ALTER TABLE Elementos COMMENT = 'Tabla principal de equipos y componentes tecnológicos';
ALTER TABLE Ambientes COMMENT = 'Ubicaciones físicas donde se encuentran los equipos';
ALTER TABLE Responsables_Equipo COMMENT = 'Gestión de múltiples responsables por equipo';
ALTER TABLE Imagenes_Equipo COMMENT = 'Almacenamiento de rutas de imágenes de equipos';
ALTER TABLE Imagenes_Ambiente COMMENT = 'Almacenamiento de rutas de imágenes de ambientes';
ALTER TABLE Historial_Equipos COMMENT = 'Registro histórico de eventos de equipos (reemplaza rastreo temporal)';