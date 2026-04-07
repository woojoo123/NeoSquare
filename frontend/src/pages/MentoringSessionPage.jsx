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

  return (
    <AppLayout
      eyebrow="Mentoring"
      title="Mentoring session"
      description="This is the minimum session entry screen for an accepted mentoring request."
      panelClassName="app-panel--wide"
    >
      <div className="app-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => navigate('/lobby')}
        >
          Back to lobby
        </button>
      </div>

      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}

      {isLoading ? (
        <p className="app-note">Loading session...</p>
      ) : sessionRequest ? (
        <section className="session-panel">
          <div className="session-card-grid">
            <article className="session-card">
              <h2>Session partner</h2>
              <strong>{counterpartName || 'Unknown user'}</strong>
              <p className="app-note">Role: {myRole}</p>
            </article>

            <article className="session-card">
              <h2>Request status</h2>
              <strong>{sessionRequest.status}</strong>
              <p className="app-note">Request ID: {sessionRequest.id}</p>
            </article>
          </div>

          <article className="session-card">
            <h2>Request message</h2>
            <p>{sessionRequest.message || 'No message provided.'}</p>
          </article>

          <article className="session-card">
            <h2>Session guide</h2>
            <p>
              The mentoring session is ready. Session chat, scheduling, and video tools
              can be attached here in the next step.
            </p>
            {sessionRequest.createdAt ? (
              <p className="app-note">Request created at: {sessionRequest.createdAt}</p>
            ) : null}
          </article>

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
      ) : (
        <p className="app-note">No accepted mentoring request was found.</p>
      )}
    </AppLayout>
  );
}
