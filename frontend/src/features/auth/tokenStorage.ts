export const ACCESS_TOKEN_STORAGE_KEY = 'neosquare-access-token';
let accessTokenCache: string | null = null;

if (typeof window !== 'undefined') {
  accessTokenCache = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function getStoredAccessToken(): string | null {
  return accessTokenCache;
}

export function setStoredAccessToken(accessToken: string | null | undefined): void {
  accessTokenCache = accessToken || null;

  if (typeof window === 'undefined') {
    return;
  }

  if (!accessToken) {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
}

export function clearStoredAccessToken(): void {
  setStoredAccessToken(null);
}
