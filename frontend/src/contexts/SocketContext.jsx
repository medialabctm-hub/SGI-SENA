import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

/**
 * Proveedor de contexto para WebSocket
 * Gestiona la conexión Socket.io y proporciona eventos en tiempo real
 */
export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Obtener token de autenticación
    const token = localStorage.getItem('token');
    
    if (!token) {
      // No hay token, no conectar
      return;
    }

    // Crear conexión Socket.io
    // En desarrollo, usar el proxy de Vite (mismo origen)
    // En producción, usar el mismo origen
    // Socket.io funciona mejor con URLs relativas cuando hay proxy
    const socketUrl = window.location.origin;
    const newSocket = io(socketUrl, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      setConnected(false);
      
      // Si es un error de autenticación, no intentar reconectar
      if (reason === 'io server disconnect' || reason === 'transport close') {
        // El servidor desconectó, probablemente por autenticación
        setError('Error de autenticación');
      }
    });

    newSocket.on('connect_error', (err) => {
      // Ignorar errores de conexión iniciales (Socket.io los maneja automáticamente)
      if (!newSocket.io.reconnecting) {
        console.error('Error de conexión WebSocket:', err.message);
        setError(err.message);
      }
      setConnected(false);
    });

    newSocket.on('error', (err) => {
      // Solo loguear errores críticos
      if (err.message && !err.message.includes('transport')) {
        console.error('Error WebSocket:', err);
        setError(err.message || 'Error desconocido');
      }
    });

    setSocket(newSocket);

    // Limpiar al desmontar
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []); // Solo ejecutar una vez al montar

  // Reconectar cuando cambie el token
  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token && socket) {
      // Token eliminado, desconectar
      socket.disconnect();
      setSocket(null);
      setConnected(false);
    } else if (token && !socket) {
      // Token disponible pero no hay socket, reconectar
      // Esto se manejará en el useEffect principal
    }
  }, [socket]);

  /**
   * Suscribirse a un evento
   */
  const subscribe = useCallback((event, callback) => {
    if (!socket || !connected) {
      return () => {}; // Retornar función de limpieza vacía
    }

    socket.on(event, callback);
    
    // Retornar función para desuscribirse
    return () => {
      if (socket) {
        socket.off(event, callback);
      }
    };
  }, [socket, connected]);

  /**
   * Desuscribirse de un evento
   */
  const unsubscribe = useCallback((event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  }, [socket]);

  /**
   * Emitir un evento al servidor
   */
  const emit = useCallback((event, data) => {
    if (!socket || !connected) {
      return;
    }
    socket.emit(event, data);
  }, [socket, connected]);

  const value = {
    socket,
    connected,
    error,
    subscribe,
    unsubscribe,
    emit,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Hook para usar el contexto de WebSocket
 */
export function useSocket() {
  const context = useContext(SocketContext);
  // Si no hay contexto, retornar valores por defecto en lugar de lanzar error
  if (!context) {
    return {
      socket: null,
      connected: false,
      error: null,
      subscribe: () => () => {}, // Función vacía que retorna función de limpieza vacía
      unsubscribe: () => {},
      emit: () => {},
    };
  }
  return context;
}

export default SocketContext;

