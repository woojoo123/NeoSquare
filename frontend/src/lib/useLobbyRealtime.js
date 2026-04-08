import { useEffect, useRef, useState } from 'react';
import { getAuthenticatedWebSocketUrl } from './webSocketUrl';

const MOVE_THROTTLE_MS = 120;
const MOVE_DISTANCE_THRESHOLD = 12;
const MOVE_DISTANCE_THRESHOLD_SQUARED = MOVE_DISTANCE_THRESHOLD * MOVE_DISTANCE_THRESHOLD;
const REMOTE_EVENT_TYPES = new Set(['user_enter', 'user_move', 'user_leave']);
const CHAT_MESSAGE_LIMIT = 80;

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsedNumber = Number(value);

    if (Number.isFinite(parsedNumber)) {
      return parsedNumber;
    }
  }

  return null;
}

function normalizeRemoteEvent(message, currentUserId, activeSpaceId, sequence) {
  if (!REMOTE_EVENT_TYPES.has(message?.type)) {
    return null;
  }

  const payload = message?.payload || {};
  const remoteUserId = toNumber(message?.senderId) ?? toNumber(payload.userId) ?? toNumber(payload.id);
  const messageSpaceId = toNumber(payload.spaceId);

  if (!remoteUserId || remoteUserId === currentUserId) {
    return null;
  }

  if (activeSpaceId && messageSpaceId && messageSpaceId !== activeSpaceId) {
    return null;
  }

  return {
    sequence,
    type: message.type,
    userId: remoteUserId,
    x: toNumber(payload.x),
    y: toNumber(payload.y),
    label:
      payload.nickname ||
      payload.label ||
      payload.userNickname ||
      payload.userName ||
      `User ${remoteUserId}`,
  };
}

function normalizeChatMessage(message, currentUserId, activeSpaceId) {
  if (message?.type !== 'chat_send') {
    return null;
  }

  const payload = message?.payload || {};
  const senderId = toNumber(message?.senderId) ?? toNumber(payload.userId) ?? toNumber(payload.id);
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';
  const messageSpaceId = toNumber(payload.spaceId);

  if (!senderId || !content) {
    return null;
  }

  if (activeSpaceId && messageSpaceId && messageSpaceId !== activeSpaceId) {
    return null;
  }

  return {
    id:
      payload.clientMessageId ||
      `${message.timestamp || Date.now()}-${senderId}-${content}`,
    senderId,
    nickname:
      payload.nickname ||
      payload.label ||
      payload.userNickname ||
      payload.userName ||
      `User ${senderId}`,
    content,
    timestamp: message.timestamp || new Date().toISOString(),
    isMine: senderId === currentUserId,
    clientMessageId: payload.clientMessageId || null,
  };
}

function appendChatMessage(previousMessages, nextMessage) {
  const hasDuplicate = previousMessages.some((message) => {
    if (nextMessage.clientMessageId && message.clientMessageId) {
      return message.clientMessageId === nextMessage.clientMessageId;
    }

    return message.id === nextMessage.id;
  });

  if (hasDuplicate) {
    return previousMessages;
  }

  return [...previousMessages, nextMessage].slice(-CHAT_MESSAGE_LIMIT);
}

export function useLobbyRealtime({ enabled, userId, nickname, spaceId }) {
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [lastMessage, setLastMessage] = useState(null);
  const [lastError, setLastError] = useState('');
  const [remoteEvent, setRemoteEvent] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const socketRef = useRef(null);
  const hasEnteredRef = useRef(false);
  const lastMoveSentAtRef = useRef(0);
  const lastMovePositionRef = useRef(null);
  const remoteEventSequenceRef = useRef(0);

  function sendUserMove(position) {
    if (!position || !userId || !spaceId) {
      return;
    }

    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN || !hasEnteredRef.current) {
      return;
    }

    const nextPosition = {
      x: Math.round(position.x),
      y: Math.round(position.y),
    };
    const previousPosition = lastMovePositionRef.current;
    const now = Date.now();

    if (previousPosition) {
      const dx = nextPosition.x - previousPosition.x;
      const dy = nextPosition.y - previousPosition.y;
      const movedDistanceSquared = dx * dx + dy * dy;

      if (
        now - lastMoveSentAtRef.current < MOVE_THROTTLE_MS ||
        movedDistanceSquared < MOVE_DISTANCE_THRESHOLD_SQUARED
      ) {
        return;
      }
    }

    socket.send(
      JSON.stringify({
        type: 'user_move',
        senderId: userId,
        payload: {
          spaceId,
          x: nextPosition.x,
          y: nextPosition.y,
        },
      })
    );

    lastMoveSentAtRef.current = now;
    lastMovePositionRef.current = nextPosition;
  }

  function sendChatMessage(content) {
    const trimmedContent = typeof content === 'string' ? content.trim() : '';

    if (!trimmedContent || !userId || !spaceId || !nickname) {
      return false;
    }

    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN || !hasEnteredRef.current) {
      return false;
    }

    const clientMessageId = `chat-${userId}-${Date.now()}`;

    socket.send(
      JSON.stringify({
        type: 'chat_send',
        senderId: userId,
        payload: {
          spaceId,
          content: trimmedContent,
          nickname,
          clientMessageId,
        },
      })
    );

    setChatMessages((previousMessages) =>
      appendChatMessage(previousMessages, {
        id: clientMessageId,
        senderId: userId,
        nickname,
        content: trimmedContent,
        timestamp: new Date().toISOString(),
        isMine: true,
        clientMessageId,
      })
    );

    return true;
  }

  useEffect(() => {
    if (!enabled || !userId || !nickname) {
      setConnectionStatus('idle');
      setLastMessage(null);
      setLastError('');
      setRemoteEvent(null);
      setRemoteUsers([]);
      setChatMessages([]);
      socketRef.current = null;
      hasEnteredRef.current = false;
      lastMoveSentAtRef.current = 0;
      lastMovePositionRef.current = null;
      remoteEventSequenceRef.current = 0;
      return undefined;
    }

    let isDisposed = false;
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

        const nextRemoteEvent = normalizeRemoteEvent(
          parsedMessage,
          userId,
          spaceId,
          remoteEventSequenceRef.current + 1
        );

        if (nextRemoteEvent) {
          remoteEventSequenceRef.current = nextRemoteEvent.sequence;
          setRemoteEvent(nextRemoteEvent);
          setRemoteUsers((previousUsers) => {
            if (nextRemoteEvent.type === 'user_leave') {
              return previousUsers.filter((user) => user.userId !== nextRemoteEvent.userId);
            }

            const nextUser = {
              userId: nextRemoteEvent.userId,
              label: nextRemoteEvent.label,
              x: nextRemoteEvent.x,
              y: nextRemoteEvent.y,
            };
            const existingUserIndex = previousUsers.findIndex(
              (user) => user.userId === nextRemoteEvent.userId
            );

            if (existingUserIndex === -1) {
              return [...previousUsers, nextUser];
            }

            const updatedUsers = [...previousUsers];
            updatedUsers[existingUserIndex] = {
              ...updatedUsers[existingUserIndex],
              ...nextUser,
            };
            return updatedUsers;
          });
        }

        const nextChatMessage = normalizeChatMessage(parsedMessage, userId, spaceId);

        if (nextChatMessage) {
          setChatMessages((previousMessages) =>
            appendChatMessage(previousMessages, nextChatMessage)
          );
        }

        if (
          parsedMessage.type === 'ws_connected' &&
          !hasEnteredRef.current &&
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
          hasEnteredRef.current = true;
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
      setRemoteEvent(null);
      setRemoteUsers([]);
      setChatMessages([]);
      hasEnteredRef.current = false;
      lastMoveSentAtRef.current = 0;
      lastMovePositionRef.current = null;
      remoteEventSequenceRef.current = 0;
      socket = new WebSocket(getAuthenticatedWebSocketUrl());
      socketRef.current = socket;
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
      socketRef.current = null;
      hasEnteredRef.current = false;
    };

    return () => {
      isDisposed = true;
      socketRef.current = null;
      hasEnteredRef.current = false;
      lastMoveSentAtRef.current = 0;
      lastMovePositionRef.current = null;
      remoteEventSequenceRef.current = 0;
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
    remoteEvent,
    remoteUsers,
    chatMessages,
    sendChatMessage,
    sendUserMove,
  };
}
