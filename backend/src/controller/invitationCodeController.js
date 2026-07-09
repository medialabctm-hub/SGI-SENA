import { ServiceFactory } from '../factories/ServiceFactory.js';
import { logger } from '../utils/logger.js';

/**
 * Controlador de códigos de invitación
 */
export const createInvitationCode = async (req, res, next) => {
  try {
    const invitationCodeService = ServiceFactory.create('invitationCodeService');
    const { rol_destinado, fecha_expiracion, max_usos } = req.body;
    const creado_por = req.user?.id_usuario;

    const code = await invitationCodeService.createCode({
      rol_destinado,
      fecha_expiracion,
      max_usos,
      creado_por
    });

    return res.status(201).json({
      success: true,
      message: 'Código de invitación creado exitosamente',
      data: code
    });
  } catch (error) {
    logger.error('Error en createInvitationCode', { error: error.message });
    return next(error);
  }
};

export const getAllInvitationCodes = async (req, res, next) => {
  try {
    const invitationCodeService = ServiceFactory.create('invitationCodeService');
    const { rol, estado } = req.query;

    const codes = await invitationCodeService.getAllCodes({ rol, estado });

    return res.status(200).json({
      success: true,
      data: codes
    });
  } catch (error) {
    logger.error('Error en getAllInvitationCodes', { error: error.message });
    return next(error);
  }
};

export const getInvitationCodeById = async (req, res, next) => {
  try {
    const invitationCodeService = ServiceFactory.create('invitationCodeService');
    const { id } = req.params;

    const code = await invitationCodeService.getCodeById(parseInt(id));

    return res.status(200).json({
      success: true,
      data: code
    });
  } catch (error) {
    logger.error('Error en getInvitationCodeById', { error: error.message });
    return next(error);
  }
};

export const deleteInvitationCode = async (req, res, next) => {
  try {
    const invitationCodeService = ServiceFactory.create('invitationCodeService');
    const { id } = req.params;

    await invitationCodeService.deleteCode(parseInt(id));

    return res.status(200).json({
      success: true,
      message: 'Código de invitación eliminado exitosamente'
    });
  } catch (error) {
    logger.error('Error en deleteInvitationCode', { error: error.message });
    return next(error);
  }
};

export const deactivateInvitationCode = async (req, res, next) => {
  try {
    const invitationCodeService = ServiceFactory.create('invitationCodeService');
    const { id } = req.params;

    await invitationCodeService.deactivateCode(parseInt(id));

    return res.status(200).json({
      success: true,
      message: 'Código de invitación desactivado exitosamente'
    });
  } catch (error) {
    logger.error('Error en deactivateInvitationCode', { error: error.message });
    return next(error);
  }
};

export const validateInvitationCode = async (req, res, next) => {
  try {
    const invitationCodeService = ServiceFactory.create('invitationCodeService');
    const { codigo, rol } = req.body;

    const code = await invitationCodeService.validateCode(codigo, rol);

    return res.status(200).json({
      success: true,
      message: 'Código válido',
      data: {
        codigo: code.codigo,
        rol_destinado: code.rol_destinado,
        fecha_expiracion: code.fecha_expiracion,
        usos_restantes: code.max_usos > 0 
          ? code.max_usos - code.usos_actuales 
          : 'Ilimitado'
      }
    });
  } catch (error) {
    logger.error('Error en validateInvitationCode', { error: error.message });
    return next(error);
  }
};

