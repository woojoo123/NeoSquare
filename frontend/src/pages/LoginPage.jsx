import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { getMe, login } from '../api/auth';
import AppLayout from '../components/AppLayout';
import { useAuthStore } from '../store/authStore';

function normalizeLoginErrorMessage(error) {
  const status = error?.response?.status;
  const rawMessage = String(error?.response?.data?.message || error?.message || '').toLowerCase();

  if (
    status === 400 ||
    status === 401 ||
    rawMessage.includes('invalid email or password') ||
    rawMessage.includes('invalid password') ||
    rawMessage.includes('bad credentials') ||
    rawMessage.includes('unauthorized')
  ) {
    return '이메일 또는 비밀번호를 확인해 주세요.';
  }

  return '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.';
}

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
  const setAuthenticatedSession = useAuthStore((state) => state.setAuthenticatedSession);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const redirectTo = location.state?.from || '/lobby';
  const infoMessage = location.state?.from
    ? '로그인이 필요한 서비스입니다. 계정 정보를 입력하고 계속 진행해 주세요.'
    : '';
  const hasLoginError = Boolean(errorMessage);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (errorMessage) {
      setErrorMessage('');
    }
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const loginResponse = await login(form);
      const nextAccessToken = loginResponse?.accessToken;

      if (!nextAccessToken) {
        throw new Error('Login response did not include an access token.');
      }

      const meResponse = await getMe();
      setAuthenticatedSession({
        accessToken: nextAccessToken,
        currentUser: meResponse,
      });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      clearAuth();
      setErrorMessage(normalizeLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout
      eyebrow="환영합니다"
      title="NeoSquare에 로그인"
      description="이메일과 비밀번호를 입력하면 바로 서비스를 이어서 이용할 수 있습니다."
      panelClassName="auth-panel auth-panel--compact"
    >
      {location.state?.message ? (
        <p className="form-feedback form-feedback--success">{location.state.message}</p>
      ) : null}
      {infoMessage ? <p className="auth-info-banner">{infoMessage}</p> : null}

      <form className="app-form auth-form" onSubmit={handleLogin}>
        <label className="app-field">
          <span>이메일</span>
          <input
            className="app-input"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="이메일을 입력해 주세요"
            autoComplete="email"
            required
          />
        </label>
        <label className="app-field">
          <span>비밀번호</span>
          <input
            className={`app-input ${hasLoginError ? 'app-input--error' : ''}`}
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="비밀번호를 입력하세요"
            autoComplete="current-password"
            aria-invalid={hasLoginError}
            aria-describedby={hasLoginError ? 'login-error-message' : undefined}
            required
          />
          {hasLoginError ? (
            <small className="field-error-text" id="login-error-message" role="alert">
              {errorMessage}
            </small>
          ) : null}
        </label>
        <div className="app-actions auth-actions">
          <button type="submit" className="primary-button auth-submit-button" disabled={isSubmitting}>
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
        </div>
      </form>

      {accessToken ? (
        <p className="auth-helper">
          현재 {currentUser?.nickname || '사용자'} 계정으로 로그인되어 있습니다.
        </p>
      ) : (
        <p className="auth-helper">
          아직 계정이 없으신가요?{' '}
          <Link className="auth-helper-link" to="/signup">
            회원가입
          </Link>
        </p>
      )}
    </AppLayout>
  );
}
