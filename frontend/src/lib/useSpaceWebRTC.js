import { useEffect, useMemo, useRef, useState } from 'react';
import { clearCachedWebSocketTicket, getAuthenticatedWebSocketUrl } from './webSocketUrl';
import {
  getIceServerDetailMessage,
  getIceServerModeLabel,
  RTC_CONFIGURATION,
} from './webrtcConfig';

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

function getConnectionErrorMessage(error) {
  if (error?.name === 'InvalidStateError') {
    return '공간 영상 연결 상태가 이미 변경되었습니다. 다시 시도해 주세요.';
  }

  if (error?.name === 'OperationError') {
    return '브라우저가 공간 영상 연결 설정을 완료하지 못했습니다.';
  }

  return error?.message || '공간 영상 연결을 준비하지 못했습니다.';
}

function normalizeSignalMessage(message, spaceId) {
  if (!SIGNAL_EVENT_TYPES.includes(message?.type)) {
    return null;
  }

  const payload = message?.payload || {};
  const scopedSpaceId = toNumber(payload.spaceId);

  if (scopedSpaceId !== spaceId) {
    return null;
  }

  if (payload.scope && payload.scope !== 'space_session') {
    return null;
  }

  return {
    type: message.type,
    senderId: toNumber(message.senderId) ?? toNumber(payload.userId),
    targetUserId: toNumber(payload.targetUserId),
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

function isPairInitiator(currentUserId, targetUserId) {
  return Number(currentUserId) < Number(targetUserId);
}

export function useSpaceWebRTC({ enabled, spaceId, userId, participants, localStream }) {
  const socketRef = useRef(null);
  const isSocketReadyRef = useRef(false);
  const socketClosingRef = useRef(false);
  const startRequestedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const localStreamRef = useRef(localStream);
  const peersRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const videoElementsRef = useRef(new Map());
  const [connectionStatus, setConnectionStatus] = useState('not_connected');
  const [statusMessage, setStatusMessage] = useState(
    '카메라 또는 마이크를 켜면 공간 참가자 영상 연결을 시작할 수 있습니다.'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSignalType, setLastSignalType] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [peerStates, setPeerStates] = useState({});

  enabledRef.current = enabled;
  localStreamRef.current = localStream;

  const participantUserIds = useMemo(
    () =>
      (participants || [])
        .map((participant) => toNumber(participant.userId))
        .filter((participantId) => participantId && participantId !== userId),
    [participants, userId]
  );

  function setStatus(nextStatus, nextMessage, options = {}) {
    setConnectionStatus(nextStatus);
    setStatusMessage(nextMessage);
    setCanRetry(Boolean(options.canRetry));
  }

  function setPeerState(targetUserId, nextState) {
    setPeerStates((previousStates) => ({
      ...previousStates,
      [targetUserId]: nextState,
    }));
  }

  function attachRemoteStream(targetUserId, stream) {
    setRemoteStreams((previousStreams) => {
      if (previousStreams[targetUserId] === stream) {
        return previousStreams;
      }

      return {
        ...previousStreams,
        [targetUserId]: stream,
      };
    });

    const videoElement = videoElementsRef.current.get(targetUserId);

    if (videoElement && videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
      videoElement.play().catch(() => {});
    }
  }

  function clearRemoteStream(targetUserId) {
    setRemoteStreams((previousStreams) => {
      if (!previousStreams[targetUserId]) {
        return previousStreams;
      }

      const nextStreams = { ...previousStreams };
      delete nextStreams[targetUserId];
      return nextStreams;
    });

    const videoElement = videoElementsRef.current.get(targetUserId);

    if (videoElement) {
      videoElement.srcObject = null;
    }
  }

  function bindRemoteVideo(targetUserId, element) {
    if (!element) {
      videoElementsRef.current.delete(targetUserId);
      return;
    }

    videoElementsRef.current.set(targetUserId, element);

    const remoteStream = remoteStreams[targetUserId];

    if (remoteStream && element.srcObject !== remoteStream) {
      element.srcObject = remoteStream;
      element.play().catch(() => {});
    }
  }

  function removePendingCandidates(targetUserId) {
    pendingCandidatesRef.current.delete(targetUserId);
  }

  async function flushPendingCandidates(targetUserId, peer) {
    const candidates = pendingCandidatesRef.current.get(targetUserId) || [];
    removePendingCandidates(targetUserId);

    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (error) {
        console.error('Failed to apply pending space ICE candidate:', error);
      }
    }
  }

  function queuePendingCandidate(targetUserId, candidate) {
    const nextCandidates = pendingCandidatesRef.current.get(targetUserId) || [];
    nextCandidates.push(candidate);
    pendingCandidatesRef.current.set(targetUserId, nextCandidates);
  }

  function closePeer(targetUserId) {
    const peer = peersRef.current.get(targetUserId);

    if (!peer) {
      clearRemoteStream(targetUserId);
      setPeerState(targetUserId, 'not_connected');
      removePendingCandidates(targetUserId);
      return;
    }

    peer.onicecandidate = null;
    peer.ontrack = null;
    peer.onconnectionstatechange = null;
    peer.oniceconnectionstatechange = null;
    peer.close();
    peersRef.current.delete(targetUserId);
    clearRemoteStream(targetUserId);
    setPeerState(targetUserId, 'not_connected');
    removePendingCandidates(targetUserId);
  }

  function closeAllPeers() {
    Array.from(peersRef.current.keys()).forEach((targetUserId) => {
      closePeer(targetUserId);
    });
    setRemoteStreams({});
    setPeerStates({});
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

  function sendSignal(type, targetUserId, payload) {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN || !isSocketReadyRef.current) {
      return false;
    }

    socket.send(
      JSON.stringify({
        type,
        senderId: userId,
        payload: {
          spaceId,
          scope: 'space_session',
          targetUserId,
          ...payload,
        },
      })
    );

    setLastSignalType(type);
    return true;
  }

  function getOverallStatus() {
    const states = Object.values(peerStates);

    if (states.some((state) => state === 'connected')) {
      return {
        status: 'connected',
        message: '같은 공간 참가자와 영상 연결이 수립되었습니다.',
      };
    }

    if (states.some((state) => state === 'connecting' || state === 'signaling')) {
      return {
        status: 'connecting',
        message: '공간 참가자와 영상 연결을 협상 중입니다...',
      };
    }

    if (startRequestedRef.current) {
      return {
        status: 'disconnected',
        message: '상대 참가자 연결이 아직 없거나 연결이 끊겼습니다. 다시 시도해 주세요.',
      };
    }

    return {
      status: 'not_connected',
      message: '카메라 또는 마이크를 켜면 공간 참가자 영상 연결을 시작할 수 있습니다.',
    };
  }

  function syncOverallStatus() {
    const overallStatus = getOverallStatus();
    setStatus(overallStatus.status, overallStatus.message, {
      canRetry: overallStatus.status === 'disconnected' || overallStatus.status === 'error',
    });
  }

  function ensurePeerConnection(targetUserId, streamOverride) {
    if (typeof RTCPeerConnection === 'undefined') {
      setErrorMessage('이 브라우저는 공간 영상 연결을 지원하지 않습니다.');
      setStatus('error', '현재 환경에서는 공간 영상 연결을 사용할 수 없습니다.');
      return null;
    }

    const existingPeer = peersRef.current.get(targetUserId);
    const activeStream = streamOverride || localStreamRef.current;

    if (existingPeer) {
      if (activeStream) {
        const existingTrackIds = new Set(
          existingPeer.getSenders().map((sender) => sender.track?.id).filter(Boolean)
        );

        activeStream.getTracks().forEach((track) => {
          if (!existingTrackIds.has(track.id)) {
            existingPeer.addTrack(track, activeStream);
          }
        });
      }

      return existingPeer;
    }

    const peer = new RTCPeerConnection(RTC_CONFIGURATION);

    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        peer.addTrack(track, activeStream);
      });
    }

    peer.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      sendSignal('webrtc_ice_candidate', targetUserId, {
        candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
      });
    };

    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;

      if (remoteStream) {
        attachRemoteStream(targetUserId, remoteStream);
        setPeerState(targetUserId, 'connected');
        syncOverallStatus();
      }
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      setPeerState(targetUserId, state);

      if (state === 'failed') {
        setErrorMessage('공간 영상 연결에 실패한 참가자가 있습니다.');
        setStatus('error', '일부 공간 참가자와 연결하지 못했습니다. 다시 시도해 주세요.', {
          canRetry: true,
        });
        return;
      }

      if (state === 'disconnected' || state === 'closed') {
        clearRemoteStream(targetUserId);
      }

      syncOverallStatus();
    };

    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'failed') {
        setErrorMessage('공간 ICE 연결에 실패한 참가자가 있습니다.');
        setStatus('error', '공간 ICE 연결에 실패했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.', {
          canRetry: true,
        });
      }
    };

    peersRef.current.set(targetUserId, peer);
    setPeerState(targetUserId, 'signaling');
    return peer;
  }

  async function createOffer(targetUserId, streamOverride) {
    const peer = ensurePeerConnection(targetUserId, streamOverride);

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
      setPeerState(targetUserId, 'signaling');
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSignal('webrtc_offer', targetUserId, { sdp: offer });
      syncOverallStatus();
      return true;
    } catch (error) {
      setErrorMessage(getConnectionErrorMessage(error));
      setStatus('error', '공간 연결 제안을 만들지 못했습니다.', { canRetry: true });
      return false;
    }
  }

  async function createAnswer(senderUserId, signal) {
    if (!localStreamRef.current) {
      setErrorMessage('공간 영상 연결 전에 카메라 또는 마이크를 먼저 준비해 주세요.');
      setStatus('error', '연결 제안을 받았지만 로컬 미디어가 아직 준비되지 않았습니다.');
      return;
    }

    const peer = ensurePeerConnection(senderUserId, localStreamRef.current);

    if (!peer) {
      return;
    }

    try {
      setPeerState(senderUserId, 'signaling');
      await peer.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
      await flushPendingCandidates(senderUserId, peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendSignal('webrtc_answer', senderUserId, { sdp: answer });
      syncOverallStatus();
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(getConnectionErrorMessage(error));
      setStatus('error', '받은 공간 연결 제안을 처리하지 못했습니다.', { canRetry: true });
    }
  }

  async function applyAnswer(senderUserId, signal) {
    const peer = peersRef.current.get(senderUserId);

    if (!peer) {
      setStatus('disconnected', '공간 연결 준비 전에 응답이 도착했습니다. 다시 시도해 주세요.', {
        canRetry: true,
      });
      return;
    }

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
      await flushPendingCandidates(senderUserId, peer);
      setPeerState(senderUserId, 'connecting');
      syncOverallStatus();
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(getConnectionErrorMessage(error));
      setStatus('error', '공간 연결 응답을 적용하지 못했습니다.', { canRetry: true });
    }
  }

  async function applyIceCandidate(senderUserId, signal) {
    const candidate = signal.payload.candidate;

    if (!candidate) {
      return;
    }

    const peer = peersRef.current.get(senderUserId);

    if (!peer || !peer.remoteDescription) {
      queuePendingCandidate(senderUserId, new RTCIceCandidate(candidate));
      return;
    }

    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Failed to apply space ICE candidate:', error);
    }
  }

  async function synchronizePeers() {
    const activeStream = localStreamRef.current;

    if (!isSocketReadyRef.current || !activeStream) {
      return;
    }

    participantUserIds.forEach((participantUserId) => {
      ensurePeerConnection(participantUserId, activeStream);

      if (isPairInitiator(userId, participantUserId)) {
        createOffer(participantUserId, activeStream);
      } else {
        setPeerState(participantUserId, 'signaling');
      }
    });

    syncOverallStatus();
  }

  async function handleIncomingMessage(event) {
    try {
      const parsedMessage = JSON.parse(event.data);

      if (parsedMessage.type === 'ws_connected') {
        isSocketReadyRef.current = true;
        setErrorMessage('');

        if (startRequestedRef.current && localStreamRef.current) {
          await synchronizePeers();
        }

        return;
      }

      const controlMessage = normalizeSignalControlMessage(parsedMessage);

      if (controlMessage) {
        setLastSignalType(controlMessage.receivedType);

        if (controlMessage.type === 'ws_ack') {
          syncOverallStatus();
          return;
        }

        if (controlMessage.type === 'ws_error') {
          setErrorMessage(controlMessage.message);
          setStatus('error', controlMessage.message || '공간 영상 연결 신호 처리에 실패했습니다.', {
            canRetry: true,
          });
          return;
        }
      }

      const signal = normalizeSignalMessage(parsedMessage, spaceId);

      if (!signal || !signal.senderId || signal.senderId === userId) {
        return;
      }

      setLastSignalType(signal.type);

      if (signal.type === 'webrtc_offer') {
        await createAnswer(signal.senderId, signal);
        return;
      }

      if (signal.type === 'webrtc_answer') {
        await applyAnswer(signal.senderId, signal);
        return;
      }

      if (signal.type === 'webrtc_ice_candidate') {
        await applyIceCandidate(signal.senderId, signal);
      }
    } catch (error) {
      setErrorMessage('공간 시그널링 메시지를 해석하지 못했습니다.');
      setStatus('error', '공간 시그널링 메시지를 해석하지 못했습니다.', { canRetry: true });
    }
  }

  async function openSignalingSocket() {
    if (!enabledRef.current || !spaceId || !userId) {
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
      const socketUrl = await getAuthenticatedWebSocketUrl();
      const nextSocket = new WebSocket(socketUrl);
      socketRef.current = nextSocket;
      isSocketReadyRef.current = false;

      nextSocket.onmessage = (event) => {
        handleIncomingMessage(event);
      };

      nextSocket.onerror = () => {
        clearCachedWebSocketTicket();
        setErrorMessage('공간 영상 연결 통신 오류가 발생했습니다.');
        setStatus('error', '공간 영상 연결 통신 오류가 발생했습니다.', { canRetry: true });
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
          setStatus('disconnected', '공간 시그널링 소켓이 종료되었습니다. 다시 시도해 주세요.', {
            canRetry: true,
          });
        } else {
          setStatus('not_connected', '공간 시그널링 소켓이 종료되었습니다.');
        }
      };

      return nextSocket;
    } catch (error) {
      setErrorMessage('공간 시그널링 소켓을 열지 못했습니다.');
      setStatus('error', '공간 시그널링 소켓을 열지 못했습니다.', { canRetry: true });
      return null;
    }
  }

  async function startConnection(streamOverride) {
    const activeStream = streamOverride || localStreamRef.current;
    startRequestedRef.current = true;
    setErrorMessage('');

    if (!activeStream) {
      setErrorMessage('공간 영상 연결 전에 카메라 또는 마이크가 필요합니다.');
      setStatus('error', '공간 영상 연결 전에 카메라 또는 마이크를 준비해 주세요.');
      return false;
    }

    if (participantUserIds.length === 0) {
      setStatus('preparing', '아직 연결할 다른 공간 참가자가 없습니다.');
      return false;
    }

    const socket = await openSignalingSocket();

    if (!socket) {
      setStatus('error', '공간 시그널링 소켓을 다시 열지 못했습니다.', { canRetry: true });
      return false;
    }

    if (!isSocketReadyRef.current) {
      setStatus('preparing', '공간 시그널링 소켓을 여는 중입니다...');
      return true;
    }

    await synchronizePeers();
    return true;
  }

  async function retryConnection(streamOverride) {
    setLastSignalType('');
    setErrorMessage('');
    closeAllPeers();
    setStatus('not_connected', '공간 영상 연결을 다시 준비하는 중입니다...');
    return startConnection(streamOverride || localStreamRef.current);
  }

  function stopConnection() {
    setLastSignalType('');
    setErrorMessage('');
    closeSignalingSocket({ resetRequestedStart: true });
    closeAllPeers();
    setStatus('not_connected', '공간 영상 연결을 중지했습니다.');
  }

  useEffect(() => {
    if (!enabled || !spaceId || !userId) {
      closeSignalingSocket({ resetRequestedStart: true });
      closeAllPeers();
      setErrorMessage('');
      setLastSignalType('');
      setStatus('not_connected', '카메라 또는 마이크를 켜면 공간 참가자 영상 연결을 시작할 수 있습니다.');
      return undefined;
    }

    void openSignalingSocket();

    return () => {
      closeSignalingSocket({ resetRequestedStart: true });
      closeAllPeers();
      setLastSignalType('');
      setErrorMessage('');
      setStatus('not_connected', '카메라 또는 마이크를 켜면 공간 참가자 영상 연결을 시작할 수 있습니다.');
    };
  }, [enabled, spaceId, userId]);

  useEffect(() => {
    if (!localStream || !startRequestedRef.current) {
      return;
    }

    synchronizePeers();
  }, [localStream, participantUserIds.join(','), userId]);

  useEffect(() => {
    syncOverallStatus();
  }, [peerStates]);

  useEffect(() => {
    const disconnectedUsers = Object.keys(remoteStreams)
      .map((value) => Number(value))
      .filter((remoteUserId) => !participantUserIds.includes(remoteUserId));

    disconnectedUsers.forEach((remoteUserId) => {
      closePeer(remoteUserId);
    });
  }, [participantUserIds.join(','), remoteStreams]);

  return {
    connectionStatus,
    statusMessage,
    errorMessage,
    lastSignalType,
    canRetry,
    hasConnectedPeers: Object.keys(remoteStreams).length > 0,
    remoteStreams,
    peerStates,
    hasTurnRelay: RTC_CONFIGURATION.hasTurnRelay,
    iceServerModeLabel: getIceServerModeLabel(),
    iceServerDetailMessage: getIceServerDetailMessage(),
    bindRemoteVideo,
    startConnection,
    retryConnection,
    stopConnection,
  };
}
