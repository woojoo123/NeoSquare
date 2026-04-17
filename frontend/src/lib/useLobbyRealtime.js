import { useEffect, useRef, useState } from 'react';
import { clearCachedWebSocketTicket, getAuthenticatedWebSocketUrl } from './webSocketUrl';

const MOVE_THROTTLE_MS = 120;
const MOVE_DISTANCE_THRESHOLD = 12;
const MOVE_DISTANCE_THRESHOLD_SQUARED = MOVE_DISTANCE_THRESHOLD * MOVE_DISTANCE_THRESHOLD;
const REMOTE_EVENT_TYPES = new Set(['user_enter', 'user_move', 'user_leave']);
const CHAT_MESSAGE_LIMIT = 80;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 5000;
const CHAT_SCOPE_PUBLIC = 'PUBLIC';
const CHAT_SCOPE_WHISPER = 'WHISPER';
const CHAT_VARIANT_TEXT = 'TEXT';
const CHAT_VARIANT_EMOJI = 'EMOJI';

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
    avatarPresetId:
      typeof payload.avatarPresetId === 'string' ? payload.avatarPresetId.trim() || null : null,
    label:
      payload.nickname ||
      payload.label ||
      payload.userNickname ||
      payload.userName ||
      `사용자 ${remoteUserId}`,
  };
}

function normalizeChatMessage(message, currentUserId, activeSpaceId) {
  if (message?.type !== 'chat_send') {
    return null;
  }

  const payload = message?.payload || {};
  const senderId = toNumber(message?.senderId) ?? toNumber(payload.userId) ?? toNumber(payload.id);
  const recipientUserId = toNumber(payload.recipientUserId);
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';
  const messageSpaceId = toNumber(payload.spaceId);
  const scope =
    typeof payload.scope === 'string' ? payload.scope.trim().toUpperCase() : CHAT_SCOPE_PUBLIC;
  const variant =
    typeof payload.variant === 'string' ? payload.variant.trim().toUpperCase() : CHAT_VARIANT_TEXT;

  if (!senderId || !content) {
    return null;
  }

  if (activeSpaceId && messageSpaceId && messageSpaceId !== activeSpaceId) {
    return null;
  }

  if (
    scope === CHAT_SCOPE_WHISPER &&
    senderId !== currentUserId &&
    recipientUserId !== currentUserId
  ) {
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
      `사용자 ${senderId}`,
    content,
    scope,
    variant,
    recipientUserId,
    recipientNickname:
      payload.recipientNickname ||
      payload.recipientLabel ||
      payload.recipientUserNickname ||
      null,
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

export function useLobbyRealtime({ enabled, userId, nickname, spaceId, avatarPresetId }) {
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [lastMessage, setLastMessage] = useState(null);
  const [lastError, setLastError] = useState('');
  const [remoteEvent, setRemoteEvent] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [latestChatMessage, setLatestChatMessage] = useState(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const socketRef = useRef(null);
  const hasEnteredRef = useRef(false);
  const lastMoveSentAtRef = useRef(0);
  const lastMovePositionRef = useRef(null);
  const currentPositionRef = useRef(null);
  const remoteEventSequenceRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  function sendUserMove(position) {
    if (!position) {
      return;
    }

    const nextPosition = {
      x: Math.round(position.x),
      y: Math.round(position.y),
    };
    currentPositionRef.current = nextPosition;

    if (!userId || !spaceId) {
      return;
    }

    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN || !hasEnteredRef.current) {
      return;
    }
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
          avatarPresetId,
        },
      })
    );

    lastMoveSentAtRef.current = now;
    lastMovePositionRef.current = nextPosition;
  }

  function sendChatMessage(content, options = {}) {
    const trimmedContent = typeof content === 'string' ? content.trim() : '';
    const scope =
      typeof options.scope === 'string' && options.scope.trim()
        ? options.scope.trim().toUpperCase()
        : CHAT_SCOPE_PUBLIC;
    const variant =
      typeof options.variant === 'string' && options.variant.trim()
        ? options.variant.trim().toUpperCase()
        : CHAT_VARIANT_TEXT;
    const recipientUserId = toNumber(options.recipientUserId);
    const recipientNickname =
      typeof options.recipientNickname === 'string' ? options.recipientNickname.trim() : '';

    if (!trimmedContent || !userId || !spaceId || !nickname) {
      return false;
    }

    if (scope === CHAT_SCOPE_WHISPER && !recipientUserId) {
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
          scope,
          variant,
          recipientUserId,
          recipientNickname: recipientNickname || null,
        },
      })
    );

    const optimisticMessage = {
      id: clientMessageId,
      senderId: userId,
      nickname,
      content: trimmedContent,
      scope,
      variant,
      recipientUserId,
      recipientNickname: recipientNickname || null,
      timestamp: new Date().toISOString(),
      isMine: true,
      clientMessageId,
    };

    setChatMessages((previousMessages) => appendChatMessage(previousMessages, optimisticMessage));
    setLatestChatMessage(optimisticMessage);

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
      setLatestChatMessage(null);
      setReconnectAttempt(0);
      socketRef.current = null;
      hasEnteredRef.current = false;
      lastMoveSentAtRef.current = 0;
      lastMovePositionRef.current = null;
      currentPositionRef.current = null;
      remoteEventSequenceRef.current = 0;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return undefined;
    }

    let isDisposed = false;
    let socket;
    let reconnectAttemptCount = 0;
    const intentionalCloseSockets = new WeakSet();

    function clearReconnectTimer() {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }

    function resetPresenceState() {
      setRemoteEvent(null);
      setRemoteUsers([]);
      setLatestChatMessage(null);
      hasEnteredRef.current = false;
      lastMoveSentAtRef.current = 0;
      lastMovePositionRef.current = null;
      remoteEventSequenceRef.current = 0;
    }

    function closeSocket(targetSocket, { sendLeave = false } = {}) {
      if (!targetSocket) {
        return;
      }

      intentionalCloseSockets.add(targetSocket);

      if (
        sendLeave &&
        targetSocket.readyState === WebSocket.OPEN &&
        hasEnteredRef.current &&
        spaceId
      ) {
        try {
          targetSocket.send(
            JSON.stringify({
              type: 'user_leave',
              senderId: userId,
              payload: {
                spaceId,
              },
            })
          );
        } catch (error) {
          console.warn('Failed to send lobby leave event before closing socket:', error);
        }
      }

      targetSocket.close();
    }

    function scheduleReconnect(reason) {
      if (isDisposed || reconnectTimeoutRef.current) {
        return;
      }

      reconnectAttemptCount += 1;
      setReconnectAttempt(reconnectAttemptCount);

      const delay = Math.min(
        RECONNECT_BASE_DELAY_MS * (2 ** Math.max(0, reconnectAttemptCount - 1)),
        RECONNECT_MAX_DELAY_MS
      );

      resetPresenceState();
      setConnectionStatus('reconnecting');
      setLastError(reason || `실시간 연결이 끊겼습니다. ${Math.round(delay / 1000)}초 후 다시 시도합니다.`);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connectSocket();
      }, delay);
    }

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
              avatarPresetId: nextRemoteEvent.avatarPresetId,
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
          setChatMessages((previousMessages) => appendChatMessage(previousMessages, nextChatMessage));
          setLatestChatMessage(nextChatMessage);
        }

        if (
          parsedMessage.type === 'ws_connected' &&
          !hasEnteredRef.current &&
          socket?.readyState === WebSocket.OPEN
        ) {
          reconnectAttemptCount = 0;
          setReconnectAttempt(0);
          setConnectionStatus('connected');
          setLastError('');
          socket.send(
            JSON.stringify({
              type: 'user_enter',
              senderId: userId,
              payload: {
                spaceId,
                nickname,
                x: currentPositionRef.current?.x ?? null,
                y: currentPositionRef.current?.y ?? null,
                avatarPresetId,
              },
            })
          );
          hasEnteredRef.current = true;
        }
      } catch (error) {
        if (isDisposed) {
          return;
        }

        setLastError('실시간 메시지를 해석하지 못했습니다.');
        console.error('Failed to parse realtime message:', error);
      }
    }

    async function connectSocket() {
      try {
        setConnectionStatus(reconnectAttemptCount > 0 ? 'reconnecting' : 'connecting');
        setLastMessage(null);
        setLastError(reconnectAttemptCount > 0 ? '실시간 연결을 다시 시도하는 중입니다.' : '');
        if (reconnectAttemptCount > 0) {
          resetPresenceState();
        } else {
          setRemoteEvent(null);
          setRemoteUsers([]);
          setChatMessages([]);
          setLatestChatMessage(null);
          hasEnteredRef.current = false;
          lastMoveSentAtRef.current = 0;
          lastMovePositionRef.current = null;
          remoteEventSequenceRef.current = 0;
        }
        const socketUrl = await getAuthenticatedWebSocketUrl();

        if (isDisposed) {
          return;
        }

        socket = new WebSocket(socketUrl);
        socketRef.current = socket;
      } catch (error) {
        setConnectionStatus('error');
        setLastError('실시간 연결을 만들지 못했습니다.');
        clearCachedWebSocketTicket();
        console.error('Failed to create WebSocket connection:', error);
        return;
      }

      socket.onopen = () => {
        if (isDisposed) {
          return;
        }

        setConnectionStatus(reconnectAttemptCount > 0 ? 'reconnecting' : 'connected');
      };

      socket.onmessage = handleIncomingMessage;

      socket.onerror = () => {
        if (isDisposed) {
          return;
        }

        clearCachedWebSocketTicket();
        setConnectionStatus('reconnecting');
        setLastError('실시간 연결 중 오류가 발생했습니다. 자동으로 다시 연결합니다.');
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        if (isDisposed) {
          return;
        }

        if (intentionalCloseSockets.has(socket)) {
          return;
        }

        scheduleReconnect();
      };
    }

    void connectSocket();

    return () => {
      isDisposed = true;
      clearReconnectTimer();
      setReconnectAttempt(0);
      socketRef.current = null;
      hasEnteredRef.current = false;
      lastMoveSentAtRef.current = 0;
      lastMovePositionRef.current = null;
      currentPositionRef.current = null;
      remoteEventSequenceRef.current = 0;
      closeSocket(socket, { sendLeave: true });
    };
  }, [avatarPresetId, enabled, nickname, spaceId, userId]);

  return {
    connectionStatus,
    lastMessage,
    lastError,
    remoteEvent,
    remoteUsers,
    chatMessages,
    latestChatMessage,
    reconnectAttempt,
    sendChatMessage,
    sendUserMove,
  };
}
