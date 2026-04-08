import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';

import LobbyPage from '../pages/LobbyPage';
import LoginPage from '../pages/LoginPage';
import MentoringSessionPage from '../pages/MentoringSessionPage';
import SpacePage from '../pages/SpacePage';
import StudySessionPage from '../pages/StudySessionPage';
import SignupPage from '../pages/SignupPage';
import RequireAuth from './RequireAuth';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/lobby',
        element: <LobbyPage />,
      },
      {
        path: '/spaces/:spaceId',
        element: <SpacePage />,
      },
      {
        path: '/mentoring/session/:requestId',
        element: <MentoringSessionPage />,
      },
      {
        path: '/study/sessions/:sessionId',
        element: <StudySessionPage />,
      },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
