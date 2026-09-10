/**
 * A single role, and the apply action.
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { formatDate, EDUCATION_LABELS } from '@bktc/shared';
import { ApiError } from '../../lib/api-client.js';
import { useJobDetail, useApply } from '../../features/candidate/use-jobs.js';
import { QueryState } from '../../components/query-state.js';
import { Alert, Badge, Button, Card } from '../../components/ui/index.js';
import { CANDIDATE_CARD } from './candidate-style.js';

const WORK_TYPE_LABELS: Record<string, string> = {
  ONSITE: 'On-site',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
};

export function JobDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: job, isPending, error: loadError, refetch } = useJobDetail(id);
  const apply = useApply();

  const error = apply.error instanceof ApiError ? apply.error : null;

  /*
   * A 404 genuinely means the role is gone. A 500, a 403 or a dropped
   * connection do not — and `if (!job)` used to report all of them with the
   * same sentence, so a candidate on a train was told the job had been
   * withdrawn.
   */
  const gone = loadError instanceof ApiError && loadError.status === 404;
  if (isPending || (loadError && !gone) || (!job && !gone)) {
    return (
      <QueryState
        isPending={isPending}
        error={loadError ?? (job ? null : new Error('Role unavailable'))}
        onRetry={() => void refetch()}
      >
        <span />
      </QueryState>
    );
  }
  if (!job) return <Alert tone="error">That role is no longer available.</Alert>;

  return (
    <div className="space-y-6">
      <Link
        to="/candidate/jobs"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
      >
        ← All roles
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Open Role</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">{job.title}</h1>
          <p className="mt-1.5 text-slate-600">
            {[job.functionName, job.sectorName].filter(Boolean).join(' · ')}
          </p>
        </div>
        {job.hasApplied && <Badge tone="green">Applied</Badge>}
      </div>

      {error && <Alert tone="error">{error.message}</Alert>}

      {apply.isSuccess && (
        <Alert tone="success" title="Application sent">
          Our team will review it and put you forward. You can follow it on your{' '}
          <Link to="/candidate/applications" className="font-medium underline">
            applications page
          </Link>
          .
        </Alert>
      )}

      <Card className={CANDIDATE_CARD}>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Location" value={[job.cityName, job.state].filter(Boolean).join(', ')} />
          <Row label="Work type" value={job.workType ? WORK_TYPE_LABELS[job.workType] : null} />
          <Row
            label="Experience"
            value={
              job.minExperience != null && job.maxExperience != null
                ? `${job.minExperience}-${job.maxExperience} years`
                : null
            }
          />
          <Row
            label="Education"
            value={job.educationRequirement ? EDUCATION_LABELS[job.educationRequirement as 'ANY'] : null}
          />
          <Row label="Department" value={job.department} />
          <Row label="Openings" value={String(job.numberOfPositions)} />
        </dl>

        {job.requiredSkills.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              What they need
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.requiredSkills.map((s) => (
                <span key={s.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-800">
                  {s.name}
                </span>
              ))}
              {job.goodToHaveSkills.map((s) => (
                <span key={s.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  {s.name} · nice to have
                </span>
              ))}
            </div>
          </div>
        )}

        {job.description && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              About the role
            </p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
              {job.description}
            </p>
          </div>
        )}

        {job.publishedAt && (
          <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
            Posted {formatDate(job.publishedAt)}
          </p>
        )}
      </Card>

      <Card className={CANDIDATE_CARD}>
        {job.hasApplied ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-600">You&rsquo;ve applied to this role.</p>
            <Button variant="secondary" onClick={() => navigate('/candidate/applications')}>
              Track it
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-brand-900">Ready to apply?</p>
              <p className="mt-1 text-sm text-slate-600">
                Your profile is your application. There&rsquo;s nothing else to fill in. The company
                is revealed to you once you&rsquo;re shortlisted.
              </p>
            </div>
            <Button onClick={() => apply.mutate(job.id)} loading={apply.isPending}>
              Apply
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-1 font-medium text-slate-800">{value || 'Not specified'}</dd>
    </div>
  );
}
