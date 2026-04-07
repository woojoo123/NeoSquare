import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { getMe, login } from '../api/auth';
import AppLayout from '../components/AppLayout';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    email: location.state?.email || '',
    password: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setAccessToken = useAuthStore((state) => state.setAccessToken);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const redirectTo = location.state?.from || '/lobby';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const loginResponse = await login(form);
      const nextAccessToken = loginResponse?.data?.accessToken;

      if (!nextAccessToken) {
        throw new Error('Access token was not returned.');
      }

      setAccessToken(nextAccessToken);

      const meResponse = await getMe();
      setCurrentUser(meResponse);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      clearAuth();
      setErrorMessage(
        error?.response?.data?.message || error.message || 'Login failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout
      eyebrow="Login"
      title="NeoSquare login"
      description="Sign in with your NeoSquare account. Successful login stores the access token and loads the current user."
    >
      <form className="app-form" onSubmit={handleLogin}>
        <label className="app-field">
          <span>Email</span>
          <input
            className="app-input"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="app-field">
          <span>Password</span>
          <input
            className="app-input"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            required
          />
        </label>
        <div className="app-actions">
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
          <Link className="text-link" to="/signup">
            Create account
          </Link>
        </div>
      </form>
      {location.state?.message ? (
        <p className="app-success">{location.state.message}</p>
      ) : null}
      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}
      {accessToken ? (
        <p className="app-note">
          You are already signed in as {currentUser?.nickname || 'a user'}.
        </p>
      ) : (
        <p className="app-note">
          Unauthenticated users trying to access `/lobby` are redirected here.
        </p>
      )}
    </AppLayout>
  );
}
