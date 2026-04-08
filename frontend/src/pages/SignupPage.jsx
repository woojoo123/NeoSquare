import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { signup } from '../api/auth';
import AppLayout from '../components/AppLayout';

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    nickname: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await signup(form);
      navigate('/login', {
        replace: true,
        state: {
          message: '회원가입이 완료되었습니다. 로그인해 주세요.',
          email: form.email,
        },
      });
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || error.message || '회원가입에 실패했습니다.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout
      eyebrow="회원가입"
      title="NeoSquare 계정 만들기"
      description="계정을 만든 뒤 로그인 페이지에서 바로 NeoSquare에 접속할 수 있습니다."
    >
      <form className="app-form" onSubmit={handleSignup}>
        <label className="app-field">
          <span>닉네임</span>
          <input
            className="app-input"
            type="text"
            name="nickname"
            value={form.nickname}
            onChange={handleChange}
            placeholder="어떻게 표시될지 입력하세요"
            required
          />
        </label>
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
            placeholder="비밀번호를 만들어 주세요"
            required
          />
        </label>
        <div className="app-actions">
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? '가입 중...' : '회원가입'}
          </button>
          <Link className="text-link" to="/login">
            로그인으로 돌아가기
          </Link>
        </div>
      </form>
      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}
    </AppLayout>
  );
}
