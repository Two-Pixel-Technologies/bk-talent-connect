/**
 * Candidate review queue.
 *
 * The list and the detail sit side by side on a wide screen so a reviewer can
 * work through a queue without losing their place. On a phone the detail
 * replaces the list.
 */

import { Link } from 'react-router-dom';
import { formatDate, formatSalary, NOTICE_PERIOD_LABELS, EDUCATION_LABELS } from '@bktc/shared';
import {
  useCandidateQueue,
  useReviewCandidate,
  useCandidateDetail,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_TONE,
  type AdminCandidate,
  type ReviewDecision,
} from '../../features/admin/use-admin.js';
import { ReviewPanel } from '../../components/review-panel.js';
import { QueueShell, QueueList } from './queue-shell.js';
import { useQueueScreen } from '../../features/admin/use-queue-screen.js';
import { NotesPanel } from '../../components/notes-panel.js';
import { AccountControls } from '../../components/account-controls.js';
import { Badge, Card } from '../../components/ui/index.js';
import { ADMIN_CARD } from './admin-style.js';

const FILTERS = [
  { value: 'SUBMITTED', label: 'Awaiting review' },
  { value: '', label: 'All' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'REJECTED', label: 'Rejected' },
];

export function CandidateQueuePage() {
  const queue = useQueueScreen<AdminCandidate>({
    defaultStatus: 'SUBMITTED',
    useList: useCandidateQueue,
    useDetail: useCandidateDetail,
    selectDetail: (d) => (d as { candidate?: AdminCandidate } | undefined)?.candidate,
  });
  const { status, search, page, selected, selectedId, list } = queue;
  const { data, isPending, error, refetch } = list;
  const review = useReviewCandidate();
  void selectedId;

  function submitReview(decision: ReviewDecision, note: string) {
    if (!selected) return;
    review.mutate(
      { id: selected.id, decision, note, expectedStatus: selected.profileStatus },
      { onSuccess: () => queue.setSelectedId(null) },
    );
  }

  return (
    <QueueShell
      title="Candidates"
      subtitle="Approve a profile and the candidate can browse and apply to roles."
      filters={FILTERS}
      status={status}
      onStatusChange={queue.setStatus}
      search={search}
      onSearchChange={queue.setSearch}
      searchPlaceholder="Search by name or email"
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
            status === 'SUBMITTED' ? 'No profiles are waiting for review.' : 'Try a different filter.'
          }
        >
          {data?.items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => queue.setSelectedId(c.id)}
              className={`w-full cursor-pointer rounded-xl border p-4 text-left transition-all ${
                selectedId === c.id
                  ? 'border-brand-400 bg-brand-50 shadow-[0_2px_10px_rgba(15,23,42,0.05)]'
                  : `bg-white hover:border-brand-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)] ${ADMIN_CARD}`
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-brand-900">{c.fullName}</p>
                <Badge tone={REVIEW_STATUS_TONE[c.profileStatus] ?? 'slate'}>
                  {REVIEW_STATUS_LABEL[c.profileStatus] ?? c.profileStatus}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {[c.currentJobTitle, c.sectorName].filter(Boolean).join(' · ') || 'Profile incomplete'}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {[
                  c.yearsOfExperience != null ? `${c.yearsOfExperience} yrs` : null,
                  c.cityName,
                  `${c.completionPercent}% complete`,
                  c.submittedAt ? `submitted ${formatDate(c.submittedAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
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
            <CandidateDetail candidate={selected} />
            <ReviewPanel
              currentStatus={selected.profileStatus}
              onReview={submitReview}
              isPending={review.isPending}
              error={review.error}
              noun="candidate"
            />
            <Card className={ADMIN_CARD}>
              <NotesPanel entityType="CANDIDATE" entityId={selected.id} />
            </Card>
            <Card className={ADMIN_CARD}>
              <AccountControls
                userId={selected.userId}
                userStatus={selected.userStatus}
                name={selected.fullName}
                kind="candidate"
              />
            </Card>
          </div>
        )
      }
    />
  );
}

function CandidateDetail({ candidate: c }: { candidate: AdminCandidate }) {
  return (
    <Card className={ADMIN_CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-brand-900">{c.fullName}</h2>
          <p className="mt-0.5 text-sm text-slate-600">{c.currentJobTitle ?? '—'}</p>
        </div>
        <Badge tone={REVIEW_STATUS_TONE[c.profileStatus] ?? 'slate'}>
          {REVIEW_STATUS_LABEL[c.profileStatus] ?? c.profileStatus}
        </Badge>
      </div>

      {/* Contact details are shown to admins only — this is the routing point
          that keeps employers from reaching candidates directly. */}
      <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Row label="Email" value={c.email} />
        <Row label="Mobile" value={c.mobile} />
        <Row label="Location" value={[c.cityName, c.state].filter(Boolean).join(', ')} />
        <Row label="Experience" value={c.yearsOfExperience != null ? `${c.yearsOfExperience} years` : null} />
        {/*
          * sectorOther/educationLevelOther only ever carry a value when the
          * candidate picked "Other" — showing just the taxonomy label in
          * that case ("Sector: Other") tells a reviewer nothing about what
          * the candidate actually does. The candidate-side change that added
          * these fields (single Sector field, Other + custom text) needed
          * this one line here too, or the data they typed would be invisible
          * to the person approving their profile.
          */}
        <Row label="Sector" value={c.sectorOther ? `Other - ${c.sectorOther}` : c.sectorName} />
        <Row label="Function" value={c.functionName} />
        <Row
          label="Education"
          value={[
            c.educationLevelOther
              ? `Other - ${c.educationLevelOther}`
              : c.educationLevel
                ? EDUCATION_LABELS[c.educationLevel as 'BTECH']
                : null,
            c.qualification,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
        <Row
          label="Notice period"
          value={c.noticePeriod ? NOTICE_PERIOD_LABELS[c.noticePeriod as 'D30'] : null}
        />
      </dl>

      {c.careerSummary && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Career summary
          </p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{c.careerSummary}</p>
        </div>
      )}

      {c.skills.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Skills</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.skills.map((s) => (
              <span key={s.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-800">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {c.experiences.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Career history
          </p>
          <ul className="mt-2 space-y-3">
            {c.experiences.map((e) => (
              <li key={e.id} className="text-sm">
                <p className="font-medium text-slate-800">
                  {e.title} · {e.company}
                </p>
                <p className="text-xs text-slate-500">
                  {e.startYear} – {e.isCurrent ? 'present' : e.endYear}
                </p>
                {e.keyAchievement && <p className="mt-1 text-slate-600">{e.keyAchievement}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        Admin-only, and marked as such. These figures are the reason the
        serializer layer exists — no employer view carries them.
      */}
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">
          🔒 Salary — visible to you only
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Row label="Current" value={c.currentSalaryLpa != null ? formatSalary(c.currentSalaryLpa * 100_000) : null} />
          <Row label="Expects from" value={c.expectedSalaryMinLpa != null ? `${c.expectedSalaryMinLpa} LPA` : null} />
          <Row label="Expects up to" value={c.expectedSalaryMaxLpa != null ? `${c.expectedSalaryMaxLpa} LPA` : null} />
        </dl>
      </div>

      {/* The reviewer is BK's whole value proposition — approving without the
          CV means exercising the gate blind. */}
      {c.resumeFileId && (
        <div className="mt-4">
          <a
            href={`/api/files/${c.resumeFileId}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-brand-700 hover:bg-slate-50"
          >
            Download CV{c.resumeFileName ? ` · ${c.resumeFileName}` : ''}
          </a>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>{c.completionPercent}% complete</span>
        <span>{c.resumeFileId ? 'CV uploaded' : 'No CV'}</span>
        {c.consentedAt && <span>Consented {formatDate(c.consentedAt)}</span>}
        {c.userStatus !== 'ACTIVE' && <Badge tone="red">{c.userStatus}</Badge>}
      </div>

      {c.reviewNote && (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <span className="font-medium">Last note:</span> {c.reviewNote}
        </p>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <Link
          to={`/admin/pipeline?candidateId=${c.id}`}
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
