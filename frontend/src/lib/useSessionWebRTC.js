import { useEffect, useRef, useState } from 'react';

const RTC_CONFIGURATION = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const SIGNAL_EVENT_TYPES = ['webrtc_offer', 'webrtc_answer', 'webrtc_ice_candidate'];

function getSessionWebSocketUrl() {
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
  return error?.message || 'Failed to prepare WebRTC connection.';
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
  const [connectionStatus, setConnectionStatus] = useState('not_connected');
  const [statusMessage, setStatusMessage] = useState(
    'Start the call after local media is ready.'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSignalType, setLastSignalType] = useState('');
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [canRetry, setCanRetry] = useState(false);

  localStreamRef.current = localStream;

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

  function cleanupPeerConnection(nextStatus = 'not_connected', nextMessage = 'WebRTC idle.') {
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
            setStatus('disconnected', 'Remote media stopped. Retry the connection if needed.', {
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
      setErrorMessage('This browser does not support RTCPeerConnection.');
      setStatus('error', 'WebRTC connection is unavailable in this environment.', {
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
      setStatus('connected', 'Remote stream connected.');
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;

      if (state === 'connected') {
        setStatus('connected', 'WebRTC peer connection established.');
        setErrorMessage('');
      } else if (state === 'connecting') {
        setStatus('connecting', 'Connecting to the remote participant...');
      } else if (state === 'disconnected') {
        clearRemoteStream();
        setStatus(
          'disconnected',
          'Peer connection disconnected. Retry after the other participant rejoins.',
          { canRetry: true }
        );
      } else if (state === 'failed') {
        clearRemoteStream();
        setErrorMessage('WebRTC peer connection failed.');
        setStatus('error', 'Peer connection failed.', { canRetry: true });
      } else if (state === 'closed') {
        clearRemoteStream();
        setStatus('not_connected', 'Peer connection closed.');
      }
    };

    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;

      if (state === 'failed') {
        setErrorMessage('ICE connection failed.');
        setStatus('error', 'ICE connection failed.', { canRetry: true });
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
      setStatus('signaling', 'Waiting for signaling socket before creating offer...');
      return false;
    }

    try {
      setStatus('signaling', 'Creating WebRTC offer...');
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSignal('webrtc_offer', { sdp: offer });
      setStatus('signaling', 'Offer sent. Waiting for answer...');
      return true;
    } catch (error) {
      setErrorMessage(getConnectionErrorMessage(error));
      setStatus('error', 'Failed to create WebRTC offer.', { canRetry: true });
      return false;
    }
  }

  async function createAnswer(signal) {
    if (!localStreamRef.current) {
      setErrorMessage('Prepare local media before answering the session call.');
      setStatus('error', 'Incoming offer received, but local media is not ready.', {
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
      setStatus('signaling', 'Received offer. Creating answer...');
      await peer.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
      await flushPendingIceCandidates(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendSignal('webrtc_answer', { sdp: answer });
      setStatus('connecting', 'Answer sent. Waiting for remote stream...');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(getConnectionErrorMessage(error));
      setStatus('error', 'Failed to process incoming offer.', { canRetry: true });
    }
  }

  async function applyAnswer(signal) {
    const peer = peerRef.current;

    if (!peer) {
      setStatus('disconnected', 'Answer arrived before the local peer was ready. Retry the call.', {
        canRetry: true,
      });
      return;
    }

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
      await flushPendingIceCandidates(peer);
      setStatus('connecting', 'Answer received. Connecting to remote stream...');
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(getConnectionErrorMessage(error));
      setStatus('error', 'Failed to apply remote answer.', { canRetry: true });
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

  async function startConnection(streamOverride) {
    const activeStream = streamOverride || localStreamRef.current;
    startRequestedRef.current = true;
    setErrorMessage('');

    if (!activeStream) {
      setErrorMessage('Local media is required before signaling.');
      setStatus('error', 'Prepare local media before starting the WebRTC connection.', {
        canRetry: false,
      });
      return false;
    }

    if (
      peerRef.current &&
      ['error', 'disconnected', 'not_connected'].includes(connectionStatus)
    ) {
      cleanupPeerConnection('not_connected', 'Resetting the previous WebRTC state...');
    }

    ensurePeerConnection(activeStream);

    if (!isSocketReadyRef.current) {
      setStatus('preparing', 'Opening signaling socket...');
      return true;
    }

    if (isInitiator) {
      return createOffer(activeStream);
    }

    setStatus('signaling', 'Waiting for the other participant offer...');
    return true;
  }

  function stopConnection() {
    startRequestedRef.current = false;
    setErrorMessage('');
    setLastSignalType('');
    cleanupPeerConnection('not_connected', 'WebRTC connection stopped.');
  }

  useEffect(() => {
    if (!enabled || !requestId || !userId) {
      socketClosingRef.current = true;
      socketRef.current?.close();
      socketClosingRef.current = false;
      startRequestedRef.current = false;
      cleanupPeerConnection('not_connected', 'WebRTC idle.');
      setErrorMessage('');
      setLastSignalType('');
      isSocketReadyRef.current = false;
      socketRef.current = null;
      return undefined;
    }

    let isDisposed = false;
    const socket = new WebSocket(getSessionWebSocketUrl());
    socketRef.current = socket;
    isSocketReadyRef.current = false;

    async function handleIncomingMessage(event) {
      try {
        const parsedMessage = JSON.parse(event.data);

        if (isDisposed) {
          return;
        }

        if (parsedMessage.type === 'ws_connected') {
          isSocketReadyRef.current = true;

          if (startRequestedRef.current && localStreamRef.current) {
            if (isInitiator) {
              await createOffer(localStreamRef.current);
            } else {
              setStatus('signaling', 'Waiting for the other participant offer...');
            }
          }

          return;
        }

        const controlMessage = normalizeSignalControlMessage(parsedMessage);

        if (controlMessage) {
          setLastSignalType(controlMessage.receivedType);

          if (controlMessage.type === 'ws_ack') {
            if (controlMessage.receivedType === 'webrtc_offer') {
              setStatus('signaling', 'Offer acknowledged. Waiting for answer...');
            } else if (controlMessage.receivedType === 'webrtc_answer') {
              setStatus('connecting', 'Answer acknowledged. Connecting to remote stream...');
            }

            return;
          }

          if (controlMessage.type === 'ws_error') {
            setErrorMessage(controlMessage.message);

            if (controlMessage.message.includes('not connected')) {
              setStatus(
                'disconnected',
                'The other participant is not connected to this session yet.',
                { canRetry: true }
              );
            } else {
              setStatus('error', controlMessage.message || 'WebRTC signaling failed.', {
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
        if (isDisposed) {
          return;
        }

        setErrorMessage('Failed to parse signaling message.');
        setStatus('error', 'Failed to parse signaling message.', { canRetry: true });
      }
    }

    socket.onmessage = (event) => {
      handleIncomingMessage(event);
    };

    socket.onerror = () => {
      if (isDisposed) {
        return;
      }

      setErrorMessage('WebRTC signaling socket error.');
      setStatus('error', 'Signaling socket error.', { canRetry: true });
    };

    socket.onclose = () => {
      if (isDisposed) {
        return;
      }

      isSocketReadyRef.current = false;
      socketRef.current = null;

      if (socketClosingRef.current) {
        socketClosingRef.current = false;
        return;
      }

      if (startRequestedRef.current) {
        setStatus('disconnected', 'Signaling socket closed. Retry the call.', {
          canRetry: true,
        });
      } else {
        setStatus('not_connected', 'Signaling socket closed.');
      }
    };

    return () => {
      isDisposed = true;
      socketClosingRef.current = true;
      isSocketReadyRef.current = false;
      socketRef.current = null;
      socket.close();
      socketClosingRef.current = false;
      startRequestedRef.current = false;
      cleanupPeerConnection('not_connected', 'WebRTC idle.');
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
        setStatus('signaling', 'Waiting for the other participant offer...');
      }
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
    stopConnection,
  };
}
