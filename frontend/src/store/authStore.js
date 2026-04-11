import { create } from 'zustand';

import { getStoredAccessToken, setStoredAccessToken } from '../api/axiosInstance';

const initialAccessToken = getStoredAccessToken();

export const useAuthStore = create((set) => ({
  accessToken: initialAccessToken,
  currentUser: null,
  authStatus: initialAccessToken ? 'checking' : 'guest',
  setAccessToken: (accessToken) => {
    setStoredAccessToken(accessToken);
    set((state) => ({
      accessToken: accessToken || null,
      currentUser: accessToken ? state.currentUser : null,
      authStatus: accessToken ? (state.currentUser ? 'authenticated' : 'checking') : 'guest',
    }));
  },
  setAuthenticatedSession: ({ accessToken, currentUser }) => {
    setStoredAccessToken(accessToken);
    set({
      accessToken: accessToken || null,
      currentUser: currentUser || null,
      authStatus: accessToken && currentUser ? 'authenticated' : accessToken ? 'checking' : 'guest',
    });
  },
  setCurrentUser: (currentUser) => {
    set((state) => ({
      currentUser: currentUser || null,
      authStatus: currentUser ? 'authenticated' : state.accessToken ? 'checking' : 'guest',
    }));
  },
  setAuthChecking: () => {
    set((state) => ({
      authStatus: state.accessToken ? 'checking' : 'guest',
    }));
  },
  clearAuth: () => {
    setStoredAccessToken(null);
    set({
      accessToken: null,
      currentUser: null,
      authStatus: 'guest',
    });
  },
}));
