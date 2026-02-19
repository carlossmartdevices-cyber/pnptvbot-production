import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

let sharedSocket = null;
let socketRefCount = 0;

function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }
  socketRefCount++;
  return sharedSocket;
}

function releaseSocket() {
  socketRefCount--;
  if (socketRefCount <= 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
    socketRefCount = 0;
  }
}

export function useChat(room = 'general') {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit('chat:join', { room });
    };
    const onDisconnect = () => setConnected(false);
    const onHistory = (msgs) => setMessages(msgs);
    const onMessage = (msg) => setMessages(prev => [...prev, msg]);
    const onError = (err) => setError(err.message);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('chat:history', onHistory);
    socket.on('chat:message', onMessage);
    socket.on('chat:error', onError);

    if (socket.connected) {
      setConnected(true);
      socket.emit('chat:join', { room });
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('chat:history', onHistory);
      socket.off('chat:message', onMessage);
      socket.off('chat:error', onError);
      releaseSocket();
    };
  }, [room]);

  const sendMessage = useCallback((content) => {
    if (socketRef.current && content.trim()) {
      socketRef.current.emit('chat:message', { room, content });
    }
  }, [room]);

  return { messages, connected, error, sendMessage };
}

export function useDMSocket(onReceived) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onDM = (msg) => onReceived && onReceived(msg);
    socket.on('dm:received', onDM);

    return () => {
      socket.off('dm:received', onDM);
      releaseSocket();
    };
  }, []);

  const sendDM = useCallback((recipientId, content) => {
    if (socketRef.current) {
      socketRef.current.emit('dm:send', { recipientId, content });
    }
  }, []);

  const sendTyping = useCallback((recipientId) => {
    if (socketRef.current) {
      socketRef.current.emit('dm:typing', { recipientId });
    }
  }, []);

  return { sendDM, sendTyping };
}
