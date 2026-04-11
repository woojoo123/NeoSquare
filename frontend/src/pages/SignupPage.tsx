import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AppLayout from '../components/AppLayout';
import { extractFieldErrors, getApiErrorMessage, signup } from '../api/auth';
import type { FieldErrors, SignupFieldName, SignupFormValues } from '../features/auth/types';
import { validateSignupForm } from '../features/auth/validators';

function normalizeSignupValues(values: SignupFormValues): SignupFormValues {
  return {
    nickname: values.nickname.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    passwordConfirm: values.passwordConfirm,
  };
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState<SignupFormValues>({
    nickname: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<SignupFieldName>>({});
  const [formErrorMessage, setFormErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    const fieldName = name as SignupFieldName;

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

    if (formErrorMessage) {
      setFormErrorMessage('');
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedValues = normalizeSignupValues(formValues);
    const nextFieldErrors = validateSignupForm(normalizedValues);

    setFormValues(normalizedValues);
    setFieldErrors(nextFieldErrors);
    setFormErrorMessage('');

    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signup({
        nickname: normalizedValues.nickname,
        email: normalizedValues.email,
        password: normalizedValues.password,
      });

      const queryParams = new URLSearchParams({
        signup: 'success',
        email: normalizedValues.email,
      });

      navigate(`/login?${queryParams.toString()}`, {
        replace: true,
        state: {
          email: normalizedValues.email,
          successMessage: '회원가입이 완료되었습니다. 로그인해 주세요.',
        },
      });
    } catch (error) {
      const serverFieldErrors = extractFieldErrors<SignupFieldName>(error);

      if (Object.keys(serverFieldErrors).length > 0) {
        setFieldErrors(serverFieldErrors);
        return;
      }

      setFormErrorMessage(
        getApiErrorMessage(error, '회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout
      eyebrow="회원가입"
      title="NeoSquare 계정 만들기"
      description="기본 정보를 입력하면 바로 로그인해서 NeoSquare를 이용할 수 있습니다."
      panelClassName="auth-panel auth-panel--compact"
    >
      {formErrorMessage ? (
        <p className="form-feedback auth-form-error" role="alert">
          {formErrorMessage}
        </p>
      ) : null}

      <form className="app-form auth-form" onSubmit={handleSubmit} noValidate>
        <label className="app-field" htmlFor="signup-nickname">
          <span>닉네임</span>
          <input
            id="signup-nickname"
            className={`app-input ${fieldErrors.nickname ? 'app-input--error' : ''}`}
            type="text"
            name="nickname"
            value={formValues.nickname}
            onChange={handleChange}
            placeholder="서비스에 표시될 닉네임을 입력해 주세요"
            autoComplete="nickname"
            aria-invalid={Boolean(fieldErrors.nickname)}
            aria-describedby={fieldErrors.nickname ? 'signup-nickname-error' : undefined}
          />
          {fieldErrors.nickname ? (
            <small className="field-error-text" id="signup-nickname-error" role="alert">
              {fieldErrors.nickname}
            </small>
          ) : null}
        </label>

        <label className="app-field" htmlFor="signup-email">
          <span>이메일</span>
          <input
            id="signup-email"
            className={`app-input ${fieldErrors.email ? 'app-input--error' : ''}`}
            type="email"
            name="email"
            value={formValues.email}
            onChange={handleChange}
            placeholder="이메일을 입력해 주세요"
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
          />
          {fieldErrors.email ? (
            <small className="field-error-text" id="signup-email-error" role="alert">
              {fieldErrors.email}
            </small>
          ) : null}
        </label>

        <label className="app-field" htmlFor="signup-password">
          <span>비밀번호</span>
          <input
            id="signup-password"
            className={`app-input ${fieldErrors.password ? 'app-input--error' : ''}`}
            type="password"
            name="password"
            value={formValues.password}
            onChange={handleChange}
            placeholder="비밀번호를 입력해 주세요"
            autoComplete="new-password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'signup-password-error' : undefined}
          />
          {fieldErrors.password ? (
            <small className="field-error-text" id="signup-password-error" role="alert">
              {fieldErrors.password}
            </small>
          ) : null}
        </label>

        <label className="app-field" htmlFor="signup-password-confirm">
          <span>비밀번호 확인</span>
          <input
            id="signup-password-confirm"
            className={`app-input ${fieldErrors.passwordConfirm ? 'app-input--error' : ''}`}
            type="password"
            name="passwordConfirm"
            value={formValues.passwordConfirm}
            onChange={handleChange}
            placeholder="비밀번호를 한 번 더 입력해 주세요"
            autoComplete="new-password"
            aria-invalid={Boolean(fieldErrors.passwordConfirm)}
            aria-describedby={fieldErrors.passwordConfirm ? 'signup-password-confirm-error' : undefined}
          />
          {fieldErrors.passwordConfirm ? (
            <small className="field-error-text" id="signup-password-confirm-error" role="alert">
              {fieldErrors.passwordConfirm}
            </small>
          ) : null}
        </label>

        <div className="app-actions auth-actions">
          <button type="submit" className="primary-button auth-submit-button" disabled={isSubmitting}>
            {isSubmitting ? '가입 중...' : '회원가입'}
          </button>
        </div>
      </form>

      <p className="auth-helper">
        이미 계정이 있으신가요?{' '}
        <Link className="auth-helper-link" to="/login">
          로그인 페이지로 돌아가기
        </Link>
      </p>
    </AppLayout>
  );
}
