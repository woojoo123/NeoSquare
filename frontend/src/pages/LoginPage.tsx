import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import AppLayout from '../components/AppLayout';
import { extractFieldErrors, getMe, login } from '../api/auth';
import type { FieldErrors, LoginFieldName, LoginFormValues } from '../features/auth/types';
import { validateLoginForm } from '../features/auth/validators';
import { useAuthStore } from '../store/authStore';

const LOGIN_FAILURE_MESSAGE = '이메일 또는 비밀번호를 확인해 주세요.';

type LoginLocationState = {
  from?: string;
  email?: string;
  message?: string;
  successMessage?: string;
} | null;

function normalizeLoginValues(values: LoginFormValues): LoginFormValues {
  return {
    email: values.email.trim().toLowerCase(),
    password: values.password,
  };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? null) as LoginLocationState;
  const queryParams = new URLSearchParams(location.search);
  const initialEmail = locationState?.email ?? queryParams.get('email') ?? '';
  const [formValues, setFormValues] = useState<LoginFormValues>({
    email: initialEmail,
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginFieldName>>({});
  const [authErrorMessage, setAuthErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.currentUser);
  const setAuthenticatedSession = useAuthStore((state) => state.setAuthenticatedSession);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const successMessage =
    locationState?.successMessage ||
    (queryParams.get('signup') === 'success' ? '회원가입이 완료되었습니다. 로그인해 주세요.' : '');
  const infoMessage =
    locationState?.message ||
    (locationState?.from ? '로그인이 필요한 서비스입니다. 계정 정보를 입력하고 계속 진행해 주세요.' : '');

  const passwordHasError = Boolean(fieldErrors.password || authErrorMessage);
  const passwordErrorIds = [
    fieldErrors.password ? 'login-password-error' : '',
    authErrorMessage ? 'login-auth-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    const fieldName = name as LoginFieldName;

    setFormValues((current) => ({
      ...current,
      [fieldName]: value,
    }));

    setFieldErrors((current) => {
      if (!current[fieldName]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[fieldName];
      return nextErrors;
    });

    if (authErrorMessage) {
      setAuthErrorMessage('');
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedValues = normalizeLoginValues(formValues);
    const nextFieldErrors = validateLoginForm(normalizedValues);

    setFormValues(normalizedValues);
    setFieldErrors(nextFieldErrors);
    setAuthErrorMessage('');

    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const loginResponse = await login(normalizedValues);

      if (!loginResponse?.accessToken) {
        throw new Error('Login response did not include an access token.');
      }

      const currentUserResponse = await getMe();

      setAuthenticatedSession({
        accessToken: loginResponse.accessToken,
        currentUser: currentUserResponse,
      });

      navigate(locationState?.from || '/lobby', { replace: true });
    } catch (error) {
      const serverFieldErrors = extractFieldErrors<LoginFieldName>(error);

      clearAuth();

      if (Object.keys(serverFieldErrors).length > 0) {
        setFieldErrors(serverFieldErrors);
      } else {
        setAuthErrorMessage(LOGIN_FAILURE_MESSAGE);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout
      eyebrow="환영합니다"
      title="NeoSquare에 로그인"
      description="이메일과 비밀번호를 입력하면 바로 서비스를 이어서 이용할 수 있습니다."
      panelClassName="auth-panel auth-panel--compact"
    >
      {successMessage ? <p className="form-feedback form-feedback--success">{successMessage}</p> : null}
      {infoMessage ? <p className="auth-info-banner">{infoMessage}</p> : null}

      <form className="app-form auth-form" onSubmit={handleSubmit} noValidate>
        <label className="app-field" htmlFor="login-email">
          <span>이메일</span>
          <input
            id="login-email"
            className={`app-input ${fieldErrors.email ? 'app-input--error' : ''}`}
            type="email"
            name="email"
            value={formValues.email}
            onChange={handleChange}
            placeholder="이메일을 입력해 주세요"
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
          />
          {fieldErrors.email ? (
            <small className="field-error-text" id="login-email-error" role="alert">
              {fieldErrors.email}
            </small>
          ) : null}
        </label>

        <label className="app-field" htmlFor="login-password">
          <span>비밀번호</span>
          <input
            id="login-password"
            className={`app-input ${passwordHasError ? 'app-input--error' : ''}`}
            type="password"
            name="password"
            value={formValues.password}
            onChange={handleChange}
            placeholder="비밀번호를 입력해 주세요"
            autoComplete="current-password"
            aria-invalid={passwordHasError}
            aria-describedby={passwordErrorIds || undefined}
          />
          {fieldErrors.password ? (
            <small className="field-error-text" id="login-password-error" role="alert">
              {fieldErrors.password}
            </small>
          ) : null}
          {authErrorMessage ? (
            <small className="field-error-text" id="login-auth-error" role="alert">
              {authErrorMessage}
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
