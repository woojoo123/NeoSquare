import { useEffect, useRef, useState } from 'react';
import { getAuthenticatedWebSocketUrl } from './webSocketUrl';

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const SIGNAL_EVENT_TYPES = ['webrtc_offer', 'webrtc_answer', 'webrtc_ice_candidate'];

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

function normalizeIceServerEntry(entry) {
  if (!entry) {
    return null;
  }

  if (typeof entry === 'string') {
    return {
      urls: entry,
    };
  }

  if (Array.isArray(entry)) {
    return {
      urls: entry.filter((value) => typeof value === 'string' && value.trim() !== ''),
    };
  }

  if (typeof entry !== 'object') {
    return null;
  }

  const urls = Array.isArray(entry.urls)
    ? entry.urls.filter((value) => typeof value === 'string' && value.trim() !== '')
    : typeof entry.urls === 'string'
      ? entry.urls
      : null;

  if (!urls || (Array.isArray(urls) && urls.length === 0)) {
    return null;
  }

  return {
    urls,
    username: typeof entry.username === 'string' ? entry.username : undefined,
    credential: typeof entry.credential === 'string' ? entry.credential : undefined,
  };
}

function resolveRtcConfiguration() {
  const configuredIceServers = import.meta.env.VITE_WEBRTC_ICE_SERVERS;

  if (!configuredIceServers) {
    return {
      iceServers: DEFAULT_ICE_SERVERS,
    };
  }

  try {
    const parsedIceServers = JSON.parse(configuredIceServers);
    const normalizedIceServers = (Array.isArray(parsedIceServers) ? parsedIceServers : [parsedIceServers])
      .map(normalizeIceServerEntry)
      .filter(Boolean);

    return {
      iceServers: normalizedIceServers.length > 0 ? normalizedIceServers : DEFAULT_ICE_SERVERS,
    };
  } catch (error) {
    console.warn('Failed to parse VITE_WEBRTC_ICE_SERVERS. Falling back to default STUN.', error);
    return {
      iceServers: DEFAULT_ICE_SERVERS,
    };
  }
}

const RTC_CONFIGURATION = resolveRtcConfiguration();

function normalizeSignalMessage(message, requestId) {
  if (!SIGNAL_EVENT_TYPES.includes(message?.type)) {
    return null;
  }

  const payload = message?.payload || {};
  const messageRequestId = toNumber(payload.requestId);
  const scope = payload.scope;

  if (messageRequestId !== requestId) {
    return null;
  }

  if (scope && scope !== 'mentoring_session') {
    return null;
  }

  return {
    type: message.type,
    senderId: toNumber(message.senderId) ?? toNumber(payload.userId),
    payload,
  };
}

function normalizeSignalControlMessage(message) {
  if (message?.type !== 'ws_ack' && message?.type !== 'ws_error') {
    return null;
  }

  const payload = message?.payload || {};
  const receivedType = payload.receivedType;

  if (!SIGNAL_EVENT_TYPES.includes(receivedType)) {
    return null;
  }

  return {
    type: message.type,
    receivedType,
    message: payload.message || '',
  };
}

function getConnectionErrorMessage(error) {
  if (error?.name === 'InvalidStateError') {
    return '영상 연결 상태가 이미 변경되었습니다. 다시 시도해 주세요.';
  }

  if (error?.name === 'OperationError') {
    return '브라우저가 영상 연결 설정을 완료하지 못했습니다.';
  }

  return error?.message || '영상 연결을 준비하지 못했습니다.';
}

export function useSessionWebRTC({
  enabled,
  requestId,
  userId,
  localStream,
  isInitiator,
}) {
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const isSocketReadyRef = useRef(false);
  const startRequestedRef = useRef(false);
  const localStreamRef = useRef(localStream);
  const remoteStreamRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const socketClosingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const [connectionStatus, setConnectionStatus] = useState('not_connected');
  const [statusMessage, setStatusMessage] = useState(
    '로컬 미디어가 준비되면 통화를 시작할 수 있습니다.'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSignalType, setLastSignalType] = useState('');
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [canRetry, setCanRetry] = useState(false);

  localStreamRef.current = localStream;
  enabledRef.current = enabled;

  function setStatus(nextStatus, nextMessage, options = {}) {
    setConnectionStatus(nextStatus);
    setStatusMessage(nextMessage);
    setCanRetry(Boolean(options.canRetry));
  }

  function clearRemoteStream() {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    remoteStreamRef.current = null;
    setHasRemoteStream(false);
  }

  function closeSignalingSocket({ resetRequestedStart = false } = {}) {
    const socket = socketRef.current;

    if (resetRequestedStart) {
      startRequestedRef.current = false;
    }

    isSocketReadyRef.current = false;

    if (!socket) {
      socketRef.current = null;
      return;
    }

    socketRef.current = null;

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socketClosingRef.current = true;
      socket.close();
      return;
    }

    socketClosingRef.current = false;
  }

  function cleanupPeerConnection(nextStatus = 'not_connected', nextMessage = '영상 연결 대기 중입니다.') {
    const peer = peerRef.current;

    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
      peer.close();
      peerRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    clearRemoteStream();
    setStatus(nextStatus, nextMessage);
  }

  function sendSignal(type, payload) {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN || !isSocketReadyRef.current) {
      return false;
    }

    socket.send(
      JSON.stringify({
        type,
        senderId: userId,
        payload: {
          requestId,
          scope: 'mentoring_session',
          ...payload,
        },
      })
    );

    setLastSignalType(type);
    return true;
  }

  async function flushPendingIceCandidates(peer) {
    const pendingCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of pendingCandidates) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (error) {
        console.error('Failed to apply pending ICE candidate:', error);
      }
    }
  }

  function attachRemoteStream(nextRemoteStream) {
    if (!nextRemoteStream) {
      return;
    }

    if (remoteStreamRef.current !== nextRemoteStream) {
      remoteStreamRef.current = nextRemoteStream;
      nextRemoteStream.getTracks().forEach((track) => {
        track.onended = () => {
          const activeTracks = nextRemoteStream.getTracks().some(
            (activeTrack) => activeTrack.readyState === 'live'
          );

          if (!activeTracks) {
            clearRemoteStream();
            setStatus('disconnected', '상대 미디어가 종료되었습니다. 필요하면 다시 연결해 주세요.', {
              canRetry: true,
            });
          }
        };
      });
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = nextRemoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }

    setHasRemoteStream(true);
  }

  function ensurePeerConnection(streamOverride) {
    if (typeof RTCPeerConnection === 'undefined') {
      setConnectionStatus('error');
      setErrorMessage('이 브라우저는 영상 통화 연결을 지원하지 않습니다.');
      setStatus('error', '현재 환경에서는 영상 연결을 사용할 수 없습니다.', {
        canRetry: false,
      });
      return null;
    }

    if (peerRef.current) {
      const activeStream = streamOverride || localStreamRef.current;

      if (activeStream) {
        const existingTracks = new Set(
          peerRef.current.getSenders().map((sender) => sender.track?.id).filter(Boolean)
        );

        activeStream.getTracks().forEach((track) => {
          if (!existingTracks.has(track.id)) {
            peerRef.current.addTrack(track, activeStream);
          }
        });
      }

      return peerRef.current;
    }

    const peer = new RTCPeerConnection(RTC_CONFIGURATION);
    const activeStream = streamOverride || localStreamRef.current;

    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        peer.addTrack(track, activeStream);
      });
    }

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      sendSignal('webrtc_ice_candidate', {
        candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
      });
    };

    peer.ontrack = (event) => {
      const [nextRemoteStream] = event.streams;
      attachRemoteStream(nextRemoteStream);
      setStatus('connected', '상대 영상이 연결되었습니다.');
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;

      if (state === 'connected') {
        setStatus('connected', '상대와 영상 연결이 수립되었습니다.');
        setErrorMessage('');
      } else if (state === 'connecting') {
        setStatus('connecting', '상대 참가자와 연결 중입니다...');
      } else if (state === 'disconnected') {
        clearRemoteStream();
        setStatus(
          'disconnected',
          '연결이 끊어졌습니다. 상대가 다시 참여하면 재시도해 주세요.',
          { canRetry: true }
        );
      } else if (state === 'failed') {
        clearRemoteStream();
        setErrorMessage('영상 연결에 실패했습니다.');
        setStatus('error', '연결에 실패했습니다. 필요하면 다시 시도해 주세요.', {
          canRetry: true,
        });
      } else if (state === 'closed') {
        clearRemoteStream();
        setStatus('not_connected', '연결이 종료되었습니다.');
      }
    };

    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;

      if (state === 'failed') {
        setErrorMessage('ICE 연결에 실패했습니다.');
        setStatus('error', 'ICE 연결에 실패했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.', {
          canRetry: true,
        });
      }
    };

    peerRef.current = peer;
    return peer;
  }

  async function createOffer(streamOverride) {
    const peer = ensurePeerConnection(streamOverride);

    if (!peer) {
      return false;
    }

    if (peer.localDescription) {
      return true;
    }

    if (!isSocketReadyRef.current) {
      setStatus('signaling', '시그널링 소켓 연결을 기다리는 중입니다...');
      return false;
    }

    try {
      setStatus('signaling', '영상 연결 제안을 생성하는 중입니다...');
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSignal('webrtc_offer', { sdp: offer });
      setStatus('signaling', '연결 제안을 전송했습니다. 응답을 기다리는 중입니다...');
      return true;
    } catch (error) {
      setErrorMessage(getConnectionErrorMessage(error));
      setStatus('error', '영상 연결 제안을 만들지 못했습니다.', { canRetry: true });
      return false;
    }
  }

  async function createAnswer(signal) {
    if (!localStreamRef.current) {
      setErrorMessage('세션 응답 전에 로컬 미디어를 먼저 준비해 주세요.');
      setStatus('error', '연결 제안을 받았지만 로컬 미디어가 아직 준비되지 않았습니다.', {
        canRetry: false,
      });
      return;
    }

    startRequestedRef.current = true;
    const peer = ensurePeerConnection(localStreamRef.current);

    if (!peer) {
      return;
    }

    try {
      setStatus('signaling', '연결 제안을 받아 응답을 생성하는 중입니다...');
      await peer.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
      await flushPendingIceCandidates(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendSignal('webrtc_answer', { sdp: answer });
      setStatus('connecting', '연결 응답을 전송했습니다. 상대 영상을 기다리는 중입니다...');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(getConnectionErrorMessage(error));
      setStatus('error', '받은 연결 제안을 처리하지 못했습니다.', { canRetry: true });
    }
  }

  async function applyAnswer(signal) {
    const peer = peerRef.current;

    if (!peer) {
      setStatus('disconnected', '로컬 연결 준비 전에 연결 응답이 도착했습니다. 다시 시도해 주세요.', {
        canRetry: true,
      });
      return;
    }

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
      await flushPendingIceCandidates(peer);
      setStatus('connecting', '연결 응답을 받아 상대 영상과 연결 중입니다...');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(getConnectionErrorMessage(error));
      setStatus('error', '상대 연결 응답을 적용하지 못했습니다.', { canRetry: true });
    }
  }

  async function applyIceCandidate(signal) {
    const candidate = signal.payload.candidate;

    if (!candidate) {
      return;
    }

    const peer = peerRef.current;

    if (!peer || !peer.remoteDescription) {
      pendingIceCandidatesRef.current.push(new RTCIceCandidate(candidate));
      return;
    }

    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Failed to apply ICE candidate:', error);
    }
  }

  async function handleIncomingMessage(event) {
    try {
      const parsedMessage = JSON.parse(event.data);

      if (parsedMessage.type === 'ws_connected') {
        isSocketReadyRef.current = true;
        setErrorMessage('');

        if (startRequestedRef.current && localStreamRef.current) {
          if (isInitiator) {
            await createOffer(localStreamRef.current);
          } else {
            setStatus('signaling', '상대 참가자의 연결 제안을 기다리는 중입니다...');
          }
        }

        return;
      }

      const controlMessage = normalizeSignalControlMessage(parsedMessage);

      if (controlMessage) {
        setLastSignalType(controlMessage.receivedType);

        if (controlMessage.type === 'ws_ack') {
          if (controlMessage.receivedType === 'webrtc_offer') {
            setStatus('signaling', '연결 제안 전송이 확인되었습니다. 응답을 기다리는 중입니다...');
          } else if (controlMessage.receivedType === 'webrtc_answer') {
            setStatus('connecting', '연결 응답 전송이 확인되었습니다. 상대 영상과 연결 중입니다...');
          }

          return;
        }

        if (controlMessage.type === 'ws_error') {
          setErrorMessage(controlMessage.message);

          if (controlMessage.message.includes('not connected')) {
            setStatus(
              'disconnected',
              '상대 참가자가 아직 이 세션에 접속하지 않았습니다.',
              { canRetry: true }
            );
          } else {
            setStatus('error', controlMessage.message || '영상 연결 신호 처리에 실패했습니다.', {
              canRetry: true,
            });
          }

          return;
        }
      }

      const signal = normalizeSignalMessage(parsedMessage, requestId);

      if (!signal || signal.senderId === userId) {
        return;
      }

      setLastSignalType(signal.type);

      if (signal.type === 'webrtc_offer') {
        await createAnswer(signal);
        return;
      }

      if (signal.type === 'webrtc_answer') {
        await applyAnswer(signal);
        return;
      }

      if (signal.type === 'webrtc_ice_candidate') {
        await applyIceCandidate(signal);
      }
    } catch (error) {
      setErrorMessage('시그널링 메시지를 해석하지 못했습니다.');
      setStatus('error', '시그널링 메시지를 해석하지 못했습니다.', { canRetry: true });
    }
  }

  function openSignalingSocket() {
    if (!enabledRef.current || !requestId || !userId) {
      return null;
    }

    const currentSocket = socketRef.current;

    if (
      currentSocket &&
      (currentSocket.readyState === WebSocket.OPEN || currentSocket.readyState === WebSocket.CONNECTING)
    ) {
      return currentSocket;
    }

    closeSignalingSocket();

    try {
      const nextSocket = new WebSocket(getAuthenticatedWebSocketUrl());
      socketRef.current = nextSocket;
      isSocketReadyRef.current = false;

      nextSocket.onmessage = (event) => {
        handleIncomingMessage(event);
      };

      nextSocket.onerror = () => {
        setErrorMessage('영상 연결 통신 오류가 발생했습니다.');
        setStatus('error', '영상 연결 통신 오류가 발생했습니다.', { canRetry: true });
      };

      nextSocket.onclose = () => {
        if (socketRef.current === nextSocket) {
          socketRef.current = null;
        }

        isSocketReadyRef.current = false;

        if (socketClosingRef.current) {
          socketClosingRef.current = false;
          return;
        }

        if (!enabledRef.current) {
          return;
        }

        if (startRequestedRef.current) {
          setStatus('disconnected', '시그널링 소켓이 종료되었습니다. 다시 시도해 주세요.', {
            canRetry: true,
          });
        } else {
          setStatus('not_connected', '시그널링 소켓이 종료되었습니다.');
        }
      };

      return nextSocket;
    } catch (error) {
      setErrorMessage('시그널링 소켓을 열지 못했습니다.');
      setStatus('error', '시그널링 소켓을 열지 못했습니다.', { canRetry: true });
      return null;
    }
  }

  async function startConnection(streamOverride) {
    const activeStream = streamOverride || localStreamRef.current;
    startRequestedRef.current = true;
    setErrorMessage('');

    if (!activeStream) {
      setErrorMessage('시그널링 전에 로컬 미디어가 필요합니다.');
      setStatus('error', '영상 연결을 시작하기 전에 로컬 미디어를 준비해 주세요.', {
        canRetry: false,
      });
      return false;
    }

    if (
      peerRef.current &&
      ['error', 'disconnected', 'not_connected'].includes(connectionStatus)
    ) {
      cleanupPeerConnection('not_connected', '이전 영상 연결 상태를 초기화하는 중입니다...');
    }

    ensurePeerConnection(activeStream);

    const socket = openSignalingSocket();

    if (!socket) {
      setStatus('error', '시그널링 소켓을 다시 열지 못했습니다.', { canRetry: true });
      return false;
    }

    if (!isSocketReadyRef.current) {
      setStatus('preparing', '시그널링 소켓을 여는 중입니다...');
      return true;
    }

    if (isInitiator) {
      return createOffer(activeStream);
    }

    setStatus('signaling', '상대 참가자의 연결 제안을 기다리는 중입니다...');
    return true;
  }

  async function retryConnection(streamOverride) {
    setLastSignalType('');
    setErrorMessage('');
    cleanupPeerConnection('not_connected', '영상 연결을 다시 준비하는 중입니다...');
    return startConnection(streamOverride || localStreamRef.current);
  }

  function stopConnection() {
    setLastSignalType('');
    setErrorMessage('');
    closeSignalingSocket({ resetRequestedStart: true });
    cleanupPeerConnection('not_connected', '영상 연결을 중지했습니다.');
  }

  useEffect(() => {
    if (!enabled || !requestId || !userId) {
      closeSignalingSocket({ resetRequestedStart: true });
      cleanupPeerConnection('not_connected', '영상 연결 대기 중입니다.');
      setErrorMessage('');
      setLastSignalType('');
      return undefined;
    }

    openSignalingSocket();

    return () => {
      closeSignalingSocket({ resetRequestedStart: true });
      cleanupPeerConnection('not_connected', '영상 연결 대기 중입니다.');
      setLastSignalType('');
      setErrorMessage('');
    };
  }, [enabled, isInitiator, requestId, userId]);

  useEffect(() => {
    if (!localStream || !startRequestedRef.current) {
      return;
    }

    ensurePeerConnection(localStream);

    if (isSocketReadyRef.current) {
      if (isInitiator) {
        createOffer(localStream);
      } else if (!peerRef.current?.remoteDescription) {
        setStatus('signaling', '상대 참가자의 연결 제안을 기다리는 중입니다...');
      }
    } else {
      openSignalingSocket();
      setStatus('preparing', '시그널링 소켓을 여는 중입니다...');
    }
  }, [isInitiator, localStream]);

  return {
    remoteVideoRef,
    hasRemoteStream,
    connectionStatus,
    statusMessage,
    errorMessage,
    lastSignalType,
    canRetry,
    startConnection,
    retryConnection,
    stopConnection,
  };
}
