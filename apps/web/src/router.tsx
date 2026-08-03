/**
 * Route table.
 *
 * Portal routes come first because the portal ships before the public site
 * (P9). Every guarded route is also enforced server-side — these guards are a
 * usability affordance, not the security boundary.
 */

import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from './components/layout/root-layout.js';
import { ProtectedRoute } from './features/auth/auth-context.js';
import { SystemStatusPage } from './pages/system-status.js';
import { BuildStatusPage } from './pages/build-status.js';
import { NotFoundPage } from './pages/not-found.js';
import { LoginPage } from './pages/auth/login.js';
import { RegisterCandidatePage } from './pages/auth/register-candidate.js';
import { RegisterEmployerPage } from './pages/auth/register-employer.js';
import { ChangePasswordPage } from './pages/auth/change-password.js';
import {
  CandidateLayout,
  EmployerLayout,
  AdminLayout,
  CandidateHome,
  EmployerHome,
  AdminHome,
} from './pages/portal-home.js';
import { ProfileWizardPage } from './pages/candidate/profile-wizard.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <BuildStatusPage /> },
      { path: 'system', element: <SystemStatusPage /> },

      { path: 'login', element: <LoginPage /> },
      { path: 'register/candidate', element: <RegisterCandidatePage /> },
      { path: 'register/employer', element: <RegisterEmployerPage /> },
      {
        path: 'change-password',
        element: (
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        ),
      },

      {
        path: 'candidate',
        element: (
          <ProtectedRoute role="CANDIDATE">
            <CandidateLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <CandidateHome /> },
          { path: 'profile', element: <ProfileWizardPage /> },
        ],
      },
      {
        path: 'employer',
        element: (
          <ProtectedRoute role="EMPLOYER">
            <EmployerLayout />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <EmployerHome /> }],
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute role="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [{ index: true, element: <AdminHome /> }],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
