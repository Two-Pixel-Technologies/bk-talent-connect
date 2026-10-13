/**
 * Job posting approval queue.
 *
 * Contact flags are surfaced prominently: a phone number in a description is
 * how the no-direct-contact rule gets bypassed, and the reviewer is the control.
 */

import { Link } from 'react-router-dom';
import { formatDate, EDUCATION_LABELS } from '@bktc/shared';
import {
  useJobQueue,
  useReviewJob,
  useJobDetail,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_TONE,
  type AdminJob,
  type ReviewDecision,
} from '../../features/admin/use-admin.js';
import { ReviewPanel } from '../../components/review-panel.js';
import { QueueShell, QueueList } from './queue-shell.js';
import { useQueueScreen } from '../../features/admin/use-queue-screen.js';
import { Alert, Badge, Card } from '../../components/ui/index.js';
import { ADMIN_CARD } from './admin-style.js';

const FILTERS = [
  { value: 'PENDING_APPROVAL', label: 'Awaiting approval' },
  { value: '', label: 'All' },
  { value: 'APPROVED', label: 'Live' },
  { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'CLOSED', label: 'Closed' },
];

export function JobQueuePage() {
  const queue = useQueueScreen<AdminJob>({
    defaultStatus: 'PENDING_APPROVAL',
    useList: useJobQueue,
    useDetail: useJobDetail,
    selectDetail: (d) => d as AdminJob | undefined,
  });
  const { status, search, page, selected, selectedId, list } = queue;
  const { data, isPending, error, refetch } = list;
  const review = useReviewJob();
  void selectedId;

  function submitReview(decision: ReviewDecision, note: string) {
    if (!selected) return;
    review.mutate(
      { id: selected.id, decision, note, expectedStatus: selected.status },
      { onSuccess: () => queue.setSelectedId(null) },
    );
  }

  return (
    <QueueShell
      title="Job postings"
      subtitle="A posting is invisible to candidates until you approve it."
      filters={FILTERS}
      status={status}
      onStatusChange={queue.setStatus}
      search={search}
      onSearchChange={queue.setSearch}
      searchPlaceholder="Search by title or company"
      total={data?.total}
      page={page}
      pageSize={data?.pageSize ?? 20}
      onPageChange={queue.setPage}
      selected={Boolean(selected)}
      onBack={() => queue.setSelectedId(null)}
      list={
        <QueueList
          isPending={isPending}
          error={error}
          onRetry={() => void refetch()}
          isEmpty={data?.items.length === 0}
          emptyTitle="Nothing here"
          emptyDescription={
            status === 'PENDING_APPROVAL'
              ? 'No postings are waiting for approval.'
              : 'Try a different filter.'
          }
        >
          {data?.items.map((j) => (
            <button
              key={j.id}
              type="button"
              onClick={() => queue.setSelectedId(j.id)}
              className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-all ${
                selectedId === j.id
                  ? 'border-brand-400 bg-brand-50 shadow-[0_2px_10px_rgba(15,23,42,0.05)]'
                  : `bg-white hover:border-brand-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)] ${ADMIN_CARD}`
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-brand-900">{j.title}</p>
                <Badge tone={REVIEW_STATUS_TONE[j.status] ?? 'slate'}>
                  {REVIEW_STATUS_LABEL[j.status] ?? j.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">{j.employerName}</p>
              <p className="mt-2 text-xs text-slate-500">
                {[j.cityName, j.functionName].filter(Boolean).join(' · ')}
              </p>
              {j.contactFlags.length > 0 && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  ⚠ Contact details in the description
                </p>
              )}
            </button>
          ))}
        </QueueList>
      }
      detail={
        selected && (
          /* Keyed by record. Without this the panel stays mounted when the
             reviewer selects a different row, so its decision and its typed
             note survive — one click could reject the wrong person for
             somebody else's reason, and fire them the notification. */
          <div className="space-y-4" key={selected.id}>
            <JobDetail job={selected} />
            <ReviewPanel
              currentStatus={selected.status}
              onReview={submitReview}
              isPending={review.isPending}
              error={review.error}
              noun="employer"
            />
          </div>
        )
      }
    />
  );
}

function JobDetail({ job: j }: { job: AdminJob }) {
  return (
    <Card className={ADMIN_CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-brand-900">{j.title}</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {j.employerName}
            {j.department ? ` · ${j.department}` : ''}
          </p>
        </div>
        <Badge tone={REVIEW_STATUS_TONE[j.status] ?? 'slate'}>
          {REVIEW_STATUS_LABEL[j.status] ?? j.status}
        </Badge>
      </div>

      {j.contactFlags.length > 0 && (
        <div className="mt-4">
          <Alert tone="warning" title="Contact details found in the description">
            <p>
              {j.contactFlags.map((f) => `${f.kind}: ${f.value}`).join(' · ')}
            </p>
            <p className="mt-2">
              All candidate contact is meant to route through us. Ask them to remove it unless there
              is a good reason — a plant address or a certification number is fine.
            </p>
          </Alert>
        </div>
      )}

      <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Row label="Sector" value={j.sectorName} />
        <Row label="Function" value={j.functionName} />
        <Row
          label={j.additionalLocations.length > 0 ? 'Locations' : 'Location'}
          value={[
            [j.cityName, j.state].filter(Boolean).join(', '),
            ...j.additionalLocations.map((l) => [l.cityName, l.state].filter(Boolean).join(', ')),
          ]
            .filter(Boolean)
            .join('; ')}
        />
        <Row label="Work type" value={j.workType} />
        <Row
          label="Experience"
          value={
            j.minExperience != null && j.maxExperience != null
              ? `${j.minExperience}–${j.maxExperience} years`
              : null
          }
        />
        <Row
          label="Education"
          value={j.educationRequirement ? EDUCATION_LABELS[j.educationRequirement as 'ANY'] : null}
        />
        <Row label="Positions" value={String(j.numberOfPositions)} />
        <Row label="Published" value={j.publishedAt ? formatDate(j.publishedAt) : null} />
      </dl>

      {j.requiredSkills.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Required skills
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {j.requiredSkills.map((s) => (
              <span key={s.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-800">
                {s.name}
              </span>
            ))}
            {j.goodToHaveSkills.map((s) => (
              <span key={s.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                {s.name} (nice to have)
              </span>
            ))}
          </div>
        </div>
      )}

      {j.description && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Description</p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{j.description}</p>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">
          🔒 Salary band — never shown to candidates
        </p>
        <p className="mt-2 text-sm text-amber-900">
          {j.salaryBandMinLpa != null && j.salaryBandMaxLpa != null
            ? `${j.salaryBandMinLpa} – ${j.salaryBandMaxLpa} LPA`
            : 'Not set'}
        </p>
      </div>

      {j.reviewNote && (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <span className="font-medium">Last note:</span> {j.reviewNote}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {/* The route into the recommendation flow. Only offered once the posting
            is live — nobody should be put forward for a role no employer can act
            on, and the server refuses it anyway. */}
        {j.status === 'APPROVED' && (
          <Link
            to={`/admin/jobs/${j.id}/recommend`}
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            Find candidates to put forward
          </Link>
        )}
        <Link
          to={`/admin/pipeline?jobId=${j.id}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-brand-700 hover:bg-slate-50"
        >
          Show pipelines
        </Link>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value || '—'}</dd>
    </div>
  );
}
