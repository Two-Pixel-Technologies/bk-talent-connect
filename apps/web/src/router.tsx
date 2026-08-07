/**
 * Route table.
 *
 * Portal routes come first because the portal ships before the public site
 * (P9). Every guarded route is also enforced server-side — these guards are a
 * usability affordance, not the security boundary.
 */

import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from './components/layout/root-layout.js';
import { ProtectedRoute } from './features/auth/auth-context.js';
import { LandingPage } from './pages/landing.js';
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
} from './pages/portal-home.js';

/*
 * Portal screens are loaded on demand.
 *
 * Every visitor was downloading all three portals — a candidate on a mid-range
 * Android phone paid for the eleven admin screens they will never open. The
 * split is by role, because that is how the app is actually used: one person
 * needs exactly one of these groups.
 *
 * Safe to do because ErrorBoundary already handles the stale-chunk case: a user
 * holding a pre-deploy bundle who navigates to a chunk that no longer exists
 * gets one automatic reload rather than a white page.
 */
const ProfileWizardPage = lazy(() => import('./pages/candidate/profile-wizard.js').then((m) => ({ default: m.ProfileWizardPage })));
const BrowseJobsPage = lazy(() => import('./pages/candidate/browse-jobs.js').then((m) => ({ default: m.BrowseJobsPage })));
const JobDetailPage = lazy(() => import('./pages/candidate/job-detail.js').then((m) => ({ default: m.JobDetailPage })));
const ApplicationsPage = lazy(() => import('./pages/candidate/applications.js').then((m) => ({ default: m.ApplicationsPage })));
const ApplicantsPage = lazy(() => import('./pages/employer/applicants.js').then((m) => ({ default: m.ApplicantsPage })));
const CompanyProfilePage = lazy(() => import('./pages/employer/company-profile.js').then((m) => ({ default: m.CompanyProfilePage })));
const JobListPage = lazy(() => import('./pages/employer/job-list.js').then((m) => ({ default: m.JobListPage })));
const JobEditorPage = lazy(() => import('./pages/employer/job-editor.js').then((m) => ({ default: m.JobEditorPage })));
const AdminDashboard = lazy(() => import('./pages/admin/dashboard.js').then((m) => ({ default: m.AdminDashboard })));
const CandidateQueuePage = lazy(() => import('./pages/admin/candidate-queue.js').then((m) => ({ default: m.CandidateQueuePage })));
const EmployerQueuePage = lazy(() => import('./pages/admin/employer-queue.js').then((m) => ({ default: m.EmployerQueuePage })));
const JobQueuePage = lazy(() => import('./pages/admin/job-queue.js').then((m) => ({ default: m.JobQueuePage })));
const PipelinePage = lazy(() => import('./pages/admin/pipeline.js').then((m) => ({ default: m.PipelinePage })));
const CoordinationPage = lazy(() => import('./pages/admin/coordination.js').then((m) => ({ default: m.CoordinationPage })));
const RecommendPage = lazy(() => import('./pages/admin/recommend.js').then((m) => ({ default: m.RecommendPage })));
const SkillsPage = lazy(() => import('./pages/admin/skills.js').then((m) => ({ default: m.SkillsPage })));
const TaxonomyPage = lazy(() => import('./pages/admin/taxonomy.js').then((m) => ({ default: m.TaxonomyPage })));
const EnquiriesPage = lazy(() => import('./pages/admin/enquiries.js').then((m) => ({ default: m.EnquiriesPage })));
const ErasurePage = lazy(() => import('./pages/admin/erasure.js').then((m) => ({ default: m.ErasurePage })));
const PrivacyPage = lazy(() => import('./pages/account/privacy.js').then((m) => ({ default: m.PrivacyPage })));

/** Route-level fallback. Deliberately quiet — chunks land in milliseconds. */
function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>{children}</Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },

      /*
       * Internal build and system pages, development only.
       *
       * These are unauthenticated routes that show the build board — "P8 in
       * progress", "rollback rehearsed: false" — and the open commercial
       * questions with the client. Shipping them would put all of that in
       * front of BK's own candidates and employers. Excluded from the bundle
       * entirely rather than hidden, so there is nothing to find.
       */
      ...(import.meta.env.DEV
        ? [
            { path: 'status', element: <BuildStatusPage /> },
            { path: 'system', element: <SystemStatusPage /> },
          ]
        : []),

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
          { path: 'profile', element: (
              <Lazy>
                <ProfileWizardPage />
              </Lazy>
            ) },
          { path: 'jobs', element: (
              <Lazy>
                <BrowseJobsPage />
              </Lazy>
            ) },
          { path: 'jobs/:id', element: (
              <Lazy>
                <JobDetailPage />
              </Lazy>
            ) },
          { path: 'applications', element: (
              <Lazy>
                <ApplicationsPage />
              </Lazy>
            ) },
          { path: 'privacy', element: (
              <Lazy>
                <PrivacyPage />
              </Lazy>
            ) },
        ],
      },
      {
        path: 'employer',
        element: (
          <ProtectedRoute role="EMPLOYER">
            <EmployerLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <EmployerHome /> },
          { path: 'company', element: (
              <Lazy>
                <CompanyProfilePage />
              </Lazy>
            ) },
          { path: 'jobs', element: (
              <Lazy>
                <JobListPage />
              </Lazy>
            ) },
          { path: 'jobs/:id', element: (
              <Lazy>
                <JobEditorPage />
              </Lazy>
            ) },
          { path: 'jobs/:id/applicants', element: (
              <Lazy>
                <ApplicantsPage />
              </Lazy>
            ) },
          { path: 'privacy', element: (
              <Lazy>
                <PrivacyPage />
              </Lazy>
            ) },
        ],
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute role="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: (
              <Lazy>
                <AdminDashboard />
              </Lazy>
            ) },
          { path: 'candidates', element: (
              <Lazy>
                <CandidateQueuePage />
              </Lazy>
            ) },
          { path: 'employers', element: (
              <Lazy>
                <EmployerQueuePage />
              </Lazy>
            ) },
          { path: 'jobs', element: (
              <Lazy>
                <JobQueuePage />
              </Lazy>
            ) },
          { path: 'jobs/:id/recommend', element: (
              <Lazy>
                <RecommendPage />
              </Lazy>
            ) },
          { path: 'pipeline', element: (
              <Lazy>
                <PipelinePage />
              </Lazy>
            ) },
          { path: 'coordination', element: (
              <Lazy>
                <CoordinationPage />
              </Lazy>
            ) },
          { path: 'skills', element: (
              <Lazy>
                <SkillsPage />
              </Lazy>
            ) },
          { path: 'taxonomy', element: (
              <Lazy>
                <TaxonomyPage />
              </Lazy>
            ) },
          { path: 'enquiries', element: (
              <Lazy>
                <EnquiriesPage />
              </Lazy>
            ) },
          { path: 'erasure', element: (
              <Lazy>
                <ErasurePage />
              </Lazy>
            ) },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
