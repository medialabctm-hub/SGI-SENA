-- ============================================================
-- Migración manual: sp_finalizar_clase cierra préstamos de autoservicio
-- ============================================================
-- Por qué es manual: el procedimiento original fue creado por un usuario
-- administrador (root) al inicializar la base de datos. En MySQL 8, un
-- usuario de aplicación sin el privilegio SYSTEM_USER (como el que usa el
-- backend, ej. sge_user) NO puede hacer DROP/CREATE sobre una rutina cuyo
-- DEFINER sí tiene ese privilegio. Por eso el backend no puede aplicar este
-- cambio solo al arrancar (a diferencia de las columnas nuevas en
-- Historial_Uso_Equipos, que sí se agregan automáticamente).
--
-- Cuándo ejecutarlo: una sola vez por base de datos, con un usuario con
-- privilegios de administrador (root o equivalente).
--
-- Cómo ejecutarlo:
--   Local (docker):
--     docker exec -i sge-sena-db mysql -u root -p<DB_ROOT_PASSWORD> railway < backend/scripts/migrate-autoservicio-cierre-clase.sql
--   Railway:
--     railway ssh --project=<id> --environment=<id> --service=<id> -- \
--       mysql -h <host> -u root -p<password> <database> < migrate-autoservicio-cierre-clase.sql
--     (o pegar el contenido de este archivo en la consola MySQL de Railway)
--
-- Es idempotente: si ya se aplicó (detectado por el marcador AUTOSERVICIO_CIERRE_V1
-- en el cuerpo del procedimiento), volver a ejecutarlo no causa problemas.

DELIMITER //

DROP PROCEDURE IF EXISTS sp_finalizar_clase//

CREATE PROCEDURE sp_finalizar_clase(IN p_id_clase INT, IN p_fecha_fin_real DATETIME)
COMMENT 'AUTOSERVICIO_CIERRE_V1'
BEGIN
    DECLARE v_id_ambiente INT;
    DECLARE v_id_instructor INT;
    DECLARE v_fecha_fin DATETIME;
    DECLARE v_detalles_uso JSON;
    DECLARE v_array_length INT;
    DECLARE v_index INT DEFAULT 0;
    DECLARE v_registro JSON;
    DECLARE v_id_clase_registro INT;

    SELECT id_ambiente, id_instructor INTO v_id_ambiente, v_id_instructor
    FROM Clases WHERE id_clase = p_id_clase;

    IF v_id_ambiente IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Clase no encontrada';
    END IF;

    IF p_fecha_fin_real IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fecha_fin_real es obligatoria. El sistema es 100% manual.';
    END IF;

    SET v_fecha_fin = p_fecha_fin_real;

    UPDATE Responsabilidades_Ambiente
    SET estado_responsabilidad = 'Finalizada',
        fecha_fin = v_fecha_fin
    WHERE id_clase = p_id_clase
      AND estado_responsabilidad = 'Activa';

    UPDATE Responsables_Equipo re
    INNER JOIN Elementos e ON re.codigo_equipo = e.codigo_equipo
    SET re.estado_responsabilidad = 'Finalizado',
        re.fecha_desvinculacion = v_fecha_fin
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

    UPDATE Ambientes
    SET detalles_uso = v_detalles_uso
    WHERE id_ambiente = v_id_ambiente;

    UPDATE Clases SET estado_clase = 'Finalizada', fecha_fin_real = v_fecha_fin WHERE id_clase = p_id_clase;

    UPDATE Historial_Uso_Equipos
    SET estado = 'Finalizado',
        fecha_hora_fin = v_fecha_fin
    WHERE id_clase = p_id_clase
      AND estado = 'En Uso';

    SELECT 'Clase finalizada correctamente. Responsabilidades y asignaciones de equipos revertidas.' AS mensaje;
END//

DELIMITER ;
