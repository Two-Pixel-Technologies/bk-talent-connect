/**
 * Company verification queue.
 */

import {
  useEmployerQueue,
  useReviewEmployer,
  useEmployerDetail,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_TONE,
  type AdminEmployer,
  type ReviewDecision,
} from '../../features/admin/use-admin.js';
import { ReviewPanel } from '../../components/review-panel.js';
import { QueueShell, QueueList } from './queue-shell.js';
import { useQueueScreen } from '../../features/admin/use-queue-screen.js';
import { AccountControls } from '../../components/account-controls.js';
import { Badge, Card } from '../../components/ui/index.js';
import { ADMIN_CARD } from './admin-style.js';

const FILTERS = [
  { value: 'SUBMITTED', label: 'Awaiting verification' },
  { value: '', label: 'All' },
  { value: 'APPROVED', label: 'Verified' },
  { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { value: 'REJECTED', label: 'Rejected' },
];

export function EmployerQueuePage() {
  const queue = useQueueScreen<AdminEmployer>({
    defaultStatus: 'SUBMITTED',
    useList: useEmployerQueue,
    useDetail: useEmployerDetail,
    selectDetail: (d) => (d as { employer?: AdminEmployer } | undefined)?.employer,
  });
  const { status, search, page, selected, selectedId, list } = queue;
  const { data, isPending, error, refetch } = list;
  const review = useReviewEmployer();
  void selectedId;

  function submitReview(decision: ReviewDecision, note: string) {
    if (!selected) return;
    review.mutate(
      { id: selected.id, decision, note, expectedStatus: selected.accountStatus },
      { onSuccess: () => queue.setSelectedId(null) },
    );
  }

  return (
    <QueueShell
      title="Companies"
      subtitle="Verify a company and they can start posting roles."
      filters={FILTERS}
      status={status}
      onStatusChange={queue.setStatus}
      search={search}
      onSearchChange={queue.setSearch}
      searchPlaceholder="Search by company, email or phone"
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
            status === 'SUBMITTED'
              ? 'No companies are waiting for verification.'
              : 'Try a different filter.'
          }
        >
          {data?.items.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => queue.setSelectedId(e.id)}
              className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-all ${
                selectedId === e.id
                  ? 'border-brand-400 bg-brand-50 shadow-[0_2px_10px_rgba(15,23,42,0.05)]'
                  : `bg-white hover:border-brand-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)] ${ADMIN_CARD}`
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-brand-900">{e.companyName}</p>
                <Badge tone={REVIEW_STATUS_TONE[e.accountStatus] ?? 'slate'}>
                  {REVIEW_STATUS_LABEL[e.accountStatus] ?? e.accountStatus}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">{e.sectorName ?? 'No sector set'}</p>
              <p className="mt-2 text-xs text-slate-500">
                {e.hrContactName} · {e.jobCount} {e.jobCount === 1 ? 'posting' : 'postings'}
              </p>
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
            <EmployerDetail employer={selected} />
            <ReviewPanel
              currentStatus={selected.accountStatus}
              onReview={submitReview}
              isPending={review.isPending}
              error={review.error}
              noun="company"
            />
            <Card className={ADMIN_CARD}>
              <AccountControls
                userId={selected.userId}
                userStatus={selected.userStatus}
                name={selected.companyName}
                kind="company"
              />
            </Card>
          </div>
        )
      }
    />
  );
}

function EmployerDetail({ employer: e }: { employer: AdminEmployer }) {
  return (
    <Card className={ADMIN_CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-semibold text-brand-900">{e.companyName}</h2>
        <Badge tone={REVIEW_STATUS_TONE[e.accountStatus] ?? 'slate'}>
          {REVIEW_STATUS_LABEL[e.accountStatus] ?? e.accountStatus}
        </Badge>
      </div>

      <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Row label="Sector" value={e.sectorName} />
        <Row label="Hiring locations" value={e.locations.join(', ')} />
        <Row label="Contact" value={e.hrContactName} />
        <Row label="Phone" value={e.hrContactPhone} />
        <Row label="Email" value={e.email} />
        <Row label="Postings" value={String(e.jobCount)} />
      </dl>

      {(e.website || e.linkedinUrl) && (
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {e.website && (
            <a
              href={e.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="break-all text-brand-600 hover:underline"
            >
              {e.website}
            </a>
          )}
          {e.linkedinUrl && (
            <a
              href={e.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="break-all text-brand-600 hover:underline"
            >
              LinkedIn
            </a>
          )}
        </div>
      )}

      {e.companyIntro && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Introduction shown to candidates
          </p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{e.companyIntro}</p>
        </div>
      )}

      {e.userStatus !== 'ACTIVE' && (
        <p className="mt-4">
          <Badge tone="red">{e.userStatus}</Badge>
        </p>
      )}

      {e.reviewNote && (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <span className="font-medium">Last note:</span> {e.reviewNote}
        </p>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-800">{value || '—'}</dd>
    </div>
  );
}
