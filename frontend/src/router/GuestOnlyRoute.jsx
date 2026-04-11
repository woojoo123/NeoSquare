import { Outlet } from 'react-router-dom';

import PrimarySpaceRedirect from '../components/PrimarySpaceRedirect';
import RouteLoadingFallback from '../components/RouteLoadingFallback';
import { useAuthStore } from '../store/authStore';

export default function GuestOnlyRoute() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const authStatus = useAuthStore((state) => state.authStatus);

  if (authStatus === 'checking') {
    return <RouteLoadingFallback message="인증 상태를 확인하는 중입니다..." />;
  }

  if (accessToken && authStatus === 'authenticated') {
    return <PrimarySpaceRedirect message="메인광장으로 이동하고 있습니다..." />;
  }

  return <Outlet />;
}
