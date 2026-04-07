import { useEffect, useRef, useState } from 'react';

function getMediaErrorMessage(error) {
  if (error?.name === 'NotAllowedError') {
    return 'Camera or microphone permission was denied.';
  }

  if (error?.name === 'NotFoundError') {
    return 'No camera or microphone device was found.';
  }

  if (error?.name === 'NotReadableError') {
    return 'Camera or microphone is already in use.';
  }

  return 'Failed to prepare local camera and microphone.';
}

function stopStreamTracks(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useSessionMedia() {
  const localVideoRef = useRef(null);
  const streamRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('not_connected');
  const [cameraOn, setCameraOn] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    'Start the video call to prepare your local camera and microphone.'
  );
  const [errorMessage, setErrorMessage] = useState('');

  function releaseCurrentStream() {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      stopStreamTracks(streamRef.current);
      streamRef.current = null;
    }
  }

  async function startLocalPreview() {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setConnectionStatus('error');
      setErrorMessage('This browser does not support camera and microphone access.');
      setStatusMessage('Local media is unavailable in this environment.');
      return false;
    }

    if (streamRef.current) {
      setConnectionStatus('ready');
      setErrorMessage('');
      setStatusMessage('Local preview is already ready.');
      return true;
    }

    setConnectionStatus('preparing');
    setErrorMessage('');
    setStatusMessage('Requesting camera and microphone access...');

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      releaseCurrentStream();
      streamRef.current = nextStream;
      setLocalStream(nextStream);

      const videoTrack = nextStream.getVideoTracks()[0] || null;
      const audioTrack = nextStream.getAudioTracks()[0] || null;

      setCameraOn(Boolean(videoTrack?.enabled));
      setMicrophoneOn(Boolean(audioTrack?.enabled));
      setConnectionStatus('ready');
      setStatusMessage('Local preview ready. Waiting for remote connection.');
      return true;
    } catch (error) {
      releaseCurrentStream();
      setLocalStream(null);
      setCameraOn(false);
      setMicrophoneOn(false);
      setConnectionStatus('error');
      setErrorMessage(getMediaErrorMessage(error));
      setStatusMessage('Local media could not be prepared.');
      return false;
    }
  }

  function toggleCamera() {
    const videoTrack = streamRef.current?.getVideoTracks()[0];

    if (!videoTrack) {
      setStatusMessage('Start the video call first to control the camera.');
      return false;
    }

    videoTrack.enabled = !videoTrack.enabled;
    setCameraOn(videoTrack.enabled);
    setStatusMessage(
      videoTrack.enabled
        ? 'Camera is on for local preview.'
        : 'Camera is off for local preview.'
    );
    return videoTrack.enabled;
  }

  function toggleMicrophone() {
    const audioTrack = streamRef.current?.getAudioTracks()[0];

    if (!audioTrack) {
      setStatusMessage('Start the video call first to control the microphone.');
      return false;
    }

    audioTrack.enabled = !audioTrack.enabled;
    setMicrophoneOn(audioTrack.enabled);
    setStatusMessage(
      audioTrack.enabled
        ? 'Microphone is on for local preview.'
        : 'Microphone is muted for local preview.'
    );
    return audioTrack.enabled;
  }

  function stopLocalPreview() {
    releaseCurrentStream();
    setLocalStream(null);
    setCameraOn(false);
    setMicrophoneOn(false);
    setConnectionStatus('not_connected');
    setErrorMessage('');
    setStatusMessage('Local media stopped.');
  }

  useEffect(() => {
    if (!localVideoRef.current || !localStream) {
      return;
    }

    localVideoRef.current.srcObject = localStream;
    localVideoRef.current.play().catch(() => {});
  }, [localStream]);

  useEffect(() => {
    return () => {
      releaseCurrentStream();
    };
  }, []);

  return {
    localVideoRef,
    hasLocalPreview: Boolean(localStream),
    connectionStatus,
    cameraOn,
    microphoneOn,
    statusMessage,
    errorMessage,
    startLocalPreview,
    toggleCamera,
    toggleMicrophone,
    stopLocalPreview,
  };
}
