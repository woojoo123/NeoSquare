import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getMe } from '../api/auth';
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
import { getMentoringReservationEntryState } from '../lib/mentoringReservationStorage';
import {
  dismissLobbyNotification,
  getDismissedLobbyNotificationIds,
} from '../lib/lobbyNotificationStorage';
import { useLobbyRealtime } from '../lib/useLobbyRealtime';
import {
  getStoredSessionFeedback,
  getStoredSessionFeedbacks,
  saveSessionFeedback,
} from '../lib/sessionFeedbackStorage';
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
      'You',
    mentorId: request.mentorId ?? request.receiverId ?? request.targetUserId ?? null,
    mentorLabel:
      request.mentorNickname ||
      request.mentorName ||
      request.receiverNickname ||
      request.targetNickname ||
      `User ${request.mentorId ?? request.receiverId ?? request.targetUserId ?? '?'}`,
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
      `User ${request.requesterId ?? request.senderId ?? request.userId ?? '?'}`,
    mentorId: request.mentorId ?? request.receiverId ?? request.targetUserId ?? null,
    mentorLabel:
      request.mentorNickname ||
      request.mentorName ||
      request.receiverNickname ||
      request.targetNickname ||
      'You',
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
      `User ${reservation.requesterId ?? reservation.senderId ?? reservation.userId ?? '?'}`,
    mentorId: reservation.mentorId ?? reservation.receiverId ?? reservation.targetUserId ?? null,
    mentorLabel:
      reservation.mentorLabel ||
      reservation.mentorNickname ||
      reservation.mentorName ||
      reservation.receiverNickname ||
      reservation.targetNickname ||
      `User ${reservation.mentorId ?? reservation.receiverId ?? reservation.targetUserId ?? '?'}`,
    reservedAt: reservation.reservedAt || reservation.scheduledAt || null,
    message: reservation.message || reservation.content || '',
    status: reservation.status || 'PENDING',
    createdAt: reservation.createdAt || reservation.timestamp || null,
  }));
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
    counterpartName: rawValue.counterpartName || rawValue.counterpartLabel || 'Session partner',
    role: rawValue.role || 'Participant',
    sessionSource: rawValue.sessionSource || 'request',
    reservedAt: rawValue.reservedAt || null,
    requestMessage: rawValue.requestMessage || rawValue.message || '',
  };
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
  const sessionType = feedbackItem.sessionSource === 'reservation' ? 'Reservation' : 'Request';
  return `${sessionType} #${feedbackItem.requestId}`;
}

function formatReservationTimestamp(value) {
  if (!value) {
    return 'No reservation time';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
}

function getDefaultReservationDateTime() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);

  const localOffset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - localOffset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function buildLobbyNotifications({
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

  sentRequests.forEach((request) => {
    if (request.status !== 'ACCEPTED') {
      return;
    }

    notifications.push({
      id: `request-accepted-${request.id}`,
      type: 'request_accepted',
      title: 'Mentoring request accepted',
      message: `${request.mentorLabel} accepted your mentoring request.`,
      relatedId: request.id,
      actionType: 'enter_request_session',
      actionLabel: 'Enter session',
      request,
    });
  });

  reservations.forEach((reservation) => {
    if (reservation.status !== 'ACCEPTED') {
      return;
    }

    const entryState = getMentoringReservationEntryState(reservation.reservedAt, nowTimestamp);
    const isReady = entryState.status === 'ready';

    notifications.push({
      id: `${isReady ? 'reservation-ready' : 'reservation-accepted'}-my-${reservation.id}`,
      type: isReady ? 'reservation_ready' : 'reservation_accepted',
      title: isReady ? 'Reservation ready' : 'Reservation accepted',
      message: isReady
        ? `${reservation.mentorLabel} reservation is ready to enter.`
        : `${reservation.mentorLabel} reservation was accepted. ${entryState.label}`,
      relatedId: reservation.id,
      actionType: isReady ? 'enter_reservation_session' : 'view_my_reservations',
      actionLabel: isReady ? 'Enter session' : 'View reservation',
      reservation,
    });
  });

  receivedReservations.forEach((reservation) => {
    if (reservation.status !== 'ACCEPTED') {
      return;
    }

    const entryState = getMentoringReservationEntryState(reservation.reservedAt, nowTimestamp);
    const isReady = entryState.status === 'ready';

    notifications.push({
      id: `${isReady ? 'reservation-ready' : 'reservation-accepted'}-received-${reservation.id}`,
      type: isReady ? 'reservation_ready' : 'reservation_accepted',
      title: isReady ? 'Accepted reservation is ready' : 'Accepted reservation',
      message: isReady
        ? `Scheduled mentoring with ${reservation.requesterLabel} can start now.`
        : `Accepted reservation with ${reservation.requesterLabel}. ${entryState.label}`,
      relatedId: reservation.id,
      actionType: isReady ? 'enter_reservation_session' : 'view_received_reservations',
      actionLabel: isReady ? 'Enter session' : 'View reservation',
      reservation,
    });
  });

  return notifications
    .filter((notification) => !dismissedNotificationIds.includes(notification.id))
    .sort(
      (leftNotification, rightNotification) =>
        (notificationPriority[leftNotification.type] ?? 99) -
        (notificationPriority[rightNotification.type] ?? 99)
    );
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
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState([]);
  const [reservationClock, setReservationClock] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
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

  const openMentoringSession = (request) => {
    navigate(`/mentoring/session/${request.id}?type=request`, {
      state: {
        request,
      },
    });
  };

  const handleNotificationAction = (notification) => {
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

  const handleDismissNotification = (notificationId) => {
    const nextDismissedIds = dismissLobbyNotification(currentUser?.id, notificationId);
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
  const lobbyNotifications = buildLobbyNotifications({
    sentRequests,
    reservations,
    receivedReservations,
    nowTimestamp: reservationClock,
    dismissedNotificationIds,
  });

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

  const reloadFeedbackHistory = (userId = currentUser?.id) => {
    setFeedbackHistory(getStoredSessionFeedbacks(userId));
  };

  const handleMentoringSubmit = async (event) => {
    event.preventDefault();

    if (!selectedMentorId) {
      setMentoringError('Select a mentor target first.');
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
      setMentoringFeedback('Mentoring request sent.');
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || 'Failed to send mentoring request.';
      setMentoringError(message);
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleReservationSubmit = async (event) => {
    event.preventDefault();

    if (!selectedReservationMentorId) {
      setReservationError('Select a reservation target first.');
      setReservationNotice('');
      return;
    }

    if (!reservationDateTime) {
      setReservationError('Choose a reservation date and time.');
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
      setReservationNotice('Reservation created.');
    } catch (error) {
      setReservationStatus('error');
      setReservationError(
        error?.response?.data?.message || error.message || 'Failed to create reservation.'
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
      setReservationNotice('Reservation canceled.');
    } catch (error) {
      setReservationError(
        error?.response?.data?.message || error.message || 'Failed to cancel reservation.'
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
        decision === 'accept' ? 'Reservation accepted.' : 'Reservation rejected.'
      );
    } catch (error) {
      setReceivedReservationError(
        error?.response?.data?.message ||
          error.message ||
          'Failed to update received reservation.'
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
        'Failed to update mentoring request status.';
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
      const savedFeedback = saveSessionFeedback({
        requestId: feedbackPrompt.requestId,
        counterpartName: feedbackPrompt.counterpartName,
        role: feedbackPrompt.role,
        sessionSource: feedbackPrompt.sessionSource || 'request',
        reservedAt: feedbackPrompt.reservedAt || null,
        authorUserId: currentUser?.id,
        rating: feedbackRating,
        summary: feedbackSummary.trim(),
        feedback: feedbackMessage.trim(),
      });

      setFeedbackRating(String(savedFeedback.rating || 5));
      setFeedbackSummary(savedFeedback.summary || '');
      setFeedbackMessage(savedFeedback.feedback || '');
      setFeedbackStatus('saved');
      setFeedbackNotice(
        `Feedback saved in this browser at ${formatFeedbackTimestamp(savedFeedback.submittedAt)}.`
      );
      setLobbyNotice('Session feedback saved.');
      reloadFeedbackHistory(currentUser?.id);
    } catch (error) {
      setFeedbackStatus('error');
      setFeedbackError(error.message || 'Failed to save session feedback.');
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
        ] =
          await Promise.all([
            getMe(),
            getSpaces(),
            getSentMentoringRequests(),
            getReceivedMentoringRequests(),
            getMyReservations(),
            getReceivedReservations(),
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
        setFeedbackHistory(getStoredSessionFeedbacks(meResponse?.id));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const status = error?.response?.status;
        const message =
          error?.response?.data?.message || error.message || 'Failed to load lobby.';

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
    reloadFeedbackHistory(currentUser?.id);
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

    const storedFeedback = getStoredSessionFeedback(feedbackPrompt.requestId);

    if (storedFeedback) {
      setFeedbackRating(String(storedFeedback.rating || 5));
      setFeedbackSummary(storedFeedback.summary || '');
      setFeedbackMessage(storedFeedback.feedback || '');
      setFeedbackStatus('saved');
      setFeedbackNotice(
        `Feedback already saved in this browser at ${formatFeedbackTimestamp(storedFeedback.submittedAt)}.`
      );
      setFeedbackError('');
      return;
    }

    setFeedbackRating('5');
    setFeedbackSummary('');
    setFeedbackMessage('');
    setFeedbackStatus('idle');
    setFeedbackNotice('');
    setFeedbackError('');
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

  return (
    <AppLayout
      eyebrow="Lobby"
      title="NeoSquare lobby"
      description="Authenticated users can load their profile and the current public spaces from the backend."
      panelClassName="app-panel--wide"
    >
      <div className="app-actions">
        <button type="button" className="primary-button" onClick={handleLogout}>
          Sign out
        </button>
      </div>
      {lobbyNotice ? <p className="app-success">{lobbyNotice}</p> : null}
      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}
      <div className="lobby-layout">
        <section className="lobby-sidebar">
          <div className="lobby-info-card">
            <h2>Current user</h2>
            {currentUser ? (
              <>
                <strong>{currentUser.nickname}</strong>
                <span>{currentUser.email}</span>
              </>
            ) : (
              <p className="app-note">Loading user...</p>
            )}
          </div>

          <div className="lobby-info-card">
            <h2>Lobby status</h2>
            <p className="app-note">
              Phaser canvas and local player movement are active only on this page.
            </p>
            <p className="app-note">
              Available spaces: {isLoading ? 'Loading...' : spaces.length}
            </p>
            <p className="app-note">
              Active space for realtime: {primarySpace ? primarySpace.name : 'No space selected'}
            </p>
          </div>

          <div className="lobby-info-card">
            <h2>Notifications</h2>
            {lobbyNotifications.length === 0 ? (
              <p className="app-note">No important notifications right now.</p>
            ) : (
              <ul className="mentoring-request-list">
                {lobbyNotifications.map((notification) => (
                  <li key={notification.id} className="mentoring-request-card">
                    <strong>{notification.title}</strong>
                    <span>{notification.type}</span>
                    <p>{notification.message}</p>
                    <div className="mentoring-request-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => handleNotificationAction(notification)}
                      >
                        {notification.actionLabel}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleDismissNotification(notification.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {feedbackPrompt ? (
            <div className="lobby-info-card">
              <h2>Leave feedback for this session</h2>
              <p className="app-note">
                Session #{feedbackPrompt.requestId} with {feedbackPrompt.counterpartName}
              </p>
              <p className="app-note">Your role: {feedbackPrompt.role}</p>
              {feedbackPrompt.requestMessage ? (
                <p className="app-note">
                  Request summary: {feedbackPrompt.requestMessage}
                </p>
              ) : null}
              <p className="app-note">
                This fallback stores feedback in this browser until a dedicated review API is
                added.
              </p>

              <form className="mentoring-form" onSubmit={handleFeedbackSubmit}>
                <label className="app-field">
                  <span>Rating</span>
                  <select
                    className="app-input"
                    value={feedbackRating}
                    onChange={(event) => setFeedbackRating(event.target.value)}
                    disabled={feedbackStatus === 'saving'}
                  >
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Okay</option>
                    <option value="2">2 - Needs work</option>
                    <option value="1">1 - Poor</option>
                  </select>
                </label>

                <label className="app-field">
                  <span>Session summary</span>
                  <textarea
                    className="app-input mentoring-textarea"
                    placeholder="Summarize what you covered in this mentoring session."
                    value={feedbackSummary}
                    onChange={(event) => setFeedbackSummary(event.target.value)}
                    rows={2}
                    disabled={feedbackStatus === 'saving'}
                  />
                </label>

                <label className="app-field">
                  <span>Feedback</span>
                  <textarea
                    className="app-input mentoring-textarea"
                    placeholder="Leave a short note about how the session went."
                    value={feedbackMessage}
                    onChange={(event) => setFeedbackMessage(event.target.value)}
                    rows={3}
                    disabled={feedbackStatus === 'saving'}
                  />
                </label>

                <div className="mentoring-request-actions">
                  <button type="submit" className="primary-button" disabled={feedbackStatus === 'saving'}>
                    {feedbackStatus === 'saving'
                      ? 'Saving feedback...'
                      : feedbackStatus === 'saved'
                        ? 'Update feedback'
                        : 'Save feedback'}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleDismissFeedback}
                    disabled={feedbackStatus === 'saving'}
                  >
                    Dismiss
                  </button>
                </div>
              </form>

              {feedbackNotice ? <p className="app-success">{feedbackNotice}</p> : null}
              {feedbackError ? <p className="app-error">{feedbackError}</p> : null}
            </div>
          ) : null}

          <div className="lobby-info-card">
            <h2>Recent session feedback</h2>
            {feedbackHistory.length === 0 ? (
              <p className="app-note">No feedback history yet.</p>
            ) : (
              <ul className="mentoring-request-list">
                {feedbackHistory.map((feedbackItem) => (
                  <li key={feedbackItem.requestId} className="mentoring-request-card">
                    <strong>{feedbackItem.counterpartName || 'Session partner'}</strong>
                    <span>
                      {feedbackItem.sessionSource === 'reservation'
                        ? 'Scheduled mentoring'
                        : 'Request mentoring'}
                    </span>
                    <p>{formatHistorySessionLabel(feedbackItem)}</p>
                    <p>Saved at: {formatFeedbackTimestamp(feedbackItem.submittedAt)}</p>
                    {feedbackItem.reservedAt ? (
                      <p>Reserved for: {formatReservationTimestamp(feedbackItem.reservedAt)}</p>
                    ) : null}
                    <p>Rating: {feedbackItem.rating || 0}/5</p>
                    <p>{feedbackItem.summary || 'No session summary was saved.'}</p>
                    <p>{feedbackItem.feedback || 'No feedback note was saved.'}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lobby-info-card">
            <h2>Realtime connection</h2>
            <p className="app-note">Status: {connectionStatus}</p>
            <p className="app-note">
              Last event: {lastMessage?.type || 'Waiting for server response...'}
            </p>
            {lastError ? <p className="app-error">{lastError}</p> : null}
            {lastMessage ? (
              <pre className="lobby-realtime-message">
                {JSON.stringify(lastMessage, null, 2)}
              </pre>
            ) : null}
          </div>

          <div className="lobby-info-card">
            <h2>Mentoring request</h2>
            <form className="mentoring-form" onSubmit={handleMentoringSubmit}>
              <label className="app-field">
                <span>Mentor target</span>
                <select
                  className="app-input"
                  value={selectedMentorId}
                  onChange={(event) => setSelectedMentorId(event.target.value)}
                  disabled={mentorOptions.length === 0 || isSubmittingRequest}
                >
                  {mentorOptions.length === 0 ? (
                    <option value="">No mentor candidates in lobby</option>
                  ) : null}
                  {mentorOptions.map((mentor) => (
                    <option key={mentor.userId} value={mentor.userId}>
                      {mentor.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="app-field">
                <span>Message</span>
                <textarea
                  className="app-input mentoring-textarea"
                  placeholder="Can you help me with a mentoring session?"
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
                {isSubmittingRequest ? 'Sending...' : 'Send request'}
              </button>
            </form>
            {mentoringFeedback ? <p className="app-success">{mentoringFeedback}</p> : null}
            {mentoringError ? <p className="app-error">{mentoringError}</p> : null}
          </div>

          <div className="lobby-info-card">
            <h2>Mentoring reservation</h2>
            <p className="app-note">
              Use the current lobby participants as temporary reservation targets.
            </p>
            <form className="mentoring-form" onSubmit={handleReservationSubmit}>
              <label className="app-field">
                <span>Reservation target</span>
                <select
                  className="app-input"
                  value={selectedReservationMentorId}
                  onChange={(event) => setSelectedReservationMentorId(event.target.value)}
                  disabled={mentorOptions.length === 0 || reservationStatus === 'saving'}
                >
                  {mentorOptions.length === 0 ? (
                    <option value="">No mentor candidates in lobby</option>
                  ) : null}
                  {mentorOptions.map((mentor) => (
                    <option key={mentor.userId} value={mentor.userId}>
                      {mentor.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="app-field">
                <span>Reservation time</span>
                <input
                  type="datetime-local"
                  className="app-input"
                  value={reservationDateTime}
                  onChange={(event) => setReservationDateTime(event.target.value)}
                  disabled={reservationStatus === 'saving'}
                />
              </label>

              <label className="app-field">
                <span>Message</span>
                <textarea
                  className="app-input mentoring-textarea"
                  placeholder="I'd like to schedule a portfolio review for later."
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
                {reservationStatus === 'saving' ? 'Saving reservation...' : 'Create reservation'}
              </button>
            </form>
            {reservationNotice ? <p className="app-success">{reservationNotice}</p> : null}
            {reservationError ? <p className="app-error">{reservationError}</p> : null}
          </div>

          <div className="lobby-info-card" ref={myReservationsSectionRef}>
            <h2>My reservations</h2>
            {reservations.length === 0 ? (
              <p className="app-note">No mentoring reservations yet.</p>
            ) : (
              <ul className="mentoring-request-list">
                {reservations.map((reservation) => {
                  const reservationEntryState = getMentoringReservationEntryState(
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
                      <span>{reservation.status}</span>
                      <p>{formatReservationTimestamp(reservation.reservedAt)}</p>
                      <p>{reservation.message || 'No reservation message provided.'}</p>
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
                              Enter session
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleReservationCancel(reservation.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Canceling...' : 'Cancel'}
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
            <h2>Received reservations</h2>
            {receivedReservationNotice ? <p className="app-success">{receivedReservationNotice}</p> : null}
            {receivedReservationError ? <p className="app-error">{receivedReservationError}</p> : null}
            {receivedReservations.length === 0 ? (
              <p className="app-note">No received reservations yet.</p>
            ) : (
              <ul className="mentoring-request-list">
                {receivedReservations.map((reservation) => {
                  const reservationEntryState = getMentoringReservationEntryState(
                    reservation.reservedAt,
                    reservationClock
                  );
                  const isPending = reservation.status === 'PENDING';
                  const canEnterReservation =
                    reservation.status === 'ACCEPTED' && reservationEntryState.canEnter;
                  const isProcessing = activeReceivedReservationActionId === reservation.id;

                  return (
                    <li key={reservation.id} className="mentoring-request-card">
                      <strong>{reservation.requesterLabel || 'Unknown requester'}</strong>
                      <span>{reservation.status}</span>
                      <p>{formatReservationTimestamp(reservation.reservedAt)}</p>
                      <p>{reservation.message || 'No reservation message provided.'}</p>
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
                              Enter session
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
                                {isProcessing ? 'Processing...' : 'Accept'}
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  handleReceivedReservationDecision(reservation.id, 'reject')
                                }
                                disabled={isProcessing}
                              >
                                Reject
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
            <h2>Sent mentoring requests</h2>
            {sentRequests.length === 0 ? (
              <p className="app-note">No mentoring requests sent yet.</p>
            ) : (
              <ul className="mentoring-request-list">
                {sentRequests.map((request) => (
                  <li key={request.id} className="mentoring-request-card">
                    <strong>{request.mentorLabel}</strong>
                    <span>{request.status}</span>
                    <p>{request.message || 'No message provided.'}</p>
                    {request.status === 'ACCEPTED' ? (
                      <div className="mentoring-request-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => openMentoringSession(request)}
                        >
                          Enter session
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lobby-info-card">
            <h2>Received mentoring requests</h2>
            {requestActionError ? <p className="app-error">{requestActionError}</p> : null}
            {receivedRequests.length === 0 ? (
              <p className="app-note">No mentoring requests received yet.</p>
            ) : (
              <ul className="mentoring-request-list">
                {receivedRequests.map((request) => {
                  const isPending = request.status === 'PENDING';
                  const isProcessing = activeRequestActionId === request.id;

                  return (
                    <li key={request.id} className="mentoring-request-card">
                      <strong>{request.requesterLabel}</strong>
                      <span>{request.status}</span>
                      <p>{request.message || 'No message provided.'}</p>
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
                                {isProcessing ? 'Processing...' : 'Accept'}
                              </button>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => handleMentoringDecision(request.id, 'reject')}
                                disabled={isProcessing}
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                          {request.status === 'ACCEPTED' ? (
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => openMentoringSession(request)}
                            >
                              Enter session
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
            <h2>Available spaces</h2>
            {isLoading ? <p className="app-note">Loading spaces...</p> : null}
            {!isLoading && spaces.length === 0 ? (
              <p className="app-note">No spaces are available yet.</p>
            ) : null}
            {!isLoading && spaces.length > 0 ? (
              <ul className="space-list">
                {spaces.map((space) => (
                  <li key={space.id} className="space-card">
                    <strong>{space.name}</strong>
                    <span>
                      {space.type} · capacity {space.maxCapacity}
                    </span>
                    <p>{space.description}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </section>

        <section className="lobby-stage">
          <div className="lobby-stage-header">
            <div>
              <h2>Metaverse lobby</h2>
              <p className="app-note">
                This is the minimum NeoSquare lobby scene. Use the arrow keys to move
                your character.
              </p>
            </div>
          </div>
          <LobbyGame
            playerLabel={currentUser?.nickname || 'You'}
            onPlayerMove={sendUserMove}
            remoteEvent={remoteEvent}
          />
          <section className="lobby-chat-panel">
            <div className="lobby-chat-header">
              <div>
                <h3>Lobby chat</h3>
                <p className="app-note">
                  Messages are sent through the current lobby WebSocket connection.
                </p>
              </div>
            </div>

            <div className="lobby-chat-messages">
              {chatMessages.length === 0 ? (
                <p className="app-note">No chat messages yet.</p>
              ) : (
                chatMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`chat-message ${message.isMine ? 'chat-message--mine' : ''}`}
                  >
                    <span className="chat-message__meta">
                      {message.isMine ? 'You' : message.nickname}
                    </span>
                    <p>{message.content}</p>
                  </article>
                ))
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            <form className="lobby-chat-form" onSubmit={handleChatSubmit}>
              <input
                type="text"
                className="app-input"
                placeholder="Type a message"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
              />
              <button type="submit" className="primary-button">
                Send
              </button>
            </form>
          </section>
        </section>
      </div>
    </AppLayout>
  );
}
