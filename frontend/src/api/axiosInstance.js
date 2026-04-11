import axios from 'axios';

import { notifyUnauthorized } from '../lib/authSessionEvents';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const ACCESS_TOKEN_STORAGE_KEY = 'neosquare-access-token';
let isHandlingUnauthorized = false;
let refreshRequestPromise = null;

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
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
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
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config || {};
    const skipAuthRedirect = Boolean(originalRequest.skipAuthRedirect);
    const skipAuthRefresh = Boolean(originalRequest.skipAuthRefresh);

    if (status !== 401) {
      return Promise.reject(error);
    }

    if (!skipAuthRefresh && !originalRequest._retry) {
      try {
        if (!refreshRequestPromise) {
          refreshRequestPromise = refreshAccessToken().finally(() => {
            refreshRequestPromise = null;
          });
        }

        const nextAccessToken = await refreshRequestPromise;

        originalRequest._retry = true;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;

        return axiosInstance(originalRequest);
      } catch (refreshError) {
        setStoredAccessToken(null);

        if (!skipAuthRedirect) {
          handleUnauthorizedRedirect();
        }

        return Promise.reject(refreshError);
      }
    }

    if (!skipAuthRedirect) {
      setStoredAccessToken(null);
      handleUnauthorizedRedirect();
    }

    return Promise.reject(error);
  }
);

async function refreshAccessToken() {
  const response = await refreshClient.post('/auth/refresh');
  const nextAccessToken = response.data?.data?.accessToken ?? response.data?.accessToken;

  if (!nextAccessToken) {
    throw new Error('Refresh response did not include an access token.');
  }

  setStoredAccessToken(nextAccessToken);
  return nextAccessToken;
}

function handleUnauthorizedRedirect() {
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
