import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getMe } from '../api/auth';
import { getSpaces } from '../api/spaces';
import AppLayout from '../components/AppLayout';
import { useLobbyRealtime } from '../lib/useLobbyRealtime';
import { useAuthStore } from '../store/authStore';

export default function LobbyPage() {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useLobbyRealtime();

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
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

        setCurrentUser(meResponse.data);
        setSpaces(spacesResponse.data || []);
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

  return (
    <AppLayout
      eyebrow="Lobby"
      title="NeoSquare lobby"
      description="Authenticated users can load their profile and the current public spaces from the backend."
    >
      <div className="app-actions">
        <button type="button" className="primary-button" onClick={handleLogout}>
          Sign out
        </button>
      </div>
      {currentUser ? (
        <p className="app-note">
          Signed in as {currentUser.nickname} ({currentUser.email})
        </p>
      ) : null}
      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}
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
    </AppLayout>
  );
}
