import { Server } from 'socket.io';
import { logger } from '../utils/logger.js';

/**
 * Servicio de WebSocket para actualizaciones en tiempo real
 * Gestiona las conexiones Socket.io y emite eventos a los clientes conectados
 */
class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId[]
  }

  /**
   * Inicializa Socket.io con el servidor HTTP
   * @param {http.Server} server - Servidor HTTP de Express
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.io.use(async (socket, next) => {
      // Autenticación mediante token en query o handshake
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      
      if (!token) {
        return next(new Error('Token de autenticación requerido'));
      }

      // Verificar token usando el mismo servicio que el resto de la aplicación
      try {
        const { ServiceFactory } = await import('../factories/ServiceFactory.js');
        const jwtService = ServiceFactory.create('jwtService');
        const decoded = jwtService.verify(token);
        
        if (decoded && decoded.id) {
          socket.userId = decoded.id;
          socket.userRole = decoded.rol;
          next();
        } else {
          next(new Error('Token inválido'));
        }
      } catch (err) {
        logger.error('Error al verificar token en WebSocket', { error: err.message });
        next(new Error('Token inválido o expirado'));
      }
    });

    this.io.on('connection', (socket) => {
      const userId = socket.userId;
      
      if (!userId) {
        socket.disconnect();
        return;
      }

      // Registrar usuario conectado
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, []);
      }
      this.connectedUsers.get(userId).push(socket.id);

      logger.info('Cliente WebSocket conectado', {
        userId,
        socketId: socket.id,
        totalConnections: this.connectedUsers.size,
      });

      // Unirse a la sala del usuario para recibir notificaciones personalizadas
      socket.join(`user:${userId}`);

      // Manejar desconexión
      socket.on('disconnect', () => {
        const userSockets = this.connectedUsers.get(userId);
        if (userSockets) {
          const index = userSockets.indexOf(socket.id);
          if (index > -1) {
            userSockets.splice(index, 1);
          }
          if (userSockets.length === 0) {
            this.connectedUsers.delete(userId);
          }
        }
        logger.info('Cliente WebSocket desconectado', {
          userId,
          socketId: socket.id,
          totalConnections: this.connectedUsers.size,
        });
      });

      // Eventos personalizados del cliente
      socket.on('subscribe', (room) => {
        socket.join(room);
        logger.debug('Cliente suscrito a sala', { userId, room, socketId: socket.id });
      });

      socket.on('unsubscribe', (room) => {
        socket.leave(room);
        logger.debug('Cliente desuscrito de sala', { userId, room, socketId: socket.id });
      });
    });

    logger.info('✅ Servicio de WebSocket inicializado');
  }

  /**
   * Emite un evento a un usuario específico
   * @param {number} userId - ID del usuario
   * @param {string} event - Nombre del evento
   * @param {Object} data - Datos a enviar
   */
  emitToUser(userId, event, data) {
    if (!this.io) {
      logger.warn('Socket.io no inicializado, no se puede emitir evento', { userId, event });
      return;
    }
    this.io.to(`user:${userId}`).emit(event, data);
    logger.debug('Evento emitido a usuario', { userId, event });
  }

  /**
   * Emite un evento a todos los usuarios conectados
   * @param {string} event - Nombre del evento
   * @param {Object} data - Datos a enviar
   */
  emitToAll(event, data) {
    if (!this.io) {
      logger.warn('Socket.io no inicializado, no se puede emitir evento', { event });
      return;
    }
    this.io.emit(event, data);
    logger.debug('Evento emitido a todos los usuarios', { event });
  }

  /**
   * Emite un evento a una sala específica
   * @param {string} room - Nombre de la sala
   * @param {string} event - Nombre del evento
   * @param {Object} data - Datos a enviar
   */
  emitToRoom(room, event, data) {
    if (!this.io) {
      logger.warn('Socket.io no inicializado, no se puede emitir evento', { room, event });
      return;
    }
    this.io.to(room).emit(event, data);
    logger.debug('Evento emitido a sala', { room, event });
  }

  /**
   * Obtiene el número de usuarios conectados
   * @returns {number}
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Verifica si un usuario está conectado
   * @param {number} userId - ID del usuario
   * @returns {boolean}
   */
  isUserConnected(userId) {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId).length > 0;
  }
}

// Exportar instancia singleton
const socketService = new SocketService();
export default socketService;

