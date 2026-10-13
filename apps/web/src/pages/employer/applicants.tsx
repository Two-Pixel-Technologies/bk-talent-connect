/**
 * The employer's applicant pipeline for one role.
 *
 * A four-column board — NEW / REVIEWING / INTERVIEW / DECISION — using the
 * exact bucket the server already computes per applicant (EMPLOYER_BUCKET_OF
 * in @bktc/shared, mirrored in the `bucket` field the API returns). Grouping
 * happens entirely client-side from one fetch: the backend has no
 * bucket-level filter, only an exact-stage one, and re-deriving the mapping
 * here would risk drifting from the shared source of truth it already comes
 * from. Recommended candidates stay pinned first within each column because
 * the server's own ORDER BY already put them first in the flat list this
 * groups from — no client-side sort is introduced.
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  EMPLOYER_BUCKETS,
  formatDate,
  formatDateTime,
  formatRelative,
  EDUCATION_LABELS,
  type EmployerBucket,
  type Page,
} from '@bktc/shared';
import { api, ApiError } from '../../lib/api-client.js';
import {
  useEmployerInterview,
  useRequestInterview,
  useConfirmEmployerInterview,
  useScheduleEmployerInterview,
  useCancelEmployerInterview,
  useCompleteEmployerInterview,
} from '../../features/employer/use-employer.js';
import { Alert, Badge, Button, Card, EmptyState, Field, Select } from '../../components/ui/index.js';
import { QueryState } from '../../components/query-state.js';
import { MutationFeedback } from '../../components/mutation-feedback.js';
import { EMPLOYER_CARD } from './employer-style.js';

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

const STAGE_ACTIONS: Record<string, { label: string; variant: 'primary' | 'secondary' | 'danger' }> = {
  UNDER_REVIEW: { label: 'Start reviewing', variant: 'secondary' },
  SHORTLISTED: { label: 'Shortlist', variant: 'primary' },
  NOT_SELECTED: { label: 'Not suitable', variant: 'danger' },
  OFFER_MADE: { label: 'Make an offer', variant: 'primary' },
  JOINED: { label: 'Mark as joined', variant: 'primary' },
};

const BUCKET_META: Record<EmployerBucket, { label: string; dot: string }> = {
  NEW: { label: 'New', dot: 'bg-brand-500' },
  REVIEWING: { label: 'Reviewing', dot: 'bg-amber-500' },
  INTERVIEW: { label: 'Interview', dot: 'bg-emerald-500' },
  DECISION: { label: 'Decision', dot: 'bg-slate-400' },
};

/**
 * The largest page the shared pagination limits allow (LIMITS.pagination.
 * maxPageSize). A board shows every applicant at once rather than paging, and
 * this comfortably covers the proposal's own "30-60 candidates scored per
 * job" range without adding pagination controls a board has no good place
 * for. If a job ever exceeds it, the caption below says so honestly instead
 * of silently dropping rows.
 */
const BOARD_PAGE_SIZE = 100;

export function ApplicantsPage() {
  const { id = '' } = useParams();
  const [openId, setOpenId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isPending, error: listError, refetch } = useQuery({
    queryKey: ['employer', 'applicants', id, 'board'],
    queryFn: () =>
      api.get<ApplicantsResponse>(`/employer/jobs/${id}/applications?pageSize=${BOARD_PAGE_SIZE}`),
  });

  const changeStage = useMutation({
    mutationFn: ({ applicationId, next }: { applicationId: string; next: string }) =>
      api.post(`/employer/applications/${applicationId}/stage`, { stage: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employer'] }),
  });

  const actionError = changeStage.error instanceof ApiError ? changeStage.error : null;

  const items = data?.items ?? [];
  const columns: Record<EmployerBucket, Applicant[]> = {
    NEW: [],
    REVIEWING: [],
    INTERVIEW: [],
    DECISION: [],
  };
  for (const applicant of items) {
    if (applicant.bucket && applicant.bucket in columns) {
      columns[applicant.bucket as EmployerBucket].push(applicant);
    }
  }

  return (
    <div className="space-y-6">
      <Link to={`/employer/jobs/${id}`} className="inline-block text-sm font-medium text-brand-600 hover:underline">
        ← Back to the posting
      </Link>

      <div>
        <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Pipeline</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">
          Applicants{data ? ` · ${data.job.title}` : ''}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Shortlist, interview and decide. The whole process is yours to run.
        </p>
      </div>

      {actionError && <Alert tone="error">{actionError.message}</Alert>}

      <QueryState isPending={isPending} error={listError} onRetry={() => void refetch()}>
        {data && data.items.length === 0 ? (
          <EmptyState
            title="No applicants here yet"
            description="Our team also puts forward candidates who haven't applied directly - those appear here with a badge."
          />
        ) : (
          <>
            {data && data.total > BOARD_PAGE_SIZE && (
              <p className="text-xs text-slate-500">
                Showing the first {BOARD_PAGE_SIZE} of {data.total} applicants.
              </p>
            )}
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {EMPLOYER_BUCKETS.map((bucket) => (
                <BoardColumn
                  key={bucket}
                  bucket={bucket}
                  applicants={columns[bucket]}
                  openId={openId}
                  onToggle={setOpenId}
                  onStage={(applicationId, next) => changeStage.mutate({ applicationId, next })}
                  pendingId={changeStage.isPending ? changeStage.variables?.applicationId : undefined}
                />
              ))}
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}

function BoardColumn({
  bucket,
  applicants,
  openId,
  onToggle,
  onStage,
  pendingId,
}: {
  bucket: EmployerBucket;
  applicants: Applicant[];
  openId: string | null;
  onToggle: (id: string | null) => void;
  onStage: (applicationId: string, next: string) => void;
  pendingId: string | undefined;
}) {
  const meta = BUCKET_META[bucket];

  return (
    <div className="flex w-[300px] shrink-0 flex-col sm:w-[310px]">
      <div className="flex items-center gap-2 px-1 pb-3">
        <span aria-hidden="true" className={`size-2 rounded-full ${meta.dot}`} />
        <h2 className="text-sm font-semibold text-brand-900">{meta.label}</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
          {applicants.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 rounded-xl bg-slate-100/60 p-2.5">
        {applicants.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
            No one here
          </div>
        ) : (
          applicants.map((applicant) => (
            <ApplicantCard
              key={applicant.id}
              applicant={applicant}
              open={openId === applicant.id}
              onToggle={() => onToggle(openId === applicant.id ? null : applicant.id)}
              onStage={(next) => onStage(applicant.id, next)}
              isPending={pendingId === applicant.id}
            />
          ))
        )}
      </div>
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
      // INTERVIEW_SCHEDULED -> NOT_SELECTED is legal too (candidate failed to
      // confirm, or you decide not to proceed before the interview happens),
      // but that action lives in the interview panel below, next to the
      // booking it is a decision about, not duplicated here.
      case 'INTERVIEWED':
        return ['OFFER_MADE', 'NOT_SELECTED'];
      case 'OFFER_ACCEPTED':
        return ['JOINED'];
      default:
        return [];
    }
  })();

  return (
    <Card className={`p-4 ${EMPLOYER_CARD} ${applicant.isRecommended ? 'ring-1 ring-brand-200' : ''}`}>
      <div className="min-w-0">
        {applicant.isRecommended && (
          <Badge tone="brand">Recommended by us</Badge>
        )}
        <p className={`font-semibold text-slate-900 ${applicant.isRecommended ? 'mt-1.5' : ''}`}>
          {c.fullName}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {[c.currentJobTitle, c.currentEmployer].filter(Boolean).join(' at ') || 'No current role given'}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
        {c.yearsOfExperience != null && <span>{c.yearsOfExperience} yrs</span>}
        {c.cityName && <span>{c.cityName}</span>}
        {c.functionName && <span>{c.functionName}</span>}
        {!applicant.candidateAvailable && <Badge tone="amber">With our team</Badge>}
      </div>

      {c.skills.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {c.skills.slice(0, 4).map((s) => (
            <span key={s.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-800">
              {s.name}
            </span>
          ))}
          {c.skills.length > 4 && (
            <span className="px-1 py-0.5 text-[11px] text-slate-400">+{c.skills.length - 4}</span>
          )}
        </div>
      )}

      <p className="mt-2.5 text-xs text-slate-400">Applied {formatDate(applicant.appliedAt)}</p>

      {open && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {c.careerSummary && (
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Summary</p>
              <p className="mt-1 text-xs whitespace-pre-wrap text-slate-700">{c.careerSummary}</p>
            </div>
          )}

          {c.experiences.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Career history
              </p>
              <ul className="mt-1.5 space-y-2">
                {c.experiences.map((e) => (
                  <li key={e.id} className="text-xs">
                    <p className="font-medium text-slate-800">
                      {e.title} · {e.company}
                    </p>
                    <p className="text-xs text-slate-500">
                      {e.startYear} - {e.isCurrent ? 'present' : e.endYear}
                    </p>
                    {e.keyAchievement && <p className="mt-0.5 text-slate-600">{e.keyAchievement}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Row label="Sector" value={c.sectorName} />
          <Row
            label="Education"
            value={[c.educationLevel ? EDUCATION_LABELS[c.educationLevel as 'BTECH'] : null, c.qualification]
              .filter(Boolean)
              .join(' · ')}
          />

          {!applicant.candidateAvailable && (
            <Alert tone="info">
              This candidate is updating their profile and it is back with our team for a quick
              re-check. Their CV is unavailable until we&rsquo;ve looked at it.
            </Alert>
          )}

          {applicant.resumeFileId && (
            <a
              href={`/api/files/${applicant.resumeFileId}`}
              className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-brand-700 hover:bg-slate-50"
            >
              Download CV
            </a>
          )}

          <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
            Contact details are held by the BK Talent Connect team. Shortlist this candidate and
            we&rsquo;ll arrange the conversation.
          </p>
        </div>
      )}

      {INTERVIEW_RELEVANT.includes(applicant.stage) && (
        <InterviewPanel
          applicationId={applicant.id}
          candidateName={c.fullName}
          stage={applicant.stage}
          onNotSelected={() => {
            if (
              window.confirm(`Mark ${c.fullName} as not suitable? They are notified, and this is hard to reverse.`)
            ) {
              onStage('NOT_SELECTED');
            }
          }}
        />
      )}

      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
        <Button variant="ghost" className="px-2 text-xs" onClick={onToggle}>
          {open ? 'Hide profile' : 'View profile'}
        </Button>

        {nextStages.map((next) => {
          const action = STAGE_ACTIONS[next];
          if (!action) return null;
          return (
            <Button
              key={next}
              variant={action.variant}
              className="px-2 text-xs"
              loading={isPending}
              onClick={() => {
                // Turning someone down notifies them and cannot be taken
                // back after 24 hours. It was a one-tap danger button.
                if (
                  next === 'NOT_SELECTED' &&
                  !window.confirm(
                    `Mark ${c.fullName} as not suitable? They are notified, and this is hard to reverse.`,
                  )
                ) {
                  return;
                }
                if (
                  next === 'JOINED' &&
                  !window.confirm(`Confirm ${c.fullName} has joined? This closes the application.`)
                ) {
                  return;
                }
                // They are notified immediately, and there is no stage back
                // to retract it from here — only the candidate can accept,
                // decline or withdraw from this point on.
                if (
                  next === 'OFFER_MADE' &&
                  !window.confirm(`Make an offer to ${c.fullName}? They are notified right away, and you cannot retract it from here.`)
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
 * Scheduling, cancelling and completing are the employer's own actions now —
 * previously admin-only (see stages.ts). "Ask us to arrange" is kept as a
 * softer alternative: send preferred slots without committing to one yet.
 */
function InterviewPanel({
  applicationId,
  candidateName,
  stage,
  onNotSelected,
}: {
  applicationId: string;
  candidateName: string;
  stage: string;
  onNotSelected: () => void;
}) {
  const { data, isPending } = useEmployerInterview(applicationId, true);
  const requestInterview = useRequestInterview();
  const confirm = useConfirmEmployerInterview();
  const schedule = useScheduleEmployerInterview();
  const cancel = useCancelEmployerInterview();
  const complete = useCompleteEmployerInterview();
  const [asking, setAsking] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [slots, setSlots] = useState<string[]>(['']);
  const [note, setNote] = useState('');
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState(45);
  const [mode, setMode] = useState<'PHONE' | 'VIDEO' | 'ONSITE'>('VIDEO');
  const [locationOrLink, setLocationOrLink] = useState('');
  const [instructions, setInstructions] = useState('');

  const error = requestInterview.error instanceof ApiError ? requestInterview.error : null;
  const scheduleError = schedule.error instanceof ApiError ? schedule.error : null;

  // `if (isPending) return null` also swallowed the error state, so a failed
  // interview lookup removed the "Schedule" button from the page entirely
  // with no explanation.
  if (isPending) return null;
  if (!data) {
    return (
      <p className="mt-3 text-xs text-accent-700">
        We could not load the interview details. Refresh to try again.
      </p>
    );
  }

  const interview = data.interview;

  function submitSchedule() {
    if (!when || !locationOrLink.trim()) return;
    schedule.mutate(
      {
        applicationId,
        scheduledAt: new Date(when).toISOString(),
        durationMinutes: duration,
        mode,
        locationOrLink: locationOrLink.trim(),
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
      },
      { onSuccess: () => setScheduling(false) },
    );
  }

  if (interview) {
    return (
      <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50 p-3">
        <p className="text-[11px] font-semibold tracking-wide text-brand-700 uppercase">
          Interview arranged
        </p>
        <div className="mt-1 min-w-0">
          {/* Identical string to the one the candidate is shown. */}
          <p className="text-sm font-semibold text-brand-900">{formatDateTime(interview.scheduledAt)}</p>
          <p className="mt-0.5 text-xs text-brand-800">
            {MODE_LABEL[interview.mode]} · {interview.durationMinutes} minutes
          </p>
          <p className="mt-1 text-xs break-words text-brand-800">{interview.locationOrLink}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {interview.youConfirmedAt ? (
            <Badge tone="green">You confirmed</Badge>
          ) : (
            <Button
              className="px-2 text-xs"
              loading={confirm.isPending}
              onClick={() => confirm.mutate(applicationId)}
            >
              Confirm
            </Button>
          )}
          {stage === 'INTERVIEW_SCHEDULED' && (
            <>
              <Button
                variant="secondary"
                className="px-2 text-xs"
                loading={complete.isPending}
                onClick={() => complete.mutate(interview.id)}
              >
                Mark as held
              </Button>
              <Button
                variant="ghost"
                className="px-2 text-xs"
                loading={cancel.isPending}
                onClick={() => {
                  if (window.confirm(`Cancel the interview with ${candidateName}? They will be told.`)) {
                    cancel.mutate(interview.id);
                  }
                }}
              >
                Cancel interview
              </Button>
              <Button variant="danger" className="px-2 text-xs" onClick={onNotSelected}>
                Not suitable
              </Button>
            </>
          )}
        </div>
        {/* The candidate's identical button got this; the employer's was
            missed. A failed confirm looked exactly like a successful one. */}
        <MutationFeedback
          error={confirm.error}
          isSuccess={confirm.isSuccess}
          successMessage="Confirmed. We have told the candidate."
        />
        <MutationFeedback
          error={cancel.error}
          isSuccess={cancel.isSuccess}
          successMessage="Cancelled. We have told the candidate."
        />
        <MutationFeedback
          error={complete.error}
          isSuccess={complete.isSuccess}
          successMessage="Marked as held."
        />
        <p className="mt-2 text-xs text-brand-700">
          {interview.otherPartyConfirmed
            ? `${candidateName} has confirmed.`
            : `${candidateName} has not confirmed yet.`}
        </p>
      </div>
    );
  }

  if (stage === 'INTERVIEWED') {
    return (
      <div className="mt-3">
        <Alert tone="info">Interview held. Make an offer when you are ready, or mark not suitable.</Alert>
      </div>
    );
  }

  if (data.hasOpenRequest) {
    return (
      <div className="mt-3 space-y-2">
        <Alert tone="info">
          You asked for preferred slots. Schedule it directly when you have picked one.
        </Alert>
        <Button variant="secondary" className="w-full px-2 text-xs" onClick={() => setScheduling(true)}>
          Schedule the interview
        </Button>
        {scheduling && (
          <ScheduleForm
            candidateName={candidateName}
            when={when}
            setWhen={setWhen}
            duration={duration}
            setDuration={setDuration}
            mode={mode}
            setMode={setMode}
            locationOrLink={locationOrLink}
            setLocationOrLink={setLocationOrLink}
            instructions={instructions}
            setInstructions={setInstructions}
            error={scheduleError}
            loading={schedule.isPending}
            onSubmit={submitSchedule}
            onCancel={() => setScheduling(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {!scheduling && !asking && (
        <>
          <Button variant="primary" className="w-full px-2 text-xs" onClick={() => setScheduling(true)}>
            Schedule interview
          </Button>
          <Button variant="ghost" className="w-full px-2 text-xs" onClick={() => setAsking(true)}>
            Or ask for preferred slots first
          </Button>
        </>
      )}

      {scheduling && (
        <ScheduleForm
          candidateName={candidateName}
          when={when}
          setWhen={setWhen}
          duration={duration}
          setDuration={setDuration}
          mode={mode}
          setMode={setMode}
          locationOrLink={locationOrLink}
          setLocationOrLink={setLocationOrLink}
          instructions={instructions}
          setInstructions={setInstructions}
          error={scheduleError}
          loading={schedule.isPending}
          onSubmit={submitSchedule}
          onCancel={() => setScheduling(false)}
        />
      )}

      {asking && (
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-800">When would suit you for {candidateName}?</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Optional. Pick an exact time and schedule it directly instead if you already know one.
          </p>

          {error && (
            <div className="mt-2">
              <Alert tone="error">{error.message}</Alert>
            </div>
          )}

          <div className="mt-2 space-y-2">
            {slots.map((slot, index) => (
              <input
                key={index}
                type="datetime-local"
                value={slot}
                aria-label={`Preferred slot ${index + 1}`}
                onChange={(e) => setSlots((s) => s.map((v, i) => (i === index ? e.target.value : v)))}
                className="min-h-10 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
              />
            ))}
            {slots.length < 3 && (
              <Button variant="ghost" className="px-2 text-xs" onClick={() => setSlots((s) => [...s, ''])}>
                Add another slot
              </Button>
            )}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything you want to tell them?"
            aria-label="Note for the candidate"
            className="mt-2 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
          />

          <div className="mt-2 flex flex-col gap-2">
            <Button
              className="px-2 text-xs"
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
            <Button variant="secondary" className="px-2 text-xs" onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleForm({
  candidateName,
  when,
  setWhen,
  duration,
  setDuration,
  mode,
  setMode,
  locationOrLink,
  setLocationOrLink,
  instructions,
  setInstructions,
  error,
  loading,
  onSubmit,
  onCancel,
}: {
  candidateName: string;
  when: string;
  setWhen: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  mode: 'PHONE' | 'VIDEO' | 'ONSITE';
  setMode: (v: 'PHONE' | 'VIDEO' | 'ONSITE') => void;
  locationOrLink: string;
  setLocationOrLink: (v: string) => void;
  instructions: string;
  setInstructions: (v: string) => void;
  error: ApiError | null;
  loading: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs font-medium text-slate-800">Schedule the interview with {candidateName}</p>

      {error && (
        <div className="mt-2">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}

      <div className="mt-2 space-y-2">
        <input
          type="datetime-local"
          value={when}
          aria-label="Date and time"
          onChange={(e) => setWhen(e.target.value)}
          className="min-h-10 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Duration (minutes)" htmlFor="interview-duration">
            <input
              id="interview-duration"
              type="number"
              min={10}
              max={480}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="min-h-10 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
            />
          </Field>
          <Field label="Mode" htmlFor="interview-mode">
            <Select
              id="interview-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'PHONE' | 'VIDEO' | 'ONSITE')}
            >
              {Object.entries(MODE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <input
          value={locationOrLink}
          onChange={(e) => setLocationOrLink(e.target.value)}
          placeholder="Address, or the meeting link"
          aria-label="Address or meeting link"
          className="min-h-10 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
        />
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          placeholder="Anything the candidate should know (optional)"
          aria-label="Instructions for the candidate"
          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
        />
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <Button className="px-2 text-xs" loading={loading} onClick={onSubmit}>
          Confirm the interview
        </Button>
        <Button variant="secondary" className="px-2 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-xs text-slate-800">{value || 'Not specified'}</dd>
    </div>
  );
}
