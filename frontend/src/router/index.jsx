import { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import RouteLoadingFallback from '../components/RouteLoadingFallback';
import HubPage from '../pages/HubPage.jsx';
import AuthNavigationHandler from './AuthNavigationHandler';
import GuestOnlyRoute from './GuestOnlyRoute';
import RequireAuth from './RequireAuth';

const LandingPage = lazy(() => import('../pages/LandingPage.tsx'));
const LobbyPage = lazy(() => import('../pages/LobbyPage.tsx'));
const EntryAvatarPage = lazy(() => import('../pages/EntryAvatarPage.tsx'));
const LoginPage = lazy(() => import('../pages/LoginPage.tsx'));
const CourseDetailPage = lazy(() => import('../pages/CourseDetailPage'));
const MentoringSessionPage = lazy(() => import('../pages/MentoringSessionPage'));
const SpacePage = lazy(() => import('../pages/SpacePage'));
const StudySessionPage = lazy(() => import('../pages/StudySessionPage'));
const SignupPage = lazy(() => import('../pages/SignupPage.tsx'));

function withSuspense(element, message) {
  return (
    <Suspense fallback={<RouteLoadingFallback message={message} />}>
      {element}
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    element: <AuthNavigationHandler />,
    children: [
      {
        path: '/',
        element: withSuspense(<LandingPage />, '랜딩 화면을 준비하고 있습니다...'),
      },
      {
        element: <GuestOnlyRoute />,
        children: [
          {
            path: '/login',
            element: withSuspense(<LoginPage />, '로그인 화면을 준비하고 있습니다...'),
          },
          {
            path: '/signup',
            element: withSuspense(<SignupPage />, '회원가입 화면을 준비하고 있습니다...'),
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/lobby',
            element: withSuspense(<LobbyPage />, '로비 화면을 준비하고 있습니다...'),
          },
          {
            path: '/hub',
            element: <HubPage />,
          },
          {
            path: '/courses/:courseId',
            element: withSuspense(<CourseDetailPage />, '수업 상세를 준비하고 있습니다...'),
          },
          {
            path: '/enter',
            element: withSuspense(<EntryAvatarPage />, '캐릭터 선택 화면을 준비하고 있습니다...'),
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
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
