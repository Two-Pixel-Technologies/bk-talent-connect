/**
 * Route skeleton.
 *
 * The four groups mirror the product's audiences. Public pages are deliberately
 * last in the build order (P9) — the portal ships first — so those routes are
 * placeholders for now while the candidate/employer/admin trees fill in from P1.
 */

import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from './components/layout/root-layout.js';
import { SystemStatusPage } from './pages/system-status.js';
import { NotFoundPage } from './pages/not-found.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <SystemStatusPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
