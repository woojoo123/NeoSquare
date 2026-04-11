import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { signup } from '../api/auth';
import AppLayout from '../components/AppLayout';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

function normalizeSignupForm(form) {
  return {
    nickname: form.nickname.trim(),
    email: form.email.trim().toLowerCase(),
    password: form.password,
    passwordConfirm: form.passwordConfirm,
  };
}

function validateSignupForm(form) {
  const errors = {};

  if (!form.nickname) {
    errors.nickname = '닉네임을 입력해 주세요.';
  } else if (form.nickname.length < 2 || form.nickname.length > 20) {
    errors.nickname = '닉네임은 2자 이상 20자 이하로 입력해 주세요.';
  }

  if (!form.email) {
    errors.email = '이메일을 입력해 주세요.';
  } else if (!EMAIL_PATTERN.test(form.email)) {
    errors.email = '올바른 이메일 주소를 입력해 주세요.';
  }

  if (!form.password) {
    errors.password = '비밀번호를 입력해 주세요.';
  } else if (!PASSWORD_PATTERN.test(form.password)) {
    errors.password = '비밀번호는 8자 이상이며 영문과 숫자를 함께 포함해야 합니다.';
  }

  if (!form.passwordConfirm) {
    errors.passwordConfirm = '비밀번호를 한 번 더 입력해 주세요.';
  } else if (form.password !== form.passwordConfirm) {
    errors.passwordConfirm = '비밀번호가 서로 일치하지 않습니다.';
  }

  return errors;
}

function normalizeSignupError(error) {
  const status = error?.response?.status;
  const responseData = error?.response?.data || {};
  const serverErrors = responseData?.errors || {};
  const fieldErrors = {};

  if (serverErrors.nickname) {
    if (serverErrors.nickname.includes('already')) {
      fieldErrors.nickname = '이미 사용 중인 닉네임입니다.';
    } else {
      fieldErrors.nickname = '닉네임을 다시 확인해 주세요.';
    }
  }

  if (serverErrors.email) {
    if (serverErrors.email.includes('already')) {
      fieldErrors.email = '이미 가입된 이메일입니다.';
    } else {
      fieldErrors.email = '올바른 이메일 주소를 입력해 주세요.';
    }
  }

  if (serverErrors.password) {
    fieldErrors.password = '비밀번호는 8자 이상이며 영문과 숫자를 함께 포함해야 합니다.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      formError: '',
    };
  }

  if (status === 409) {
    const rawMessage = String(responseData?.message || '').toLowerCase();

    if (rawMessage.includes('nickname')) {
      return {
        fieldErrors: {
          nickname: '이미 사용 중인 닉네임입니다.',
        },
        formError: '',
      };
    }

    if (rawMessage.includes('email')) {
      return {
        fieldErrors: {
          email: '이미 가입된 이메일입니다.',
        },
        formError: '',
      };
    }
  }

  return {
    fieldErrors: {},
    formError: '회원가입을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
  };
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    nickname: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setFieldErrors((current) => {
      if (!current[name]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[name];
      return nextErrors;
    });

    if (formError) {
      setFormError('');
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedForm = normalizeSignupForm(form);
    const nextFieldErrors = validateSignupForm(normalizedForm);

    setForm(normalizedForm);
    setFieldErrors(nextFieldErrors);
    setFormError('');

    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signup({
        nickname: normalizedForm.nickname,
        email: normalizedForm.email,
        password: normalizedForm.password,
      });
      navigate('/login', {
        replace: true,
        state: {
          message: '회원가입이 완료되었습니다. 로그인해 주세요.',
          email: normalizedForm.email,
        },
      });
    } catch (error) {
      const nextErrorState = normalizeSignupError(error);
      setFieldErrors(nextErrorState.fieldErrors);
      setFormError(nextErrorState.formError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout
      eyebrow="회원가입"
      title="NeoSquare 계정 만들기"
      description="기본 정보를 입력하면 바로 로그인해서 NeoSquare를 이용할 수 있습니다."
      panelClassName="auth-panel auth-panel--compact"
    >
      <form className="app-form auth-form" onSubmit={handleSignup} noValidate>
        <label className="app-field">
          <span>닉네임</span>
          <input
            className={`app-input ${fieldErrors.nickname ? 'app-input--error' : ''}`}
            type="text"
            name="nickname"
            value={form.nickname}
            onChange={handleChange}
            placeholder="서비스에 표시될 이름을 입력해 주세요"
            aria-invalid={Boolean(fieldErrors.nickname)}
            aria-describedby={fieldErrors.nickname ? 'signup-error-nickname' : undefined}
            required
          />
          {fieldErrors.nickname ? (
            <small className="field-error-text" id="signup-error-nickname" role="alert">
              {fieldErrors.nickname}
            </small>
          ) : null}
        </label>
        <label className="app-field">
          <span>이메일</span>
          <input
            className={`app-input ${fieldErrors.email ? 'app-input--error' : ''}`}
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="이메일을 입력해 주세요"
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'signup-error-email' : undefined}
            required
          />
          {fieldErrors.email ? (
            <small className="field-error-text" id="signup-error-email" role="alert">
              {fieldErrors.email}
            </small>
          ) : null}
        </label>
        <label className="app-field">
          <span>비밀번호</span>
          <input
            className={`app-input ${fieldErrors.password ? 'app-input--error' : ''}`}
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="비밀번호를 만들어 주세요"
            autoComplete="new-password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'signup-error-password' : undefined}
            required
          />
          {fieldErrors.password ? (
            <small className="field-error-text" id="signup-error-password" role="alert">
              {fieldErrors.password}
            </small>
          ) : null}
        </label>
        <label className="app-field">
          <span>비밀번호 확인</span>
          <input
            className={`app-input ${fieldErrors.passwordConfirm ? 'app-input--error' : ''}`}
            type="password"
            name="passwordConfirm"
            value={form.passwordConfirm}
            onChange={handleChange}
            placeholder="비밀번호를 한 번 더 입력해 주세요"
            autoComplete="new-password"
            aria-invalid={Boolean(fieldErrors.passwordConfirm)}
            aria-describedby={fieldErrors.passwordConfirm ? 'signup-error-password-confirm' : undefined}
            required
          />
          {fieldErrors.passwordConfirm ? (
            <small className="field-error-text" id="signup-error-password-confirm" role="alert">
              {fieldErrors.passwordConfirm}
            </small>
          ) : null}
        </label>
        {formError ? (
          <p className="app-error auth-form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="app-actions auth-actions">
          <button type="submit" className="primary-button auth-submit-button" disabled={isSubmitting}>
            {isSubmitting ? '가입 중...' : '회원가입'}
          </button>
        </div>
      </form>
      <p className="auth-helper">
        이미 계정이 있으신가요?{' '}
        <Link className="auth-helper-link" to="/login">
          로그인
        </Link>
      </p>
    </AppLayout>
  );
}
