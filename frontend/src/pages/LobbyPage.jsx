import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getMe } from '../api/auth';
import {
  acceptMentoringRequest,
  createMentoringRequest,
  getReceivedMentoringRequests,
  getSentMentoringRequests,
  rejectMentoringRequest,
} from '../api/mentoring';
import { getSpaces } from '../api/spaces';
import AppLayout from '../components/AppLayout';
import LobbyGame from '../components/LobbyGame';
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
    mentorId: request.mentorId ?? request.receiverId ?? request.targetUserId ?? null,
    mentorLabel:
      request.mentorNickname ||
      request.mentorName ||
      request.receiverNickname ||
      request.targetNickname ||
      `User ${request.mentorId ?? request.receiverId ?? request.targetUserId ?? '?'}`,
    message: request.message || request.content || '',
    status: request.status || 'PENDING',
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
    message: request.message || request.content || '',
    status: request.status || 'PENDING',
  }));
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
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

  const mentorOptions = remoteUsers.filter((user) => user.userId !== currentUser?.id);

  const refreshMentoringRequests = async () => {
    const [sentRequestsResponse, receivedRequestsResponse] = await Promise.all([
      getSentMentoringRequests(),
      getReceivedMentoringRequests(),
    ]);

    setSentRequests(normalizeSentRequests(sentRequestsResponse));
    setReceivedRequests(normalizeReceivedRequests(receivedRequestsResponse));
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

  useEffect(() => {
    let isMounted = true;

    async function loadLobbyData() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [meResponse, spacesResponse, sentRequestsResponse, receivedRequestsResponse] =
          await Promise.all([
          getMe(),
          getSpaces(),
          getSentMentoringRequests(),
          getReceivedMentoringRequests(),
        ]);

        if (!isMounted) {
          return;
        }

        setCurrentUser(meResponse);
        setSpaces(spacesResponse || []);
        setSentRequests(normalizeSentRequests(sentRequestsResponse));
        setReceivedRequests(normalizeReceivedRequests(receivedRequestsResponse));
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
    chatMessagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chatMessages]);

  useEffect(() => {
    if (!mentorOptions.length) {
      setSelectedMentorId('');
      return;
    }

    const hasSelectedMentor = mentorOptions.some(
      (mentor) => String(mentor.userId) === String(selectedMentorId)
    );

    if (!selectedMentorId || !hasSelectedMentor) {
      setSelectedMentorId(String(mentorOptions[0].userId));
    }
  }, [mentorOptions, selectedMentorId]);

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
                      {isPending ? (
                        <div className="mentoring-request-actions">
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
