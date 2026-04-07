import { useEffect, useRef, useState } from 'react';

const RTC_CONFIGURATION = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

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
  const supportedTypes = ['webrtc_offer', 'webrtc_answer', 'webrtc_ice_candidate'];

  if (!supportedTypes.includes(message?.type)) {
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
  const [connectionStatus, setConnectionStatus] = useState('not_connected');
  const [statusMessage, setStatusMessage] = useState(
    'Start the call after local media is ready.'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSignalType, setLastSignalType] = useState('');
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  localStreamRef.current = localStream;

  function resetRemoteStream() {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    setHasRemoteStream(false);
  }

  function cleanupPeerConnection(nextStatus = 'not_connected', nextMessage = 'WebRTC idle.') {
    const peer = peerRef.current;

    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
      peerRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    resetRemoteStream();
    setConnectionStatus(nextStatus);
    setStatusMessage(nextMessage);
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

  function ensurePeerConnection(streamOverride) {
    if (typeof RTCPeerConnection === 'undefined') {
      setConnectionStatus('error');
      setErrorMessage('This browser does not support RTCPeerConnection.');
      setStatusMessage('WebRTC connection is unavailable in this environment.');
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

      if (!nextRemoteStream) {
        return;
      }

      remoteStreamRef.current = nextRemoteStream;
      setHasRemoteStream(true);
      setConnectionStatus('connected');
      setStatusMessage('Remote stream connected.');
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;

      if (state === 'connected') {
        setConnectionStatus('connected');
        setStatusMessage('WebRTC peer connection established.');
      } else if (state === 'connecting') {
        setConnectionStatus('connecting');
        setStatusMessage('Connecting to the remote participant...');
      } else if (state === 'failed') {
        setConnectionStatus('error');
        setErrorMessage('WebRTC peer connection failed.');
        setStatusMessage('Peer connection failed.');
      } else if (state === 'disconnected') {
        setConnectionStatus('connecting');
        setStatusMessage('Peer connection disconnected. Waiting to recover...');
      } else if (state === 'closed') {
        setConnectionStatus('not_connected');
        setStatusMessage('Peer connection closed.');
      }
    };

    peerRef.current = peer;
    return peer;
  }

  async function createOfferIfNeeded(streamOverride) {
    if (!startRequestedRef.current || !isInitiator) {
      return;
    }

    const peer = ensurePeerConnection(streamOverride);

    if (!peer || peer.localDescription) {
      return;
    }

    if (!isSocketReadyRef.current) {
      setConnectionStatus('signaling');
      setStatusMessage('Waiting for signaling socket before creating offer...');
      return;
    }

    try {
      setConnectionStatus('signaling');
      setStatusMessage('Creating WebRTC offer...');
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSignal('webrtc_offer', { sdp: offer });
      setStatusMessage('Offer sent. Waiting for answer...');
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(getConnectionErrorMessage(error));
      setStatusMessage('Failed to create WebRTC offer.');
    }
  }

  async function startConnection(streamOverride) {
    const activeStream = streamOverride || localStreamRef.current;
    startRequestedRef.current = true;
    setErrorMessage('');

    if (!activeStream) {
      setConnectionStatus('error');
      setStatusMessage('Prepare local media before starting the WebRTC connection.');
      setErrorMessage('Local media is required before signaling.');
      return false;
    }

    ensurePeerConnection(activeStream);

    if (!isSocketReadyRef.current) {
      setConnectionStatus('preparing');
      setStatusMessage('Opening signaling socket...');
      return true;
    }

    if (isInitiator) {
      await createOfferIfNeeded(activeStream);
    } else {
      setConnectionStatus('signaling');
      setStatusMessage('Waiting for the other participant offer...');
    }

    return true;
  }

  function stopConnection() {
    startRequestedRef.current = false;
    setErrorMessage('');
    setLastSignalType('');
    cleanupPeerConnection('not_connected', 'WebRTC connection stopped.');
  }

  useEffect(() => {
    if (!remoteVideoRef.current || !remoteStreamRef.current) {
      return;
    }

    remoteVideoRef.current.srcObject = remoteStreamRef.current;
    remoteVideoRef.current.play().catch(() => {});
  }, [hasRemoteStream]);

  useEffect(() => {
    if (!enabled || !requestId || !userId) {
      socketRef.current?.close();
      startRequestedRef.current = false;
      cleanupPeerConnection('not_connected', 'WebRTC idle.');
      setErrorMessage('');
      setLastSignalType('');
      isSocketReadyRef.current = false;
      socketRef.current = null;
      return undefined;
    }

    let isDisposed = false;
    let socket;

    async function handleSignalMessage(parsedMessage) {
      const signal = normalizeSignalMessage(parsedMessage, requestId);

      if (!signal || signal.senderId === userId) {
        return;
      }

      setLastSignalType(signal.type);

      if (signal.type === 'webrtc_offer') {
        if (!localStreamRef.current) {
          setConnectionStatus('error');
          setErrorMessage('Prepare local media before answering the session call.');
          setStatusMessage('Incoming offer received, but local media is not ready.');
          return;
        }

        startRequestedRef.current = true;
        const peer = ensurePeerConnection(localStreamRef.current);

        if (!peer) {
          return;
        }

        try {
          setConnectionStatus('signaling');
          setStatusMessage('Received offer. Creating answer...');
          await peer.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
          await flushPendingIceCandidates(peer);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal('webrtc_answer', { sdp: answer });
          setConnectionStatus('connecting');
          setStatusMessage('Answer sent. Waiting for remote stream...');
        } catch (error) {
          setConnectionStatus('error');
          setErrorMessage(getConnectionErrorMessage(error));
          setStatusMessage('Failed to process incoming offer.');
        }
      }

      if (signal.type === 'webrtc_answer') {
        const peer = peerRef.current;

        if (!peer) {
          return;
        }

        try {
          await peer.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
          await flushPendingIceCandidates(peer);
          setConnectionStatus('connecting');
          setStatusMessage('Answer received. Connecting to remote stream...');
        } catch (error) {
          setConnectionStatus('error');
          setErrorMessage(getConnectionErrorMessage(error));
          setStatusMessage('Failed to apply remote answer.');
        }
      }

      if (signal.type === 'webrtc_ice_candidate') {
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
    }

    function handleIncomingMessage(event) {
      try {
        const parsedMessage = JSON.parse(event.data);

        if (isDisposed) {
          return;
        }

        if (parsedMessage.type === 'ws_connected') {
          isSocketReadyRef.current = true;

          if (startRequestedRef.current && localStreamRef.current) {
            createOfferIfNeeded(localStreamRef.current);
          }

          return;
        }

        handleSignalMessage(parsedMessage);
      } catch (error) {
        if (isDisposed) {
          return;
        }

        setConnectionStatus('error');
        setErrorMessage('Failed to parse signaling message.');
      }
    }

    try {
      socket = new WebSocket(getSessionWebSocketUrl());
      socketRef.current = socket;
      isSocketReadyRef.current = false;
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage('Failed to create signaling socket.');
      setStatusMessage('WebRTC signaling socket could not be created.');
      return undefined;
    }

    socket.onmessage = handleIncomingMessage;
    socket.onerror = () => {
      if (isDisposed) {
        return;
      }

      setConnectionStatus('error');
      setErrorMessage('WebRTC signaling socket error.');
      setStatusMessage('Signaling socket error.');
    };

    socket.onclose = () => {
      if (isDisposed) {
        return;
      }

      isSocketReadyRef.current = false;
      socketRef.current = null;
      setConnectionStatus('not_connected');
      setStatusMessage('Signaling socket closed.');
    };

    return () => {
      isDisposed = true;
      isSocketReadyRef.current = false;
      socketRef.current = null;
      socket?.close();
      startRequestedRef.current = false;
      cleanupPeerConnection('not_connected', 'WebRTC idle.');
      setLastSignalType('');
      setErrorMessage('');
    };
  }, [enabled, isInitiator, requestId, userId]);

  useEffect(() => {
    if (!peerRef.current || !localStream) {
      return;
    }

    ensurePeerConnection(localStream);
  }, [localStream]);

  return {
    remoteVideoRef,
    hasRemoteStream,
    connectionStatus,
    statusMessage,
    errorMessage,
    lastSignalType,
    startConnection,
    stopConnection,
  };
}
