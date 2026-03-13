import { describe, it, expect, jest } from '@jest/globals';
import emailService from '../../src/services/emailService.js';
import { config } from '../../src/config/config.js';

describe('emailService', () => {
  it('verifyConnection debe retornar false cuando no hay cliente API y falla reinicializacion', async () => {
    const originalApiInstance = emailService.apiInstance;
    const originalInit = emailService.initializeBrevoAPI;

    emailService.apiInstance = null;
    emailService.initializeBrevoAPI = jest.fn(async () => {
      emailService.apiInstance = null;
    });

    const result = await emailService.verifyConnection();

    expect(result).toBe(false);
    expect(emailService.initializeBrevoAPI).toHaveBeenCalledTimes(1);

    emailService.apiInstance = originalApiInstance;
    emailService.initializeBrevoAPI = originalInit;
  });

  it('sendEmail debe fallar si la reinicializacion no crea apiInstance aunque exista BREVO_API_KEY', async () => {
    const originalApiInstance = emailService.apiInstance;
    const originalInit = emailService.initializeBrevoAPI;
    const originalEnvKey = process.env.BREVO_API_KEY;

    process.env.BREVO_API_KEY = 'key-exists';
    emailService.apiInstance = null;
    emailService.initializeBrevoAPI = jest.fn(async () => {
      emailService.apiInstance = null;
    });

    const result = await emailService.sendEmail('destino@sena.edu.co', 'Asunto', '<p>hola</p>', 'hola');

    expect(result.success).toBe(false);
    expect(result.error).toContain('después de reinicialización');

    emailService.apiInstance = originalApiInstance;
    emailService.initializeBrevoAPI = originalInit;
    process.env.BREVO_API_KEY = originalEnvKey;
  });

  it('sendEmail debe retornar success=false cuando falta BREVO_API_KEY', async () => {
    const originalApiInstance = emailService.apiInstance;
    const originalEnvKey = process.env.BREVO_API_KEY;
    const originalConfigKey = config.email?.brevoApiKey;

    emailService.apiInstance = null;
    delete process.env.BREVO_API_KEY;
    if (config.email) {
      config.email.brevoApiKey = '';
    }

    const result = await emailService.sendEmail('destino@sena.edu.co', 'Asunto', '<p>hola</p>', 'hola');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Servicio de email no configurado');

    emailService.apiInstance = originalApiInstance;
    if (typeof originalEnvKey === 'string') {
      process.env.BREVO_API_KEY = originalEnvKey;
    }
    if (config.email) {
      config.email.brevoApiKey = originalConfigKey;
    }
  });

  it('sendEmail debe rechazar destinatario vacio con error controlado', async () => {
    const originalApiInstance = emailService.apiInstance;

    emailService.apiInstance = {
      sendTransacEmail: jest.fn(),
    };

    const result = await emailService.sendEmail('   ', 'Asunto', '<p>hola</p>', 'hola');

    expect(result).toEqual({
      success: false,
      error: 'No se proporcionó correo electrónico',
    });

    emailService.apiInstance = originalApiInstance;
  });

  it('generatePassword debe crear una contraseña con longitud solicitada', () => {
    const password = emailService.generatePassword(14);

    expect(password).toHaveLength(14);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%&*]/);
  });

  it('enviarContrasena debe construir plantilla y delegar en sendEmail', async () => {
    const sendSpy = jest
      .spyOn(emailService, 'sendEmail')
      .mockResolvedValue({ success: true, messageId: 'msg-1' });

    const result = await emailService.enviarContrasena(
      'aprendiz@sena.edu.co',
      'Aprendiz Uno',
      '123456',
      'Temp123!'
    );

    expect(result.success).toBe(true);
    expect(sendSpy).toHaveBeenCalledWith(
      'aprendiz@sena.edu.co',
      expect.stringContaining('Credenciales de acceso'),
      expect.stringContaining('Aprendiz Uno'),
      expect.stringContaining('123456')
    );

    sendSpy.mockRestore();
  });

  it('enviarContrasenasMasivo debe consolidar exitosos y fallidos', async () => {
    const massSpy = jest
      .spyOn(emailService, 'enviarContrasena')
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'SMTP down' })
      .mockResolvedValueOnce({ success: false });

    const resultado = await emailService.enviarContrasenasMasivo([
      { correo: 'ok@sena.edu.co', nombreUsuario: 'OK', cedula: '1', password: 'abc' },
      { correo: 'fail@sena.edu.co', nombreUsuario: 'FAIL', cedula: '2', password: 'abc' },
      { correo: '', nombreUsuario: 'SIN CORREO', cedula: '3', password: 'abc' },
    ]);

    expect(resultado.exitosos).toBe(1);
    expect(resultado.fallidos).toBe(2);
    expect(resultado.errores).toHaveLength(2);
    expect(resultado.errores[0].razon).toBe('SMTP down');
    expect(resultado.errores[1].razon).toBe('Correo no proporcionado');

    massSpy.mockRestore();
  });

  it('enviarContrasenasMasivo debe usar mensaje genérico cuando hay correo pero no error', async () => {
    const massSpy = jest
      .spyOn(emailService, 'enviarContrasena')
      .mockResolvedValueOnce({ success: false });

    const resultado = await emailService.enviarContrasenasMasivo([
      { correo: 'fallo@sena.edu.co', nombreUsuario: 'FALLO', cedula: '2', password: 'abc' },
    ]);

    expect(resultado.exitosos).toBe(0);
    expect(resultado.fallidos).toBe(1);
    expect(resultado.errores).toEqual([
      {
        correo: 'fallo@sena.edu.co',
        nombre: 'FALLO',
        razon: 'Error al enviar correo',
      },
    ]);

    massSpy.mockRestore();
  });

  it('enviarCorreoRecuperacion debe construir plantilla y delegar en sendEmail', async () => {
    const sendSpy = jest
      .spyOn(emailService, 'sendEmail')
      .mockResolvedValue({ success: true, messageId: 'msg-2' });

    const result = await emailService.enviarCorreoRecuperacion(
      'usuario@sena.edu.co',
      'Usuario Demo',
      'https://app.sena.test/reset?token=abc'
    );

    expect(result.success).toBe(true);
    expect(sendSpy).toHaveBeenCalledWith(
      'usuario@sena.edu.co',
      expect.stringContaining('Recuperación de Contraseña'),
      expect.stringContaining('https://app.sena.test/reset?token=abc'),
      expect.stringContaining('Usuario Demo')
    );

    sendSpy.mockRestore();
  });
});
