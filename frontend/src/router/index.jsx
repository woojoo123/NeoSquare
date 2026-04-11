import { Suspense, lazy } from 'react';
import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';

import RequireAuth from './RequireAuth';

const LobbyPage = lazy(() => import('../pages/LobbyPage'));
const HubPage = lazy(() => import('../pages/HubPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const MentoringSessionPage = lazy(() => import('../pages/MentoringSessionPage'));
const SpacePage = lazy(() => import('../pages/SpacePage'));
const StudySessionPage = lazy(() => import('../pages/StudySessionPage'));
const SignupPage = lazy(() => import('../pages/SignupPage'));

function RouteLoadingFallback({ message = '화면을 불러오는 중입니다...' }) {
  return (
    <div className="route-loading">
      <div className="route-loading__panel">
        <span className="route-loading__badge">NeoSquare</span>
        <h1>잠시만 기다려 주세요</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}

function withSuspense(element, message) {
  return (
    <Suspense fallback={<RouteLoadingFallback message={message} />}>
      {element}
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: withSuspense(<LoginPage />, '로그인 화면을 준비하고 있습니다...'),
  },
  {
    path: '/signup',
    element: withSuspense(<SignupPage />, '회원가입 화면을 준비하고 있습니다...'),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/lobby',
        element: withSuspense(<LobbyPage />, '입장 로비를 불러오는 중입니다...'),
      },
      {
        path: '/hub',
        element: withSuspense(<HubPage />, '활동 허브를 불러오는 중입니다...'),
      },
      {
        path: '/spaces/:spaceId',
        element: withSuspense(<SpacePage />, '공간 정보를 준비하고 있습니다...'),
      },
      {
        path: '/mentoring/session/:requestId',
        element: withSuspense(<MentoringSessionPage />, '멘토링 세션을 준비하고 있습니다...'),
      },
      {
        path: '/study/sessions/:sessionId',
        element: withSuspense(<StudySessionPage />, '스터디 세션을 준비하고 있습니다...'),
      },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
