/**
 * The employer's job postings.
 *
 * Status is the organising idea rather than a column, because at any moment an
 * employer cares about one thing: what needs my attention. "Changes requested"
 * is surfaced first for that reason.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { formatDate } from '@bktc/shared';
import { ApiError } from '../../lib/api-client.js';
import {
  useEmployerJobs,
  useCreateJob,
  useApplicantCount,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  type EmployerJob,
} from '../../features/employer/use-employer.js';
import { useAuth } from '../../features/auth/auth-context.js';
import { Alert, Badge, Button, Card, EmptyState, Field, Input } from '../../components/ui/index.js';
import { Pagination } from '../../components/pagination.js';
import { QueryState } from '../../components/query-state.js';
import { EMPLOYER_CARD } from './employer-style.js';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'CHANGES_REQUESTED', label: 'Needs attention' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'PENDING_APPROVAL', label: 'Under review' },
  { value: 'APPROVED', label: 'Live' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'REJECTED', label: 'Not approved' },
  { value: 'FILLED', label: 'Filled' },
];

export function JobListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [page, setPage] = useState(1);

  const { data, isPending, error: listError, refetch } = useEmployerJobs(filter || undefined, page);
  const create = useCreateJob();
  const navigate = useNavigate();

  const verified = user?.approvalStatus === 'APPROVED';
  const createError = create.error instanceof ApiError ? create.error : null;

  // The Overview hero's "+ Post a job" CTA links here with ?new=1 so it lands
  // straight in the create form instead of the plain list — the same page
  // either way, just opened to a different starting point.
  useEffect(() => {
    if (verified && searchParams.get('new') === '1') {
      setCreating(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [verified, searchParams, setSearchParams]);

  async function submitNew() {
    const job = await create.mutateAsync(title.trim());
    setCreating(false);
    setTitle('');
    navigate(`/employer/jobs/${job.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Job Postings</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">Job postings</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Every posting is reviewed by our team before it goes live.
          </p>
        </div>
        {verified && !creating && (
          <Button onClick={() => setCreating(true)}>+ New posting</Button>
        )}
      </div>

      {!verified && (
        <Alert tone="warning" title="Your company is still being verified">
          You can create postings once our team has verified your company.
        </Alert>
      )}

      {creating && (
        <Card className={EMPLOYER_CARD}>
          <h2 className="font-semibold text-brand-900">What is the role?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Start with the job title — you can fill in the rest next.
          </p>
          {createError && (
            <div className="mt-4">
              <Alert tone="error">{createError.message}</Alert>
            </div>
          )}
          <div className="mt-4">
            <Field label="Job title" htmlFor="newTitle" required>
              <Input
                id="newTitle"
                value={title}
                autoFocus
                placeholder="e.g. Senior Process Engineer"
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && title.trim().length >= 3) void submitNew();
                }}
              />
            </Field>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => void submitNew()}
              loading={create.isPending}
              disabled={title.trim().length < 3}
            >
              Create and continue
            </Button>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Scrolls rather than wrapping into a tall block on a phone. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const count = f.value ? (data?.counts[f.value] ?? 0) : (data?.total ?? 0);
          return (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => {
                setPage(1);
                setFilter(f.value);
              }}
              className={`min-h-11 shrink-0 rounded-lg border px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                filter === f.value
                  ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-900/10'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
              {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      <QueryState isPending={isPending} error={listError} onRetry={() => void refetch()}>
      {data && data.items.length === 0 && (
        <EmptyState
          title={filter ? 'Nothing here' : 'No postings yet'}
          description={
            filter
              ? 'Try a different filter.'
              : verified
                ? 'Create your first posting and our team will review it.'
                : 'You can post roles once your company is verified.'
          }
        />
      )}

      <div className="space-y-3">
        {data?.items.map((job) => <JobRow key={job.id} job={job} />)}
      </div>
      </QueryState>

      {data && (
        <Pagination page={page} pageSize={data.pageSize} total={data.total} onChange={setPage} noun="posting" />
      )}
    </div>
  );
}

function JobRow({ job }: { job: EmployerJob }) {
  const location = [job.cityName, job.state].filter(Boolean).join(', ');
  // Only ever queried for jobs that have actually been submitted at least
  // once — a DRAFT has no applications table rows to count.
  const countEnabled = job.status !== 'DRAFT';
  const { data: applicantData } = useApplicantCount(job.id, countEnabled);

  return (
    <Link
      to={`/employer/jobs/${job.id}`}
      className={`block rounded-xl border bg-white p-4 transition-all hover:border-brand-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)] sm:p-5 ${EMPLOYER_CARD}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{job.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {[job.functionName, location].filter(Boolean).join(' · ') || 'Not filled in yet'}
          </p>
        </div>
        <Badge tone={JOB_STATUS_TONE[job.status] ?? 'slate'}>
          {JOB_STATUS_LABEL[job.status] ?? job.status}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
        {job.minExperience != null && job.maxExperience != null && (
          <span>
            {job.minExperience}-{job.maxExperience} yrs
          </span>
        )}
        {job.numberOfPositions > 1 && <span>{job.numberOfPositions} positions</span>}
        {job.publishedAt && <span>Live since {formatDate(job.publishedAt)}</span>}
        {job.requiredSkills.length > 0 && <span>{job.requiredSkills.length} required skills</span>}
        {countEnabled && applicantData !== undefined && (
          <span className="font-medium text-brand-700">
            {applicantData.total} {applicantData.total === 1 ? 'applicant' : 'applicants'}
          </span>
        )}
      </div>

      {job.status === 'CHANGES_REQUESTED' && job.reviewNote && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{job.reviewNote}</p>
      )}
    </Link>
  );
}
