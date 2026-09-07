-- MDL-77 definition source for the MySQL 8 migration runner.
-- Do not execute this file with the mysql CLI: run from backend instead:
--   node scripts/migrate-autoservicio-cierre-clase.js
-- The runner reads this single CREATE PROCEDURE statement through mysql2,
-- validates it using a temporary routine, and restores the prior routine if
-- replacing sp_finalizar_clase fails. The marker is ROUTINE_COMMENT:
--   AUTOSERVICIO_CIERRE_V2
-- It is intentionally free of DELIMITER, PREPARE, EXECUTE and DROP statements.

CREATE PROCEDURE sp_finalizar_clase(IN p_id_clase INT, IN p_fecha_fin_real DATETIME)
COMMENT 'AUTOSERVICIO_CIERRE_V2'
BEGIN
    DECLARE v_id_ambiente INT DEFAULT NULL;
    DECLARE v_id_instructor INT DEFAULT NULL;
    DECLARE v_estado_clase VARCHAR(30) DEFAULT NULL;
    DECLARE v_fecha_fin DATETIME;
    DECLARE v_detalles_uso JSON;
    DECLARE v_array_length INT;
    DECLARE v_index INT DEFAULT 0;
    DECLARE v_registro JSON;
    DECLARE v_id_clase_registro INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT id_ambiente, id_instructor, estado_clase
    INTO v_id_ambiente, v_id_instructor, v_estado_clase
    FROM Clases WHERE id_clase = p_id_clase FOR UPDATE;

    IF v_id_ambiente IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Clase no encontrada';
    END IF;

    IF v_estado_clase = 'Finalizada' THEN
        -- Reintentos posteriores no vuelven a escribir fechas ni estados.
        COMMIT;
        SELECT 'Clase ya estaba finalizada; no se aplicaron cambios.' AS mensaje;
    ELSE
        IF v_estado_clase <> 'En Curso' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La clase no está en curso';
        END IF;
        IF p_fecha_fin_real IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fecha_fin_real es obligatoria. El sistema es 100% manual.';
        END IF;

        SET v_fecha_fin = p_fecha_fin_real;
    UPDATE Responsabilidades_Ambiente
    SET estado_responsabilidad = 'Finalizada', fecha_fin = v_fecha_fin
    WHERE id_clase = p_id_clase AND estado_responsabilidad = 'Activa';

    UPDATE Responsables_Equipo re
    INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
    SET re.estado_responsabilidad = 'Finalizado', re.fecha_desvinculacion = v_fecha_fin
    WHERE re.id_usuario = v_id_instructor
      AND re.estado_responsabilidad = 'Activo'
      AND re.observaciones LIKE CONCAT('%inicio de clase #', p_id_clase, '%')
      AND e.id_ambiente = v_id_ambiente;

    SELECT COALESCE(detalles_uso, JSON_ARRAY()) INTO v_detalles_uso
    FROM Ambientes WHERE id_ambiente = v_id_ambiente;
    SET v_array_length = JSON_LENGTH(v_detalles_uso);

    buscar_loop: WHILE v_index < v_array_length DO
        SET v_registro = JSON_EXTRACT(v_detalles_uso, CONCAT('$[', v_index, ']'));
        SET v_id_clase_registro = JSON_UNQUOTE(JSON_EXTRACT(v_registro, '$.id_clase'));
        IF v_id_clase_registro = p_id_clase THEN
            SET v_registro = JSON_SET(
                v_registro,
                '$.estado', 'Finalizada',
                '$.fecha_fin_real', DATE_FORMAT(v_fecha_fin, '%Y-%m-%d %H:%i:%s')
            );
            SET v_detalles_uso = JSON_SET(v_detalles_uso, CONCAT('$[', v_index, ']'), v_registro);
            LEAVE buscar_loop;
        END IF;
        SET v_index = v_index + 1;
    END WHILE buscar_loop;

    UPDATE Ambientes SET detalles_uso = v_detalles_uso WHERE id_ambiente = v_id_ambiente;
    UPDATE Clases SET estado_clase = 'Finalizada', fecha_fin_real = v_fecha_fin WHERE id_clase = p_id_clase;
    UPDATE Historial_Uso_Equipos
    SET estado = 'Finalizado', fecha_hora_fin = v_fecha_fin
    WHERE id_clase = p_id_clase AND estado = 'En Uso';

    COMMIT;

    SELECT 'Clase finalizada correctamente. Responsabilidades y asignaciones de equipos revertidas.' AS mensaje;
    END IF;
END
