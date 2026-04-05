import { Link, useLocation, useNavigate } from 'react-router-dom';

import AppLayout from '../components/AppLayout';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const redirectTo = location.state?.from || '/lobby';

  const handleLogin = () => {
    setAccessToken('temp-access-token');
    setCurrentUser({
      email: 'demo@neosquare.local',
      nickname: 'Demo User',
    });
    navigate(redirectTo, { replace: true });
  };

  return (
    <AppLayout
      eyebrow="Login"
      title="NeoSquare login"
      description="This is a temporary login entry point. It is enough to validate route flow and a minimal protected lobby."
    >
      <div className="app-actions">
        <button type="button" className="primary-button" onClick={handleLogin}>
          Sign in
        </button>
        <Link className="text-link" to="/signup">
          Create account
        </Link>
      </div>
      {accessToken ? (
        <p className="app-note">
          You are already signed in as {currentUser?.nickname || 'a user'}.
        </p>
      ) : (
        <p className="app-note">
          Unauthenticated users trying to access the lobby are redirected here.
        </p>
      )}
    </AppLayout>
  );
}
