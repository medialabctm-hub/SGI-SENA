-- MDL-229: revocación de sesiones JWT mediante token_version.
-- Cada sesión emitida lleva el claim token_version; el middleware lo compara con esta columna.
-- Incrementar la columna invalida todas las sesiones previas del usuario.
--
-- Idempotente (MySQL 8): solo agrega la columna si no existe; una segunda ejecución no cambia nada.
-- ORDEN DE DESPLIEGUE: aplicar ANTES de desplegar el backend. El backend nuevo selecciona
-- token_version en cada request autenticado y falla si la columna no existe.
-- Efecto esperado: los JWT emitidos antes del despliegue no traen el claim y reciben 401 una vez.

SET @mdl229_existe := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Usuarios'
    AND COLUMN_NAME = 'token_version'
);

SET @mdl229_sql := IF(
  @mdl229_existe = 0,
  'ALTER TABLE Usuarios ADD COLUMN token_version INT NOT NULL DEFAULT 0 COMMENT ''Se incrementa para invalidar las sesiones JWT vigentes (MDL-229)'' AFTER creado_por',
  'SELECT ''MDL-229: token_version ya existe'' AS info'
);

PREPARE mdl229_stmt FROM @mdl229_sql;
EXECUTE mdl229_stmt;
DEALLOCATE PREPARE mdl229_stmt;
