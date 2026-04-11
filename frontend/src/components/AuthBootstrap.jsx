import { useEffect } from 'react';

import { getMe } from '../api/auth';
import { useAuthStore } from '../store/authStore';

export default function AuthBootstrap({ children }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.currentUser);
  const authStatus = useAuthStore((state) => state.authStatus);
  const setAuthChecking = useAuthStore((state) => state.setAuthChecking);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    let isMounted = true;

    if (!accessToken || currentUser) {
      return () => {
        isMounted = false;
      };
    }

    if (authStatus !== 'checking') {
      setAuthChecking();
    }

    async function restoreSession() {
      try {
        const meResponse = await getMe();

        if (!isMounted) {
          return;
        }

        setCurrentUser(meResponse);
      } catch {
        if (!isMounted) {
          return;
        }

        clearAuth();
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [accessToken, authStatus, clearAuth, currentUser, setAuthChecking, setCurrentUser]);

  return children;
}
