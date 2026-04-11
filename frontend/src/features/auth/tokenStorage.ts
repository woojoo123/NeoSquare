export const ACCESS_TOKEN_STORAGE_KEY = 'neosquare-access-token';

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setStoredAccessToken(accessToken: string | null | undefined): void {
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
