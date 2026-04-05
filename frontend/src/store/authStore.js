import { create } from 'zustand';

import { getStoredAccessToken, setStoredAccessToken } from '../api/axiosInstance';

export const useAuthStore = create((set) => ({
  accessToken: getStoredAccessToken(),
  currentUser: null,
  setAccessToken: (accessToken) => {
    setStoredAccessToken(accessToken);
    set({ accessToken: accessToken || null });
  },
  setCurrentUser: (currentUser) => {
    set({ currentUser });
  },
  clearAuth: () => {
    setStoredAccessToken(null);
    set({
      accessToken: null,
      currentUser: null,
    });
  },
}));
