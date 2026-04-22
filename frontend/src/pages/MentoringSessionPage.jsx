import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { getMe } from '../api/auth';
import { completeMentoringRequest, getMentoringRequest } from '../api/mentoring';
import { getMentorCourseApplicationSessionEntry } from '../api/mentorCourseApplications';
import {
  completeReservation,
  getReservation,
  getReservationSessionEntry,
} from '../api/reservations';
import AppLayout from '../components/AppLayout';
import { buildActivityPath } from '../lib/activityNavigation';
import { getCourseSessionEntryState } from '../lib/courseSessionEntryState';
import { getReservationEntryState } from '../lib/reservationEntryState';
import { useMentoringSessionChat } from '../lib/useMentoringSessionChat';
import { useSessionMedia } from '../lib/useSessionMedia';
import { useSessionWebRTC } from '../lib/useSessionWebRTC';
import { useAuthStore } from '../store/authStore';

function normalizeSessionRequest(rawValue) {
  if (!rawValue) {
    return null;
  }

  const request = rawValue.item || rawValue.request || rawValue;

  return {
    id: request.id,
    status: request.status || 'PENDING',
    message: request.message || request.content || '',
    requesterId: request.requesterId ?? request.senderId ?? request.userId ?? null,
    requesterLabel:
      request.requesterNickname ||
      request.requesterName ||
      request.senderNickname ||
      request.userNickname ||
      '요청자',
    mentorId: request.mentorId ?? request.receiverId ?? request.targetUserId ?? null,
    mentorLabel:
      request.mentorNickname ||
      request.mentorName ||
      request.receiverNickname ||
      request.targetNickname ||
      '멘토',
    reservedAt: null,
    sessionSource: 'request',
    createdAt: request.createdAt || request.timestamp || null,
    completedAt: request.completedAt || null,
  };
}

function normalizeReservationSession(rawValue) {
  if (!rawValue) {
    return null;
  }

  const reservation = rawValue.item || rawValue.reservation || rawValue;

  return {
    id: reservation.id,
    status: reservation.status || 'PENDING',
    message: reservation.message || reservation.content || '',
    requesterId: reservation.requesterId ?? reservation.senderId ?? reservation.userId ?? null,
    requesterLabel:
      reservation.requesterLabel ||
      reservation.requesterNickname ||
      reservation.requesterName ||
      reservation.senderNickname ||
      reservation.userNickname ||
      '요청자',
    mentorId: reservation.mentorId ?? reservation.receiverId ?? reservation.targetUserId ?? null,
    mentorLabel:
      reservation.mentorLabel ||
      reservation.mentorNickname ||
      reservation.mentorName ||
      reservation.receiverNickname ||
      reservation.targetNickname ||
      '멘토',
    reservedAt: reservation.reservedAt || reservation.scheduledAt || null,
    sessionEntryOpenAt: reservation.sessionEntryOpenAt || null,
    sessionEntryCloseAt: reservation.sessionEntryCloseAt || null,
    sessionSource: 'reservation',
    createdAt: reservation.createdAt || reservation.timestamp || null,
    completedAt: reservation.completedAt || null,
  };
}

function normalizeCourseApplicationSession(rawValue) {
  if (!rawValue) {
    return null;
  }

  const application = rawValue.item || rawValue.courseApplication || rawValue.application || rawValue;

  return {
    id: application.id,
    status: application.status || 'PENDING',
    message: application.message || '',
    requesterId: application.applicantId ?? null,
    requesterLabel: application.applicantNickname || '수강자',
    applicantId: application.applicantId ?? null,
    applicantLabel: application.applicantNickname || '수강자',
    mentorId: application.mentorId ?? null,
    mentorLabel: application.mentorNickname || '멘토',
    reservedAt: application.assignedScheduleStartsAt || null,
    assignedScheduleTitle: application.assignedScheduleTitle || '',
    assignedScheduleStartsAt: application.assignedScheduleStartsAt || null,
    assignedScheduleEndsAt: application.assignedScheduleEndsAt || null,
    sessionEntryOpenAt: application.sessionEntryOpenAt || null,
    sessionEntryCloseAt: application.sessionEntryCloseAt || null,
    courseTitle: application.courseTitle || '수업',
    sessionSource: 'course_application',
    createdAt: application.createdAt || null,
    completedAt: null,
  };
}

function normalizeSessionEntry(rawValue, sessionSource = 'request') {
  if (sessionSource === 'reservation') {
    return normalizeReservationSession(rawValue);
  }

  if (sessionSource === 'course_application') {
    return normalizeCourseApplicationSession(rawValue);
  }

  return normalizeSessionRequest(rawValue);
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

function formatSessionRole(role) {
  if (role === 'Requester') {
    return '요청자';
  }

  if (role === 'Learner') {
    return '수강자';
  }

  if (role === 'Mentor') {
    return '멘토';
  }

  return '참여자';
}

function formatSessionStatus(status) {
  if (status === 'PENDING') {
    return '대기 중';
  }

  if (status === 'ACCEPTED') {
    return '수락됨';
  }

  if (status === 'APPROVED') {
    return '승인됨';
  }

  if (status === 'REJECTED') {
    return '거절됨';
  }

  if (status === 'CANCELED') {
    return '취소됨';
  }

  if (status === 'COMPLETED') {
    return '종료됨';
  }

  return status || '알 수 없음';
}

function formatSessionChatStatus(status) {
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

function getReservationSessionGateCopy(sessionRequest, entryState) {
  if (!sessionRequest || sessionRequest.sessionSource !== 'reservation') {
    return null;
  }

  if (sessionRequest.status === 'PENDING') {
    return {
      tone: 'pending',
      title: '예약 수락 대기 중',
      detail: '멘토가 예약을 수락해야 세션 입장이 열립니다.',
    };
  }

  if (sessionRequest.status === 'REJECTED') {
    return {
      tone: 'muted',
      title: '예약이 거절되었습니다',
      detail: '이 예약으로는 세션을 시작할 수 없습니다.',
    };
  }

  if (sessionRequest.status === 'CANCELED') {
    return {
      tone: 'muted',
      title: '예약이 취소되었습니다',
      detail: '취소된 예약은 더 이상 세션에 입장할 수 없습니다.',
    };
  }

  if (sessionRequest.status === 'COMPLETED') {
    return {
      tone: 'info',
      title: '예약 세션이 종료되었습니다',
      detail: '세션은 완료 상태이며, 허브에서 기록과 피드백을 이어서 확인할 수 있습니다.',
    };
  }

  if (entryState?.status === 'ready') {
    return {
      tone: 'accepted',
      title: '지금 예약 세션에 입장할 수 있습니다',
      detail: '영상 연결과 채팅이 활성화되었습니다. 세션을 바로 시작하면 됩니다.',
    };
  }

  if (entryState?.status === 'upcoming') {
    return {
      tone: 'pending',
      title: '아직 입장 가능 시간이 아닙니다',
      detail: '예약 시작 10분 전부터 연결과 채팅이 열립니다.',
    };
  }

  if (entryState?.status === 'expired') {
    return {
      tone: 'muted',
      title: '입장 가능 시간이 종료되었습니다',
      detail: '입장 허용 시간이 지나 실시간 연결을 시작할 수 없습니다.',
    };
  }

  return {
    tone: 'info',
    title: '입장 상태를 확인할 수 없습니다',
    detail: '예약 시간 정보를 다시 확인한 뒤 세션에 입장해 주세요.',
  };
}

function getCourseSessionGateCopy(sessionRequest, entryState) {
  if (!sessionRequest || sessionRequest.sessionSource !== 'course_application') {
    return null;
  }

  if (sessionRequest.status === 'PENDING') {
    return {
      tone: 'pending',
      title: '수업 신청 승인 대기 중',
      detail: '멘토가 신청을 승인하고 회차를 배정해야 세션 입장이 열립니다.',
    };
  }

  if (sessionRequest.status === 'REJECTED') {
    return {
      tone: 'muted',
      title: '수업 신청이 반려되었습니다',
      detail: '이 신청으로는 수업 세션을 시작할 수 없습니다.',
    };
  }

  if (sessionRequest.status === 'CANCELED') {
    return {
      tone: 'muted',
      title: '수업 신청이 취소되었습니다',
      detail: '취소된 신청은 더 이상 세션에 입장할 수 없습니다.',
    };
  }

  if (!sessionRequest.assignedScheduleStartsAt) {
    return {
      tone: 'pending',
      title: '배정된 회차가 없습니다',
      detail: '회차가 확정되어야 세션 입장 시간과 연결이 열립니다.',
    };
  }

  if (entryState?.status === 'ready') {
    return {
      tone: 'accepted',
      title: '지금 수업 세션에 입장할 수 있습니다',
      detail: '배정된 회차 참가자만 영상 연결과 채팅을 사용할 수 있습니다.',
    };
  }

  if (entryState?.status === 'upcoming') {
    return {
      tone: 'pending',
      title: '아직 입장 가능 시간이 아닙니다',
      detail: '수업 시작 10분 전부터 연결과 채팅이 열립니다.',
    };
  }

  if (entryState?.status === 'expired') {
    return {
      tone: 'muted',
      title: '입장 가능 시간이 종료되었습니다',
      detail: '해당 회차의 수업 세션 입장 시간이 지나 더 이상 연결을 시작할 수 없습니다.',
    };
  }

  return {
    tone: 'info',
    title: '입장 상태를 확인할 수 없습니다',
    detail: '배정 회차 정보를 다시 확인한 뒤 세션에 입장해 주세요.',
  };
}

export default function MentoringSessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { requestId } = useParams();
  const sessionTypeHint = new URLSearchParams(location.search).get('type');
  const hasReservationState = Boolean(location.state?.reservation);
  const hasRequestState = Boolean(location.state?.request);
  const hasCourseApplicationState = Boolean(location.state?.courseApplication);
  const hintedSessionSource =
    hasCourseApplicationState || sessionTypeHint === 'course_application'
      ? 'course_application'
      : hasReservationState || sessionTypeHint === 'reservation'
        ? 'reservation'
        : 'request';
  const initialSessionEntry =
    hintedSessionSource === 'request'
      ? normalizeSessionEntry(location.state?.request, 'request')
      : hintedSessionSource === 'reservation'
        ? normalizeSessionEntry(location.state?.reservation, 'reservation')
        : normalizeSessionEntry(location.state?.courseApplication, 'course_application');
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const [sessionRequest, setSessionRequest] = useState(initialSessionEntry);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(
    hintedSessionSource === 'reservation' ||
      hintedSessionSource === 'course_application' ||
      !initialSessionEntry
  );
  const [chatInput, setChatInput] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [sessionExitStatus, setSessionExitStatus] = useState('idle');
  const [reservationClock, setReservationClock] = useState(Date.now());
  const chatMessagesEndRef = useRef(null);
  const endSessionTimeoutRef = useRef(null);
  const isReservationSession =
    (sessionRequest?.sessionSource || hintedSessionSource) === 'reservation';
  const isCourseSession =
    (sessionRequest?.sessionSource || hintedSessionSource) === 'course_application';
  const numericSessionId = Number(requestId);
  const hasRealtimeSessionId = Number.isFinite(numericSessionId);
  const realtimeSessionScope = isCourseSession
    ? 'mentor_course_session'
    : isReservationSession
      ? 'reservation_session'
      : 'mentoring_session';
  const realtimeSessionIdField = isCourseSession
    ? 'applicationId'
    : isReservationSession
      ? 'reservationId'
      : 'requestId';
  const reservationEntryState = useMemo(() => {
    if (!isReservationSession || !sessionRequest) {
      return null;
    }

    return getReservationEntryState(sessionRequest, reservationClock);
  }, [isReservationSession, reservationClock, sessionRequest]);
  const courseEntryState = useMemo(() => {
    if (!isCourseSession || !sessionRequest) {
      return null;
    }

    return getCourseSessionEntryState(sessionRequest, reservationClock);
  }, [isCourseSession, reservationClock, sessionRequest]);
  const reservationSessionGate = getReservationSessionGateCopy(
    sessionRequest,
    reservationEntryState
  );
  const courseSessionGate = getCourseSessionGateCopy(sessionRequest, courseEntryState);
  const canUseReservationSession =
    !isReservationSession ||
    (sessionRequest?.status === 'ACCEPTED' && reservationEntryState?.canEnter);
  const canUseCourseSession =
    !isCourseSession ||
    (sessionRequest?.status === 'APPROVED' && courseEntryState?.canEnter);
  const canUseScheduledSession = canUseReservationSession && canUseCourseSession;
  const activeSessionStatus = isCourseSession ? 'APPROVED' : 'ACCEPTED';
  const canUseLiveSession =
    Boolean(hasRealtimeSessionId && sessionRequest?.id && currentUser?.id) &&
    canUseScheduledSession &&
    !isLoading;
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
    remoteVideoRef,
    hasRemoteStream,
    connectionStatus: videoCallStatus,
    statusMessage: webrtcStatusMessage,
    errorMessage: webrtcErrorMessage,
    lastSignalType,
    canRetry,
    hasTurnRelay,
    iceServerModeLabel,
    iceServerDetailMessage,
    startConnection,
    retryConnection,
    stopConnection,
  } = useSessionWebRTC({
    enabled: canUseLiveSession,
    sessionId: hasRealtimeSessionId ? numericSessionId : null,
    sessionScope: realtimeSessionScope,
    sessionIdField: realtimeSessionIdField,
    userId: currentUser?.id,
    localStream,
    isInitiator: Boolean(
      (isCourseSession ? sessionRequest?.applicantId : sessionRequest?.requesterId) &&
        currentUser?.id === (isCourseSession ? sessionRequest?.applicantId : sessionRequest?.requesterId)
    ),
  });
  const {
    messages: sessionMessages,
    connectionStatus: sessionChatStatus,
    errorMessage: sessionChatError,
    sendMessage,
  } = useMentoringSessionChat({
    enabled: Boolean(
      canUseLiveSession &&
      sessionRequest?.status === activeSessionStatus &&
      currentUser?.nickname
    ),
    sessionId: hasRealtimeSessionId ? numericSessionId : null,
    sessionScope: realtimeSessionScope,
    sessionIdField: realtimeSessionIdField,
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

        console.error('Failed to load current user for mentoring session:', error);
      }
    }

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [currentUser, setCurrentUser]);

  useEffect(() => {
    const shouldLoadFromServer =
      hintedSessionSource === 'reservation' ||
      hintedSessionSource === 'course_application' ||
      !hasRequestState;

    if (!shouldLoadFromServer) {
      return;
    }

    let isMounted = true;

    async function loadRequestDetail() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await loadSessionEntry(requestId, hintedSessionSource);

        if (!isMounted) {
          return;
        }

        setSessionRequest(normalizeSessionEntry(response.data, response.sessionSource));
      } catch (error) {
        if (hintedSessionSource === 'reservation' && error?.response?.status === 409) {
          try {
            const reservation = await getReservation(requestId);

            if (!isMounted) {
              return;
            }

            setSessionRequest(normalizeSessionEntry(reservation, 'reservation'));
            setErrorMessage('');
            return;
          } catch (reservationError) {
            if (!isMounted) {
              return;
            }
          }
        }

        if (
          hintedSessionSource === 'course_application' &&
          error?.response?.status === 409 &&
          location.state?.courseApplication
        ) {
          if (!isMounted) {
            return;
          }

          setSessionRequest(
            normalizeSessionEntry(location.state.courseApplication, 'course_application')
          );
          setErrorMessage('');
          return;
        }

        if (!isMounted) {
          return;
        }

        const message =
          error?.response?.data?.message ||
          error.message ||
          '멘토링 세션 정보를 불러오지 못했습니다.';
        setErrorMessage(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRequestDetail();

    return () => {
      isMounted = false;
    };
  }, [hasRequestState, hintedSessionSource, location.state, requestId]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [sessionMessages]);

  useEffect(() => {
    if (!isReservationSession && !isCourseSession) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setReservationClock(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isCourseSession, isReservationSession]);

  useEffect(() => {
    return () => {
      if (endSessionTimeoutRef.current) {
        window.clearTimeout(endSessionTimeoutRef.current);
      }
    };
  }, []);

  let myRole = 'Participant';

  if (isCourseSession && sessionRequest && currentUser?.id === sessionRequest.applicantId) {
    myRole = 'Learner';
  } else if (sessionRequest && currentUser?.id === sessionRequest.requesterId) {
    myRole = 'Requester';
  } else if (sessionRequest && currentUser?.id === sessionRequest.mentorId) {
    myRole = 'Mentor';
  }

  const counterpartName =
    sessionRequest && myRole === 'Requester'
      ? sessionRequest.mentorLabel
      : sessionRequest && myRole === 'Learner'
        ? sessionRequest.mentorLabel
      : sessionRequest && myRole === 'Mentor'
        ? sessionRequest.applicantLabel || sessionRequest.requesterLabel
        : sessionRequest?.requesterLabel || sessionRequest?.mentorLabel;

  const handleSessionChatSubmit = (event) => {
    event.preventDefault();

    if (!canUseScheduledSession) {
      return;
    }

    const didSend = sendMessage(chatInput);

    if (didSend) {
      setChatInput('');
    }
  };

  const cleanupSessionResources = () => {
    stopConnection();
    stopLocalPreview();
  };

  const navigateToActivity = (state) => {
    const returnToItemId = location.state?.returnToItemId;
    const targetPath = returnToItemId
      ? buildActivityPath('schedule', returnToItemId)
      : '/hub';

    if (endSessionTimeoutRef.current) {
      window.clearTimeout(endSessionTimeoutRef.current);
      endSessionTimeoutRef.current = null;
    }

    navigate(targetPath, {
      replace: true,
      state,
    });
  };

  const handleStartVideoCall = async () => {
    if (!canUseScheduledSession) {
      return;
    }

    setActionMessage('');
    setSessionExitStatus('idle');
    const preparedStream = await startLocalPreview();

    if (!preparedStream) {
      return;
    }

    if (preparedStream) {
      await startConnection(preparedStream);
    }
  };

  const handleRetryVideoCall = async () => {
    if (!canUseScheduledSession) {
      return;
    }

    setActionMessage('');
    setSessionExitStatus('idle');

    const preparedStream = hasLocalPreview ? localStream : await startLocalPreview();

    if (!preparedStream) {
      return;
    }

    await retryConnection(preparedStream);
  };

  const handleEndSession = async () => {
    if (isCourseSession) {
      cleanupSessionResources();
      navigateToActivity({
        refreshMentoring: true,
        sessionMessage: '멘토링 화면을 나갔습니다. 내 활동 일정에서 다음 상태를 계속 확인할 수 있습니다.',
      });
      return;
    }

    if (
      sessionExitStatus === 'ending' ||
      sessionExitStatus === 'ended' ||
      !sessionRequest?.id ||
      sessionRequest.status !== 'ACCEPTED'
    ) {
      return;
    }

    setSessionExitStatus('ending');
    setActionMessage('세션을 종료하는 중입니다...');
    setErrorMessage('');

    try {
      const completedSession = normalizeSessionEntry(
        isReservationSession
          ? await completeReservation(sessionRequest.id)
          : await completeMentoringRequest(sessionRequest.id),
        sessionRequest.sessionSource
      );

      setSessionRequest(completedSession);
      cleanupSessionResources();
      setSessionExitStatus('ended');
      setActionMessage('멘토링이 종료되었습니다. 내 활동에서 바로 피드백과 다음 행동을 확인할 수 있습니다.');

      endSessionTimeoutRef.current = window.setTimeout(() => {
        navigateToActivity({
          refreshMentoring: true,
          sessionMessage: isReservationSession
            ? '멘토링이 종료되었습니다. 내 활동 기록에서 예약 피드백을 남길 수 있습니다.'
            : '멘토링이 종료되었습니다. 내 활동 기록에서 빠르게 피드백을 남길 수 있습니다.',
          feedbackPrompt: {
            requestId: completedSession?.id ?? sessionRequest?.id ?? requestId,
            counterpartName: counterpartName || '세션 상대',
            role: myRole,
            sessionSource: completedSession?.sessionSource || sessionRequest?.sessionSource || 'request',
            reservedAt: completedSession?.reservedAt || sessionRequest?.reservedAt || null,
            requestMessage: completedSession?.message || sessionRequest?.message || '',
          },
        });
      }, 900);
    } catch (error) {
      setSessionExitStatus('idle');
      setActionMessage('');
      setErrorMessage(
        error?.response?.data?.message || error.message || '멘토링 세션 종료에 실패했습니다.'
      );
    }
  };

  const handleToggleCamera = () => {
    setActionMessage('');
    setSessionExitStatus('idle');
    toggleCamera();
  };

  const handleToggleMicrophone = () => {
    setActionMessage('');
    setSessionExitStatus('idle');
    toggleMicrophone();
  };

  const handleBackToActivity = () => {
    cleanupSessionResources();
    navigateToActivity({
      refreshMentoring: true,
    });
  };

  const videoStatusLabel =
    videoCallStatus === 'connected'
      ? '연결됨'
      : videoCallStatus === 'connecting'
        ? '연결 중'
        : videoCallStatus === 'signaling'
          ? '시그널링 중'
          : videoCallStatus === 'ready'
            ? '영상 연결 준비 완료'
            : videoCallStatus === 'error'
              ? '오류'
              : videoCallStatus === 'disconnected'
                ? '연결 끊김'
              : videoCallStatus === 'preparing'
                ? '준비 중'
                : '미연결';

  const localMediaStatusLabel =
    localMediaStatus === 'ready'
      ? '로컬 미디어 준비 완료'
      : localMediaStatus === 'preparing'
        ? '로컬 미디어 준비 중'
        : localMediaStatus === 'error'
          ? '로컬 미디어 오류'
          : '로컬 미디어 대기';

  const localVideoStatus =
    videoCallStatus === 'connected'
      ? '로컬 화면이 상대 세션과 연결되었습니다.'
      : videoCallStatus === 'connecting'
        ? '로컬 화면이 연결되었고 상대 영상을 기다리는 중입니다.'
        : videoCallStatus === 'signaling'
          ? '연결 제안과 응답을 교환하는 중입니다.'
          : localMediaStatus === 'ready'
            ? cameraOn
              ? '로컬 미리보기가 준비되었습니다.'
              : '카메라가 꺼져 있습니다. 필요하면 켜 주세요.'
            : localMediaStatus === 'preparing'
              ? '로컬 카메라와 마이크를 준비하는 중입니다.'
              : localMediaStatus === 'error' || videoCallStatus === 'error'
                ? '로컬 미리보기를 준비하지 못했습니다.'
                : '카메라 꺼짐';

  const remoteVideoStatus =
    hasRemoteStream
      ? '상대 영상이 연결되었습니다.'
      : videoCallStatus === 'connecting'
        ? '상대 영상을 연결하는 중입니다...'
        : videoCallStatus === 'signaling'
          ? '연결 제안과 응답 교환을 기다리는 중입니다.'
          : videoCallStatus === 'disconnected'
            ? '상대가 오프라인이거나 통화가 끊어졌습니다.'
            : videoCallStatus === 'error'
              ? '상대 연결에 실패했습니다. 다시 시도해 주세요.'
              : videoCallStatus === 'preparing'
                ? '상대 연결을 준비하는 중입니다.'
              : '상대 미연결';

  const primaryVideoActionLabel =
    !canUseScheduledSession && (isReservationSession || isCourseSession)
      ? '입장 가능 시간 대기'
      : mediaErrorMessage && !hasLocalPreview
      ? '권한 다시 요청'
      : canRetry || videoCallStatus === 'error' || videoCallStatus === 'disconnected'
        ? '연결 다시 시도'
        : hasLocalPreview
          ? '영상 연결 시작'
          : '카메라/마이크 준비';
  const sessionGate = isCourseSession ? courseSessionGate : reservationSessionGate;
  const scheduledEntryState = isCourseSession ? courseEntryState : reservationEntryState;
  const sessionTypeLabel = isCourseSession
    ? '수업 세션'
    : isReservationSession
      ? '예약 멘토링'
      : '요청 멘토링';
  const sessionReferenceLabel = isCourseSession
    ? '수업 신청'
    : isReservationSession
      ? '예약'
      : '요청';
  const sessionStartLabel = isCourseSession ? '배정 회차 시작' : '예약 시각';

  return (
    <AppLayout
      eyebrow="세션"
      title={isCourseSession ? '수업 세션' : '멘토링 세션'}
      description={
        isCourseSession
          ? '배정된 수업 회차를 기준으로 멘토와 수강자가 영상 연결과 채팅을 이어가는 세션 화면입니다.'
          : '수락된 멘토링 요청 또는 예약을 기준으로 대화와 영상 연결을 이어가는 세션 화면입니다.'
      }
      panelClassName="app-panel--wide"
    >
      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}

      {isLoading ? (
        <p className="app-note">세션 정보를 불러오는 중입니다...</p>
      ) : sessionRequest ? (
        <section className="session-panel">
          <section className="session-hero">
            <div className="session-hero__main">
              <p className="session-hero__eyebrow">
                {isCourseSession
                  ? '수업 세션'
                  : isReservationSession
                    ? '예약 세션'
                    : '세션 준비 완료'}
              </p>
              <h2>{counterpartName || '알 수 없는 사용자'}</h2>
              <p className="session-hero__summary">
                {sessionRequest.message || (isCourseSession ? '저장된 수업 신청 메모가 없습니다.' : '저장된 멘토링 요약이 없습니다.')}
              </p>
              <div className="session-meta-list">
                <span className="session-meta-pill">유형: {sessionTypeLabel}</span>
                <span className="session-meta-pill">역할: {formatSessionRole(myRole)}</span>
                <span className="session-meta-pill">상태: {formatSessionStatus(sessionRequest.status)}</span>
                <span className="session-meta-pill">
                  {sessionReferenceLabel} #{sessionRequest.id}
                </span>
                {isCourseSession && sessionRequest.courseTitle ? (
                  <span className="session-meta-pill">수업: {sessionRequest.courseTitle}</span>
                ) : null}
                {isCourseSession && sessionRequest.assignedScheduleTitle ? (
                  <span className="session-meta-pill">회차: {sessionRequest.assignedScheduleTitle}</span>
                ) : null}
                {sessionRequest.reservedAt ? (
                  <span className="session-meta-pill">
                    {sessionStartLabel}: {formatSessionTimestamp(sessionRequest.reservedAt)}
                  </span>
                ) : null}
              </div>
              <p className="app-note">
                {isCourseSession
                  ? '배정된 수업 회차에서 이어지는 세션입니다. 회차 참가자만 이 화면에서 연결과 채팅을 사용할 수 있습니다.'
                  : isReservationSession
                  ? '수락된 예약에서 이어진 세션입니다. 이 화면에서 동일한 멘토링 작업 공간을 계속 사용할 수 있습니다.'
                  : '영상 멘토링으로 넘어가기 전 이 화면에서 대화와 연결 준비를 이어갈 수 있습니다.'}
              </p>
              {sessionRequest.createdAt ? (
                <p className="app-note">생성 시각: {formatSessionTimestamp(sessionRequest.createdAt)}</p>
              ) : null}
            </div>

            <div className="session-hero__actions">
              <button
                type="button"
                className="secondary-button"
                onClick={handleEndSession}
                disabled={
                  isCourseSession
                    ? sessionExitStatus === 'ending'
                    : sessionExitStatus === 'ending' ||
                      sessionExitStatus === 'ended' ||
                      sessionRequest.status !== 'ACCEPTED' ||
                      !canUseScheduledSession
                }
              >
                {isCourseSession
                  ? '세션 나가기'
                  : sessionExitStatus === 'ending'
                  ? '세션 종료 중...'
                  : sessionRequest.status === 'COMPLETED'
                    ? '세션 종료 완료'
                    : '세션 종료'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleBackToActivity}
                disabled={sessionExitStatus === 'ending'}
              >
                내 활동으로 돌아가기
              </button>
            </div>
          </section>

          {sessionGate ? (
            <section className={`session-status-card session-status-card--${sessionGate.tone}`}>
              <div>
                <p className="session-status-card__eyebrow">
                  {isCourseSession ? '수업 세션 입장 상태' : '예약 입장 상태'}
                </p>
                <h3>{sessionGate.title}</h3>
                <p>{sessionGate.detail}</p>
              </div>
              <div className="session-status-card__meta">
                {scheduledEntryState?.reservedAt ? (
                  <span className="session-meta-pill">
                    {sessionStartLabel}: {formatSessionTimestamp(scheduledEntryState.reservedAt)}
                  </span>
                ) : null}
                {scheduledEntryState?.entryOpenAt ? (
                  <span className="session-meta-pill">
                    입장 오픈: {formatSessionTimestamp(scheduledEntryState.entryOpenAt)}
                  </span>
                ) : null}
                {scheduledEntryState?.entryCloseAt ? (
                  <span className="session-meta-pill">
                    입장 마감: {formatSessionTimestamp(scheduledEntryState.entryCloseAt)}
                  </span>
                ) : null}
              </div>
            </section>
          ) : null}

          {mediaErrorMessage ? <p className="app-error">{mediaErrorMessage}</p> : null}
          {webrtcErrorMessage ? <p className="app-error">{webrtcErrorMessage}</p> : null}
          {!mediaErrorMessage && mediaStatusMessage ? (
            <p className="app-note">{mediaStatusMessage}</p>
          ) : null}
          {!webrtcErrorMessage && webrtcStatusMessage ? (
            <p className="app-note">{webrtcStatusMessage}</p>
          ) : null}
          {actionMessage ? (
            <p className={sessionExitStatus === 'ended' ? 'app-success' : 'app-note'}>
              {actionMessage}
            </p>
          ) : null}
          {!webrtcErrorMessage ? (
            <p className="app-note">{iceServerDetailMessage}</p>
          ) : null}
          {canRetry ? (
            <p className="app-note">
              연결이 끊기면 같은 버튼으로 시그널링 소켓과 피어 연결을 다시 시도할 수 있습니다.
            </p>
          ) : null}

          <section className="session-workspace">
            <section
              className={`session-video-panel ${videoCallStatus !== 'not_connected' || hasLocalPreview ? 'session-video-panel--active' : ''}`}
            >
              <div className="session-video-header">
                <div>
                  <h2>{isCourseSession ? '영상 수업 영역' : '영상 멘토링 영역'}</h2>
                  <p className="app-note">
                    {isCourseSession
                      ? '이 영역에서 배정된 수업 회차 참가자와 영상 연결을 준비하고 상대 영상을 확인할 수 있습니다.'
                      : isReservationSession
                      ? '이 영역에서 예약 세션 참가자와 영상 연결을 준비하고 상대 영상을 확인할 수 있습니다.'
                      : '이 영역에서 시그널링과 피어 연결을 준비하고 상대 영상을 확인할 수 있습니다.'}
                  </p>
                  {(isReservationSession || isCourseSession) && !canUseScheduledSession ? (
                    <p className="app-note">
                      입장 가능 시간이 되면 이 영역의 연결 버튼과 채팅 입력이 함께 활성화됩니다.
                    </p>
                  ) : null}
                </div>
                <div className="session-video-status-list">
                  <span className="session-meta-pill">연결: {videoStatusLabel}</span>
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
                <article
                  className={`session-video-slot ${cameraOn ? 'session-video-slot--active' : ''}`}
                >
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
                  <p className="session-video-slot__state">{localVideoStatus}</p>
                </article>

                <article
                  className={`session-video-slot ${videoCallStatus !== 'not_connected' ? 'session-video-slot--active' : ''}`}
                >
                  <span className="session-video-slot__label">상대 영상</span>
                  <strong>{counterpartName || '세션 상대'}</strong>
                  <div className="session-video-stage">
                    {hasRemoteStream ? (
                      <video
                        ref={remoteVideoRef}
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
                  <p className="session-video-slot__state">{remoteVideoStatus}</p>
                </article>
              </div>

              <div className="session-video-controls">
                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    canRetry || videoCallStatus === 'error' || videoCallStatus === 'disconnected'
                      ? handleRetryVideoCall
                      : handleStartVideoCall
                  }
                  disabled={
                    sessionExitStatus === 'ending' ||
                    !canUseScheduledSession ||
                    videoCallStatus === 'preparing' ||
                    videoCallStatus === 'connecting'
                  }
                >
                  {videoCallStatus === 'connected'
                    ? '영상 연결됨'
                    : videoCallStatus === 'signaling' || videoCallStatus === 'connecting'
                      ? '연결 중...'
                      : primaryVideoActionLabel}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleToggleCamera}
                  disabled={!hasLocalPreview || sessionExitStatus === 'ending' || !canUseScheduledSession}
                >
                  {cameraOn ? '카메라 끄기' : '카메라 켜기'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleToggleMicrophone}
                  disabled={!hasLocalPreview || sessionExitStatus === 'ending' || !canUseScheduledSession}
                >
                  {microphoneOn ? '마이크 끄기' : '마이크 켜기'}
                </button>
              </div>
            </section>

            <section className="session-chat-panel">
              <div className="session-chat-header">
                <div>
                  <h2>세션 채팅</h2>
                  <p className="app-note">
                    {`상태: ${formatSessionChatStatus(sessionChatStatus)}. 이 채팅은 ${
                      sessionReferenceLabel
                    } #${sessionRequest.id} 기준으로 동작합니다.`}
                  </p>
                  {(isReservationSession || isCourseSession) && !canUseScheduledSession ? (
                    <p className="app-note">
                      입장 가능 시간이 되면 채팅 입력도 자동으로 열립니다.
                    </p>
                  ) : null}
                </div>
              </div>

              {sessionChatError ? <p className="app-error">{sessionChatError}</p> : null}

              <div className="session-chat-messages">
                {sessionMessages.length === 0 ? (
                  <p className="app-note">아직 세션 메시지가 없습니다.</p>
                ) : (
                  sessionMessages.map((message) => (
                    <article
                      key={message.id}
                      className={`session-chat-message ${message.isMine ? 'session-chat-message--mine' : ''}`}
                    >
                      <span className="session-chat-message__meta">
                        {message.isMine ? '나' : message.nickname}
                      </span>
                      <p>{message.content}</p>
                    </article>
                  ))
                )}
                <div ref={chatMessagesEndRef} />
              </div>

              <form className="session-chat-form" onSubmit={handleSessionChatSubmit}>
                <input
                  type="text"
                  className="app-input"
                  placeholder="세션에서 보낼 메시지를 입력하세요"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  disabled={
                    sessionRequest.status !== activeSessionStatus ||
                    sessionExitStatus === 'ending' ||
                    !canUseScheduledSession
                  }
                />
                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    sessionRequest.status !== activeSessionStatus ||
                    sessionExitStatus === 'ending' ||
                    !canUseScheduledSession
                  }
                >
                  전송
                </button>
              </form>
            </section>
          </section>
        </section>
      ) : (
        <p className="app-note">입장 가능한 세션을 찾지 못했습니다.</p>
      )}
    </AppLayout>
  );
}

async function loadSessionEntry(sessionId, sessionSourceHint) {
  if (sessionSourceHint === 'course_application') {
    return {
      data: await getMentorCourseApplicationSessionEntry(sessionId),
      sessionSource: 'course_application',
    };
  }

  if (sessionSourceHint === 'reservation') {
    return {
      data: await getReservationSessionEntry(sessionId),
      sessionSource: 'reservation',
    };
  }

  if (sessionSourceHint === 'request') {
    return {
      data: await getMentoringRequest(sessionId),
      sessionSource: 'request',
    };
  }

  try {
    return {
      data: await getMentoringRequest(sessionId),
      sessionSource: 'request',
    };
  } catch (requestError) {
    if (requestError?.response?.status !== 404) {
      throw requestError;
    }
  }

  try {
    return {
      data: await getReservationSessionEntry(sessionId),
      sessionSource: 'reservation',
    };
  } catch (reservationError) {
    if (reservationError?.response?.status !== 404) {
      throw reservationError;
    }
  }

  return {
    data: await getMentorCourseApplicationSessionEntry(sessionId),
    sessionSource: 'course_application',
  };
}
