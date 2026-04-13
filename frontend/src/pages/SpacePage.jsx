import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { getMe, logout } from '../api/auth';
import { createMentoringRequest } from '../api/mentoring';
import { createReservation } from '../api/reservations';
import { getSpace, getSpaces } from '../api/spaces';
import {
  createStudySession,
  getStudySessionsBySpace,
  joinStudySession,
} from '../api/study';
import AvatarPreview from '../components/AvatarPreview';
import SpaceGame from '../components/SpaceGame';
import { AVATAR_PRESETS } from '../lib/avatarPresets';
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

function getLabelInitial(label) {
  const trimmedLabel = label?.trim();

  if (!trimmedLabel) {
    return '?';
  }

  return trimmedLabel.charAt(0).toUpperCase();
}

function getSpaceGuideContent(spaceType, selectedParticipant, joinedStudySessionCount) {
  if (spaceType === 'STUDY') {
    return {
      eyebrow: '스터디 흐름',
      title: '가이드',
      summary: '채팅이나 스터디 탭에서 바로 같이 공부할 흐름을 열 수 있습니다.',
      steps: [
        '스터디 주제를 적고 세션을 만듭니다.',
        joinedStudySessionCount > 0
          ? '참여 중인 세션이 있으면 바로 입장해 이어서 진행합니다.'
          : '현재 열린 세션 목록을 보고 바로 참여합니다.',
        '필요하면 채팅으로 모집 메시지를 남깁니다.',
      ],
    };
  }

  if (spaceType === 'MENTORING') {
    return {
      eyebrow: '멘토링 흐름',
      title: '가이드',
      summary: '상대를 선택한 뒤 요청이나 예약을 바로 보낼 수 있습니다.',
      steps: [
        selectedParticipant
          ? `${selectedParticipant.label}님을 선택했습니다. 바로 요청이나 예약을 보낼 수 있습니다.`
          : '참가자 목록에서 대화할 상대를 먼저 고릅니다.',
        '빠른 멘토링 요청으로 대화를 시작합니다.',
        '시간을 맞춰 진행하려면 예약 제안을 보냅니다.',
      ],
    };
  }

  return {
    eyebrow: '메인광장 흐름',
    title: '가이드',
    summary: '방향키로 움직이고 문 앞에서 위쪽 방향키로 입장합니다.',
    steps: [
      '주변 참가자를 확인합니다.',
      '문 앞에서 위쪽 방향키로 입장합니다.',
      '필요하면 채팅이나 참가자 탭을 확인합니다.',
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
  const [activeDrawer, setActiveDrawer] = useState('guide');
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false);
  const [isSupportPanelOpen, setIsSupportPanelOpen] = useState(false);
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
  const utilityMenuRef = useRef(null);
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
  const currentAvatarOrder = useMemo(() => {
    const resolvedIndex = AVATAR_PRESETS.findIndex((preset) => preset.id === selectedAvatarId);
    return resolvedIndex >= 0 ? resolvedIndex + 1 : 1;
  }, [selectedAvatarId]);
  const worldParticipantCount = remoteUsers.length + 1;
  const visiblePresenceUsers = useMemo(() => remoteUsers.slice(0, 5), [remoteUsers]);
  const hiddenPresenceCount = Math.max(remoteUsers.length - visiblePresenceUsers.length, 0);
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
  const drawerTabs = useMemo(() => {
    const tabs = [
      { id: 'guide', label: '가이드' },
      { id: 'people', label: '참가자' },
      { id: 'chat', label: '채팅' },
    ];

    if (space?.type === 'STUDY') {
      tabs.push({ id: 'study', label: '스터디' });
    }

    if (space?.type === 'MENTORING') {
      tabs.push({ id: 'mentoring', label: '멘토링' });
    }

    return tabs;
  }, [space?.type]);

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
    if (!space?.type) {
      return;
    }

    if (space.type === 'STUDY') {
      setActiveDrawer('study');
      return;
    }

    if (space.type === 'MENTORING') {
      setActiveDrawer('mentoring');
      return;
    }

    setActiveDrawer('guide');
  }, [space?.id, space?.type]);

  useEffect(() => {
    if (!drawerTabs.some((tab) => tab.id === activeDrawer)) {
      setActiveDrawer(drawerTabs[0]?.id || 'guide');
    }
  }, [activeDrawer, drawerTabs]);

  useEffect(() => {
    if (!isUtilityMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (utilityMenuRef.current?.contains(event.target)) {
        return;
      }

      setIsUtilityMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isUtilityMenuOpen]);

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
    setIsSupportPanelOpen(true);
    setActiveDrawer(space?.type === 'MENTORING' ? 'mentoring' : 'people');
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

    setActiveDrawer('chat');
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

  const handleOpenStudyComposer = () => {
    setIsSupportPanelOpen(true);
    setActiveDrawer('study');
    window.requestAnimationFrame(() => {
      studyTopicInputRef.current?.focus();
    });
  };

  const handleOpenMentoringComposer = () => {
    setIsSupportPanelOpen(true);
    setActiveDrawer('mentoring');
  };

  const handleOpenParticipantList = () => {
    setIsSupportPanelOpen(true);
    setActiveDrawer('people');
  };

  const handleOpenChatPanel = () => {
    setIsSupportPanelOpen(true);
    setActiveDrawer('chat');
    window.requestAnimationFrame(() => {
      chatInputRef.current?.focus();
    });
  };

  const handleReturnToPrimarySpace = async () => {
    if (primarySpace?.id) {
      handleMoveToSpace(primarySpace);
      return;
    }

    navigate(await resolvePrimarySpacePath());
  };

  const handleLogout = async () => {
    setIsUtilityMenuOpen(false);
    try {
      await logout();
    } catch {
      // 서버 로그아웃 실패와 무관하게 로컬 세션은 정리한다.
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
    }
  };

  const handleToggleUtilityMenu = () => {
    setIsUtilityMenuOpen((currentValue) => !currentValue);
  };

  const handleToggleSupportDrawer = (drawerId) => {
    if (isSupportPanelOpen && activeDrawer === drawerId) {
      setIsSupportPanelOpen(false);
      return;
    }

    setActiveDrawer(drawerId);
    setIsSupportPanelOpen(true);
  };

  const handleOpenAvatarMenuAction = () => {
    setIsUtilityMenuOpen(false);
    handleOpenAvatarOnboarding();
  };

  const handleOpenHubMenuAction = () => {
    setIsUtilityMenuOpen(false);
    navigate('/hub');
  };

  const handleReturnToPrimarySpaceMenuAction = async () => {
    setIsUtilityMenuOpen(false);
    await handleReturnToPrimarySpace();
  };

  const handleCloseSupportPanel = () => {
    setIsSupportPanelOpen(false);
  };

  const activeDrawerLabel =
    drawerTabs.find((tab) => tab.id === activeDrawer)?.label || '가이드';

  const activeDrawerDescription =
    activeDrawer === 'guide'
      ? '움직임과 입장 방법을 빠르게 확인합니다.'
      : activeDrawer === 'people'
      ? '현재 공간에 함께 있는 참가자를 확인합니다.'
      : activeDrawer === 'chat'
        ? '현재 공간에 있는 사람들과 바로 대화합니다.'
        : activeDrawer === 'study'
            ? '스터디 세션을 열거나 참여합니다.'
            : activeDrawer === 'mentoring'
              ? '요청이나 예약으로 멘토링을 이어갑니다.'
              : '현재 공간에서 필요한 도구를 확인합니다.';

  const renderDrawerContent = () => {
    if (activeDrawer === 'people') {
      return (
        <div className="space-hud-stack">
          <section className="space-hud-card">
            <h3>선택한 참가자</h3>
            {!selectedParticipant ? (
              <p className="app-note">
                월드에서 다른 아바타를 클릭하거나 아래 목록에서 한 명을 선택하면 바로 상호작용할 수 있습니다.
              </p>
            ) : (
              <>
                <strong>{selectedParticipant.label}</strong>
                <p className="app-note">지금 같은 공간에 있습니다. 바로 말을 걸거나 요청을 시작할 수 있습니다.</p>
                <div className="space-selected-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleMentionParticipant}
                  >
                    채팅으로 말 걸기
                  </button>
                  {space?.type === 'MENTORING' ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleOpenMentoringComposer}
                    >
                      멘토링 요청 열기
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </section>

          <section className="space-hud-card">
            <h3>현재 참가자</h3>
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
                        <p>{spaceDefinition.label}에서 함께 이동 중</p>
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
          </section>
        </div>
      );
    }

    if (activeDrawer === 'chat') {
      return (
        <section className="lobby-chat-panel space-hud-chat-panel">
          <div className="lobby-chat-header">
            <div>
              <h3>{spaceDefinition.label} 채팅</h3>
              <p className="app-note">이 공간에 접속한 사용자끼리만 메시지가 공유됩니다.</p>
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
      );
    }

    if (activeDrawer === 'study') {
      return (
        <div className="space-hud-stack">
          <section className="space-hud-card">
            <h3>스터디 모집 게시</h3>
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
          </section>

          <section className="space-hud-card">
            <h3>현재 진행 중인 스터디 세션</h3>
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
        </div>
      );
    }

    if (activeDrawer === 'mentoring') {
      return (
        <div className="space-hud-stack">
          <section className="space-hud-card">
            <h3>선택한 참가자</h3>
            {!selectedParticipant ? (
              <p className="app-note">
                아바타를 클릭하거나 참가자 탭에서 한 명을 선택하면 요청과 예약을 바로 보낼 수 있습니다.
              </p>
            ) : (
              <>
                <strong>{selectedParticipant.label}</strong>
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
          </section>

          <section className="space-hud-card">
            <h3>빠른 멘토링 요청</h3>
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
          </section>

          <section className="space-hud-card">
            <h3>빠른 예약 제안</h3>
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
          </section>
        </div>
      );
    }

    return (
      <div className="space-hud-stack">
        {arrivalDefinition ? (
          <section className="space-hud-card space-hud-card--accent space-hud-card--compact">
            <span className="space-arrival-banner__eyebrow">이전 공간</span>
            <strong>{arrivalDefinition.label}에서 이동했습니다.</strong>
          </section>
        ) : null}

        <section className="space-hud-card">
          <h3>가이드</h3>
          <p className="app-note">{guideContent.summary}</p>
          <ol className="space-guide-list">
            {guideContent.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </div>
    );
  };

  return (
    <>
      <main className="space-page-root">
        {!isLoading && !errorMessage && space ? (
          <section className="space-world-stage space-world-stage--immersive">
            <div className="space-world-stage__canvas">
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
            </div>

            <header className="space-top-overlay">
              <div className="space-top-overlay__brand">
              <span className="space-top-overlay__eyebrow">NEOSQUARE WORLD</span>
              </div>

              <div className="space-top-overlay__title" aria-label="현재 공간">
                {spaceDefinition.label}
              </div>

              <div className="space-top-overlay__meta">
                <span className="space-top-overlay__chip">{`${worldParticipantCount}명 접속 중`}</span>
                <span className="space-top-overlay__chip">
                  {formatRealtimeConnectionStatus(connectionStatus)}
                </span>
                <div className="space-utility-menu-wrap" ref={utilityMenuRef}>
                  <button
                    type="button"
                    className="space-top-overlay__menu-button"
                    onClick={handleToggleUtilityMenu}
                  >
                    메뉴
                  </button>
                  {isUtilityMenuOpen ? (
                    <div className="space-utility-menu" role="menu" aria-label="메타버스 메뉴">
                      {!isLoading && !errorMessage && space?.type !== 'MAIN' ? (
                        <button
                          type="button"
                          className="space-utility-menu__item"
                          onClick={handleReturnToPrimarySpaceMenuAction}
                        >
                          메인광장으로 돌아가기
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="space-utility-menu__item"
                        onClick={handleOpenAvatarMenuAction}
                        disabled={!currentUser?.id}
                      >
                        아바타 변경
                      </button>
                      <button
                        type="button"
                        className="space-utility-menu__item"
                        onClick={handleOpenHubMenuAction}
                      >
                        활동 허브 열기
                      </button>
                      <button
                        type="button"
                        className="space-utility-menu__item space-utility-menu__item--danger"
                        onClick={handleLogout}
                      >
                        로그아웃
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            <aside className="space-presence-strip" aria-label="현재 공간 참가자">
              <div className="space-presence-strip__list">
                <button
                  type="button"
                  className="space-presence-chip space-presence-chip--current"
                  disabled
                  aria-label={`${currentUser?.nickname || '나'}로 접속 중`}
                >
                  <span className="space-presence-chip__avatar">
                    {getLabelInitial(currentUser?.nickname || '나')}
                  </span>
                  <span className="space-presence-chip__label">{currentUser?.nickname || '나'}</span>
                </button>

                {visiblePresenceUsers.map((user) => {
                  const isSelected =
                    String(user.userId) === String(selectedParticipant?.userId);

                  return (
                    <button
                      key={user.userId}
                      type="button"
                      className={`space-presence-chip ${isSelected ? 'space-presence-chip--selected' : ''}`}
                      onClick={() => selectParticipant(user)}
                    >
                      <span className="space-presence-chip__avatar">
                        {getLabelInitial(user.label)}
                      </span>
                      <span className="space-presence-chip__label">{user.label}</span>
                    </button>
                  );
                })}

                {hiddenPresenceCount > 0 ? (
                  <div className="space-presence-chip space-presence-chip--more" aria-label={`추가 참가자 ${hiddenPresenceCount}명`}>
                    <span className="space-presence-chip__avatar">+{hiddenPresenceCount}</span>
                  </div>
                ) : null}
              </div>
            </aside>

            {avatarNotice ? <p className="space-toast space-toast--success">{avatarNotice}</p> : null}
            {lastError ? <p className="space-toast space-toast--error">{lastError}</p> : null}

            <nav className="space-support-rail" aria-label="메타버스 도구">
              {drawerTabs.map((tab) => {
                const isActive = isSupportPanelOpen && activeDrawer === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`space-support-rail__button ${
                      isActive ? 'space-support-rail__button--active' : ''
                    }`}
                    onClick={() => handleToggleSupportDrawer(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {isSupportPanelOpen ? (
              <aside className="space-hud-drawer" aria-label="메타버스 도구 패널">
                <div className="space-hud-drawer__panel">
                  <div className="space-hud-drawer__header">
                    <div>
                      <h2>{activeDrawerLabel}</h2>
                      <p>{activeDrawerDescription}</p>
                    </div>
                    <button
                      type="button"
                      className="space-hud-drawer__close"
                      onClick={handleCloseSupportPanel}
                    >
                      닫기
                    </button>
                  </div>
                  <div className="space-hud-drawer__content">{renderDrawerContent()}</div>
                </div>
              </aside>
            ) : null}

            <div className="space-world-overlay space-world-overlay--controls">
              <span>이동: 방향키</span>
              <span>상호작용: 클릭</span>
              <span>입장: 위쪽 방향키</span>
            </div>
          </section>
        ) : (
          <section className="space-world-stage space-world-stage--immersive">
            <div className="space-status-overlay">
              {isLoading ? (
                <>
                  <strong>메타버스 공간을 불러오는 중입니다...</strong>
                  <p>잠시만 기다리면 바로 움직일 수 있습니다.</p>
                </>
              ) : (
                <>
                  <strong>공간에 연결하지 못했습니다.</strong>
                  <p>{errorMessage || '잠시 후 다시 시도해 주세요.'}</p>
                </>
              )}
            </div>
          </section>
        )}
      </main>

      {showAvatarOnboarding ? (
        <section
          className="space-avatar-onboarding"
          role="dialog"
          aria-modal="true"
          aria-labelledby="space-avatar-onboarding-title"
        >
          <div className="space-avatar-onboarding__backdrop" />
          <div className="space-avatar-onboarding__panel">
            <span className="landing-section-eyebrow">캐릭터 선택</span>
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
                <strong>선택한 캐릭터</strong>
                <span>
                  아바타 {currentAvatarOrder} / {AVATAR_PRESETS.length}
                </span>
                <p className="app-note">
                  현재 공간: {spaceDefinition.label} · 선택 저장 후 바로 이동과 실시간 표시가
                  반영됩니다.
                </p>
              </div>
            </div>

            <div className="space-avatar-onboarding__grid">
              {AVATAR_PRESETS.map((preset, presetIndex) => {
                const isSelected = preset.id === selectedAvatarId;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`space-avatar-option ${isSelected ? 'space-avatar-option--selected' : ''}`}
                    onClick={() => handleSelectAvatarPreset(preset.id)}
                  >
                    <AvatarPreview presetId={preset.id} size="card" highlighted={isSelected} />
                    <strong>아바타 {presetIndex + 1}</strong>
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
    </>
  );
}
