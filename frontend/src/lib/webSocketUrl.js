import { getStoredAccessToken } from '../features/auth/tokenStorage';

function resolveBaseWebSocketUrl() {
  const configuredUrl = import.meta.env.VITE_WS_URL;

  if (typeof window === 'undefined') {
    return configuredUrl || 'ws://localhost:8080/ws';
  }

  if (!configuredUrl) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  if (configuredUrl.startsWith('ws://') || configuredUrl.startsWith('wss://')) {
    return configuredUrl;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const normalizedPath = configuredUrl.startsWith('/') ? configuredUrl : `/${configuredUrl}`;
  return `${protocol}//${window.location.host}${normalizedPath}`;
}

export function getAuthenticatedWebSocketUrl() {
  const baseUrl = resolveBaseWebSocketUrl();

  if (typeof window === 'undefined') {
    return baseUrl;
  }

  const accessToken = getStoredAccessToken();

  if (!accessToken) {
    return baseUrl;
  }

  const url = new URL(baseUrl);
  url.searchParams.set('token', accessToken);
  return url.toString();
}
