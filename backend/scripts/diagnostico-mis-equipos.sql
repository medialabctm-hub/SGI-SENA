-- ============================================================
-- Diagnóstico BUG-01: "Mis Equipos" aparece vacío tras habilitar un equipo
-- ============================================================
-- Script de SOLO LECTURA. No modifica datos ni esquema.
--
-- Uso:
--   mysql -h <host> -P <puerto> -u <usuario> -p <base_de_datos> < diagnostico-mis-equipos.sql
--
-- Objetivo: determinar por qué una habilitación creada correctamente no se
-- muestra en "Mis Equipos". La pantalla exige que la fila cumpla LAS TRES
-- condiciones de la consulta 4.
-- ============================================================


-- ------------------------------------------------------------
-- 1. ¿Cuál es el DEFAULT real de estado_responsabilidad?
--    Esperado: 'Activo'. Si es NULL, vacío u otro valor, esta es la causa raíz:
--    las filas nacen invisibles para "Mis Equipos".
-- ------------------------------------------------------------
SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Responsables_Equipo'
  AND COLUMN_NAME = 'estado_responsabilidad';


-- ------------------------------------------------------------
-- 2. Distribución real de los valores almacenados.
--    Un valor distinto de 'Activo'/'Finalizado' confirma el desajuste.
-- ------------------------------------------------------------
SELECT
    estado_responsabilidad,
    COUNT(*)                                        AS filas,
    SUM(fecha_desvinculacion IS NULL)               AS sin_fecha_desvinculacion,
    MAX(fecha_asignacion)                           AS ultima_asignacion
FROM Responsables_Equipo
GROUP BY estado_responsabilidad
ORDER BY filas DESC;


-- ------------------------------------------------------------
-- 3. Las 20 habilitaciones más recientes, con el motivo exacto por el que
--    cada una se vería o no en "Mis Equipos".
-- ------------------------------------------------------------
SELECT
    re.id_responsable,
    re.id_usuario,
    u.nombre_usuario,
    re.codigo_equipo,
    e.placa                                         AS codigo_inventario,
    re.estado_responsabilidad,
    re.fecha_desvinculacion,
    LEFT(COALESCE(re.observaciones, ''), 60)        AS observaciones,
    CASE
        WHEN re.id_usuario IS NULL
            THEN 'NO SE VE: asignación externa sin id_usuario'
        WHEN re.estado_responsabilidad <> 'Activo'
            THEN CONCAT('NO SE VE: estado = ', COALESCE(re.estado_responsabilidad, 'NULL'))
        WHEN re.fecha_desvinculacion IS NOT NULL
            THEN 'NO SE VE: tiene fecha de desvinculación (asignación temporal de clase)'
        WHEN re.observaciones LIKE '%inicio de clase #%'
            THEN 'NO SE VE: marcada como asignación automática de clase'
        ELSE 'SE VE en Mis Equipos'
    END                                             AS diagnostico
FROM Responsables_Equipo re
LEFT JOIN Usuarios  u ON u.id_usuario   = re.id_usuario
LEFT JOIN Elementos e ON e.codigo_equipo = re.codigo_equipo
ORDER BY re.fecha_asignacion DESC
LIMIT 20;


-- ------------------------------------------------------------
-- 4. Consulta equivalente a la de "Mis Equipos".
--    Sustituye @ID_USUARIO por el id del usuario que reporta el problema.
--    Si la consulta 3 dice "SE VE" y esta no devuelve filas, el problema está
--    en la capa HTTP (token de otro usuario), no en los datos.
-- ------------------------------------------------------------
SET @ID_USUARIO = 0;  -- <<< reemplazar por el id_usuario a diagnosticar

SELECT
    e.codigo_equipo,
    e.placa AS codigo_inventario,
    e.tipo,
    re.fecha_asignacion,
    re.tipo_responsabilidad
FROM Responsables_Equipo re
INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
WHERE re.id_usuario = @ID_USUARIO
  AND re.estado_responsabilidad = 'Activo'
  AND re.fecha_desvinculacion IS NULL
  AND (re.observaciones IS NULL OR re.observaciones NOT LIKE '%inicio de clase #%')
ORDER BY re.fecha_asignacion DESC;
