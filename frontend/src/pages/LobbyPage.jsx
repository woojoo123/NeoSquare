import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getMe } from '../api/auth';
import { getSpaces } from '../api/spaces';
import AppLayout from '../components/AppLayout';
import LobbyGame from '../components/LobbyGame';
import { useLobbyRealtime } from '../lib/useLobbyRealtime';
import { useAuthStore } from '../store/authStore';

export default function LobbyPage() {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
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
        const [meResponse, spacesResponse] = await Promise.all([
          getMe(),
          getSpaces(),
        ]);

        if (!isMounted) {
          return;
        }

        setCurrentUser(meResponse);
        setSpaces(spacesResponse || []);
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
