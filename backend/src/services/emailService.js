import nodemailer from 'nodemailer';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio de envío de correos electrónicos usando SMTP de Brevo
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.senderEmail = null;
    this.senderName = 'Sistema de Gestión de Equipos SENA';
    this.initializeBrevoSMTP();
  }

  /**
   * Inicializa el transportador SMTP de Brevo
   */
  initializeBrevoSMTP() {
    try {
      // SIEMPRE leer directamente de process.env primero (Railway inyecta las variables aquí)
      // process.env tiene prioridad absoluta sobre config
      const smtpKeyFromEnv = process.env.BREVO_SMTP_KEY;
      const smtpKeyFromConfig = config.email?.brevoSmtpKey;
      const smtpKey = smtpKeyFromEnv || smtpKeyFromConfig;
      
      // Obtener el login SMTP (puede venir de una variable o extraerse de la configuración)
      const smtpLoginFromEnv = process.env.BREVO_SMTP_LOGIN;
      const smtpLoginFromConfig = config.email?.brevoSmtpLogin;
      const smtpLogin = smtpLoginFromEnv || smtpLoginFromConfig;
      
      // Log detallado para debugging
      logger.info('Inicializando servicio SMTP de Brevo', {
        hasSmtpKeyEnv: !!smtpKeyFromEnv,
        hasSmtpKeyConfig: !!smtpKeyFromConfig,
        hasSmtpLoginEnv: !!smtpLoginFromEnv,
        hasSmtpLoginConfig: !!smtpLoginFromConfig,
        smtpKeyExists: !!smtpKey,
        smtpKeyLength: smtpKey ? smtpKey.length : 0,
        smtpKeyPrefix: smtpKey ? smtpKey.substring(0, 20) + '...' : 'N/A',
        smtpLoginExists: !!smtpLogin,
        envKeysWithBrevo: Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO')).join(', ') || 'ninguna',
        nodeEnv: process.env.NODE_ENV
      });
      
      if (!smtpKey || typeof smtpKey !== 'string' || !smtpKey.trim()) {
        const errorDetails = {
          hasSmtpKeyEnv: !!smtpKeyFromEnv,
          hasSmtpKeyConfig: !!smtpKeyFromConfig,
          smtpKeyType: typeof smtpKey,
          smtpKeyValue: smtpKey ? 'existe pero vacío' : 'no existe',
          envKeys: Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO') || k.toUpperCase().includes('SMTP')).join(', ') || 'ninguna',
          allEnvKeys: Object.keys(process.env).slice(0, 10).join(', ') + '...' // Primeras 10 para debugging
        };
        logger.error('BREVO_SMTP_KEY no configurada o inválida. El servicio de email no estará disponible.', errorDetails);
        this.transporter = null;
        return;
      }
      
      // Validar formato básico de la clave SMTP de Brevo
      const trimmedKey = smtpKey.trim();
      if (!trimmedKey.startsWith('xsmtpsib-')) {
        logger.warn('BREVO_SMTP_KEY no tiene el formato esperado (debe empezar con "xsmtpsib-")', {
          keyPrefix: trimmedKey.substring(0, 20) + '...'
        });
      }
      
      // Si no hay login SMTP, intentar extraerlo de la clave o usar un valor por defecto
      // El login SMTP de Brevo generalmente es: [número]@smtp-brevo.com
      // Si no está configurado, intentaremos usar el email del remitente
      let finalSmtpLogin = smtpLogin;
      if (!finalSmtpLogin || !finalSmtpLogin.trim()) {
        // Intentar extraer el número del inicio de la clave SMTP o usar un valor por defecto
        // Por ahora, usaremos el email del remitente como fallback
        const senderEmail = process.env.BREVO_SENDER_EMAIL || config.email?.user;
        if (senderEmail) {
          // Intentar extraer el número del email o usar el email completo
          finalSmtpLogin = senderEmail;
          logger.warn('BREVO_SMTP_LOGIN no configurado, usando email del remitente como fallback', {
            fallbackLogin: finalSmtpLogin
          });
        } else {
          logger.error('BREVO_SMTP_LOGIN no configurado y no hay email del remitente disponible');
          this.transporter = null;
          return;
        }
      }
      
      logger.info('BREVO_SMTP_KEY encontrada, configurando transportador SMTP', {
        keyLength: trimmedKey.length,
        keyPrefix: trimmedKey.substring(0, 20) + '...',
        smtpLogin: finalSmtpLogin,
        source: smtpKeyFromEnv ? 'process.env (Railway)' : 'config.email (local)'
      });

      // Configurar el transportador SMTP de Brevo
      // Brevo SMTP settings:
      // - Host: smtp-relay.brevo.com
      // - Port: 587 (TLS) o 465 (SSL)
      // - Auth: Login (email) y Password (SMTP key)
      this.transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false, // true para 465, false para otros puertos
        auth: {
          user: finalSmtpLogin.trim(),
          pass: trimmedKey
        },
        tls: {
          // No rechazar certificados no autorizados (útil en algunos entornos)
          rejectUnauthorized: false
        }
      });
      
      logger.info('Transportador SMTP de Brevo configurado', {
        host: 'smtp-relay.brevo.com',
        port: 587,
        hasTransporter: !!this.transporter,
        authUser: finalSmtpLogin.trim().substring(0, 20) + '...',
        authPassSet: !!trimmedKey
      });
      
      // Obtener email del remitente desde configuración o usar el por defecto
      // SIEMPRE priorizar process.env (Railway)
      this.senderEmail = process.env.BREVO_SENDER_EMAIL || config.email?.user || 'noreply@sena.edu.co';
      
      logger.info('✅ Servicio de email SMTP de Brevo configurado correctamente', {
        senderEmail: this.senderEmail,
        hasSmtpKey: !!trimmedKey,
        smtpKeyLength: trimmedKey.length,
        smtpLogin: finalSmtpLogin.trim(),
        senderEmailSource: process.env.BREVO_SENDER_EMAIL ? 'process.env' : (config.email?.user ? 'config.email' : 'default')
      });
    } catch (error) {
      logger.error('Error al inicializar servicio de email SMTP de Brevo:', error);
      this.transporter = null;
    }
  }

  /**
   * Verifica la conexión SMTP
   * @returns {Promise<boolean>} True si la conexión es exitosa
   */
  async verifyConnection() {
    if (!this.transporter) {
      logger.warn('Transportador SMTP no inicializado, intentando reinicializar...');
      this.initializeBrevoSMTP();
      if (!this.transporter) {
        return false;
      }
    }

    try {
      await this.transporter.verify();
      logger.info('✅ Conexión SMTP de Brevo verificada correctamente');
      return true;
    } catch (error) {
      logger.error('Error al verificar conexión SMTP de Brevo:', {
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
   * Envía un correo usando SMTP de Brevo
   * @param {string} to - Correo destinatario
   * @param {string} subject - Asunto del correo
   * @param {string} htmlContent - Contenido HTML del correo
   * @param {string} textContent - Contenido de texto plano del correo
   * @returns {Promise<{success: boolean, error?: string, messageId?: string}>} Resultado del envío
   */
  async sendEmail(to, subject, htmlContent, textContent) {
    // Si el servicio no está inicializado, intentar reinicializarlo
    if (!this.transporter) {
      // Leer directamente de process.env (más confiable en producción)
      const smtpKeyFromEnv = process.env.BREVO_SMTP_KEY;
      const smtpKeyFromConfig = config.email?.brevoSmtpKey;
      const smtpKey = smtpKeyFromEnv || smtpKeyFromConfig;
      
      logger.info('Intentando reinicializar servicio de email SMTP', {
        hasSmtpKeyEnv: !!smtpKeyFromEnv,
        hasSmtpKeyConfig: !!smtpKeyFromConfig,
        smtpKeyLength: smtpKey ? smtpKey.length : 0,
        allEnvKeys: Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO') || k.toUpperCase().includes('SMTP')).join(', ')
      });
      
      if (smtpKey) {
        logger.info('BREVO_SMTP_KEY encontrada. Reinicializando servicio...', {
          source: smtpKeyFromEnv ? 'process.env' : 'config',
          keyPrefix: smtpKey.substring(0, 20) + '...'
        });
        this.initializeBrevoSMTP();
      } else {
        const errorMsg = 'Servicio de email no configurado. Verifica BREVO_SMTP_KEY';
        logger.error(errorMsg, {
          hasSmtpKeyEnv: !!smtpKeyFromEnv,
          hasSmtpKeyConfig: !!smtpKeyFromConfig,
          processEnvKeys: Object.keys(process.env).filter(k => k.includes('BREVO') || k.includes('SMTP')),
          configEmailKeys: Object.keys(config.email || {})
        });
        return { success: false, error: errorMsg };
      }
    }
    
    // Verificar nuevamente después de la reinicialización
    if (!this.transporter) {
      const errorMsg = 'Servicio de email no configurado después de reinicialización. Verifica BREVO_SMTP_KEY';
      logger.error(errorMsg, {
        hasSmtpKeyEnv: !!process.env.BREVO_SMTP_KEY,
        hasSmtpKeyConfig: !!config.email?.brevoSmtpKey
      });
      return { success: false, error: errorMsg };
    }

    if (!to || !to.trim()) {
      const errorMsg = 'No se proporcionó correo electrónico';
      logger.warn(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      // Asegurarse de usar el email del remitente más actualizado (de process.env si está disponible)
      const currentSenderEmail = process.env.BREVO_SENDER_EMAIL || this.senderEmail || config.email?.user || 'noreply@sena.edu.co';
      
      logger.info('Enviando correo a través de SMTP de Brevo', {
        to: to.trim(),
        sender: currentSenderEmail,
        hasTransporter: !!this.transporter
      });

      // Enviar el correo usando nodemailer
      const info = await this.transporter.sendMail({
        from: `"${this.senderName}" <${currentSenderEmail}>`,
        to: to.trim(),
        subject: subject,
        text: textContent,
        html: htmlContent
      });

      logger.info(`✅ Correo enviado exitosamente a: ${to}`, { 
        messageId: info.messageId,
        response: info.response
      });
      
      return { 
        success: true, 
        messageId: info.messageId
      };
    } catch (error) {
      let errorMessage = 'Error al enviar correo';
      
      if (error.response) {
        errorMessage = error.response || errorMessage;
        logger.error(`Error de SMTP de Brevo al enviar correo a ${to}:`, {
          response: error.response,
          code: error.code,
          command: error.command
        });
      } else {
        logger.error(`Error al enviar correo a ${to}:`, {
          message: error.message,
          code: error.code,
          stack: error.stack
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
  logger.info('Reinicializando servicio de email SMTP de Brevo...');
  this.initializeBrevoSMTP();
};

// Verificar y reinicializar el servicio al iniciar el servidor (después de que las variables estén disponibles)
// Esto se ejecuta después de que el servidor esté listo
if (typeof process !== 'undefined' && process.env) {
  // Usar setImmediate para ejecutar después de que todas las importaciones estén completas
  setImmediate(() => {
    const smtpKey = process.env.BREVO_SMTP_KEY;
    logger.info('Verificando BREVO_SMTP_KEY después de inicialización', {
      hasSmtpKey: !!smtpKey,
      smtpKeyLength: smtpKey ? smtpKey.length : 0,
      hasTransporter: !!emailService.transporter,
      envKeys: Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO') || k.toUpperCase().includes('SMTP')).join(', ')
    });
    
    if (smtpKey && !emailService.transporter) {
      logger.info('BREVO_SMTP_KEY detectada después de la inicialización. Reinicializando servicio...');
      emailService.reinitialize();
    } else if (!smtpKey) {
      logger.warn('BREVO_SMTP_KEY no encontrada en process.env después de la inicialización', {
        allEnvKeys: Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO') || k.toUpperCase().includes('SMTP') || k.toUpperCase().includes('EMAIL')).join(', ')
      });
    }
  });
}

export default emailService;
