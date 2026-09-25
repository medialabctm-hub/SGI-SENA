-- ============================================================
-- Auditoría de duplicados y trazabilidad (armonización de navegación)
-- ============================================================
-- Script de SOLO LECTURA: únicamente sentencias SELECT. No modifica datos
-- ni esquema. Ver docs/armonizacion-navegacion/01-DIAGNOSTICO.md §9.
--
-- Uso (contra una copia o réplica, con un usuario de solo lectura):
--   mysql -h <host> -P <puerto> -u <usuario_lectura> -p <base> < auditoria-trazabilidad-solo-lectura.sql
--
-- Las consultas devuelven identificadores internos y conteos; evitan
-- nombres y documentos para que el resultado pueda adjuntarse a un ticket.
-- ============================================================

SET SESSION TRANSACTION READ ONLY;
SET SESSION time_zone = '-05:00';

-- ------------------------------------------------------------
-- Q1. Placas duplicadas tras normalizar mayúsculas y espacios.
--     codigo_equipo es PK: no puede repetirse. La placa no es única.
-- ------------------------------------------------------------
SELECT UPPER(TRIM(placa))            AS placa_normalizada,
       COUNT(*)                      AS filas,
       GROUP_CONCAT(codigo_equipo ORDER BY codigo_equipo) AS codigos_equipo,
       COUNT(DISTINCT id_ambiente)   AS ambientes_distintos
FROM Elementos
WHERE placa IS NOT NULL AND TRIM(placa) <> ''
GROUP BY UPPER(TRIM(placa))
HAVING COUNT(*) > 1
ORDER BY filas DESC;

-- ------------------------------------------------------------
-- Q2. Placas vacías, nulas o genéricas (posibles falsos positivos de Q1).
-- ------------------------------------------------------------
SELECT CASE
         WHEN placa IS NULL THEN 'NULL'
         WHEN TRIM(placa) = '' THEN 'VACIA'
         WHEN UPPER(TRIM(placa)) IN ('S/N', 'SN', 'N/A', 'NA', '0') THEN 'GENERICA'
         WHEN placa <> TRIM(placa) THEN 'CON_ESPACIOS'
       END AS categoria,
       COUNT(*) AS filas
FROM Elementos
WHERE placa IS NULL OR TRIM(placa) = '' OR placa <> TRIM(placa)
   OR UPPER(TRIM(placa)) IN ('S/N', 'SN', 'N/A', 'NA', '0')
GROUP BY categoria;

-- ------------------------------------------------------------
-- Q3. Asignaciones activas repetidas para el mismo equipo/usuario/tipo.
--     Multiplican filas en listados con INNER JOIN (H8).
-- ------------------------------------------------------------
SELECT codigo_equipo,
       COALESCE(CAST(id_usuario AS CHAR), CONCAT('ext:', COALESCE(documento_externo, 'sin_doc'))) AS titular,
       tipo_responsabilidad,
       COUNT(*) AS activas,
       GROUP_CONCAT(id_responsable ORDER BY id_responsable) AS ids_responsable
FROM Responsables_Equipo
WHERE estado_responsabilidad = 'Activo'
GROUP BY codigo_equipo, titular, tipo_responsabilidad
HAVING COUNT(*) > 1
ORDER BY activas DESC;

-- ------------------------------------------------------------
-- Q4. Sesiones de uso abiertas: antigüedad, origen probable y si pueden
--     cerrarse por algún flujo (H6). Solo marca; no cierra nada.
-- ------------------------------------------------------------
SELECT hu.id_historial,
       hu.codigo_equipo,
       hu.fecha_hora_inicio,
       TIMESTAMPDIFF(HOUR, hu.fecha_hora_inicio, NOW()) AS horas_abierta,
       CASE
         WHEN hu.id_aprendiz IS NOT NULL OR hu.idempotency_key IS NOT NULL THEN 'autoservicio'
         WHEN hu.id_usuario IS NULL THEN 'registro_externo'
         ELSE 'app_web'
       END AS origen_probable,
       CASE
         WHEN hu.id_clase IS NOT NULL THEN 'se cierra al finalizar la clase'
         WHEN hu.id_usuario IS NOT NULL THEN 'solo el mismo usuario vía /uso/fin'
         ELSE 'ningún flujo web la cierra'
       END AS cierre_posible,
       c.estado_clase
FROM Historial_Uso_Equipos hu
LEFT JOIN Clases c ON c.id_clase = hu.id_clase
WHERE hu.estado = 'En Uso'
ORDER BY hu.fecha_hora_inicio;

-- ------------------------------------------------------------
-- Q5. Sesiones activas solapadas en el mismo equipo.
-- ------------------------------------------------------------
SELECT a.codigo_equipo,
       a.id_historial AS sesion_a,
       b.id_historial AS sesion_b,
       a.fecha_hora_inicio AS inicio_a,
       b.fecha_hora_inicio AS inicio_b
FROM Historial_Uso_Equipos a
INNER JOIN Historial_Uso_Equipos b
  ON b.codigo_equipo = a.codigo_equipo
 AND b.id_historial > a.id_historial
 AND b.estado = 'En Uso'
WHERE a.estado = 'En Uso'
ORDER BY a.codigo_equipo, a.id_historial;

-- ------------------------------------------------------------
-- Q6. Sesiones cerradas con duración inválida o sin inicio/fin coherente.
--     El informe las excluye de los agregados (criterio documentado).
-- ------------------------------------------------------------
SELECT id_historial, codigo_equipo, estado, fecha_hora_inicio, fecha_hora_fin, duracion_minutos,
       CASE
         WHEN estado = 'Finalizado' AND fecha_hora_fin IS NULL THEN 'finalizada_sin_fin'
         WHEN fecha_hora_fin IS NOT NULL AND fecha_hora_fin < fecha_hora_inicio THEN 'fin_anterior_a_inicio'
         WHEN duracion_minutos IS NOT NULL AND duracion_minutos < 0 THEN 'duracion_negativa'
       END AS problema
FROM Historial_Uso_Equipos
WHERE (estado = 'Finalizado' AND fecha_hora_fin IS NULL)
   OR (fecha_hora_fin IS NOT NULL AND fecha_hora_fin < fecha_hora_inicio)
   OR (duracion_minutos IS NOT NULL AND duracion_minutos < 0);

-- ------------------------------------------------------------
-- Q7. Verificaciones repetidas del mismo equipo, usuario y estado en menos
--     de 2 minutos (posibles reintentos). Falsos positivos: repeticiones
--     legítimas muy seguidas.
-- ------------------------------------------------------------
SELECT v1.codigo_equipo, v1.id_usuario, v1.estado_verificacion,
       v1.id_verificacion AS primera, v2.id_verificacion AS repetida,
       TIMESTAMPDIFF(SECOND, v1.fecha_verificacion, v2.fecha_verificacion) AS segundos_entre
FROM Verificaciones_Inventario v1
INNER JOIN Verificaciones_Inventario v2
  ON v2.codigo_equipo = v1.codigo_equipo
 AND v2.id_usuario = v1.id_usuario
 AND v2.estado_verificacion = v1.estado_verificacion
 AND v2.id_verificacion > v1.id_verificacion
 AND v2.fecha_verificacion BETWEEN v1.fecha_verificacion AND v1.fecha_verificacion + INTERVAL 2 MINUTE;

-- ------------------------------------------------------------
-- Q8. Eventos enlazados: novedad creada durante una verificación
--     «Con Novedad» (mismo equipo, mismo actor, misma descripción, ±120 s).
--     La cronología los agrupa con esta misma regla.
-- ------------------------------------------------------------
SELECT vi.id_verificacion, n.id_novedad, vi.codigo_equipo,
       ABS(TIMESTAMPDIFF(SECOND, vi.fecha_verificacion, n.fecha_novedad)) AS segundos_entre
FROM Verificaciones_Inventario vi
INNER JOIN Novedades n
  ON n.codigo_equipo = vi.codigo_equipo
 AND n.reportado_por = vi.id_usuario
 AND n.descripcion = vi.observaciones
 AND n.fecha_novedad BETWEEN vi.fecha_verificacion - INTERVAL 120 SECOND
                         AND vi.fecha_verificacion + INTERVAL 120 SECOND
WHERE vi.estado_verificacion = 'Con Novedad';

-- ------------------------------------------------------------
-- Q9. Reportes automáticos de mantenimiento y su mantenimiento candidato.
--     Varios candidatos = emparejamiento ambiguo (no se agrupa).
-- ------------------------------------------------------------
SELECT r.id_reporte, r.codigo_equipo, r.fecha_generacion,
       COUNT(m.id_mantenimiento) AS mantenimientos_candidatos,
       GROUP_CONCAT(m.id_mantenimiento) AS ids_mantenimiento
FROM Reportes r
LEFT JOIN Mantenimiento m
  ON m.codigo_equipo = r.codigo_equipo
 AND m.realizado_por = r.generado_por
 AND r.titulo LIKE CONCAT('Mantenimiento ', m.tipo_mantenimiento, ' - %')
WHERE r.tipo_reporte = 'Mantenimiento'
GROUP BY r.id_reporte, r.codigo_equipo, r.fecha_generacion
ORDER BY mantenimientos_candidatos DESC;

-- ------------------------------------------------------------
-- Q10. Conciliación de contadores por ambiente (H7): total frente a la
--      suma de estados operativos, contando la ausencia de Estado_Equipo.
-- ------------------------------------------------------------
SELECT a.id_ambiente,
       a.codigo_ambiente,
       COUNT(e.codigo_equipo)                                                     AS total_equipos,
       SUM(ee.codigo_equipo IS NULL)                                              AS sin_estado_registrado,
       SUM(COALESCE(ee.estado_operativo, 'Disponible') = 'Disponible')            AS disponibles_como_listado,
       SUM(ee.estado_operativo = 'Disponible')                                    AS disponibles_como_ficha_anterior,
       SUM(ee.estado_operativo = 'En Uso')                                        AS en_uso,
       SUM(ee.estado_operativo = 'En Mantenimiento')                              AS en_mantenimiento,
       SUM(ee.estado_operativo = 'Dañado')                                        AS danados,
       SUM(ee.estado_operativo = 'Dado de Baja')                                  AS dados_de_baja
FROM Ambientes a
LEFT JOIN Elementos e ON e.id_ambiente = a.id_ambiente
LEFT JOIN Estado_Equipo ee ON ee.codigo_equipo = e.codigo_equipo
GROUP BY a.id_ambiente, a.codigo_ambiente
ORDER BY a.codigo_ambiente;

-- ------------------------------------------------------------
-- Q11. Filas multiplicadas por el JOIN anterior de novedades (H8):
--      cuántas veces aparecería cada novedad para cada usuario.
-- ------------------------------------------------------------
SELECT n.id_novedad, re.id_usuario, COUNT(*) AS apariciones
FROM Novedades n
INNER JOIN Responsables_Equipo re
  ON re.codigo_equipo = n.codigo_equipo
 AND re.estado_responsabilidad = 'Activo'
WHERE re.id_usuario IS NOT NULL
GROUP BY n.id_novedad, re.id_usuario
HAVING COUNT(*) > 1;

-- ------------------------------------------------------------
-- Q12. Eventos de historial con tipo no registrado por el código actual
--      (p. ej. 'Asignación'/'Devolución' de cargas antiguas).
-- ------------------------------------------------------------
SELECT tipo_evento, COUNT(*) AS filas, MIN(fecha_evento) AS primero, MAX(fecha_evento) AS ultimo
FROM Historial_Equipos
GROUP BY tipo_evento;
