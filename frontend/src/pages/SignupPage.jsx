import { Link, useNavigate } from 'react-router-dom';

import AppLayout from '../components/AppLayout';
import { useAuthStore } from '../store/authStore';

export default function SignupPage() {
  const navigate = useNavigate();
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const handleSignup = () => {
    setAccessToken('temp-access-token');
    setCurrentUser({
      email: 'new-user@neosquare.local',
      nickname: 'New User',
    });
    navigate('/lobby', { replace: true });
  };

  return (
    <AppLayout
      eyebrow="Signup"
      title="Create a NeoSquare account"
      description="This is a temporary signup page. Completing signup immediately marks the user as authenticated for now."
    >
      <div className="app-actions">
        <button type="button" className="primary-button" onClick={handleSignup}>
          Sign up
        </button>
        <Link className="text-link" to="/login">
          Back to login
        </Link>
      </div>
    </AppLayout>
  );
}
