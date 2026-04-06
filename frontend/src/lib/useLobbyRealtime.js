import { useEffect, useState } from 'react';

function getLobbyWebSocketUrl() {
  const configuredUrl = import.meta.env.VITE_WS_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window === 'undefined') {
    return 'ws://localhost:8080/ws';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function useLobbyRealtime({ enabled, userId, nickname, spaceId }) {
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [lastMessage, setLastMessage] = useState(null);
  const [lastError, setLastError] = useState('');

  useEffect(() => {
    if (!enabled || !userId || !nickname) {
      setConnectionStatus('idle');
      setLastMessage(null);
      setLastError('');
      return undefined;
    }

    let isDisposed = false;
    let hasSentEnter = false;
    let socket;

    function handleIncomingMessage(event) {
      try {
        const parsedMessage = JSON.parse(event.data);

        if (isDisposed) {
          return;
        }

        setLastMessage(parsedMessage);
        setLastError('');
        console.info('Lobby realtime message received:', parsedMessage);

        if (
          parsedMessage.type === 'ws_connected' &&
          !hasSentEnter &&
          socket?.readyState === WebSocket.OPEN
        ) {
          socket.send(
            JSON.stringify({
              type: 'user_enter',
              senderId: userId,
              payload: {
                spaceId,
                nickname,
              },
            })
          );
          hasSentEnter = true;
        }
      } catch (error) {
        if (isDisposed) {
          return;
        }

        setLastError('Failed to parse realtime message.');
        console.error('Failed to parse realtime message:', error);
      }
    }

    try {
      setConnectionStatus('connecting');
      setLastMessage(null);
      setLastError('');
      socket = new WebSocket(getLobbyWebSocketUrl());
    } catch (error) {
      setConnectionStatus('error');
      setLastError('Failed to create WebSocket connection.');
      console.error('Failed to create WebSocket connection:', error);
      return undefined;
    }

    socket.onopen = () => {
      if (isDisposed) {
        return;
      }

      setConnectionStatus('connected');
    };

    socket.onmessage = handleIncomingMessage;

    socket.onerror = () => {
      if (isDisposed) {
        return;
      }

      setConnectionStatus('error');
      setLastError('WebSocket connection error.');
    };

    socket.onclose = () => {
      if (isDisposed) {
        return;
      }

      setConnectionStatus('disconnected');
    };

    return () => {
      isDisposed = true;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else {
        socket?.close();
      }
    };
  }, [enabled, nickname, spaceId, userId]);

  return {
    connectionStatus,
    lastMessage,
    lastError,
  };
}
