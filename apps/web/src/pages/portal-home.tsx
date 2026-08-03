/**
 * Portal landing pages.
 *
 * Each one's job right now is to make the approval gate legible — a candidate
 * awaiting review needs to know that is what is happening, not see an empty
 * dashboard. The feature panels arrive with P2–P7.
 */

import { PortalLayout, type NavItem } from '../components/layout/portal-layout.js';
import { useAuth } from '../features/auth/auth-context.js';
import { Alert, Card, Badge } from '../components/ui/index.js';

const CANDIDATE_NAV: readonly NavItem[] = [
  { to: '/candidate', label: 'Overview', end: true },
  { to: '/candidate/profile', label: 'My profile' },
  { to: '/candidate/jobs', label: 'Browse jobs' },
  { to: '/candidate/applications', label: 'Applications' },
];

const EMPLOYER_NAV: readonly NavItem[] = [
  { to: '/employer', label: 'Overview', end: true },
  { to: '/employer/company', label: 'Company' },
  { to: '/employer/jobs', label: 'Job postings' },
];

const ADMIN_NAV: readonly NavItem[] = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/candidates', label: 'Candidates' },
  { to: '/admin/employers', label: 'Employers' },
  { to: '/admin/jobs', label: 'Jobs' },
];

export const CandidateLayout = () => <PortalLayout title="Candidate" nav={CANDIDATE_NAV} />;
export const EmployerLayout = () => <PortalLayout title="Employer" nav={EMPLOYER_NAV} />;
export const AdminLayout = () => <PortalLayout title="Admin" nav={ADMIN_NAV} />;

const STATUS_TONE: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
  DRAFT: 'info',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  CHANGES_REQUESTED: 'warning',
  REJECTED: 'error',
};

export function CandidateHome() {
  const { user } = useAuth();
  const status = user?.approvalStatus ?? 'DRAFT';

  const copy: Record<string, { title: string; body: string }> = {
    DRAFT: {
      title: 'Finish your profile',
      body: 'Complete every step of your profile and submit it. Our team reviews each profile before opening up the job list.',
    },
    SUBMITTED: {
      title: 'Your profile is under review',
      body: 'Our team is reviewing your profile. You will be able to browse and apply to roles as soon as it is approved.',
    },
    APPROVED: {
      title: 'Your profile is approved',
      body: 'You can browse open roles and apply. We will keep you posted at every stage of each application.',
    },
    CHANGES_REQUESTED: {
      title: 'A few changes needed',
      body: 'Our team has asked for some updates to your profile. Open your profile to see what they need.',
    },
    REJECTED: {
      title: 'Profile not approved',
      body: 'Unfortunately we could not approve your profile. Please contact the BK Talent Connect team.',
    },
  };

  const message = copy[status] ?? copy.DRAFT!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-brand-900">Your dashboard</h1>
        <Badge tone={status === 'APPROVED' ? 'green' : status === 'SUBMITTED' ? 'amber' : 'slate'}>
          {status.replace('_', ' ').toLowerCase()}
        </Badge>
      </div>

      <Alert tone={STATUS_TONE[status] ?? 'info'} title={message.title}>
        {message.body}
      </Alert>

      <Card>
        <h2 className="font-semibold text-brand-900">What happens next</h2>
        <ol className="mt-4 space-y-3 text-sm text-slate-600">
          <li>1. Build your profile — skills, experience, career summary and CV.</li>
          <li>2. Our team reviews and approves it.</li>
          <li>3. Browse open roles and apply in one click.</li>
          <li>4. Track every application from applied through to decision.</li>
        </ol>
        <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
          Your salary expectations stay private. They are visible to the BK team only and are never
          shown to employers.
        </p>
      </Card>
    </div>
  );
}

export function EmployerHome() {
  const { user } = useAuth();
  const status = user?.approvalStatus ?? 'SUBMITTED';
  const approved = status === 'APPROVED';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-brand-900">Your dashboard</h1>
        <Badge tone={approved ? 'green' : 'amber'}>{status.replace('_', ' ').toLowerCase()}</Badge>
      </div>

      {approved ? (
        <Alert tone="success" title="Your company is verified">
          You can post roles. Every posting is reviewed by our team before it goes live.
        </Alert>
      ) : (
        <Alert tone="warning" title="Your account is awaiting verification">
          Our team verifies every company before any job posting can be created. We will be in touch
          shortly.
        </Alert>
      )}

      <Card>
        <h2 className="font-semibold text-brand-900">How hiring works here</h2>
        <ol className="mt-4 space-y-3 text-sm text-slate-600">
          <li>1. Post a role with required skills, experience range and a confidential salary band.</li>
          <li>2. Our team reviews the posting and publishes it.</li>
          <li>3. Review applicants, plus candidates our team recommends for the role.</li>
          <li>4. Request interviews — our team coordinates with both sides.</li>
        </ol>
        <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
          Your salary band is confidential and is never shown to candidates.
        </p>
      </Card>
    </div>
  );
}

export function AdminHome() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-900">Admin overview</h1>
      <Alert tone="info" title="Review queues arrive in P4">
        Approvals for candidate profiles, employer accounts and job postings, plus platform stats.
      </Alert>
    </div>
  );
}
