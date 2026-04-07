import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { getMe } from '../api/auth';
import { getMentoringRequest } from '../api/mentoring';
import AppLayout from '../components/AppLayout';
import { getStoredMentoringReservationById } from '../lib/mentoringReservationStorage';
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
      'Requester',
    mentorId: request.mentorId ?? request.receiverId ?? request.targetUserId ?? null,
    mentorLabel:
      request.mentorNickname ||
      request.mentorName ||
      request.receiverNickname ||
      request.targetNickname ||
      'Mentor',
    reservedAt: null,
    sessionSource: 'request',
    createdAt: request.createdAt || request.timestamp || null,
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
      'Requester',
    mentorId: reservation.mentorId ?? reservation.receiverId ?? reservation.targetUserId ?? null,
    mentorLabel:
      reservation.mentorLabel ||
      reservation.mentorNickname ||
      reservation.mentorName ||
      reservation.receiverNickname ||
      reservation.targetNickname ||
      'Mentor',
    reservedAt: reservation.reservedAt || reservation.scheduledAt || null,
    sessionSource: 'reservation',
    createdAt: reservation.createdAt || reservation.timestamp || null,
  };
}

function normalizeSessionEntry(rawValue, sessionSource = 'request') {
  if (sessionSource === 'reservation') {
    return normalizeReservationSession(rawValue);
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

export default function MentoringSessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { requestId } = useParams();
  const initialSessionEntry = location.state?.reservation
    ? normalizeSessionEntry(location.state.reservation, 'reservation')
    : normalizeSessionEntry(location.state?.request, 'request');
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const [sessionRequest, setSessionRequest] = useState(initialSessionEntry);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(!initialSessionEntry);
  const [chatInput, setChatInput] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [sessionExitStatus, setSessionExitStatus] = useState('idle');
  const chatMessagesEndRef = useRef(null);
  const endSessionTimeoutRef = useRef(null);
  const isReservationSession = sessionRequest?.sessionSource === 'reservation';
  const numericSessionId = Number(requestId);
  const hasRealtimeSessionId = !isReservationSession && Number.isFinite(numericSessionId);
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
    startConnection,
    stopConnection,
  } = useSessionWebRTC({
    enabled: Boolean(hasRealtimeSessionId && sessionRequest?.id && currentUser?.id),
    requestId: hasRealtimeSessionId ? numericSessionId : null,
    userId: currentUser?.id,
    localStream,
    isInitiator: Boolean(
      sessionRequest?.requesterId && currentUser?.id === sessionRequest.requesterId
    ),
  });
  const {
    messages: sessionMessages,
    connectionStatus: sessionChatStatus,
    errorMessage: sessionChatError,
    sendMessage,
  } = useMentoringSessionChat({
    enabled: Boolean(
      !isReservationSession &&
      sessionRequest?.id &&
      sessionRequest?.status === 'ACCEPTED' &&
      currentUser?.id &&
      currentUser?.nickname
    ),
    requestId: hasRealtimeSessionId ? numericSessionId : null,
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
    if (location.state?.request || location.state?.reservation) {
      return;
    }

    let isMounted = true;

    async function loadRequestDetail() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const storedReservation = getStoredMentoringReservationById(requestId);

        if (storedReservation) {
          if (!isMounted) {
            return;
          }

          setSessionRequest(normalizeSessionEntry(storedReservation, 'reservation'));
          return;
        }

        const response = await getMentoringRequest(requestId);

        if (!isMounted) {
          return;
        }

        setSessionRequest(normalizeSessionEntry(response, 'request'));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error?.response?.data?.message ||
          error.message ||
          'Failed to load mentoring session.';
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
  }, [location.state?.request, location.state?.reservation, requestId]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [sessionMessages]);

  useEffect(() => {
    return () => {
      if (endSessionTimeoutRef.current) {
        window.clearTimeout(endSessionTimeoutRef.current);
      }
    };
  }, []);

  let myRole = 'Participant';

  if (sessionRequest && currentUser?.id === sessionRequest.requesterId) {
    myRole = 'Requester';
  } else if (sessionRequest && currentUser?.id === sessionRequest.mentorId) {
    myRole = 'Mentor';
  }

  const counterpartName =
    sessionRequest && myRole === 'Requester'
      ? sessionRequest.mentorLabel
      : sessionRequest && myRole === 'Mentor'
        ? sessionRequest.requesterLabel
        : sessionRequest?.requesterLabel || sessionRequest?.mentorLabel;

  const handleSessionChatSubmit = (event) => {
    event.preventDefault();

    const didSend = sendMessage(chatInput);

    if (didSend) {
      setChatInput('');
    }
  };

  const cleanupSessionResources = () => {
    stopConnection();
    stopLocalPreview();
  };

  const navigateToLobby = (state) => {
    if (endSessionTimeoutRef.current) {
      window.clearTimeout(endSessionTimeoutRef.current);
      endSessionTimeoutRef.current = null;
    }

    navigate('/lobby', {
      replace: true,
      state,
    });
  };

  const handleStartVideoCall = async () => {
    setActionMessage('');
    setSessionExitStatus('idle');
    const preparedStream = await startLocalPreview();

    if (!preparedStream) {
      return;
    }

    if (isReservationSession) {
      setActionMessage(
        'Local preview is ready. Reservation sessions can use this workspace now, and realtime signaling can be attached later.'
      );
      return;
    }

    if (preparedStream) {
      await startConnection(preparedStream);
    }
  };

  const handleEndSession = () => {
    if (sessionExitStatus === 'ending' || sessionExitStatus === 'ended') {
      return;
    }

    setSessionExitStatus('ending');
    setActionMessage('Ending session...');
    cleanupSessionResources();
    setSessionExitStatus('ended');
    setActionMessage('Session ended. Returning to lobby for quick feedback...');

    endSessionTimeoutRef.current = window.setTimeout(() => {
      navigateToLobby({
        refreshMentoring: true,
        sessionMessage: 'Mentoring session ended. You can leave quick feedback below.',
        feedbackPrompt: {
          requestId: sessionRequest?.id ?? requestId,
          counterpartName: counterpartName || 'Session partner',
          role: myRole,
          requestMessage: sessionRequest?.message || '',
        },
      });
    }, 900);
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

  const handleBackToLobby = () => {
    cleanupSessionResources();
    navigateToLobby({
      refreshMentoring: true,
    });
  };

  const videoStatusLabel =
    videoCallStatus === 'connected'
      ? 'Connected'
      : videoCallStatus === 'connecting'
        ? 'Connecting'
        : videoCallStatus === 'signaling'
          ? 'Signaling'
          : videoCallStatus === 'ready'
            ? 'Video call ready'
            : videoCallStatus === 'error'
              ? 'Error'
              : videoCallStatus === 'disconnected'
                ? 'Disconnected'
              : videoCallStatus === 'preparing'
                ? 'Preparing'
                : 'Not connected';

  const localMediaStatusLabel =
    localMediaStatus === 'ready'
      ? 'Local media ready'
      : localMediaStatus === 'preparing'
        ? 'Preparing local media'
        : localMediaStatus === 'error'
          ? 'Local media error'
          : 'Local media idle';

  const localVideoStatus =
    videoCallStatus === 'connected'
      ? 'Local preview is connected to the peer session.'
      : videoCallStatus === 'connecting'
        ? 'Local preview is attached. Waiting for remote stream.'
        : videoCallStatus === 'signaling'
          ? 'Offer/answer exchange is in progress.'
          : localMediaStatus === 'ready'
      ? cameraOn
        ? 'Local preview ready.'
        : 'Camera is off. Turn it on before preview.'
      : localMediaStatus === 'preparing'
        ? 'Preparing local camera and microphone.'
        : localMediaStatus === 'error' || videoCallStatus === 'error'
          ? 'Local preview could not be prepared.'
          : 'Camera off';

  const remoteVideoStatus =
    hasRemoteStream
      ? 'Remote stream connected.'
      : videoCallStatus === 'connecting'
        ? 'Connecting remote stream...'
        : videoCallStatus === 'signaling'
          ? 'Waiting for offer/answer exchange.'
          : videoCallStatus === 'disconnected'
            ? 'Remote participant is offline or the call was interrupted.'
            : videoCallStatus === 'error'
              ? 'Remote connection failed. Retry the session call.'
          : videoCallStatus === 'preparing'
            ? 'Preparing peer connection.'
            : 'Remote not connected';

  return (
    <AppLayout
      eyebrow="Mentoring"
      title="Mentoring session"
      description="This is the minimum session entry screen for an accepted mentoring request."
      panelClassName="app-panel--wide"
    >
      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}

      {isLoading ? (
        <p className="app-note">Loading session...</p>
      ) : sessionRequest ? (
        <section className="session-panel">
          <section className="session-hero">
            <div className="session-hero__main">
              <p className="session-hero__eyebrow">
                {isReservationSession ? 'Reservation session' : 'Session ready'}
              </p>
              <h2>{counterpartName || 'Unknown user'}</h2>
              <p className="session-hero__summary">
                {sessionRequest.message || 'No mentoring request summary was provided.'}
              </p>
              <div className="session-meta-list">
                <span className="session-meta-pill">
                  Type: {isReservationSession ? 'Scheduled mentoring' : 'Request mentoring'}
                </span>
                <span className="session-meta-pill">Role: {myRole}</span>
                <span className="session-meta-pill">Status: {sessionRequest.status}</span>
                <span className="session-meta-pill">
                  {isReservationSession ? 'Reservation' : 'Request'} #{sessionRequest.id}
                </span>
                {sessionRequest.reservedAt ? (
                  <span className="session-meta-pill">
                    Reserved for: {formatSessionTimestamp(sessionRequest.reservedAt)}
                  </span>
                ) : null}
              </div>
              <p className="app-note">
                {isReservationSession
                  ? 'This session was opened from an accepted reservation. You can continue with the same mentoring workspace here.'
                  : 'You can continue the conversation here before moving into video mentoring.'}
              </p>
              {sessionRequest.createdAt ? (
                <p className="app-note">Request created at: {sessionRequest.createdAt}</p>
              ) : null}
            </div>

            <div className="session-hero__actions">
              <button
                type="button"
                className="secondary-button"
                onClick={handleEndSession}
                disabled={sessionExitStatus === 'ending' || sessionExitStatus === 'ended'}
              >
                {sessionExitStatus === 'ending' ? 'Ending session...' : 'End session'}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleBackToLobby}
                disabled={sessionExitStatus === 'ending'}
              >
                Back to lobby
              </button>
            </div>
          </section>

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

          <section className="session-workspace">
            <section
              className={`session-video-panel ${videoCallStatus !== 'not_connected' || hasLocalPreview ? 'session-video-panel--active' : ''}`}
            >
              <div className="session-video-header">
                <div>
                  <h2>Video mentoring area</h2>
                  <p className="app-note">
                    {isReservationSession
                      ? 'Local preview is available here. Reservation sessions can attach realtime signaling later.'
                      : 'Prepare signaling, peer connection, and remote video here.'}
                  </p>
                </div>
                <div className="session-video-status-list">
                  <span className="session-meta-pill">Connection: {videoStatusLabel}</span>
                  <span className="session-meta-pill">Local: {localMediaStatusLabel}</span>
                  <span className="session-meta-pill">Camera: {cameraOn ? 'On' : 'Off'}</span>
                  <span className="session-meta-pill">Microphone: {microphoneOn ? 'On' : 'Off'}</span>
                  {lastSignalType ? (
                    <span className="session-meta-pill">Last signal: {lastSignalType}</span>
                  ) : null}
                </div>
              </div>

              <div className="session-video-grid">
                <article
                  className={`session-video-slot ${cameraOn ? 'session-video-slot--active' : ''}`}
                >
                  <span className="session-video-slot__label">Local video</span>
                  <strong>{currentUser?.nickname || 'You'}</strong>
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
                        <span>Local preview unavailable</span>
                      </div>
                    )}
                  </div>
                  <p className="session-video-slot__state">{localVideoStatus}</p>
                </article>

                <article
                  className={`session-video-slot ${videoCallStatus !== 'not_connected' ? 'session-video-slot--active' : ''}`}
                >
                  <span className="session-video-slot__label">Remote video</span>
                  <strong>{counterpartName || 'Session partner'}</strong>
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
                        <span>Remote preview will appear here</span>
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
                  onClick={handleStartVideoCall}
                  disabled={
                    sessionExitStatus === 'ending' ||
                    videoCallStatus === 'preparing' ||
                    videoCallStatus === 'connecting'
                  }
                >
                  {videoCallStatus === 'connected'
                    ? 'Video connected'
                    : videoCallStatus === 'error' || videoCallStatus === 'disconnected'
                      ? 'Retry connection'
                      : videoCallStatus === 'ready'
                        ? 'Start signaling'
                        : videoCallStatus === 'signaling' || videoCallStatus === 'connecting'
                          ? 'Connecting...'
                    : videoCallStatus === 'error'
                      ? 'Retry connection'
                      : 'Start video call'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleToggleCamera}
                  disabled={!hasLocalPreview || sessionExitStatus === 'ending'}
                >
                  {cameraOn ? 'Turn camera off' : 'Turn camera on'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleToggleMicrophone}
                  disabled={!hasLocalPreview || sessionExitStatus === 'ending'}
                >
                  {microphoneOn ? 'Mute microphone' : 'Turn microphone on'}
                </button>
              </div>
            </section>

            <section className="session-chat-panel">
              <div className="session-chat-header">
                <div>
                  <h2>Session chat</h2>
                  <p className="app-note">
                    {isReservationSession
                      ? 'Reservation sessions currently reuse the page layout first. Session chat can be attached after reservation-backed realtime ids are added.'
                      : `Status: ${sessionChatStatus}. This chat is scoped to request #${sessionRequest.id}.`}
                  </p>
                </div>
              </div>

              {sessionChatError ? <p className="app-error">{sessionChatError}</p> : null}

              <div className="session-chat-messages">
                {sessionMessages.length === 0 ? (
                  <p className="app-note">No session messages yet.</p>
                ) : (
                  sessionMessages.map((message) => (
                    <article
                      key={message.id}
                      className={`session-chat-message ${message.isMine ? 'session-chat-message--mine' : ''}`}
                    >
                      <span className="session-chat-message__meta">
                        {message.isMine ? 'You' : message.nickname}
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
                  placeholder="Type a mentoring session message"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  disabled={
                    isReservationSession ||
                    sessionRequest.status !== 'ACCEPTED' ||
                    sessionExitStatus === 'ending'
                  }
                />
                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    isReservationSession ||
                    sessionRequest.status !== 'ACCEPTED' ||
                    sessionExitStatus === 'ending'
                  }
                >
                  Send
                </button>
              </form>
            </section>
          </section>
        </section>
      ) : (
        <p className="app-note">No accepted mentoring request was found.</p>
      )}
    </AppLayout>
  );
}
