import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { getMe } from '../api/auth';
import { createMentoringRequest } from '../api/mentoring';
import { createReservation } from '../api/reservations';
import { getSpace, getSpaces } from '../api/spaces';
import {
  createStudySession,
  getStudySessionsBySpace,
  joinStudySession,
} from '../api/study';
import AppLayout from '../components/AppLayout';
import AvatarPreview from '../components/AvatarPreview';
import SpaceGame from '../components/SpaceGame';
import { AVATAR_PRESETS, getAvatarPreset } from '../lib/avatarPresets';
import {
  getSelectedAvatarPresetId,
  hasCompletedAvatarOnboarding,
  markAvatarOnboardingComplete,
  setSelectedAvatarPresetId,
} from '../lib/avatarSelectionStorage';
import { getLobbyZoneDefinition } from '../lib/lobbyZones';
import { getPrimarySpace, resolvePrimarySpacePath } from '../lib/primarySpaceNavigation';
import { useLobbyRealtime } from '../lib/useLobbyRealtime';
import { useAuthStore } from '../store/authStore';

const STUDY_RECRUIT_PREFIX = '[스터디 모집]';
const SPACE_NAVIGATION_ORDER = ['MAIN', 'STUDY', 'MENTORING'];

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

  if (status === 'reconnecting') {
    return '재연결 중';
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

function formatStudySessionStatus(status) {
  if (status === 'ACTIVE') {
    return '진행 중';
  }

  if (status === 'COMPLETED') {
    return '종료됨';
  }

  return status || '알 수 없음';
}

function formatStudyParticipantCount(count) {
  if (!Number.isFinite(count)) {
    return '참가자 수 없음';
  }

  return `${count}명 참여 중`;
}

function getSpaceGuideContent(spaceType, selectedParticipant, joinedStudySessionCount) {
  if (spaceType === 'STUDY') {
    return {
      eyebrow: 'Study Flow',
      title: '스터디 라운지에서는 모집과 합류가 핵심입니다.',
      summary: '주제를 올리고, 현재 열려 있는 세션에 참여하고, 채팅으로 함께할 사람을 모으는 흐름이 가장 중요합니다.',
      steps: [
        '스터디 주제를 적고 세션을 먼저 생성합니다.',
        joinedStudySessionCount > 0
          ? '이미 참여 중인 세션이 있으면 바로 입장해 이어서 진행할 수 있습니다.'
          : '현재 열린 세션 목록을 확인해 바로 참여할 수 있습니다.',
        '공간 채팅으로 모집 메시지를 남겨 주변 사용자와 연결합니다.',
      ],
    };
  }

  if (spaceType === 'MENTORING') {
    return {
      eyebrow: 'Mentoring Flow',
      title: '멘토링 존에서는 상대 선택 후 요청 또는 예약으로 이어집니다.',
      summary: '지금 공간에 있는 사용자를 먼저 선택하고, 짧은 대화 뒤 요청이나 예약을 보내는 흐름이 가장 자연스럽습니다.',
      steps: [
        selectedParticipant
          ? `${selectedParticipant.label}님을 선택한 상태입니다. 바로 요청이나 예약을 보낼 수 있습니다.`
          : '참가자 목록에서 한 명을 선택해 상호작용 대상을 먼저 정합니다.',
        '빠른 멘토링 요청으로 즉시 대화를 시작할 수 있습니다.',
        '시간을 맞춰 진행하려면 예약 제안으로 후속 일정을 만듭니다.',
      ],
    };
  }

  return {
    eyebrow: 'Main Plaza Flow',
    title: '메인광장은 다음 활동을 고르는 출발점입니다.',
    summary: '주변 사용자를 만나고, 스터디 라운지나 멘토링 존으로 이동하고, 허브에서 후속 활동을 관리하는 흐름으로 이어집니다.',
    steps: [
      '다른 참가자를 클릭해 바로 대화나 상호작용을 시작합니다.',
      '문 앞으로 이동해 Space 또는 Enter로 다른 공간으로 넘어갈 수 있습니다.',
      '허브에서 예약, 세션 기록, 피드백 같은 후속 작업을 관리합니다.',
    ],
  };
}

export default function SpacePage() {
  const { spaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [space, setSpace] = useState(null);
  const [spaceDirectory, setSpaceDirectory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [avatarNotice, setAvatarNotice] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState(AVATAR_PRESETS[0].id);
  const [showAvatarOnboarding, setShowAvatarOnboarding] = useState(false);
  const [hasCompletedAvatarSetup, setHasCompletedAvatarSetup] = useState(false);
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
  const [studyStatus, setStudyStatus] = useState('idle');
  const [studyNotice, setStudyNotice] = useState('');
  const [studyError, setStudyError] = useState('');
  const [studySessions, setStudySessions] = useState([]);
  const [studySessionsStatus, setStudySessionsStatus] = useState('idle');
  const [studySessionsError, setStudySessionsError] = useState('');
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const avatarPresetId = selectedAvatarId;
  const spawnFromSpaceType =
    typeof location.state?.entryFromSpaceType === 'string'
      ? location.state.entryFromSpaceType
      : null;
  const chatInputRef = useRef(null);
  const studyTopicInputRef = useRef(null);
  const participantSectionRef = useRef(null);
  const studyComposerRef = useRef(null);
  const mentoringRequestRef = useRef(null);
  const chatPanelRef = useRef(null);
  const {
    connectionStatus,
    lastError,
    remoteEvent,
    remoteUsers,
    chatMessages,
    reconnectAttempt,
    sendChatMessage,
    sendUserMove,
  } = useLobbyRealtime({
    enabled: !isLoading && !errorMessage && Boolean(currentUser) && Boolean(space),
    userId: currentUser?.id,
    nickname: currentUser?.nickname,
    spaceId: space?.id ?? null,
    avatarPresetId,
  });

  const selectedParticipant = useMemo(
    () => remoteUsers.find((user) => String(user.userId) === String(selectedParticipantId)) || null,
    [remoteUsers, selectedParticipantId]
  );
  const spaceDefinition = getLobbyZoneDefinition(space?.type);
  const arrivalDefinition = spawnFromSpaceType ? getLobbyZoneDefinition(spawnFromSpaceType) : null;
  const currentAvatarPreset = getAvatarPreset(selectedAvatarId);
  const joinedStudySessions = useMemo(
    () => studySessions.filter((studySession) => studySession.joined),
    [studySessions]
  );
  const guideContent = useMemo(
    () => getSpaceGuideContent(space?.type, selectedParticipant, joinedStudySessions.length),
    [joinedStudySessions.length, selectedParticipant, space?.type]
  );
  const primarySpace = useMemo(() => getPrimarySpace(spaceDirectory), [spaceDirectory]);
  const connectedSpaces = useMemo(
    () =>
      SPACE_NAVIGATION_ORDER.map((spaceType) =>
        spaceType === space?.type
          ? null
          : spaceDirectory.find((candidateSpace) => candidateSpace.type === spaceType) || null
      ).filter(Boolean),
    [space?.type, spaceDirectory]
  );

  useEffect(() => {
    if (!currentUser?.id) {
      setSelectedAvatarId(AVATAR_PRESETS[0].id);
      setHasCompletedAvatarSetup(false);
      setShowAvatarOnboarding(false);
      return;
    }

    const didCompleteAvatarSetup = hasCompletedAvatarOnboarding(currentUser.id);

    setSelectedAvatarId(getSelectedAvatarPresetId(currentUser.id));
    setHasCompletedAvatarSetup(didCompleteAvatarSetup);

    if (didCompleteAvatarSetup) {
      setShowAvatarOnboarding(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id || !space?.type || hasCompletedAvatarOnboarding(currentUser.id)) {
      return;
    }

    setShowAvatarOnboarding(true);
  }, [currentUser?.id, space?.type]);

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
        const [meResponse, spaceResponse, spacesResponse] = await Promise.all([
          getMe(),
          getSpace(Number(spaceId)),
          getSpaces(),
        ]);

        if (!isMounted) {
          return;
        }

        setCurrentUser(meResponse);
        setSpace(spaceResponse);
        setSpaceDirectory(Array.isArray(spacesResponse) ? spacesResponse : []);
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

  useEffect(() => {
    let isMounted = true;

    async function loadStudySessions() {
      if (!space?.id || space.type !== 'STUDY') {
        if (isMounted) {
          setStudySessions([]);
          setStudySessionsStatus('idle');
          setStudySessionsError('');
        }
        return;
      }

      setStudySessionsStatus('loading');
      setStudySessionsError('');

      try {
        const response = await getStudySessionsBySpace(space.id);

        if (!isMounted) {
          return;
        }

        setStudySessions(response);
        setStudySessionsStatus('loaded');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStudySessionsStatus('error');
        setStudySessionsError(
          error?.response?.data?.message || error.message || '스터디 세션 목록을 불러오지 못했습니다.'
        );
      }
    }

    loadStudySessions();

    return () => {
      isMounted = false;
    };
  }, [space?.id, space?.type]);

  useEffect(() => {
    if (!space?.id || space.type !== 'STUDY') {
      return undefined;
    }

    let isCancelled = false;

    const syncStudySessions = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      try {
        const response = await getStudySessionsBySpace(space.id);

        if (isCancelled) {
          return;
        }

        setStudySessions(response);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        if (error?.response?.status === 401) {
          clearAuth();
          navigate('/login', { replace: true });
        }
      }
    };

    const intervalId = window.setInterval(syncStudySessions, 7000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [clearAuth, navigate, space?.id, space?.type]);

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

  const handleCreateStudySession = async (event) => {
    event.preventDefault();

    if (!studyTopic.trim()) {
      setStudyError('스터디 주제를 입력해 주세요.');
      setStudyNotice('');
      return;
    }

    if (!space?.id) {
      setStudyError('스터디 공간 정보가 아직 준비되지 않았습니다.');
      setStudyNotice('');
      return;
    }

    setStudyStatus('saving');
    setStudyNotice('');
    setStudyError('');

    try {
      const createdStudySession = await createStudySession({
        spaceId: Number(space.id),
        title: studyTopic.trim(),
        description: studyNote.trim(),
      });

      setStudySessions((previousSessions) => [
        createdStudySession,
        ...previousSessions.filter((studySession) => studySession.id !== createdStudySession.id),
      ]);

      const didBroadcast = sendChatMessage(buildStudyRecruitmentMessage(studyTopic, studyNote));

      setStudyTopic('');
      setStudyNote('');
      setStudyStatus('saved');
      setStudyError('');
      setStudyNotice(
        didBroadcast
          ? '스터디 세션을 만들고 공간 채팅에도 모집 메시지를 남겼습니다.'
          : '스터디 세션을 만들었습니다. 현재 스터디 목록에서 바로 입장할 수 있습니다.'
      );
    } catch (error) {
      setStudyStatus('error');
      setStudyError(
        error?.response?.data?.message || error.message || '스터디 세션 생성에 실패했습니다.'
      );
    }
  };

  const handleJoinStudySession = async (studySession) => {
    if (!studySession?.id) {
      return;
    }

    try {
      const joinedStudySession = await joinStudySession(studySession.id);
      setStudySessions((previousSessions) =>
        previousSessions.map((currentSession) =>
          currentSession.id === joinedStudySession.id ? joinedStudySession : currentSession
        )
      );
      navigate(`/study/sessions/${joinedStudySession.id}`, {
        state: { studySession: joinedStudySession },
      });
    } catch (error) {
      setStudyError(
        error?.response?.data?.message || error.message || '스터디 세션 참가에 실패했습니다.'
      );
      setStudyNotice('');
    }
  };

  const handleOpenStudySession = (studySession) => {
    if (!studySession?.id) {
      return;
    }

    navigate(`/study/sessions/${studySession.id}`, {
      state: { studySession },
    });
  };

  const handleOpenAvatarOnboarding = () => {
    setAvatarNotice('');
    setShowAvatarOnboarding(true);
  };

  const handleCloseAvatarOnboarding = () => {
    if (!hasCompletedAvatarSetup) {
      return;
    }

    setShowAvatarOnboarding(false);
  };

  const handleSelectAvatarPreset = (presetId) => {
    setSelectedAvatarId(getAvatarPreset(presetId).id);
  };

  const handleSaveAvatarSelection = () => {
    if (!currentUser?.id) {
      setShowAvatarOnboarding(false);
      return;
    }

    const nextPresetId = setSelectedAvatarPresetId(currentUser.id, selectedAvatarId);

    markAvatarOnboardingComplete(currentUser.id);
    setSelectedAvatarId(nextPresetId);
    setHasCompletedAvatarSetup(true);
    setShowAvatarOnboarding(false);
    setAvatarNotice(`${getAvatarPreset(nextPresetId).name} 아바타로 입장 설정을 저장했습니다.`);
  };

  const handleMoveToSpace = (targetSpace) => {
    if (!targetSpace?.id) {
      return;
    }

    navigate(`/spaces/${targetSpace.id}`, {
      state: {
        space: targetSpace,
        entryFromSpaceType: space?.type ?? null,
      },
    });
  };

  const handleSpacePortalEnter = (targetSpaceType) => {
    const targetSpace =
      spaceDirectory.find((candidateSpace) => candidateSpace.type === targetSpaceType) || null;

    if (!targetSpace) {
      setErrorMessage('이동할 공간 정보를 찾지 못했습니다.');
      return;
    }

    handleMoveToSpace(targetSpace);
  };

  const scrollToSection = (sectionRef) => {
    sectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleOpenStudyComposer = () => {
    scrollToSection(studyComposerRef);
    studyTopicInputRef.current?.focus();
  };

  const handleOpenMentoringComposer = () => {
    scrollToSection(mentoringRequestRef);
  };

  const handleOpenParticipantList = () => {
    scrollToSection(participantSectionRef);
  };

  const handleOpenChatPanel = () => {
    scrollToSection(chatPanelRef);
    chatInputRef.current?.focus();
  };

  const handleReturnToPrimarySpace = async () => {
    if (primarySpace?.id) {
      handleMoveToSpace(primarySpace);
      return;
    }

    navigate(await resolvePrimarySpacePath());
  };

  return (
    <AppLayout
      eyebrow="메타버스 공간"
      title={spaceDefinition.label}
      description={spaceDefinition.helperText}
      panelClassName="app-panel--wide"
    >
      <div className="space-page-actions">
        {!isLoading && !errorMessage && space?.type !== 'MAIN' ? (
          <button type="button" className="secondary-button" onClick={handleReturnToPrimarySpace}>
            메인광장으로 돌아가기
          </button>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          onClick={handleOpenAvatarOnboarding}
          disabled={!currentUser?.id}
        >
          아바타 {hasCompletedAvatarSetup ? '변경' : '선택'}
        </button>
        <button type="button" className="secondary-button" onClick={() => navigate('/hub')}>
          활동 허브 열기
        </button>
      </div>

      {avatarNotice ? <p className="app-success">{avatarNotice}</p> : null}
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
              {connectionStatus === 'reconnecting' ? (
                <p className="app-note">자동 재연결 시도: {Math.max(reconnectAttempt, 1)}회</p>
              ) : null}
              {lastError ? <p className="app-error">{lastError}</p> : null}
            </div>

            <div className="lobby-info-card">
              <h2>내 아바타</h2>
              <div className="space-avatar-summary">
                <AvatarPreview presetId={selectedAvatarId} size="medium" highlighted />
                <div>
                  <strong>{currentAvatarPreset.name}</strong>
                  <span>{currentAvatarPreset.summary}</span>
                  <p className="app-note">
                    현재 선택한 아바타는 공간 이동과 실시간 표시에도 그대로 사용됩니다.
                  </p>
                </div>
              </div>
              <div className="space-selected-actions">
                <button type="button" className="secondary-button" onClick={handleOpenAvatarOnboarding}>
                  {hasCompletedAvatarSetup ? '아바타 다시 고르기' : '아바타 설정 마치기'}
                </button>
              </div>
            </div>

            {connectedSpaces.length > 0 ? (
              <div className="lobby-info-card">
                <h2>연결된 공간 이동</h2>
                <p className="app-note">
                  {space?.type === 'MAIN'
                    ? '메인 광장에서 다음 목적지를 골라 스터디 라운지나 멘토링 존으로 바로 이동할 수 있습니다.'
                    : '현재 공간에서 다른 공간으로 바로 넘어갈 수 있습니다.'}
                </p>
                <ul className="space-navigation-list">
                  {connectedSpaces.map((targetSpace) => {
                    const targetDefinition = getLobbyZoneDefinition(targetSpace.type);

                    return (
                      <li key={targetSpace.id} className="space-navigation-card">
                        <div>
                          <strong>{targetDefinition.label}</strong>
                          <p>{targetDefinition.helperText}</p>
                        </div>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleMoveToSpace(targetSpace)}
                        >
                          {targetDefinition.label}으로 이동
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="lobby-info-card" ref={participantSectionRef}>
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
              <div className="lobby-info-card" ref={studyComposerRef}>
                <h2>스터디 모집 게시</h2>
                <form className="mentoring-form" onSubmit={handleCreateStudySession}>
                  <label className="app-field">
                    <span>스터디 주제</span>
                    <input
                      ref={studyTopicInputRef}
                      type="text"
                      className="app-input"
                      value={studyTopic}
                      onChange={(event) => setStudyTopic(event.target.value)}
                      placeholder="예: React 상태관리, 코딩테스트, 포트폴리오 리뷰"
                      disabled={studyStatus === 'saving'}
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
                      disabled={studyStatus === 'saving'}
                    />
                  </label>
                  <button type="submit" className="primary-button">
                    {studyStatus === 'saving' ? '스터디 세션 생성 중...' : '스터디 세션 만들기'}
                  </button>
                </form>
                {studyNotice ? <p className="app-success">{studyNotice}</p> : null}
                {studyError ? <p className="app-error">{studyError}</p> : null}
                {joinedStudySessions.length > 0 ? (
                  <div className="space-selected-actions">
                    {joinedStudySessions.slice(0, 2).map((studySession) => (
                      <button
                        key={studySession.id}
                        type="button"
                        className="secondary-button"
                        onClick={() => handleOpenStudySession(studySession)}
                      >
                        {studySession.title} 입장
                      </button>
                    ))}
                  </div>
                ) : null}
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

            <div className="lobby-info-card" ref={mentoringRequestRef}>
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
            {arrivalDefinition ? (
              <div className="space-arrival-banner">
                <span className="space-arrival-banner__eyebrow">Arrived From</span>
                <strong>{arrivalDefinition.label}에서 이동해 현재 공간에 도착했습니다.</strong>
                <p>{spaceDefinition.label} 안에서 바로 다음 액션을 이어서 진행할 수 있습니다.</p>
              </div>
            ) : null}

            <section className="space-guide-panel">
              <div className="space-stage-header">
                <div>
                  <span className="landing-section-eyebrow">{guideContent.eyebrow}</span>
                  <h2>{guideContent.title}</h2>
                  <p className="app-note">{guideContent.summary}</p>
                </div>
                <div className="space-guide-actions">
                  {space?.type === 'MAIN' ? (
                    <>
                      {connectedSpaces
                        .filter((targetSpace) => targetSpace.type === 'STUDY')
                        .slice(0, 1)
                        .map((targetSpace) => (
                          <button
                            key={targetSpace.id}
                            type="button"
                            className="primary-button"
                            onClick={() => handleMoveToSpace(targetSpace)}
                          >
                            스터디 라운지로 이동
                          </button>
                        ))}
                      {connectedSpaces
                        .filter((targetSpace) => targetSpace.type === 'MENTORING')
                        .slice(0, 1)
                        .map((targetSpace) => (
                          <button
                            key={targetSpace.id}
                            type="button"
                            className="secondary-button"
                            onClick={() => handleMoveToSpace(targetSpace)}
                          >
                            멘토링 존으로 이동
                          </button>
                        ))}
                    </>
                  ) : null}

                  {space?.type === 'STUDY' ? (
                    <>
                      <button type="button" className="primary-button" onClick={handleOpenStudyComposer}>
                        스터디 모집 작성
                      </button>
                      {joinedStudySessions[0] ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleOpenStudySession(joinedStudySessions[0])}
                        >
                          참여 중 세션 열기
                        </button>
                      ) : (
                        <button type="button" className="secondary-button" onClick={handleOpenChatPanel}>
                          채팅으로 모집 시작
                        </button>
                      )}
                    </>
                  ) : null}

                  {space?.type === 'MENTORING' ? (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={selectedParticipant ? handleOpenMentoringComposer : handleOpenParticipantList}
                      >
                        {selectedParticipant ? '요청 작성 열기' : '참가자 먼저 선택'}
                      </button>
                      <button type="button" className="secondary-button" onClick={handleOpenChatPanel}>
                        채팅 시작하기
                      </button>
                    </>
                  ) : null}

                  <button type="button" className="secondary-button" onClick={() => navigate('/hub')}>
                    허브 열기
                  </button>
                </div>
              </div>

              <div className="space-guide-grid">
                {guideContent.steps.map((step, index) => (
                  <article key={step} className="space-guide-card">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>{step}</p>
                  </article>
                ))}
              </div>
            </section>

            <div className="space-stage-header">
              <div>
                <h2>{spaceDefinition.label} 안에서 이동하기</h2>
                <p className="app-note">
                  아바타를 클릭하면 사용자를 바로 선택할 수 있고, 문 앞으로 가서 Space 또는 Enter를 누르면 다른 공간으로 이동할 수 있습니다.
                </p>
              </div>
            </div>
            <SpaceGame
              playerLabel={currentUser?.nickname || '나'}
              spaceType={space.type}
              avatarPresetId={avatarPresetId}
              connectedSpaces={connectedSpaces}
              spawnFromSpaceType={spawnFromSpaceType}
              onPlayerMove={sendUserMove}
              onSpaceEnter={handleSpacePortalEnter}
              onParticipantSelect={selectParticipant}
              remoteEvent={remoteEvent}
            />

            {space?.type === 'STUDY' ? (
              <section className="space-study-board">
                <div className="space-stage-header">
                  <div>
                    <h2>현재 진행 중인 스터디 세션</h2>
                    <p className="app-note">
                      이 공간에서 생성된 실제 스터디 세션을 서버 상태 기준으로 보여주며, 몇 초 간격으로 새 목록을 동기화합니다.
                    </p>
                  </div>
                </div>

                {studySessionsStatus === 'loading' ? (
                  <p className="app-note">스터디 세션 목록을 불러오는 중입니다...</p>
                ) : studySessionsError ? (
                  <p className="app-error">{studySessionsError}</p>
                ) : studySessions.length === 0 ? (
                  <p className="app-note">아직 진행 중인 스터디 세션이 없습니다.</p>
                ) : (
                  <ul className="space-study-list">
                    {studySessions.map((studySession) => (
                      <li key={studySession.id} className="space-study-card">
                        <div className="space-study-card__meta">
                          <strong>{studySession.title}</strong>
                          <span>
                            {studySession.joined ? '참여 중' : studySession.hostLabel} ·{' '}
                            {formatChatTimestamp(studySession.createdAt)}
                          </span>
                        </div>
                        <p>{studySession.description || '설명 없이 바로 함께 공부를 시작할 수 있습니다.'}</p>
                        <div className="space-study-card__meta">
                          <span>{formatStudySessionStatus(studySession.status)}</span>
                          <span>{formatStudyParticipantCount(studySession.participantCount)}</span>
                        </div>
                        <div className="space-selected-actions">
                          {studySession.joined ? (
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => handleOpenStudySession(studySession)}
                            >
                              세션 입장
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => handleJoinStudySession(studySession)}
                            >
                              참여하기
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            <section className="lobby-chat-panel" ref={chatPanelRef}>
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

      {showAvatarOnboarding ? (
        <section
          className="space-avatar-onboarding"
          role="dialog"
          aria-modal="true"
          aria-labelledby="space-avatar-onboarding-title"
        >
          <div className="space-avatar-onboarding__backdrop" />
          <div className="space-avatar-onboarding__panel">
            <span className="landing-section-eyebrow">Avatar Setup</span>
            <h2 id="space-avatar-onboarding-title">
              {hasCompletedAvatarSetup
                ? '지금 사용할 아바타를 다시 골라 주세요.'
                : '메타버스에 들어가기 전 아바타를 먼저 정해 주세요.'}
            </h2>
            <p>
              별도 로비 없이 바로 공간에 입장하는 흐름으로 바꾸고 있으므로, 아바타 선택은
              여기서 한 번만 마치면 됩니다. 이후에도 언제든 다시 바꿀 수 있습니다.
            </p>

            <div className="space-avatar-onboarding__hero">
              <AvatarPreview presetId={selectedAvatarId} size="hero" highlighted />
              <div className="space-avatar-onboarding__hero-copy">
                <strong>{currentAvatarPreset.name}</strong>
                <span>{currentAvatarPreset.summary}</span>
                <p className="app-note">
                  현재 공간: {spaceDefinition.label} · 선택 저장 후 바로 이동과 실시간 표시가
                  반영됩니다.
                </p>
              </div>
            </div>

            <div className="space-avatar-onboarding__grid">
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = preset.id === selectedAvatarId;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`space-avatar-option ${isSelected ? 'space-avatar-option--selected' : ''}`}
                    onClick={() => handleSelectAvatarPreset(preset.id)}
                  >
                    <AvatarPreview presetId={preset.id} size="card" highlighted={isSelected} />
                    <strong>{preset.name}</strong>
                    <span>{preset.summary}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-avatar-onboarding__actions">
              {hasCompletedAvatarSetup ? (
                <button type="button" className="secondary-button" onClick={handleCloseAvatarOnboarding}>
                  취소
                </button>
              ) : null}
              <button type="button" className="primary-button" onClick={handleSaveAvatarSelection}>
                {hasCompletedAvatarSetup ? '변경 저장' : '이 아바타로 시작'}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </AppLayout>
  );
}
