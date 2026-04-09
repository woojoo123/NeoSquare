import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { getMe } from '../api/auth';
import { completeStudySession, getStudySession } from '../api/study';
import AppLayout from '../components/AppLayout';
import { useSessionMedia } from '../lib/useSessionMedia';
import { useStudySessionChat } from '../lib/useStudySessionChat';
import { useStudySessionWebRTC } from '../lib/useStudySessionWebRTC';
import { useAuthStore } from '../store/authStore';

function formatStudySessionStatus(status) {
  if (status === 'ACTIVE') {
    return '진행 중';
  }

  if (status === 'COMPLETED') {
    return '종료됨';
  }

  return status || '알 수 없음';
}

function formatParticipantRole(role) {
  if (role === 'HOST') {
    return '진행자';
  }

  if (role === 'MEMBER') {
    return '참여자';
  }

  return role || '참여자';
}

function formatSessionTimestamp(value) {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
}

function formatChatStatus(status) {
  if (status === 'idle') {
    return '대기 중';
  }

  if (status === 'connecting') {
    return '연결 중';
  }

  if (status === 'connected') {
    return '연결됨';
  }

  if (status === 'disconnected') {
    return '연결 종료';
  }

  if (status === 'error') {
    return '오류';
  }

  return status || '알 수 없음';
}

function formatVideoStatus(status) {
  if (status === 'not_connected') {
    return '미연결';
  }

  if (status === 'preparing') {
    return '준비 중';
  }

  if (status === 'signaling') {
    return '시그널링 중';
  }

  if (status === 'connecting') {
    return '연결 중';
  }

  if (status === 'connected') {
    return '연결됨';
  }

  if (status === 'disconnected') {
    return '연결 끊김';
  }

  if (status === 'error') {
    return '오류';
  }

  return status || '알 수 없음';
}

function formatSignalType(type) {
  if (type === 'webrtc_offer') {
    return '연결 제안';
  }

  if (type === 'webrtc_answer') {
    return '연결 응답';
  }

  if (type === 'webrtc_ice_candidate') {
    return 'ICE 후보';
  }

  return type || '없음';
}

export default function StudySessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams();
  const initialStudySession = location.state?.studySession || null;
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [studySession, setStudySession] = useState(initialStudySession);
  const [isLoading, setIsLoading] = useState(!initialStudySession);
  const [errorMessage, setErrorMessage] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [completeStatus, setCompleteStatus] = useState('idle');
  const chatMessagesEndRef = useRef(null);
  const numericSessionId = Number(sessionId);
  const myParticipant = useMemo(
    () =>
      studySession?.participants?.find(
        (participant) => String(participant.userId) === String(currentUser?.id)
      ) || null,
    [currentUser?.id, studySession?.participants]
  );
  const {
    localVideoRef,
    localStream,
    hasLocalPreview,
    connectionStatus: localMediaStatus,
    cameraOn,
    microphoneOn,
    statusMessage: mediaStatusMessage,
    errorMessage: mediaErrorMessage,
    startLocalPreview,
    toggleCamera,
    toggleMicrophone,
    stopLocalPreview,
  } = useSessionMedia();
  const {
    messages,
    connectionStatus,
    errorMessage: chatErrorMessage,
    sendMessage,
  } = useStudySessionChat({
    enabled: Boolean(
      studySession?.id &&
      studySession?.status === 'ACTIVE' &&
      currentUser?.id &&
      currentUser?.nickname
    ),
    studySessionId: Number.isFinite(numericSessionId) ? numericSessionId : null,
    userId: currentUser?.id,
    nickname: currentUser?.nickname,
  });
  const {
    connectionStatus: videoConnectionStatus,
    statusMessage: videoStatusMessage,
    errorMessage: videoErrorMessage,
    lastSignalType,
    canRetry,
    hasConnectedPeers,
    remoteStreams,
    peerStates,
    hasTurnRelay,
    iceServerModeLabel,
    iceServerDetailMessage,
    bindRemoteVideo,
    startConnection,
    retryConnection,
    stopConnection,
  } = useStudySessionWebRTC({
    enabled: Boolean(
      studySession?.id &&
      studySession?.status === 'ACTIVE' &&
      currentUser?.id
    ),
    studySessionId: Number.isFinite(numericSessionId) ? numericSessionId : null,
    userId: currentUser?.id,
    participants: studySession?.participants || [],
    localStream,
  });
  const otherParticipants = useMemo(
    () =>
      (studySession?.participants || []).filter(
        (participant) => String(participant.userId) !== String(currentUser?.id)
      ),
    [currentUser?.id, studySession?.participants]
  );

  useEffect(() => {
    if (currentUser) {
      return;
    }

    let isMounted = true;

    async function loadCurrentUser() {
      try {
        const response = await getMe();

        if (!isMounted) {
          return;
        }

        setCurrentUser(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        clearAuth();
        navigate('/login', { replace: true });
      }
    }

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [clearAuth, currentUser, navigate, setCurrentUser]);

  useEffect(() => {
    let isMounted = true;

    async function loadStudySessionEntry() {
      if (!Number.isFinite(numericSessionId)) {
        setErrorMessage('스터디 세션 주소가 올바르지 않습니다.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await getStudySession(numericSessionId);

        if (!isMounted) {
          return;
        }

        setStudySession(response);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const status = error?.response?.status;
        const message =
          error?.response?.data?.message || error.message || '스터디 세션 정보를 불러오지 못했습니다.';

        if (status === 401) {
          clearAuth();
          navigate('/login', { replace: true });
          return;
        }

        setErrorMessage(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadStudySessionEntry();

    return () => {
      isMounted = false;
    };
  }, [clearAuth, navigate, numericSessionId]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleChatSubmit = (event) => {
    event.preventDefault();

    const didSend = sendMessage(chatInput);

    if (didSend) {
      setChatInput('');
    }
  };

  const handleCompleteStudySession = async () => {
    if (!studySession?.id || studySession.status !== 'ACTIVE' || !currentUser?.id) {
      return;
    }

    setCompleteStatus('saving');
    setActionMessage('');

    try {
      const completedStudySession = await completeStudySession(studySession.id);
      stopConnection();
      stopLocalPreview();
      setStudySession(completedStudySession);
      setCompleteStatus('done');
      setActionMessage('스터디 세션을 종료했습니다.');
    } catch (error) {
      setCompleteStatus('error');
      setActionMessage(
        error?.response?.data?.message || error.message || '스터디 종료에 실패했습니다.'
      );
    }
  };

  const handleStartStudyVideo = async () => {
    setActionMessage('');
    const preparedStream = await startLocalPreview();

    if (!preparedStream) {
      return;
    }

    await startConnection(preparedStream);
  };

  const handleRetryStudyVideo = async () => {
    setActionMessage('');
    const preparedStream = hasLocalPreview ? localStream : await startLocalPreview();

    if (!preparedStream) {
      return;
    }

    await retryConnection(preparedStream);
  };

  const handleToggleCamera = () => {
    setActionMessage('');
    toggleCamera();
  };

  const handleToggleMicrophone = () => {
    setActionMessage('');
    toggleMicrophone();
  };

  const handleBackToSpace = () => {
    stopConnection();
    stopLocalPreview();
    navigate(studySession?.spaceId ? `/spaces/${studySession.spaceId}` : '/lobby');
  };

  const localMediaStatusLabel =
    localMediaStatus === 'ready'
      ? '로컬 미디어 준비 완료'
      : localMediaStatus === 'preparing'
        ? '로컬 미디어 준비 중'
        : localMediaStatus === 'error'
          ? '로컬 미디어 오류'
          : '로컬 미디어 대기';

  const primaryVideoActionLabel =
    mediaErrorMessage && !hasLocalPreview
      ? '권한 다시 요청'
      : canRetry || videoConnectionStatus === 'error' || videoConnectionStatus === 'disconnected'
        ? '연결 다시 시도'
        : hasLocalPreview
          ? '스터디 영상 연결 시작'
          : '카메라/마이크 준비';

  return (
    <AppLayout
      eyebrow="스터디 세션"
      title={studySession?.title || '스터디 세션'}
      description={
        studySession
          ? `${studySession.spaceName}에서 진행 중인 스터디 세션입니다.`
          : '스터디 세션 정보를 불러오는 중입니다.'
      }
      panelClassName="app-panel--wide"
    >
      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}

      {isLoading ? (
        <p className="app-note">스터디 세션을 불러오는 중입니다...</p>
      ) : studySession ? (
        <section className="session-panel">
          <section className="session-hero">
            <div className="session-hero__main">
              <p className="session-hero__eyebrow">Study Session #{studySession.id}</p>
              <h2>{studySession.title}</h2>
              <p className="session-hero__summary">
                {studySession.description || '설명이 없는 스터디 세션입니다.'}
              </p>
              <div className="session-meta-list">
                <span className="session-meta-pill">상태: {formatStudySessionStatus(studySession.status)}</span>
                <span className="session-meta-pill">공간: {studySession.spaceName}</span>
                <span className="session-meta-pill">참가자 수: {studySession.participantCount}명</span>
                {myParticipant ? (
                  <span className="session-meta-pill">
                    내 역할: {formatParticipantRole(myParticipant.role)}
                  </span>
                ) : null}
              </div>
              <p className="app-note">생성 시각: {formatSessionTimestamp(studySession.createdAt)}</p>
              {studySession.completedAt ? (
                <p className="app-note">종료 시각: {formatSessionTimestamp(studySession.completedAt)}</p>
              ) : null}
            </div>

            <div className="session-hero__actions">
              <button
                type="button"
                className="secondary-button"
                onClick={handleBackToSpace}
              >
                공간으로 돌아가기
              </button>
              {currentUser?.id === studySession.hostId ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleCompleteStudySession}
                  disabled={studySession.status !== 'ACTIVE' || completeStatus === 'saving'}
                >
                  {completeStatus === 'saving'
                    ? '스터디 종료 중...'
                    : studySession.status === 'COMPLETED'
                      ? '이미 종료됨'
                      : '스터디 종료'}
                </button>
              ) : null}
            </div>
          </section>

          {actionMessage ? (
            <p className={completeStatus === 'error' ? 'app-error' : 'app-success'}>
              {actionMessage}
            </p>
          ) : null}
          {mediaErrorMessage ? <p className="app-error">{mediaErrorMessage}</p> : null}
          {videoErrorMessage ? <p className="app-error">{videoErrorMessage}</p> : null}
          {!mediaErrorMessage && mediaStatusMessage ? (
            <p className="app-note">{mediaStatusMessage}</p>
          ) : null}
          {!videoErrorMessage && videoStatusMessage ? (
            <p className="app-note">{videoStatusMessage}</p>
          ) : null}
          {!videoErrorMessage ? (
            <p className="app-note">{iceServerDetailMessage}</p>
          ) : null}
          {canRetry ? (
            <p className="app-note">
              연결이 끊기면 같은 버튼으로 스터디 시그널링과 참가자별 피어 연결을 다시 시도할 수 있습니다.
            </p>
          ) : null}

          <section
            className={`session-video-panel ${videoConnectionStatus !== 'not_connected' || hasLocalPreview ? 'session-video-panel--active' : ''}`}
          >
            <div className="session-video-header">
              <div>
                <h2>스터디 영상 영역</h2>
                <p className="app-note">
                  참가자별 1:1 피어 연결을 조합하는 스터디용 영상 영역입니다.
                </p>
              </div>
              <div className="session-video-status-list">
                <span className="session-meta-pill">연결: {formatVideoStatus(videoConnectionStatus)}</span>
                <span className="session-meta-pill">로컬: {localMediaStatusLabel}</span>
                <span className="session-meta-pill">ICE: {iceServerModeLabel}</span>
                <span className="session-meta-pill">카메라: {cameraOn ? '켜짐' : '꺼짐'}</span>
                <span className="session-meta-pill">마이크: {microphoneOn ? '켜짐' : '꺼짐'}</span>
                {hasTurnRelay ? (
                  <span className="session-meta-pill">릴레이 준비됨</span>
                ) : null}
                {lastSignalType ? (
                  <span className="session-meta-pill">
                    최근 시그널: {formatSignalType(lastSignalType)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="session-video-grid">
              <article className={`session-video-slot ${cameraOn ? 'session-video-slot--active' : ''}`}>
                <span className="session-video-slot__label">내 영상</span>
                <strong>{currentUser?.nickname || '나'}</strong>
                <div className="session-video-stage">
                  {hasLocalPreview ? (
                    <video
                      ref={localVideoRef}
                      className="session-video-element"
                      autoPlay
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="session-video-placeholder">
                      <span>로컬 미리보기가 없습니다</span>
                    </div>
                  )}
                </div>
                <p className="session-video-slot__state">
                  {hasConnectedPeers
                    ? '스터디 참가자와 영상 연결을 유지하고 있습니다.'
                    : hasLocalPreview
                      ? '로컬 미리보기가 준비되었습니다.'
                      : '카메라와 마이크를 준비해 주세요.'}
                </p>
              </article>

              {otherParticipants.length === 0 ? (
                <article className="session-video-slot">
                  <span className="session-video-slot__label">상대 영상</span>
                  <strong>참가자 없음</strong>
                  <div className="session-video-stage">
                    <div className="session-video-placeholder">
                      <span>다른 참가자가 입장하면 여기에 영상이 표시됩니다</span>
                    </div>
                  </div>
                  <p className="session-video-slot__state">현재 연결할 다른 참가자가 없습니다.</p>
                </article>
              ) : (
                otherParticipants.map((participant) => {
                  const participantState = peerStates[participant.userId] || 'not_connected';
                  const hasStream = Boolean(remoteStreams[participant.userId]);

                  return (
                    <article
                      key={participant.userId}
                      className={`session-video-slot ${hasStream ? 'session-video-slot--active' : ''}`}
                    >
                      <span className="session-video-slot__label">
                        {formatParticipantRole(participant.role)}
                      </span>
                      <strong>{participant.label}</strong>
                      <div className="session-video-stage">
                        {hasStream ? (
                          <video
                            ref={(element) => bindRemoteVideo(participant.userId, element)}
                            className="session-video-element"
                            autoPlay
                            playsInline
                          />
                        ) : (
                          <div className="session-video-placeholder">
                            <span>상대 영상이 여기에 표시됩니다</span>
                          </div>
                        )}
                      </div>
                      <p className="session-video-slot__state">
                        {hasStream
                          ? '상대 영상이 연결되었습니다.'
                          : `상태: ${formatVideoStatus(participantState)}`}
                      </p>
                    </article>
                  );
                })
              )}
            </div>

            <div className="session-video-controls">
              <button
                type="button"
                className="primary-button"
                onClick={
                  canRetry || videoConnectionStatus === 'error' || videoConnectionStatus === 'disconnected'
                    ? handleRetryStudyVideo
                    : handleStartStudyVideo
                }
                disabled={studySession.status !== 'ACTIVE' || videoConnectionStatus === 'connecting'}
              >
                {videoConnectionStatus === 'connected'
                  ? '영상 연결됨'
                  : videoConnectionStatus === 'signaling' || videoConnectionStatus === 'connecting'
                    ? '연결 중...'
                    : primaryVideoActionLabel}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleToggleCamera}
                disabled={!hasLocalPreview || studySession.status !== 'ACTIVE'}
              >
                {cameraOn ? '카메라 끄기' : '카메라 켜기'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleToggleMicrophone}
                disabled={!hasLocalPreview || studySession.status !== 'ACTIVE'}
              >
                {microphoneOn ? '마이크 끄기' : '마이크 켜기'}
              </button>
            </div>
          </section>

          <section className="session-card-grid">
            <article className="session-card">
              <h2>참가자</h2>
              <ul className="study-session-participants">
                {studySession.participants.map((participant) => (
                  <li key={participant.userId} className="study-session-participant">
                    <div>
                      <strong>{participant.label}</strong>
                      <p>{formatParticipantRole(participant.role)}</p>
                    </div>
                    <span>{formatSessionTimestamp(participant.joinedAt)}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="session-card">
              <h2>세션 상태</h2>
              <p>
                이 스터디 세션은 <strong>{studySession.spaceName}</strong> 공간에서 생성되었습니다.
              </p>
              <p>
                현재 채팅 연결 상태는 <strong>{formatChatStatus(connectionStatus)}</strong> 입니다.
              </p>
              <p>
                현재 영상 연결 상태는 <strong>{formatVideoStatus(videoConnectionStatus)}</strong> 입니다.
              </p>
              {chatErrorMessage ? <p className="app-error">{chatErrorMessage}</p> : null}
            </article>
          </section>

          <section className="session-chat-panel">
            <div className="session-chat-header">
              <div>
                <h2>스터디 세션 채팅</h2>
                <p className="app-note">참가자끼리만 보이는 스터디 전용 채팅입니다.</p>
              </div>
            </div>

            <div className="session-chat-messages">
              {messages.length === 0 ? (
                <p className="app-note">아직 채팅 메시지가 없습니다.</p>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={`session-chat-message ${message.isMine ? 'session-chat-message--mine' : ''}`}
                  >
                    <span className="session-chat-message__meta">
                      {message.isMine ? '나' : message.nickname} ·{' '}
                      {formatSessionTimestamp(message.timestamp)}
                    </span>
                    <p>{message.content}</p>
                  </article>
                ))
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            <form className="session-chat-form" onSubmit={handleChatSubmit}>
              <input
                type="text"
                className="app-input"
                placeholder="스터디 대화를 입력하세요"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                disabled={studySession.status !== 'ACTIVE'}
              />
              <button
                type="submit"
                className="primary-button"
                disabled={studySession.status !== 'ACTIVE'}
              >
                전송
              </button>
            </form>
          </section>
        </section>
      ) : null}
    </AppLayout>
  );
}
