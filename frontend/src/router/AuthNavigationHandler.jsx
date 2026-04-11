import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { registerUnauthorizedHandler } from '../lib/authSessionEvents';
import { useAuthStore } from '../store/authStore';

function normalizeRedirectPath(from) {
  if (!from || from.startsWith('/login') || from.startsWith('/signup')) {
    return undefined;
  }

  return from;
}

export default function AuthNavigationHandler() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    return registerUnauthorizedHandler(({ from } = {}) => {
      clearAuth();
      navigate('/login', {
        replace: true,
        state: {
          from: normalizeRedirectPath(from),
          message: '세션이 만료되어 다시 로그인해 주세요.',
        },
      });
    });
  }, [clearAuth, navigate]);

  return <Outlet />;
}
