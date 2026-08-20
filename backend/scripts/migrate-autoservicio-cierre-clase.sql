-- ============================================================
-- MDL-77: migración idempotente de cierre de autoservicio
-- ============================================================
-- Versión observable: AUTOSERVICIO_CIERRE_V1 (ROUTINE_COMMENT de
-- sp_finalizar_clase). Puede verificarse con:
--   SELECT ROUTINE_COMMENT FROM INFORMATION_SCHEMA.ROUTINES
--   WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'sp_finalizar_clase';
--
-- Ejecute con un usuario administrador. El backend normalmente puede añadir
-- columnas e índices, pero no siempre puede reemplazar una rutina cuyo DEFINER
-- es root/SYSTEM_USER. Este script no cambia la rutina si ya tiene el marcador;
-- por tanto una segunda ejecución no hace DROP/CREATE ni pierde privilegios.
--
-- Límite de validación: este archivo usa SQL dinámico de MySQL 8 para crear una
-- rutina solo dentro del guard. Las pruebas validan estructura y delimitadores;
-- la sintaxis final debe comprobarse en una instancia MySQL 8 no productiva.

DELIMITER //

DROP PROCEDURE IF EXISTS sp_migrate_autoservicio_cierre_v1//

CREATE PROCEDURE sp_migrate_autoservicio_cierre_v1()
BEGIN
    DECLARE v_routine_comment TEXT DEFAULT '';

    SELECT COALESCE(ROUTINE_COMMENT, '') INTO v_routine_comment
    FROM INFORMATION_SCHEMA.ROUTINES
    WHERE ROUTINE_SCHEMA = DATABASE()
      AND ROUTINE_NAME = 'sp_finalizar_clase'
    LIMIT 1;

    IF v_routine_comment NOT LIKE '%AUTOSERVICIO_CIERRE_V1%' THEN
        DROP PROCEDURE IF EXISTS sp_finalizar_clase;

        SET @autoservicio_cierre_sql = CONCAT(
            'CREATE PROCEDURE sp_finalizar_clase(IN p_id_clase INT, IN p_fecha_fin_real DATETIME)', CHAR(10),
            'COMMENT ''AUTOSERVICIO_CIERRE_V1''', CHAR(10),
            'BEGIN', CHAR(10),
            '    DECLARE v_id_ambiente INT;', CHAR(10),
            '    DECLARE v_id_instructor INT;', CHAR(10),
            '    DECLARE v_fecha_fin DATETIME;', CHAR(10),
            '    DECLARE v_detalles_uso JSON;', CHAR(10),
            '    DECLARE v_array_length INT;', CHAR(10),
            '    DECLARE v_index INT DEFAULT 0;', CHAR(10),
            '    DECLARE v_registro JSON;', CHAR(10),
            '    DECLARE v_id_clase_registro INT;', CHAR(10),
            '    SELECT id_ambiente, id_instructor INTO v_id_ambiente, v_id_instructor FROM Clases WHERE id_clase = p_id_clase;', CHAR(10),
            '    IF v_id_ambiente IS NULL THEN SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''Clase no encontrada''; END IF;', CHAR(10),
            '    IF p_fecha_fin_real IS NULL THEN SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''fecha_fin_real es obligatoria. El sistema es 100% manual.''; END IF;', CHAR(10),
            '    SET v_fecha_fin = p_fecha_fin_real;', CHAR(10),
            '    UPDATE Responsabilidades_Ambiente SET estado_responsabilidad = ''Finalizada'', fecha_fin = v_fecha_fin WHERE id_clase = p_id_clase AND estado_responsabilidad = ''Activa'';', CHAR(10),
            '    UPDATE Responsables_Equipo re INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo SET re.estado_responsabilidad = ''Finalizado'', re.fecha_desvinculacion = v_fecha_fin WHERE re.id_usuario = v_id_instructor AND re.estado_responsabilidad = ''Activo'' AND re.observaciones LIKE CONCAT(''%inicio de clase #'', p_id_clase, ''%'') AND e.id_ambiente = v_id_ambiente;', CHAR(10),
            '    SELECT COALESCE(detalles_uso, JSON_ARRAY()) INTO v_detalles_uso FROM Ambientes WHERE id_ambiente = v_id_ambiente;', CHAR(10),
            '    SET v_array_length = JSON_LENGTH(v_detalles_uso);', CHAR(10),
            '    buscar_loop: WHILE v_index < v_array_length DO', CHAR(10),
            '        SET v_registro = JSON_EXTRACT(v_detalles_uso, CONCAT(''$['', v_index, '']''));', CHAR(10),
            '        SET v_id_clase_registro = JSON_UNQUOTE(JSON_EXTRACT(v_registro, ''$.id_clase''));', CHAR(10),
            '        IF v_id_clase_registro = p_id_clase THEN', CHAR(10),
            '            SET v_registro = JSON_SET(v_registro, ''$.estado'', ''Finalizada'', ''$.fecha_fin_real'', DATE_FORMAT(v_fecha_fin, ''%Y-%m-%d %H:%i:%s''));', CHAR(10),
            '            SET v_detalles_uso = JSON_SET(v_detalles_uso, CONCAT(''$['', v_index, '']''), v_registro);', CHAR(10),
            '            LEAVE buscar_loop;', CHAR(10),
            '        END IF;', CHAR(10),
            '        SET v_index = v_index + 1;', CHAR(10),
            '    END WHILE buscar_loop;', CHAR(10),
            '    UPDATE Ambientes SET detalles_uso = v_detalles_uso WHERE id_ambiente = v_id_ambiente;', CHAR(10),
            '    UPDATE Clases SET estado_clase = ''Finalizada'', fecha_fin_real = v_fecha_fin WHERE id_clase = p_id_clase;', CHAR(10),
            '    UPDATE Historial_Uso_Equipos SET estado = ''Finalizado'', fecha_hora_fin = v_fecha_fin WHERE id_clase = p_id_clase AND estado = ''En Uso'';', CHAR(10),
            '    SELECT ''Clase finalizada correctamente. Responsabilidades y asignaciones de equipos revertidas.'' AS mensaje;', CHAR(10),
            'END'
        );
        PREPARE autoservicio_cierre_stmt FROM @autoservicio_cierre_sql;
        EXECUTE autoservicio_cierre_stmt;
        DEALLOCATE PREPARE autoservicio_cierre_stmt;
    END IF;
END//

CALL sp_migrate_autoservicio_cierre_v1()//
DROP PROCEDURE sp_migrate_autoservicio_cierre_v1//

DELIMITER ;
