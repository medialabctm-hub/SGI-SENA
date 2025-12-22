import { logger } from '../utils/logger.js';

/**
 * Middleware para parsear datos de multipart/form-data
 * Convierte strings JSON a objetos/arrays antes de la validación
 */
export const parseFormData = (req, res, next) => {
  try {
    // Solo procesar si es multipart/form-data
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return next();
    }

    // Log del body original para debugging
    logger.debug('Body original antes de parsear', {
      body: req.body,
      keys: Object.keys(req.body || {})
    });

    // Parsear campos que pueden venir como strings JSON
    const parsedBody = { ...req.body };

    // Parsear 'usuarios' si viene como string JSON
    if (parsedBody.usuarios) {
      if (typeof parsedBody.usuarios === 'string') {
        try {
          const parsed = JSON.parse(parsedBody.usuarios);
          // Asegurar que sea un array
          parsedBody.usuarios = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          logger.warn('Error al parsear usuarios como JSON, intentando como objeto único', {
            usuarios: parsedBody.usuarios,
            error: e.message
          });
          // Si falla el parseo, intentar parsear como objeto único y convertirlo a array
          try {
            // Intentar parsear de nuevo con diferentes estrategias
            const trimmed = parsedBody.usuarios.trim();
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
              const parsed = JSON.parse(trimmed);
              parsedBody.usuarios = Array.isArray(parsed) ? parsed : [parsed];
            } else {
              // Si no es JSON válido, crear array con el string como objeto
              parsedBody.usuarios = [{ documento: parsedBody.usuarios }];
            }
          } catch (e2) {
            logger.error('No se pudo parsear usuarios', {
              usuarios: parsedBody.usuarios,
              error: e2.message
            });
            // Último recurso: crear un array vacío y dejar que el validador maneje el error
            parsedBody.usuarios = [];
          }
        }
      } else if (!Array.isArray(parsedBody.usuarios)) {
        // Si no es string ni array, convertirlo a array
        parsedBody.usuarios = [parsedBody.usuarios];
      }
    }

    // Si no hay usuarios pero hay campos de usuario en el nivel raíz (formato antiguo)
    // Convertir a formato nuevo
    if (!parsedBody.usuarios && (parsedBody.ficha || parsedBody.documento)) {
      const usuario = {
        ficha: parsedBody.ficha || null,
        documento: parsedBody.documento || '',
      };

      // Parsear diasSemana si viene como string
      if (parsedBody.diasSemana || parsedBody.dias_semana) {
        const diasSemanaStr = parsedBody.diasSemana || parsedBody.dias_semana;
        if (typeof diasSemanaStr === 'string') {
          try {
            usuario.dias_semana = JSON.parse(diasSemanaStr);
          } catch (e) {
            logger.warn('Error al parsear diasSemana como JSON', {
              diasSemana: diasSemanaStr,
              error: e.message
            });
            // Si es un string simple, intentar como array de un elemento
            usuario.dias_semana = [diasSemanaStr];
          }
        } else {
          usuario.dias_semana = diasSemanaStr;
        }
      }

      if (parsedBody.horaInicio || parsedBody.hora_inicio) {
        usuario.hora_inicio = parsedBody.horaInicio || parsedBody.hora_inicio;
      }

      if (parsedBody.horaFin || parsedBody.hora_fin) {
        usuario.hora_fin = parsedBody.horaFin || parsedBody.hora_fin;
      }

      parsedBody.usuarios = [usuario];
    } else if (parsedBody.usuarios && Array.isArray(parsedBody.usuarios)) {
      // Si usuarios es un array, parsear cada elemento
      parsedBody.usuarios = parsedBody.usuarios.map(usuario => {
        const parsedUsuario = { ...usuario };

        // Parsear diasSemana si viene como string
        if (parsedUsuario.diasSemana || parsedUsuario.dias_semana) {
          const diasSemanaStr = parsedUsuario.diasSemana || parsedUsuario.dias_semana;
          if (typeof diasSemanaStr === 'string') {
            try {
              parsedUsuario.dias_semana = JSON.parse(diasSemanaStr);
            } catch (e) {
              logger.warn('Error al parsear diasSemana en usuario', {
                diasSemana: diasSemanaStr,
                error: e.message
              });
              // Si es un string simple, intentar como array de un elemento
              parsedUsuario.dias_semana = [diasSemanaStr];
            }
          } else {
            parsedUsuario.dias_semana = diasSemanaStr;
          }
          // Eliminar la versión camelCase si existe
          delete parsedUsuario.diasSemana;
        }

        // Normalizar nombres de campos de hora
        if (parsedUsuario.horaInicio) {
          parsedUsuario.hora_inicio = parsedUsuario.horaInicio;
          delete parsedUsuario.horaInicio;
        }
        if (parsedUsuario.horaFin) {
          parsedUsuario.hora_fin = parsedUsuario.horaFin;
          delete parsedUsuario.horaFin;
        }

        return parsedUsuario;
      });
    }

    // Reemplazar el body con el parseado
    req.body = parsedBody;

    logger.debug('Body parseado después de procesar', {
      body: req.body,
      tiene_usuarios: !!req.body.usuarios,
      cantidad_usuarios: Array.isArray(req.body.usuarios) ? req.body.usuarios.length : 0
    });

    next();
  } catch (error) {
    logger.error('Error en parseFormData middleware', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

