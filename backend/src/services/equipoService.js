import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';

/**
 * EquipoService - Servicio de lógica de negocio para equipos
 * 
 * Patrón: Service Layer
 * Principio: Single Responsibility Principle (SRP)
 * 
 * Contiene toda la lógica de negocio relacionada con equipos,
 * delegando el acceso a datos al repositorio.
 */
export class EquipoService {
  constructor(equipoRepository, logger) {
    this.equipoRepository = equipoRepository;
    this.logger = logger;
  }

  /**
   * Obtiene los IDs de ambientes asignados a un instructor
   * @param {number} userId - ID del instructor
   * @returns {Promise<Array<number>>} Lista de IDs de ambientes
   */
  async obtenerAmbientesInstructor(userId) {
    // Determinar jornada actual (misma lógica que estadisticasController)
    const horaActual = new Date().getHours();
    let jornadaActual = 'Mañana';
    if (horaActual >= 12 && horaActual < 18) {
      jornadaActual = 'Tarde';
    } else if (horaActual >= 18) {
      jornadaActual = 'Noche';
    }

    // SISTEMA 100% MANUAL: Las responsabilidades activas se determinan por estado_responsabilidad = 'Activa'
    // No se usan comparaciones de tiempo. El tiempo es solo informativo.
    // Misma lógica que obtenerEstadisticasInstructor para consistencia
    const ambientes = await this.equipoRepository.execute(
      `SELECT DISTINCT ra.id_ambiente
       FROM Responsabilidades_Ambiente ra
       LEFT JOIN Clases c ON ra.id_clase = c.id_clase
       WHERE ra.id_usuario = ?
         AND ra.estado_responsabilidad = 'Activa'
         AND (
           (ra.id_clase IS NULL AND ra.jornada = ?)
           OR
           (ra.id_clase IS NOT NULL AND c.estado_clase = 'En Curso')
         )`,
      [userId, jornadaActual]
    );
    return ambientes.map(a => a.id_ambiente);
  }

  /**
   * Lista equipos con filtros avanzados según el rol del usuario
   * @param {Object} filters - Filtros de búsqueda avanzados
   * @param {Object} pagination - Paginación (page, limit)
   * @param {Object} sorting - Ordenamiento (field, order)
   * @param {number} userId - ID del usuario
   * @param {string} userRole - Rol del usuario
   * @returns {Promise<Object>} Objeto con equipos, paginación y total
   */
  async listarEquipos(filters = {}, pagination = {}, sorting = {}, userId = null, userRole = null) {
    // Aplicar filtros según rol
    if (userRole === 'Cuentadante') {
      const ambientesIds = await this.obtenerAmbientesInstructor(userId);
      const vista = (filters.vista_inventario || 'todos').toLowerCase();
      if (ambientesIds.length > 0) {
        // Cuentadante con ambientes: según vista_inventario (ambientes | inventario_total | todos)
        if (vista === 'ambientes') {
          filters.ambientesIds = ambientesIds;
        } else if (vista === 'inventario_total') {
          filters.cuentadanteId = userId;
        } else {
          // todos (o valor por defecto): OR ambientes + cuentadante
          filters.cuentadanteOrAmbientes = { ambientesIds, cuentadanteId: userId };
        }
        delete filters.vista_inventario;
      } else {
        // Sin ambientes asignados: solo su inventario (ignorar vista_inventario)
        filters.cuentadanteId = userId;
        delete filters.vista_inventario;
      }
    } else if (userRole === 'Instructor') {
      // Los instructores solo ven equipos de sus ambientes asignados
      const ambientesIds = await this.obtenerAmbientesInstructor(userId);
      if (ambientesIds.length === 0) {
        return {
          equipos: [],
          pagination: {
            page: pagination.page || 1,
            limit: pagination.limit || 50,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          }
        };
      }
      filters.ambientesIds = ambientesIds;
    }

    return this.equipoRepository.findAll(filters, pagination, sorting);
  }

  /**
   * Registra un nuevo equipo
   * @param {Object} equipoData - Datos del equipo
   * @param {number} userId - ID del usuario que registra
   * @param {string} userRole - Rol del usuario
   * @returns {Promise<Object>} Equipo creado
   */
  async registrarEquipo(equipoData, userId, userRole) {
    const {
      placa,
      codigo_inventario,
      categoria,
      tipo,
      modelo,
      consecutivo,
      descripcion,
      fecha_adquisicion,
      valor_ingreso,
      costo,
      estado_fisico,
      specs_completas,
      atributos,
      ambiente,
      id_ambiente,
      comentarios,
      id_cuentadante
    } = equipoData;

    // Validaciones de negocio
    const placaValue = (placa || codigo_inventario || '').toString().trim();
    if (!placaValue) {
      throw new ValidationError('La placa (código de inventario) es obligatoria');
    }

    if (!tipo || !modelo || !estado_fisico || !fecha_adquisicion) {
      throw new ValidationError('Faltan campos obligatorios: tipo, modelo, estado_fisico o fecha_adquisicion');
    }

    if (!categoria) {
      throw new ValidationError('La categoría es obligatoria');
    }

    // Verificar que la placa no exista
    const placaExistente = await this.equipoRepository.findByPlaca(placaValue);
    if (placaExistente) {
      throw new ConflictError('La placa ya está registrada');
    }

    // Buscar o crear categoría
    const categoriaData = await this.equipoRepository.createCategoriaIfNotExists(categoria);
    if (!categoriaData?.id_categoria) {
      throw new ValidationError('Error al procesar la categoría');
    }

    // Resolver ambiente
    let ambienteId = id_ambiente;
    let ambienteInfo = null;
    
    if (!ambienteId && ambiente) {
      // Intentar buscar por ID, código o nombre
      ambienteInfo = await this.equipoRepository.findOne(
        'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE id_ambiente = ? OR codigo_ambiente = ? OR nombre_ambiente = ? LIMIT 1',
        [ambiente, ambiente, ambiente]
      );
      ambienteId = ambienteInfo?.id_ambiente;
    }
    
    if (!ambienteId) {
      throw new ValidationError('El ambiente es obligatorio');
    }
    
    if (!ambienteInfo) {
      ambienteInfo = await this.equipoRepository.findOne(
        'SELECT id_ambiente, nombre_ambiente, codigo_ambiente FROM Ambientes WHERE id_ambiente = ? LIMIT 1',
        [ambienteId]
      );
    }
    
    if (!ambienteInfo) {
      throw new ValidationError('El ambiente indicado no existe');
    }

    // Verificar si la columna id_cuentadante existe, si no crearla
    const columnaExiste = await this.equipoRepository.columnExists('id_cuentadante');
    if (!columnaExiste) {
      await this.equipoRepository.db.execute(
        `ALTER TABLE Elementos 
         ADD COLUMN id_cuentadante INT NULL,
         ADD INDEX idx_cuentadante (id_cuentadante),
         ADD FOREIGN KEY (id_cuentadante) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL`
      );
      this.logger.info('Columna id_cuentadante creada en la tabla Elementos');
    }

    // Resolver cuentadante según rol
    let finalCuentadanteId = null;
    if (userRole === 'Administrador') {
      finalCuentadanteId = id_cuentadante ? parseInt(id_cuentadante, 10) : null;
      if (!finalCuentadanteId || finalCuentadanteId <= 0) {
        throw new ValidationError('El ID del cuentadante es inválido o faltante para un Administrador');
      }
    } else if (userRole === 'Cuentadante') {
      finalCuentadanteId = userId;
    }

    // Preparar descripción (combinar con comentarios si hay)
    let descripcionFinal = descripcion || null;
    if (descripcionFinal && comentarios) {
      descripcionFinal = `${descripcionFinal}\n\nComentarios: ${comentarios}`;
    } else if (!descripcionFinal && comentarios) {
      descripcionFinal = `Comentarios: ${comentarios}`;
    }

    const valorIngreso = valor_ingreso || costo || null;
    const rCentroValue = (equipoData.centro || equipoData.r_centro || '00000').toString().trim() || '00000';
    const consecutivoValue = (consecutivo || '').toString().trim();
    const atributosFinal = atributos || specs_completas || null;

    // Verificar si existe columna id_tipo
    const usaIdTipo = await this.equipoRepository.columnExists('id_tipo');
    let idTipo = null;

    if (usaIdTipo) {
      const nombreTipo = categoriaData.es_componente ? 'Componente Individual' : 'Equipo Completo';
      const [[rowTipo]] = await this.equipoRepository.db.execute(
        'SELECT id_tipo FROM Tipos_Equipo WHERE nombre_tipo = ? LIMIT 1',
        [nombreTipo]
      );
      if (!rowTipo?.id_tipo) {
        throw new ValidationError(`Tipo de equipo no configurado: ${nombreTipo}`);
      }
      idTipo = rowTipo.id_tipo;
    }

    // Crear equipo
    const equipoDataToInsert = {
      idCategoria: categoriaData.id_categoria,
      idTipo,
      idAmbiente: ambienteId,
      idCuentadante: finalCuentadanteId,
      tipo,
      modelo,
      descripcion: descripcionFinal,
      fechaAdquisicion: fecha_adquisicion,
      valorIngreso: valorIngreso ? parseFloat(valorIngreso) : null,
      estadoFisico: estado_fisico,
      specsCompletas: specs_completas || null,
      atributos: atributosFinal,
      rCentro: rCentroValue,
      consecutivo: consecutivoValue || null,
      placa: placaValue,
      registradoPor: userId || null
    };

    const result = await this.equipoRepository.create(equipoDataToInsert);

    this.logger.info('Equipo registrado', {
      codigoEquipo: result.insertId,
      placa: placaValue,
      tipo,
      modelo
    });

    return {
      codigo_equipo: result.insertId,
      placa: placaValue,
      tipo,
      modelo,
      ambiente_id: ambienteId
    };
  }

  /**
   * Obtiene un equipo por código
   * @param {number|string} codigoEquipo - Código del equipo
   * @returns {Promise<Object>} Equipo encontrado
   */
  async obtenerEquipoPorCodigo(codigoEquipo) {
    const equipo = await this.equipoRepository.findByCodigo(codigoEquipo);
    if (!equipo) {
      throw new NotFoundError('Equipo');
    }
    return equipo;
  }

  /**
   * Actualiza un equipo
   * @param {number} codigoEquipo - Código del equipo
   * @param {Object} equipoData - Datos a actualizar
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async actualizarEquipo(codigoEquipo, equipoData) {
    // Verificar que el equipo existe
    const equipo = await this.equipoRepository.findByCodigo(codigoEquipo);
    if (!equipo) {
      throw new NotFoundError('Equipo');
    }

    // Validaciones de negocio
    if (equipoData.placa && equipoData.placa !== equipo.placa) {
      const placaExistente = await this.equipoRepository.findByPlaca(equipoData.placa);
      if (placaExistente && placaExistente.codigo_equipo !== codigoEquipo) {
        throw new ConflictError('La placa ya está registrada en otro equipo');
      }
    }

    return this.equipoRepository.update(codigoEquipo, equipoData);
  }

  /**
   * Elimina un equipo
   * @param {number} codigoEquipo - Código del equipo
   * @returns {Promise<Object>} Resultado de la eliminación
   */
  async eliminarEquipo(codigoEquipo) {
    const equipo = await this.equipoRepository.findByCodigo(codigoEquipo);
    if (!equipo) {
      throw new NotFoundError('Equipo');
    }

    return this.equipoRepository.delete(codigoEquipo);
  }
}

