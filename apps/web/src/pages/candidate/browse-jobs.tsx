/**
 * Job browsing for approved candidates.
 *
 * Roles are anonymous: no company name until shortlist, and never a salary
 * band. So the card has to sell the role on its substance — function, location,
 * experience band and the skills actually being asked for.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '@bktc/shared';
import { useAuth } from '../../features/auth/auth-context.js';
import { useBrowseJobs, type BrowseJob } from '../../features/candidate/use-jobs.js';
import { useTaxonomy } from '../../features/candidate/use-profile.js';
import { Alert, Badge, Card, EmptyState, Input, Select } from '../../components/ui/index.js';
import { Pagination } from '../../components/pagination.js';
import { QueryState } from '../../components/query-state.js';
import { CANDIDATE_CARD } from './candidate-style.js';

/**
 * The two states that need the candidate to DO something say so. Previously all
 * of them read "still being reviewed", which leaves a DRAFT profile waiting
 * forever for a review that was never requested.
 */
const GATE_COPY: Record<
  string,
  { tone: 'info' | 'warning' | 'error'; title: string; body: string; action: string }
> = {
  DRAFT: {
    tone: 'info',
    title: 'Finish your profile to see roles',
    body: 'Complete the five steps and submit. Our team reviews it, usually within a working day.',
    action: 'Continue my profile →',
  },
  SUBMITTED: {
    tone: 'warning',
    title: 'Your profile is with our team',
    body: 'Roles open up as soon as it is approved, usually within a working day.',
    action: 'View my profile',
  },
  CHANGES_REQUESTED: {
    tone: 'warning',
    title: 'We’ve asked for a few changes',
    body: 'Update your profile and resubmit, and roles will open up again.',
    action: 'See what’s needed →',
  },
  REJECTED: {
    tone: 'error',
    title: 'Profile not approved',
    body: 'Please contact the BK Talent Connect team.',
    action: 'View my profile',
  },
};

const WORK_TYPE_LABELS: Record<string, string> = {
  ONSITE: 'On-site',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
};

export function BrowseJobsPage() {
  const { user } = useAuth();
  const { data: taxonomy } = useTaxonomy();
  const [filters, setFilters] = useState({ sector: '', function: '', city: '', search: '' });
  const [page, setPage] = useState(1);

  const approved = user?.approvalStatus === 'APPROVED';
  const { data, isPending, error, refetch } = useBrowseJobs(approved ? filters : {}, page);

  if (!approved) {
    const status = user?.approvalStatus ?? 'DRAFT';
    const gate = GATE_COPY[status] ?? GATE_COPY.SUBMITTED!;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight text-brand-900">Open roles</h1>
        <Alert tone={gate.tone} title={gate.title}>
          {gate.body}{' '}
          <Link to="/candidate/profile" className="font-medium underline">
            {gate.action}
          </Link>
        </Alert>
      </div>
    );
  }

  const set = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Job Search</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">Open roles</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Every role here has been reviewed by our team. Apply in one click. Your profile is your
          application.
        </p>
      </div>

      <Card className={CANDIDATE_CARD}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Search roles"
            aria-label="Search roles"
          />
          <Select value={filters.sector} onChange={(e) => set('sector', e.target.value)} aria-label="Sector">
            <option value="">All sectors</option>
            {taxonomy?.sectors.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </Select>
          <Select value={filters.function} onChange={(e) => set('function', e.target.value)} aria-label="Function">
            <option value="">All functions</option>
            {taxonomy?.functions.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
          </Select>
          <Select value={filters.city} onChange={(e) => set('city', e.target.value)} aria-label="City">
            <option value="">All cities</option>
            {taxonomy?.cities
              .filter((c) => c.state !== null)
              .map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </div>
      </Card>

      <QueryState isPending={isPending} error={error} onRetry={() => void refetch()} loadingLabel="Loading roles…">
        {data && data.items.length === 0 ? (
          <EmptyState
            title="No roles match"
            description="Try widening your filters. We add new roles regularly, and our team may also put you forward for roles directly."
          />
        ) : (
          <div className="space-y-3">
            {data?.items.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        )}
      </QueryState>

      {data && (
        <Pagination
          page={page}
          pageSize={data.pageSize}
          total={data.total}
          onChange={setPage}
          noun="role"
        />
      )}
    </div>
  );
}

function JobCard({ job }: { job: BrowseJob }) {
  return (
    <Link
      to={`/candidate/jobs/${job.id}`}
      className={`block rounded-xl border bg-white p-4 transition-all hover:border-brand-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)] sm:p-5 ${CANDIDATE_CARD}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{job.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {[job.functionName, job.sectorName].filter(Boolean).join(' · ')}
          </p>
        </div>
        {job.hasApplied && <Badge tone="green">Applied</Badge>}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
        {job.cityName && <span>{job.cityName}</span>}
        {job.workType && <span>{WORK_TYPE_LABELS[job.workType] ?? job.workType}</span>}
        {job.minExperience != null && job.maxExperience != null && (
          <span>
            {job.minExperience}–{job.maxExperience} yrs
          </span>
        )}
        {job.numberOfPositions > 1 && <span>{job.numberOfPositions} positions</span>}
      </div>

      {job.requiredSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.requiredSkills.slice(0, 6).map((s) => (
            <span key={s.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-800">
              {s.name}
            </span>
          ))}
          {job.requiredSkills.length > 6 && (
            <span className="px-1 py-1 text-xs text-slate-400">
              +{job.requiredSkills.length - 6}
            </span>
          )}
        </div>
      )}

      {job.publishedAt && (
        <p className="mt-3 text-xs text-slate-400">Posted {formatDate(job.publishedAt)}</p>
      )}
    </Link>
  );
}
