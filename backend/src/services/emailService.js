import nodemailer from 'nodemailer';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio de envío de correos electrónicos
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Inicializa el transporter de nodemailer
   */
  initializeTransporter() {
    try {
      // Verificar que existan las credenciales
      if (!config.email.user || !config.email.password) {
        logger.warn('Credenciales de email no configuradas. El servicio de email no estará disponible.');
        this.transporter = null;
        return;
      }

      // Configuración flexible para diferentes proveedores
      // Si EMAIL_HOST está configurado, usar configuración SMTP personalizada
      if (process.env.EMAIL_HOST) {
        this.transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: parseInt(process.env.EMAIL_PORT || '587'),
          secure: process.env.EMAIL_SECURE === 'true', // true para 465, false para otros puertos
          auth: {
            user: config.email.user,
            pass: config.email.password
          }
        });
      } else {
        // Configuración por defecto para Gmail
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: config.email.user,
            pass: config.email.password
          }
        });
      }

      // Verificar conexión en desarrollo
      if (process.env.NODE_ENV === 'development') {
        this.transporter.verify((error, success) => {
          if (error) {
            logger.warn('Error al verificar configuración de email:', error.message);
            logger.warn('El servicio de email puede no funcionar correctamente. Verifica las credenciales.');
          } else {
            logger.info('Servicio de email configurado correctamente');
          }
        });
      }
    } catch (error) {
      logger.error('Error al inicializar servicio de email:', error);
      // En caso de error, el servicio seguirá funcionando pero no enviará emails
      this.transporter = null;
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
   * Envía un correo con la contraseña generada
   * @param {string} to - Correo destinatario
   * @param {string} nombreUsuario - Nombre del usuario
   * @param {string} cedula - Cédula del usuario
   * @param {string} password - Contraseña generada
   * @returns {Promise<{success: boolean, error?: string}>} Resultado del envío
   */
  async enviarContrasena(to, nombreUsuario, cedula, password) {
    if (!this.transporter) {
      const errorMsg = 'Servicio de email no configurado. Verifica las credenciales EMAIL_USER y EMAIL_PASSWORD';
      logger.warn(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (!to || !to.trim()) {
      const errorMsg = 'No se proporcionó correo electrónico para enviar contraseña';
      logger.warn(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const mailOptions = {
        from: `"Sistema de Gestión de Equipos SENA" <${config.email.user}>`,
        to: to.trim(),
        subject: 'Credenciales de acceso - Sistema de Gestión de Equipos SENA',
        html: `
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
        `,
        text: `
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
        `
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Correo enviado exitosamente a: ${to}`);
      return { success: true };
    } catch (error) {
      // Capturar mensaje de error más detallado
      let errorMessage = 'Error al enviar correo';
      
      if (error.code === 'EAUTH') {
        errorMessage = 'Error de autenticación. Verifica las credenciales EMAIL_USER y EMAIL_PASSWORD';
      } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        errorMessage = 'Error de conexión con el servidor de correo. Verifica EMAIL_HOST y EMAIL_PORT';
      } else if (error.code === 'EENVELOPE') {
        errorMessage = 'Error en la dirección de correo. Verifica que el correo sea válido';
      } else if (error.response) {
        errorMessage = `Error del servidor de correo: ${error.response}`;
      } else {
        errorMessage = error.message || 'Error desconocido al enviar correo';
      }
      
      logger.error(`Error al enviar correo a ${to}:`, {
        message: error.message,
        code: error.code,
        response: error.response,
        command: error.command
      });
      
      return { success: false, error: errorMessage };
    }
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
    if (!this.transporter) {
      const errorMsg = 'Servicio de email no configurado. Verifica las credenciales EMAIL_USER y EMAIL_PASSWORD';
      logger.warn(errorMsg);
      return { success: false, error: errorMsg };
    }

    if (!to || !to.trim()) {
      const errorMsg = 'No se proporcionó correo electrónico para enviar recuperación';
      logger.warn(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const mailOptions = {
        from: `"Sistema de Gestión de Equipos SENA" <${config.email.user}>`,
        to: to.trim(),
        subject: 'Recuperación de Contraseña - Sistema de Gestión de Equipos SENA',
        html: `
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
        `,
        text: `
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
        `
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Correo de recuperación enviado exitosamente a: ${to}`);
      return { success: true };
    } catch (error) {
      // Capturar mensaje de error más detallado
      let errorMessage = 'Error al enviar correo';
      
      if (error.code === 'EAUTH') {
        errorMessage = 'Error de autenticación. Verifica las credenciales EMAIL_USER y EMAIL_PASSWORD';
      } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        errorMessage = 'Error de conexión con el servidor de correo. Verifica EMAIL_HOST y EMAIL_PORT';
      } else if (error.code === 'EENVELOPE') {
        errorMessage = 'Error en la dirección de correo. Verifica que el correo sea válido';
      } else if (error.response) {
        errorMessage = `Error del servidor de correo: ${error.response}`;
      } else {
        errorMessage = error.message || 'Error desconocido al enviar correo';
      }
      
      logger.error(`Error al enviar correo de recuperación a ${to}:`, {
        message: error.message,
        code: error.code,
        response: error.response,
        command: error.command
      });
      
      return { success: false, error: errorMessage };
    }
  }
}

// Exportar instancia singleton
export const emailService = new EmailService();
export default emailService;

