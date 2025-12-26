DROP DATABASE IF EXISTS railway;
CREATE DATABASE railway;
USE railway;

-- ============================================
-- TABLA DE ROLES
-- ============================================
CREATE TABLE Roles (
  id_rol INT PRIMARY KEY AUTO_INCREMENT,
  nombre_rol VARCHAR(50) UNIQUE NOT NULL COMMENT 'Nombre del rol (permite roles personalizados)',
  descripcion VARCHAR(200),
  estado ENUM('Activo', 'Inactivo') DEFAULT 'Activo' COMMENT 'Estado del rol',
  fecha_creacion DATETIME DEFAULT NOW(),
  INDEX idx_estado (estado),
  INDEX idx_nombre (nombre_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Roles del sistema de gestión de equipos';

-- ============================================
-- TABLA DE PERMISOS
-- ============================================
CREATE TABLE Permisos (
  id_permiso INT PRIMARY KEY AUTO_INCREMENT,
  codigo_permiso VARCHAR(100) UNIQUE NOT NULL COMMENT 'Código único del permiso (ej: users:view)',
  modulo VARCHAR(50) NOT NULL COMMENT 'Módulo al que pertenece (ej: USERS, EQUIPOS)',
  accion VARCHAR(50) NOT NULL COMMENT 'Acción del permiso (ej: VIEW, CREATE)',
  descripcion TEXT COMMENT 'Descripción del permiso',
  fecha_creacion DATETIME DEFAULT NOW(),
  INDEX idx_modulo (modulo),
  INDEX idx_codigo (codigo_permiso),
  INDEX idx_modulo_accion (modulo, accion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Permisos disponibles en el sistema';

-- ============================================
-- TABLA DE USUARIOS
-- ============================================
CREATE TABLE Usuarios (
  id_usuario INT PRIMARY KEY AUTO_INCREMENT,
  nombre_usuario VARCHAR(100) NOT NULL,
  cedula VARCHAR(20) UNIQUE NOT NULL,
  tipo_documento ENUM('TI', 'CC', 'CE', 'PPT', 'Otro') DEFAULT 'CC' COMMENT 'Tipo de documento de identidad',
  tipo_documento_otro VARCHAR(50) NULL COMMENT 'Especificación cuando tipo_documento es "Otro"',
  telefono VARCHAR(20),
  correo VARCHAR(100) UNIQUE,
  contrasena VARCHAR(255) NOT NULL,
  id_rol INT NOT NULL,
  estado ENUM('Activo', 'Inactivo') DEFAULT 'Activo',
  requiere_cambio_contrasena TINYINT(1) DEFAULT 0 COMMENT 'Indica si el usuario debe cambiar su contraseña',
  foto_perfil VARCHAR(255) NULL COMMENT 'Ruta de la foto de perfil del usuario',
  fecha_registro DATETIME DEFAULT NOW(),
  ultimo_acceso DATETIME,
  creado_por INT,
  FOREIGN KEY (id_rol) REFERENCES Roles(id_rol),
  FOREIGN KEY (creado_por) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL,
  INDEX idx_cedula (cedula),
  INDEX idx_correo (correo),
  INDEX idx_estado (estado),
  INDEX idx_rol (id_rol),
  INDEX idx_estado_rol (estado, id_rol),
  INDEX idx_tipo_documento (tipo_documento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Usuarios del sistema con sus credenciales y datos personales';

-- ============================================
-- TABLA DE RELACIÓN ROL-PERMISO
-- (Debe crearse después de Usuarios porque tiene FK a Usuarios)
-- ============================================
CREATE TABLE Rol_Permisos (
  id_rol INT NOT NULL,
  id_permiso INT NOT NULL,
  activo TINYINT(1) DEFAULT 1 COMMENT 'Indica si el permiso está activo para el rol',
  fecha_asignacion DATETIME DEFAULT NOW(),
  asignado_por INT COMMENT 'Usuario que asignó el permiso',
  PRIMARY KEY (id_rol, id_permiso),
  FOREIGN KEY (id_rol) REFERENCES Roles(id_rol) ON DELETE CASCADE,
  FOREIGN KEY (id_permiso) REFERENCES Permisos(id_permiso) ON DELETE CASCADE,
  FOREIGN KEY (asignado_por) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL,
  INDEX idx_rol_activo (id_rol, activo),
  INDEX idx_permiso_activo (id_permiso, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Relación entre roles y permisos';

-- ============================================
-- TABLA DE TOKENS DE RECUPERACIÓN DE CONTRASEÑA
-- ============================================
CREATE TABLE Tokens_Recuperacion_Contrasena (
  id_token INT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  fecha_creacion DATETIME DEFAULT NOW(),
  fecha_expiracion DATETIME NOT NULL,
  usado TINYINT(1) DEFAULT 0,
  fecha_uso DATETIME NULL,
  FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_usuario (id_usuario),
  INDEX idx_expiracion_usado (fecha_expiracion, usado),
  INDEX idx_usuario_expiracion (id_usuario, fecha_expiracion, usado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Tokens para recuperación de contraseñas de usuarios';

-- ============================================
-- TABLA DE NOTIFICACIONES
-- ============================================
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
  INDEX idx_fecha_notificacion (fecha_creacion),
  INDEX idx_usuario_fecha (id_usuario, fecha_creacion DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Notificaciones del sistema para usuarios';

-- ============================================
-- TABLA DE AMBIENTES
-- ============================================
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
  INDEX idx_tipo (tipo_ambiente),
  INDEX idx_estado (estado_ambiente),
  INDEX idx_tipo_estado (tipo_ambiente, estado_ambiente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Ubicaciones físicas donde se encuentran los equipos';

-- ============================================
-- TABLA DE IMÁGENES AMBIENTES
-- ============================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Almacenamiento de rutas de imágenes de ambientes';

-- ============================================
-- TABLA DE CATEGORÍAS
-- ============================================
CREATE TABLE Categorias_Equipo (
  id_categoria INT PRIMARY KEY AUTO_INCREMENT,
  nombre_categoria VARCHAR(50) UNIQUE NOT NULL,
  descripcion VARCHAR(200),
  es_componente BOOLEAN DEFAULT FALSE,
  INDEX idx_es_componente (es_componente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Categorías de equipos (completos o componentes)';

-- ============================================
-- TABLA DE ELEMENTOS
-- ============================================
CREATE TABLE Elementos (
  codigo_equipo INT PRIMARY KEY AUTO_INCREMENT,
  id_categoria INT NOT NULL,
  id_ambiente INT NOT NULL,
  id_cuentadante INT NULL COMMENT 'ID del cuentadante responsable de este equipo',
  tipo VARCHAR(100) NOT NULL,
  modelo VARCHAR(100),
  descripcion TEXT,
  fecha_adquisicion DATE,
  costo DECIMAL(10,2),
  vida_util_meses INT,
  estado_fisico ENUM('Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado') DEFAULT 'Bueno',
  fecha_registro DATETIME DEFAULT NOW(),
  registrado_por INT,
  specs_completas TEXT,
  r_centro VARCHAR(50) NOT NULL COMMENT 'Código del centro',
  consecutivo VARCHAR(100),
  placa VARCHAR(100),
  atributos TEXT,
  valor_ingreso DECIMAL(10,2),
  cuentadante_principal VARCHAR(255) NULL COMMENT 'Cuentadante principal permanente',
  FOREIGN KEY (id_categoria) REFERENCES Categorias_Equipo(id_categoria),
  FOREIGN KEY (id_ambiente) REFERENCES Ambientes(id_ambiente) ON DELETE RESTRICT,
  FOREIGN KEY (id_cuentadante) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL,
  FOREIGN KEY (registrado_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_tipo (tipo),
  INDEX idx_r_centro (r_centro),
  INDEX idx_consecutivo (consecutivo),
  INDEX idx_ambiente (id_ambiente),
  INDEX idx_cuentadante (id_cuentadante),
  INDEX idx_categoria (id_categoria),
  INDEX idx_estado_fisico (estado_fisico),
  INDEX idx_r_centro_consecutivo (r_centro, consecutivo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Tabla principal de equipos y componentes tecnológicos';

-- ============================================
-- TABLA DE IMÁGENES EQUIPOS
-- ============================================
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Almacenamiento de rutas de imágenes de equipos';

-- ============================================
-- TABLA DE COMPONENTES ASOCIADOS
-- ============================================
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
  INDEX idx_estado_asociacion (estado_asociacion),
  UNIQUE KEY uk_componente_activo (codigo_componente, estado_asociacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Asociación de componentes a equipos completos';

-- ============================================
-- TABLA DE ESTADO ACTUAL
-- ============================================
CREATE TABLE Estado_Equipo (
  codigo_equipo INT PRIMARY KEY,
  estado_operativo ENUM('Disponible', 'En Uso', 'En Mantenimiento', 'Dañado', 'Dado de Baja') DEFAULT 'Disponible',
  detalles TEXT,
  fecha_actualizacion DATETIME DEFAULT NOW(),
  actualizado_por INT,
  FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (actualizado_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_estado (estado_operativo),
  INDEX idx_fecha_actualizacion (fecha_actualizacion),
  INDEX idx_estado_fecha (estado_operativo, fecha_actualizacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Estado operativo actual de cada equipo';

-- ============================================
-- TABLA DE RESPONSABLES DE EQUIPO
-- ============================================
CREATE TABLE Responsables_Equipo (
  id_responsable INT PRIMARY KEY AUTO_INCREMENT,
  codigo_equipo INT NOT NULL,
  id_usuario INT NULL COMMENT 'NULL si es registro externo',
  fecha_asignacion DATETIME DEFAULT NOW(),
  fecha_desvinculacion DATETIME,
  estado_responsabilidad ENUM('Activo', 'Finalizado') DEFAULT 'Activo',
  tipo_responsabilidad ENUM('Principal', 'Secundario') DEFAULT 'Principal',
  observaciones TEXT,
  asignado_por INT,
  -- Campos para registros externos
  ficha VARCHAR(50) NULL COMMENT 'Número de ficha del aprendiz (registro externo)',
  nombre_externo VARCHAR(200) NULL COMMENT 'Nombre completo del usuario (registro externo)',
  documento_externo VARCHAR(50) NULL COMMENT 'Documento del responsable externo',
  dias_semana JSON NULL COMMENT 'Array de días de la semana para horarios',
  hora_inicio TIME NULL COMMENT 'Hora de inicio del horario',
  hora_fin TIME NULL COMMENT 'Hora de fin del horario',
  FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (asignado_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_equipo_activo (codigo_equipo, estado_responsabilidad),
  INDEX idx_usuario (id_usuario),
  INDEX idx_responsables_activos (estado_responsabilidad, fecha_asignacion),
  INDEX idx_ficha (ficha),
  INDEX idx_documento_externo (documento_externo),
  INDEX idx_horarios (hora_inicio, hora_fin, estado_responsabilidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Gestión de múltiples responsables por equipo';

-- ============================================
-- TABLA DE CLASES/PROGRAMACIONES
-- ============================================
CREATE TABLE Clases (
  id_clase INT PRIMARY KEY AUTO_INCREMENT,
  id_ambiente INT NOT NULL,
  id_instructor INT NOT NULL,
  nombre_clase VARCHAR(200),
  codigo_ficha VARCHAR(50) NULL COMMENT 'Código de la ficha o grupo de aprendices',
  descripcion TEXT,
  fecha_clase DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado_clase ENUM('Programada', 'En Curso', 'Finalizada', 'Cancelada') DEFAULT 'Programada',
  fecha_inicio_real DATETIME,
  fecha_fin_real DATETIME,
  observaciones TEXT,
  creado_por INT,
  fecha_creacion DATETIME DEFAULT NOW(),
  FOREIGN KEY (id_ambiente) REFERENCES Ambientes(id_ambiente) ON DELETE RESTRICT,
  FOREIGN KEY (id_instructor) REFERENCES Usuarios(id_usuario) ON DELETE RESTRICT,
  FOREIGN KEY (creado_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_ambiente_fecha_hora (id_ambiente, fecha_clase, hora_inicio, hora_fin, estado_clase),
  INDEX idx_instructor (id_instructor),
  INDEX idx_ficha (codigo_ficha),
  INDEX idx_estado_clase (estado_clase),
  INDEX idx_fecha_clase (fecha_clase)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Programación de clases en ambientes con horarios específicos';

-- ============================================
-- TABLA DE PARTICIPANTES DE CLASE
-- ============================================
CREATE TABLE Participantes_Clase (
  id_participante INT PRIMARY KEY AUTO_INCREMENT,
  id_clase INT NOT NULL,
  id_aprendiz INT NOT NULL,
  fecha_registro DATETIME DEFAULT NOW(),
  presente BOOLEAN DEFAULT TRUE,
  observaciones TEXT,
  FOREIGN KEY (id_clase) REFERENCES Clases(id_clase) ON DELETE CASCADE,
  FOREIGN KEY (id_aprendiz) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  INDEX idx_clase (id_clase),
  INDEX idx_aprendiz (id_aprendiz),
  UNIQUE KEY uk_clase_aprendiz (id_clase, id_aprendiz)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Registro de aprendices que participan en cada clase';

-- ============================================
-- TABLA DE RESPONSABILIDADES AMBIENTE
-- ============================================
CREATE TABLE Responsabilidades_Ambiente (
  id_responsabilidad_ambiente INT PRIMARY KEY AUTO_INCREMENT,
  id_ambiente INT NOT NULL,
  id_clase INT,
  jornada ENUM('Mañana', 'Tarde', 'Noche') NULL COMMENT 'Jornada de la asignación. NULL para asignaciones temporales',
  id_usuario INT NOT NULL,
  tipo_responsabilidad ENUM('Principal', 'Secundario') NOT NULL,
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME,
  estado_responsabilidad ENUM('Activa', 'Finalizada') DEFAULT 'Activa',
  asignacion_automatica BOOLEAN DEFAULT FALSE COMMENT 'Indica si fue asignada automáticamente por horario',
  observaciones TEXT,
  creado_por INT,
  fecha_creacion DATETIME DEFAULT NOW(),
  -- Campos para horarios recurrentes
  dias_semana JSON NULL COMMENT 'Array de días de la semana',
  hora_inicio TIME NULL COMMENT 'Hora de inicio del horario',
  hora_fin TIME NULL COMMENT 'Hora de fin del horario',
  FOREIGN KEY (id_ambiente) REFERENCES Ambientes(id_ambiente) ON DELETE CASCADE,
  FOREIGN KEY (id_clase) REFERENCES Clases(id_clase) ON DELETE SET NULL,
  FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (creado_por) REFERENCES Usuarios(id_usuario),
  INDEX idx_ambiente_fecha_activa (id_ambiente, fecha_inicio, fecha_fin, estado_responsabilidad),
  INDEX idx_clase (id_clase),
  INDEX idx_usuario (id_usuario),
  INDEX idx_ambiente_jornada (id_ambiente, jornada, estado_responsabilidad),
  INDEX idx_ambiente_horas (id_ambiente, hora_inicio, hora_fin, estado_responsabilidad),
  INDEX idx_usuario_horas (id_usuario, hora_inicio, hora_fin, estado_responsabilidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Responsabilidades temporales sobre el inventario de un ambiente durante clases';

-- ============================================
-- TABLA DE MANTENIMIENTO
-- ============================================
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
  INDEX idx_equipo (codigo_equipo),
  INDEX idx_mantenimiento_pendiente (estado_mantenimiento, fecha_proximo),
  INDEX idx_fecha (fecha_mantenimiento),
  INDEX idx_fecha_proximo (fecha_proximo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Registro de mantenimientos realizados y programados';

-- ============================================
-- TABLA DE NOVEDADES
-- ============================================
CREATE TABLE Novedades (
  id_novedad INT PRIMARY KEY AUTO_INCREMENT,
  codigo_equipo INT NOT NULL,
  tipo_novedad ENUM('Daño', 'Pérdida', 'Robo', 'Mal Funcionamiento', 'Daño Físico', 'Falta de Componente', 'Otro') NOT NULL,
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
  INDEX idx_novedades_pendientes (estado_resolucion, fecha_novedad),
  INDEX idx_equipo (codigo_equipo),
  INDEX idx_fecha_novedad (fecha_novedad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Registro de novedades reportadas sobre equipos';

-- ============================================
-- TABLA DE HISTORIAL (Reemplazo Rastreo)
-- ============================================
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
  INDEX idx_historial_fecha (codigo_equipo, fecha_evento DESC),
  INDEX idx_tipo (tipo_evento),
  INDEX idx_fecha_evento (fecha_evento DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Registro histórico de eventos de equipos';

-- ============================================
-- TABLA DE AUDITORÍA
-- ============================================
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
  INDEX idx_fecha (fecha_accion DESC),
  INDEX idx_usuario_fecha (usuario_accion, fecha_accion DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Registro de auditoría de cambios en el sistema';

-- ============================================
-- TABLA DE CRITERIOS ASIGNACIÓN AUTOMÁTICA
-- ============================================
CREATE TABLE Criterios_Asignacion (
  id_criterio INT PRIMARY KEY AUTO_INCREMENT,
  nombre_criterio VARCHAR(100) NOT NULL,
  prioridad INT DEFAULT 1,
  activo BOOLEAN DEFAULT TRUE,
  descripcion TEXT,
  parametros JSON,
  fecha_creacion DATETIME DEFAULT NOW(),
  INDEX idx_activo_prioridad (activo, prioridad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Criterios para asignación automática de equipos';

-- ============================================
-- TABLA DE CÓDIGOS DE SEGURIDAD
-- ============================================
CREATE TABLE Invitation_Codes (
  id_codigo INT PRIMARY KEY AUTO_INCREMENT,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  rol_destinado VARCHAR(50) NOT NULL COMMENT 'Rol destinado (referencia a Roles.nombre_rol)',
  fecha_creacion DATETIME DEFAULT NOW(),
  fecha_expiracion DATETIME,
  max_usos INT DEFAULT 1 COMMENT 'Número máximo de veces que se puede usar (0 = ilimitado)',
  usos_actuales INT DEFAULT 0 COMMENT 'Número de veces que se ha usado',
  estado ENUM('Activo', 'Inactivo', 'Expirado', 'Agotado') DEFAULT 'Activo',
  creado_por INT,
  FOREIGN KEY (creado_por) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL,
  INDEX idx_codigo (codigo),
  INDEX idx_rol (rol_destinado),
  INDEX idx_estado (estado),
  INDEX idx_expiracion (fecha_expiracion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Códigos de invitación para registro de usuarios';

-- ============================================
-- TABLA DE PREFERENCIAS DE USUARIO
-- ============================================
CREATE TABLE Preferencias_Usuario (
  id_preferencia INT PRIMARY KEY AUTO_INCREMENT,
  id_usuario INT NOT NULL UNIQUE,
  notificaciones_email TINYINT(1) DEFAULT 1,
  notificaciones_sms TINYINT(1) DEFAULT 0,
  notificaciones_app TINYINT(1) DEFAULT 1,
  idioma VARCHAR(10) DEFAULT 'es',
  zona_horaria VARCHAR(50) DEFAULT 'America/Bogota',
  fecha_creacion DATETIME DEFAULT NOW(),
  fecha_actualizacion DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  INDEX idx_usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Preferencias de configuración de usuario';

-- ============================================
-- TABLA DE VERIFICACIONES DE INVENTARIO
-- ============================================
CREATE TABLE Verificaciones_Inventario (
  id_verificacion INT PRIMARY KEY AUTO_INCREMENT,
  codigo_equipo INT NOT NULL,
  id_ambiente INT NULL COMMENT 'Ambiente donde se verificó el equipo',
  id_clase INT NULL COMMENT 'Clase/horario activo cuando se verificó',
  id_responsabilidad_ambiente INT NULL COMMENT 'Responsabilidad que estaba activa',
  jornada ENUM('Mañana', 'Tarde', 'Noche') NULL COMMENT 'Jornada cuando se verificó',
  id_usuario INT NOT NULL COMMENT 'Instructor que realiza la verificación',
  estado_verificacion ENUM('Verificado', 'Con Novedad', 'No Verificado') NOT NULL,
  observaciones TEXT,
  fecha_verificacion DATETIME NOT NULL DEFAULT NOW(),
  FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (id_ambiente) REFERENCES Ambientes(id_ambiente) ON DELETE SET NULL,
  FOREIGN KEY (id_clase) REFERENCES Clases(id_clase) ON DELETE SET NULL,
  FOREIGN KEY (id_responsabilidad_ambiente) REFERENCES Responsabilidades_Ambiente(id_responsabilidad_ambiente) ON DELETE SET NULL,
  FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  INDEX idx_equipo_usuario_fecha (codigo_equipo, id_usuario, fecha_verificacion DESC),
  INDEX idx_ambiente_fecha (id_ambiente, fecha_verificacion DESC),
  INDEX idx_clase_fecha (id_clase, fecha_verificacion DESC),
  INDEX idx_estado (estado_verificacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Historial completo de verificaciones de inventario con contexto';

-- ============================================
-- TABLA DE PEDIDOS EXTERNOS
-- ============================================
CREATE TABLE pedidos_externos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario VARCHAR(255) NOT NULL COMMENT 'Usuario que realiza el pedido (identificador externo)',
  id_ambiente INT NOT NULL COMMENT 'ID del ambiente donde se realiza el pedido',
  ficha VARCHAR(255) NOT NULL COMMENT 'Ficha asociada al pedido',
  estado VARCHAR(255) NOT NULL COMMENT 'Estado del pedido',
  fecha_recepcion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de recepción del webhook',
  FOREIGN KEY (id_ambiente) REFERENCES Ambientes(id_ambiente) ON DELETE RESTRICT,
  INDEX idx_usuario (usuario),
  INDEX idx_ambiente (id_ambiente),
  INDEX idx_ficha (ficha),
  INDEX idx_estado (estado),
  INDEX idx_fecha_recepcion (fecha_recepcion DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Tabla para almacenar pedidos recibidos de sistemas externos';

-- ============================================
-- TABLA DE HISTORIAL DE USO DE EQUIPOS
-- ============================================
CREATE TABLE Historial_Uso_Equipos (
  id_historial INT PRIMARY KEY AUTO_INCREMENT,
  codigo_equipo INT NOT NULL,
  id_usuario INT NOT NULL,
  nombre_usuario VARCHAR(100) NULL COMMENT 'Nombre del usuario en el momento del registro',
  fecha_hora_inicio DATETIME NOT NULL COMMENT 'Fecha y hora en que el usuario inició sesión',
  fecha_hora_fin DATETIME NULL COMMENT 'Fecha y hora en que el usuario cerró sesión. NULL si aún está en uso',
  estado ENUM('En Uso', 'Finalizado') DEFAULT 'En Uso' COMMENT 'Estado de la sesión',
  duracion_minutos INT NULL COMMENT 'Duración calculada en minutos',
  observaciones TEXT NULL COMMENT 'Observaciones adicionales sobre el uso',
  fecha_registro DATETIME DEFAULT NOW() COMMENT 'Fecha en que se registró el historial',
  id_clase INT NULL COMMENT 'ID de clase asociada',
  FOREIGN KEY (codigo_equipo) REFERENCES Elementos(codigo_equipo) ON DELETE CASCADE,
  FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (id_clase) REFERENCES Clases(id_clase) ON DELETE SET NULL,
  INDEX idx_equipo (codigo_equipo),
  INDEX idx_usuario (id_usuario),
  INDEX idx_fecha_inicio (fecha_hora_inicio DESC),
  INDEX idx_estado (estado),
  INDEX idx_equipo_fecha (codigo_equipo, fecha_hora_inicio DESC),
  INDEX idx_usuario_fecha (id_usuario, fecha_hora_inicio DESC),
  INDEX idx_clase (id_clase)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT = 'Historial de uso de equipos: registra quién inició sesión y de qué hora a qué hora';

-- ============================================
-- TRIGGERS
-- ============================================

DELIMITER //

-- Trigger para registrar cambios en historial al crear estado
CREATE TRIGGER trg_historial_estado_inicial
AFTER INSERT ON Estado_Equipo
FOR EACH ROW
BEGIN
    INSERT INTO Historial_Equipos (
        codigo_equipo, tipo_evento, descripcion, estado_nuevo, fecha_evento, registrado_por
    ) VALUES (
        NEW.codigo_equipo, 'Cambio Estado', 'Registro inicial del equipo', 
        NEW.estado_operativo, NOW(), NEW.actualizado_por
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
            codigo_equipo, tipo_evento, descripcion, estado_anterior, estado_nuevo, 
            fecha_evento, registrado_por
        ) VALUES (
            NEW.codigo_equipo, 'Cambio Estado',
            CONCAT('Estado cambiado de ', OLD.estado_operativo, ' a ', NEW.estado_operativo),
            OLD.estado_operativo, NEW.estado_operativo, NOW(), NEW.actualizado_por
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
            codigo_equipo, tipo_evento, descripcion, id_ambiente_anterior, 
            id_ambiente_nuevo, fecha_evento, registrado_por
        ) VALUES (
            NEW.codigo_equipo, 'Movimiento Ambiente',
            CONCAT('Equipo movido de ambiente ', 
                   IFNULL((SELECT nombre_ambiente FROM Ambientes WHERE id_ambiente = OLD.id_ambiente), 'Sin ambiente'),
                   ' a ',
                   IFNULL((SELECT nombre_ambiente FROM Ambientes WHERE id_ambiente = NEW.id_ambiente), 'Sin ambiente')),
            OLD.id_ambiente, NEW.id_ambiente, NOW(), NEW.registrado_por
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
        SET estado_operativo = 'En Mantenimiento', fecha_actualizacion = NOW()
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
    SET estado_responsabilidad = 'Finalizado', fecha_desvinculacion = NOW()
    WHERE codigo_equipo = OLD.codigo_equipo AND estado_responsabilidad = 'Activo';
END;
//

-- Trigger para validar solo una imagen principal por equipo
CREATE TRIGGER trg_validar_imagen_principal_equipo
AFTER INSERT ON Imagenes_Equipo
FOR EACH ROW
BEGIN
    IF NEW.es_principal = TRUE THEN
        UPDATE Imagenes_Equipo
        SET es_principal = FALSE
        WHERE codigo_equipo = NEW.codigo_equipo AND id_imagen_equipo <> NEW.id_imagen_equipo;
    END IF;
END;
//

-- Trigger para validar solo una imagen principal por ambiente
CREATE TRIGGER trg_validar_imagen_principal_ambiente
AFTER INSERT ON Imagenes_Ambiente
FOR EACH ROW
BEGIN
    IF NEW.es_principal = TRUE THEN
        UPDATE Imagenes_Ambiente
        SET es_principal = FALSE
        WHERE id_ambiente = NEW.id_ambiente AND id_imagen_ambiente <> NEW.id_imagen_ambiente;
    END IF;
END;
//

-- Trigger para finalizar responsabilidades anteriores cuando inicia una nueva clase
CREATE TRIGGER trg_finalizar_responsabilidades_ambiente_anterior
BEFORE UPDATE ON Clases
FOR EACH ROW
BEGIN
    IF OLD.estado_clase <> 'En Curso' AND NEW.estado_clase = 'En Curso' THEN
        UPDATE Responsabilidades_Ambiente
        SET estado_responsabilidad = 'Finalizada', fecha_fin = NOW()
        WHERE id_ambiente = NEW.id_ambiente
        AND estado_responsabilidad = 'Activa'
        AND (fecha_fin IS NULL OR fecha_fin > NOW());
    END IF;
    
    IF OLD.estado_clase <> 'Finalizada' AND NEW.estado_clase = 'Finalizada' THEN
        UPDATE Responsabilidades_Ambiente
        SET estado_responsabilidad = 'Finalizada', fecha_fin = COALESCE(NEW.fecha_fin_real, NOW())
        WHERE id_clase = NEW.id_clase AND estado_responsabilidad = 'Activa';
    END IF;
END;
//

-- Trigger para calcular automáticamente la duración cuando se actualiza fecha_hora_fin
CREATE TRIGGER calcular_duracion_uso
BEFORE UPDATE ON Historial_Uso_Equipos
FOR EACH ROW
BEGIN
  IF NEW.fecha_hora_fin IS NOT NULL AND OLD.fecha_hora_fin IS NULL THEN
    SET NEW.duracion_minutos = TIMESTAMPDIFF(MINUTE, NEW.fecha_hora_inicio, NEW.fecha_hora_fin);
    SET NEW.estado = 'Finalizado';
  END IF;
END;
//

DELIMITER ;

-- ============================================
-- VISTAS
-- ============================================

CREATE VIEW Vista_Equipos_Con_Responsables AS
SELECT 
    e.codigo_equipo, e.r_centro, e.consecutivo, e.tipo, e.modelo,
    a.nombre_ambiente, a.codigo_ambiente, ee.estado_operativo, e.estado_fisico,
    GROUP_CONCAT(CONCAT(u.nombre_usuario, ' (', r.nombre_rol, ')')
        ORDER BY re.tipo_responsabilidad, u.nombre_usuario SEPARATOR ', ') AS responsables,
    COUNT(re.id_responsable) AS total_responsables
FROM Elementos e
LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
LEFT JOIN Responsables_Equipo re ON e.codigo_equipo = re.codigo_equipo AND re.estado_responsabilidad = 'Activo'
LEFT JOIN Usuarios u ON re.id_usuario = u.id_usuario
LEFT JOIN Roles r ON u.id_rol = r.id_rol
GROUP BY e.codigo_equipo, e.r_centro, e.consecutivo, e.tipo, e.modelo, 
         a.nombre_ambiente, a.codigo_ambiente, ee.estado_operativo, e.estado_fisico;

CREATE VIEW Vista_Equipos_Disponibles AS
SELECT 
    e.codigo_equipo, e.r_centro, e.consecutivo, e.tipo, e.modelo,
    CASE WHEN c.es_componente = TRUE THEN 'Componente Individual' ELSE 'Equipo Completo' END AS nombre_tipo,
    a.nombre_ambiente, a.codigo_ambiente, a.tipo_ambiente, e.estado_fisico, e.fecha_adquisicion
FROM Elementos e
INNER JOIN Categorias_Equipo c ON e.id_categoria = c.id_categoria
LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
WHERE ee.estado_operativo = 'Disponible' AND e.estado_fisico IN ('Nuevo', 'Bueno', 'Regular');

CREATE VIEW Vista_Mantenimientos_Proximos AS
SELECT 
    m.id_mantenimiento, e.codigo_equipo, e.r_centro, e.consecutivo, e.tipo, m.tipo_mantenimiento,
    m.fecha_proximo, DATEDIFF(m.fecha_proximo, CURDATE()) AS dias_restantes,
    a.nombre_ambiente, a.codigo_ambiente,
    CASE 
        WHEN DATEDIFF(m.fecha_proximo, CURDATE()) <= 7 THEN 'Urgente'
        WHEN DATEDIFF(m.fecha_proximo, CURDATE()) <= 30 THEN 'Próximo'
        ELSE 'Programado'
    END AS prioridad
FROM Mantenimiento m
INNER JOIN Elementos e ON m.codigo_equipo = e.codigo_equipo
LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
WHERE m.fecha_proximo IS NOT NULL AND m.fecha_proximo >= CURDATE()
AND m.estado_mantenimiento IN ('Programado', 'En Proceso')
ORDER BY m.fecha_proximo;

CREATE VIEW Vista_Ambientes_Con_Equipos AS
SELECT 
    a.id_ambiente, a.codigo_ambiente, a.nombre_ambiente, a.tipo_ambiente, 
    a.capacidad_personas, a.estado_ambiente,
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
    u.id_usuario, u.nombre_usuario, u.cedula, r.nombre_rol, 
    COUNT(DISTINCT re.codigo_equipo) AS equipos_asignados,
    GROUP_CONCAT(CONCAT(e.tipo, ' - ', COALESCE(e.consecutivo, e.r_centro))
        ORDER BY re.fecha_asignacion DESC SEPARATOR ' | ') AS detalle_equipos
FROM Usuarios u
INNER JOIN Roles r ON u.id_rol = r.id_rol
LEFT JOIN Responsables_Equipo re ON u.id_usuario = re.id_usuario AND re.estado_responsabilidad = 'Activo'
LEFT JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
WHERE u.estado = 'Activo'
GROUP BY u.id_usuario, u.nombre_usuario, u.cedula, r.nombre_rol;

CREATE VIEW Vista_Responsables_Actuales AS
SELECT 
    ra.id_responsabilidad_ambiente, ra.id_ambiente, a.nombre_ambiente, a.codigo_ambiente,
    ra.id_usuario, u.nombre_usuario, u.cedula, r.nombre_rol, ra.tipo_responsabilidad,
    ra.fecha_inicio, ra.fecha_fin, ra.id_clase, c.nombre_clase, c.codigo_ficha,
    c.fecha_clase, c.hora_inicio, c.hora_fin,
    CASE 
        WHEN ra.fecha_inicio <= NOW() AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= NOW()) 
        THEN 'Activo' ELSE 'Inactivo'
    END AS estado_actual
FROM Responsabilidades_Ambiente ra
INNER JOIN Ambientes a ON ra.id_ambiente = a.id_ambiente
INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
LEFT JOIN Roles r ON u.id_rol = r.id_rol
LEFT JOIN Clases c ON ra.id_clase = c.id_clase
WHERE ra.estado_responsabilidad = 'Activa';

-- ============================================
-- PROCEDIMIENTOS ALMACENADOS
-- ============================================

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
    
    UPDATE Estado_Equipo
    SET estado_operativo = 'En Uso', fecha_actualizacion = NOW(), actualizado_por = p_asignado_por
    WHERE codigo_equipo = p_codigo_equipo;
    
    WHILE i < total DO
        SET id_usuario_actual = JSON_EXTRACT(p_usuarios_json, CONCAT('$[', i, '].id_usuario'));
        SET tipo_resp = JSON_UNQUOTE(JSON_EXTRACT(p_usuarios_json, CONCAT('$[', i, '].tipo')));
        
        INSERT INTO Responsables_Equipo (codigo_equipo, id_usuario, tipo_responsabilidad, asignado_por)
        VALUES (p_codigo_equipo, id_usuario_actual, IFNULL(tipo_resp, 'Principal'), p_asignado_por);
        
        SET i = i + 1;
    END WHILE;
    
    INSERT INTO Historial_Equipos (codigo_equipo, tipo_evento, descripcion, estado_nuevo, registrado_por)
    VALUES (p_codigo_equipo, 'Asignación', CONCAT('Equipo asignado a ', total, ' responsable(s)'), 'En Uso', p_asignado_por);
END;
//

-- Procedimiento para devolver equipo y finalizar responsabilidades
CREATE PROCEDURE sp_devolver_equipo(IN p_codigo_equipo INT, IN p_actualizado_por INT)
BEGIN
    UPDATE Responsables_Equipo
    SET estado_responsabilidad = 'Finalizado', fecha_desvinculacion = NOW()
    WHERE codigo_equipo = p_codigo_equipo AND estado_responsabilidad = 'Activo';
    
    UPDATE Estado_Equipo
    SET estado_operativo = 'Disponible', fecha_actualizacion = NOW(), actualizado_por = p_actualizado_por
    WHERE codigo_equipo = p_codigo_equipo;
    
    INSERT INTO Historial_Equipos (codigo_equipo, tipo_evento, descripcion, estado_nuevo, registrado_por)
    VALUES (p_codigo_equipo, 'Devolución', 'Equipo devuelto y disponible', 'Disponible', p_actualizado_por);
END;
//

-- Procedimiento para asignación automática de equipos
CREATE PROCEDURE sp_asignar_automatico(
    IN p_id_usuario INT, IN p_id_ambiente INT, IN p_tipo_equipo VARCHAR(100), IN p_asignado_por INT
)
BEGIN
    DECLARE v_codigo_equipo INT;
    
    SELECT e.codigo_equipo INTO v_codigo_equipo
    FROM Elementos e
    INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
    WHERE ee.estado_operativo = 'Disponible'
    AND e.estado_fisico IN ('Nuevo', 'Bueno')
    AND (p_id_ambiente IS NULL OR e.id_ambiente = p_id_ambiente)
    AND (p_tipo_equipo IS NULL OR e.tipo = p_tipo_equipo)
    ORDER BY 
        CASE e.estado_fisico WHEN 'Nuevo' THEN 1 WHEN 'Bueno' THEN 2 ELSE 3 END,
        e.fecha_adquisicion DESC
    LIMIT 1;
    
    IF v_codigo_equipo IS NOT NULL THEN
        UPDATE Estado_Equipo
        SET estado_operativo = 'En Uso', fecha_actualizacion = NOW(), actualizado_por = p_asignado_por
        WHERE codigo_equipo = v_codigo_equipo;
        
        INSERT INTO Responsables_Equipo (codigo_equipo, id_usuario, tipo_responsabilidad, asignado_por)
        VALUES (v_codigo_equipo, p_id_usuario, 'Principal', p_asignado_por);
        
        INSERT INTO Historial_Equipos (codigo_equipo, tipo_evento, descripcion, estado_nuevo, registrado_por)
        VALUES (v_codigo_equipo, 'Asignación', 'Asignación automática de equipo', 'En Uso', p_asignado_por);
        
        SELECT v_codigo_equipo AS codigo_equipo_asignado, 'Asignación exitosa' AS mensaje;
    ELSE
        SELECT NULL AS codigo_equipo_asignado, 'No hay equipos disponibles' AS mensaje;
    END IF;
END;
//

-- Procedimiento para obtener historial completo de un equipo
CREATE PROCEDURE sp_historial_equipo(IN p_codigo_equipo INT)
BEGIN
    SELECT 
        h.tipo_evento, h.descripcion, h.fecha_evento,
        a1.nombre_ambiente AS ambiente_anterior, a2.nombre_ambiente AS ambiente_nuevo,
        h.estado_anterior, h.estado_nuevo, u.nombre_usuario AS registrado_por
    FROM Historial_Equipos h
    LEFT JOIN Ambientes a1 ON h.id_ambiente_anterior = a1.id_ambiente
    LEFT JOIN Ambientes a2 ON h.id_ambiente_nuevo = a2.id_ambiente
    LEFT JOIN Usuarios u ON h.registrado_por = u.id_usuario
    WHERE h.codigo_equipo = p_codigo_equipo
    ORDER BY h.fecha_evento DESC;
END;
//

-- Procedimiento para obtener equipos por usuario
CREATE PROCEDURE sp_equipos_por_usuario(IN p_id_usuario INT)
BEGIN
    SELECT 
        e.codigo_equipo, e.r_centro, e.consecutivo, e.placa, e.tipo, e.modelo, ee.estado_operativo,
        a.nombre_ambiente, a.codigo_ambiente, re.fecha_asignacion, re.tipo_responsabilidad,
        DATEDIFF(NOW(), re.fecha_asignacion) AS dias_asignado
    FROM Responsables_Equipo re
    INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
    LEFT JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo
    LEFT JOIN Ambientes a ON e.id_ambiente = a.id_ambiente
    WHERE re.id_usuario = p_id_usuario AND re.estado_responsabilidad = 'Activo'
    ORDER BY re.fecha_asignacion DESC;
END;
//

-- Procedimiento para reportar novedad con actualización de estado
CREATE PROCEDURE sp_reportar_novedad(
    IN p_codigo_equipo INT,
    IN p_tipo_novedad ENUM('Daño', 'Pérdida', 'Robo', 'Mal Funcionamiento', 'Daño Físico', 'Falta de Componente', 'Otro'),
    IN p_descripcion TEXT, IN p_reportado_por INT, IN p_actualizar_estado BOOLEAN
)
BEGIN
    INSERT INTO Novedades (codigo_equipo, tipo_novedad, descripcion, reportado_por)
    VALUES (p_codigo_equipo, p_tipo_novedad, p_descripcion, p_reportado_por);
    
    IF p_actualizar_estado = TRUE THEN
        UPDATE Estado_Equipo
        SET estado_operativo = 'Dañado', fecha_actualizacion = NOW(), actualizado_por = p_reportado_por
        WHERE codigo_equipo = p_codigo_equipo;
        
        INSERT INTO Historial_Equipos (codigo_equipo, tipo_evento, descripcion, estado_nuevo, registrado_por)
        VALUES (p_codigo_equipo, 'Cambio Estado', CONCAT('Estado cambiado por novedad: ', p_tipo_novedad), 'Dañado', p_reportado_por);
    END IF;
END;
//

-- Procedimiento para obtener estadísticas del sistema
CREATE PROCEDURE sp_estadisticas_sistema()
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM Elementos) AS total_equipos,
        (SELECT COUNT(*) FROM Elementos e INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo 
         WHERE ee.estado_operativo = 'Disponible') AS equipos_disponibles,
        (SELECT COUNT(*) FROM Elementos e INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo 
         WHERE ee.estado_operativo = 'En Uso') AS equipos_en_uso,
        (SELECT COUNT(*) FROM Elementos e INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo 
         WHERE ee.estado_operativo = 'En Mantenimiento') AS equipos_en_mantenimiento,
        (SELECT COUNT(*) FROM Elementos e INNER JOIN Estado_Equipo ee ON e.codigo_equipo = ee.codigo_equipo 
         WHERE ee.estado_operativo = 'Dañado') AS equipos_danados,
        (SELECT COUNT(*) FROM Usuarios WHERE estado = 'Activo') AS usuarios_activos,
        (SELECT COUNT(*) FROM Ambientes WHERE estado_ambiente = 'Activo') AS ambientes_activos,
        (SELECT COUNT(*) FROM Novedades WHERE estado_resolucion = 'Pendiente') AS novedades_pendientes,
        (SELECT COUNT(*) FROM Mantenimiento 
         WHERE fecha_proximo IS NOT NULL AND fecha_proximo >= CURDATE()
         AND DATEDIFF(fecha_proximo, CURDATE()) <= 30) AS mantenimientos_proximos_30dias;
END;
//

-- Procedimiento para iniciar una clase y asignar responsabilidades
CREATE PROCEDURE sp_iniciar_clase(IN p_id_clase INT, IN p_fecha_inicio_real DATETIME)
BEGIN
    DECLARE v_id_ambiente INT;
    DECLARE v_id_instructor INT;
    DECLARE v_fecha_fin_estimada DATETIME;
    DECLARE v_hora_fin TIME;
    DECLARE v_fecha_clase DATE;
    DECLARE v_done INT DEFAULT FALSE;
    DECLARE v_id_aprendiz INT;
    DECLARE cur_aprendices CURSOR FOR 
        SELECT id_aprendiz FROM Participantes_Clase WHERE id_clase = p_id_clase AND presente = TRUE;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
    
    SELECT id_ambiente, id_instructor, hora_fin, fecha_clase 
    INTO v_id_ambiente, v_id_instructor, v_hora_fin, v_fecha_clase
    FROM Clases WHERE id_clase = p_id_clase;
    
    IF v_id_ambiente IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Clase no encontrada';
    END IF;
    
    SET v_fecha_fin_estimada = CONCAT(v_fecha_clase, ' ', v_hora_fin);
    
    INSERT INTO Responsabilidades_Ambiente (id_ambiente, id_clase, id_usuario, tipo_responsabilidad, fecha_inicio, fecha_fin, estado_responsabilidad, creado_por)
    VALUES (v_id_ambiente, p_id_clase, v_id_instructor, 'Principal', p_fecha_inicio_real, v_fecha_fin_estimada, 'Activa', v_id_instructor);
    
    OPEN cur_aprendices;
    read_loop: LOOP
        FETCH cur_aprendices INTO v_id_aprendiz;
        IF v_done THEN LEAVE read_loop; END IF;
        
        INSERT INTO Responsabilidades_Ambiente (id_ambiente, id_clase, id_usuario, tipo_responsabilidad, fecha_inicio, fecha_fin, estado_responsabilidad, creado_por)
        VALUES (v_id_ambiente, p_id_clase, v_id_aprendiz, 'Secundario', p_fecha_inicio_real, v_fecha_fin_estimada, 'Activa', v_id_instructor);
    END LOOP;
    CLOSE cur_aprendices;
    
    UPDATE Clases SET estado_clase = 'En Curso', fecha_inicio_real = p_fecha_inicio_real WHERE id_clase = p_id_clase;
    
    SELECT 'Clase iniciada y responsabilidades asignadas correctamente' AS mensaje;
END;
//

-- Procedimiento para finalizar una clase y finalizar responsabilidades
CREATE PROCEDURE sp_finalizar_clase(IN p_id_clase INT, IN p_fecha_fin_real DATETIME)
BEGIN
    DECLARE v_fecha_fin DATETIME;
    SET v_fecha_fin = COALESCE(p_fecha_fin_real, NOW());
    
    UPDATE Clases SET estado_clase = 'Finalizada', fecha_fin_real = v_fecha_fin WHERE id_clase = p_id_clase;
    
    SELECT 'Clase finalizada y responsabilidades cerradas correctamente' AS mensaje;
END;
//

-- Procedimiento para obtener responsables actuales de un ambiente
CREATE PROCEDURE sp_responsables_ambiente_actual(IN p_id_ambiente INT, IN p_fecha_consulta DATETIME)
BEGIN
    SET p_fecha_consulta = COALESCE(p_fecha_consulta, NOW());
    
    SELECT 
        ra.id_responsabilidad_ambiente, ra.id_usuario, u.nombre_usuario, r.nombre_rol,
        ra.tipo_responsabilidad, ra.fecha_inicio, ra.fecha_fin, c.nombre_clase, c.id_clase, c.estado_clase
    FROM Responsabilidades_Ambiente ra
    INNER JOIN Usuarios u ON ra.id_usuario = u.id_usuario
    LEFT JOIN Roles r ON u.id_rol = r.id_rol
    LEFT JOIN Clases c ON ra.id_clase = c.id_clase
    WHERE ra.id_ambiente = p_id_ambiente
    AND ra.estado_responsabilidad = 'Activa'
    AND ra.fecha_inicio <= p_fecha_consulta
    AND (ra.fecha_fin IS NULL OR ra.fecha_fin >= p_fecha_consulta)
    ORDER BY ra.tipo_responsabilidad DESC, ra.fecha_inicio DESC;
END;
//

DELIMITER ;

-- ============================================
-- DATOS INICIALES
-- ============================================

INSERT INTO Roles (nombre_rol, descripcion) VALUES
('Administrador', 'Acceso total al sistema'),
('Instructor', 'Gestión de equipos y asignaciones'),
('Aprendiz', 'Consulta y uso de equipos asignados'),
('Cuentadante', 'Cuentadante responsable de su inventario asignado');

INSERT INTO Categorias_Equipo (nombre_categoria, descripcion, es_componente) VALUES
('ADAPTADOR DE RED', 'Adaptadores de red', FALSE),
('ACCES POINT', 'Puntos de acceso inalámbricos', FALSE),
('COMPONENTE ELECTRONICO', 'Componentes electrónicos diversos', TRUE),
('PORTATIL', 'Computadores portátiles', FALSE),
('CPU', 'Unidad central de procesamiento', FALSE),
('CPU INTEGRADA CON MONITOR', 'CPU integrada con monitor', FALSE),
('GAFAS DE REALIDAD VIRTUAL', 'Gafas de realidad virtual', FALSE),
('INSUMOS ELECTRICOS', 'Insumos y materiales eléctricos', TRUE),
('MODEM', 'Módems de red', FALSE),
('MODULO DE CIRCUITOS', 'Módulos de circuitos', TRUE),
('MONITOR', 'Pantallas y monitores', TRUE),
('MOTOR', 'Motores eléctricos', FALSE),
('PROYECTOR', 'Equipos de proyección', FALSE),
('ROUTER O ENRUTADOR', 'Routers y enrutadores de red', FALSE),
('SILLA', 'Sillas y mobiliario', FALSE),
('SISTEMA DE REALIDAD VIRTUAL', 'Sistemas completos de realidad virtual', FALSE),
('SWITCH', 'Switches de red', FALSE),
('TABLET', 'Tablets y dispositivos móviles', FALSE),
('TABLETA DIGITALIZADORA', 'Tabletas digitalizadoras', FALSE),
('ESTANTE', 'Estantes y mobiliario', FALSE),
('MESA', 'Mesas y mobiliario', FALSE),
('MOUSE', 'Dispositivos de entrada - Mouse', TRUE),
('TECLADO', 'Dispositivos de entrada - Teclado', TRUE),
('AIRE ACONDICIONADO', 'Equipos de aire acondicionado', FALSE)
ON DUPLICATE KEY UPDATE nombre_categoria = nombre_categoria;

INSERT INTO Ambientes (codigo_ambiente, nombre_ambiente, tipo_ambiente) VALUES
('101','Ambiente 101','Aula'), ('102','Ambiente 102','Aula'), ('103','Ambiente 103','Aula'),
('104','Ambiente 104','Aula'), ('105','Ambiente 105','Aula'), ('106','Ambiente 106','Aula'),
('107','Ambiente 107','Aula'), ('201','Ambiente 201','Aula'), ('202','Ambiente 202','Aula'),
('203','Ambiente 203','Aula'), ('204','Ambiente 204','Aula'), ('205','Ambiente 205','Aula'),
('301','Ambiente 301','Aula'), ('302','Ambiente 302','Aula'), ('401','Ambiente 401','Aula'),
('402','Ambiente 402','Aula'), ('403','Ambiente 403','Aula'), ('501','Ambiente 501','Aula'),
('502','Ambiente 502','Aula'), ('503','Ambiente 503','Aula'), ('504','Ambiente 504','Aula'),
('505','Ambiente 505','Aula'), ('506','Ambiente 506','Aula');

INSERT INTO Criterios_Asignacion (nombre_criterio, prioridad, descripcion, parametros) VALUES
('Estado Físico', 1, 'Prioriza equipos en mejor estado físico', '{"orden": ["Nuevo", "Bueno", "Regular"]}'),
('Fecha Adquisición', 2, 'Prioriza equipos más recientes', '{"orden": "DESC"}'),
('Mismo Ambiente', 3, 'Prioriza equipos del mismo ambiente solicitado', '{"peso": 0.8}');

INSERT INTO Usuarios (nombre_usuario, cedula, telefono, correo, contrasena, id_rol, estado) VALUES 
('Administrador Sistema', '1000000000', '3001234567', 'admin@sena.edu.co',
 '$2a$12$zz2nWS1PBuSGeX4gNQS5..Jk8Juo5gb8r8ZYDNZreGcND1jrHlVzq', 1, 'Activo');

-- ============================================
-- INSERTAR PERMISOS DEL SISTEMA
-- ============================================
INSERT IGNORE INTO Permisos (codigo_permiso, modulo, accion, descripcion) VALUES
-- Usuarios
('users:view', 'USERS', 'VIEW', 'Ver listado de usuarios'),
('users:view_detail', 'USERS', 'VIEW_DETAIL', 'Ver detalle de un usuario'),
('users:create', 'USERS', 'CREATE', 'Crear nuevos usuarios'),
('users:update', 'USERS', 'UPDATE', 'Editar usuarios'),
('users:delete', 'USERS', 'DELETE', 'Eliminar usuarios'),
('users:manage_roles', 'USERS', 'MANAGE_ROLES', 'Cambiar roles de usuarios'),

-- Equipos
('equipos:view', 'EQUIPOS', 'VIEW', 'Ver listado de equipos'),
('equipos:view_detail', 'EQUIPOS', 'VIEW_DETAIL', 'Ver detalle de equipo'),
('equipos:view_own', 'EQUIPOS', 'VIEW_OWN', 'Ver solo equipos asignados'),
('equipos:create', 'EQUIPOS', 'CREATE', 'Registrar nuevos equipos'),
('equipos:update', 'EQUIPOS', 'UPDATE', 'Editar equipos'),
('equipos:delete', 'EQUIPOS', 'DELETE', 'Eliminar equipos'),
('equipos:assign', 'EQUIPOS', 'ASSIGN', 'Asignar equipos a cualquier usuario'),
('equipos:assign_to_aprendiz', 'EQUIPOS', 'ASSIGN_TO_APRENDIZ', 'Asignar solo a aprendices'),
('equipos:manage_categories', 'EQUIPOS', 'MANAGE_CATEGORIES', 'Gestionar categorías de equipos'),

-- Novedades
('novedades:view', 'NOVEDADES', 'VIEW', 'Ver todas las novedades'),
('novedades:view_own', 'NOVEDADES', 'VIEW_OWN', 'Ver solo novedades de equipos propios'),
('novedades:create', 'NOVEDADES', 'CREATE', 'Registrar novedades'),
('novedades:create_own', 'NOVEDADES', 'CREATE_OWN', 'Registrar solo en equipos propios'),
('novedades:update', 'NOVEDADES', 'UPDATE', 'Editar novedades'),
('novedades:delete', 'NOVEDADES', 'DELETE', 'Eliminar novedades'),
('novedades:resolve', 'NOVEDADES', 'RESOLVE', 'Resolver novedades'),

-- Mantenimiento
('mantenimiento:view', 'MANTENIMIENTO', 'VIEW', 'Ver historial de mantenimiento'),
('mantenimiento:view_own', 'MANTENIMIENTO', 'VIEW_OWN', 'Ver mantenimiento de equipos propios'),
('mantenimiento:create', 'MANTENIMIENTO', 'CREATE', 'Programar mantenimiento'),
('mantenimiento:update', 'MANTENIMIENTO', 'UPDATE', 'Editar mantenimiento'),
('mantenimiento:delete', 'MANTENIMIENTO', 'DELETE', 'Eliminar registro de mantenimiento'),

-- Reportes
('reportes:view', 'REPORTES', 'VIEW', 'Ver reportes'),
('reportes:create', 'REPORTES', 'CREATE', 'Crear reportes'),
('reportes:update', 'REPORTES', 'UPDATE', 'Actualizar reportes'),
('reportes:delete', 'REPORTES', 'DELETE', 'Eliminar reportes'),
('reportes:export', 'REPORTES', 'EXPORT', 'Exportar reportes'),

-- Ambientes
('ambientes:view', 'AMBIENTES', 'VIEW', 'Ver ambientes'),
('ambientes:create', 'AMBIENTES', 'CREATE', 'Crear ambientes'),
('ambientes:update', 'AMBIENTES', 'UPDATE', 'Editar ambientes'),
('ambientes:delete', 'AMBIENTES', 'DELETE', 'Eliminar ambientes'),

-- Clases
('clases:view', 'CLASES', 'VIEW', 'Ver clases'),
('clases:create', 'CLASES', 'CREATE', 'Crear clases'),
('clases:update', 'CLASES', 'UPDATE', 'Actualizar/iniciar/finalizar clases'),
('clases:delete', 'CLASES', 'DELETE', 'Eliminar clases'),

-- Notificaciones
('notificaciones:view', 'NOTIFICACIONES', 'VIEW', 'Ver propias notificaciones'),
('notificaciones:create', 'NOTIFICACIONES', 'CREATE', 'Crear notificaciones para otros'),
('notificaciones:broadcast', 'NOTIFICACIONES', 'BROADCAST', 'Enviar notificaciones globales'),

-- Sistema
('system:view_config', 'SYSTEM', 'VIEW_CONFIG', 'Ver configuración'),
('system:update_config', 'SYSTEM', 'UPDATE_CONFIG', 'Modificar configuración'),
('system:view_audit', 'SYSTEM', 'VIEW_AUDIT', 'Ver auditoría'),

-- Roles
('roles:manage', 'ROLES', 'MANAGE', 'Gestionar roles y permisos');
