import { Navigate, Outlet, useLocation } from 'react-router-dom';

import RouteLoadingFallback from '../components/RouteLoadingFallback';
import { useAuthStore } from '../store/authStore';

export default function RequireAuth() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const authStatus = useAuthStore((state) => state.authStatus);
  const location = useLocation();

  if (authStatus === 'checking') {
    return <RouteLoadingFallback message="인증 정보를 확인하는 중입니다..." />;
  }

  if (!accessToken || authStatus !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
