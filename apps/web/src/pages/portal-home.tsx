/**
 * Portal landing pages.
 *
 * Each one's job right now is to make the approval gate legible — a candidate
 * awaiting review needs to know that is what is happening, not see an empty
 * dashboard. The feature panels arrive with P2–P7.
 */

import { Link } from 'react-router-dom';
import { formatDate, formatRelative } from '@bktc/shared';
import { PortalLayout, type NavItem } from '../components/layout/portal-layout.js';
import { useAuth } from '../features/auth/auth-context.js';
import { useProfile } from '../features/candidate/use-profile.js';
import { useApplications, type TrackedApplication } from '../features/candidate/use-jobs.js';
import {
  useEmployerProfile,
  useEmployerJobs,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
} from '../features/employer/use-employer.js';
import { useNotifications } from '../features/notifications/use-notifications.js';
import { Alert, Card, Badge } from '../components/ui/index.js';
import { CANDIDATE_CARD } from './candidate/candidate-style.js';
import { EMPLOYER_CARD } from './employer/employer-style.js';

const CANDIDATE_NAV: readonly NavItem[] = [
  { to: '/candidate', label: 'Overview', end: true },
  { to: '/candidate/profile', label: 'My profile' },
  { to: '/candidate/jobs', label: 'Browse jobs' },
  { to: '/candidate/applications', label: 'Applications' },
  { to: '/candidate/privacy', label: 'Your data' },
];

const EMPLOYER_NAV: readonly NavItem[] = [
  { to: '/employer', label: 'Overview', end: true },
  { to: '/employer/company', label: 'Company' },
  { to: '/employer/jobs', label: 'Job postings' },
  { to: '/employer/privacy', label: 'Your data' },
];

const ADMIN_NAV: readonly NavItem[] = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/candidates', label: 'Candidates' },
  { to: '/admin/employers', label: 'Employers' },
  { to: '/admin/jobs', label: 'Jobs' },
  { to: '/admin/pipeline', label: 'Pipeline' },
  { to: '/admin/coordination', label: 'Interviews' },
  // Housekeeping, so it sits after the daily work rather than in front of it.
  { to: '/admin/skills', label: 'Skills' },
  { to: '/admin/taxonomy', label: 'Taxonomy' },
  { to: '/admin/enquiries', label: 'Enquiries' },
  { to: '/admin/erasure', label: 'Erasure' },
];

export const CandidateLayout = () => (
  <PortalLayout title="Candidate" nav={CANDIDATE_NAV} variant="public" />
);
export const EmployerLayout = () => (
  <PortalLayout title="Employer" nav={EMPLOYER_NAV} variant="public" />
);
export const AdminLayout = () => <PortalLayout title="Admin" nav={ADMIN_NAV} variant="public" />;

const STATUS_TONE: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
  DRAFT: 'info',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  CHANGES_REQUESTED: 'warning',
  REJECTED: 'error',
};

const CANDIDATE_HOME_COPY: Record<string, { title: string; body: string }> = {
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

/**
 * Real per-candidate guidance for every non-approved status. Reused from the
 * copy that already shipped before this pass — only the surrounding shell
 * changed (see DashboardHero below), not the wording rules.
 */
function PendingApprovalDashboard({ status }: { status: string }) {
  const { data: profile } = useProfile();
  const message = CANDIDATE_HOME_COPY[status] ?? CANDIDATE_HOME_COPY.DRAFT!;
  // The team's actual note is the point of these two states — the generic
  // copy is only a fallback for when none was left, exactly like the
  // identical rule already in ProfileWizardPage's StatusBanner.
  const showsReviewNote = status === 'CHANGES_REQUESTED' || status === 'REJECTED';
  const body = showsReviewNote ? (profile?.reviewNote ?? message.body) : message.body;

  return (
    <div className="space-y-6">
      <DashboardHero status={status} />

      <Alert tone={STATUS_TONE[status] ?? 'info'} title={message.title}>
        {body}
      </Alert>

      {/* Same real feed and component the Approved dashboard uses — a DRAFT or
          SUBMITTED candidate can already receive a real notification (welcome,
          changes-requested) with nowhere but the header bell to see it. */}
      <RecentUpdates />

      <Card className={CANDIDATE_CARD}>
        <h2 className="font-semibold text-brand-900">What happens next</h2>
        <ol className="mt-4 space-y-3 text-sm text-slate-600">
          <li>1. Build your profile with skills, experience, career summary and CV.</li>
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

/** Applications closed to further candidate-visible progress — mirrors the
 * local convention already used by ApplicationsPage (pages/candidate/applications.tsx). */
const CLOSED_STAGES = ['NOT_SELECTED', 'WITHDRAWN', 'OFFER_DECLINED', 'JOINED'];

function activeCount(items: readonly TrackedApplication[]): number {
  return items.filter((a) => !CLOSED_STAGES.includes(a.stage)).length;
}

/**
 * Status pill shown in the hero — one small icon + label per real
 * approvalStatus value. Every status renders the identical hero shell below;
 * only this pill, the CTA label and (for APPROVED) the metrics/sections that
 * follow change, so no candidate ever sees a visually different, lesser
 * dashboard just because their profile isn't approved yet.
 */
const STATUS_PILL: Record<string, { label: string; path: string }> = {
  DRAFT: { label: 'Draft', path: 'M10.5 2.5l3 3L5 14H2v-3l8.5-8.5Z' },
  SUBMITTED: { label: 'Under review', path: 'M8 4.5V8l2.5 1.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0Z' },
  APPROVED: { label: 'Profile approved', path: 'M3 8.5 6.2 12 13 4' },
  CHANGES_REQUESTED: {
    label: 'Changes requested',
    path: 'M8 6v3.2M8 11.6h.01M6.9 2.9 1.3 12.4a1 1 0 0 0 .86 1.5h11.68a1 1 0 0 0 .86-1.5L9.1 2.9a1 1 0 0 0-2.2 0Z',
  },
  REJECTED: { label: 'Not approved', path: 'M4.5 4.5l7 7M11.5 4.5l-7 7' },
};

/**
 * The one hero every candidate status renders — same navy surface, same
 * spacing, same completion panel. Only the status pill and the CTA label
 * (locked while SUBMITTED, since the profile can't be edited then — see
 * ProfileWizardPage's identical `locked` rule) change with real status.
 */
function DashboardHero({ status }: { status: string }) {
  const { data: profile, isPending, isError } = useProfile();

  const firstName = profile?.fullName?.trim().split(/\s+/)[0];
  const subtitleParts = [profile?.currentJobTitle, profile?.sectorName, profile?.cityName].filter(
    (part): part is string => Boolean(part),
  );
  const pill = STATUS_PILL[status] ?? STATUS_PILL.DRAFT!;
  const locked = status === 'SUBMITTED';

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-800 p-6 text-white sm:p-8">
      {/* A single, very soft highlight for depth — not a decorative pattern. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/[0.06] blur-3xl"
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold tracking-wide">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none">
              <path
                d={pill.path}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {pill.label}
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          {subtitleParts.length > 0 && (
            <p className="mt-1.5 max-w-md text-sm text-white/70">{subtitleParts.join(' · ')}</p>
          )}
        </div>

        {/* Completion comes straight from the real profile record — never
            recalculated on the frontend. Shown for every status: a DRAFT or
            CHANGES_REQUESTED candidate cares about this number just as much
            as an approved one. */}
        {!isError && (
          <div className="w-full shrink-0 rounded-xl border border-white/10 bg-white/10 p-4 text-center sm:w-44">
            <p className="text-3xl font-bold tabular-nums">
              {isPending ? '...' : `${profile?.completionPercent ?? 0}%`}
            </p>
            <p className="mt-1 text-[11px] font-medium tracking-wide text-white/65 uppercase">
              Profile complete
            </p>
            <Link
              to="/candidate/profile"
              className="mt-3 flex min-h-9 w-full items-center justify-center rounded-lg bg-white text-xs font-semibold text-brand-900 transition-colors hover:bg-brand-50"
            >
              {locked ? 'View profile' : 'Update profile'}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

const METRIC_ICON_PATHS: Record<string, string> = {
  Active: 'M3 7.5h10M6.5 4h3a1 1 0 0 1 1 1v1.5h-5V5a1 1 0 0 1 1-1ZM3.5 7.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4',
  Shortlisted: 'M8 2.5 9.5 6l3.7.35-2.8 2.5.85 3.65L8 10.65 4.75 12.5l.85-3.65-2.8-2.5L6.5 6 8 2.5Z',
  Interviews: 'M3.5 3.5h9a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Zm0 3.25h11M6 2v2.5M10 2v2.5',
};

const METRIC_ACCENT: Record<string, string> = {
  Active: 'bg-brand-50 text-brand-700',
  Shortlisted: 'bg-amber-50 text-amber-700',
  Interviews: 'bg-emerald-50 text-emerald-700',
};

function DashboardMetrics({ items }: { items: readonly TrackedApplication[] }) {
  const active = activeCount(items);
  const shortlisted = items.filter((a) => a.stage === 'SHORTLISTED').length;
  // Matches the exact stage ApplicationsPage's own InterviewPanel keys off —
  // not INTERVIEWED, which means the interview has already happened.
  const interviews = items.filter((a) => a.stage === 'INTERVIEW_SCHEDULED').length;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {[
        { label: 'Active', value: active },
        { label: 'Shortlisted', value: shortlisted },
        { label: 'Interviews', value: interviews },
      ].map((metric) => (
        <div
          key={metric.label}
          className={`flex flex-col items-center gap-1.5 rounded-xl bg-white px-2 py-3.5 text-center transition-shadow hover:shadow-[0_4px_14px_rgba(15,23,42,0.07)] sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:text-left border ${CANDIDATE_CARD}`}
        >
          <span
            aria-hidden="true"
            className={`hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex ${METRIC_ACCENT[metric.label]}`}
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none">
              <path
                d={METRIC_ICON_PATHS[metric.label]}
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-xl leading-none font-bold tabular-nums text-brand-900">{metric.value}</p>
            <p className="mt-1 text-[11px] leading-tight font-medium text-slate-500 sm:tracking-wide sm:uppercase">
              {metric.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentUpdates() {
  const { data, isPending, error } = useNotifications(true);
  const items = data?.items.slice(0, 3) ?? [];

  return (
    <Card className={`p-0 sm:p-0 ${CANDIDATE_CARD}`}>
      <h2 className="px-5 pt-5 font-semibold text-brand-900 sm:px-6 sm:pt-6">Recent updates</h2>

      {isPending && (
        <div className="space-y-2 px-5 pt-3 pb-5 sm:px-6 sm:pb-6" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}

      {!isPending && error && (
        <p className="px-5 pt-3 pb-5 text-sm text-slate-500 sm:px-6 sm:pb-6">
          We couldn&rsquo;t load your updates right now.
        </p>
      )}

      {!isPending && !error && items.length === 0 && (
        <p className="px-5 pt-3 pb-5 text-sm text-slate-500 sm:px-6 sm:pb-6">No updates yet.</p>
      )}

      {!isPending && !error && items.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pb-1">
          {items.map((n) => (
            <li key={n.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
              <span
                aria-hidden="true"
                className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.read ? 'bg-slate-300' : 'bg-brand-500'}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{n.title}</p>
              </div>
              <p className="shrink-0 text-xs font-medium text-slate-400">{formatRelative(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecommendedByUs({ items }: { items: readonly TrackedApplication[] }) {
  const recommended = items.filter((a) => a.isRecommended);
  if (recommended.length === 0) return null;

  return (
    <Card className={CANDIDATE_CARD}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-brand-900">Recommended by us</h2>
        <Link to="/candidate/applications" className="text-xs font-semibold text-brand-600 hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {recommended.slice(0, 4).map((a) => {
          const meta = [a.cityName, a.sectorName].filter(Boolean).join(' · ');
          return (
            <div
              key={a.id}
              className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-brand-300 hover:shadow-[0_4px_14px_rgba(15,23,42,0.07)]"
            >
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"
              >
                <svg viewBox="0 0 16 16" className="size-4" fill="none">
                  <path
                    d={METRIC_ICON_PATHS.Active}
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>

              <div className="mt-3 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-slate-800">{a.jobTitle}</p>
                {meta && <p className="mt-1 text-xs text-slate-500">{meta}</p>}
              </div>

              <Link
                to="/candidate/applications"
                className="mt-4 flex min-h-9 items-center justify-center gap-1 rounded-lg bg-brand-600 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
              >
                View role
                <span aria-hidden="true">›</span>
              </Link>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function YourApplications({ items }: { items: readonly TrackedApplication[] }) {
  // Client-side only, per Phase 1 scope — the API itself still returns
  // applied-first order; this just reorders the already-fetched page.
  const sorted = [...items].sort((a, b) => {
    const left = a.lastStageChangeAt ?? a.appliedAt;
    const right = b.lastStageChangeAt ?? b.appliedAt;
    return new Date(right).getTime() - new Date(left).getTime();
  });

  return (
    <Card className={CANDIDATE_CARD}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-brand-900">Your applications</h2>
        <Link to="/candidate/applications" className="text-xs font-semibold text-brand-600 hover:underline">
          View all
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No applications yet.{' '}
          <Link to="/candidate/jobs" className="font-semibold text-brand-600 hover:underline">
            Browse open roles
          </Link>
          .
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {sorted.slice(0, 4).map((a) => (
            <Link
              key={a.id}
              to="/candidate/applications"
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3.5 transition-colors hover:border-brand-200 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{a.jobTitle}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {a.cityName ?? 'Location not specified'} · updated {formatRelative(a.lastStageChangeAt)}
                </p>
              </div>
              <Badge tone={stageTone(a.stage)}>{a.stageLabel}</Badge>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Mirrors ApplicationsPage's own stageTone() exactly (pages/candidate/applications.tsx) — not exported there, so kept as a matching local copy rather than reaching into that page's internals. */
function stageTone(stage: string): string {
  if (stage === 'NOT_SELECTED' || stage === 'OFFER_DECLINED') return 'red';
  if (stage === 'WITHDRAWN') return 'slate';
  if (stage === 'OFFER_MADE' || stage === 'OFFER_ACCEPTED' || stage === 'JOINED') return 'green';
  if (stage === 'SHORTLISTED' || stage === 'INTERVIEW_SCHEDULED') return 'brand';
  return 'amber';
}

function ApprovedCandidateDashboard() {
  const { data, isPending, error, refetch } = useApplications(1);
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <DashboardHero status="APPROVED" />

      {isPending && (
        <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      )}

      {!isPending && error && (
        <Alert tone="warning" title="We couldn&rsquo;t load your applications">
          <p>Everything else on this page still works. Try again in a moment.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 text-sm font-medium text-brand-700 hover:underline"
          >
            Try again
          </button>
        </Alert>
      )}

      {!isPending && !error && <DashboardMetrics items={items} />}

      <RecentUpdates />

      {!isPending && !error && <RecommendedByUs items={items} />}

      {!isPending && !error && <YourApplications items={items} />}
    </div>
  );
}

export function CandidateHome() {
  const { user } = useAuth();
  const status = user?.approvalStatus ?? 'DRAFT';

  if (status !== 'APPROVED') {
    return <PendingApprovalDashboard status={status} />;
  }

  return <ApprovedCandidateDashboard />;
}

/**
 * Real per-employer guidance for every non-approved status. Same rule as the
 * candidate side: a generic message is only a fallback for when the admin
 * left no note — CHANGES_REQUESTED and REJECTED show the real one.
 */
const EMPLOYER_HOME_COPY: Record<string, { title: string; body: string }> = {
  SUBMITTED: {
    title: 'Your company is under review',
    body: 'Our team is verifying your company. You will be able to post roles as soon as it is approved.',
  },
  APPROVED: {
    title: 'Your company is verified',
    body: 'You can post roles and manage your pipeline. Every posting is reviewed by our team before it goes live.',
  },
  CHANGES_REQUESTED: {
    title: 'A few changes needed',
    body: 'Our team has asked for some updates to your company profile. Open your company page to see what they need.',
  },
  REJECTED: {
    title: 'Company not approved',
    body: 'Unfortunately we could not verify your company. Please contact the BK Talent Connect team.',
  },
};

/** Same icon set as the candidate status pill, employer-appropriate labels. */
const EMPLOYER_STATUS_PILL: Record<string, { label: string; path: string }> = {
  SUBMITTED: STATUS_PILL.SUBMITTED!,
  APPROVED: { label: 'Account approved', path: STATUS_PILL.APPROVED!.path },
  CHANGES_REQUESTED: STATUS_PILL.CHANGES_REQUESTED!,
  REJECTED: STATUS_PILL.REJECTED!,
};

/**
 * The one hero every employer status renders — same navy surface as the
 * candidate hero, same spacing. The side panel is CTAs rather than a
 * completion ring, because there is no completionPercent on an employer
 * profile to show truthfully.
 */
function EmployerDashboardHero({ status }: { status: string }) {
  const { data: profile, isError } = useEmployerProfile();
  const approved = status === 'APPROVED';

  const firstName = profile?.hrContactName?.trim().split(/\s+/)[0];
  const subtitleParts = [profile?.companyName, profile?.sectorName].filter(
    (part): part is string => Boolean(part),
  );
  const pill = EMPLOYER_STATUS_PILL[status] ?? EMPLOYER_STATUS_PILL.SUBMITTED!;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-800 p-6 text-white sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/[0.06] blur-3xl"
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold tracking-wide">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none">
              <path
                d={pill.path}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {pill.label}
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back{firstName ? `, ${firstName}` : ''}
          </h1>
          {subtitleParts.length > 0 && (
            <p className="mt-1.5 max-w-md text-sm text-white/70">{subtitleParts.join(' · ')}</p>
          )}
        </div>

        {!isError && (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-52">
            {approved ? (
              <>
                <Link
                  to="/employer/jobs?new=1"
                  className="flex min-h-10 w-full items-center justify-center rounded-lg bg-white text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50"
                >
                  + Post a job
                </Link>
                <Link
                  to="/employer/jobs"
                  className="flex min-h-10 w-full items-center justify-center rounded-lg border border-white/25 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  View postings
                </Link>
              </>
            ) : (
              <Link
                to="/employer/company"
                className="flex min-h-10 w-full items-center justify-center rounded-lg bg-white text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50"
              >
                Update company profile
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const JOB_METRIC_ICON_PATHS: Record<string, string> = {
  Live: 'M3 8.5 6.2 12 13 4',
  'Under review': 'M8 4.5V8l2.5 1.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0Z',
  'Needs attention': 'M8 6v3.2M8 11.6h.01M6.9 2.9 1.3 12.4a1 1 0 0 0 .86 1.5h11.68a1 1 0 0 0 .86-1.5L9.1 2.9a1 1 0 0 0-2.2 0Z',
};

const JOB_METRIC_ACCENT: Record<string, string> = {
  Live: 'bg-emerald-50 text-emerald-700',
  'Under review': 'bg-amber-50 text-amber-700',
  'Needs attention': 'bg-brand-50 text-brand-700',
};

/** Every number here comes straight from useEmployerJobs()'s own counts —
 * the same counts the Job postings page's filter chips already show. */
function EmployerJobMetrics({ counts }: { counts: Record<string, number> }) {
  const metrics = [
    { label: 'Live', value: counts.APPROVED ?? 0 },
    { label: 'Under review', value: counts.PENDING_APPROVAL ?? 0 },
    { label: 'Needs attention', value: counts.CHANGES_REQUESTED ?? 0 },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={`flex flex-col items-center gap-1.5 rounded-xl bg-white px-2 py-3.5 text-center transition-shadow hover:shadow-[0_4px_14px_rgba(15,23,42,0.07)] sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:text-left border ${EMPLOYER_CARD}`}
        >
          <span
            aria-hidden="true"
            className={`hidden size-9 shrink-0 items-center justify-center rounded-lg sm:flex ${JOB_METRIC_ACCENT[metric.label]}`}
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none">
              <path
                d={JOB_METRIC_ICON_PATHS[metric.label]}
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-xl leading-none font-bold tabular-nums text-brand-900">{metric.value}</p>
            <p className="mt-1 text-[11px] leading-tight font-medium text-slate-500 sm:tracking-wide sm:uppercase">
              {metric.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Concise recent-postings list — reuses the exact same job rows the Job
 * postings page renders, just fewer of them and without the filter bar. */
function EmployerJobActivity({ items }: { items: readonly { id: string; title: string; cityName: string | null; state: string | null; status: string; updatedAt: string }[] }) {
  return (
    <Card className={EMPLOYER_CARD}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-brand-900">Job activity</h2>
        <Link to="/employer/jobs" className="text-xs font-semibold text-brand-600 hover:underline">
          View all
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No postings yet.{' '}
          <Link to="/employer/jobs?new=1" className="font-semibold text-brand-600 hover:underline">
            Post your first role
          </Link>
          .
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {items.slice(0, 4).map((job) => (
            <Link
              key={job.id}
              to={`/employer/jobs/${job.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3.5 transition-colors hover:border-brand-200 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{job.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[job.cityName, job.state].filter(Boolean).join(', ') || 'Location not specified'}
                  {' · updated '}
                  {formatDate(job.updatedAt)}
                </p>
              </div>
              <Badge tone={JOB_STATUS_TONE[job.status] ?? 'slate'}>
                {JOB_STATUS_LABEL[job.status] ?? job.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function ApprovedEmployerDashboard() {
  const { data, isPending, error, refetch } = useEmployerJobs(undefined, 1);
  const items = data?.items ?? [];
  const counts = data?.counts ?? {};

  return (
    <div className="space-y-6">
      <EmployerDashboardHero status="APPROVED" />

      {isPending && (
        <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      )}

      {!isPending && error && (
        <Alert tone="warning" title="We couldn&rsquo;t load your postings">
          <p>Everything else on this page still works. Try again in a moment.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 text-sm font-medium text-brand-700 hover:underline"
          >
            Try again
          </button>
        </Alert>
      )}

      {!isPending && !error && <EmployerJobMetrics counts={counts} />}

      <RecentUpdates />

      {!isPending && !error && <EmployerJobActivity items={items} />}

      <Card className={EMPLOYER_CARD}>
        <h2 className="font-semibold text-brand-900">How hiring works here</h2>
        <ol className="mt-4 space-y-3 text-sm text-slate-600">
          <li>1. Post a role with required skills, experience range and a confidential salary band.</li>
          <li>2. Our team reviews the posting and publishes it.</li>
          <li>3. Review applicants, plus candidates our team recommends for the role.</li>
          <li>4. Request interviews - our team coordinates with both sides.</li>
        </ol>
        <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
          Your salary band is confidential and is never shown to candidates.
        </p>
      </Card>
    </div>
  );
}

function PendingEmployerDashboard({ status }: { status: string }) {
  const { data: profile } = useEmployerProfile();
  const message = EMPLOYER_HOME_COPY[status] ?? EMPLOYER_HOME_COPY.SUBMITTED!;
  const showsReviewNote = status === 'CHANGES_REQUESTED' || status === 'REJECTED';
  const body = showsReviewNote ? (profile?.reviewNote ?? message.body) : message.body;

  return (
    <div className="space-y-6">
      <EmployerDashboardHero status={status} />

      <Alert tone={STATUS_TONE[status] ?? 'info'} title={message.title}>
        {body}
      </Alert>

      <RecentUpdates />

      <Card className={EMPLOYER_CARD}>
        <h2 className="font-semibold text-brand-900">How hiring works here</h2>
        <ol className="mt-4 space-y-3 text-sm text-slate-600">
          <li>1. Post a role with required skills, experience range and a confidential salary band.</li>
          <li>2. Our team reviews the posting and publishes it.</li>
          <li>3. Review applicants, plus candidates our team recommends for the role.</li>
          <li>4. Request interviews - our team coordinates with both sides.</li>
        </ol>
        <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
          Your salary band is confidential and is never shown to candidates.
        </p>
      </Card>
    </div>
  );
}

export function EmployerHome() {
  const { user } = useAuth();
  const status = user?.approvalStatus ?? 'SUBMITTED';

  if (status !== 'APPROVED') {
    return <PendingEmployerDashboard status={status} />;
  }

  return <ApprovedEmployerDashboard />;
}
