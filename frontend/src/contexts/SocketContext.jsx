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
  // MDL-127: ya no existe un JWT en el navegador. `hasSession` es solo el
  // indicador local no sensible (perfil cacheado por Login.jsx) que decide si
  // vale la pena intentar la conexión; la autenticación real del handshake la
  // hace el backend con la cookie httpOnly de sesión (withCredentials).
  const [hasSession, setHasSession] = useState(() => Boolean(localStorage.getItem('user')));

  useEffect(() => {
    const syncSession = () => setHasSession(Boolean(localStorage.getItem('user')));
    window.addEventListener('storage', syncSession);
    window.addEventListener('auth:changed', syncSession);
    return () => {
      window.removeEventListener('storage', syncSession);
      window.removeEventListener('auth:changed', syncSession);
    };
  }, []);

  useEffect(() => {
    if (!hasSession) {
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    // Crear conexión Socket.io
    // En desarrollo, usar el proxy de Vite (mismo origen)
    // En producción, usar el mismo origen
    // Socket.io funciona mejor con URLs relativas cuando hay proxy
    // MDL-127: el backend autentica el handshake exclusivamente con la cookie
    // httpOnly de sesión (withCredentials la envía); no se manda ningún token
    // leído del navegador.
    const socketUrl = window.location.origin;
    const newSocket = io(socketUrl, {
      withCredentials: true,
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
  }, [hasSession]);

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

