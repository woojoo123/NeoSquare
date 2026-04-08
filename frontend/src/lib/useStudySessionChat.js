import { useEffect, useRef, useState } from 'react';
import { getAuthenticatedWebSocketUrl } from './webSocketUrl';

const STUDY_SESSION_CHAT_LIMIT = 120;

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

function appendSessionMessage(previousMessages, nextMessage) {
  const hasDuplicate = previousMessages.some((message) => {
    if (nextMessage.clientMessageId && message.clientMessageId) {
      return message.clientMessageId === nextMessage.clientMessageId;
    }

    return message.id === nextMessage.id;
  });

  if (hasDuplicate) {
    return previousMessages;
  }

  return [...previousMessages, nextMessage].slice(-STUDY_SESSION_CHAT_LIMIT);
}

function normalizeStudySessionChatMessage(message, currentUserId, studySessionId) {
  if (message?.type !== 'chat_send') {
    return null;
  }

  const payload = message?.payload || {};
  const messageStudySessionId = toNumber(payload.studySessionId);
  const senderId = toNumber(message?.senderId) ?? toNumber(payload.userId) ?? toNumber(payload.id);
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';
  const scope = payload.scope;

  if (!senderId || !content || messageStudySessionId !== studySessionId) {
    return null;
  }

  if (scope && scope !== 'study_session') {
    return null;
  }

  return {
    id: payload.clientMessageId || `${message.timestamp || Date.now()}-${senderId}-${content}`,
    senderId,
    nickname:
      payload.nickname ||
      payload.label ||
      payload.userNickname ||
      payload.userName ||
      `사용자 ${senderId}`,
    content,
    timestamp: message.timestamp || new Date().toISOString(),
    isMine: senderId === currentUserId,
    clientMessageId: payload.clientMessageId || null,
  };
}

export function useStudySessionChat({ enabled, studySessionId, userId, nickname }) {
  const [messages, setMessages] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const socketRef = useRef(null);
  const isReadyRef = useRef(false);

  function sendMessage(content) {
    const trimmedContent = typeof content === 'string' ? content.trim() : '';

    if (!trimmedContent || !studySessionId || !userId || !nickname) {
      return false;
    }

    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN || !isReadyRef.current) {
      return false;
    }

    const clientMessageId = `study-session-chat-${studySessionId}-${userId}-${Date.now()}`;

    socket.send(
      JSON.stringify({
        type: 'chat_send',
        senderId: userId,
        payload: {
          studySessionId,
          scope: 'study_session',
          content: trimmedContent,
          nickname,
          clientMessageId,
        },
      })
    );

    setMessages((previousMessages) =>
      appendSessionMessage(previousMessages, {
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
    if (!enabled || !studySessionId || !userId || !nickname) {
      setMessages([]);
      setConnectionStatus('idle');
      setErrorMessage('');
      socketRef.current = null;
      isReadyRef.current = false;
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

        if (parsedMessage.type === 'ws_connected') {
          isReadyRef.current = true;
          setConnectionStatus('connected');
          return;
        }

        const nextMessage = normalizeStudySessionChatMessage(parsedMessage, userId, studySessionId);

        if (nextMessage) {
          setMessages((previousMessages) =>
            appendSessionMessage(previousMessages, nextMessage)
          );
        }
      } catch (error) {
        if (isDisposed) {
          return;
        }

        setErrorMessage('스터디 세션 채팅 메시지를 해석하지 못했습니다.');
        console.error('Failed to parse study session chat message:', error);
      }
    }

    try {
      setMessages([]);
      setConnectionStatus('connecting');
      setErrorMessage('');
      isReadyRef.current = false;
      socket = new WebSocket(getAuthenticatedWebSocketUrl());
      socketRef.current = socket;
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage('스터디 세션 채팅 연결을 만들지 못했습니다.');
      console.error('Failed to create study session chat connection:', error);
      return undefined;
    }

    socket.onopen = () => {
      if (isDisposed) {
        return;
      }

      setConnectionStatus('connecting');
    };

    socket.onmessage = handleIncomingMessage;

    socket.onerror = () => {
      if (isDisposed) {
        return;
      }

      setConnectionStatus('error');
      setErrorMessage('스터디 세션 채팅 연결 중 오류가 발생했습니다.');
    };

    socket.onclose = () => {
      if (isDisposed) {
        return;
      }

      setConnectionStatus('disconnected');
      socketRef.current = null;
      isReadyRef.current = false;
    };

    return () => {
      isDisposed = true;
      socketRef.current = null;
      isReadyRef.current = false;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      } else {
        socket?.close();
      }
    };
  }, [enabled, nickname, studySessionId, userId]);

  return {
    messages,
    connectionStatus,
    errorMessage,
    sendMessage,
  };
}
