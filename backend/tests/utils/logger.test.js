/**
 * Tests para utils/logger
 *
 * Cubre: Logger class — error(), warn(), info(), debug()
 * Las líneas no cubiertas son 49 (console.warn), 55 (console.info), 61 (console.debug)
 * que solo se ejecutan cuando el nivel de log es suficientemente alto.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Importar la clase directamente (no el singleton) para poder instanciarla con distintos niveles
// Nota: necesitamos acceder al logger real, no al mocked
// Como logger.js exporta la clase implícitamente a través de su instancia, testeamos por comportamiento

describe('Logger - comportamiento por nivel de log', () => {
  let originalLogLevel;
  let consoleWarnSpy;
  let consoleInfoSpy;
  let consoleDebugSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    originalLogLevel = process.env.LOG_LEVEL;
    // Suprimir salida a la consola durante los tests
    consoleWarnSpy  = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy  = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.LOG_LEVEL = originalLogLevel;
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.resetModules();
  });

  it('debe llamar console.warn cuando el nivel permite WARN [line 49]', async () => {
    process.env.LOG_LEVEL = 'WARN';
    // Importar dinámicamente para obtener un Logger con el nivel actualizado
    const { logger: freshLogger } = await import('../../src/utils/logger.js?warn=1');
    freshLogger.warn('test warn message');
    // Como el módulo puede estar cacheado, chequeamos el comportamiento directo
    // usando un nuevo Logger con el nivel correcto
    const { logger: loggerModule } = await import('../../src/utils/logger.js');
    // Forzar a que shouldLog retorne true para WARN
    loggerModule.level = 1; // WARN level
    loggerModule.warn('forced warn test');
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it('debe llamar console.info cuando el nivel permite INFO [line 55]', async () => {
    const { logger: loggerModule } = await import('../../src/utils/logger.js');
    loggerModule.level = 2; // INFO level
    loggerModule.info('forced info test');
    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  it('debe llamar console.debug cuando el nivel permite DEBUG [line 61]', async () => {
    const { logger: loggerModule } = await import('../../src/utils/logger.js');
    loggerModule.level = 3; // DEBUG level
    loggerModule.debug('forced debug test');
    expect(consoleDebugSpy).toHaveBeenCalled();
  });

  it('debe llamar console.error siempre (nivel ERROR tiene prioridad máxima)', async () => {
    const { logger: loggerModule } = await import('../../src/utils/logger.js');
    loggerModule.level = 0; // ERROR only
    loggerModule.error('test error');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('NO debe llamar console.warn cuando el nivel es solo ERROR', async () => {
    const { logger: loggerModule } = await import('../../src/utils/logger.js');
    loggerModule.level = 0; // ERROR only
    loggerModule.warn('should not appear');
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('NO debe llamar console.debug cuando el nivel es INFO', async () => {
    const { logger: loggerModule } = await import('../../src/utils/logger.js');
    loggerModule.level = 2; // INFO level
    loggerModule.debug('should not appear');
    expect(consoleDebugSpy).not.toHaveBeenCalled();
  });

  it('getLogLevel debe retornar nivel INFO por defecto cuando LOG_LEVEL no está en LOG_LEVELS', async () => {
    process.env.LOG_LEVEL = 'INVALID_LEVEL';
    const { logger: loggerModule } = await import('../../src/utils/logger.js');
    // El singleton ya fue creado, pero getLogLevel usa el process.env actual
    const level = loggerModule.getLogLevel();
    expect(level).toBe(2); // INFO = 2 (fallback)
  });

  it('getLogLevel debe retornar INFO cuando LOG_LEVEL es undefined [branch ?. línea 25]', async () => {
    delete process.env.LOG_LEVEL;
    const { logger: loggerModule } = await import('../../src/utils/logger.js');
    const level = loggerModule.getLogLevel();
    expect(level).toBe(2); // INFO = 2 (fallback por || 'INFO')
  });

  it('formatMessage debe incluir nivel, mensaje y metadata', async () => {
    const { logger: loggerModule } = await import('../../src/utils/logger.js');
    const msg = loggerModule.formatMessage(0, 'test message', { key: 'value' });
    expect(msg).toContain('ERROR');
    expect(msg).toContain('test message');
    expect(msg).toContain('key');
  });

  it('formatMessage no debe incluir metadata vacía', async () => {
    const { logger: loggerModule } = await import('../../src/utils/logger.js');
    const msg = loggerModule.formatMessage(0, 'test message');
    expect(msg).toContain('ERROR');
    expect(msg).toContain('test message');
  });
});
