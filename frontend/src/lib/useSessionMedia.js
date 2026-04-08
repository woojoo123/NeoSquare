import { useEffect, useRef, useState } from 'react';

function getMediaErrorMessage(error) {
  if (error?.name === 'NotAllowedError') {
    return '카메라 또는 마이크 권한이 거부되었습니다.';
  }

  if (error?.name === 'NotFoundError') {
    return '사용 가능한 카메라 또는 마이크를 찾을 수 없습니다.';
  }

  if (error?.name === 'NotReadableError') {
    return '카메라 또는 마이크가 이미 사용 중입니다.';
  }

  return '로컬 카메라와 마이크를 준비하지 못했습니다.';
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
    '영상 연결을 시작하면 로컬 카메라와 마이크를 준비합니다.'
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
      setErrorMessage('이 브라우저는 카메라와 마이크 접근을 지원하지 않습니다.');
      setStatusMessage('현재 환경에서는 로컬 미디어를 사용할 수 없습니다.');
      return false;
    }

    if (streamRef.current) {
      setConnectionStatus('ready');
      setErrorMessage('');
      setStatusMessage('로컬 미리보기가 이미 준비되어 있습니다.');
      return streamRef.current;
    }

    setConnectionStatus('preparing');
    setErrorMessage('');
    setStatusMessage('카메라와 마이크 권한을 요청하는 중입니다...');

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
      setStatusMessage('로컬 미리보기가 준비되었습니다. 상대 연결을 기다리는 중입니다.');
      return nextStream;
    } catch (error) {
      releaseCurrentStream();
      setLocalStream(null);
      setCameraOn(false);
      setMicrophoneOn(false);
      setConnectionStatus('error');
      setErrorMessage(getMediaErrorMessage(error));
      setStatusMessage('로컬 미디어를 준비하지 못했습니다.');
      return null;
    }
  }

  function toggleCamera() {
    const videoTrack = streamRef.current?.getVideoTracks()[0];

    if (!videoTrack) {
      setStatusMessage('먼저 영상 연결을 시작해야 카메라를 제어할 수 있습니다.');
      return false;
    }

    videoTrack.enabled = !videoTrack.enabled;
    setCameraOn(videoTrack.enabled);
    setStatusMessage(
      videoTrack.enabled
        ? '로컬 미리보기에서 카메라가 켜졌습니다.'
        : '로컬 미리보기에서 카메라가 꺼졌습니다.'
    );
    return videoTrack.enabled;
  }

  function toggleMicrophone() {
    const audioTrack = streamRef.current?.getAudioTracks()[0];

    if (!audioTrack) {
      setStatusMessage('먼저 영상 연결을 시작해야 마이크를 제어할 수 있습니다.');
      return false;
    }

    audioTrack.enabled = !audioTrack.enabled;
    setMicrophoneOn(audioTrack.enabled);
    setStatusMessage(
      audioTrack.enabled
        ? '로컬 미리보기에서 마이크가 켜졌습니다.'
        : '로컬 미리보기에서 마이크가 음소거되었습니다.'
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
    setStatusMessage('로컬 미디어를 종료했습니다.');
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
    localStream,
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
