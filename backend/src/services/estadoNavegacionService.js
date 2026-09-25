/**
 * Estado que muestra el sidebar junto a cada entrada de consulta
 * (p. ej. «3 por aprobar», «12 en uso ahora · 1 por revisar»).
 *
 * - Solo lectura: nunca dispara escrituras (a diferencia de listarMantenimientos,
 *   que actualiza estados al listar, aquí se cuenta con la misma regla sin escribir).
 * - Cada bloque se calcula con el MISMO alcance que la pantalla a la que lleva, y
 *   solo se devuelve a los roles que pueden abrir esa pantalla.
 * - Las definiciones coinciden con las del dashboard (estadisticasController).
 * - Si un bloque falla, se devuelve null para ese bloque sin romper el resto.
 */

/** Sesión abierta más allá de este tiempo se marca «por revisar» (nunca se cierra sola). */
export const SESION_LARGA_MINUTOS = 24 * 60;

const PERSONAL = ['Administrador', 'Instructor', 'Cuentadante'];
const GESTION = ['Administrador', 'Cuentadante'];

const numero = (valor) => Number(valor) || 0;

async function contarUno(db, sql, params = []) {
  const [[fila]] = await db.execute(sql, params);
  return fila || {};
}

async function estadoInventario({ equipoService, userId, rol }) {
  // Mismo servicio y alcance que el listado de «Consultar inventario» (vista por defecto).
  const resultado = await equipoService.listarEquipos({}, { page: 1, limit: 1 }, {}, userId, rol);
  return { total: numero(resultado?.pagination?.total) };
}

async function estadoPrestados(db) {
  // Mismo alcance que GET /api/equipos/uso/activas para el personal.
  const fila = await contarUno(
    db,
    `SELECT COUNT(*) AS en_uso,
            COALESCE(SUM(TIMESTAMPDIFF(MINUTE, fecha_hora_inicio, NOW()) > ?), 0) AS por_revisar
     FROM Historial_Uso_Equipos
     WHERE estado = 'En Uso'`,
    [SESION_LARGA_MINUTOS]
  );
  return { en_uso: numero(fila.en_uso), por_revisar: numero(fila.por_revisar) };
}

async function estadoAutorizaciones(db, userId) {
  const fila = await contarUno(
    db,
    `SELECT COALESCE(SUM(id_autorizador = ?), 0) AS por_aprobar,
            COALESCE(SUM(id_solicitante = ?), 0) AS mis_pendientes
     FROM Solicitudes_Autorizacion_Movimiento
     WHERE estado = 'Pendiente' AND (id_autorizador = ? OR id_solicitante = ?)`,
    [userId, userId, userId, userId]
  );
  return { por_aprobar: numero(fila.por_aprobar), mis_pendientes: numero(fila.mis_pendientes) };
}

async function estadoNovedades(db, userId, rol) {
  // Mismo alcance que listarNovedades: el Instructor solo ve equipos con responsabilidad activa.
  const alcance = rol === 'Instructor'
    ? `AND EXISTS (
         SELECT 1 FROM Responsables_Equipo re
         WHERE re.codigo_equipo = n.codigo_equipo AND re.id_usuario = ? AND re.estado_responsabilidad = 'Activo'
       )`
    : '';
  const fila = await contarUno(
    db,
    `SELECT COUNT(*) AS pendientes
     FROM Novedades n
     WHERE n.estado_resolucion IN ('Pendiente', 'En Proceso') ${alcance}`,
    rol === 'Instructor' ? [userId] : []
  );
  return { pendientes: numero(fila.pendientes) };
}

async function estadoMantenimientos(db) {
  const fila = await contarUno(
    db,
    `SELECT
       COALESCE(SUM(estado_mantenimiento = 'En Proceso'
         OR (estado_mantenimiento = 'Programado' AND fecha_mantenimiento <= NOW())), 0) AS en_proceso,
       COALESCE(SUM(estado_mantenimiento = 'Programado'
         AND fecha_proximo BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)), 0) AS proximos
     FROM Mantenimiento`
  );
  return { en_proceso: numero(fila.en_proceso), proximos: numero(fila.proximos) };
}

async function estadoAmbientes(db) {
  const fila = await contarUno(
    db,
    `SELECT COALESCE(SUM(estado_ambiente = 'Activo'), 0) AS activos,
            COALESCE(SUM(estado_ambiente = 'En Mantenimiento'), 0) AS en_mantenimiento
     FROM Ambientes`
  );
  return { activos: numero(fila.activos), en_mantenimiento: numero(fila.en_mantenimiento) };
}

async function estadoHorarios(db, userId, rol) {
  // Mismo alcance que listarClases: Instructor y Cuentadante ven sus propias clases.
  const propias = rol === 'Administrador' ? '' : 'AND id_instructor = ?';
  const fila = await contarUno(
    db,
    `SELECT COUNT(*) AS hoy, COALESCE(SUM(estado_clase = 'En Curso'), 0) AS en_curso
     FROM Clases
     WHERE fecha_clase = CURDATE() AND estado_clase <> 'Cancelada' ${propias}`,
    rol === 'Administrador' ? [] : [userId]
  );
  return { hoy: numero(fila.hoy), en_curso: numero(fila.en_curso) };
}

async function seguro(nombre, calcular, logger) {
  try {
    return await calcular();
  } catch (err) {
    logger?.warn?.('No se pudo calcular el estado del sidebar', { bloque: nombre, error: err?.message });
    return null;
  }
}

/**
 * @param {Object} deps
 * @param {{ execute: Function }} deps.db
 * @param {{ listarEquipos: Function }} deps.equipoService
 * @param {Object} [deps.logger]
 * @param {{ id: number, rol: string }} usuario
 */
export async function obtenerEstadoNavegacion({ db, equipoService, logger }, usuario) {
  const userId = usuario?.id;
  const rol = usuario?.rol;
  const estado = {
    inventario: await seguro('inventario', () => estadoInventario({ equipoService, userId, rol }), logger),
  };

  if (PERSONAL.includes(rol)) {
    estado.prestados = await seguro('prestados', () => estadoPrestados(db), logger);
    estado.autorizaciones = await seguro('autorizaciones', () => estadoAutorizaciones(db, userId), logger);
    estado.novedades = await seguro('novedades', () => estadoNovedades(db, userId, rol), logger);
    estado.horarios = await seguro('horarios', () => estadoHorarios(db, userId, rol), logger);
  }
  if (GESTION.includes(rol)) {
    estado.mantenimientos = await seguro('mantenimientos', () => estadoMantenimientos(db), logger);
    estado.ambientes = await seguro('ambientes', () => estadoAmbientes(db), logger);
  }

  return estado;
}
