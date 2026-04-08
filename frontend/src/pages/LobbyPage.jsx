import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getMe } from '../api/auth';
import {
  createSessionFeedback,
  getMySessionFeedbacks,
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
    requestId: feedback.requestId ?? null,
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

export default function LobbyPage() {
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
  const chatMessagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const lobbyStageRef = useRef(null);
  const chatPanelRef = useRef(null);
  const mentoringFormRef = useRef(null);
  const reservationFormRef = useRef(null);
  const sentRequestsSectionRef = useRef(null);
  const myReservationsSectionRef = useRef(null);
  const receivedReservationsSectionRef = useRef(null);
  const primarySpace = spaces[0] || null;
  const {
    connectionStatus,
    lastMessage,
    lastError,
    remoteEvent,
    remoteUsers,
    chatMessages,
    sendChatMessage,
    sendUserMove,
  } =
    useLobbyRealtime({
      enabled: !isLoading && !errorMessage && Boolean(currentUser),
      userId: currentUser?.id,
      nickname: currentUser?.nickname,
      spaceId: primarySpace?.id ?? null,
    });

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  const scrollToSection = (sectionRef) => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const focusZone = (zoneId) => {
    setZoneMoveRequest({
      zoneId,
      requestedAt: Date.now(),
    });
    scrollToSection(lobbyStageRef);
  };

  const focusChatComposer = (nextMessage = '') => {
    scrollToSection(chatPanelRef);

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

    setSelectedMentorId(String(user.userId));

    if (!mentoringMessage.trim()) {
      setMentoringMessage(`${user.label}님, 잠깐 멘토링 가능하실까요?`);
    }

    scrollToSection(mentoringFormRef);
  };

  const prepareReservationTarget = (user) => {
    if (!user?.userId) {
      return;
    }

    setSelectedReservationMentorId(String(user.userId));

    if (!reservationMessage.trim()) {
      setReservationMessage(`${user.label}님과 시간을 맞춰 멘토링을 진행하고 싶어요.`);
    }

    scrollToSection(reservationFormRef);
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
      scrollToSection(myReservationsSectionRef);
      return;
    }

    if (notification.actionType === 'view_received_reservations') {
      scrollToSection(receivedReservationsSectionRef);
      return;
    }

    if (notification.actionType === 'view_requests') {
      scrollToSection(sentRequestsSectionRef);
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

    if (feedbackPrompt.sessionSource === 'reservation') {
      setFeedbackStatus('idle');
      setFeedbackNotice('');
      setFeedbackError(
        '예약 세션 피드백은 아직 서버 API와 연결되지 않았습니다.'
      );
      return;
    }

    setFeedbackStatus('saving');
    setFeedbackNotice('');
    setFeedbackError('');

    try {
      const savedFeedback = normalizeServerFeedback(await createSessionFeedback({
        requestId: Number(feedbackPrompt.requestId),
        rating: Number(feedbackRating),
        summary: feedbackSummary.trim(),
        feedback: feedbackMessage.trim(),
      }));

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
          error?.response?.data?.message || error.message || '로비 정보를 불러오지 못했습니다.';

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

    navigate('/lobby', {
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
        if (feedbackPrompt.sessionSource === 'reservation') {
          if (!isMounted) {
            return;
          }

          setFeedbackStatus('idle');
          setFeedbackNotice(
            '예약 세션 피드백은 예약 피드백 API가 추가되면 활성화될 예정입니다.'
          );
          return;
        }

        const existingFeedback = normalizeServerFeedback(
          await getSessionFeedbackByRequestId(feedbackPrompt.requestId)
        );

        if (!existingFeedback || !isMounted) {
          return;
        }

        setFeedbackRating(String(existingFeedback.rating || 5));
        setFeedbackSummary(existingFeedback.summary || '');
        setFeedbackMessage(existingFeedback.feedback || '');
        setFeedbackStatus('saved');
        setFeedbackNotice(
          `Feedback already saved on the server at ${formatFeedbackTimestamp(existingFeedback.submittedAt)}.`
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
  }, [mentorOptions, selectedMentorId, selectedReservationMentorId]);

  const isReservationFeedbackPrompt = feedbackPrompt?.sessionSource === 'reservation';
  const isFeedbackLocked =
    feedbackStatus === 'saving' ||
    isReservationFeedbackPrompt ||
    (Boolean(feedbackPrompt) && !isReservationFeedbackPrompt && feedbackStatus === 'saved');

  return (
    <AppLayout
      eyebrow="로비"
      title="NeoSquare 로비"
      description="현재 로그인한 사용자가 프로필, 공간, 요청, 예약, 알림 상태를 한 번에 확인할 수 있는 메인 공간입니다."
      panelClassName="app-panel--wide"
    >
      <div className="app-actions">
        <button type="button" className="primary-button" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
      {lobbyNotice ? <p className="app-success">{lobbyNotice}</p> : null}
      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}
      <div className="lobby-layout">
        <section className="lobby-sidebar">
          <div className="lobby-info-card">
            <h2>현재 사용자</h2>
            {currentUser ? (
              <>
                <strong>{currentUser.nickname}</strong>
                <span>{currentUser.email}</span>
              </>
            ) : (
              <p className="app-note">사용자 정보를 불러오는 중입니다...</p>
            )}
          </div>

          <div className="lobby-info-card">
            <h2>로비 상태</h2>
            <p className="app-note">
              메타버스 로비 화면과 내 캐릭터 이동은 이 페이지에서만 활성화됩니다.
            </p>
            <p className="app-note">
              이용 가능한 공간 수: {isLoading ? '불러오는 중...' : spaces.length}
            </p>
            <p className="app-note">
              실시간 연결 기준 공간: {primarySpace ? primarySpace.name : '선택된 공간이 없습니다'}
            </p>
          </div>

          <div className="lobby-info-card">
            <h2>알림</h2>
            {hasUnreadServerNotifications ? (
              <div className="mentoring-request-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleReadAllNotifications}
                  disabled={isReadingAllNotifications}
                >
                  {isReadingAllNotifications ? '읽음 처리 중...' : '모두 읽음 처리'}
                </button>
              </div>
            ) : null}
            {notificationError ? <p className="app-error">{notificationError}</p> : null}
            {lobbyNotifications.length === 0 ? (
              <p className="app-note">지금 확인할 중요한 알림이 없습니다.</p>
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
          </div>

          {feedbackPrompt ? (
            <div className="lobby-info-card">
              <h2>이번 세션 피드백 남기기</h2>
              <p className="app-note">
                세션 #{feedbackPrompt.requestId} · {feedbackPrompt.counterpartName}
              </p>
              <p className="app-note">내 역할: {formatParticipantRole(feedbackPrompt.role)}</p>
              {feedbackPrompt.requestMessage ? (
                <p className="app-note">
                  요청 요약: {feedbackPrompt.requestMessage}
                </p>
              ) : null}
              <p className="app-note">
                {feedbackPrompt.sessionSource === 'reservation'
                  ? '예약 세션 피드백은 아직 준비 중입니다. 기능이 열리면 이 화면에서 바로 저장할 수 있습니다.'
                  : '요청 기반 세션 피드백은 서버에 저장되며, 아래 히스토리에서도 다시 확인할 수 있습니다.'}
              </p>

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
                    placeholder="이번 멘토링 세션에서 다룬 내용을 짧게 정리해 주세요."
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
                        : feedbackPrompt.sessionSource === 'reservation'
                          ? '예약 피드백 준비 중'
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
            </div>
          ) : null}

          <div className="lobby-info-card">
            <h2>최근 세션 피드백</h2>
            {feedbackHistory.length === 0 ? (
              <p className="app-note">아직 저장된 세션 피드백이 없습니다.</p>
            ) : (
              <ul className="mentoring-request-list">
                {feedbackHistory.map((feedbackItem) => (
                  <li
                    key={feedbackItem.id ?? `${feedbackItem.sessionSource}-${feedbackItem.requestId}`}
                    className="mentoring-request-card"
                  >
                    <strong>{feedbackItem.counterpartName || '세션 상대'}</strong>
                    <span>
                      {formatSessionSourceLabel(feedbackItem.sessionSource)}
                    </span>
                    <p>{formatHistorySessionLabel(feedbackItem)}</p>
                    <p>저장 시각: {formatFeedbackTimestamp(feedbackItem.submittedAt)}</p>
                    {feedbackItem.reservedAt ? (
                      <p>예약 시간: {formatReservationTimestamp(feedbackItem.reservedAt)}</p>
                    ) : null}
                    <p>평점: {feedbackItem.rating || 0}/5</p>
                    <p>{feedbackItem.summary || '저장된 세션 요약이 없습니다.'}</p>
                    <p>{feedbackItem.feedback || '저장된 피드백 메모가 없습니다.'}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lobby-info-card">
            <h2>실시간 연결 상태</h2>
            <p className="app-note">상태: {formatRealtimeConnectionStatus(connectionStatus)}</p>
            <p className="app-note">
              마지막 이벤트: {lastMessage?.type || '서버 응답을 기다리는 중입니다...'}
            </p>
            {lastError ? <p className="app-error">{lastError}</p> : null}
            {lastMessage ? (
              <pre className="lobby-realtime-message">
                {JSON.stringify(lastMessage, null, 2)}
              </pre>
            ) : null}
          </div>

          <div className="lobby-info-card" ref={mentoringFormRef}>
            <h2>멘토링 요청</h2>
            <form className="mentoring-form" onSubmit={handleMentoringSubmit}>
              <label className="app-field">
                <span>멘토 대상</span>
                <select
                  className="app-input"
                  value={selectedMentorId}
                  onChange={(event) => setSelectedMentorId(event.target.value)}
                  disabled={mentorOptions.length === 0 || isSubmittingRequest}
                >
                  {mentorOptions.length === 0 ? (
                    <option value="">현재 로비에 선택할 수 있는 멘토가 없습니다</option>
                  ) : null}
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

              <button
                type="submit"
                className="primary-button"
                disabled={mentorOptions.length === 0 || isSubmittingRequest}
              >
                {isSubmittingRequest ? '전송 중...' : '요청 보내기'}
              </button>
            </form>
            {mentoringFeedback ? <p className="app-success">{mentoringFeedback}</p> : null}
            {mentoringError ? <p className="app-error">{mentoringError}</p> : null}
          </div>

          <div className="lobby-info-card" ref={reservationFormRef}>
            <h2>멘토링 예약</h2>
            <p className="app-note">
              현재 로비에 있는 참가자를 예약 대상으로 선택할 수 있습니다.
            </p>
            <form className="mentoring-form" onSubmit={handleReservationSubmit}>
              <label className="app-field">
                <span>예약 대상</span>
                <select
                  className="app-input"
                  value={selectedReservationMentorId}
                  onChange={(event) => setSelectedReservationMentorId(event.target.value)}
                  disabled={mentorOptions.length === 0 || reservationStatus === 'saving'}
                >
                  {mentorOptions.length === 0 ? (
                    <option value="">현재 로비에 선택할 수 있는 예약 대상이 없습니다</option>
                  ) : null}
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
                  placeholder="예: 나중에 포트폴리오 리뷰를 받고 싶어요."
                  value={reservationMessage}
                  onChange={(event) => setReservationMessage(event.target.value)}
                  rows={3}
                  disabled={reservationStatus === 'saving'}
                />
              </label>

              <button
                type="submit"
                className="primary-button"
                disabled={mentorOptions.length === 0 || reservationStatus === 'saving'}
              >
                {reservationStatus === 'saving' ? '예약 저장 중...' : '예약 만들기'}
              </button>
            </form>
            {reservationNotice ? <p className="app-success">{reservationNotice}</p> : null}
            {reservationError ? <p className="app-error">{reservationError}</p> : null}
          </div>

          <div className="lobby-info-card" ref={myReservationsSectionRef}>
            <h2>내 예약</h2>
            {reservations.length === 0 ? (
              <p className="app-note">아직 생성한 멘토링 예약이 없습니다.</p>
            ) : (
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
            )}
          </div>

          <div className="lobby-info-card" ref={receivedReservationsSectionRef}>
            <h2>받은 예약</h2>
            {receivedReservationNotice ? <p className="app-success">{receivedReservationNotice}</p> : null}
            {receivedReservationError ? <p className="app-error">{receivedReservationError}</p> : null}
            {receivedReservations.length === 0 ? (
              <p className="app-note">아직 받은 예약이 없습니다.</p>
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
                      {reservation.status === 'ACCEPTED' ? (
                        <p>{reservationEntryState.label}</p>
                      ) : null}
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
          </div>

          <div className="lobby-info-card" ref={sentRequestsSectionRef}>
            <h2>보낸 멘토링 요청</h2>
            {sentRequests.length === 0 ? (
              <p className="app-note">아직 보낸 멘토링 요청이 없습니다.</p>
            ) : (
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
            )}
          </div>

          <div className="lobby-info-card">
            <h2>받은 멘토링 요청</h2>
            {requestActionError ? <p className="app-error">{requestActionError}</p> : null}
            {receivedRequests.length === 0 ? (
              <p className="app-note">아직 받은 멘토링 요청이 없습니다.</p>
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
          </div>

          <section className="app-section">
            <h2>이용 가능한 공간</h2>
            <p className="app-note">
              공간 카드를 누르면 로비 안의 해당 구역으로 바로 이동합니다.
            </p>
            {isLoading ? <p className="app-note">공간 정보를 불러오는 중입니다...</p> : null}
            {!isLoading && spaces.length === 0 ? (
              <p className="app-note">아직 이용 가능한 공간이 없습니다.</p>
            ) : null}
            {!isLoading && spaces.length > 0 ? (
              <ul className="space-list">
                {spaces.map((space) => {
                  const isActiveSpace = currentZoneId === space.type;

                  return (
                    <li
                      key={space.id}
                      className={`space-card ${isActiveSpace ? 'space-card--active' : ''}`}
                    >
                      <div className="space-card__body">
                        <strong>{formatLobbySpaceLabel(space.type) || space.name}</strong>
                        <span>
                          최대 {space.maxCapacity}명 · 현재 {zoneUserCounts[space.type] || 0}명 접속 중
                        </span>
                        <p>{getLobbyZoneDefinition(space.type).description || space.description}</p>
                      </div>
                      <div className="space-card__actions">
                        <button
                          type="button"
                          className={isActiveSpace ? 'secondary-button' : 'primary-button'}
                          onClick={() => focusZone(space.type)}
                        >
                          {isActiveSpace ? '현재 구역' : formatLobbySpaceActionLabel(space.type)}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => openSpace(space)}
                        >
                          공간 입장
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        </section>

        <section className="lobby-stage" ref={lobbyStageRef}>
          <div className="lobby-stage-header">
            <div>
              <h2>메타버스 로비</h2>
              <p className="app-note">
                방향키로 구역을 이동하고, 현재 위치에 맞는 액션을 바로 실행해 보세요.
              </p>
            </div>
            <div className="lobby-zone-tabs">
              {['MAIN', 'STUDY', 'MENTORING'].map((zoneId) => (
                <button
                  key={zoneId}
                  type="button"
                  className={
                    currentZoneId === zoneId ? 'secondary-button' : 'secondary-button ghost-button'
                  }
                  onClick={() => focusZone(zoneId)}
                >
                  {getLobbyZoneDefinition(zoneId).label}
                </button>
              ))}
            </div>
          </div>
          <div className="lobby-stage-insights">
            <article className="lobby-zone-card">
              <span className="lobby-zone-card__eyebrow">현재 위치</span>
              <h3>{currentZone.label}</h3>
              <p>{currentZone.description}</p>
              <p className="app-note">{currentZone.helperText}</p>
              <div className="lobby-zone-actions">
                {currentZoneId === 'MAIN' ? (
                  <>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => focusZone('STUDY')}
                    >
                      스터디 라운지로 이동
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => focusZone('MENTORING')}
                    >
                      멘토링 존으로 이동
                    </button>
                    {currentZoneSpace ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openSpace(currentZoneSpace)}
                      >
                        메인 광장 입장
                      </button>
                    ) : null}
                  </>
                ) : null}
                {currentZoneId === 'STUDY' ? (
                  <>
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
                      onClick={() => focusZone('MAIN')}
                    >
                      광장으로 돌아가기
                    </button>
                    {currentZoneSpace ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openSpace(currentZoneSpace)}
                      >
                        스터디 라운지 입장
                      </button>
                    ) : null}
                  </>
                ) : null}
                {currentZoneId === 'MENTORING' ? (
                  <>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => scrollToSection(mentoringFormRef)}
                    >
                      멘토링 요청 폼 열기
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => scrollToSection(reservationFormRef)}
                    >
                      예약 제안 폼 열기
                    </button>
                    {currentZoneSpace ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openSpace(currentZoneSpace)}
                      >
                        멘토링 존 입장
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </article>

            <article className="lobby-zone-card">
              <span className="lobby-zone-card__eyebrow">구역 상호작용</span>
              {currentZoneId === 'MAIN' ? (
                <>
                  <h3>지금 어디로 갈지 정해 보세요</h3>
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
                    광장은 흐름을 고르는 허브입니다. 스터디 대화를 열거나 멘토링을 준비할 구역으로 이동해 보세요.
                  </p>
                </>
              ) : null}

              {currentZoneId === 'STUDY' ? (
                <>
                  <h3>같이 스터디할 사람</h3>
                  {usersInCurrentZone.length === 0 ? (
                    <p className="app-note">
                      아직 같은 라운지에 잡힌 사용자가 없습니다. 공개 채팅으로 먼저 모집해 보세요.
                    </p>
                  ) : (
                    <ul className="lobby-presence-list">
                      {usersInCurrentZone.slice(0, 4).map((user) => (
                        <li key={user.userId} className="lobby-presence-card">
                          <div>
                            <strong>{user.label}</strong>
                            <p>같은 스터디 라운지에 있습니다.</p>
                          </div>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              focusChatComposer(`${user.label}님, 같이 스터디하실래요?`)
                            }
                          >
                            채팅으로 부르기
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}

              {currentZoneId === 'MENTORING' ? (
                <>
                  <h3>가까운 사람에게 바로 제안하기</h3>
                  {relevantInteractionUsers.length === 0 ? (
                    <p className="app-note">
                      아직 이 구역이나 근처에 다른 사용자가 없습니다. 상대가 접속하면 바로 요청하거나 예약할 수 있습니다.
                    </p>
                  ) : (
                    <ul className="lobby-presence-list">
                      {relevantInteractionUsers.slice(0, 4).map((user) => (
                        <li key={user.userId} className="lobby-presence-card">
                          <div>
                            <strong>{user.label}</strong>
                            <p>{getLobbyZoneForPosition(user.x, user.y).label}에 있습니다.</p>
                          </div>
                          <div className="lobby-presence-card__actions">
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
                </>
              ) : null}
            </article>
          </div>
          <LobbyGame
            playerLabel={currentUser?.nickname || '나'}
            onPlayerMove={sendUserMove}
            onZoneChange={setCurrentZoneId}
            onPlayerContextChange={(context) => {
              setCurrentZoneId(context.zoneId);
              setPlayerPosition({
                x: context.x,
                y: context.y,
              });
            }}
            remoteEvent={remoteEvent}
            zoneMoveRequest={zoneMoveRequest}
          />
          <section className="lobby-chat-panel" ref={chatPanelRef}>
            <div className="lobby-chat-header">
              <div>
                <h3>로비 채팅</h3>
                <p className="app-note">
                  스터디 라운지에서는 이 채팅으로 바로 사람을 모을 수 있습니다.
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
          </section>
        </section>
      </div>
    </AppLayout>
  );
}
