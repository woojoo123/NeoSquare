import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getSpaces } from '../api/spaces';
import {
  createStudySession,
  getMyStudySessions,
  getOpenStudySessionsBySpace,
  startStudySession,
  joinStudySession,
} from '../api/study';
import AppLayout from '../components/AppLayout';
import { useAuthStore } from '../store/authStore';

const SPACE_ORDER = ['MAIN', 'STUDY', 'MENTORING'];
const MINIMUM_STUDY_PARTICIPANTS = 2;
const STUDY_STATUS_PRIORITY = {
  ACTIVE: 0,
  READY: 1,
  RECRUITING: 2,
  COMPLETED: 3,
};

function getOrderedSpaces(spaces) {
  function getOrder(spaceType) {
    const order = SPACE_ORDER.indexOf(spaceType);
    return order === -1 ? SPACE_ORDER.length : order;
  }

  return [...spaces].sort((left, right) => getOrder(left.type) - getOrder(right.type));
}

function formatStudySessionStatus(status) {
  if (status === 'RECRUITING') {
    return '모집 중';
  }

  if (status === 'READY') {
    return '시작 가능';
  }

  if (status === 'ACTIVE') {
    return '진행 중';
  }

  if (status === 'COMPLETED') {
    return '종료됨';
  }

  return status || '알 수 없음';
}

function formatDateTime(value) {
  if (!value) {
    return '시간 정보 없음';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mergeStudySessions(existingSessions, nextSession) {
  const filteredSessions = existingSessions.filter(
    (studySession) => String(studySession.id) !== String(nextSession.id)
  );

  return [nextSession, ...filteredSessions];
}

function removeStudySession(existingSessions, studySessionId) {
  return existingSessions.filter(
    (studySession) => String(studySession.id) !== String(studySessionId)
  );
}

function sortStudySessions(left, right) {
  const leftPriority = STUDY_STATUS_PRIORITY[left.status] ?? Number.MAX_SAFE_INTEGER;
  const rightPriority = STUDY_STATUS_PRIORITY[right.status] ?? Number.MAX_SAFE_INTEGER;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
  const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return Number(right.id || 0) - Number(left.id || 0);
}

export default function StudyHubPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const [spaces, setSpaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pageNotice, setPageNotice] = useState(location.state?.message || '');
  const [studyTopic, setStudyTopic] = useState('');
  const [studyNote, setStudyNote] = useState('');
  const [createStatus, setCreateStatus] = useState('idle');
  const [createError, setCreateError] = useState('');
  const [activeView, setActiveView] = useState(
    location.state?.highlightStudySessionId ? 'mine' : 'discover'
  );
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [openStudySessions, setOpenStudySessions] = useState([]);
  const [myStudySessions, setMyStudySessions] = useState([]);
  const [activeActionId, setActiveActionId] = useState(null);
  const [highlightStudySessionId, setHighlightStudySessionId] = useState(
    location.state?.highlightStudySessionId ?? null
  );

  useEffect(() => {
    if (location.state?.message) {
      setPageNotice(location.state.message);
    }

    if (location.state?.highlightStudySessionId) {
      setHighlightStudySessionId(location.state.highlightStudySessionId);
      setActiveView('mine');
    }
  }, [location.state?.highlightStudySessionId, location.state?.message]);

  const studySpace = useMemo(
    () => spaces.find((space) => space.type === 'STUDY') || null,
    [spaces]
  );

  async function loadStudyHub({ silent = false } = {}) {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage('');

    try {
      const spacesResponse = await getSpaces();
      const orderedSpaces = getOrderedSpaces(Array.isArray(spacesResponse) ? spacesResponse : []);
      const resolvedStudySpace = orderedSpaces.find((space) => space.type === 'STUDY') || null;

      setSpaces(orderedSpaces);

      const [mySessionsResponse, openSessionsResponse] = await Promise.all([
        getMyStudySessions(),
        resolvedStudySpace?.id
          ? getOpenStudySessionsBySpace(resolvedStudySpace.id)
          : Promise.resolve([]),
      ]);

      setMyStudySessions(Array.isArray(mySessionsResponse) ? mySessionsResponse : []);
      setOpenStudySessions(Array.isArray(openSessionsResponse) ? openSessionsResponse : []);
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || error.message || '스터디 정보를 불러오지 못했습니다.'
      );
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function runInitialLoad() {
      if (isCancelled) {
        return;
      }

      await loadStudyHub();
    }

    runInitialLoad();

    const intervalId = window.setInterval(() => {
      if (!isCancelled) {
        loadStudyHub({ silent: true });
      }
    }, 10000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const completedStudySessions = useMemo(
    () =>
      [...myStudySessions]
        .filter((studySession) => studySession.status === 'COMPLETED')
        .sort(sortStudySessions),
    [myStudySessions]
  );
  const myOpenStudySessions = useMemo(
    () =>
      [...myStudySessions]
        .filter((studySession) => studySession.status !== 'COMPLETED')
        .sort(sortStudySessions),
    [myStudySessions]
  );
  const recruitableStudySessions = useMemo(
    () => [...openStudySessions].filter((studySession) => !studySession.joined).sort(sortStudySessions),
    [openStudySessions]
  );

  function enterStudyMetaverse(studySession) {
    if (!studySpace?.id || !studySession?.id) {
      return;
    }

    navigate(`/spaces/${studySpace.id}`, {
      state: {
        openStudyDrawer: true,
        highlightStudySessionId: studySession.id,
        studyEntryMessage: `${studySession.title || '스터디'}에 입장했습니다.`,
      },
    });
  }

  async function handleCreateStudySession(event) {
    event.preventDefault();

    if (!studyTopic.trim()) {
      setCreateError('스터디 주제를 입력해 주세요.');
      setPageNotice('');
      return;
    }

    if (!studySpace?.id) {
      setCreateError('스터디 공간 정보를 찾지 못했습니다.');
      setPageNotice('');
      return;
    }

    setCreateStatus('saving');
    setCreateError('');
    setPageNotice('');

    try {
      const createdStudySession = await createStudySession({
        spaceId: Number(studySpace.id),
        title: studyTopic.trim(),
        description: studyNote.trim(),
      });

      setOpenStudySessions((currentSessions) =>
        mergeStudySessions(currentSessions, createdStudySession)
      );
      setMyStudySessions((currentSessions) =>
        mergeStudySessions(currentSessions, createdStudySession)
      );
      setHighlightStudySessionId(createdStudySession.id);
      setStudyTopic('');
      setStudyNote('');
      setCreateStatus('saved');
      setActiveView('mine');
      setIsCreatePanelOpen(false);
      setPageNotice('스터디를 만들었습니다.');
    } catch (error) {
      setCreateStatus('error');
      setCreateError(
        error?.response?.data?.message || error.message || '스터디 개설에 실패했습니다.'
      );
    }
  }

  async function handleJoinStudySession(studySession) {
    if (!studySession?.id) {
      return;
    }

    setActiveActionId(studySession.id);
    setErrorMessage('');
    setPageNotice('');

    try {
      const joinedStudySession = await joinStudySession(studySession.id);

      if (joinedStudySession.status === 'ACTIVE') {
        setOpenStudySessions((currentSessions) =>
          removeStudySession(currentSessions, joinedStudySession.id)
        );
      } else {
        setOpenStudySessions((currentSessions) =>
          currentSessions.map((currentSession) =>
            String(currentSession.id) === String(joinedStudySession.id)
              ? joinedStudySession
              : currentSession
          )
        );
      }

      setMyStudySessions((currentSessions) =>
        mergeStudySessions(currentSessions, joinedStudySession)
      );
      setActiveView('mine');
      setHighlightStudySessionId(joinedStudySession.id);
      setPageNotice('스터디에 참여했습니다.');
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || error.message || '스터디 참여에 실패했습니다.'
      );
    } finally {
      setActiveActionId(null);
    }
  }

  async function handleStartStudySession(studySession) {
    if (!studySession?.id) {
      return;
    }

    setActiveActionId(studySession.id);
    setErrorMessage('');
    setPageNotice('');

    try {
      const startedStudySession = await startStudySession(studySession.id);

      setOpenStudySessions((currentSessions) =>
        removeStudySession(currentSessions, startedStudySession.id)
      );
      setMyStudySessions((currentSessions) =>
        mergeStudySessions(currentSessions, startedStudySession)
      );
      setHighlightStudySessionId(startedStudySession.id);
      enterStudyMetaverse(startedStudySession);
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || error.message || '스터디 시작에 실패했습니다.'
      );
    } finally {
      setActiveActionId(null);
    }
  }

  function renderStudyCard(studySession, options = {}) {
    const isMine = options.isMine === true;
    const isHighlighted =
      String(studySession.id) === String(highlightStudySessionId);
    const isHost = isMine && String(studySession.hostId) === String(currentUser?.id);
    const needsMoreParticipants =
      Number(studySession.participantCount || 0) < MINIMUM_STUDY_PARTICIPANTS;
    const isActive = studySession.status === 'ACTIVE';
    const isCompleted = studySession.status === 'COMPLETED';
    const actionBusy = activeActionId === studySession.id;
    const canJoin =
      !isMine && !studySession.joined &&
      (studySession.status === 'RECRUITING' || studySession.status === 'READY');
    const canStart = isMine && isHost && studySession.status === 'READY';

    return (
      <article
        key={studySession.id}
        className={
          isHighlighted
            ? 'study-hub-session-card study-hub-session-card--highlighted'
            : 'study-hub-session-card'
        }
      >
        <div className="study-hub-session-card__header">
          <div>
            <strong>{studySession.title || '스터디'}</strong>
            <p>{studySession.description || '설명 없음'}</p>
          </div>
          <span className="session-meta-pill">{formatStudySessionStatus(studySession.status)}</span>
        </div>
        <div className="study-hub-session-card__meta">
          <span>{studySession.hostLabel || '호스트'}</span>
          <span>{studySession.participantCount || 0}명</span>
          <span>{formatDateTime(studySession.createdAt)}</span>
        </div>

        {isMine ? (
          <p className="app-note">
            {studySession.status === 'RECRUITING'
              ? `${MINIMUM_STUDY_PARTICIPANTS}명 이상 모이면 시작할 수 있습니다.`
              : studySession.status === 'READY'
                ? '호스트가 시작하면 메타버스로 입장할 수 있습니다.'
                : studySession.status === 'ACTIVE'
                  ? '메타버스에서 진행 중입니다.'
                  : '종료된 스터디입니다.'}
          </p>
        ) : needsMoreParticipants ? (
          <p className="app-note">
            시작 최소 인원: {MINIMUM_STUDY_PARTICIPANTS}명
          </p>
        ) : null}

        <div className="study-hub-actions">
          {canJoin ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => handleJoinStudySession(studySession)}
              disabled={actionBusy}
            >
              {actionBusy ? '참여 중...' : '참여하기'}
            </button>
          ) : null}

          {canStart ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => handleStartStudySession(studySession)}
              disabled={actionBusy}
            >
              {actionBusy ? '시작 중...' : '시작하고 입장'}
            </button>
          ) : null}

          {isMine && isActive ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => enterStudyMetaverse(studySession)}
            >
              메타버스 입장
            </button>
          ) : null}

          {isMine && studySession.status === 'READY' && !isHost ? (
            <button type="button" className="secondary-button" disabled>
              시작 대기
            </button>
          ) : null}

          {isMine && isCompleted ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                navigate(`/study/sessions/${studySession.id}`, {
                  state: { studySession },
                })
              }
            >
              기록 보기
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <AppLayout
      eyebrow="스터디"
      title="스터디"
      description="개설은 여기서, 시작되면 메타버스로 들어갑니다."
      panelClassName="app-panel--wide"
    >
      <section className="study-hub-page">
        <section className="study-hub-toolbar">
          <div className="study-hub-view-switch" role="tablist" aria-label="스터디 화면 전환">
            <button
              type="button"
              className={
                activeView === 'discover'
                  ? 'study-hub-view-button study-hub-view-button--active'
                  : 'study-hub-view-button'
              }
              onClick={() => setActiveView('discover')}
            >
              참여할 스터디
              <span>{recruitableStudySessions.length}</span>
            </button>
            <button
              type="button"
              className={
                activeView === 'mine'
                  ? 'study-hub-view-button study-hub-view-button--active'
                  : 'study-hub-view-button'
              }
              onClick={() => setActiveView('mine')}
            >
              내 스터디
              <span>{myOpenStudySessions.length}</span>
            </button>
          </div>

          <button
            type="button"
            className={isCreatePanelOpen ? 'secondary-button' : 'primary-button'}
            onClick={() => {
              setIsCreatePanelOpen((currentValue) => !currentValue);
              setCreateError('');
              setPageNotice('');
            }}
          >
            {isCreatePanelOpen ? '개설 닫기' : '스터디 개설'}
          </button>
        </section>

        {pageNotice ? <p className="app-success">{pageNotice}</p> : null}
        {errorMessage ? <p className="app-error">{errorMessage}</p> : null}

        {isCreatePanelOpen ? (
          <article className="study-hub-card">
            <span className="study-hub-card__eyebrow">스터디 개설</span>
            <h2>새 스터디 만들기</h2>
            <form className="mentoring-form" onSubmit={handleCreateStudySession}>
              <label className="app-field">
                <span>스터디 주제</span>
                <input
                  type="text"
                  className="app-input"
                  value={studyTopic}
                  onChange={(event) => setStudyTopic(event.target.value)}
                  placeholder="예: React 상태관리, 자료구조"
                  disabled={createStatus === 'saving'}
                />
              </label>
              <label className="app-field">
                <span>설명</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={studyNote}
                  onChange={(event) => setStudyNote(event.target.value)}
                  rows={4}
                  placeholder="스터디 내용을 입력하세요."
                  disabled={createStatus === 'saving'}
                />
              </label>
              <div className="study-hub-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={createStatus === 'saving'}
                >
                  {createStatus === 'saving' ? '개설 중...' : '스터디 개설'}
                </button>
              </div>
            </form>
            {createError ? <p className="app-error">{createError}</p> : null}
          </article>
        ) : null}

        <article className="study-hub-card study-hub-card--primary">
          <div className="study-hub-section-header">
            <div>
              <span className="study-hub-card__eyebrow">
                {activeView === 'discover' ? '모집 중' : '내 스터디'}
              </span>
              <h2>{activeView === 'discover' ? '참여할 스터디' : '지금 진행할 스터디'}</h2>
            </div>
            {isRefreshing ? <span className="study-hub-status-note">업데이트 중</span> : null}
          </div>

          {isLoading ? (
            <div className="study-hub-empty">
              <strong>스터디 목록을 불러오는 중입니다.</strong>
            </div>
          ) : activeView === 'discover' ? (
            recruitableStudySessions.length === 0 ? (
              <div className="study-hub-empty">
                <strong>참여할 스터디가 없습니다.</strong>
                <p>필요하면 새 스터디를 열어 보세요.</p>
              </div>
            ) : (
              <div className="study-hub-session-list">
                {recruitableStudySessions.map((studySession) => renderStudyCard(studySession))}
              </div>
            )
          ) : myOpenStudySessions.length === 0 ? (
            <div className="study-hub-empty">
              <strong>진행할 스터디가 없습니다.</strong>
              <p>참여하거나 직접 만들어 보세요.</p>
            </div>
          ) : (
            <div className="study-hub-session-list">
              {myOpenStudySessions.map((studySession) =>
                renderStudyCard(studySession, { isMine: true })
              )}
            </div>
          )}
        </article>

        {activeView === 'mine' && completedStudySessions.length > 0 ? (
          <article className="study-hub-card">
            <div className="study-hub-section-header">
              <div>
                <span className="study-hub-card__eyebrow">완료</span>
                <h2>이전 스터디 기록</h2>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowCompleted((currentValue) => !currentValue)}
              >
                {showCompleted ? '접기' : `${completedStudySessions.length}개 보기`}
              </button>
            </div>

            {showCompleted ? (
              <div className="study-hub-session-list">
                {completedStudySessions.slice(0, 5).map((studySession) =>
                  renderStudyCard(studySession, { isMine: true })
                )}
              </div>
            ) : (
              <div className="study-hub-empty">
                <strong>완료한 스터디는 필요할 때만 펼쳐서 확인합니다.</strong>
              </div>
            )}
          </article>
        ) : null}
      </section>
    </AppLayout>
  );
}
