import * as brevo from '@getbrevo/brevo';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio de envío de correos electrónicos usando API de Brevo
 */
class EmailService {
  constructor() {
    this.apiInstance = null;
    this.senderEmail = null;
    this.senderName = 'Sistema de Gestión de Equipos SENA';
    this.initializeBrevoAPI();
  }

  /**
   * Inicializa el cliente API de Brevo
   */
  initializeBrevoAPI() {
    try {
      // Leer directamente de process.env primero (Railway inyecta las variables aquí)
      const apiKeyFromEnv = process.env.BREVO_API_KEY;
      const apiKeyFromConfig = config.email?.brevoApiKey;
      const apiKey = apiKeyFromEnv || apiKeyFromConfig;

      // Log detallado para debugging
      logger.info('Inicializando servicio API de Brevo', {
        hasApiKeyEnv: !!apiKeyFromEnv,
        hasApiKeyConfig: !!apiKeyFromConfig,
        apiKeyExists: !!apiKey,
        apiKeyLength: apiKey ? apiKey.length : 0,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 20) + '...' : 'N/A',
        envKeysWithBrevo: Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO')).join(', ') || 'ninguna',
        nodeEnv: process.env.NODE_ENV
      });

      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        const errorDetails = {
          hasApiKeyEnv: !!apiKeyFromEnv,
          hasApiKeyConfig: !!apiKeyFromConfig,
          apiKeyType: typeof apiKey,
          apiKeyValue: apiKey ? 'existe pero vacío' : 'no existe',
          envKeys: Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO')).join(', ') || 'ninguna',
          allEnvKeys: Object.keys(process.env).slice(0, 10).join(', ') + '...'
        };
        logger.error('BREVO_API_KEY no configurada o inválida. El servicio de email no estará disponible.', errorDetails);
        this.apiInstance = null;
        return;
      }

      const trimmedKey = apiKey.trim();

      // Configurar el cliente API de Brevo
      const defaultClient = brevo.ApiClient.instance;
      const apiKeyAuth = defaultClient.authentications['api-key'];
      apiKeyAuth.apiKey = trimmedKey;

      // Crear instancia del API de transaccional emails
      this.apiInstance = new brevo.TransactionalEmailsApi();

      // Obtener email del remitente desde configuración o usar el por defecto
      this.senderEmail = process.env.BREVO_SENDER_EMAIL || config.email?.user || 'noreply@sena.edu.co';

      logger.info('✅ Servicio de email API de Brevo configurado correctamente', {
        senderEmail: this.senderEmail,
        hasApiKey: !!trimmedKey,
        apiKeyLength: trimmedKey.length,
        senderEmailSource: process.env.BREVO_SENDER_EMAIL ? 'process.env' : (config.email?.user ? 'config.email' : 'default')
      });
    } catch (error) {
      logger.error('Error al inicializar servicio de email API de Brevo:', error);
      this.apiInstance = null;
    }
  }

  /**
   * Verifica la conexión con la API de Brevo
   * @returns {Promise<boolean>} True si la conexión es exitosa
   */
  async verifyConnection() {
    if (!this.apiInstance) {
      logger.warn('Cliente API de Brevo no inicializado, intentando reinicializar...');
      this.initializeBrevoAPI();
      if (!this.apiInstance) {
        return false;
      }
    }

    try {
      // Intentar obtener información de la cuenta para verificar la conexión
      const accountApi = new brevo.AccountApi();
      await accountApi.getAccount();
      logger.info('✅ Conexión API de Brevo verificada correctamente');
      return true;
    } catch (error) {
      logger.error('Error al verificar conexión API de Brevo:', {
        message: error.message,
        code: error.code
      });
      return false;
    }
  }

  /**
   * Genera una contraseña aleatoria segura
   * @param {number} length - Longitud de la contraseña (default: 12)
   * @returns {string} Contraseña generada
   */
  generatePassword(length = 12) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%&*';
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = '';
    // Asegurar al menos un carácter de cada tipo
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Completar el resto de la contraseña
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Mezclar los caracteres
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Envía un correo usando API de Brevo
   * @param {string} to - Correo destinatario
   * @param {string} subject - Asunto del correo
   * @param {string} htmlContent - Contenido HTML del correo
   * @param {string} textContent - Contenido de texto plano del correo
   * @returns {Promise<{success: boolean, error?: string, messageId?: string}>} Resultado del envío
   */
  async sendEmail(to, subject, htmlContent, textContent) {
    // Si el servicio no está inicializado, intentar reinicializarlo
    if (!this.apiInstance) {
      const apiKeyFromEnv = process.env.BREVO_API_KEY;
      const apiKeyFromConfig = config.email?.brevoApiKey;
      const apiKey = apiKeyFromEnv || apiKeyFromConfig;

      logger.info('Intentando reinicializar servicio de email API', {
        hasApiKeyEnv: !!apiKeyFromEnv,
        hasApiKeyConfig: !!apiKeyFromConfig,
        apiKeyLength: apiKey ? apiKey.length : 0,
        allEnvKeys: Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO')).join(', ')
      });

      if (apiKey) {
        logger.info('BREVO_API_KEY encontrada. Reinicializando servicio...', {
          source: apiKeyFromEnv ? 'process.env' : 'config',
          keyPrefix: apiKey.substring(0, 20) + '...'
        });
        this.initializeBrevoAPI();
      } else {
        const errorMsg = 'Servicio de email no configurado. Verifica BREVO_API_KEY';
        logger.error(errorMsg, {
          hasApiKeyEnv: !!apiKeyFromEnv,
          hasApiKeyConfig: !!apiKeyFromConfig,
          processEnvKeys: Object.keys(process.env).filter(k => k.includes('BREVO')),
          configEmailKeys: Object.keys(config.email || {})
        });
        return { success: false, error: errorMsg };
      }
    }

    // Verificar nuevamente después de la reinicialización
    if (!this.apiInstance) {
      const errorMsg = 'Servicio de email no configurado después de reinicialización. Verifica BREVO_API_KEY';
      logger.error(errorMsg, {
        hasApiKeyEnv: !!process.env.BREVO_API_KEY,
        hasApiKeyConfig: !!config.email?.brevoApiKey
      });
      return { success: false, error: errorMsg };
    }

    if (!to || !to.trim()) {
      const errorMsg = 'No se proporcionó correo electrónico';
      logger.warn(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const currentSenderEmail = process.env.BREVO_SENDER_EMAIL || this.senderEmail || config.email?.user || 'noreply@sena.edu.co';

      logger.info('Enviando correo a través de API de Brevo', {
        to: to.trim(),
        sender: currentSenderEmail,
        hasApiInstance: !!this.apiInstance
      });

      // Crear el objeto de email transaccional
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        name: this.senderName,
        email: currentSenderEmail
      };
      sendSmtpEmail.to = [{ email: to.trim() }];
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;
      sendSmtpEmail.textContent = textContent;

      // Enviar el correo con timeout
      const sendEmailPromise = this.apiInstance.sendTransacEmail(sendSmtpEmail);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Timeout: El envío del correo tardó más de 30 segundos'));
        }, 30000);
      });

      const response = await Promise.race([sendEmailPromise, timeoutPromise]);

      logger.info(`✅ Correo enviado exitosamente a: ${to}`, {
        messageId: response.messageId
      });

      return {
        success: true,
        messageId: response.messageId
      };
    } catch (error) {
      let errorMessage = 'Error al enviar correo';

      if (error.response) {
        errorMessage = error.response.body?.message || error.response.text || errorMessage;
        logger.error(`Error de API de Brevo al enviar correo a ${to}:`, {
          status: error.response.status,
          statusText: error.response.statusText,
          body: error.response.body,
          message: errorMessage
        });
      } else {
        logger.error(`Error al enviar correo a ${to}:`, {
          message: error.message,
          code: error.code
        });
        errorMessage = error.message || errorMessage;
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Envía un correo con la contraseña generada
   * @param {string} to - Correo destinatario
   * @param {string} nombreUsuario - Nombre del usuario
   * @param {string} cedula - Cédula del usuario
   * @param {string} password - Contraseña generada
   * @returns {Promise<{success: boolean, error?: string}>} Resultado del envío
   */
  async enviarContrasena(to, nombreUsuario, cedula, password) {
    const subject = 'Credenciales de acceso - Sistema de Gestión de Equipos SENA';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #40c057 0%, #51cf66 100%);
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .credentials-box {
            background: white;
            border: 2px solid #40c057;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .password {
            font-size: 24px;
            font-weight: bold;
            color: #40c057;
            letter-spacing: 2px;
            font-family: 'Courier New', monospace;
            padding: 10px;
            background: #f0f0f0;
            border-radius: 4px;
            margin: 10px 0;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Sistema de Gestión de Equipos SENA</h1>
        </div>
        <div class="content">
          <h2>Bienvenido/a, ${nombreUsuario}</h2>
          <p>Tu cuenta ha sido creada en el Sistema de Gestión de Equipos SENA. A continuación encontrarás tus credenciales de acceso:</p>
          
          <div class="credentials-box">
            <p><strong>Cédula:</strong> ${cedula}</p>
            <p><strong>Contraseña temporal:</strong></p>
            <div class="password">${password}</div>
          </div>

          <div class="warning">
            <strong>⚠️ Importante:</strong> Por seguridad, te recomendamos cambiar esta contraseña después de tu primer inicio de sesión.
          </div>

          <p>Puedes acceder al sistema utilizando tu cédula y la contraseña proporcionada.</p>
          
          <p>Si no solicitaste esta cuenta, por favor contacta al administrador del sistema.</p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder.</p>
          <p>SENA - Sistema de Gestión de Equipos</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Sistema de Gestión de Equipos SENA

Bienvenido/a, ${nombreUsuario}

Tu cuenta ha sido creada en el Sistema de Gestión de Equipos SENA. A continuación encontrarás tus credenciales de acceso:

Cédula: ${cedula}
Contraseña temporal: ${password}

⚠️ IMPORTANTE: Por seguridad, te recomendamos cambiar esta contraseña después de tu primer inicio de sesión.

Puedes acceder al sistema utilizando tu cédula y la contraseña proporcionada.

Si no solicitaste esta cuenta, por favor contacta al administrador del sistema.

---
Este es un correo automático, por favor no responder.
SENA - Sistema de Gestión de Equipos
    `;

    return await this.sendEmail(to, subject, htmlContent, textContent);
  }

  /**
   * Envía correos en lote (para importación masiva)
   * @param {Array} usuarios - Array de objetos {correo, nombreUsuario, cedula, password}
   * @returns {Promise<Object>} Resultado con exitosos y fallidos
   */
  async enviarContrasenasMasivo(usuarios) {
    const resultados = {
      exitosos: 0,
      fallidos: 0,
      errores: []
    };

    for (const usuario of usuarios) {
      const resultado = await this.enviarContrasena(
        usuario.correo,
        usuario.nombreUsuario,
        usuario.cedula,
        usuario.password
      );

      if (resultado.success) {
        resultados.exitosos++;
      } else {
        resultados.fallidos++;
        resultados.errores.push({
          correo: usuario.correo,
          nombre: usuario.nombreUsuario,
          razon: resultado.error || (usuario.correo ? 'Error al enviar correo' : 'Correo no proporcionado')
        });
      }
    }

    return resultados;
  }

  /**
   * Envía un correo con el enlace de recuperación de contraseña
   * @param {string} to - Correo destinatario
   * @param {string} nombreUsuario - Nombre del usuario
   * @param {string} urlRecuperacion - URL para restablecer la contraseña
   * @returns {Promise<{success: boolean, error?: string}>} Resultado del envío
   */
  async enviarCorreoRecuperacion(to, nombreUsuario, urlRecuperacion) {
    const subject = 'Recuperación de Contraseña - Sistema de Gestión de Equipos SENA';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #40c057 0%, #51cf66 100%);
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #40c057;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 600;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
          }
          .url-fallback {
            word-break: break-all;
            background: #e9ecef;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Sistema de Gestión de Equipos SENA</h1>
        </div>
        <div class="content">
          <h2>Recuperación de Contraseña</h2>
          <p>Hola ${nombreUsuario},</p>
          <p>Hemos recibido una solicitud para restablecer tu contraseña en el Sistema de Gestión de Equipos SENA.</p>
          
          <p>Haz clic en el siguiente botón para restablecer tu contraseña:</p>
          <div style="text-align: center;">
            <a href="${urlRecuperacion}" class="button">Restablecer Contraseña</a>
          </div>

          <p>O copia y pega el siguiente enlace en tu navegador:</p>
          <div class="url-fallback">${urlRecuperacion}</div>

          <div class="warning">
            <strong>⚠️ Importante:</strong> Este enlace expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.
          </div>

          <p>Si no solicitaste este cambio, por favor contacta al administrador del sistema.</p>
        </div>
        <div class="footer">
          <p>Este es un correo automático, por favor no responder.</p>
          <p>SENA - Sistema de Gestión de Equipos</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Sistema de Gestión de Equipos SENA

Recuperación de Contraseña

Hola ${nombreUsuario},

Hemos recibido una solicitud para restablecer tu contraseña en el Sistema de Gestión de Equipos SENA.

Haz clic en el siguiente enlace para restablecer tu contraseña:
${urlRecuperacion}

⚠️ IMPORTANTE: Este enlace expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.

Si no solicitaste este cambio, por favor contacta al administrador del sistema.

---
Este es un correo automático, por favor no responder.
SENA - Sistema de Gestión de Equipos
    `;

    return await this.sendEmail(to, subject, htmlContent, textContent);
  }
}

// Exportar instancia singleton
export const emailService = new EmailService();

// Método para reinicializar el servicio (útil si las variables de entorno se cargan después)
emailService.reinitialize = function() {
  logger.info('Reinicializando servicio de email API de Brevo...');
  this.initializeBrevoAPI();
};

// Verificar y reinicializar el servicio al iniciar el servidor (después de que las variables estén disponibles)
if (typeof process !== 'undefined' && process.env) {
  setImmediate(() => {
    const apiKey = process.env.BREVO_API_KEY;
    logger.info('Verificando BREVO_API_KEY después de inicialización', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey ? apiKey.length : 0,
      hasApiInstance: !!emailService.apiInstance,
      envKeys: Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO')).join(', ')
    });

    if (apiKey && !emailService.apiInstance) {
      logger.info('BREVO_API_KEY detectada después de la inicialización. Reinicializando servicio...');
      emailService.reinitialize();
    } else if (!apiKey) {
      logger.warn('BREVO_API_KEY no encontrada en process.env después de la inicialización', {
        allEnvKeys: Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO') || k.toUpperCase().includes('EMAIL')).join(', ')
      });
    }
  });
}

export default emailService;
