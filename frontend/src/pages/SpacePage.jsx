import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getMe } from '../api/auth';
import { createMentoringRequest } from '../api/mentoring';
import { createReservation } from '../api/reservations';
import { getSpace } from '../api/spaces';
import AppLayout from '../components/AppLayout';
import SpaceGame from '../components/SpaceGame';
import { getLobbyZoneDefinition } from '../lib/lobbyZones';
import { useLobbyRealtime } from '../lib/useLobbyRealtime';
import { useAuthStore } from '../store/authStore';

const STUDY_RECRUIT_PREFIX = '[스터디 모집]';

function getDefaultReservationDateTime() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);

  const localOffset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - localOffset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function formatRealtimeConnectionStatus(status) {
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

  return '대기 중';
}

function buildStudyRecruitmentMessage(topic, note) {
  const trimmedTopic = topic.trim();
  const trimmedNote = note.trim();
  const topicPart = `주제: ${trimmedTopic}`;
  const notePart = trimmedNote ? ` | 메모: ${trimmedNote}` : '';
  return `${STUDY_RECRUIT_PREFIX} ${topicPart}${notePart}`;
}

function parseStudyRecruitmentMessage(message) {
  if (!message?.content?.startsWith(STUDY_RECRUIT_PREFIX)) {
    return null;
  }

  const rawBody = message.content.slice(STUDY_RECRUIT_PREFIX.length).trim();
  const [rawTopic = '', rawNote = ''] = rawBody.split('|').map((value) => value.trim());
  const topic = rawTopic.replace(/^주제:\s*/u, '').trim();
  const note = rawNote.replace(/^메모:\s*/u, '').trim();

  if (!topic) {
    return null;
  }

  return {
    id: message.id,
    senderId: message.senderId,
    nickname: message.nickname,
    topic,
    note,
    isMine: message.isMine,
    timestamp: message.timestamp,
  };
}

function formatChatTimestamp(value) {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return parsedDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SpacePage() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const [space, setSpace] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestStatus, setRequestStatus] = useState('idle');
  const [requestNotice, setRequestNotice] = useState('');
  const [requestError, setRequestError] = useState('');
  const [reservationDateTime, setReservationDateTime] = useState(getDefaultReservationDateTime);
  const [reservationMessage, setReservationMessage] = useState('');
  const [reservationStatus, setReservationStatus] = useState('idle');
  const [reservationNotice, setReservationNotice] = useState('');
  const [reservationError, setReservationError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [studyTopic, setStudyTopic] = useState('');
  const [studyNote, setStudyNote] = useState('');
  const [studyNotice, setStudyNotice] = useState('');
  const [studyError, setStudyError] = useState('');
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const chatInputRef = useRef(null);
  const {
    connectionStatus,
    lastError,
    remoteEvent,
    remoteUsers,
    chatMessages,
    sendChatMessage,
    sendUserMove,
  } = useLobbyRealtime({
    enabled: !isLoading && !errorMessage && Boolean(currentUser) && Boolean(space),
    userId: currentUser?.id,
    nickname: currentUser?.nickname,
    spaceId: space?.id ?? null,
  });

  const selectedParticipant = useMemo(
    () => remoteUsers.find((user) => String(user.userId) === String(selectedParticipantId)) || null,
    [remoteUsers, selectedParticipantId]
  );
  const spaceDefinition = getLobbyZoneDefinition(space?.type);
  const studyRecruitments = useMemo(
    () =>
      [...chatMessages]
        .map(parseStudyRecruitmentMessage)
        .filter(Boolean)
        .reverse(),
    [chatMessages]
  );

  useEffect(() => {
    if (!selectedParticipantId) {
      return;
    }

    const isStillPresent = remoteUsers.some(
      (user) => String(user.userId) === String(selectedParticipantId)
    );

    if (!isStillPresent) {
      setSelectedParticipantId(null);
    }
  }, [remoteUsers, selectedParticipantId]);

  useEffect(() => {
    let isMounted = true;

    async function loadSpace() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [meResponse, spaceResponse] = await Promise.all([
          getMe(),
          getSpace(Number(spaceId)),
        ]);

        if (!isMounted) {
          return;
        }

        setCurrentUser(meResponse);
        setSpace(spaceResponse);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const status = error?.response?.status;
        const message =
          error?.response?.data?.message || error.message || '공간 정보를 불러오지 못했습니다.';

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

    loadSpace();

    return () => {
      isMounted = false;
    };
  }, [clearAuth, navigate, setCurrentUser, spaceId]);

  const selectParticipant = (participant) => {
    if (!participant?.userId) {
      return;
    }

    setSelectedParticipantId(participant.userId);
    setRequestNotice('');
    setRequestError('');
    setReservationNotice('');
    setReservationError('');
    setStudyNotice('');
    setStudyError('');

    if (!requestMessage.trim()) {
      setRequestMessage(`${participant.label}님, 잠깐 이야기 나눌 수 있을까요?`);
    }

    if (!reservationMessage.trim()) {
      setReservationMessage(`${participant.label}님과 시간을 맞춰 멘토링을 진행하고 싶어요.`);
    }
  };

  const handleChatSubmit = (event) => {
    event.preventDefault();

    const didSend = sendChatMessage(chatInput);

    if (didSend) {
      setChatInput('');
    }
  };

  const handleMentionParticipant = () => {
    if (!selectedParticipant) {
      return;
    }

    setChatInput((currentValue) =>
      currentValue.trim()
        ? currentValue
        : `${selectedParticipant.label}님, 잠깐 이야기 가능하실까요?`
    );
    chatInputRef.current?.focus();
  };

  const handleCreateRequest = async (event) => {
    event.preventDefault();

    if (!selectedParticipant) {
      setRequestError('먼저 대화할 참가자를 선택해 주세요.');
      setRequestNotice('');
      return;
    }

    setRequestStatus('saving');
    setRequestNotice('');
    setRequestError('');

    try {
      await createMentoringRequest({
        mentorId: Number(selectedParticipant.userId),
        message: requestMessage.trim(),
      });
      setRequestStatus('saved');
      setRequestNotice('멘토링 요청을 보냈습니다.');
      setRequestMessage('');
    } catch (error) {
      setRequestStatus('error');
      setRequestError(
        error?.response?.data?.message || error.message || '멘토링 요청 전송에 실패했습니다.'
      );
    }
  };

  const handleCreateReservation = async (event) => {
    event.preventDefault();

    if (!selectedParticipant) {
      setReservationError('먼저 예약할 참가자를 선택해 주세요.');
      setReservationNotice('');
      return;
    }

    if (!reservationDateTime) {
      setReservationError('예약 날짜와 시간을 입력해 주세요.');
      setReservationNotice('');
      return;
    }

    setReservationStatus('saving');
    setReservationNotice('');
    setReservationError('');

    try {
      await createReservation({
        mentorId: Number(selectedParticipant.userId),
        reservedAt: new Date(reservationDateTime).toISOString(),
        message: reservationMessage.trim(),
      });
      setReservationStatus('saved');
      setReservationNotice('멘토링 예약을 생성했습니다.');
      setReservationMessage('');
      setReservationDateTime(getDefaultReservationDateTime());
    } catch (error) {
      setReservationStatus('error');
      setReservationError(
        error?.response?.data?.message || error.message || '멘토링 예약 생성에 실패했습니다.'
      );
    }
  };

  const handleCreateStudyRecruitment = (event) => {
    event.preventDefault();

    if (!studyTopic.trim()) {
      setStudyError('스터디 주제를 입력해 주세요.');
      setStudyNotice('');
      return;
    }

    const didSend = sendChatMessage(buildStudyRecruitmentMessage(studyTopic, studyNote));

    if (!didSend) {
      setStudyError('스터디 모집 메시지를 전송하지 못했습니다.');
      setStudyNotice('');
      return;
    }

    setStudyTopic('');
    setStudyNote('');
    setStudyError('');
    setStudyNotice('스터디 모집을 등록했습니다.');
  };

  const handleJoinStudyRecruitment = (recruitment) => {
    if (!recruitment) {
      return;
    }

    const matchingParticipant = remoteUsers.find(
      (user) => String(user.userId) === String(recruitment.senderId)
    );

    if (matchingParticipant) {
      selectParticipant(matchingParticipant);
    }

    setChatInput(
      `${recruitment.nickname}님, "${recruitment.topic}" 스터디에 함께 참여하고 싶어요.`
    );
    chatInputRef.current?.focus();
  };

  return (
    <AppLayout
      eyebrow="메타버스 공간"
      title={spaceDefinition.label}
      description={spaceDefinition.helperText}
      panelClassName="app-panel--wide"
    >
      <div className="space-page-actions">
        <button type="button" className="secondary-button" onClick={() => navigate('/lobby')}>
          로비로 돌아가기
        </button>
      </div>

      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}
      {isLoading ? <p className="app-note">공간 정보를 불러오는 중입니다...</p> : null}

      {!isLoading && !errorMessage && space ? (
        <div className="space-page-layout">
          <aside className="space-sidebar">
            <div className="lobby-info-card">
              <h2>공간 정보</h2>
              <strong>{spaceDefinition.label}</strong>
              <span>최대 {space.maxCapacity}명까지 이용 가능한 공간입니다.</span>
              <p className="app-note">{spaceDefinition.description}</p>
              <p className="app-note">
                현재 연결 상태: {formatRealtimeConnectionStatus(connectionStatus)}
              </p>
              {lastError ? <p className="app-error">{lastError}</p> : null}
            </div>

            <div className="lobby-info-card">
              <h2>현재 참가자</h2>
              {remoteUsers.length === 0 ? (
                <p className="app-note">
                  아직 이 공간에 보이는 다른 참가자가 없습니다. 다른 계정으로 같은 공간에 들어와 보세요.
                </p>
              ) : (
                <ul className="space-participant-list">
                  {remoteUsers.map((user) => {
                    const isSelected =
                      String(user.userId) === String(selectedParticipant?.userId);

                    return (
                      <li
                        key={user.userId}
                        className={`space-participant-card ${
                          isSelected ? 'space-participant-card--selected' : ''
                        }`}
                      >
                        <div>
                          <strong>{user.label}</strong>
                          <p>
                            좌표 {Math.round(user.x || 0)}, {Math.round(user.y || 0)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className={isSelected ? 'secondary-button' : 'primary-button'}
                          onClick={() => selectParticipant(user)}
                        >
                          {isSelected ? '선택됨' : '상호작용'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {space?.type === 'STUDY' ? (
              <div className="lobby-info-card">
                <h2>스터디 모집 게시</h2>
                <form className="mentoring-form" onSubmit={handleCreateStudyRecruitment}>
                  <label className="app-field">
                    <span>스터디 주제</span>
                    <input
                      type="text"
                      className="app-input"
                      value={studyTopic}
                      onChange={(event) => setStudyTopic(event.target.value)}
                      placeholder="예: React 상태관리, 코딩테스트, 포트폴리오 리뷰"
                    />
                  </label>
                  <label className="app-field">
                    <span>메모</span>
                    <textarea
                      className="app-input mentoring-textarea"
                      value={studyNote}
                      onChange={(event) => setStudyNote(event.target.value)}
                      rows={3}
                      placeholder="진행 방식이나 목표를 간단히 적어 주세요."
                    />
                  </label>
                  <button type="submit" className="primary-button">
                    스터디 모집 올리기
                  </button>
                </form>
                {studyNotice ? <p className="app-success">{studyNotice}</p> : null}
                {studyError ? <p className="app-error">{studyError}</p> : null}
              </div>
            ) : null}

            <div className="lobby-info-card">
              <h2>선택한 참가자</h2>
              {!selectedParticipant ? (
                <p className="app-note">
                  아바타를 클릭하거나 참가자 목록에서 한 명을 선택하면 요청, 예약, 채팅 액션을 바로 실행할 수 있습니다.
                </p>
              ) : (
                <>
                  <strong>{selectedParticipant.label}</strong>
                  <span>현재 {spaceDefinition.label}에 접속 중</span>
                  <p className="app-note">
                    먼저 채팅으로 말을 걸거나 바로 멘토링 요청과 예약을 보낼 수 있습니다.
                  </p>
                  <div className="space-selected-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleMentionParticipant}
                    >
                      채팅으로 말 걸기
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="lobby-info-card">
              <h2>빠른 멘토링 요청</h2>
              <form className="mentoring-form" onSubmit={handleCreateRequest}>
                <label className="app-field">
                  <span>요청 메시지</span>
                  <textarea
                    className="app-input mentoring-textarea"
                    value={requestMessage}
                    onChange={(event) => setRequestMessage(event.target.value)}
                    rows={3}
                    placeholder="선택한 참가자에게 전달할 메시지를 입력해 주세요."
                    disabled={!selectedParticipant || requestStatus === 'saving'}
                  />
                </label>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!selectedParticipant || requestStatus === 'saving'}
                >
                  {requestStatus === 'saving' ? '요청 전송 중...' : '멘토링 요청 보내기'}
                </button>
              </form>
              {requestNotice ? <p className="app-success">{requestNotice}</p> : null}
              {requestError ? <p className="app-error">{requestError}</p> : null}
            </div>

            <div className="lobby-info-card">
              <h2>빠른 예약 제안</h2>
              <form className="mentoring-form" onSubmit={handleCreateReservation}>
                <label className="app-field">
                  <span>예약 시간</span>
                  <input
                    type="datetime-local"
                    className="app-input"
                    value={reservationDateTime}
                    onChange={(event) => setReservationDateTime(event.target.value)}
                    disabled={!selectedParticipant || reservationStatus === 'saving'}
                  />
                </label>
                <label className="app-field">
                  <span>예약 메시지</span>
                  <textarea
                    className="app-input mentoring-textarea"
                    value={reservationMessage}
                    onChange={(event) => setReservationMessage(event.target.value)}
                    rows={3}
                    placeholder="예약과 함께 전달할 메시지를 입력해 주세요."
                    disabled={!selectedParticipant || reservationStatus === 'saving'}
                  />
                </label>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!selectedParticipant || reservationStatus === 'saving'}
                >
                  {reservationStatus === 'saving' ? '예약 생성 중...' : '예약 제안 보내기'}
                </button>
              </form>
              {reservationNotice ? <p className="app-success">{reservationNotice}</p> : null}
              {reservationError ? <p className="app-error">{reservationError}</p> : null}
            </div>
          </aside>

          <section className="space-stage-panel">
            <div className="space-stage-header">
              <div>
                <h2>{spaceDefinition.label} 안에서 이동하기</h2>
                <p className="app-note">
                  아바타를 클릭하면 해당 사용자를 바로 선택할 수 있습니다.
                </p>
              </div>
            </div>
            <SpaceGame
              playerLabel={currentUser?.nickname || '나'}
              spaceType={space.type}
              onPlayerMove={sendUserMove}
              onParticipantSelect={selectParticipant}
              remoteEvent={remoteEvent}
            />

            {space?.type === 'STUDY' ? (
              <section className="space-study-board">
                <div className="space-stage-header">
                  <div>
                    <h2>현재 스터디 모집</h2>
                    <p className="app-note">
                      같은 공간 채팅에 올라온 스터디 모집 메시지를 카드로 정리해서 보여줍니다.
                    </p>
                  </div>
                </div>

                {studyRecruitments.length === 0 ? (
                  <p className="app-note">아직 올라온 스터디 모집이 없습니다.</p>
                ) : (
                  <ul className="space-study-list">
                    {studyRecruitments.map((recruitment) => (
                      <li key={recruitment.id} className="space-study-card">
                        <div className="space-study-card__meta">
                          <strong>{recruitment.topic}</strong>
                          <span>
                            {recruitment.isMine ? '내 모집' : recruitment.nickname} ·{' '}
                            {formatChatTimestamp(recruitment.timestamp)}
                          </span>
                        </div>
                        <p>
                          {recruitment.note || '추가 메모 없이 바로 대화를 시작할 수 있습니다.'}
                        </p>
                        <div className="space-selected-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => handleJoinStudyRecruitment(recruitment)}
                          >
                            참여 의사 보내기
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            <section className="lobby-chat-panel">
              <div className="lobby-chat-header">
                <div>
                  <h3>{spaceDefinition.label} 채팅</h3>
                  <p className="app-note">
                    이 공간에 접속한 사용자끼리만 메시지가 공유됩니다.
                  </p>
                </div>
              </div>

              <div className="lobby-chat-messages">
                {chatMessages.length === 0 ? (
                  <p className="app-note">아직 채팅 메시지가 없습니다.</p>
                ) : (
                  chatMessages.map((message) => (
                    <article
                      key={message.id}
                      className={`chat-message ${message.isMine ? 'chat-message--mine' : ''}`}
                    >
                      <span className="chat-message__meta">
                        {message.isMine ? '나' : message.nickname}
                      </span>
                      <p>{message.content}</p>
                    </article>
                  ))
                )}
              </div>

              <form className="lobby-chat-form" onSubmit={handleChatSubmit}>
                <input
                  ref={chatInputRef}
                  type="text"
                  className="app-input"
                  placeholder="메시지를 입력하세요"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                />
                <button type="submit" className="primary-button">
                  전송
                </button>
              </form>
            </section>
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}
