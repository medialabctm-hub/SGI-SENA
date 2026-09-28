const positiveId = (value, name) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || !/^\d+$/.test(String(value))) throw new Error(`${name} inválido`);
  return number;
};

const validDate = (value, name) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} inválida`);
  }
  return value;
};

/** La consulta y el COUNT comparten el mismo WHERE para que la paginación no infle el alcance. */
export function buildPrestamosInformeQuery({ rol, id, query = {} }) {
  if (!['Administrador', 'Cuentadante'].includes(rol)) throw new Error('Rol sin acceso al informe');
  const page = query.page === undefined ? 1 : positiveId(query.page, 'Página');
  const limit = query.limit === undefined ? 50 : positiveId(query.limit, 'Límite');
  if (limit > 100 || page > 100000) throw new Error('Paginación fuera de rango');
  if (query.fecha_desde && query.fecha_hasta && validDate(query.fecha_desde, 'Fecha inicial') > validDate(query.fecha_hasta, 'Fecha final')) throw new Error('Rango de fechas inválido');
  const conditions = [];
  const params = [];
  if (rol === 'Cuentadante') {
    conditions.push('e.id_cuentadante = ?');
    params.push(positiveId(id, 'Usuario'));
  } else if (query.cuentadante) {
    conditions.push('e.id_cuentadante = ?');
    params.push(positiveId(query.cuentadante, 'Cuentadante'));
  }
  if (query.documento_cuentadante) {
    if (rol !== 'Administrador' || typeof query.documento_cuentadante !== 'string' || !/^\d{5,20}$/.test(query.documento_cuentadante)) throw new Error('Documento de cuentadante inválido');
    conditions.push('c.cedula = ?');
    params.push(query.documento_cuentadante);
  }
  if (query.ambiente) {
    conditions.push('e.id_ambiente = ?');
    params.push(positiveId(query.ambiente, 'Ambiente'));
  }
  if (query.equipo) {
    conditions.push('hu.codigo_equipo = ?');
    params.push(positiveId(query.equipo, 'Equipo'));
  }
  if (query.placa) {
    if (typeof query.placa !== 'string' || query.placa.length > 80 || !query.placa.trim()) throw new Error('Placa inválida');
    conditions.push('e.placa = ?');
    params.push(query.placa.trim());
  }
  if (query.estado) {
    if (!['En Uso', 'Finalizado'].includes(query.estado)) throw new Error('Estado inválido');
    conditions.push('hu.estado = ?');
    params.push(query.estado);
  }
  if (query.fecha_desde) {
    conditions.push('hu.fecha_hora_inicio >= ?');
    params.push(validDate(query.fecha_desde, 'Fecha inicial'));
  }
  if (query.fecha_hasta) {
    conditions.push('hu.fecha_hora_inicio < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(validDate(query.fecha_hasta, 'Fecha final'));
  }
  const fromWhere = ` FROM Historial_Uso_Equipos hu
    INNER JOIN Elementos e ON e.codigo_equipo = hu.codigo_equipo
    LEFT JOIN Ambientes a ON a.id_ambiente = e.id_ambiente
    LEFT JOIN Usuarios u ON u.id_usuario = hu.id_usuario
    LEFT JOIN Usuarios c ON c.id_usuario = e.id_cuentadante
    WHERE ${conditions.length ? conditions.join(' AND ') : '1=1'}`;
  const dataSql = `SELECT hu.id_historial, hu.codigo_equipo, e.placa AS codigo_inventario,
      e.tipo AS equipo_tipo, e.modelo AS equipo_modelo,
      e.id_ambiente, a.nombre_ambiente AS ambiente_actual,
      e.id_cuentadante, COALESCE(c.nombre_usuario, e.cuentadante_principal) AS cuentadante_nombre,
      COALESCE(u.nombre_usuario, hu.nombre_externo, hu.nombre_usuario, 'No identificado') AS usuario_nombre,
      hu.fecha_hora_inicio, hu.fecha_hora_fin, hu.estado,
      TIMESTAMPDIFF(MINUTE, hu.fecha_hora_inicio, COALESCE(hu.fecha_hora_fin, NOW())) AS duracion_minutos
      ${fromWhere} ORDER BY hu.fecha_hora_inicio DESC, hu.id_historial DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
  return { dataSql, countSql: `SELECT COUNT(*) AS total ${fromWhere}`, params, page, limit };
}
