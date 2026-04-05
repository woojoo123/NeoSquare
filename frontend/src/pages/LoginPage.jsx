import { Link, useLocation, useNavigate } from 'react-router-dom';

import AppLayout from '../components/AppLayout';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);

  const redirectTo = location.state?.from || '/lobby';

  const handleLogin = () => {
    login();
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
      {isAuthenticated ? (
        <p className="app-note">
          You are already signed in. Going to the lobby is available now.
        </p>
      ) : (
        <p className="app-note">
          Unauthenticated users trying to access the lobby are redirected here.
        </p>
      )}
    </AppLayout>
  );
}
