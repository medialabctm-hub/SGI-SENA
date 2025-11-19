/**
 * Sistema de traducciones para notificaciones
 * 
 * Soporta múltiples idiomas para las notificaciones del sistema
 */

const translations = {
  es: {
    'nuevo_equipo_registrado': 'Nuevo equipo registrado',
    'nuevo_equipo_registrado_cuerpo': 'Se ha registrado {descripcion} en el ambiente {ambiente}.',
    'nuevo_equipo_registrado_cuerpo_sin_ambiente': 'Se ha registrado {descripcion}.',
    'nueva_novedad_reportada': 'Nueva novedad reportada',
    'nueva_novedad_reportada_cuerpo': 'El {rol} {nombre} ha reportado una novedad de tipo "{tipo_novedad}" en el equipo {equipo}',
    'nueva_novedad_en_tu_equipo': 'Nueva novedad reportada en tu equipo',
    'nueva_novedad_en_tu_equipo_cuerpo': 'Se ha reportado una novedad de tipo "{tipo_novedad}" en el equipo {equipo}',
    'nuevo_reporte_equipo': 'Nuevo reporte sobre tu equipo',
    'nuevo_reporte_equipo_cuerpo': 'Se ha creado un reporte de tipo "{tipo_reporte}" sobre el equipo {equipo}: {titulo}',
    'nuevo_usuario_registrado': 'Nuevo usuario registrado',
    'nuevo_usuario_registrado_cuerpo': 'Se ha registrado un nuevo usuario: {nombre}',
    'mantenimiento_proximo': 'Mantenimiento próximo',
    'mantenimiento_proximo_cuerpo': 'El equipo {equipo} requiere mantenimiento',
  },
  en: {
    'nuevo_equipo_registrado': 'New equipment registered',
    'nuevo_equipo_registrado_cuerpo': '{descripcion} has been registered in environment {ambiente}.',
    'nuevo_equipo_registrado_cuerpo_sin_ambiente': '{descripcion} has been registered.',
    'nueva_novedad_reportada': 'New issue reported',
    'nueva_novedad_reportada_cuerpo': 'The {rol} {nombre} has reported an issue of type "{tipo_novedad}" on equipment {equipo}',
    'nueva_novedad_en_tu_equipo': 'New issue reported on your equipment',
    'nueva_novedad_en_tu_equipo_cuerpo': 'An issue of type "{tipo_novedad}" has been reported on equipment {equipo}',
    'nuevo_reporte_equipo': 'New report on your equipment',
    'nuevo_reporte_equipo_cuerpo': 'A report of type "{tipo_reporte}" has been created on equipment {equipo}: {titulo}',
    'nuevo_usuario_registrado': 'New user registered',
    'nuevo_usuario_registrado_cuerpo': 'A new user has been registered: {nombre}',
    'mantenimiento_proximo': 'Maintenance due',
    'mantenimiento_proximo_cuerpo': 'Equipment {equipo} requires maintenance',
  }
};

/**
 * Obtiene una traducción según el idioma
 * @param {string} key - Clave de traducción
 * @param {string} lang - Idioma (es, en)
 * @param {Object} params - Parámetros para reemplazar en la traducción
 * @returns {string} Texto traducido
 */
export function translate(key, lang = 'es', params = {}) {
  const langTranslations = translations[lang] || translations.es;
  let text = langTranslations[key] || translations.es[key] || key;

  // Reemplazar parámetros
  if (params && Object.keys(params).length > 0) {
    Object.keys(params).forEach(param => {
      text = text.replace(new RegExp(`{${param}}`, 'g'), params[param] || '');
    });
  }

  return text;
}

/**
 * Obtiene el idioma de un usuario desde sus preferencias
 * @param {number} userId - ID del usuario
 * @param {Object} db - Conexión a la base de datos
 * @returns {Promise<string>} Idioma del usuario (es, en)
 */
export async function getUserLanguage(userId, db) {
  try {
    const [rows] = await db.execute(
      'SELECT idioma FROM Preferencias_Usuario WHERE id_usuario = ?',
      [userId]
    );
    
    if (rows.length > 0 && rows[0].idioma) {
      return rows[0].idioma;
    }
  } catch (error) {
    // Si la tabla no existe o hay error, usar español por defecto
    console.warn('Error al obtener idioma del usuario:', error.message);
  }
  
  return 'es'; // Idioma por defecto
}

export default {
  translate,
  getUserLanguage,
  translations
};

