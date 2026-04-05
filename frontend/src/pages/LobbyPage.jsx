import { useNavigate } from 'react-router-dom';

import AppLayout from '../components/AppLayout';
import { useAuthStore } from '../store/authStore';

export default function LobbyPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <AppLayout
      eyebrow="Lobby"
      title="NeoSquare lobby"
      description="The lobby route is now protected. Only authenticated users can stay on this page."
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
    </AppLayout>
  );
}
