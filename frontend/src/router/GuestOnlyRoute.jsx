import { Navigate, Outlet } from 'react-router-dom';

import RouteLoadingFallback from '../components/RouteLoadingFallback';
import { useAuthStore } from '../store/authStore';

export default function GuestOnlyRoute() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const authStatus = useAuthStore((state) => state.authStatus);

  if (authStatus === 'checking') {
    return <RouteLoadingFallback message="인증 상태를 확인하는 중입니다..." />;
  }

  if (accessToken && authStatus === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
