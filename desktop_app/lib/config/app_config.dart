/// Configuración de la aplicación
class AppConfig {
  // URL base de la API
  // Para desarrollo local: 'http://localhost:3000'
  // Para producción: 'https://sgi-sena.up.railway.app'
  static const String apiBaseUrl = 'https://sgi-sena.up.railway.app';
  
  // Tiempo de sesión (en minutos) - 0 significa sin expiración
  static const int sessionTimeoutMinutes = 0;
  
  // Habilitar logs de debug
  static const bool enableDebugLogs = true;
}

