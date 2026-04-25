import { useEffect, useRef, useState } from 'react';

function isSecureMediaContext() {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.isSecureContext;
}

function getEnvironmentMediaErrorMessage() {
  if (!isSecureMediaContext()) {
    return '카메라와 마이크는 HTTPS 또는 localhost에서만 접근할 수 있습니다.';
  }

  return '이 브라우저는 카메라와 마이크 접근을 지원하지 않습니다.';
}

async function getPermissionState(permissionName) {
  if (
    typeof navigator === 'undefined' ||
    !navigator.permissions ||
    typeof navigator.permissions.query !== 'function'
  ) {
    return null;
  }

  try {
    const status = await navigator.permissions.query({ name: permissionName });
    return status?.state || null;
  } catch {
    return null;
  }
}

async function getMediaErrorMessage(error) {
  if (error?.name === 'NotAllowedError') {
    if (!isSecureMediaContext()) {
      return '카메라와 마이크는 HTTPS 또는 localhost에서만 접근할 수 있습니다.';
    }

    const [cameraPermission, microphonePermission] = await Promise.all([
      getPermissionState('camera'),
      getPermissionState('microphone'),
    ]);

    if (cameraPermission === 'denied' || microphonePermission === 'denied') {
      return '브라우저 사이트 권한에서 카메라 또는 마이크가 차단되었습니다. 주소창의 권한 설정을 허용으로 바꿔 주세요.';
    }

    return '브라우저 또는 운영체제에서 카메라 또는 마이크 권한이 거부되었습니다. 사이트 권한과 시스템 설정을 확인해 주세요.';
  }

  if (error?.name === 'SecurityError') {
    return isSecureMediaContext()
      ? '보안 설정 때문에 카메라 또는 마이크에 접근할 수 없습니다.'
      : '카메라와 마이크는 HTTPS 또는 localhost에서만 접근할 수 있습니다.';
  }

  if (error?.name === 'NotFoundError') {
    return '사용 가능한 카메라 또는 마이크를 찾을 수 없습니다.';
  }

  if (error?.name === 'NotReadableError') {
    return '카메라 또는 마이크가 이미 사용 중입니다.';
  }

  if (error?.name === 'OverconstrainedError') {
    return '현재 장치 조건으로는 카메라 또는 마이크를 준비할 수 없습니다.';
  }

  if (error?.name === 'AbortError') {
    return '카메라 또는 마이크 준비가 중단되었습니다. 다시 시도해 주세요.';
  }

  return '로컬 카메라와 마이크를 준비하지 못했습니다.';
}

function stopStreamTracks(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

function normalizeMediaRequest(options) {
  if (!options || (options.video == null && options.audio == null)) {
    return {
      video: true,
      audio: true,
    };
  }

  return {
    video: Boolean(options.video),
    audio: Boolean(options.audio),
  };
}

function findTrack(stream, type) {
  const trackGetter =
    type === 'video' ? stream?.getVideoTracks?.bind(stream) : stream?.getAudioTracks?.bind(stream);
  const tracks = trackGetter ? trackGetter() : [];
  return tracks.find((track) => track.readyState !== 'ended') || tracks[0] || null;
}

function mergeStreams(baseStream, addedStream) {
  const tracks = [...(baseStream?.getTracks() || []), ...(addedStream?.getTracks() || [])];
  return new MediaStream(tracks);
}

function getRequestStatusMessage(request) {
  if (request.video && request.audio) {
    return '카메라와 마이크 권한을 요청하는 중입니다...';
  }

  if (request.video) {
    return '카메라 권한을 요청하는 중입니다...';
  }

  if (request.audio) {
    return '마이크 권한을 요청하는 중입니다...';
  }

  return '로컬 미디어 상태를 확인하는 중입니다...';
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

  function bindTrackState(track, type) {
    if (!track) {
      return;
    }

    track.onended = () => {
      if (type === 'video') {
        setCameraOn(false);
        setStatusMessage('카메라 입력이 종료되었습니다. 필요하면 다시 준비해 주세요.');
      } else {
        setMicrophoneOn(false);
        setStatusMessage('마이크 입력이 종료되었습니다. 필요하면 다시 준비해 주세요.');
      }
    };
  }

  function releaseCurrentStream() {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      stopStreamTracks(streamRef.current);
      streamRef.current = null;
    }
  }

  async function startLocalPreviewWithOptions(options) {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setConnectionStatus('error');
      setErrorMessage(getEnvironmentMediaErrorMessage());
      setStatusMessage('현재 환경에서는 로컬 미디어를 사용할 수 없습니다.');
      return false;
    }

    const request = normalizeMediaRequest(options);
    const currentStream = streamRef.current;
    const currentVideoTrack = findTrack(currentStream, 'video');
    const currentAudioTrack = findTrack(currentStream, 'audio');
    const needsVideoTrack = request.video && !currentVideoTrack;
    const needsAudioTrack = request.audio && !currentAudioTrack;

    if (!needsVideoTrack && !needsAudioTrack && currentStream) {
      setConnectionStatus('ready');
      setErrorMessage('');
      setStatusMessage('로컬 미디어가 이미 준비되어 있습니다.');
      return currentStream;
    }

    if (!needsVideoTrack && !needsAudioTrack && !currentStream) {
      setConnectionStatus('not_connected');
      setErrorMessage('');
      setStatusMessage('카메라 또는 마이크를 켜면 로컬 미디어를 준비합니다.');
      return null;
    }

    setConnectionStatus('preparing');
    setErrorMessage('');
    setStatusMessage(getRequestStatusMessage({ video: needsVideoTrack, audio: needsAudioTrack }));

    try {
      const requestedStream = await navigator.mediaDevices.getUserMedia({
        video: needsVideoTrack,
        audio: needsAudioTrack,
      });

      const nextStream = currentStream ? mergeStreams(currentStream, requestedStream) : requestedStream;

      streamRef.current = nextStream;
      setLocalStream(nextStream);

      const videoTrack = findTrack(nextStream, 'video');
      const audioTrack = findTrack(nextStream, 'audio');

      bindTrackState(videoTrack, 'video');
      bindTrackState(audioTrack, 'audio');

      setCameraOn(Boolean(videoTrack?.enabled));
      setMicrophoneOn(Boolean(audioTrack?.enabled));
      setConnectionStatus('ready');
      setStatusMessage('로컬 미리보기가 준비되었습니다. 상대 연결을 기다리는 중입니다.');
      setErrorMessage('');
      return nextStream;
    } catch (error) {
      setConnectionStatus('error');
      setErrorMessage(await getMediaErrorMessage(error));

      if (!currentStream) {
        releaseCurrentStream();
        setLocalStream(null);
        setCameraOn(false);
        setMicrophoneOn(false);
        setStatusMessage('로컬 미디어를 준비하지 못했습니다.');
        return null;
      }

      setCameraOn(Boolean(findTrack(currentStream, 'video')?.enabled));
      setMicrophoneOn(Boolean(findTrack(currentStream, 'audio')?.enabled));
      setStatusMessage('일부 장치 권한을 얻지 못했지만 기존 로컬 미디어는 유지되었습니다.');
      return currentStream;
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

  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.addEventListener !== 'function'
    ) {
      return undefined;
    }

    function handleDeviceChange() {
      if (!streamRef.current) {
        return;
      }

      setStatusMessage('카메라 또는 마이크 장치 상태가 변경되었습니다. 필요하면 다시 준비해 주세요.');
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  return {
    localVideoRef,
    localStream,
    hasLocalPreview: Boolean(localStream),
    hasCameraTrack: Boolean(findTrack(localStream, 'video')),
    hasMicrophoneTrack: Boolean(findTrack(localStream, 'audio')),
    connectionStatus,
    cameraOn,
    microphoneOn,
    statusMessage,
    errorMessage,
    startLocalPreview: startLocalPreviewWithOptions,
    toggleCamera,
    toggleMicrophone,
    stopLocalPreview,
  };
}
