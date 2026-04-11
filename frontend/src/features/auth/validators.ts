import type {
  FieldErrors,
  LoginFieldName,
  LoginFormValues,
  SignupFieldName,
  SignupFormValues,
} from './types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_COMPLEXITY_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(email: string): string | undefined {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return '이메일을 입력해 주세요.';
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return '올바른 이메일 주소를 입력해 주세요.';
  }

  return undefined;
}

export function validateLoginForm(values: LoginFormValues): FieldErrors<LoginFieldName> {
  const errors: FieldErrors<LoginFieldName> = {};
  const emailError = validateEmail(values.email);

  if (emailError) {
    errors.email = emailError;
  }

  if (!values.password.trim()) {
    errors.password = '비밀번호를 입력해 주세요.';
  }

  return errors;
}

export function validateSignupForm(values: SignupFormValues): FieldErrors<SignupFieldName> {
  const errors: FieldErrors<SignupFieldName> = {};
  const nickname = values.nickname.trim();
  const password = values.password;
  const passwordConfirm = values.passwordConfirm;
  const emailError = validateEmail(values.email);

  if (!nickname) {
    errors.nickname = '닉네임을 입력해 주세요.';
  }

  if (emailError) {
    errors.email = emailError;
  }

  if (!password.trim()) {
    errors.password = '비밀번호를 입력해 주세요.';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`;
  } else if (!PASSWORD_COMPLEXITY_PATTERN.test(password)) {
    errors.password = '비밀번호는 영문과 숫자를 함께 포함해야 합니다.';
  }

  if (!passwordConfirm.trim()) {
    errors.passwordConfirm = '비밀번호를 한 번 더 입력해 주세요.';
  } else if (password !== passwordConfirm) {
    errors.passwordConfirm = '비밀번호가 서로 일치하지 않습니다.';
  }

  return errors;
}
