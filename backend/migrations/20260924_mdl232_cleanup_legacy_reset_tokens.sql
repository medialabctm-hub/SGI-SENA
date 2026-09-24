-- MDL-232: limpieza de tokens de reset legacy en claro (no SHA-256 hex de 64)
-- y de tokens ya expirados sin usar.
-- Idempotente: solo borra filas unused que no cumplen el formato de hash o están vencidas.

DELETE FROM Tokens_Recuperacion_Contrasena
WHERE usado = 0
  AND (
    token NOT REGEXP '^[a-f0-9]{64}$'
    OR fecha_expiracion < NOW()
  );
