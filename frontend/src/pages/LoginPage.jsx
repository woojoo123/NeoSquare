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
        throw new Error('액세스 토큰을 받지 못했습니다.');
      }

      setAccessToken(nextAccessToken);

      const meResponse = await getMe();
      setCurrentUser(meResponse);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      clearAuth();
      setErrorMessage(
        error?.response?.data?.message || error.message || '로그인에 실패했습니다.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout
      eyebrow="로그인"
      title="NeoSquare 로그인"
      description="NeoSquare 계정으로 로그인하면 액세스 토큰을 저장하고 현재 사용자 정보를 불러옵니다."
    >
      <form className="app-form" onSubmit={handleLogin}>
        <label className="app-field">
          <span>이메일</span>
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
          <span>비밀번호</span>
          <input
            className="app-input"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="비밀번호를 입력하세요"
            required
          />
        </label>
        <div className="app-actions">
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
          <Link className="text-link" to="/signup">
            회원가입
          </Link>
        </div>
      </form>
      {location.state?.message ? (
        <p className="app-success">{location.state.message}</p>
      ) : null}
      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}
      {accessToken ? (
        <p className="app-note">
          현재 {currentUser?.nickname || '사용자'} 계정으로 로그인되어 있습니다.
        </p>
      ) : (
        <p className="app-note">
          로그인하지 않은 사용자가 `/lobby`에 접근하면 이 페이지로 이동합니다.
        </p>
      )}
    </AppLayout>
  );
}
