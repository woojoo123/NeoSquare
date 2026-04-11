import axios from 'axios';
import type { AxiosResponse } from 'axios';

import { axiosInstance } from '../../api/axiosInstance';
import type {
  ApiErrorResponse,
  ApiResponse,
  CurrentUserResponse,
  FieldErrors,
  LoginRequestPayload,
  LoginResponseData,
  SignupRequestPayload,
  SignupResponseData,
} from './types';

const DEFAULT_API_ERROR_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

function isApiEnvelope<T>(value: ApiResponse<T> | T): value is ApiResponse<T> {
  return typeof value === 'object' && value !== null && 'success' in value;
}

function unwrapResponseData<T>(response: AxiosResponse<ApiResponse<T> | T>): T {
  const payload = response.data;

  if (isApiEnvelope(payload)) {
    return payload.data as T;
  }

  return payload as T;
}

function getApiErrorResponse(error: unknown): ApiErrorResponse | undefined {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }

  return error.response?.data as ApiErrorResponse | undefined;
}

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string = DEFAULT_API_ERROR_MESSAGE
): string {
  const responseMessage = getApiErrorResponse(error)?.message;

  if (responseMessage && responseMessage.trim()) {
    return responseMessage;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

export function extractFieldErrors<TFieldName extends string = string>(
  error: unknown
): FieldErrors<TFieldName> {
  const responseErrors = getApiErrorResponse(error)?.errors;

  if (!responseErrors) {
    return {};
  }

  return Object.entries(responseErrors).reduce<FieldErrors<TFieldName>>((result, [key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      result[key as TFieldName] = value;
    }

    return result;
  }, {});
}

export async function signup(payload: SignupRequestPayload): Promise<SignupResponseData> {
  const response = await axiosInstance.post<ApiResponse<SignupResponseData>>('/auth/signup', payload);
  return unwrapResponseData(response);
}

export async function login(payload: LoginRequestPayload): Promise<LoginResponseData> {
  const response = await axiosInstance.post<ApiResponse<LoginResponseData>>('/auth/login', payload, {
    skipAuthRedirect: true,
    skipAuthRefresh: true,
  });

  return unwrapResponseData(response);
}

export async function getMe(): Promise<CurrentUserResponse> {
  const response = await axiosInstance.get<ApiResponse<CurrentUserResponse>>('/auth/me');
  return unwrapResponseData(response);
}

export async function logout(): Promise<void> {
  await axiosInstance.post<ApiResponse<null>>('/auth/logout');
}
