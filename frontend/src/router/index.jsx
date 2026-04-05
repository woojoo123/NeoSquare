import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';

import LobbyPage from '../pages/LobbyPage';
import LoginPage from '../pages/LoginPage';
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
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
