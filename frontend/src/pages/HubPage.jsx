import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getMe, logout } from '../api/auth';
import {
  createSessionFeedback,
  getMySessionFeedbacks,
  getSessionFeedbackByReservationId,
  getSessionFeedbackByRequestId,
} from '../api/feedbacks';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../api/notifications';
import {
  acceptMentoringRequest,
  createMentoringRequest,
  getReceivedMentoringRequests,
  getSentMentoringRequests,
  rejectMentoringRequest,
} from '../api/mentoring';
import {
  acceptReservation,
  cancelReservation,
  createReservation,
  getMyReservations,
  getReceivedReservations,
  rejectReservation,
} from '../api/reservations';
import { getSpaces } from '../api/spaces';
import AppLayout from '../components/AppLayout';
import LobbyGame from '../components/LobbyGame';
import { getSelectedAvatarPresetId } from '../lib/avatarSelectionStorage';
import {
  dismissLobbyNotification,
  getDismissedLobbyNotificationIds,
} from '../lib/lobbyNotificationStorage';
import {
  formatLobbySpaceActionLabel,
  formatLobbySpaceLabel,
  getLobbyZoneDefinition,
  getLobbyZoneForPosition,
} from '../lib/lobbyZones';
import { getReservationEntryState } from '../lib/reservationEntryState';
import { useLobbyRealtime } from '../lib/useLobbyRealtime';
import { useAuthStore } from '../store/authStore';

function getMentoringRequestItems(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray(rawValue?.items)) {
    return rawValue.items;
  }

  if (Array.isArray(rawValue?.requests)) {
    return rawValue.requests;
  }

  return [];
}

function normalizeSentRequests(rawValue) {
  const requestItems = getMentoringRequestItems(rawValue);

  return requestItems.map((request, index) => ({
    id: request.id ?? `mentoring-request-${index}`,
    requesterId: request.requesterId ?? request.senderId ?? request.userId ?? null,
    requesterLabel:
      request.requesterNickname ||
      request.requesterName ||
      request.senderNickname ||
      request.userNickname ||
      '나',
    mentorId: request.mentorId ?? request.receiverId ?? request.targetUserId ?? null,
    mentorLabel:
      request.mentorNickname ||
      request.mentorName ||
      request.receiverNickname ||
      request.targetNickname ||
      `사용자 ${request.mentorId ?? request.receiverId ?? request.targetUserId ?? '?'}`,
    message: request.message || request.content || '',
    status: request.status || 'PENDING',
    createdAt: request.createdAt || request.timestamp || null,
  }));
}

function normalizeReceivedRequests(rawValue) {
  const requestItems = getMentoringRequestItems(rawValue);

  return requestItems.map((request, index) => ({
    id: request.id ?? `mentoring-request-${index}`,
    requesterId: request.requesterId ?? request.senderId ?? request.userId ?? null,
    requesterLabel:
      request.requesterNickname ||
      request.requesterName ||
      request.senderNickname ||
      request.userNickname ||
      `사용자 ${request.requesterId ?? request.senderId ?? request.userId ?? '?'}`,
    mentorId: request.mentorId ?? request.receiverId ?? request.targetUserId ?? null,
    mentorLabel:
      request.mentorNickname ||
      request.mentorName ||
      request.receiverNickname ||
      request.targetNickname ||
      '나',
    message: request.message || request.content || '',
    status: request.status || 'PENDING',
    createdAt: request.createdAt || request.timestamp || null,
  }));
}

function getReservationItems(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray(rawValue?.items)) {
    return rawValue.items;
  }

  if (Array.isArray(rawValue?.reservations)) {
    return rawValue.reservations;
  }

  return [];
}

function normalizeReservations(rawValue) {
  const reservationItems = getReservationItems(rawValue);

  return reservationItems.map((reservation, index) => ({
    id: reservation.id ?? `mentoring-reservation-${index}`,
    requesterId: reservation.requesterId ?? reservation.senderId ?? reservation.userId ?? null,
    requesterLabel:
      reservation.requesterLabel ||
      reservation.requesterNickname ||
      reservation.requesterName ||
      reservation.senderNickname ||
      reservation.userNickname ||
      `사용자 ${reservation.requesterId ?? reservation.senderId ?? reservation.userId ?? '?'}`,
    mentorId: reservation.mentorId ?? reservation.receiverId ?? reservation.targetUserId ?? null,
    mentorLabel:
      reservation.mentorLabel ||
      reservation.mentorNickname ||
      reservation.mentorName ||
      reservation.receiverNickname ||
      reservation.targetNickname ||
      `사용자 ${reservation.mentorId ?? reservation.receiverId ?? reservation.targetUserId ?? '?'}`,
    reservedAt: reservation.reservedAt || reservation.scheduledAt || null,
    message: reservation.message || reservation.content || '',
    status: reservation.status || 'PENDING',
    createdAt: reservation.createdAt || reservation.timestamp || null,
  }));
}

function getNotificationItems(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray(rawValue?.items)) {
    return rawValue.items;
  }

  if (Array.isArray(rawValue?.notifications)) {
    return rawValue.notifications;
  }

  return [];
}

function normalizeServerNotification(rawValue) {
  if (!rawValue) {
    return null;
  }

  const notification = rawValue.item || rawValue.notification || rawValue;

  return {
    id: notification.id ?? null,
    type: String(notification.type || '').toUpperCase(),
    title: notification.title || '',
    message: notification.message || '',
    relatedId: notification.relatedId ?? null,
    isRead: Boolean(notification.isRead ?? notification.read),
    createdAt: notification.createdAt || null,
  };
}

function normalizeServerNotifications(rawValue) {
  return getNotificationItems(rawValue)
    .map(normalizeServerNotification)
    .filter(Boolean);
}

function normalizeFeedbackPrompt(rawValue) {
  if (!rawValue) {
    return null;
  }

  const requestId = rawValue.requestId ?? rawValue.id ?? null;

  if (!requestId) {
    return null;
  }

  return {
    requestId,
    counterpartName: rawValue.counterpartName || rawValue.counterpartLabel || '세션 상대',
    role: rawValue.role || 'Participant',
    sessionSource: rawValue.sessionSource || 'request',
    reservedAt: rawValue.reservedAt || null,
    requestMessage: rawValue.requestMessage || rawValue.message || '',
  };
}

function getFeedbackItems(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray(rawValue?.items)) {
    return rawValue.items;
  }

  if (Array.isArray(rawValue?.feedbacks)) {
    return rawValue.feedbacks;
  }

  return [];
}

function normalizeServerFeedback(rawValue) {
  if (!rawValue) {
    return null;
  }

  const feedback = rawValue.item || rawValue.feedback || rawValue;

  return {
    id: feedback.id ?? null,
    requestId: feedback.requestId ?? feedback.reservationId ?? null,
    sessionSource: feedback.sessionSource || 'request',
    counterpartName:
      feedback.targetUserLabel ||
      feedback.counterpartName ||
      feedback.targetNickname ||
      '세션 상대',
    role: feedback.authorRole || feedback.role || 'Participant',
    rating: Number(feedback.rating) || 0,
    summary: feedback.summary || '',
    feedback: feedback.feedback || '',
    reservedAt: feedback.reservedAt || null,
    authorUserId: feedback.authorId ?? feedback.authorUserId ?? null,
    submittedAt: feedback.createdAt || feedback.submittedAt || null,
  };
}

function normalizeFeedbackHistory(rawValue) {
  return getFeedbackItems(rawValue)
    .map(normalizeServerFeedback)
    .filter(Boolean);
}

function sortFeedbackHistory(feedbackItems) {
  return [...feedbackItems].sort((leftFeedback, rightFeedback) => {
    const leftTime = new Date(leftFeedback.submittedAt || 0).getTime();
    const rightTime = new Date(rightFeedback.submittedAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function formatFeedbackTimestamp(value) {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
}

function formatHistorySessionLabel(feedbackItem) {
  const sessionType = feedbackItem.sessionSource === 'reservation' ? '예약' : '요청';
  return `${sessionType} #${feedbackItem.requestId}`;
}

function formatReservationTimestamp(value) {
  if (!value) {
    return '예약 시간이 없습니다';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
}

function formatParticipantRole(role) {
  if (role === 'Requester') {
    return '요청자';
  }

  if (role === 'Mentor') {
    return '멘토';
  }

  return '참여자';
}

function formatSessionSourceLabel(sessionSource) {
  return sessionSource === 'reservation' ? '예약 멘토링' : '요청 멘토링';
}

function formatRequestStatus(status) {
  if (status === 'PENDING') {
    return '대기 중';
  }

  if (status === 'ACCEPTED') {
    return '수락됨';
  }

  if (status === 'REJECTED') {
    return '거절됨';
  }

  if (status === 'COMPLETED') {
    return '종료됨';
  }

  return status || '알 수 없음';
}

function formatReservationStatus(status) {
  if (status === 'PENDING') {
    return '대기 중';
  }

  if (status === 'ACCEPTED') {
    return '수락됨';
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

function formatNotificationTypeLabel(type) {
  if (type === 'request_accepted') {
    return '요청 수락';
  }

  if (type === 'reservation_accepted') {
    return '예약 수락';
  }

  if (type === 'reservation_ready') {
    return '예약 입장 가능';
  }

  return type || '알림';
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

function getDefaultReservationDateTime() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);

  const localOffset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - localOffset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function calculateDistance(leftPosition, rightPosition) {
  if (
    !Number.isFinite(leftPosition?.x) ||
    !Number.isFinite(leftPosition?.y) ||
    !Number.isFinite(rightPosition?.x) ||
    !Number.isFinite(rightPosition?.y)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.hypot(leftPosition.x - rightPosition.x, leftPosition.y - rightPosition.y);
}

function buildLobbyNotifications({
  serverNotifications,
  sentRequests,
  reservations,
  receivedReservations,
  nowTimestamp,
  dismissedNotificationIds,
}) {
  const notifications = [];
  const notificationPriority = {
    reservation_ready: 0,
    request_accepted: 1,
    reservation_accepted: 2,
  };

  serverNotifications.forEach((notification) => {
    if (notification.isRead) {
      return;
    }

    if (notification.type === 'REQUEST_ACCEPTED') {
      const request = sentRequests.find(
        (requestItem) => String(requestItem.id) === String(notification.relatedId)
      );

      notifications.push({
        ...notification,
        source: 'server',
        type: 'request_accepted',
        actionType: request?.status === 'ACCEPTED' ? 'enter_request_session' : 'view_requests',
        actionLabel: request?.status === 'ACCEPTED' ? '세션 입장' : '요청 보기',
        request,
        title: request?.status === 'ACCEPTED' ? '멘토링 요청이 수락되었습니다' : '요청 상태가 업데이트되었습니다',
        message:
          request?.status === 'ACCEPTED'
            ? `${request?.mentorLabel || '상대방'} 님이 멘토링 요청을 수락했습니다.`
            : notification.message,
      });
      return;
    }

    if (notification.type === 'RESERVATION_ACCEPTED') {
      const reservation = reservations.find(
        (reservationItem) => String(reservationItem.id) === String(notification.relatedId)
      );
      const entryState =
        reservation?.status === 'ACCEPTED'
          ? getReservationEntryState(reservation.reservedAt, nowTimestamp)
          : null;

      if (entryState?.status === 'ready') {
        return;
      }

      notifications.push({
        ...notification,
        source: 'server',
        type: 'reservation_accepted',
        actionType: 'view_my_reservations',
        actionLabel: '예약 보기',
        reservation,
        title: '멘토링 예약이 수락되었습니다',
        message:
          reservation
            ? `${reservation.mentorLabel} 님과의 예약이 확정되었습니다.`
            : notification.message,
      });
    }
  });

  reservations.forEach((reservation) => {
    if (reservation.status !== 'ACCEPTED') {
      return;
    }

    const entryState = getReservationEntryState(reservation.reservedAt, nowTimestamp);
    const isReady = entryState.status === 'ready';

    if (!isReady) {
      return;
    }

    notifications.push({
      id: `reservation-ready-my-${reservation.id}`,
      source: 'computed',
      type: 'reservation_ready',
      title: '예약 세션 입장이 가능합니다',
      message: `${reservation.mentorLabel} 님과의 예약 세션에 지금 입장할 수 있습니다.`,
      relatedId: reservation.id,
      actionType: 'enter_reservation_session',
      actionLabel: '세션 입장',
      reservation,
      isRead: false,
      createdAt: reservation.reservedAt || reservation.createdAt || null,
    });
  });

  receivedReservations.forEach((reservation) => {
    if (reservation.status !== 'ACCEPTED') {
      return;
    }

    const entryState = getReservationEntryState(reservation.reservedAt, nowTimestamp);
    const isReady = entryState.status === 'ready';

    if (!isReady) {
      return;
    }

    notifications.push({
      id: `reservation-ready-received-${reservation.id}`,
      source: 'computed',
      type: 'reservation_ready',
      title: '수락한 예약 세션 입장이 가능합니다',
      message: `${reservation.requesterLabel} 님과의 예약 멘토링을 지금 시작할 수 있습니다.`,
      relatedId: reservation.id,
      actionType: 'enter_reservation_session',
      actionLabel: '세션 입장',
      reservation,
      isRead: false,
      createdAt: reservation.reservedAt || reservation.createdAt || null,
    });
  });

  return notifications
    .filter(
      (notification) =>
        notification.source === 'server' || !dismissedNotificationIds.includes(notification.id)
    )
    .sort((leftNotification, rightNotification) => {
      const priorityDifference =
        (notificationPriority[leftNotification.type] ?? 99) -
        (notificationPriority[rightNotification.type] ?? 99);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const leftTime = new Date(leftNotification.createdAt || 0).getTime();
      const rightTime = new Date(rightNotification.createdAt || 0).getTime();

      return rightTime - leftTime;
    });
}

export default function HubPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [lobbyNotice, setLobbyNotice] = useState(location.state?.sessionMessage || '');
  const [feedbackPrompt, setFeedbackPrompt] = useState(
    normalizeFeedbackPrompt(location.state?.feedbackPrompt)
  );
  const [feedbackRating, setFeedbackRating] = useState('5');
  const [feedbackSummary, setFeedbackSummary] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('idle');
  const [feedbackNotice, setFeedbackNotice] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [receivedReservations, setReceivedReservations] = useState([]);
  const [selectedReservationMentorId, setSelectedReservationMentorId] = useState('');
  const [reservationDateTime, setReservationDateTime] = useState(getDefaultReservationDateTime);
  const [reservationMessage, setReservationMessage] = useState('');
  const [reservationNotice, setReservationNotice] = useState('');
  const [reservationError, setReservationError] = useState('');
  const [reservationStatus, setReservationStatus] = useState('idle');
  const [activeReservationActionId, setActiveReservationActionId] = useState(null);
  const [receivedReservationNotice, setReceivedReservationNotice] = useState('');
  const [receivedReservationError, setReceivedReservationError] = useState('');
  const [activeReceivedReservationActionId, setActiveReceivedReservationActionId] =
    useState(null);
  const [serverNotifications, setServerNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState('');
  const [activeNotificationId, setActiveNotificationId] = useState(null);
  const [isReadingAllNotifications, setIsReadingAllNotifications] = useState(false);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState([]);
  const [reservationClock, setReservationClock] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [currentZoneId, setCurrentZoneId] = useState('MAIN');
  const [playerPosition, setPlayerPosition] = useState(null);
  const [zoneMoveRequest, setZoneMoveRequest] = useState(null);
  const [activeLobbyPanel, setActiveLobbyPanel] = useState('interact');
  const [activeInteractionMode, setActiveInteractionMode] = useState('request');
  const [activeActivityTab, setActiveActivityTab] = useState('received_requests');
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [selectedRemoteUserId, setSelectedRemoteUserId] = useState(null);
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [mentoringMessage, setMentoringMessage] = useState('');
  const [mentoringFeedback, setMentoringFeedback] = useState('');
  const [mentoringError, setMentoringError] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestActionError, setRequestActionError] = useState('');
  const [activeRequestActionId, setActiveRequestActionId] = useState(null);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const avatarPresetId = getSelectedAvatarPresetId(currentUser?.id);
  const chatMessagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const primarySpace = spaces[0] || null;
  const {
    connectionStatus,
    lastMessage,
    lastError,
    remoteEvent,
    remoteUsers,
    chatMessages,
    reconnectAttempt,
    sendChatMessage,
    sendUserMove,
  } =
    useLobbyRealtime({
      enabled: !isLoading && !errorMessage && Boolean(currentUser),
      userId: currentUser?.id,
      nickname: currentUser?.nickname,
      spaceId: primarySpace?.id ?? null,
      avatarPresetId,
    });

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Access token only 구조라 실패해도 로컬 세션은 정리한다.
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
    }
  };

  const focusZone = (zoneId) => {
    setZoneMoveRequest({
      zoneId,
      requestedAt: Date.now(),
    });
  };

  const focusChatComposer = (nextMessage = '') => {
    setIsChatDrawerOpen(true);

    if (nextMessage && !chatInput.trim()) {
      setChatInput(nextMessage);
    }

    window.requestAnimationFrame(() => {
      chatInputRef.current?.focus();
    });
  };

  const prepareMentoringTarget = (user) => {
    if (!user?.userId) {
      return;
    }

    setSelectedRemoteUserId(String(user.userId));
    setSelectedMentorId(String(user.userId));
    setActiveLobbyPanel('interact');
    setActiveInteractionMode('request');

    if (!mentoringMessage.trim()) {
      setMentoringMessage(`${user.label}님, 잠깐 멘토링 가능하실까요?`);
    }
  };

  const prepareReservationTarget = (user) => {
    if (!user?.userId) {
      return;
    }

    setSelectedRemoteUserId(String(user.userId));
    setSelectedReservationMentorId(String(user.userId));
    setActiveLobbyPanel('interact');
    setActiveInteractionMode('reservation');

    if (!reservationMessage.trim()) {
      setReservationMessage(`${user.label}님과 시간을 맞춰 멘토링을 진행하고 싶어요.`);
    }
  };

  const openMentoringSession = (request) => {
    navigate(`/mentoring/session/${request.id}?type=request`, {
      state: {
        request,
      },
    });
  };

  const openSpace = (space) => {
    if (!space?.id) {
      return;
    }

    navigate(`/spaces/${space.id}`, {
      state: {
        space,
      },
    });
  };

  const handleLobbySpaceEnter = (zoneId) => {
    const targetSpace = spaces.find((space) => space.type === zoneId) || null;

    if (!targetSpace) {
      setErrorMessage('이 구역에 연결된 공간 정보를 찾지 못했습니다.');
      return;
    }

    openSpace(targetSpace);
  };

  const handleNotificationAction = async (notification) => {
    if (notification.source === 'server' && !notification.isRead) {
      setActiveNotificationId(notification.id);
      setNotificationError('');

      try {
        const updatedNotification = normalizeServerNotification(
          await markNotificationAsRead(notification.id)
        );
        setServerNotifications((currentNotifications) =>
          currentNotifications.map((currentNotification) =>
            String(currentNotification.id) === String(notification.id)
              ? updatedNotification
              : currentNotification
          )
        );
      } catch (error) {
        setNotificationError(
          error?.response?.data?.message || error.message || '알림 상태를 업데이트하지 못했습니다.'
        );
        setActiveNotificationId(null);
        return;
      }

      setActiveNotificationId(null);
    }

    if (notification.actionType === 'enter_request_session' && notification.request) {
      openMentoringSession(notification.request);
      return;
    }

    if (notification.actionType === 'enter_reservation_session' && notification.reservation) {
      openReservationSession(notification.reservation);
      return;
    }

    if (notification.actionType === 'view_my_reservations') {
      openActivityPanel('my_progress');
      return;
    }

    if (notification.actionType === 'view_received_reservations') {
      openActivityPanel('received_reservations');
      return;
    }

    if (notification.actionType === 'view_requests') {
      openActivityPanel('my_progress');
    }
  };

  const handleDismissNotification = async (notification) => {
    if (notification.source === 'server') {
      if (notification.isRead) {
        return;
      }

      setActiveNotificationId(notification.id);
      setNotificationError('');

      try {
        const updatedNotification = normalizeServerNotification(
          await markNotificationAsRead(notification.id)
        );
        setServerNotifications((currentNotifications) =>
          currentNotifications.map((currentNotification) =>
            String(currentNotification.id) === String(notification.id)
              ? updatedNotification
              : currentNotification
          )
        );
      } catch (error) {
        setNotificationError(
          error?.response?.data?.message || error.message || '알림 상태를 업데이트하지 못했습니다.'
        );
      } finally {
        setActiveNotificationId(null);
      }

      return;
    }

    const nextDismissedIds = dismissLobbyNotification(currentUser?.id, notification.id);
    setDismissedNotificationIds(nextDismissedIds);
  };

  const openReservationSession = (reservation) => {
    navigate(`/mentoring/session/${reservation.id}?type=reservation`, {
      state: {
        reservation,
      },
    });
  };

  function openInteractionPanel(mode = 'request') {
    setActiveLobbyPanel('interact');
    setActiveInteractionMode(mode);
  }

  function getRecommendedActivityTab() {
    if (pendingRequestCount > 0) {
      return 'received_requests';
    }

    if (pendingReservationCount > 0) {
      return 'received_reservations';
    }

    return 'my_progress';
  }

  function openActivityPanel(preferredTab) {
    setActiveLobbyPanel('activity');
    setActiveActivityTab(preferredTab || getRecommendedActivityTab());
  }

  const mentorOptions = remoteUsers.filter((user) => user.userId !== currentUser?.id);
  const currentZone = getLobbyZoneDefinition(currentZoneId);
  const usersInCurrentZone = mentorOptions.filter(
    (user) => getLobbyZoneForPosition(user.x, user.y).id === currentZoneId
  );
  const zoneUserCounts = mentorOptions.reduce(
    (counts, user) => {
      const zoneId = getLobbyZoneForPosition(user.x, user.y).id;
      return {
        ...counts,
        [zoneId]: (counts[zoneId] || 0) + 1,
      };
    },
    {
      MAIN: 0,
      STUDY: 0,
      MENTORING: 0,
    }
  );
  const nearbyUsers = mentorOptions.filter(
    (user) => calculateDistance(playerPosition, user) <= 220
  );
  const currentZoneSpace = spaces.find((space) => space.type === currentZoneId) || null;
  const relevantInteractionUsers =
    currentZoneId === 'MENTORING'
      ? usersInCurrentZone.length > 0
        ? usersInCurrentZone
        : nearbyUsers
      : currentZoneId === 'STUDY'
        ? usersInCurrentZone
        : nearbyUsers;
  const selectedRemoteUser =
    mentorOptions.find((user) => String(user.userId) === String(selectedRemoteUserId)) || null;
  const lobbyNotifications = buildLobbyNotifications({
    serverNotifications,
    sentRequests,
    reservations,
    receivedReservations,
    nowTimestamp: reservationClock,
    dismissedNotificationIds,
  });
  const hasUnreadServerNotifications = serverNotifications.some((notification) => !notification.isRead);

  const refreshMentoringRequests = async () => {
    const [sentRequestsResponse, receivedRequestsResponse] = await Promise.all([
      getSentMentoringRequests(),
      getReceivedMentoringRequests(),
    ]);

    setSentRequests(normalizeSentRequests(sentRequestsResponse));
    setReceivedRequests(normalizeReceivedRequests(receivedRequestsResponse));
  };

  const refreshReservations = async () => {
    const [myReservationsResponse, receivedReservationsResponse] = await Promise.all([
      getMyReservations(),
      getReceivedReservations(),
    ]);

    setReservations(normalizeReservations(myReservationsResponse));
    setReceivedReservations(normalizeReservations(receivedReservationsResponse));
  };

  const refreshNotifications = async () => {
    setServerNotifications(normalizeServerNotifications(await getNotifications()));
  };

  const handleReadAllNotifications = async () => {
    setIsReadingAllNotifications(true);
    setNotificationError('');

    try {
      const updatedNotifications = normalizeServerNotifications(
        await markAllNotificationsAsRead()
      );
      const updatedNotificationMap = new Map(
        updatedNotifications.map((notification) => [String(notification.id), notification])
      );

      setServerNotifications((currentNotifications) =>
        currentNotifications.map(
          (notification) => updatedNotificationMap.get(String(notification.id)) || notification
        )
      );
      setLobbyNotice('모든 알림을 읽음 처리했습니다.');
    } catch (error) {
      setNotificationError(
        error?.response?.data?.message || error.message || '알림 전체 읽음 처리에 실패했습니다.'
      );
    } finally {
      setIsReadingAllNotifications(false);
    }
  };

  const refreshFeedbackHistory = async (userId = currentUser?.id) => {
    if (!userId) {
      setFeedbackHistory([]);
      return;
    }

    const serverFeedbacks = normalizeFeedbackHistory(await getMySessionFeedbacks());
    setFeedbackHistory(sortFeedbackHistory(serverFeedbacks));
  };

  const handleMentoringSubmit = async (event) => {
    event.preventDefault();

    if (!selectedMentorId) {
      setMentoringError('먼저 멘토 대상을 선택해 주세요.');
      setMentoringFeedback('');
      return;
    }

    setIsSubmittingRequest(true);
    setMentoringError('');
    setMentoringFeedback('');

    try {
      await createMentoringRequest({
        mentorId: Number(selectedMentorId),
        message: mentoringMessage.trim(),
      });

      await refreshMentoringRequests();
      setMentoringMessage('');
      setMentoringFeedback('멘토링 요청을 보냈습니다.');
      setLobbyNotice(
        '멘토링 요청을 보냈습니다. 상대 계정에서는 받은 요청 탭에서 바로 확인할 수 있습니다.'
      );
      openActivityPanel('my_progress');
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || '멘토링 요청 전송에 실패했습니다.';
      setMentoringError(message);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleReservationSubmit = async (event) => {
    event.preventDefault();

    if (!selectedReservationMentorId) {
      setReservationError('먼저 예약 대상을 선택해 주세요.');
      setReservationNotice('');
      return;
    }

    if (!reservationDateTime) {
      setReservationError('예약 날짜와 시간을 선택해 주세요.');
      setReservationNotice('');
      return;
    }

    setReservationStatus('saving');
    setReservationError('');
    setReservationNotice('');

    try {
      await createReservation({
        mentorId: Number(selectedReservationMentorId),
        reservedAt: new Date(reservationDateTime).toISOString(),
        message: reservationMessage.trim(),
      });

      await refreshReservations();
      setReservationMessage('');
      setReservationDateTime(getDefaultReservationDateTime());
      setReservationStatus('saved');
      setReservationNotice('예약을 생성했습니다.');
      setLobbyNotice(
        '예약 제안을 보냈습니다. 상대 계정에서는 받은 예약 탭에서 바로 확인할 수 있습니다.'
      );
      openActivityPanel('my_progress');
    } catch (error) {
      setReservationStatus('error');
      setReservationError(
        error?.response?.data?.message || error.message || '예약 생성에 실패했습니다.'
      );
    }
  };

  const handleReservationCancel = async (reservationId) => {
    setActiveReservationActionId(reservationId);
    setReservationError('');
    setReservationNotice('');

    try {
      await cancelReservation(reservationId);
      await refreshReservations();
      setReservationNotice('예약을 취소했습니다.');
    } catch (error) {
      setReservationError(
        error?.response?.data?.message || error.message || '예약 취소에 실패했습니다.'
      );
    } finally {
      setActiveReservationActionId(null);
    }
  };

  const handleReceivedReservationDecision = async (reservationId, decision) => {
    setActiveReceivedReservationActionId(reservationId);
    setReceivedReservationNotice('');
    setReceivedReservationError('');

    try {
      if (decision === 'accept') {
        await acceptReservation(reservationId);
      } else {
        await rejectReservation(reservationId);
      }

      await refreshReservations();
      setReceivedReservationNotice(
        decision === 'accept' ? '예약을 수락했습니다.' : '예약을 거절했습니다.'
      );
      setLobbyNotice(
        decision === 'accept'
          ? '예약을 수락했습니다. 예약 시간이 되면 활동이나 알림에서 세션 입장이 열립니다.'
          : '예약을 거절했습니다.'
      );
      openActivityPanel('received_reservations');
    } catch (error) {
      setReceivedReservationError(
        error?.response?.data?.message ||
          error.message ||
          '받은 예약 상태 변경에 실패했습니다.'
      );
    } finally {
      setActiveReceivedReservationActionId(null);
    }
  };

  const handleMentoringDecision = async (requestId, decision) => {
    setActiveRequestActionId(requestId);
    setRequestActionError('');

    try {
      if (decision === 'accept') {
        await acceptMentoringRequest(requestId);
      } else {
        await rejectMentoringRequest(requestId);
      }

      await refreshMentoringRequests();
      setLobbyNotice(
        decision === 'accept'
          ? '멘토링 요청을 수락했습니다. 이제 활동 패널에서 바로 세션에 입장할 수 있습니다.'
          : '멘토링 요청을 거절했습니다.'
      );
      openActivityPanel('received_requests');
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error.message ||
        '멘토링 요청 상태 변경에 실패했습니다.';
      setRequestActionError(message);
    } finally {
      setActiveRequestActionId(null);
    }
  };

  const handleChatSubmit = (event) => {
    event.preventDefault();

    const didSend = sendChatMessage(chatInput);

    if (didSend) {
      setChatInput('');
    }
  };

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();

    if (!feedbackPrompt?.requestId) {
      return;
    }

    setFeedbackStatus('saving');
    setFeedbackNotice('');
    setFeedbackError('');

    try {
      const savedFeedback = normalizeServerFeedback(
        await createSessionFeedback(
          feedbackPrompt.sessionSource === 'reservation'
            ? {
                sessionSource: 'reservation',
                reservationId: Number(feedbackPrompt.requestId),
                rating: Number(feedbackRating),
                summary: feedbackSummary.trim(),
                feedback: feedbackMessage.trim(),
              }
            : {
                requestId: Number(feedbackPrompt.requestId),
                rating: Number(feedbackRating),
                summary: feedbackSummary.trim(),
                feedback: feedbackMessage.trim(),
              }
        )
      );

      setFeedbackRating(String(savedFeedback?.rating || 5));
      setFeedbackSummary(savedFeedback?.summary || '');
      setFeedbackMessage(savedFeedback?.feedback || '');
      setFeedbackStatus('saved');
      setFeedbackNotice(
        `${formatFeedbackTimestamp(savedFeedback?.submittedAt)}에 피드백을 저장했습니다.`
      );

      setLobbyNotice('세션 피드백을 저장했습니다.');
      await refreshFeedbackHistory(currentUser?.id);
    } catch (error) {
      setFeedbackStatus('error');
      setFeedbackError(
        error?.response?.data?.message || error.message || '세션 피드백 저장에 실패했습니다.'
      );
    }
  };

  const handleDismissFeedback = () => {
    setFeedbackPrompt(null);
    setFeedbackNotice('');
    setFeedbackError('');
    setFeedbackStatus('idle');
  };

  useEffect(() => {
    let isMounted = true;

    async function loadLobbyData() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [
          meResponse,
          spacesResponse,
          sentRequestsResponse,
          receivedRequestsResponse,
          myReservationsResponse,
          receivedReservationsResponse,
          myFeedbacksResponse,
          myNotificationsResponse,
        ] =
          await Promise.all([
            getMe(),
            getSpaces(),
            getSentMentoringRequests(),
            getReceivedMentoringRequests(),
            getMyReservations(),
            getReceivedReservations(),
            getMySessionFeedbacks(),
            getNotifications(),
          ]);

        if (!isMounted) {
          return;
        }

        setCurrentUser(meResponse);
        setSpaces(spacesResponse || []);
        setSentRequests(normalizeSentRequests(sentRequestsResponse));
        setReceivedRequests(normalizeReceivedRequests(receivedRequestsResponse));
        setReservations(normalizeReservations(myReservationsResponse));
        setReceivedReservations(normalizeReservations(receivedReservationsResponse));
        setServerNotifications(normalizeServerNotifications(myNotificationsResponse));
        setFeedbackHistory(sortFeedbackHistory(normalizeFeedbackHistory(myFeedbacksResponse)));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const status = error?.response?.status;
        const message =
          error?.response?.data?.message || error.message || '허브 정보를 불러오지 못했습니다.';

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

    loadLobbyData();

    return () => {
      isMounted = false;
    };
  }, [clearAuth, navigate, setCurrentUser]);

  useEffect(() => {
    setDismissedNotificationIds(getDismissedLobbyNotificationIds(currentUser?.id));
  }, [currentUser?.id]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setReservationClock(Date.now());
    }, 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    refreshNotifications().catch(() => {
      // Initial lobby loading already exposes the main error state.
    });
    refreshFeedbackHistory(currentUser.id).catch(() => {
      // Initial lobby loading already exposes the main error state.
    });
  }, [currentUser?.id]);

  useEffect(() => {
    if (isLoading || errorMessage || !currentUser?.id) {
      return undefined;
    }

    let isCancelled = false;

    const syncLobbyState = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      try {
        const [
          sentRequestsResponse,
          receivedRequestsResponse,
          myReservationsResponse,
          receivedReservationsResponse,
          myNotificationsResponse,
        ] = await Promise.all([
          getSentMentoringRequests(),
          getReceivedMentoringRequests(),
          getMyReservations(),
          getReceivedReservations(),
          getNotifications(),
        ]);

        if (isCancelled) {
          return;
        }

        setSentRequests(normalizeSentRequests(sentRequestsResponse));
        setReceivedRequests(normalizeReceivedRequests(receivedRequestsResponse));
        setReservations(normalizeReservations(myReservationsResponse));
        setReceivedReservations(normalizeReservations(receivedReservationsResponse));
        setServerNotifications(normalizeServerNotifications(myNotificationsResponse));
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

    const intervalId = window.setInterval(syncLobbyState, 7000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [clearAuth, currentUser?.id, errorMessage, isLoading, navigate]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chatMessages]);

  useEffect(() => {
    const nextSessionMessage = location.state?.sessionMessage;
    const nextFeedbackPrompt = normalizeFeedbackPrompt(location.state?.feedbackPrompt);

    if (!nextSessionMessage && !nextFeedbackPrompt) {
      return;
    }

    if (nextSessionMessage) {
      setLobbyNotice(nextSessionMessage);
    }

    if (nextFeedbackPrompt) {
      setFeedbackPrompt(nextFeedbackPrompt);
    }

    navigate('/hub', {
      replace: true,
      state: null,
    });
  }, [location.state, navigate]);

  useEffect(() => {
    if (!feedbackPrompt?.requestId) {
      return;
    }

    let isMounted = true;

    async function loadExistingFeedback() {
      setFeedbackRating('5');
      setFeedbackSummary('');
      setFeedbackMessage('');
      setFeedbackStatus('idle');
      setFeedbackNotice('');
      setFeedbackError('');

      try {
        const existingFeedback = normalizeServerFeedback(
          feedbackPrompt.sessionSource === 'reservation'
            ? await getSessionFeedbackByReservationId(feedbackPrompt.requestId)
            : await getSessionFeedbackByRequestId(feedbackPrompt.requestId)
        );

        if (!existingFeedback || !isMounted) {
          return;
        }

        setFeedbackRating(String(existingFeedback.rating || 5));
        setFeedbackSummary(existingFeedback.summary || '');
        setFeedbackMessage(existingFeedback.feedback || '');
        setFeedbackStatus('saved');
        setFeedbackNotice(
          `${formatFeedbackTimestamp(existingFeedback.submittedAt)}에 이미 저장된 피드백입니다.`
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error?.response?.status !== 404) {
          setFeedbackError(
            error?.response?.data?.message ||
              error.message ||
              '기존 세션 피드백을 불러오지 못했습니다.'
          );
        }
      }
    }

    loadExistingFeedback();

    return () => {
      isMounted = false;
    };
  }, [feedbackPrompt]);

  useEffect(() => {
    if (!mentorOptions.length) {
      setSelectedMentorId('');
      setSelectedReservationMentorId('');
      setSelectedRemoteUserId(null);
      return;
    }

    const hasSelectedMentor = mentorOptions.some(
      (mentor) => String(mentor.userId) === String(selectedMentorId)
    );
    const hasSelectedReservationMentor = mentorOptions.some(
      (mentor) => String(mentor.userId) === String(selectedReservationMentorId)
    );

    if (!selectedMentorId || !hasSelectedMentor) {
      setSelectedMentorId(String(mentorOptions[0].userId));
    }

    if (!selectedReservationMentorId || !hasSelectedReservationMentor) {
      setSelectedReservationMentorId(String(mentorOptions[0].userId));
    }

    if (
      selectedRemoteUserId &&
      !mentorOptions.some((mentor) => String(mentor.userId) === String(selectedRemoteUserId))
    ) {
      setSelectedRemoteUserId(null);
    }
  }, [mentorOptions, selectedMentorId, selectedRemoteUserId, selectedReservationMentorId]);

  useEffect(() => {
    if (feedbackPrompt) {
      setActiveLobbyPanel('feedback');
    }
  }, [feedbackPrompt]);

  const isFeedbackLocked =
    feedbackStatus === 'saving' ||
    (Boolean(feedbackPrompt) && feedbackStatus === 'saved');
  const currentZonePopulation = zoneUserCounts[currentZoneId] || 0;
  const pendingRequestCount = receivedRequests.filter((request) => request.status === 'PENDING').length;
  const pendingReservationCount = receivedReservations.filter(
    (reservation) => reservation.status === 'PENDING'
  ).length;
  const outgoingActionCount = sentRequests.length + reservations.length;
  const incomingActionCount = receivedRequests.length + receivedReservations.length;
  const activeSessionCount =
    sentRequests.filter((request) => request.status === 'ACCEPTED').length +
    receivedRequests.filter((request) => request.status === 'ACCEPTED').length +
    reservations.filter((reservation) => reservation.status === 'ACCEPTED').length +
    receivedReservations.filter((reservation) => reservation.status === 'ACCEPTED').length;
  const openNotificationCount = lobbyNotifications.length;
  const hasInteractionHistory = outgoingActionCount + incomingActionCount > 0;
  const hasSessionHistory = feedbackHistory.length > 0 || Boolean(feedbackPrompt);
  const quickStartGuide = (() => {
    if (hasSessionHistory) {
      return {
        title: '세션 기록까지 이어지는 흐름이 준비되어 있습니다',
        description:
          '요청, 예약, 세션 종료, 피드백 저장까지 서버 기준으로 이어집니다. 기록 탭에서 최근 세션 요약도 다시 확인할 수 있습니다.',
        primaryAction: {
          label: '기록 보기',
          onClick: () => setActiveLobbyPanel('feedback'),
        },
        secondaryAction: {
          label: '활동 보기',
          onClick: () => openActivityPanel(),
        },
      };
    }

    if (activeSessionCount > 0 || openNotificationCount > 0) {
      return {
        title: '이제 세션에 입장할 수 있습니다',
        description:
          '수락된 요청이나 예약이 생겼습니다. 활동 패널이나 알림에서 세션 입장 버튼을 눌러 바로 이어가세요.',
        primaryAction: {
          label: '활동 보기',
          onClick: () => openActivityPanel('my_progress'),
        },
        secondaryAction: {
          label: '알림 보기',
          onClick: () => setActiveLobbyPanel('notifications'),
        },
      };
    }

    if (pendingRequestCount > 0 || pendingReservationCount > 0) {
      return {
        title: '받은 액션을 먼저 처리해 보세요',
        description:
          '상대 계정이 이미 연결을 시작했습니다. 받은 요청이나 예약은 몇 초 안에 반영되며, 수락하면 바로 세션 흐름으로 이어집니다.',
        primaryAction: {
          label: pendingRequestCount > 0 ? '받은 요청 보기' : '받은 예약 보기',
          onClick: () =>
            openActivityPanel(
              pendingRequestCount > 0 ? 'received_requests' : 'received_reservations'
            ),
        },
        secondaryAction: {
          label: '알림 보기',
          onClick: () => setActiveLobbyPanel('notifications'),
        },
      };
    }

    if (outgoingActionCount > 0) {
      return {
        title: '이제 상대 계정에서 수락만 기다리면 됩니다',
        description:
          '보낸 요청이나 예약은 내 진행 탭에서 계속 볼 수 있습니다. 다른 브라우저나 시크릿 창에서 상대 계정으로 받은 액션을 확인하면 몇 초 안에 상태가 갱신됩니다.',
        primaryAction: {
          label: '내 진행 보기',
          onClick: () => openActivityPanel('my_progress'),
        },
        secondaryAction: {
          label: '공개 채팅 열기',
          onClick: () => focusChatComposer('안녕하세요! 방금 요청을 보냈어요.'),
        },
      };
    }

    if (mentorOptions.length > 0) {
      return {
        title: '사람을 찾았습니다. 이제 연결을 시작해 보세요',
        description:
          '현재 로비에 보이는 사용자에게 바로 멘토링 요청을 보내거나 예약 시간을 제안할 수 있습니다.',
        primaryAction: {
          label: '멘토링 요청 열기',
          onClick: () => openInteractionPanel('request'),
        },
        secondaryAction: {
          label: '예약 제안 열기',
          onClick: () => openInteractionPanel('reservation'),
        },
      };
    }

    return {
      title: '두 번째 계정이 들어오면 바로 시연할 수 있습니다',
      description:
        '다른 브라우저나 시크릿 창에서 두 번째 계정으로 로그인하면 요청, 예약, 알림, 세션 입장 흐름을 바로 확인할 수 있습니다.',
      primaryAction: {
        label: currentZoneId === 'MAIN' ? '스터디 라운지로 이동' : '메인 광장으로 이동',
        onClick: () => focusZone(currentZoneId === 'MAIN' ? 'STUDY' : 'MAIN'),
      },
      secondaryAction: {
        label: '공개 채팅 열기',
        onClick: () => focusChatComposer('안녕하세요! 같이 이야기해보실래요?'),
      },
    };
  })();
  const quickStartSteps = [
    {
      title: '1. 사람 찾기',
      description:
        mentorOptions.length > 0
          ? `${mentorOptions.length}명의 사용자가 보입니다. 한 명을 선택해 상호작용을 시작할 수 있습니다.`
          : '다른 브라우저나 시크릿 창에서 두 번째 계정으로 로그인하면 바로 보이기 시작합니다.',
      status: mentorOptions.length > 0 ? 'done' : 'current',
    },
    {
      title: '2. 연결 시작',
      description: hasInteractionHistory
        ? `요청·예약 흐름 ${outgoingActionCount + incomingActionCount}건이 연결되어 있습니다.`
        : '멘토링 요청이나 예약 제안을 보내서 관계를 시작해 보세요.',
      status: hasInteractionHistory ? 'done' : mentorOptions.length > 0 ? 'current' : 'locked',
    },
    {
      title: '3. 세션 입장',
      description: hasSessionHistory
        ? '세션 종료 후 피드백과 기록까지 저장되는 흐름을 이미 확인했습니다.'
        : hasInteractionHistory
          ? '상대가 수락하면 활동 패널이나 알림에서 세션 입장 버튼이 열립니다.'
          : '먼저 연결을 시작하면 세션 입장 흐름으로 자연스럽게 이어집니다.',
      status: hasSessionHistory ? 'done' : hasInteractionHistory ? 'current' : 'locked',
    },
  ];

  const renderEmptyState = ({ title, description, actions = [] }) => (
    <div className="lobby-empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
      {actions.length > 0 ? (
        <div className="lobby-empty-state__actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.variant === 'primary' ? 'primary-button' : 'secondary-button'}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const renderContextActions = () => {
    if (selectedRemoteUser) {
      return (
        <div className="lobby-context-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => prepareMentoringTarget(selectedRemoteUser)}
          >
            멘토링 요청
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => prepareReservationTarget(selectedRemoteUser)}
          >
            예약 제안
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => focusChatComposer(`${selectedRemoteUser.label}님, 잠깐 이야기 가능할까요?`)}
          >
            채팅으로 말 걸기
          </button>
        </div>
      );
    }

    if (currentZoneId === 'MAIN') {
      return (
        <div className="lobby-context-actions">
          <button type="button" className="primary-button" onClick={() => focusZone('STUDY')}>
            스터디 라운지로 이동
          </button>
          <button type="button" className="secondary-button" onClick={() => focusZone('MENTORING')}>
            멘토링 존으로 이동
          </button>
          {currentZoneSpace ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => openSpace(currentZoneSpace)}
            >
              현재 공간 입장
            </button>
          ) : null}
        </div>
      );
    }

    if (currentZoneId === 'STUDY') {
      return (
        <div className="lobby-context-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => focusChatComposer('같이 스터디하실 분 계신가요?')}
          >
            스터디 메시지 쓰기
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => openActivityPanel()}
          >
            스터디 활동 보기
          </button>
          {currentZoneSpace ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => openSpace(currentZoneSpace)}
            >
              공간 입장
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <div className="lobby-context-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => openInteractionPanel('request')}
        >
          멘토링 요청 열기
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => openInteractionPanel('reservation')}
        >
          예약 제안 열기
        </button>
        {currentZoneSpace ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => openSpace(currentZoneSpace)}
          >
            공간 입장
          </button>
        ) : null}
      </div>
    );
  };

  const renderContextBody = () => {
    if (selectedRemoteUser) {
      return (
        <div className="lobby-context-body">
          <div className="lobby-selected-user-card">
            <span className="lobby-zone-card__eyebrow">선택 정보</span>
            <h3 className="lobby-context-subtitle">{selectedRemoteUser.label}</h3>
            <p>{getLobbyZoneForPosition(selectedRemoteUser.x, selectedRemoteUser.y).label}에서 활동 중입니다.</p>
            <div className="lobby-context-meta">
              <span>거리 {Math.round(calculateDistance(playerPosition, selectedRemoteUser))}px</span>
              <span>상호작용 준비 완료</span>
            </div>
            <div className="lobby-context-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedRemoteUserId(null)}
              >
                선택 해제
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (currentZoneId === 'MAIN') {
      return (
        <div className="lobby-context-body">
          <ul className="lobby-zone-stat-list">
            <li>
              <strong>메인 광장</strong>
              <span>{zoneUserCounts.MAIN}명</span>
            </li>
            <li>
              <strong>스터디 라운지</strong>
              <span>{zoneUserCounts.STUDY}명</span>
            </li>
            <li>
              <strong>멘토링 존</strong>
              <span>{zoneUserCounts.MENTORING}명</span>
            </li>
          </ul>
          <p className="app-note">
            광장은 다음 행동을 정하는 허브입니다. 사람을 확인하고 스터디 라운지나
            멘토링 존으로 이동해 보세요.
          </p>
        </div>
      );
    }

    if (currentZoneId === 'STUDY') {
      return (
        <div className="lobby-context-body">
          <h3 className="lobby-context-subtitle">같이 스터디할 사람</h3>
          {usersInCurrentZone.length === 0 ? (
            renderEmptyState({
              title: '지금은 조용한 라운지입니다',
              description:
                '공개 채팅으로 먼저 주제를 던지면, 새로 들어온 사용자가 바로 대화에 합류하기 쉬워집니다.',
              actions: [
                {
                  label: '스터디 메시지 쓰기',
                  variant: 'primary',
                  onClick: () => focusChatComposer('같이 스터디하실 분 계신가요?'),
                },
                {
                  label: '메인 광장으로 이동',
                  onClick: () => focusZone('MAIN'),
                },
              ],
            })
          ) : (
            <ul className="lobby-presence-list">
              {usersInCurrentZone.slice(0, 4).map((user) => (
                <li
                  key={user.userId}
                  className={`lobby-presence-card ${
                    String(selectedRemoteUserId) === String(user.userId)
                      ? 'lobby-presence-card--selected'
                      : ''
                  }`}
                >
                  <div>
                    <strong>{user.label}</strong>
                    <p>같은 스터디 라운지에 있습니다.</p>
                  </div>
                  <div className="lobby-presence-card__actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setSelectedRemoteUserId(String(user.userId))}
                    >
                      사용자 보기
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => focusChatComposer(`${user.label}님, 같이 스터디하실래요?`)}
                    >
                      채팅으로 부르기
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    return (
      <div className="lobby-context-body">
        <h3 className="lobby-context-subtitle">바로 상호작용할 사람</h3>
        {relevantInteractionUsers.length === 0 ? (
          renderEmptyState({
            title: '아직 가까운 사용자가 없습니다',
            description:
              '광장에서 사람을 기다리거나 스터디 라운지로 이동해 먼저 대화를 시작해 보세요. 사용자가 들어오면 여기서 바로 요청할 수 있습니다.',
            actions: [
              {
                label: '메인 광장으로 이동',
                variant: 'primary',
                onClick: () => focusZone('MAIN'),
              },
              {
                label: '스터디 라운지로 이동',
                onClick: () => focusZone('STUDY'),
              },
            ],
          })
        ) : (
          <ul className="lobby-presence-list">
            {relevantInteractionUsers.slice(0, 4).map((user) => (
              <li
                key={user.userId}
                className={`lobby-presence-card ${
                  String(selectedRemoteUserId) === String(user.userId)
                    ? 'lobby-presence-card--selected'
                    : ''
                }`}
              >
                <div>
                  <strong>{user.label}</strong>
                  <p>{getLobbyZoneForPosition(user.x, user.y).label}에 있습니다.</p>
                </div>
                <div className="lobby-presence-card__actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setSelectedRemoteUserId(String(user.userId))}
                  >
                    사용자 보기
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => prepareMentoringTarget(user)}
                  >
                    요청 준비
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => prepareReservationTarget(user)}
                  >
                    예약 준비
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const renderInteractionPanel = () => (
    <div className="lobby-panel-stack">
      <section className="lobby-panel-section">
        <div className="lobby-panel-section__header">
          <div>
            <h3>상호작용 시작</h3>
            <p className="app-note">한 번에 하나의 액션만 열어서 더 가볍게 처리합니다.</p>
          </div>
        </div>
        <div className="lobby-inline-tabs">
          <button
            type="button"
            className={activeInteractionMode === 'request' ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveInteractionMode('request')}
          >
            멘토링 요청
          </button>
          <button
            type="button"
            className={activeInteractionMode === 'reservation' ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveInteractionMode('reservation')}
          >
            예약 제안
          </button>
        </div>

        {activeInteractionMode === 'request' ? (
          <>
            <p className="app-note">현재 접속 중인 사용자에게 바로 요청을 보낼 수 있습니다.</p>
            {mentorOptions.length === 0 ? (
              renderEmptyState({
                title: '지금은 요청할 사람이 없습니다',
                description:
                  '다른 사용자가 접속하면 이곳에서 바로 멘토링 요청을 보낼 수 있습니다. 먼저 광장이나 스터디 라운지에서 사람을 찾아보세요.',
                actions: [
                  {
                    label: '메인 광장으로 이동',
                    variant: 'primary',
                    onClick: () => focusZone('MAIN'),
                  },
                  {
                    label: '채팅 열기',
                    onClick: () => focusChatComposer('안녕하세요! 같이 이야기해보실래요?'),
                  },
                ],
              })
            ) : (
              <form className="mentoring-form" onSubmit={handleMentoringSubmit}>
                <label className="app-field">
                  <span>대상 선택</span>
                  <select
                    className="app-input"
                    value={selectedMentorId}
                    onChange={(event) => setSelectedMentorId(event.target.value)}
                    disabled={isSubmittingRequest}
                  >
                    {mentorOptions.map((mentor) => (
                      <option key={mentor.userId} value={mentor.userId}>
                        {mentor.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="app-field">
                  <span>메시지</span>
                  <textarea
                    className="app-input mentoring-textarea"
                    placeholder="멘토링 요청과 함께 전달할 메시지를 입력해 주세요."
                    value={mentoringMessage}
                    onChange={(event) => setMentoringMessage(event.target.value)}
                    rows={3}
                  />
                </label>

                <button type="submit" className="primary-button" disabled={isSubmittingRequest}>
                  {isSubmittingRequest ? '전송 중...' : '요청 보내기'}
                </button>
              </form>
            )}
            {mentoringFeedback ? <p className="app-success">{mentoringFeedback}</p> : null}
            {mentoringError ? <p className="app-error">{mentoringError}</p> : null}
          </>
        ) : (
          <>
            <p className="app-note">지금 보이는 사용자를 기준으로 나중 멘토링 시간을 제안합니다.</p>
            {mentorOptions.length === 0 ? (
              renderEmptyState({
                title: '지금은 예약할 대상이 없습니다',
                description:
                  '예약은 상대가 접속해 있을 때 더 자연스럽게 제안할 수 있습니다. 먼저 멘토링 존이나 광장에서 사람을 만나보세요.',
                actions: [
                  {
                    label: '멘토링 존으로 이동',
                    variant: 'primary',
                    onClick: () => focusZone('MENTORING'),
                  },
                  {
                    label: '공개 채팅 열기',
                    onClick: () => focusChatComposer('나중에 멘토링 예약 가능하신 분 계신가요?'),
                  },
                ],
              })
            ) : (
              <form className="mentoring-form" onSubmit={handleReservationSubmit}>
                <label className="app-field">
                  <span>예약 대상</span>
                  <select
                    className="app-input"
                    value={selectedReservationMentorId}
                    onChange={(event) => setSelectedReservationMentorId(event.target.value)}
                    disabled={reservationStatus === 'saving'}
                  >
                    {mentorOptions.map((mentor) => (
                      <option key={mentor.userId} value={mentor.userId}>
                        {mentor.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="app-field">
                  <span>예약 시간</span>
                  <input
                    type="datetime-local"
                    className="app-input"
                    value={reservationDateTime}
                    onChange={(event) => setReservationDateTime(event.target.value)}
                    disabled={reservationStatus === 'saving'}
                  />
                </label>

                <label className="app-field">
                  <span>메시지</span>
                  <textarea
                    className="app-input mentoring-textarea"
                    placeholder="예: 포트폴리오 리뷰를 같이 보고 싶어요."
                    value={reservationMessage}
                    onChange={(event) => setReservationMessage(event.target.value)}
                    rows={3}
                    disabled={reservationStatus === 'saving'}
                  />
                </label>

                <button type="submit" className="primary-button" disabled={reservationStatus === 'saving'}>
                  {reservationStatus === 'saving' ? '예약 저장 중...' : '예약 만들기'}
                </button>
              </form>
            )}
            {reservationNotice ? <p className="app-success">{reservationNotice}</p> : null}
            {reservationError ? <p className="app-error">{reservationError}</p> : null}
          </>
        )}
      </section>
    </div>
  );

  const renderActivityPanel = () => (
    <div className="lobby-panel-stack">
      <section className="lobby-panel-summary-grid">
        <article className="lobby-mini-stat">
          <span>받은 요청</span>
          <strong>{pendingRequestCount}건</strong>
        </article>
        <article className="lobby-mini-stat">
          <span>받은 예약</span>
          <strong>{pendingReservationCount}건</strong>
        </article>
        <article className="lobby-mini-stat">
          <span>진행 가능 세션</span>
          <strong>{activeSessionCount}건</strong>
        </article>
      </section>

      <section className="lobby-panel-section">
        <div className="lobby-panel-section__header">
          <div>
            <h3>활동 관리</h3>
            <p className="app-note">받은 액션과 내가 진행 중인 흐름을 나눠서 확인합니다.</p>
          </div>
        </div>
        <div className="lobby-inline-tabs">
          <button
            type="button"
            className={activeActivityTab === 'received_requests' ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveActivityTab('received_requests')}
          >
            받은 요청
          </button>
          <button
            type="button"
            className={activeActivityTab === 'received_reservations' ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveActivityTab('received_reservations')}
          >
            받은 예약
          </button>
          <button
            type="button"
            className={activeActivityTab === 'my_progress' ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveActivityTab('my_progress')}
          >
            내 진행
          </button>
        </div>

        {activeActivityTab === 'received_requests' ? (
          <>
            {requestActionError ? <p className="app-error">{requestActionError}</p> : null}
            {receivedRequests.length === 0 ? (
              renderEmptyState({
                title: '아직 받은 멘토링 요청이 없습니다',
                description:
                  '멘토링 존에서 먼저 사람을 만나거나, 광장에서 대화를 시작하면 요청이 자연스럽게 들어올 수 있습니다.',
                actions: [
                  {
                    label: '멘토링 존으로 이동',
                    variant: 'primary',
                    onClick: () => focusZone('MENTORING'),
                  },
                  {
                    label: '공개 채팅 열기',
                    onClick: () => focusChatComposer('지금 멘토링 대화 가능하신 분 계신가요?'),
                  },
                ],
              })
            ) : (
              <ul className="mentoring-request-list">
                {receivedRequests.map((request) => {
                  const isPending = request.status === 'PENDING';
                  const isProcessing = activeRequestActionId === request.id;

                  return (
                    <li key={request.id} className="mentoring-request-card">
                      <strong>{request.requesterLabel}</strong>
                      <span>{formatRequestStatus(request.status)}</span>
                      <p>{request.message || '메시지가 없습니다.'}</p>
                      {isPending || request.status === 'ACCEPTED' ? (
                        <div className="mentoring-request-actions">
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                className="primary-button"
                                onClick={() => handleMentoringDecision(request.id, 'accept')}
                                disabled={isProcessing}
                              >
                                {isProcessing ? '처리 중...' : '수락'}
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => handleMentoringDecision(request.id, 'reject')}
                                disabled={isProcessing}
                              >
                                거절
                              </button>
                            </>
                          ) : null}
                          {request.status === 'ACCEPTED' ? (
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => openMentoringSession(request)}
                            >
                              세션 입장
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}

        {activeActivityTab === 'received_reservations' ? (
          <>
            {receivedReservationNotice ? <p className="app-success">{receivedReservationNotice}</p> : null}
            {receivedReservationError ? <p className="app-error">{receivedReservationError}</p> : null}
            {receivedReservations.length === 0 ? (
              renderEmptyState({
                title: '아직 받은 예약이 없습니다',
                description:
                  '지금 당장 세션을 시작하기 어렵다면, 사람들과 먼저 대화한 뒤 시간을 제안받는 흐름이 더 자연스럽습니다.',
                actions: [
                  {
                    label: '멘토링 존으로 이동',
                    variant: 'primary',
                    onClick: () => focusZone('MENTORING'),
                  },
                  {
                    label: '스터디 라운지로 이동',
                    onClick: () => focusZone('STUDY'),
                  },
                ],
              })
            ) : (
              <ul className="mentoring-request-list">
                {receivedReservations.map((reservation) => {
                  const reservationEntryState = getReservationEntryState(
                    reservation.reservedAt,
                    reservationClock
                  );
                  const isPending = reservation.status === 'PENDING';
                  const canEnterReservation =
                    reservation.status === 'ACCEPTED' && reservationEntryState.canEnter;
                  const isProcessing = activeReceivedReservationActionId === reservation.id;

                  return (
                    <li key={reservation.id} className="mentoring-request-card">
                      <strong>{reservation.requesterLabel || '알 수 없는 요청자'}</strong>
                      <span>{formatReservationStatus(reservation.status)}</span>
                      <p>{formatReservationTimestamp(reservation.reservedAt)}</p>
                      <p>{reservation.message || '예약 메시지가 없습니다.'}</p>
                      {reservation.status === 'ACCEPTED' ? <p>{reservationEntryState.label}</p> : null}
                      {isPending || canEnterReservation ? (
                        <div className="mentoring-request-actions">
                          {canEnterReservation ? (
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => openReservationSession(reservation)}
                            >
                              세션 입장
                            </button>
                          ) : null}
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                className="primary-button"
                                onClick={() =>
                                  handleReceivedReservationDecision(reservation.id, 'accept')
                                }
                                disabled={isProcessing}
                              >
                                {isProcessing ? '처리 중...' : '수락'}
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  handleReceivedReservationDecision(reservation.id, 'reject')
                                }
                                disabled={isProcessing}
                              >
                                거절
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}

        {activeActivityTab === 'my_progress' ? (
          <>
            {sentRequests.length === 0 && reservations.length === 0 ? (
              renderEmptyState({
                title: '아직 진행 중인 요청이나 예약이 없습니다',
                description:
                  '지금은 관계를 만드는 단계입니다. 광장에서 인사하거나 멘토링 존에서 먼저 말을 걸어 보세요.',
                actions: [
                  {
                    label: '멘토링 요청 열기',
                    variant: 'primary',
                    onClick: () => {
                      openInteractionPanel('request');
                      focusZone('MENTORING');
                    },
                  },
                  {
                    label: '스터디 메시지 쓰기',
                    onClick: () => focusChatComposer('같이 스터디하실 분 계신가요?'),
                  },
                ],
              })
            ) : (
              <>
                {sentRequests.length > 0 ? (
                  <ul className="mentoring-request-list">
                    {sentRequests.map((request) => (
                      <li key={request.id} className="mentoring-request-card">
                        <strong>{request.mentorLabel}</strong>
                        <span>{formatRequestStatus(request.status)}</span>
                        <p>{request.message || '메시지가 없습니다.'}</p>
                        {request.status === 'ACCEPTED' ? (
                          <div className="mentoring-request-actions">
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => openMentoringSession(request)}
                            >
                              세션 입장
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {reservations.length > 0 ? (
                  <ul className="mentoring-request-list">
                    {reservations.map((reservation) => {
                      const reservationEntryState = getReservationEntryState(
                        reservation.reservedAt,
                        reservationClock
                      );
                      const canEnterReservation =
                        reservation.status === 'ACCEPTED' && reservationEntryState.canEnter;
                      const isCancelable =
                        reservation.status === 'PENDING' ||
                        (reservation.status === 'ACCEPTED' &&
                          reservationEntryState.status !== 'expired');
                      const isProcessing = activeReservationActionId === reservation.id;

                      return (
                        <li key={reservation.id} className="mentoring-request-card">
                          <strong>{reservation.mentorLabel}</strong>
                          <span>{formatReservationStatus(reservation.status)}</span>
                          <p>{formatReservationTimestamp(reservation.reservedAt)}</p>
                          <p>{reservation.message || '예약 메시지가 없습니다.'}</p>
                          {reservation.status === 'ACCEPTED' ? (
                            <p>{reservationEntryState.label}</p>
                          ) : null}
                          {isCancelable || canEnterReservation ? (
                            <div className="mentoring-request-actions">
                              {canEnterReservation ? (
                                <button
                                  type="button"
                                  className="primary-button"
                                  onClick={() => openReservationSession(reservation)}
                                >
                                  세션 입장
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => handleReservationCancel(reservation.id)}
                                disabled={isProcessing}
                              >
                                {isProcessing ? '취소 중...' : '취소'}
                              </button>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </section>
    </div>
  );

  const renderNotificationPanel = () => (
    <div className="lobby-panel-stack">
      <section className="lobby-panel-section">
        <div className="lobby-panel-section__header">
          <div>
            <h3>알림 센터</h3>
            <p className="app-note">수락된 요청과 예약, 바로 입장 가능한 세션을 한 번에 봅니다.</p>
          </div>
          {hasUnreadServerNotifications ? (
            <button
              type="button"
              className="secondary-button"
              onClick={handleReadAllNotifications}
              disabled={isReadingAllNotifications}
            >
              {isReadingAllNotifications ? '읽음 처리 중...' : '모두 읽음'}
            </button>
          ) : null}
        </div>
        {notificationError ? <p className="app-error">{notificationError}</p> : null}
        {lobbyNotifications.length === 0 ? (
          renderEmptyState({
            title: '새 알림이 없습니다',
            description:
              '지금은 바로 확인할 변화가 없습니다. 스터디 라운지나 멘토링 존에서 먼저 사람들과 연결해 보세요.',
            actions: [
              {
                label: '스터디 라운지로 이동',
                variant: 'primary',
                onClick: () => focusZone('STUDY'),
              },
              {
                label: '멘토링 존으로 이동',
                onClick: () => focusZone('MENTORING'),
              },
            ],
          })
        ) : (
          <ul className="mentoring-request-list">
            {lobbyNotifications.map((notification) => (
              <li key={notification.id} className="mentoring-request-card">
                <strong>{notification.title}</strong>
                <span>{formatNotificationTypeLabel(notification.type)}</span>
                <p>{notification.message}</p>
                <div className="mentoring-request-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleNotificationAction(notification)}
                    disabled={activeNotificationId === notification.id}
                  >
                    {activeNotificationId === notification.id ? '처리 중...' : notification.actionLabel}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleDismissNotification(notification)}
                    disabled={activeNotificationId === notification.id}
                  >
                    {notification.source === 'server' ? '읽음 처리' : '닫기'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  const renderFeedbackPanel = () => (
    <div className="lobby-panel-stack">
      {feedbackPrompt ? (
        <section className="lobby-panel-section">
          <div className="lobby-panel-section__header">
            <div>
              <h3>이번 세션 피드백</h3>
              <p className="app-note">
                {feedbackPrompt.counterpartName} 님과의 {formatSessionSourceLabel(feedbackPrompt.sessionSource)} 후기를 남깁니다.
              </p>
            </div>
          </div>
          <p className="app-note">세션 #{feedbackPrompt.requestId}</p>
          <p className="app-note">내 역할: {formatParticipantRole(feedbackPrompt.role)}</p>
          {feedbackPrompt.requestMessage ? (
            <p className="app-note">요청 요약: {feedbackPrompt.requestMessage}</p>
          ) : null}

          <form className="mentoring-form" onSubmit={handleFeedbackSubmit}>
            <label className="app-field">
              <span>평점</span>
              <select
                className="app-input"
                value={feedbackRating}
                onChange={(event) => setFeedbackRating(event.target.value)}
                disabled={isFeedbackLocked}
              >
                <option value="5">5 - 매우 만족</option>
                <option value="4">4 - 만족</option>
                <option value="3">3 - 보통</option>
                <option value="2">2 - 아쉬움</option>
                <option value="1">1 - 불만족</option>
              </select>
            </label>

            <label className="app-field">
              <span>세션 요약</span>
              <textarea
                className="app-input mentoring-textarea"
                placeholder="이번 세션에서 다룬 내용을 짧게 정리해 주세요."
                value={feedbackSummary}
                onChange={(event) => setFeedbackSummary(event.target.value)}
                rows={2}
                disabled={isFeedbackLocked}
              />
            </label>

            <label className="app-field">
              <span>피드백</span>
              <textarea
                className="app-input mentoring-textarea"
                placeholder="세션이 어땠는지 짧은 후기를 남겨 주세요."
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                rows={3}
                disabled={isFeedbackLocked}
              />
            </label>

            <div className="mentoring-request-actions">
              <button type="submit" className="primary-button" disabled={isFeedbackLocked}>
                {feedbackStatus === 'saving'
                  ? '저장 중...'
                  : feedbackStatus === 'saved'
                    ? '저장 완료'
                    : '피드백 저장'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleDismissFeedback}
                disabled={feedbackStatus === 'saving'}
              >
                닫기
              </button>
            </div>
          </form>

          {feedbackNotice ? <p className="app-success">{feedbackNotice}</p> : null}
          {feedbackError ? <p className="app-error">{feedbackError}</p> : null}
        </section>
      ) : null}

      <section className="lobby-panel-section">
        <div className="lobby-panel-section__header">
          <div>
            <h3>최근 세션 기록</h3>
            <p className="app-note">내가 남긴 요청/예약 세션 피드백을 최근 순서대로 확인합니다.</p>
          </div>
        </div>
        {feedbackHistory.length === 0 ? (
          renderEmptyState({
            title: '아직 저장된 세션 기록이 없습니다',
            description:
              '요청이나 예약으로 세션을 마치면 이곳에 요약과 피드백이 쌓입니다. 먼저 활동을 시작해 보세요.',
            actions: [
              {
                label: '활동 보기',
                variant: 'primary',
                onClick: () => openActivityPanel(),
              },
              {
                label: '멘토링 요청 열기',
                onClick: () => openInteractionPanel('request'),
              },
            ],
          })
        ) : (
          <ul className="mentoring-request-list">
            {feedbackHistory.slice(0, 6).map((feedbackItem) => (
              <li
                key={feedbackItem.id ?? `${feedbackItem.sessionSource}-${feedbackItem.requestId}`}
                className="mentoring-request-card"
              >
                <strong>{feedbackItem.counterpartName || '세션 상대'}</strong>
                <span>{formatSessionSourceLabel(feedbackItem.sessionSource)}</span>
                <p>{formatHistorySessionLabel(feedbackItem)}</p>
                <p>저장 시각: {formatFeedbackTimestamp(feedbackItem.submittedAt)}</p>
                {feedbackItem.reservedAt ? (
                  <p>예약 시간: {formatReservationTimestamp(feedbackItem.reservedAt)}</p>
                ) : null}
                <p>평점: {feedbackItem.rating || 0}/5</p>
                <p>{feedbackItem.summary || '저장된 세션 요약이 없습니다.'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  const renderActiveLobbyPanel = () => {
    if (activeLobbyPanel === 'notifications') {
      return renderNotificationPanel();
    }

    if (activeLobbyPanel === 'activity') {
      return renderActivityPanel();
    }

    if (activeLobbyPanel === 'feedback') {
      return renderFeedbackPanel();
    }

    return renderInteractionPanel();
  };

  const renderQuickStartPanel = () => (
    <section className="lobby-guide-card">
      <div className="lobby-guide-card__header">
        <div>
          <span className="lobby-zone-card__eyebrow">빠른 시작</span>
          <h3>{quickStartGuide.title}</h3>
          <p>{quickStartGuide.description}</p>
        </div>
        <div className="lobby-guide-card__actions">
          <button
            type="button"
            className="primary-button"
            onClick={quickStartGuide.primaryAction.onClick}
          >
            {quickStartGuide.primaryAction.label}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={quickStartGuide.secondaryAction.onClick}
          >
            {quickStartGuide.secondaryAction.label}
          </button>
        </div>
      </div>

      <ol className="lobby-guide-steps">
        {quickStartSteps.map((step) => (
          <li
            key={step.title}
            className={`lobby-guide-step lobby-guide-step--${step.status}`}
          >
            <div className="lobby-guide-step__status">
              <span>
                {step.status === 'done'
                  ? '완료'
                  : step.status === 'current'
                    ? '지금'
                    : '대기'}
              </span>
            </div>
            <div className="lobby-guide-step__body">
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );

  return (
    <AppLayout
      panelClassName="app-panel--wide lobby-page-shell"
      headerHidden
    >
      <header className="lobby-topbar">
        <div className="lobby-topbar__brand">
          <span className="lobby-topbar__eyebrow">NeoSquare</span>
          <h1>사람을 만나고, 이동하고, 바로 연결되는 활동 허브</h1>
          <p>
            허브는 활동을 이어가는 화면입니다. 사람을 보고, 구역을 이동하고, 요청이나
            스터디를 바로 시작하세요.
          </p>
        </div>

        <div className="lobby-topbar__status">
          <span className="lobby-status-pill">현재 위치 · {currentZone.label}</span>
          <span className="lobby-status-pill">이 구역 접속 · {currentZonePopulation}명</span>
          <span className="lobby-status-pill">근처 사용자 · {nearbyUsers.length}명</span>
          {connectionStatus === 'reconnecting' ? (
            <span className="lobby-status-pill lobby-status-pill--warn">
              재연결 시도 {Math.max(reconnectAttempt, 1)}회
            </span>
          ) : null}
        </div>

        <div className="lobby-topbar__actions">
          <button
            type="button"
            className="secondary-button lobby-topbar__button"
            onClick={() => setActiveLobbyPanel('notifications')}
          >
            알림 {openNotificationCount > 0 ? `${openNotificationCount}` : ''}
          </button>
          <button
            type="button"
            className="secondary-button lobby-topbar__button"
            onClick={() => openActivityPanel()}
          >
            활동 {pendingRequestCount + pendingReservationCount > 0 ? `${pendingRequestCount + pendingReservationCount}` : ''}
          </button>
          <div className="lobby-topbar__user">
            {currentUser ? (
              <>
                <strong>{currentUser.nickname}</strong>
                <span>{currentUser.email}</span>
              </>
            ) : (
              <span>사용자 불러오는 중...</span>
            )}
          </div>
          <button
            type="button"
            className="primary-button lobby-topbar__button lobby-topbar__button--primary"
            onClick={handleLogout}
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="lobby-banner-stack">
        {lobbyNotice ? <p className="app-success">{lobbyNotice}</p> : null}
        {errorMessage ? <p className="app-error">{errorMessage}</p> : null}
        {lastError ? <p className="app-error">{lastError}</p> : null}
        {connectionStatus === 'reconnecting' ? (
          <div className="lobby-inline-banner lobby-inline-banner--warn">
            <div>
              <strong>실시간 연결을 다시 잡는 중입니다.</strong>
              <span>잠시 후 자동으로 복구됩니다. 이동과 채팅이 잠깐 늦을 수 있습니다.</span>
            </div>
          </div>
        ) : null}
        {feedbackPrompt ? (
          <div className="lobby-inline-banner">
            <div>
              <strong>세션 피드백을 남길 차례입니다.</strong>
              <span>
                {feedbackPrompt.counterpartName} 님과의 {formatSessionSourceLabel(feedbackPrompt.sessionSource)} 세션 기록을 저장하세요.
              </span>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setActiveLobbyPanel('feedback')}
            >
              피드백 열기
            </button>
          </div>
        ) : null}
      </div>

      <div className="lobby-dashboard">
        <section className="lobby-main-stage">
          <section className="lobby-stage lobby-stage--focused">
            <div className="lobby-stage-header lobby-stage-header--focused">
              <div>
                <span className="lobby-zone-card__eyebrow">Activity Hub</span>
                <h2>{currentZone.label}에서 무엇을 할지 정해 보세요</h2>
                <p className="app-note">{currentZone.helperText}</p>
              </div>
              <div className="lobby-zone-tabs">
                {['MAIN', 'STUDY', 'MENTORING'].map((zoneId) => (
                  <button
                    key={zoneId}
                    type="button"
                    className={
                      currentZoneId === zoneId
                        ? 'secondary-button lobby-zone-tab'
                        : 'secondary-button ghost-button lobby-zone-tab'
                    }
                    onClick={() => focusZone(zoneId)}
                  >
                    {getLobbyZoneDefinition(zoneId).label}
                  </button>
                ))}
              </div>
            </div>

            <LobbyGame
              playerLabel={currentUser?.nickname || '나'}
              avatarPresetId={avatarPresetId}
              onPlayerMove={sendUserMove}
              onZoneChange={setCurrentZoneId}
              onPlayerContextChange={(context) => {
                setCurrentZoneId(context.zoneId);
                setPlayerPosition({
                  x: context.x,
                  y: context.y,
                });
              }}
              onSpaceEnter={handleLobbySpaceEnter}
              onRemotePlayerSelect={setSelectedRemoteUserId}
              remoteEvent={remoteEvent}
              selectedRemoteUserId={selectedRemoteUserId}
              zoneMoveRequest={zoneMoveRequest}
              availableSpaceTypes={spaces.map((space) => space.type)}
            />

            <div className="lobby-stage-footer">
              <article className="lobby-stage-summary-card">
                <span className="lobby-zone-card__eyebrow">현재 구역</span>
                <strong>{currentZone.label}</strong>
                <p>{currentZone.description}</p>
                <span>
                  이 구역 접속 {currentZonePopulation}명 · 이용 가능한 공간 {isLoading ? '...' : spaces.length}개
                </span>
                <span>입구 앞에서 위쪽 방향키를 누르면 해당 공간으로 들어갑니다.</span>
              </article>

              <div className="lobby-quick-actions">
                <button
                  type="button"
                  className="primary-button lobby-quick-action lobby-quick-action--primary"
                  onClick={() => focusChatComposer('안녕하세요! 같이 이야기해보실래요?')}
                >
                  공개 채팅 열기
                </button>
                <button
                  type="button"
                  className="secondary-button lobby-quick-action"
                  onClick={() => {
                    focusZone('MENTORING');
                    openInteractionPanel('request');
                  }}
                >
                  멘토링 요청
                </button>
                <button
                  type="button"
                  className="secondary-button lobby-quick-action"
                  onClick={() => {
                    focusZone('MENTORING');
                    openInteractionPanel('reservation');
                  }}
                >
                  예약 제안
                </button>
                <button
                  type="button"
                  className="secondary-button lobby-quick-action"
                  onClick={() => openActivityPanel()}
                >
                  활동 보기
                </button>
              </div>
            </div>
          </section>

          <section className={`lobby-chat-drawer ${isChatDrawerOpen ? 'lobby-chat-drawer--open' : ''}`}>
            <div className="lobby-chat-drawer__header">
              <div>
                <h3>공개 채팅</h3>
                <p className="app-note">
                  스터디 라운지에서는 이 채팅으로 사람을 모으고, 광장에서는 가볍게 말을 걸 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                className="secondary-button lobby-chat-drawer__toggle"
                onClick={() => setIsChatDrawerOpen((currentValue) => !currentValue)}
              >
                {isChatDrawerOpen ? '접기' : '열기'}
              </button>
            </div>

            {isChatDrawerOpen ? (
              <>
                <div className="lobby-chat-messages">
                  {chatMessages.length === 0 ? (
                    renderEmptyState({
                      title: '아직 공개 채팅이 시작되지 않았습니다',
                      description:
                        '첫 메시지가 분위기를 만듭니다. 가볍게 인사하거나 스터디 주제를 먼저 던져보세요.',
                      actions: [
                        {
                          label: '가볍게 인사하기',
                          variant: 'primary',
                          onClick: () => focusChatComposer('안녕하세요! 방금 들어왔어요.'),
                        },
                        {
                          label: '스터디 모집하기',
                          onClick: () => focusChatComposer('같이 스터디하실 분 계신가요?'),
                        },
                      ],
                    })
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
                  <div ref={chatMessagesEndRef} />
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
              </>
            ) : (
              <div className="lobby-chat-drawer__preview">
                {chatMessages.length > 0 ? (
                  <p>
                    최근 메시지 ·{' '}
                    {chatMessages[chatMessages.length - 1].isMine
                      ? '나'
                      : chatMessages[chatMessages.length - 1].nickname}
                    : {chatMessages[chatMessages.length - 1].content}
                  </p>
                ) : (
                  <p>아직 채팅이 시작되지 않았습니다.</p>
                )}
              </div>
            )}
          </section>
        </section>

        <aside className="lobby-context-panel">
          <section className="lobby-context-card">
            <span className="lobby-zone-card__eyebrow">
              {selectedRemoteUser ? '선택한 사람' : '현재 위치'}
            </span>
            <h2>{selectedRemoteUser ? selectedRemoteUser.label : currentZone.label}</h2>
            <p>
              {selectedRemoteUser
                ? `${getLobbyZoneForPosition(selectedRemoteUser.x, selectedRemoteUser.y).label}에 있는 사용자입니다. 지금 바로 대화를 시작하거나 멘토링을 제안할 수 있습니다.`
                : currentZone.description}
            </p>
            <div className="lobby-context-meta">
              <span>이 구역 접속 {currentZonePopulation}명</span>
              <span>근처 사용자 {nearbyUsers.length}명</span>
              <span>열린 알림 {openNotificationCount}건</span>
            </div>
            {renderContextActions()}
            {renderContextBody()}
          </section>

          {renderQuickStartPanel()}

          <section className="lobby-side-panel">
            <div className="lobby-side-panel__tabs">
              <button
                type="button"
                className={
                  activeLobbyPanel === 'interact'
                    ? 'primary-button lobby-side-panel__tab'
                    : 'secondary-button lobby-side-panel__tab'
                }
                onClick={() => openInteractionPanel(activeInteractionMode)}
              >
                상호작용
              </button>
              <button
                type="button"
                className={
                  activeLobbyPanel === 'activity'
                    ? 'primary-button lobby-side-panel__tab'
                    : 'secondary-button lobby-side-panel__tab'
                }
                onClick={() => openActivityPanel()}
              >
                활동
              </button>
              <button
                type="button"
                className={
                  activeLobbyPanel === 'notifications'
                    ? 'primary-button lobby-side-panel__tab'
                    : 'secondary-button lobby-side-panel__tab'
                }
                onClick={() => setActiveLobbyPanel('notifications')}
              >
                알림
              </button>
              <button
                type="button"
                className={
                  activeLobbyPanel === 'feedback'
                    ? 'primary-button lobby-side-panel__tab'
                    : 'secondary-button lobby-side-panel__tab'
                }
                onClick={() => setActiveLobbyPanel('feedback')}
              >
                기록
              </button>
            </div>

            <div className="lobby-side-panel__content">{renderActiveLobbyPanel()}</div>
          </section>
        </aside>
      </div>
    </AppLayout>
  );
}
