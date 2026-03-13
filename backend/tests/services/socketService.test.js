import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let useHandler;
let connectionHandler;
const mockVerify = jest.fn();
const mockCreate = jest.fn(() => ({ verify: mockVerify }));

class FakeServer {
  constructor() {
    this.use = jest.fn((handler) => {
      useHandler = handler;
    });
    this.on = jest.fn((event, handler) => {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    });
    this.to = jest.fn(() => ({ emit: jest.fn() }));
    this.emit = jest.fn();
  }
}

await jest.unstable_mockModule('socket.io', () => ({
  Server: FakeServer,
}));

await jest.unstable_mockModule(path.resolve(__dirname, '../../src/factories/ServiceFactory.js'), () => ({
  ServiceFactory: {
    create: mockCreate,
  },
}));

const { default: socketService } = await import('../../src/services/socketService.js');

describe('socketService', () => {
  beforeEach(() => {
    socketService.io = null;
    socketService.connectedUsers = new Map();
    useHandler = undefined;
    connectionHandler = undefined;
    jest.clearAllMocks();
  });

  it('emitToUser no debe lanzar excepcion si io no esta inicializado', () => {
    expect(() => {
      socketService.emitToUser(123, 'notification:new', { ok: true });
    }).not.toThrow();
  });

  it('initialize debe rechazar handshake sin token', async () => {
    socketService.initialize({});

    const next = jest.fn();
    const socket = {
      handshake: {
        auth: {},
        query: {},
      },
    };

    await useHandler(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toContain('Token de autenticación requerido');
  });

  it('initialize debe rechazar token inválido cuando verify no trae id', async () => {
    socketService.initialize({});
    mockVerify.mockReturnValueOnce({ rol: 'Aprendiz' });

    const next = jest.fn();
    const socket = {
      handshake: {
        auth: { token: 'bad-token' },
        query: {},
      },
    };

    await useHandler(socket, next);

    expect(mockCreate).toHaveBeenCalledWith('jwtService');
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Token inválido');
  });

  it('initialize debe rechazar token expirado cuando verify lanza error', async () => {
    socketService.initialize({});
    mockVerify.mockImplementationOnce(() => {
      throw new Error('jwt expired');
    });

    const next = jest.fn();
    const socket = {
      handshake: {
        auth: { token: 'expired-token' },
        query: {},
      },
    };

    await useHandler(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Token inválido o expirado');
  });

  it('initialize debe aceptar token válido y setear userId/userRole', async () => {
    socketService.initialize({});
    mockVerify.mockReturnValueOnce({ id: 9, rol: 'Instructor' });

    const next = jest.fn();
    const socket = {
      handshake: {
        auth: { token: 'valid-token' },
        query: {},
      },
    };

    await useHandler(socket, next);

    expect(socket.userId).toBe(9);
    expect(socket.userRole).toBe('Instructor');
    expect(next).toHaveBeenCalledWith();
  });

  it('debe desconectar socket cuando no existe userId en conexión', () => {
    socketService.initialize({});

    const socket = {
      userId: null,
      disconnect: jest.fn(),
      on: jest.fn(),
      join: jest.fn(),
    };

    connectionHandler(socket);

    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('debe registrar y limpiar sockets por usuario al desconectar', () => {
    socketService.initialize({});

    const handlersByEvent = {};
    const socket1 = {
      userId: 77,
      id: 'socket-1',
      join: jest.fn(),
      on: jest.fn((event, handler) => {
        handlersByEvent[event] = handler;
      }),
      disconnect: jest.fn(),
      leave: jest.fn(),
    };

    const socket2 = {
      userId: 77,
      id: 'socket-2',
      join: jest.fn(),
      on: jest.fn((event, handler) => {
        handlersByEvent[`2_${event}`] = handler;
      }),
      disconnect: jest.fn(),
      leave: jest.fn(),
    };

    connectionHandler(socket1);
    expect(socketService.connectedUsers.get(77)).toEqual(['socket-1']);

    connectionHandler(socket2);
    expect(socketService.connectedUsers.get(77)).toEqual(['socket-1', 'socket-2']);

    handlersByEvent.disconnect();
    expect(socketService.connectedUsers.get(77)).toEqual(['socket-2']);

    handlersByEvent['2_disconnect']();
    expect(socketService.connectedUsers.has(77)).toBe(false);
  });

  it('debe manejar eventos subscribe y unsubscribe', () => {
    socketService.initialize({});

    const handlersByEvent = {};
    const socket = {
      userId: 10,
      id: 'socket-sub',
      join: jest.fn(),
      leave: jest.fn(),
      on: jest.fn((event, handler) => {
        handlersByEvent[event] = handler;
      }),
      disconnect: jest.fn(),
    };

    connectionHandler(socket);
    handlersByEvent.subscribe('room:test');
    handlersByEvent.unsubscribe('room:test');

    expect(socket.join).toHaveBeenCalledWith('user:10');
    expect(socket.join).toHaveBeenCalledWith('room:test');
    expect(socket.leave).toHaveBeenCalledWith('room:test');
  });

  it('emitToUser, emitToAll y emitToRoom deben emitir cuando io existe', () => {
    socketService.initialize({});

    const roomEmitter = { emit: jest.fn() };
    socketService.io.to = jest.fn(() => roomEmitter);
    socketService.io.emit = jest.fn();

    socketService.emitToUser(99, 'notification:new', { ok: true });
    socketService.emitToAll('global:event', { data: 1 });
    socketService.emitToRoom('room:abc', 'room:event', { data: 2 });

    expect(socketService.io.to).toHaveBeenCalledWith('user:99');
    expect(socketService.io.to).toHaveBeenCalledWith('room:abc');
    expect(roomEmitter.emit).toHaveBeenCalledWith('notification:new', { ok: true });
    expect(roomEmitter.emit).toHaveBeenCalledWith('room:event', { data: 2 });
    expect(socketService.io.emit).toHaveBeenCalledWith('global:event', { data: 1 });
  });

  it('isUserConnected y getConnectedUsersCount deben reflejar mapa de usuarios', () => {
    socketService.connectedUsers.set(1, ['s1']);
    socketService.connectedUsers.set(2, []);

    expect(socketService.getConnectedUsersCount()).toBe(2);
    expect(socketService.isUserConnected(1)).toBe(true);
    expect(socketService.isUserConnected(2)).toBe(false);
    expect(socketService.isUserConnected(99)).toBe(false);
  });
});
