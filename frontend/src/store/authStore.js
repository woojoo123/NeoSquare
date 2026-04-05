import { create } from 'zustand';

import { getStoredAccessToken, setStoredAccessToken } from '../api/axiosInstance';

export const useAuthStore = create((set) => ({
  accessToken: getStoredAccessToken(),
  isAuthenticated: Boolean(getStoredAccessToken()),
  login: (accessToken) => {
    const nextAccessToken = accessToken || getStoredAccessToken();

    setStoredAccessToken(nextAccessToken);
    set({
      accessToken: nextAccessToken,
      isAuthenticated: Boolean(nextAccessToken),
    });
  },
  logout: () => {
    setStoredAccessToken(null);
    set({ accessToken: null, isAuthenticated: false });
  },
}));
