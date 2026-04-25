import { create } from 'zustand';

import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from '../features/auth/tokenStorage';
import { clearCachedWebSocketTicket } from '../lib/webSocketUrl';

const initialAccessToken = getStoredAccessToken();

export const useAuthStore = create((set) => ({
  accessToken: initialAccessToken,
  currentUser: null,
  authStatus: initialAccessToken ? 'checking' : 'guest',
  setAccessToken: (accessToken) => {
    clearCachedWebSocketTicket();
    setStoredAccessToken(accessToken);
    set((state) => ({
      accessToken: accessToken || null,
      currentUser: accessToken ? state.currentUser : null,
      authStatus: accessToken ? (state.currentUser ? 'authenticated' : 'checking') : 'guest',
    }));
  },
  setAuthenticatedSession: ({ accessToken, currentUser }) => {
    clearCachedWebSocketTicket();
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
    clearCachedWebSocketTicket();
    clearStoredAccessToken();
    set({
      accessToken: null,
      currentUser: null,
      authStatus: 'guest',
    });
  },
}));
