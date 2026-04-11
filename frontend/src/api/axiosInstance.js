import axios from 'axios';

import { notifyUnauthorized } from '../lib/authSessionEvents';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const ACCESS_TOKEN_STORAGE_KEY = 'neosquare-access-token';
let isHandlingUnauthorized = false;

export function getStoredAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setStoredAccessToken(accessToken) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!accessToken) {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
}

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

axiosInstance.interceptors.request.use((config) => {
  const accessToken = getStoredAccessToken();

  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const skipAuthRedirect = Boolean(error?.config?.skipAuthRedirect);

    if (status === 401 && !skipAuthRedirect) {
      setStoredAccessToken(null);

      if (!isHandlingUnauthorized) {
        isHandlingUnauthorized = true;

        const from =
          typeof window === 'undefined'
            ? undefined
            : `${window.location.pathname}${window.location.search}${window.location.hash}`;

        notifyUnauthorized({ from });

        if (typeof window !== 'undefined') {
          window.setTimeout(() => {
            isHandlingUnauthorized = false;
          }, 0);
        } else {
          isHandlingUnauthorized = false;
        }
      }
    }

    return Promise.reject(error);
  }
);
