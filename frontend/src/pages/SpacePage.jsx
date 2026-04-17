import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { getMe } from '../api/auth';
import { getSpace, getSpaces } from '../api/spaces';
import {
  createStudySession,
  getStudySessionsBySpace,
  joinStudySession,
} from '../api/study';
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
import { useLobbyRealtime } from '../lib/useLobbyRealtime';
import { useSessionMedia } from '../lib/useSessionMedia';
import { useAuthStore } from '../store/authStore';

const STUDY_RECRUIT_PREFIX = '[스터디 모집]';
const SPACE_NAVIGATION_ORDER = ['MAIN', 'STUDY'];
const CHAT_SCOPE_PUBLIC = 'PUBLIC';
const CHAT_SCOPE_WHISPER = 'WHISPER';
const CHAT_VARIANT_TEXT = 'TEXT';
const CHAT_VARIANT_EMOJI = 'EMOJI';
const QUICK_EMOJI_OPTIONS = ['😀', '👍', '🙌', '❤️', '😂'];

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
  const [chatInput, setChatInput] = useState('');
  const [chatScope, setChatScope] = useState(CHAT_SCOPE_PUBLIC);
  const [studyTopic, setStudyTopic] = useState('');
  const [studyNote, setStudyNote] = useState('');
  const [studyStatus, setStudyStatus] = useState('idle');
  const [studyNotice, setStudyNotice] = useState('');
  const [studyError, setStudyError] = useState('');
  const [studySessions, setStudySessions] = useState([]);
  const [studySessionsStatus, setStudySessionsStatus] = useState('idle');
  const [studySessionsError, setStudySessionsError] = useState('');
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [isSupportPanelOpen, setIsSupportPanelOpen] = useState(false);
  const [isEmojiPaletteOpen, setIsEmojiPaletteOpen] = useState(false);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const avatarPresetId = selectedAvatarId;
  const spawnFromSpaceType =
    typeof location.state?.entryFromSpaceType === 'string'
      ? location.state.entryFromSpaceType
      : null;
  const chatInputRef = useRef(null);
  const chatMessagesEndRef = useRef(null);
  const studyTopicInputRef = useRef(null);
  const {
    localVideoRef,
    hasLocalPreview,
    cameraOn,
    microphoneOn,
    errorMessage: mediaErrorMessage,
    startLocalPreview,
    toggleCamera,
    toggleMicrophone,
    stopLocalPreview,
  } = useSessionMedia();
  const {
    lastError,
    remoteEvent,
    remoteUsers,
    chatMessages,
    latestChatMessage,
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
  const currentAvatarOrder = useMemo(() => {
    const resolvedIndex = AVATAR_PRESETS.findIndex((preset) => preset.id === selectedAvatarId);
    return resolvedIndex >= 0 ? resolvedIndex + 1 : 1;
  }, [selectedAvatarId]);
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
    const tabs = [{ id: 'chat', label: '채팅' }];

    if (space?.type === 'STUDY') {
      tabs.push({ id: 'study', label: '스터디' });
    }

    return tabs;
  }, [space?.type]);
  const chatTargetValue =
    chatScope === CHAT_SCOPE_WHISPER && selectedParticipant
      ? String(selectedParticipant.userId)
      : CHAT_SCOPE_PUBLIC;

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
    if (space?.type !== 'MENTORING') {
      return;
    }

    navigate('/hub', {
      replace: true,
      state: {
        message: '멘토링은 내 활동에서 요청과 예약을 관리한 뒤 전용 세션으로 입장합니다.',
      },
    });
  }, [navigate, space?.type]);

  useEffect(() => {
    if (!space?.type) {
      return;
    }
    setActiveDrawer(null);
    setIsSupportPanelOpen(false);
  }, [space?.id, space?.type]);

  useEffect(() => {
    if (activeDrawer == null) {
      return;
    }

    if (!drawerTabs.some((tab) => tab.id === activeDrawer)) {
      setActiveDrawer(drawerTabs[0]?.id || null);
    }
  }, [activeDrawer, drawerTabs]);

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
    if (chatScope === CHAT_SCOPE_WHISPER && !selectedParticipant) {
      setChatScope(CHAT_SCOPE_PUBLIC);
    }
  }, [chatScope, selectedParticipant]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chatMessages]);

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

  const focusChatComposer = () => {
    setActiveDrawer('chat');
    setIsSupportPanelOpen(true);
    setIsEmojiPaletteOpen(false);
    window.requestAnimationFrame(() => {
      chatInputRef.current?.focus();
    });
  };

  const handleActivateWhisper = (participant = selectedParticipant) => {
    if (!participant?.userId) {
      return;
    }

    setSelectedParticipantId(participant.userId);
    setChatScope(CHAT_SCOPE_WHISPER);
    focusChatComposer();
  };

  const selectParticipant = (participant) => {
    if (!participant?.userId) {
      return;
    }

    setSelectedParticipantId(participant.userId);
    setStudyNotice('');
    setStudyError('');
    handleActivateWhisper(participant);
  };

  const handleSetPublicChat = () => {
    setChatScope(CHAT_SCOPE_PUBLIC);
    focusChatComposer();
  };

  const handleChatTargetChange = (event) => {
    const nextValue = event.target.value;

    if (nextValue === CHAT_SCOPE_PUBLIC) {
      handleSetPublicChat();
      return;
    }

    const nextParticipant =
      remoteUsers.find((user) => String(user.userId) === String(nextValue)) || null;

    if (!nextParticipant) {
      setChatScope(CHAT_SCOPE_PUBLIC);
      return;
    }

    handleActivateWhisper(nextParticipant);
  };

  const handleChatSubmit = (event) => {
    event.preventDefault();

    const didSend = sendChatMessage(chatInput, {
      scope: chatScope,
      variant: CHAT_VARIANT_TEXT,
      recipientUserId: selectedParticipant?.userId ?? null,
      recipientNickname: selectedParticipant?.label ?? '',
    });

    if (didSend) {
      setChatInput('');
    }
  };

  const handleSendEmojiMessage = (emoji) => {
    const didSend = sendChatMessage(emoji, {
      scope: chatScope,
      variant: CHAT_VARIANT_EMOJI,
      recipientUserId: selectedParticipant?.userId ?? null,
      recipientNickname: selectedParticipant?.label ?? '',
    });

    if (!didSend) {
      return;
    }

    setIsEmojiPaletteOpen(false);
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

  const handleToggleSupportDrawer = (drawerId) => {
    setIsEmojiPaletteOpen(false);

    if (isSupportPanelOpen && activeDrawer === drawerId) {
      setIsSupportPanelOpen(false);
      return;
    }

    setActiveDrawer(drawerId);
    setIsSupportPanelOpen(true);
  };

  const handleReturnToLobby = () => {
    navigate('/lobby');
  };

  const handleCloseSupportPanel = () => {
    setIsSupportPanelOpen(false);
  };

  const handleToggleEmojiPalette = () => {
    setIsSupportPanelOpen(false);
    setActiveDrawer(null);
    setIsEmojiPaletteOpen((currentValue) => !currentValue);
  };

  const handleToggleCameraDock = async () => {
    setIsEmojiPaletteOpen(false);

    if (!hasLocalPreview) {
      const stream = await startLocalPreview();

      if (!stream) {
        return;
      }

      if (stream.getAudioTracks()[0]?.enabled) {
        toggleMicrophone();
      }

      return;
    }

    const nextCameraOn = toggleCamera();

    if (!nextCameraOn && !microphoneOn) {
      stopLocalPreview();
    }
  };

  const handleToggleMicrophoneDock = async () => {
    setIsEmojiPaletteOpen(false);

    if (!hasLocalPreview) {
      const stream = await startLocalPreview();

      if (!stream) {
        return;
      }

      if (stream.getVideoTracks()[0]?.enabled) {
        toggleCamera();
      }

      return;
    }

    const nextMicrophoneOn = toggleMicrophone();

    if (!nextMicrophoneOn && !cameraOn) {
      stopLocalPreview();
    }
  };

  const activeDrawerLabel = drawerTabs.find((tab) => tab.id === activeDrawer)?.label || '채팅';

  const activeDrawerDescription =
    activeDrawer === 'chat'
      ? ''
      : activeDrawer === 'study'
          ? '스터디 세션을 열거나 참여합니다.'
          : '현재 공간에서 필요한 도구를 확인합니다.';

  const renderDrawerContent = () => {
    if (activeDrawer === 'chat') {
      return (
        <section className="lobby-chat-panel space-hud-chat-panel">
          <div className="lobby-chat-header">
            <div>
              <h3>{spaceDefinition.label} 채팅</h3>
            </div>
          </div>

          <div className="space-chat-target-bar">
            <label className="space-chat-target-label" htmlFor="space-chat-target-select">
              대상
            </label>
            <select
              id="space-chat-target-select"
              className="space-chat-target-select"
              value={chatTargetValue}
              onChange={handleChatTargetChange}
            >
              <option value={CHAT_SCOPE_PUBLIC}>All</option>
              {remoteUsers.map((user) => (
                <option key={user.userId} value={String(user.userId)}>
                  {user.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lobby-chat-messages">
            {chatMessages.length === 0 ? (
              <p className="app-note">아직 채팅 메시지가 없습니다.</p>
            ) : (
              chatMessages.map((message) => (
                <article
                  key={message.id}
                  className={`chat-message ${message.isMine ? 'chat-message--mine' : ''} ${
                    message.scope === CHAT_SCOPE_WHISPER ? 'chat-message--whisper' : ''
                  } ${message.variant === CHAT_VARIANT_EMOJI ? 'chat-message--emoji' : ''}`}
                >
                  <span className="chat-message__meta">
                    {message.isMine ? '나' : message.nickname}
                    {message.scope === CHAT_SCOPE_WHISPER
                      ? message.isMine
                        ? ` · ${message.recipientNickname || '선택한 참가자'}님께 귓속말`
                        : ' · 귓속말'
                      : ' · 전체'}
                  </span>
                  <p>{message.content}</p>
                </article>
              ))
            )}
            <div ref={chatMessagesEndRef} />
          </div>

          <form className="lobby-chat-form" onSubmit={handleChatSubmit}>
            <input
              ref={chatInputRef}
              type="text"
              className="app-input"
              placeholder={
                chatScope === CHAT_SCOPE_WHISPER && selectedParticipant
                  ? `${selectedParticipant.label}님께 귓속말을 입력하세요`
                  : '메시지를 입력하세요'
              }
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
            />
            <button type="submit" className="primary-button">
              {chatScope === CHAT_SCOPE_WHISPER ? '귓속말' : '전송'}
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

    return null;
  };

  return (
    <>
      <main className="space-page-root">
        {!isLoading && !errorMessage && space ? (
          <section className="space-world-stage space-world-stage--immersive">
            <div className="space-world-stage__canvas">
              <SpaceGame
                currentUserId={currentUser?.id ?? null}
                playerLabel={currentUser?.nickname || '나'}
                spaceType={space.type}
                avatarPresetId={avatarPresetId}
                connectedSpaces={connectedSpaces}
                spawnFromSpaceType={spawnFromSpaceType}
                onPlayerMove={sendUserMove}
                onSpaceEnter={handleSpacePortalEnter}
                onParticipantSelect={selectParticipant}
                remoteEvent={remoteEvent}
                chatMessageEvent={latestChatMessage}
              />
            </div>

            <header className="space-top-overlay space-top-overlay--minimal">
              <div className="space-top-overlay__meta">
                <button
                  type="button"
                  className="space-top-overlay__menu-button"
                  onClick={handleReturnToLobby}
                >
                  로비
                </button>
              </div>
            </header>

            {avatarNotice ? <p className="space-toast space-toast--success">{avatarNotice}</p> : null}
            {lastError ? <p className="space-toast space-toast--error">{lastError}</p> : null}
            {mediaErrorMessage ? <p className="space-toast space-toast--error">{mediaErrorMessage}</p> : null}

            {isSupportPanelOpen ? (
              <aside className="space-hud-drawer" aria-label="메타버스 도구 패널">
                <div className="space-hud-drawer__panel">
                  <div className="space-hud-drawer__header">
                    <div>
                      <h2>{activeDrawerLabel}</h2>
                      {activeDrawerDescription ? <p>{activeDrawerDescription}</p> : null}
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

            {isEmojiPaletteOpen ? (
              <section className="space-emoji-popover" aria-label="빠른 이모지">
                <div className="space-emoji-popover__header">
                  <strong>빠른 이모지</strong>
                  <span>
                    {chatScope === CHAT_SCOPE_WHISPER && selectedParticipant
                      ? `${selectedParticipant.label}님께 전송`
                      : 'All'}
                  </span>
                </div>
                <div className="space-emoji-popover__grid">
                  {QUICK_EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="space-emoji-popover__button"
                      onClick={() => handleSendEmojiMessage(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-bottom-bar" aria-label="메타버스 컨트롤 바">
              <div className="space-bottom-bar__left">
                <button
                  type="button"
                  className={`space-bottom-bar__action ${
                    microphoneOn ? 'space-bottom-bar__action--active' : ''
                  }`}
                  onClick={handleToggleMicrophoneDock}
                >
                  마이크
                </button>
                <button
                  type="button"
                  className={`space-bottom-bar__action ${
                    cameraOn ? 'space-bottom-bar__action--active' : ''
                  }`}
                  onClick={handleToggleCameraDock}
                >
                  카메라
                </button>
                <button
                  type="button"
                  className={`space-bottom-bar__action ${
                    isEmojiPaletteOpen ? 'space-bottom-bar__action--active' : ''
                  }`}
                  onClick={handleToggleEmojiPalette}
                >
                  이모지
                </button>
                <button
                  type="button"
                  className={`space-bottom-bar__action ${
                    isSupportPanelOpen && activeDrawer === 'chat'
                      ? 'space-bottom-bar__action--active'
                      : ''
                  }`}
                  onClick={() => handleToggleSupportDrawer('chat')}
                >
                  채팅
                </button>
                {hasLocalPreview && cameraOn ? (
                  <div className="space-bottom-bar__preview">
                    <video
                      ref={localVideoRef}
                      className="space-bottom-bar__video"
                      autoPlay
                      muted
                      playsInline
                    />
                  </div>
                ) : null}
              </div>
            </section>

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
