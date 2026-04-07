import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { getMentoringRequest } from '../api/mentoring';
import AppLayout from '../components/AppLayout';
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
  const [sessionRequest, setSessionRequest] = useState(
    normalizeSessionRequest(location.state?.request)
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(!location.state?.request);

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

  const myRole =
    sessionRequest && currentUser?.id === sessionRequest.requesterId ? 'Requester' : 'Mentor';
  const counterpartName =
    sessionRequest && myRole === 'Requester'
      ? sessionRequest.mentorLabel
      : sessionRequest?.requesterLabel;

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
        </section>
      ) : (
        <p className="app-note">No accepted mentoring request was found.</p>
      )}
    </AppLayout>
  );
}
