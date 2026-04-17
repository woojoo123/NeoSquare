export type LoginFormValues = {
  email: string;
  password: string;
};

export type SignupFormValues = {
  nickname: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

export type LoginFieldName = keyof LoginFormValues;
export type SignupFieldName = keyof SignupFormValues;

export type FieldErrors<TFieldName extends string = string> = Partial<Record<TFieldName, string>>;

export type ApiResponse<T> = {
  success: boolean;
  message?: string | null;
  data: T | null;
};

export type ApiErrorResponse = {
  success: boolean;
  message?: string | null;
  status?: number;
  timestamp?: string;
  errors?: Record<string, string>;
};

export type LoginResponseData = {
  accessToken: string;
  tokenType: string;
  userId: number;
  email: string;
  nickname: string;
  role: string;
};

export type SignupResponseData = {
  id: number;
  email: string;
  nickname: string;
  role: string;
};

export type CurrentUserResponse = {
  id: number;
  email: string;
  nickname: string;
  role: string;
  mentorEnabled: boolean;
};

export type LoginRequestPayload = Pick<LoginFormValues, 'email' | 'password'>;
export type SignupRequestPayload = Pick<SignupFormValues, 'nickname' | 'email' | 'password'>;
