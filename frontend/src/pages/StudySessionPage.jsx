import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { getMe } from '../api/auth';
import { completeStudySession, getStudySession } from '../api/study';
import AppLayout from '../components/AppLayout';
import { useStudySessionChat } from '../lib/useStudySessionChat';
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
                onClick={() =>
                  navigate(studySession.spaceId ? `/spaces/${studySession.spaceId}` : '/lobby')
                }
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
