import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { getMe } from '../api/auth';
import { getMentoringRequest } from '../api/mentoring';
import AppLayout from '../components/AppLayout';
import { useMentoringSessionChat } from '../lib/useMentoringSessionChat';
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
    createdAt: request.createdAt || request.timestamp || null,
  };
}

export default function MentoringSessionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { requestId } = useParams();
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const [sessionRequest, setSessionRequest] = useState(
    normalizeSessionRequest(location.state?.request)
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(!location.state?.request);
  const [chatInput, setChatInput] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [videoCallStatus, setVideoCallStatus] = useState('not_connected');
  const [cameraOn, setCameraOn] = useState(false);
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const chatMessagesEndRef = useRef(null);
  const {
    messages: sessionMessages,
    connectionStatus: sessionChatStatus,
    errorMessage: sessionChatError,
    sendMessage,
  } = useMentoringSessionChat({
    enabled: Boolean(
      sessionRequest?.id &&
      sessionRequest?.status === 'ACCEPTED' &&
      currentUser?.id &&
      currentUser?.nickname
    ),
    requestId: Number(requestId),
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
    if (location.state?.request) {
      return;
    }

    let isMounted = true;

    async function loadRequestDetail() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await getMentoringRequest(requestId);

        if (!isMounted) {
          return;
        }

        setSessionRequest(normalizeSessionRequest(response));
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
  }, [location.state?.request, requestId]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [sessionMessages]);

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

  const handleStartVideoCall = () => {
    setVideoCallStatus((currentStatus) => {
      if (currentStatus === 'not_connected') {
        setActionMessage('Preparing video call UI. Media streams are not connected yet.');
        return 'preparing';
      }

      setActionMessage('Video call layout is ready. Connect WebRTC on this step next.');
      return 'ready';
    });
  };

  const handleEndSession = () => {
    setActionMessage('Session end flow is not connected yet. Use Back to lobby to leave this screen for now.');
  };

  const handleToggleCamera = () => {
    setCameraOn((currentValue) => {
      const nextValue = !currentValue;
      setActionMessage(nextValue ? 'Camera placeholder turned on.' : 'Camera placeholder turned off.');
      return nextValue;
    });
  };

  const handleToggleMicrophone = () => {
    setMicrophoneOn((currentValue) => {
      const nextValue = !currentValue;
      setActionMessage(
        nextValue ? 'Microphone placeholder turned on.' : 'Microphone placeholder muted.'
      );
      return nextValue;
    });
  };

  const videoStatusLabel =
    videoCallStatus === 'ready'
      ? 'Video call ready'
      : videoCallStatus === 'preparing'
        ? 'Preparing video call'
        : 'Not connected';

  const localVideoStatus =
    videoCallStatus === 'ready'
      ? cameraOn
        ? 'Local preview slot is ready for stream.'
        : 'Camera is off. Turn it on before preview.'
      : videoCallStatus === 'preparing'
        ? cameraOn
          ? 'Camera placeholder is active while preparing.'
          : 'Camera off while preparing.'
        : cameraOn
          ? 'Camera on. Start the call to prepare local preview.'
          : 'Camera off';

  const remoteVideoStatus =
    videoCallStatus === 'ready'
      ? 'Remote slot is ready for the other participant.'
      : videoCallStatus === 'preparing'
        ? 'Waiting for remote connection.'
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
              <p className="session-hero__eyebrow">Session ready</p>
              <h2>{counterpartName || 'Unknown user'}</h2>
              <p className="session-hero__summary">
                {sessionRequest.message || 'No mentoring request summary was provided.'}
              </p>
              <div className="session-meta-list">
                <span className="session-meta-pill">Role: {myRole}</span>
                <span className="session-meta-pill">Status: {sessionRequest.status}</span>
                <span className="session-meta-pill">Request #{sessionRequest.id}</span>
              </div>
              <p className="app-note">
                You can continue the conversation here before moving into video mentoring.
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
              >
                End session
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate('/lobby')}
              >
                Back to lobby
              </button>
            </div>
          </section>

          {actionMessage ? <p className="app-note">{actionMessage}</p> : null}

          <section className="session-workspace">
            <section
              className={`session-video-panel ${videoCallStatus !== 'not_connected' ? 'session-video-panel--active' : ''}`}
            >
              <div className="session-video-header">
                <div>
                  <h2>Video mentoring area</h2>
                  <p className="app-note">
                    Prepare the local and remote video slots here before attaching WebRTC.
                  </p>
                </div>
                <div className="session-video-status-list">
                  <span className="session-meta-pill">Connection: {videoStatusLabel}</span>
                  <span className="session-meta-pill">Camera: {cameraOn ? 'On' : 'Off'}</span>
                  <span className="session-meta-pill">Microphone: {microphoneOn ? 'On' : 'Off'}</span>
                </div>
              </div>

              <div className="session-video-grid">
                <article
                  className={`session-video-slot ${cameraOn ? 'session-video-slot--active' : ''}`}
                >
                  <span className="session-video-slot__label">Local video</span>
                  <strong>{currentUser?.nickname || 'You'}</strong>
                  <p className="session-video-slot__state">{localVideoStatus}</p>
                </article>

                <article
                  className={`session-video-slot ${videoCallStatus !== 'not_connected' ? 'session-video-slot--active' : ''}`}
                >
                  <span className="session-video-slot__label">Remote video</span>
                  <strong>{counterpartName || 'Session partner'}</strong>
                  <p className="session-video-slot__state">{remoteVideoStatus}</p>
                </article>
              </div>

              <div className="session-video-controls">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleStartVideoCall}
                >
                  {videoCallStatus === 'not_connected' ? 'Start video call' : 'Prepare video panel'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleToggleCamera}
                >
                  {cameraOn ? 'Turn camera off' : 'Turn camera on'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleToggleMicrophone}
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
                    Status: {sessionChatStatus}. This chat is scoped to request #{sessionRequest.id}.
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
                  disabled={sessionRequest.status !== 'ACCEPTED'}
                />
                <button
                  type="submit"
                  className="primary-button"
                  disabled={sessionRequest.status !== 'ACCEPTED'}
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
