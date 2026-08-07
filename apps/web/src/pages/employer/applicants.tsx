/**
 * The employer's applicant list for one role.
 *
 * Grouped into the four buckets the contract showed employers — NEW /
 * REVIEWING / INTERVIEW / DECISION — rather than the eleven internal stages.
 * Recommended candidates are pinned first by the server, and the badge says why.
 *
 * There is no salary and no contact detail anywhere on this screen, because
 * there is none in the payload.
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate, formatDateTime, formatRelative, EDUCATION_LABELS, type Page } from '@bktc/shared';
import { api, ApiError } from '../../lib/api-client.js';
import {
  useEmployerInterview,
  useRequestInterview,
  useConfirmEmployerInterview,
} from '../../features/employer/use-employer.js';
import { Alert, Badge, Button, Card, EmptyState } from '../../components/ui/index.js';
import { QueryState } from '../../components/query-state.js';
import { MutationFeedback } from '../../components/mutation-feedback.js';
import { Pagination } from '../../components/pagination.js';

type ApplicantCandidate = {
  id: string;
  fullName: string;
  cityName: string | null;
  state: string | null;
  currentJobTitle: string | null;
  currentEmployer: string | null;
  yearsOfExperience: number | null;
  sectorName: string | null;
  functionName: string | null;
  educationLevel: string | null;
  qualification: string | null;
  careerSummary: string | null;
  skills: { id: number; name: string }[];
  experiences: {
    id: string;
    company: string;
    title: string;
    startYear: number;
    endYear: number | null;
    isCurrent: boolean;
    keyAchievement: string | null;
  }[];
  hasResume: boolean;
};

type Applicant = {
  id: string;
  candidate: ApplicantCandidate;
  bucket: string | null;
  stage: string;
  isRecommended: boolean;
  appliedAt: string;
  lastStageChangeAt: string;
  resumeFileId: string | null;
  /** False while the candidate's profile is back with our team for re-review. */
  candidateAvailable: boolean;
};

type ApplicantsResponse = Page<Applicant> & {
  counts: Record<string, number>;
  job: { id: string; title: string; cityName: string | null };
};

const BUCKETS = [
  { value: '', label: 'Everyone' },
  { value: 'APPLIED', label: 'New' },
  { value: 'UNDER_REVIEW', label: 'Reviewing' },
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  // The contract shows employers four buckets and these two were missing, so
  // a candidate at interview or offer stage could only be found under
  // "Everyone" — which, before pagination existed, often meant not at all.
  { value: 'INTERVIEW_SCHEDULED', label: 'Interview' },
  { value: 'OFFER_MADE', label: 'Offer' },
  { value: 'NOT_SELECTED', label: 'Not selected' },
];

const STAGE_ACTIONS: Record<string, { label: string; variant: 'primary' | 'secondary' | 'danger' }> = {
  UNDER_REVIEW: { label: 'Start reviewing', variant: 'secondary' },
  SHORTLISTED: { label: 'Shortlist', variant: 'primary' },
  NOT_SELECTED: { label: 'Not suitable', variant: 'danger' },
  OFFER_MADE: { label: 'Make an offer', variant: 'primary' },
};

export function ApplicantsPage() {
  const { id = '' } = useParams();
  const [stage, setStage] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isPending, error: listError, refetch } = useQuery({
    queryKey: ['employer', 'applicants', id, stage, page],
    queryFn: () => {
      /*
       * This list had no pagination at all — it requested page 1, rendered 20
       * rows and offered no way to reach page 2, on the busiest screen in the
       * product. It also quietly invalidated the "recommended candidates stay
       * pinned across pages" guarantee, since there were no pages.
       */
      const params = new URLSearchParams({ page: String(page) });
      if (stage) params.set('stage', stage);
      return api.get<ApplicantsResponse>(`/employer/jobs/${id}/applications?${params.toString()}`);
    },
    placeholderData: (prev) => prev,
  });

  const changeStage = useMutation({
    mutationFn: ({ applicationId, next }: { applicationId: string; next: string }) =>
      api.post(`/employer/applications/${applicationId}/stage`, { stage: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employer'] }),
  });

  const actionError = changeStage.error instanceof ApiError ? changeStage.error : null;

  return (
    <div className="space-y-6">
      <Link to={`/employer/jobs/${id}`} className="inline-block text-sm text-brand-600 hover:underline">
        ← Back to the posting
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-brand-900">
          Applicants{data ? ` · ${data.job.title}` : ''}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Shortlist anyone you want to meet and our team arranges the interview.
        </p>
      </div>

      {actionError && <Alert tone="error">{actionError.message}</Alert>}

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {BUCKETS.map((b) => (
          <button
            key={b.value || 'all'}
            type="button"
            onClick={() => {
              // Reset to page 1: staying on page 3 of a filter with one page
              // of results shows an empty list.
              setPage(1);
              setStage(b.value);
            }}
            className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors ${
              stage === b.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {b.label}
            {data?.counts[b.value] ? <span className="ml-1.5 opacity-70">{data.counts[b.value]}</span> : null}
          </button>
        ))}
      </div>

      <QueryState isPending={isPending} error={listError} onRetry={() => void refetch()}>
      {data && data.items.length === 0 && (
        <EmptyState
          title="No applicants here yet"
          description="Our team also puts forward candidates who haven't applied directly — those appear here with a badge."
        />
      )}

      <div className="space-y-3">
        {data?.items.map((applicant) => (
          <ApplicantCard
            key={applicant.id}
            applicant={applicant}
            open={openId === applicant.id}
            onToggle={() => setOpenId(openId === applicant.id ? null : applicant.id)}
            onStage={(next) => changeStage.mutate({ applicationId: applicant.id, next })}
            isPending={
              changeStage.isPending && changeStage.variables?.applicationId === applicant.id
            }
          />
        ))}
      </div>
      </QueryState>

      {data && (
        <Pagination
          page={page}
          pageSize={data.pageSize}
          total={data.total}
          onChange={setPage}
          noun="applicant"
        />
      )}
    </div>
  );
}

function ApplicantCard({
  applicant,
  open,
  onToggle,
  onStage,
  isPending,
}: {
  applicant: Applicant;
  open: boolean;
  onToggle: () => void;
  onStage: (next: string) => void;
  isPending: boolean;
}) {
  const c = applicant.candidate;

  const nextStages = (() => {
    switch (applicant.stage) {
      case 'APPLIED':
        return ['UNDER_REVIEW', 'NOT_SELECTED'];
      case 'UNDER_REVIEW':
        return ['SHORTLISTED', 'NOT_SELECTED'];
      case 'SHORTLISTED':
        return ['NOT_SELECTED'];
      case 'INTERVIEWED':
        return ['OFFER_MADE', 'NOT_SELECTED'];
      default:
        return [];
    }
  })();

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-brand-900">{c.fullName}</p>
            {applicant.isRecommended && <Badge tone="brand">Recommended by us</Badge>}
            {!applicant.candidateAvailable && <Badge tone="amber">With our team</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {[c.currentJobTitle, c.currentEmployer].filter(Boolean).join(' at ')}
          </p>
        </div>
        <Badge tone={applicant.stage === 'NOT_SELECTED' ? 'red' : applicant.stage === 'SHORTLISTED' ? 'green' : 'amber'}>
          {applicant.stage.replace(/_/g, ' ').toLowerCase()}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
        {c.yearsOfExperience != null && <span>{c.yearsOfExperience} yrs</span>}
        {c.cityName && <span>{c.cityName}</span>}
        {c.functionName && <span>{c.functionName}</span>}
        <span>Applied {formatDate(applicant.appliedAt)}</span>
      </div>

      {c.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.skills.slice(0, 8).map((s) => (
            <span key={s.id} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-800">
              {s.name}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
          {c.careerSummary && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Summary</p>
              <p className="mt-1.5 text-sm whitespace-pre-wrap text-slate-700">{c.careerSummary}</p>
            </div>
          )}

          {c.experiences.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Career history
              </p>
              <ul className="mt-1.5 space-y-2">
                {c.experiences.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="font-medium text-slate-800">
                      {e.title} · {e.company}
                    </p>
                    <p className="text-xs text-slate-500">
                      {e.startYear} – {e.isCurrent ? 'present' : e.endYear}
                    </p>
                    {e.keyAchievement && <p className="mt-0.5 text-slate-600">{e.keyAchievement}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Sector" value={c.sectorName} />
            <Row
              label="Education"
              value={[c.educationLevel ? EDUCATION_LABELS[c.educationLevel as 'BTECH'] : null, c.qualification]
                .filter(Boolean)
                .join(' · ')}
            />
          </div>

          {!applicant.candidateAvailable && (
            <Alert tone="info">
              This candidate is updating their profile and it is back with our team for a quick
              re-check. Their CV is unavailable until we&rsquo;ve looked at it.
            </Alert>
          )}

          {applicant.resumeFileId && (
            <a
              href={`/api/files/${applicant.resumeFileId}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-brand-700 hover:bg-slate-50"
            >
              Download CV
            </a>
          )}

          {/* Says plainly why there is no phone number on this screen. */}
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            Contact details are held by the BK Talent Connect team. Shortlist this candidate and
            we&rsquo;ll arrange the conversation.
          </p>
        </div>
      )}

      {INTERVIEW_RELEVANT.includes(applicant.stage) && (
        <InterviewPanel applicationId={applicant.id} candidateName={c.fullName} />
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <Button variant="ghost" className="px-3 text-xs" onClick={onToggle}>
          {open ? 'Hide profile' : 'View profile'}
        </Button>

        <div className="flex flex-wrap gap-2">
          {nextStages.map((next) => {
            const action = STAGE_ACTIONS[next];
            if (!action) return null;
            return (
              <Button
                key={next}
                variant={action.variant}
                className="px-3 text-xs"
                loading={isPending}
                onClick={() => {
                  // Turning someone down notifies them and cannot be taken
                  // back after 24 hours. It was a one-tap danger button.
                  if (
                    next === 'NOT_SELECTED' &&
                    !window.confirm(
                      `Tell our team ${c.fullName} is not suitable? They are notified, and this is hard to reverse.`,
                    )
                  ) {
                    return;
                  }
                  onStage(next);
                }}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Updated {formatRelative(applicant.lastStageChangeAt)}
      </p>
    </Card>
  );
}

/** Stages where an interview is either wanted or already booked. */
const INTERVIEW_RELEVANT = ['SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED'];

const MODE_LABEL: Record<string, string> = {
  PHONE: 'Phone call',
  VIDEO: 'Video call',
  ONSITE: 'At your site',
};

/**
 * The employer's interview panel.
 *
 * They can ask; they cannot book. That is the managed model, and the server
 * enforces it — an employer posting INTERVIEW_SCHEDULED directly gets a 403.
 * The copy explains why rather than leaving them looking for a button that
 * does not exist.
 */
function InterviewPanel({
  applicationId,
  candidateName,
}: {
  applicationId: string;
  candidateName: string;
}) {
  const { data, isPending } = useEmployerInterview(applicationId, true);
  const requestInterview = useRequestInterview();
  const confirm = useConfirmEmployerInterview();
  const [asking, setAsking] = useState(false);
  const [slots, setSlots] = useState<string[]>(['']);
  const [note, setNote] = useState('');

  const error = requestInterview.error instanceof ApiError ? requestInterview.error : null;

  // `if (isPending) return null` also swallowed the error state, so a failed
  // interview lookup removed the "Ask us to arrange an interview" button from
  // the page entirely with no explanation.
  if (isPending) return null;
  if (!data) {
    return (
      <p className="mt-4 text-sm text-accent-700">
        We could not load the interview details for this candidate. Refresh to try again.
      </p>
    );
  }

  const interview = data.interview;

  if (interview) {
    return (
      <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
          Interview arranged
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Identical string to the one the candidate is shown. */}
            <p className="font-semibold text-brand-900">{formatDateTime(interview.scheduledAt)}</p>
            <p className="mt-0.5 text-sm text-brand-800">
              {MODE_LABEL[interview.mode]} · {interview.durationMinutes} minutes
            </p>
            <p className="mt-1 text-sm break-words text-brand-800">{interview.locationOrLink}</p>
          </div>
          {interview.youConfirmedAt ? (
            <Badge tone="green">You confirmed</Badge>
          ) : (
            <Button
              className="px-3 text-xs"
              loading={confirm.isPending}
              onClick={() => confirm.mutate(applicationId)}
            >
              Confirm
            </Button>
          )}
        </div>
        {/* The candidate's identical button got this; the employer's was
            missed. A failed confirm looked exactly like a successful one. */}
        <MutationFeedback
          error={confirm.error}
          isSuccess={confirm.isSuccess}
          successMessage="Confirmed. We have told the candidate."
        />
        <p className="mt-3 text-xs text-brand-700">
          {interview.otherPartyConfirmed
            ? `${candidateName} has confirmed.`
            : `We are still confirming with ${candidateName}.`}{' '}
          To move it, tell us and we&rsquo;ll rearrange with both sides.
        </p>
      </div>
    );
  }

  if (data.hasOpenRequest) {
    return (
      <div className="mt-4">
        <Alert tone="info">
          We have your request and are finding a slot that works for both of you.
        </Alert>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {!asking ? (
        <Button variant="secondary" className="px-3 text-xs" onClick={() => setAsking(true)}>
          Ask us to arrange an interview
        </Button>
      ) : (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-800">
            When would suit you for {candidateName}?
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Optional. We confirm the final time with both of you.
          </p>

          {error && (
            <div className="mt-3">
              <Alert tone="error">{error.message}</Alert>
            </div>
          )}

          <div className="mt-3 space-y-2">
            {slots.map((slot, index) => (
              <input
                key={index}
                type="datetime-local"
                value={slot}
                aria-label={`Preferred slot ${index + 1}`}
                onChange={(e) =>
                  setSlots((s) => s.map((v, i) => (i === index ? e.target.value : v)))
                }
                className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
              />
            ))}
            {slots.length < 3 && (
              <Button
                variant="ghost"
                className="px-3 text-xs"
                onClick={() => setSlots((s) => [...s, ''])}
              >
                Add another slot
              </Button>
            )}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything we should tell them?"
            aria-label="Note for our team"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
          />

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              className="px-3 text-xs"
              loading={requestInterview.isPending}
              onClick={() =>
                requestInterview.mutate(
                  {
                    applicationId,
                    preferredSlots: slots
                      .filter((s) => s.trim())
                      .map((s) => new Date(s).toISOString()),
                    ...(note.trim() ? { note: note.trim() } : {}),
                  },
                  { onSuccess: () => setAsking(false) },
                )
              }
            >
              Send the request
            </Button>
            <Button variant="secondary" className="px-3 text-xs" onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
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
