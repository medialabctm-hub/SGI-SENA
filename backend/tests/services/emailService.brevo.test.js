import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, '../../src/config/config.js');

const mockSendTransacEmail = jest.fn();
const mockGetAccount = jest.fn();

const fakeBrevo = {
  ApiClient: {
    instance: {
      authentications: {
        'api-key': {},
      },
    },
  },
  TransactionalEmailsApi: class {
    sendTransacEmail(payload) {
      return mockSendTransacEmail(payload);
    }
  },
  SendSmtpEmail: class {
    constructor() {
      this.sender = null;
      this.to = [];
      this.subject = '';
      this.htmlContent = '';
      this.textContent = '';
    }
  },
  AccountApi: class {
    getAccount() {
      return mockGetAccount();
    }
  },
};

await jest.unstable_mockModule('@getbrevo/brevo', () => ({
  default: fakeBrevo,
}));

await jest.unstable_mockModule(configPath, () => ({
  config: {
    email: {
      brevoApiKey: 'config-api-key',
      user: 'config@sena.edu.co',
    },
  },
}));

const { default: emailService } = await import('../../src/services/emailService.js');

describe('emailService (brevo integration mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    process.env.BREVO_API_KEY = 'env-api-key';
    process.env.BREVO_SENDER_EMAIL = 'sender@sena.edu.co';
    fakeBrevo.ApiClient.instance = {
      authentications: {
        'api-key': {},
      },
    };
    fakeBrevo.TransactionalEmailsApi = class {
      sendTransacEmail(payload) {
        return mockSendTransacEmail(payload);
      }
    };
    emailService.apiInstance = new fakeBrevo.TransactionalEmailsApi();
    emailService.senderEmail = 'sender@sena.edu.co';
  });

  it('initializeBrevoAPI debe configurar apiInstance y api-key', async () => {
    emailService.apiInstance = null;

    await emailService.initializeBrevoAPI();

    expect(emailService.apiInstance).toBeTruthy();
    expect(fakeBrevo.ApiClient.instance.authentications['api-key'].apiKey).toBe('env-api-key');
    expect(emailService.senderEmail).toBe('sender@sena.edu.co');
  });

  it('verifyConnection debe retornar true cuando AccountApi responde', async () => {
    mockGetAccount.mockResolvedValueOnce({ companyName: 'SENA' });

    const result = await emailService.verifyConnection();

    expect(result).toBe(true);
  });

  it('verifyConnection debe retornar false cuando AccountApi falla', async () => {
    mockGetAccount.mockRejectedValueOnce(new Error('account down'));

    const result = await emailService.verifyConnection();

    expect(result).toBe(false);
  });

  it('sendEmail debe retornar success true cuando Brevo responde messageId', async () => {
    mockSendTransacEmail.mockResolvedValueOnce({ messageId: 'msg-123' });

    const result = await emailService.sendEmail(
      'destino@sena.edu.co',
      'Asunto demo',
      '<p>contenido</p>',
      'contenido'
    );

    expect(result).toEqual({ success: true, messageId: 'msg-123' });
    expect(mockSendTransacEmail).toHaveBeenCalledTimes(1);
  });

  it('sendEmail debe mapear error de API con response.body.message', async () => {
    mockSendTransacEmail.mockRejectedValueOnce({
      response: {
        status: 400,
        statusText: 'Bad Request',
        body: { message: 'invalid sender' },
      },
    });

    const result = await emailService.sendEmail(
      'destino@sena.edu.co',
      'Asunto demo',
      '<p>contenido</p>',
      'contenido'
    );

    expect(result).toEqual({ success: false, error: 'invalid sender' });
  });

  it('sendEmail debe mapear error genérico usando error.message', async () => {
    mockSendTransacEmail.mockRejectedValueOnce(new Error('network timeout'));

    const result = await emailService.sendEmail(
      'destino@sena.edu.co',
      'Asunto demo',
      '<p>contenido</p>',
      'contenido'
    );

    expect(result).toEqual({ success: false, error: 'network timeout' });
  });

  it('initializeBrevoAPI debe dejar apiInstance en null si ApiClient.instance no existe', async () => {
    emailService.apiInstance = null;
    fakeBrevo.ApiClient.instance = null;

    await emailService.initializeBrevoAPI();

    expect(emailService.apiInstance).toBeNull();
  });

  it('initializeBrevoAPI debe dejar apiInstance en null si falta TransactionalEmailsApi', async () => {
    emailService.apiInstance = null;
    fakeBrevo.TransactionalEmailsApi = null;

    await emailService.initializeBrevoAPI();

    expect(emailService.apiInstance).toBeNull();
  });

  it('sendEmail debe usar error.response.text cuando body.message no existe', async () => {
    mockSendTransacEmail.mockRejectedValueOnce({
      response: {
        status: 400,
        statusText: 'Bad Request',
        text: 'plain api error',
      },
    });

    const result = await emailService.sendEmail(
      'destino@sena.edu.co',
      'Asunto demo',
      '<p>contenido</p>',
      'contenido'
    );

    expect(result).toEqual({ success: false, error: 'plain api error' });
  });

  it('sendEmail debe retornar timeout si la API no responde', async () => {
    jest.useFakeTimers();
    mockSendTransacEmail.mockImplementationOnce(() => new Promise(() => {}));

    const promise = emailService.sendEmail(
      'destino@sena.edu.co',
      'Asunto demo',
      '<p>contenido</p>',
      'contenido'
    );

    await jest.advanceTimersByTimeAsync(30000);
    const result = await promise;

    expect(result).toEqual({
      success: false,
      error: 'Timeout: El envío del correo tardó más de 30 segundos',
    });
  });

  it('reinitialize debe delegar en initializeBrevoAPI', async () => {
    const spy = jest.spyOn(emailService, 'initializeBrevoAPI').mockResolvedValue();

    await emailService.reinitialize();

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
